const EARLY_REFRESH_MS = 60_000; // 60 seconds

export function isExpired(expiryDate?: number) {
  if (!expiryDate) return true;
  return Date.now() + EARLY_REFRESH_MS >= expiryDate;
}
