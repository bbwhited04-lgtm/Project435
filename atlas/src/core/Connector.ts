export type ProviderId = "google";

export interface Connector {
  id: ProviderId;

  getAuthUrl(params: {
    userId: string;
    redirectUri: string;
    state: string;
  }): Promise<string>;

  exchangeCode(params: {
    userId: string;
    code: string;
    redirectUri: string;
  }): Promise<{ providerAccountId: string }>;

  discoverInventory(params: {
    userId: string;
    providerAccountId: string;
  }): Promise<void>;
}
