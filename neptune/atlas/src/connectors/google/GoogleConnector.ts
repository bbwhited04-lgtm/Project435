import type { Connector, AuthUrlRequest, ExchangeCodeRequest, DiscoveryRequest } from "../../core/Connector";
import { GOOGLE_SCOPES } from "./google.scopes";

// You can use googleapis package or plain fetch.
// This skeleton uses plain fetch to avoid extra complexity.

type PlutoClient = {
  upsertToken: (userId: string, provider: string, providerAccountId: string, tokenSet: any) => Promise<void>;
  getToken: (userId: string, provider: string, providerAccountId: string) => Promise<any>;
};

type NeptuneClient = {
  upsertAccount: (params: any) => Promise<{ id: string }>;
  replaceResources: (params: any) => Promise<void>;
};

export class GoogleConnector implements Connector {
  id = "google" as const;

  constructor(
    private pluto: PlutoClient,
    private neptune: NeptuneClient
  ) {}

  async getAuthUrl(req: AuthUrlRequest): Promise<string> {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const scope = encodeURIComponent(GOOGLE_SCOPES.join(" "));
    const redirect = encodeURIComponent(req.redirectUri);

    // offline + prompt consent ensures refresh_token on first consent
    const url =
      "https://accounts.google.com/o/oauth2/v2/auth" +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${redirect}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${encodeURIComponent(req.state)}`;

    return url;
  }

  async exchangeCode(req: ExchangeCodeRequest): Promise<{ providerAccountId: string }> {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: req.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: req.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Google token exchange failed: ${err}`);
    }

    const tokenJson: any = await tokenRes.json();

    // Get identity (sub/email) so we can key providerAccountId
    const accessToken = tokenJson.access_token;
    const profile = await this.fetchUserInfo(accessToken);

    const providerAccountId = profile.sub || profile.email;
    if (!providerAccountId) throw new Error("Google userinfo missing sub/email");

    // Store in Pluto
    await this.pluto.upsertToken(req.userId, "google", providerAccountId, {
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token,
      scope: tokenJson.scope,
      token_type: tokenJson.token_type,
      expiry_date: Date.now() + (tokenJson.expires_in * 1000),
      id_token: tokenJson.id_token,
    });

    // Initial inventory discovery
    await this.discoverInventory({ userId: req.userId, providerAccountId });

    return { providerAccountId };
  }

  async testConnection(userId: string, providerAccountId: string): Promise<boolean> {
    try {
      const token = await this.pluto.getToken(userId, "google", providerAccountId);
      const profile = await this.fetchUserInfo(token.access_token);
      return !!profile?.email;
    } catch {
      return false;
    }
  }

  async discoverInventory(req: DiscoveryRequest): Promise<void> {
    // Pull token (refresh logic can be added next)
    const token = await this.pluto.getToken(req.userId, "google", req.providerAccountId);

    const userInfo = await this.fetchUserInfo(token.access_token);

    const account = await this.neptune.upsertAccount({
      userId: req.userId,
      provider: "google",
      providerAccountId: req.providerAccountId,
      displayName: userInfo.name,
      primaryEmail: userInfo.email,
      rawProfileJson: userInfo,
    });

    // Drive discovery (drives.list + about)
    const drives = await this.fetchDrives(token.access_token);

    // Calendar discovery
    const calendars = await this.fetchCalendars(token.access_token);

    // Gmail discovery (labels as quick proof)
    const labels = await this.fetchGmailLabels(token.access_token);

    const resources = [
      ...drives.map((d: any) => ({
        resourceType: "drive",
        resourceId: d.id,
        name: d.name,
        meta: d,
      })),
      ...calendars.map((c: any) => ({
        resourceType: "calendar",
        resourceId: c.id,
        name: c.summary,
        meta: c,
      })),
      ...labels.map((l: any) => ({
        resourceType: "gmail_label",
        resourceId: l.id,
        name: l.name,
        meta: l,
      })),
    ];

    await this.neptune.replaceResources({ accountId: account.id, resources });
  }

  private async fetchUserInfo(accessToken: string) {
    const r = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) throw new Error(`userinfo failed: ${await r.text()}`);
    return r.json();
  }

  private async fetchDrives(accessToken: string) {
    const r = await fetch("https://www.googleapis.com/drive/v3/drives?pageSize=100", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) return [];
    const j: any = await r.json();
    return j.drives ?? [];
  }

  private async fetchCalendars(accessToken: string) {
    const r = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) return [];
    const j: any = await r.json();
    return j.items ?? [];
  }

  private async fetchGmailLabels(accessToken: string) {
    const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) return [];
    const j: any = await r.json();
    return j.labels ?? [];
  }
}
