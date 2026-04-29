import express from 'express';
import cors from 'cors';
import { initReplitSecretWatcher } from './replitSecrets.js';
import {
  GMAIL_SCOPE,
  getOAuthCreds,
  buildRedirectUri,
  getAccessToken,
  gmailFetch,
  clearAccessTokenCache,
  fetchGmailEmailsViaAPI,
  renderSuccessPage,
  renderErrorPage,
} from './gmailLib.js';

initReplitSecretWatcher();

const app = express();
app.use(cors());
app.use(express.json());
// Trust the Replit / proxy front so req.protocol & x-forwarded-* work.
app.set('trust proxy', true);

const isProd = process.env.NODE_ENV === 'production';
const PORT = isProd ? (process.env.PORT || 3000) : 3001;

// ─── Gmail status / sync ──────────────────────────────────────────────────
app.get('/api/gmail/test', (req, res) => {
  const { clientId, clientSecret, refreshToken } = getOAuthCreds();
  if (!clientId || !clientSecret || !refreshToken) {
    return res.json({
      connected: false,
      reason: 'missing_secrets',
      missing: {
        GOOGLE_CLIENT_ID: !clientId,
        GOOGLE_CLIENT_SECRET: !clientSecret,
        GOOGLE_REFRESH_TOKEN: !refreshToken,
      },
    });
  }
  res.json({ connected: true });
});

app.get('/api/gmail/test-imap', async (req, res) => {
  try {
    clearAccessTokenCache();
    const token = await getAccessToken();
    const profileResp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!profileResp.ok) {
      const t = await profileResp.text();
      return res.json({ ok: false, error: `Gmail API error (${profileResp.status}): ${t}` });
    }
    const profile = await profileResp.json();

    const query = encodeURIComponent('has:attachment newer_than:7d');
    const list = await gmailFetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=100`
    );
    const count = (list.messages || []).length;

    res.json({ ok: true, email: profile.emailAddress, messagesLast7Days: count });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.get('/api/gmail/emails', async (req, res) => {
  try {
    const result = await fetchGmailEmailsViaAPI();
    res.json({ ...result, total: result.emails.length });
  } catch (err) {
    console.error('Gmail email fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/gmail/debug-emails', async (req, res) => {
  try {
    const { emails } = await fetchGmailEmailsViaAPI();
    res.json({
      total: emails.length,
      emails: emails.map((e) => ({
        subject: e.subject,
        from: e.from,
        date: e.date,
        bodyLength: e.body.length,
        attachments: e.attachments.map((a) => ({ name: a.name, type: a.type, chars: a.text.length })),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Google OAuth ─────────────────────────────────────────────────────────
app.get('/api/google/oauth/redirect-uri', (req, res) => {
  res.json({ redirectUri: buildRedirectUri(req) });
});

app.get('/api/google/oauth/start', (req, res) => {
  const { clientId } = getOAuthCreds();
  if (!clientId) {
    return res
      .status(400)
      .type('html')
      .send(renderErrorPage(
        'Missing GOOGLE_CLIENT_ID',
        'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Replit Secrets, then click "Start" again.'
      ));
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
  res.redirect(url.toString());
});

app.get('/api/google/oauth/callback', async (req, res) => {
  const code = req.query.code;
  const error = req.query.error;

  if (error) {
    return res.status(400).type('html').send(
      renderErrorPage('Google sign-in cancelled', String(error))
    );
  }
  if (!code) {
    return res.status(400).type('html').send(
      renderErrorPage('Missing code parameter', 'No authorization code returned by Google.')
    );
  }

  const { clientId, clientSecret } = getOAuthCreds();
  if (!clientId || !clientSecret) {
    return res.status(400).type('html').send(
      renderErrorPage(
        'OAuth credentials missing',
        'GOOGLE_CLIENT_ID and/or GOOGLE_CLIENT_SECRET are not set in Replit Secrets.'
      )
    );
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
      return res.status(500).type('html').send(
        renderErrorPage(`Token exchange failed (${resp.status})`, text)
      );
    }
    const data = JSON.parse(text);
    if (!data.refresh_token) {
      return res.status(500).type('html').send(
        renderErrorPage(
          'No refresh token returned',
          'Google only issues a refresh token on the FIRST consent. Revoke this app at https://myaccount.google.com/permissions, then try again.'
        )
      );
    }
    res.type('html').send(renderSuccessPage(data.refresh_token));
  } catch (err) {
    res.status(500).type('html').send(
      renderErrorPage('Unexpected error', err.message)
    );
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
