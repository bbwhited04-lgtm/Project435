import crypto from "crypto";

export class OAuthStateStore {
  constructor(private db: any) {}

  issue(userId: string, provider: string, redirectUri: string, ttlMinutes = 10) {
    const state = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

    return this.db.oauth_states.insert({
      state,
      user_id: userId,
      provider,
      redirect_uri: redirectUri,
      expires_at: expiresAt.toISOString()
    }).then(() => state);
  }

  async consume(state: string, userId: string, provider: string, redirectUri: string) {
    const row = await this.db.oauth_states.findOne({ state });
    if (!row) throw new Error("Invalid state");
    if (row.consumed_at) throw new Error("State already used");
    if (row.user_id !== userId) throw new Error("State user mismatch");
    if (row.provider !== provider) throw new Error("State provider mismatch");
    if (row.redirect_uri !== redirectUri) throw new Error("State redirect mismatch");
    if (Date.now() > new Date(row.expires_at).getTime()) throw new Error("State expired");

    await this.db.oauth_states.update(
      { state },
      { consumed_at: new Date().toISOString() }
    );
  }
}
