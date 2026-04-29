import { getOAuthCreds, buildRedirectUri, GMAIL_SCOPE, redirect, html, renderErrorPage } from './_lib.mjs';

export default async (req) => {
  const { clientId } = getOAuthCreds();
  if (!clientId) {
    return html(
      renderErrorPage(
        'Missing GOOGLE_CLIENT_ID',
        'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Netlify Site settings → Environment variables, then trigger a new deploy.'
      ),
      { status: 400 }
    );
  }
  const redirectUri = buildRedirectUri(req);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GMAIL_SCOPE);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  return redirect(url.toString());
};
