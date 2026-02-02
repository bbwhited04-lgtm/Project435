export const env = {
  PORT: Number(process.env.PORT ?? 3333),

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,

  OAUTH_STATE_TTL_MINUTES: Number(process.env.OAUTH_STATE_TTL_MINUTES ?? 10)
};
