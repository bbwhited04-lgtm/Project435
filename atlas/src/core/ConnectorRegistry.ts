import type { Connector, ProviderId } from "./Connector.js";

export class ConnectorRegistry {
  private map = new Map<ProviderId, Connector>();

  register(connector: Connector) {
    this.map.set(connector.id, connector);
  }

  get(provider: ProviderId): Connector {
    const c = this.map.get(provider);
    if (!c) throw new Error(`Connector not registered: ${provider}`);
    return c;
  }
}
