import type { Connector, ProviderId } from "./Connector";

export class ConnectorRegistry {
  private connectors = new Map<ProviderId, Connector>();

  register(connector: Connector) {
    this.connectors.set(connector.id, connector);
  }

  get(id: ProviderId): Connector {
    const c = this.connectors.get(id);
    if (!c) throw new Error(`Connector not registered: ${id}`);
    return c;
  }
}
