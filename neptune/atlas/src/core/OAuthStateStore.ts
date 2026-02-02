import crypto from "crypto";

export type OAuthStateRecord = {
  state: string;
  userId: string;
  provider: string;
  redirectUri: string;
  expiresAt: Date;
  consumedAt?: Date | null;
};

export class OAuthStateStore {
  constructor(private db: any) {}

  generateState(): string {
    // 32 bytes -> 64 hex chars; safe as URL param
    return crypto.randomBytes(32).toString("hex");
  }

  async issue(params: { userId: string; provider: string; redirectUri: string; ttlMinutes?: number }) {
    const ttl = params.ttlMinutes ?? 10;
    const state = this.generateState();
    const expiresAt = new Date(Date.now() + ttl * 60 * 1000);

    await this.db.oauth_states.insert({
      state,
      user_id: params.userId,
      provider: params.provider,
      redirect_uri: params.redirectUri,
      expires_at: expiresAt.toISOString(),
    });

    return state;
  }

  /**
   * Validate + consume in one call to prevent replay.
   */
  async consume(params: { state: string; userId: string; provider: string; redirectUri: string }) {
    const row = await this.db.oauth_states.findOne({ state: params.state });

    if (!row) throw new Error("Invalid OAuth state");
    if (row.consumed_at) throw new Error("OAuth state already used");
    if (row.user_id !== params.userId) throw new Error("OAuth state user mismatch");
    if (row.provider !== params.provider) throw new Error("OAuth state provider mismatch");
    if (row.redirect_uri !== params.redirectUri) throw new Error("OAuth state redirect mismatch");

    const expiresAt = new Date(row.expires_at);
    if (Date.now() > expiresAt.getTime()) throw new Error("OAuth state expired");

    // Consume (one-time use)
    await this.db.oauth_states.update(
      { state: params.state },
      { consumed_at: new Date().toISOString() }
    );

    return true;
  }

  async cleanupExpired() {
    // optional: run on startup or a cron
    await this.db.oauth_states.deleteWhere("expires_at < now() OR (consumed_at is not null AND consumed_at < now() - interval '1 day')");
  }
}
