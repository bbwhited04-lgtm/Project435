import { Worker } from "bullmq";
import { redis } from "./redis.js";
import { ConnectorRegistry } from "../core/ConnectorRegistry.js";
import { GoogleConnector } from "../connectors/google/GoogleConnector.js";
import { plutoClient } from "../services/pluto.client.js";
import { neptuneClient } from "../services/neptune.client.js";

const registry = new ConnectorRegistry();
registry.register(new GoogleConnector(plutoClient, neptuneClient));

new Worker(
  "rediscovery",
  async job => {
    const { userId, provider, providerAccountId } = job.data;

    const connector = registry.get(provider);
    await connector.discoverInventory({
      userId,
      providerAccountId
    });
  },
  {
    connection: redis,
    concurrency: 5
  }
);

console.log("Rediscovery worker running");
