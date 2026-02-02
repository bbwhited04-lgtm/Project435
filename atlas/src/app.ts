import type { FastifyInstance } from "fastify";
import { ConnectorRegistry } from "./core/ConnectorRegistry.js";
import { GoogleConnector } from "./connectors/google/GoogleConnector.js";
import { mountConnectRoutes } from "./routes/connect.routes.js";
import { plutoClient } from "./services/pluto.client.js";
import { neptuneClient } from "./services/neptune.client.js";
import { db } from "./db/index.js";

export async function buildApp(app: FastifyInstance) {
  const registry = new ConnectorRegistry();

  // Register connectors here
  registry.register(
    new GoogleConnector(plutoClient, neptuneClient)
  );

  mountConnectRoutes(app, registry, db);

  app.get("/health", async () => ({ ok: true }));
}
