export class AccountStore {
  constructor(private db: any) {}

  async upsertAccount(params: {
    userId: string;
    provider: string;
    providerAccountId: string;
    displayName?: string;
    primaryEmail?: string;
    rawProfileJson?: any;
  }) {
    const row = await this.db.inventory_accounts.upsert({
      user_id: params.userId,
      provider: params.provider,
      provider_account_id: params.providerAccountId,
      display_name: params.displayName ?? null,
      primary_email: params.primaryEmail ?? null,
      raw_profile_json: params.rawProfileJson ?? {},
      updated_at: new Date().toISOString()
    });

    // normalize return (depends on DB adapter)
    return row ?? await this.db.inventory_accounts.findOne({
      user_id: params.userId,
      provider: params.provider,
      provider_account_id: params.providerAccountId
    });
  }
}
"scripts": {
  "worker": "tsx src/jobs/rediscovery.worker.ts"
}
