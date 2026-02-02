import type { FastifyInstance } from "fastify";
import { OAuthStateStore } from "../core/OAuthStateStore.js";
import { ConnectorRegistry } from "../core/ConnectorRegistry.js";

export function mountConnectRoutes(
  app: FastifyInstance,
  registry: ConnectorRegistry,
  db: any
) {
  const stateStore = new OAuthStateStore(db);

  app.get("/connect/:provider/url", async (req, res) => {
    const { provider } = req.params as any;
    const { userId, redirectUri } = req.query as any;

    const state = await stateStore.issue(userId, provider, redirectUri);
    const connector = registry.get(provider);
    const url = await connector.getAuthUrl({ userId, redirectUri, state });

    return { url };
  });

  app.post("/connect/:provider/exchange", async (req) => {
    const { provider } = req.params as any;
    const { userId, code, redirectUri, state } = req.body as any;

    await stateStore.consume(state, userId, provider, redirectUri);

    const connector = registry.get(provider);
    return connector.exchangeCode({ userId, code, redirectUri });
  });

  app.post("/connect/:provider/discover", async (req) => {
    const { provider } = req.params as any;
    const { userId, providerAccountId } = req.body as any;

    const connector = registry.get(provider);
    await connector.discoverInventory({ userId, providerAccountId });

    return { ok: true };
  });
}
