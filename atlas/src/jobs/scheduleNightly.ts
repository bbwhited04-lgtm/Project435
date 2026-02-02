import { enqueueRediscovery } from "./enqueueRediscovery.js";
import { neptuneDb } from "../db/neptune.js";

export async function nightlyRediscovery() {
  const accounts = await neptuneDb.inventory_accounts.findMany();

  for (const acc of accounts) {
    await enqueueRediscovery({
      userId: acc.user_id,
      provider: acc.provider,
      providerAccountId: acc.provider_account_id,
      reason: "nightly"
    });
  }
}
