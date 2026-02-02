import { env } from "../../config/env.js";
import { isExpired } from "./tokenRefresh.js";

export async function getValidGoogleToken(
  pluto: any,
  userId: string,
  providerAccountId: string
) {
  const token = await pluto.getToken(userId, "google", providerAccountId);

  if (!isExpired(token.expiry_date)) {
    return token;
  }

  if (!token.refresh_token) {
    throw new Error("Missing refresh_token — re-auth required");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token"
    })
  });

  if (!res.ok) {
    throw new Error(`Google refresh failed: ${await res.text()}`);
  }

  const refreshed = await res.json();

  const updatedToken = {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token ?? token.refresh_token, // rotation-safe
    expiry_date: Date.now() + refreshed.expires_in * 1000,
    scope: refreshed.scope ?? token.scope,
    token_type: refreshed.token_type ?? token.token_type,
    id_token: refreshed.id_token ?? token.id_token
  };

  await pluto.upsertToken(
    userId,
    "google",
    providerAccountId,
    updatedToken
  );

  return updatedToken;
}
