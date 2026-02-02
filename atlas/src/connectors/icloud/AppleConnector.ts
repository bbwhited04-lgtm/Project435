export class AppleConnector implements Connector {
  id = "icloud" as const;

  async getAuthUrl({ redirectUri, state }: any) {
    const params = new URLSearchParams({
      client_id: env.APPLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "name email",
      state
    });

    return `https://appleid.apple.com/auth/authorize?${params}`;
  }

  async exchangeCode({ userId }: any) {
    throw new Error("Apple token exchange handled via JWT (next step)");
  }

  async discoverInventory({ userId, providerAccountId }: any) {
    await this.neptune.upsertAccount({
      userId,
      provider: "icloud",
      providerAccountId,
      displayName: "Apple ID",
      rawProfileJson: {}
    });
  }
}
