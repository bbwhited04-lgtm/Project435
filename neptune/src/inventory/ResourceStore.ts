export class ResourceStore {
  constructor(private db: any) {}

  async replaceResources(
    accountId: string,
    resources: Array<{
      resourceType: string;
      resourceId: string;
      name?: string;
      meta?: any;
    }>
  ) {
    // Idempotent replace
    await this.db.inventory_resources.deleteMany({
      account_id: accountId
    });

    for (const r of resources) {
      await this.db.inventory_resources.insert({
        account_id: accountId,
        resource_type: r.resourceType,
        resource_id: r.resourceId,
        name: r.name ?? null,
        meta_json: r.meta ?? {},
        updated_at: new Date().toISOString()
      });
    }
  }
}
