import { rediscoveryQueue } from "./queues.js";

export async function enqueueRediscovery(params: {
  userId: string;
  provider: string;
  providerAccountId: string;
  reason?: string;
}) {
  await rediscoveryQueue.add(
    "rediscover",
    {
      userId: params.userId,
      provider: params.provider,
      providerAccountId: params.providerAccountId,
      reason: params.reason ?? "manual"
    }
  );
}
