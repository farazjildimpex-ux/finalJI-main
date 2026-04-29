import { getOAuthCreds, json } from './_lib.mjs';

export default async () => {
  const { clientId, clientSecret, refreshToken } = getOAuthCreds();
  if (!clientId || !clientSecret || !refreshToken) {
    return json({
      connected: false,
      reason: 'missing_secrets',
      missing: {
        GOOGLE_CLIENT_ID: !clientId,
        GOOGLE_CLIENT_SECRET: !clientSecret,
        GOOGLE_REFRESH_TOKEN: !refreshToken,
      },
    });
  }
  return json({ connected: true });
};
