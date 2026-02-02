export class InventoryStore {
  constructor(private db: any) {}

  async upsertAccount(params: {
    userId: string;
    provider: string;
    providerAccountId: string;
    displayName?: string;
    primaryEmail?: string;
    rawProfileJson?: any;
  }) {
    return this.db.inventory_accounts.upsert({
      user_id: params.userId,
      provider: params.provider,
      provider_account_id: params.providerAccountId,
      display_name: params.displayName ?? null,
      primary_email: params.primaryEmail ?? null,
      raw_profile_json: JSON.stringify(params.rawProfileJson ?? {}),
    });
  }

  async replaceResources(params: {
    accountId: string;
    resources: Array<{
      resourceType: string;
      resourceId: string;
      name?: string;
      meta?: any;
    }>;
  }) {
    // simplest: delete then insert (works fine early-stage)
    await this.db.inventory_resources.deleteMany({ account_id: params.accountId });
    for (const r of params.resources) {
      await this.db.inventory_resources.insert({
        account_id: params.accountId,
        resource_type: r.resourceType,
        resource_id: r.resourceId,
        name: r.name ?? null,
        meta_json: JSON.stringify(r.meta ?? {}),
      });
    }
  }
}
