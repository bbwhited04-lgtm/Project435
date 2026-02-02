export class MicrosoftConnector implements Connector {
  id = "microsoft" as const;

  constructor(private pluto: any, private neptune: any) {}

  async getAuthUrl({ redirectUri, state }: any) {
    const params = new URLSearchParams({
      client_id: env.MS_CLIENT_ID,
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope: MICROSOFT_SCOPES.join(" "),
      state
    });

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
  }

  async exchangeCode({ userId, code, redirectUri }: any) {
    const res = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.MS_CLIENT_ID,
          client_secret: env.MS_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code"
        })
      }
    );

    const token = await res.json();
    const profile = await this.msGet("/me", token.access_token);

    await this.pluto.upsertToken(userId, "microsoft", profile.id, {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expiry_date: Date.now() + token.expires_in * 1000
    });

    await this.discoverInventory({ userId, providerAccountId: profile.id });
    return { providerAccountId: profile.id };
  }

  async discoverInventory({ userId, providerAccountId }: any) {
    const token = await this.pluto.getToken(userId, "microsoft", providerAccountId);

    const profile = await this.msGet("/me", token.access_token);
    const calendars = await this.msGet("/me/calendars", token.access_token);

    const account = await this.neptune.upsertAccount({
      userId,
      provider: "microsoft",
      providerAccountId,
      displayName: profile.displayName,
      primaryEmail: profile.mail,
      rawProfileJson: profile
    });

    await this.neptune.replaceResources({
      accountId: account.id,
      resources: (calendars.value ?? []).map((c: any) => ({
        resourceType: "outlook_calendar",
        resourceId: c.id,
        name: c.name,
        meta: c
      }))
    });
  }

  private async msGet(path: string, token: string) {
    const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
  }
}
