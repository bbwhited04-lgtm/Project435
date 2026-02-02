import { getValidGoogleToken } from "./refreshGoogleToken.js";

export async function safeGoogleCall<T>(
  fn: () => Promise<T>,
  userId: string,
  providerAccountId: string,
  pluto: any
): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (String(err).includes("401")) {
      const refreshed = await getValidGoogleToken(
        pluto,
        userId,
        providerAccountId
      );
      return fn();
    }
    throw err;
  }
}
