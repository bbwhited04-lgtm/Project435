import { encryptJson, decryptJson } from "./crypto";

export type TokenSet = {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number; // ms epoch
  id_token?: string;
};

export class TokenVault {
  constructor(private db: any) {} // swap for your db adapter

  async upsertToken(userId: string, provider: string, providerAccountId: string, tokenSet: TokenSet) {
    const encrypted = encryptJson(tokenSet);
    const encryptedBlob = JSON.stringify(encrypted);

    // PSEUDO: implement with your DB
    await this.db.token_records.upsert({
      user_id: userId,
      provider,
      provider_account_id: providerAccountId,
      encrypted_blob: encryptedBlob,
      key_version: encrypted.v
    });
  }

  async getToken(userId: string, provider: string, providerAccountId: string): Promise<TokenSet> {
    const row = await this.db.token_records.findOne({
      user_id: userId,
      provider,
      provider_account_id: providerAccountId,
      status: "active"
    });
    if (!row) throw new Error("Token not found");
    return decryptJson(JSON.parse(row.encrypted_blob));
  }
}
