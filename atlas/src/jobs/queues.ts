import { Queue } from "bullmq";
import { redis } from "./redis.js";

export const rediscoveryQueue = new Queue("rediscovery", {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 60_000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
});
