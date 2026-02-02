import { getValidGoogleToken } from "./refreshGoogleToken.js";
const token = await getValidGoogleToken(
  this.pluto,
  userId,
  providerAccountId
);

const profile = await this.safeGoogleCall(
  () => this.fetchUserInfo(token.access_token),
  userId,
  providerAccountId
);
