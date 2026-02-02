import { OAuthStateStore } from "../core/OAuthStateStore";
import { ConnectorRegistry } from "../core/ConnectorRegistry";

export function mountConnectRoutes(app: any, registry: ConnectorRegistry, db: any) {
  const stateStore = new OAuthStateStore(db);

  // Step 1: get auth url (server issues state)
  app.get("/connect/:provider/url", async (req: any, res: any) => {
    const provider = req.params.provider;
    const userId = String(req.query.userId);
    const redirectUri = String(req.query.redirectUri);

    const state = await stateStore.issue({ userId, provider, redirectUri, ttlMinutes: 10 });

    const connector = registry.get(provider);
    const url = await connector.getAuthUrl({ userId, redirectUri, state });

    res.json({ url, stateIssued: true });
  });

  // Step 2: exchange (server verifies state before exchanging code)
  app.post("/connect/:provider/exchange", async (req: any, res: any) => {
    const provider = req.params.provider;
    const { userId, code, redirectUri, state } = req.body;

    await stateStore.consume({
      state: String(state),
      userId: String(userId),
      provider: String(provider),
      redirectUri: String(redirectUri),
    });

    const connector = registry.get(provider);
    const out = await connector.exchangeCode({
      userId: String(userId),
      code: String(code),
      redirectUri: String(redirectUri),
    });

    res.json(out);
  });
}
