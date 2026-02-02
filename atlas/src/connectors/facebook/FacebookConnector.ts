import type { Connector } from "../../core/Connector.js";
import { env } from "../../config/env.js";

export class FacebookConnector implements Connector {
  id = "facebook" as const;

  constructor(
    private pluto: any,
    private neptune: any
  ) {}

  async getAuthUrl({ redirectUri, state }: any) {
    const params = new URLSearchParams({
      client_id: env.FACEBOOK_APP_ID,
      redirect_uri: redirectUri,
      state,
      scope: "public_profile,email,pages_show_list",
      response_type: "code"
    });

    return `https://www.facebook.com/v18.0/dialog/oauth?${params}`;
  }

  async exchangeCode({ userId, code, redirectUri }: any) {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
      new URLSearchParams({
        client_id: env.FACEBOOK_APP_ID,
        client_secret: env.FACEBOOK_APP_SECRET,
        redirect_uri: redirectUri,
        code
      })
    );

    const token = await res.json();
    if (!token.access_token) throw new Error("Facebook token failed");

    const profile = await this.fbGet("/me?fields=id,name,email", token.access_token);

    await this.pluto.upsertToken(
      userId,
      "facebook",
      profile.id,
      { access_token: token.access_token }
    );

    await this.discoverInventory({ userId, providerAccountId: profile.id });
    return { providerAccountId: profile.id };
  }

  async discoverInventory({ userId, providerAccountId }: any) {
    const token = await this.pluto.getToken(userId, "facebook", providerAccountId);

    const profile = await this.fbGet("/me?fields=id,name,email", token.access_token);
    const pages = await this.fbGet("/me/accounts", token.access_token);

    const account = await this.neptune.upsertAccount({
      userId,
      provider: "facebook",
      providerAccountId,
      displayName: profile.name,
      primaryEmail: profile.email,
      rawProfileJson: profile
    });

    await this.neptune.replaceResources({
      accountId: account.id,
      resources: (pages.data ?? []).map((p: any) => ({
        resourceType: "facebook_page",
        resourceId: p.id,
        name: p.name,
        meta: p
      }))
    });
  }

  private async fbGet(path: string, token: string) {
    const res = await fetch(
      `https://graph.facebook.com/v18.0${path}&access_token=${token}`
    );
    return res.json();
  }
}
