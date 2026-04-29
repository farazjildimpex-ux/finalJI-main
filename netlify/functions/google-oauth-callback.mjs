import { getOAuthCreds, buildRedirectUri, html, renderSuccessPage, renderErrorPage } from './_lib.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) return html(renderErrorPage('Google sign-in cancelled', String(error)), { status: 400 });
  if (!code) return html(renderErrorPage('Missing code parameter', 'No authorization code returned by Google.'), { status: 400 });

  const { clientId, clientSecret } = getOAuthCreds();
  if (!clientId || !clientSecret) {
    return html(renderErrorPage(
      'OAuth credentials missing',
      'GOOGLE_CLIENT_ID and/or GOOGLE_CLIENT_SECRET are not set in Netlify environment variables.'
    ), { status: 400 });
  }

  const redirectUri = buildRedirectUri(req);
  try {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const text = await resp.text();
    if (!resp.ok) {
      return html(renderErrorPage(`Token exchange failed (${resp.status})`, text), { status: 500 });
    }
    const data = JSON.parse(text);
    if (!data.refresh_token) {
      return html(renderErrorPage(
        'No refresh token returned',
        'Google only issues a refresh token on the FIRST consent. Revoke this app at https://myaccount.google.com/permissions, then try again.'
      ), { status: 500 });
    }
    return html(renderSuccessPage(data.refresh_token));
  } catch (err) {
    return html(renderErrorPage('Unexpected error', err.message), { status: 500 });
  }
};
