export type ProviderId = "google" | "facebook" | "tiktok" | "youtube" | "microsoft" | "icloud";

export type AuthUrlRequest = {
  userId: string;
  redirectUri: string;
  state: string;              // CSRF protection
};

export type ExchangeCodeRequest = {
  userId: string;
  code: string;
  redirectUri: string;
};

export type DiscoveryRequest = {
  userId: string;
  providerAccountId: string;
};

export interface Connector {
  id: ProviderId;

  getAuthUrl(req: AuthUrlRequest): Promise<string>;
  exchangeCode(req: ExchangeCodeRequest): Promise<{ providerAccountId: string }>;
  testConnection(userId: string, providerAccountId: string): Promise<boolean>;
  discoverInventory(req: DiscoveryRequest): Promise<void>;
}
