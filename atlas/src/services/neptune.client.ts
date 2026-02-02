import { AccountStore } from "../../../neptune/src/inventory/AccountStore.js";
import { ResourceStore } from "../../../neptune/src/inventory/ResourceStore.js";
import { neptuneDb } from "../db/neptune.js";

const accountStore = new AccountStore(neptuneDb);
const resourceStore = new ResourceStore(neptuneDb);

export const neptuneClient = {
  async upsertAccount(data: {
    userId: string;
    provider: string;
    providerAccountId: string;
    displayName?: string;
    primaryEmail?: string;
    rawProfileJson?: any;
  }) {
    return accountStore.upsertAccount(data);
  },

  async replaceResources(data: {
    accountId: string;
    resources: Array<{
      resourceType: string;
      resourceId: string;
      name?: string;
      meta?: any;
    }>;
  }) {
    return resourceStore.replaceResources(
      data.accountId,
      data.resources
    );
  }
};
