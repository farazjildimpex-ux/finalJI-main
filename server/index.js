import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { initReplitSecretWatcher } from './replitSecrets.js';
import {
  GMAIL_SCOPE,
  getOAuthCreds,
  buildRedirectUri,
  getAccessToken,
  gmailFetch,
  clearAccessTokenCache,
  fetchGmailEmailsViaAPI,
  sendGmailEmail,
  renderSuccessPage,
  renderErrorPage,
} from './gmailLib.js';
import {
  zohoConfigured,
  getZohoCreds,
  getZohoAccessToken,
  buildZohoAuthUrl,
  exchangeZohoCode,
  sendZohoEmail,
} from './zohoLib.js';
import { retrievePdf } from './pdfLinks.js';

initReplitSecretWatcher();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
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

// ─── Gmail Cloud Pub/Sub push webhook ─────────────────────────────────────
// Google Cloud Pub/Sub sends POST requests here when a new Gmail message arrives.
// Setup guide (do once in Google Cloud Console):
//   1. Create/use a GCP project with Gmail API + Cloud Pub/Sub API enabled.
//   2. Create a Pub/Sub topic: e.g. "projects/<PROJECT_ID>/topics/gmail-push"
//   3. Add gmail-api-push@system.gserviceaccount.com as Pub/Sub Publisher on that topic.
//   4. Create a push subscription → endpoint URL: https://<your-replit-domain>/api/gmail/push
//   5. Call Gmail watch() once (use /api/gmail/watch endpoint below).
app.post('/api/gmail/push', async (req, res) => {
  // Acknowledge immediately so Pub/Sub doesn't retry.
  res.sendStatus(204);

  try {
    const message = req.body?.message;
    if (!message?.data) return;

    const decoded = JSON.parse(Buffer.from(message.data, 'base64').toString('utf-8'));
    const { emailAddress, historyId } = decoded;
    console.log(`[gmail-push] New mail for ${emailAddress}, historyId=${historyId}`);

    // Fetch emails that arrived since this history point.
    const token = await getAccessToken();
    const lastHistoryId = global.__lastGmailHistoryId || historyId;

    const historyResp = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${lastHistoryId}&historyTypes=messageAdded`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const historyData = await historyResp.json();
    global.__lastGmailHistoryId = historyId;

    const addedMessages = (historyData.history || [])
      .flatMap((h) => h.messagesAdded || [])
      .map((m) => m.message?.id)
      .filter(Boolean);

    if (addedMessages.length === 0) return;
    console.log(`[gmail-push] ${addedMessages.length} new message(s) to process.`);

    // Emit a server-side event that the frontend can pick up via polling or SSE.
    // For now we just log. The frontend periodic-refresh hook will pick up new mail
    // next time the user opens the app. A full SSE pipe is optional future work.
    global.__pendingGmailMessageIds = [
      ...(global.__pendingGmailMessageIds || []),
      ...addedMessages,
    ];
  } catch (err) {
    console.error('[gmail-push] Error processing push notification:', err.message);
  }
});

// Register Gmail watch() — call once after Cloud Pub/Sub is set up.
app.post('/api/gmail/watch', async (req, res) => {
  const { topicName } = req.body; // e.g. "projects/my-project/topics/gmail-push"
  if (!topicName) return res.status(400).json({ error: 'topicName required' });
  try {
    const token = await getAccessToken();
    const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicName, labelIds: ['INBOX'] }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(JSON.stringify(data));
    global.__lastGmailHistoryId = data.historyId;
    res.json({ ok: true, historyId: data.historyId, expiration: data.expiration });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Poll for pending push messages (frontend calls this after receiving a push signal).
app.get('/api/gmail/pending-messages', (req, res) => {
  const ids = global.__pendingGmailMessageIds || [];
  global.__pendingGmailMessageIds = [];
  res.json({ ids });
});

// ─── Gmail attachment browser (recent 3 days) ─────────────────────────────

app.get('/api/gmail/recent-attachments', async (req, res) => {
  try {
    const token = await getAccessToken();
    if (!token) return res.status(401).json({ error: 'Gmail not connected' });

    const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    const query = encodeURIComponent(`has:attachment after:${sevenDaysAgo}`);
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=50`;
    // gmailFetch already returns parsed JSON — do NOT call .json() again
    const listData = await gmailFetch(listUrl);
    const messages = listData.messages || [];

    const attachments = [];
    for (const msg of messages.slice(0, 20)) {
      try {
        const msgData = await gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Date,Subject,From`);
        const dateHeader = (msgData.payload?.headers || []).find(h => h.name === 'Date')?.value || '';
        const date = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();

        const fullData = await gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`);

        function findAttachments(parts) {
          if (!parts) return;
          for (const part of parts) {
            const filename = part.filename || '';
            const mimeType = part.mimeType || '';
            const attId = part.body?.attachmentId;
            // Show all real attachments — not just PDFs
            if (attId && filename) {
              attachments.push({ messageId: msg.id, attachmentId: attId, filename, mimeType: mimeType || 'application/octet-stream', date });
            }
            if (part.parts) findAttachments(part.parts);
          }
        }
        findAttachments(fullData.payload?.parts);
      } catch (_) {}
    }

    res.json({ attachments });
  } catch (err) {
    console.error('[gmail-attachments] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/gmail/attachment', async (req, res) => {
  const { messageId, attachmentId, filename } = req.query;
  if (!messageId || !attachmentId) return res.status(400).json({ error: 'messageId and attachmentId required' });
  try {
    const token = await getAccessToken();
    if (!token) return res.status(401).json({ error: 'Gmail not connected' });

    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`;
    const resp = await gmailFetch(url);
    if (!resp.ok) return res.status(resp.status).json({ error: 'Gmail API error' });
    const data = await resp.json();
    // Gmail uses URL-safe base64
    const base64 = (data.data || '').replace(/-/g, '+').replace(/_/g, '/');
    res.json({ base64, filename: filename || 'attachment.pdf' });
  } catch (err) {
    console.error('[gmail-attachment] error:', err.message);
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
    return res.status(400).type('html').send(renderErrorPage(
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
  if (error) return res.status(400).type('html').send(renderErrorPage('Google sign-in cancelled', String(error)));
  if (!code) return res.status(400).type('html').send(renderErrorPage('Missing code parameter', 'No authorization code returned.'));
  const { clientId, clientSecret } = getOAuthCreds();
  if (!clientId || !clientSecret) return res.status(400).type('html').send(renderErrorPage('OAuth credentials missing', 'GOOGLE_CLIENT_ID and/or GOOGLE_CLIENT_SECRET are not set.'));
  const redirectUri = buildRedirectUri(req);
  try {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: String(code), client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    const text = await resp.text();
    if (!resp.ok) return res.status(500).type('html').send(renderErrorPage(`Token exchange failed (${resp.status})`, text));
    const data = JSON.parse(text);
    if (!data.refresh_token) return res.status(500).type('html').send(renderErrorPage('No refresh token returned', 'Revoke this app at https://myaccount.google.com/permissions, then try again.'));
    res.type('html').send(renderSuccessPage(data.refresh_token));
  } catch (err) {
    res.status(500).type('html').send(renderErrorPage('Unexpected error', err.message));
  }
});

// ─── Zoho Mail OAuth ──────────────────────────────────────────────────────

app.get('/api/zoho/status', (req, res) => {
  const { clientId, clientSecret, refreshToken, fromEmail, fromName } = getZohoCreds();
  res.json({
    configured: !!(clientId && clientSecret && refreshToken),
    hasFromEmail: !!fromEmail,
    missing: {
      ZOHO_CLIENT_ID: !clientId,
      ZOHO_CLIENT_SECRET: !clientSecret,
      ZOHO_REFRESH_TOKEN: !refreshToken,
      ZOHO_FROM_EMAIL: !fromEmail,
      ZOHO_FROM_NAME: !fromName,
    },
    authBase: process.env.ZOHO_AUTH_BASE || 'https://accounts.zoho.com',
  });
});

/** Build the public base URL for OAuth callbacks.
 *  Priority: ZOHO_REDIRECT_BASE env var → REPLIT_DEV_DOMAIN → request headers */
function getPublicBase(req) {
  if (process.env.ZOHO_REDIRECT_BASE) return process.env.ZOHO_REDIRECT_BASE.replace(/\/$/, '');
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host  = req.get('x-forwarded-host') || req.get('host');
  return `${proto}://${host}`;
}

app.get('/api/zoho/oauth/redirect-uri', (req, res) => {
  const uri = `${getPublicBase(req)}/api/zoho/oauth/callback`;
  res.json({ redirectUri: uri });
});

app.get('/api/zoho/oauth/start', (req, res) => {
  try {
    const redirectUri = `${getPublicBase(req)}/api/zoho/oauth/callback`;
    const url = buildZohoAuthUrl(redirectUri);
    res.redirect(url);
  } catch (err) {
    res.status(400).type('html').send(renderErrorPage('Zoho OAuth error', err.message));
  }
});

app.get('/api/zoho/oauth/callback', async (req, res) => {
  const code = req.query.code;
  const error = req.query.error;
  if (error) return res.status(400).type('html').send(renderErrorPage('Zoho sign-in cancelled', String(error)));
  if (!code) return res.status(400).type('html').send(renderErrorPage('Missing code', 'No authorization code returned by Zoho.'));
  try {
    const redirectUri = `${getPublicBase(req)}/api/zoho/oauth/callback`;
    const data = await exchangeZohoCode(String(code), redirectUri);
    res.type('html').send(renderSuccessPage(data.refresh_token || '(no refresh token — check Zoho app settings)', {
      title:      'Zoho Mail connected!',
      secretName: 'ZOHO_REFRESH_TOKEN',
      step3:      'Return to the app Settings page, restart the workflow, then refresh — you should see the green <strong>Connected</strong> badge.',
      footer:     'This token gives the app permission to send emails on your behalf via Zoho Mail. Revoke any time in your Zoho API Console.',
    }));
  } catch (err) {
    const redirectUri = `${getPublicBase(req)}/api/zoho/oauth/callback`;
    const authBase = process.env.ZOHO_AUTH_BASE || 'https://accounts.zoho.com (default — no ZOHO_AUTH_BASE secret set)';
    const detail = [
      err.message,
      '',
      `Zoho auth server used:  ${authBase}`,
      `Redirect URI sent:      ${redirectUri}`,
      '',
      'Checklist:',
      '1. Is the auth server above the correct region for your Zoho account?',
      '   (If your account is on .in/.eu/.com.au, set ZOHO_AUTH_BASE in Replit Secrets and restart)',
      '2. Is the redirect URI above saved under "Authorized Redirect URIs" in your Zoho API Console app?',
      '3. Did you create the API Console app on the same regional console as your Zoho account?',
      '   (e.g. India accounts must use api-console.zoho.in, not api-console.zoho.com)',
    ].join('\n');
    res.status(500).type('html').send(renderErrorPage('Zoho token exchange failed', detail));
  }
});

// ─── PDF download endpoint ─────────────────────────────────────────────────
app.get('/api/pdf-download/:token', (req, res) => {
  const result = retrievePdf(req.params.token);
  if (!result) {
    return res.status(404).send('PDF not found or link has expired.');
  }
  res.set({
    'Content-Type':        'application/pdf',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(result.filename)}"`,
    'Content-Length':      result.buffer.length,
    'Cache-Control':       'private, no-cache',
  });
  res.send(result.buffer);
});

// ─── Gmail send status ────────────────────────────────────────────────────
app.get('/api/gmail/send-status', async (req, res) => {
  const { clientId, clientSecret, refreshToken } = getOAuthCreds();
  if (!clientId || !clientSecret || !refreshToken) {
    return res.json({ configured: false, hasSendScope: false, email: null });
  }
  try {
    const token = await getAccessToken();
    // tokeninfo reveals which scopes this access token has
    const info = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
    const data = await info.json();
    const scopes = (data.scope || '').split(' ');
    const hasSendScope = scopes.includes('https://www.googleapis.com/auth/gmail.send');
    res.json({ configured: true, hasSendScope, email: data.email || null });
  } catch (err) {
    res.json({ configured: false, hasSendScope: false, email: null, error: err.message });
  }
});

// ─── Email send (via Gmail API — real PDF attachments) ────────────────────
/**
 * POST /api/email/send
 * Body: {
 *   to: string[],
 *   cc?: string[],
 *   subject: string,
 *   body: string,               // HTML
 *   attachmentBase64?: string,  // base64-encoded PDF (real attachment)
 *   attachmentName?: string,    // e.g. "Contract_2026.pdf"
 * }
 */
app.post('/api/email/send', async (req, res) => {
  const { to, cc, subject, body, attachmentBase64, attachmentName } = req.body || {};

  if (!to?.length) return res.status(400).json({ error: 'to is required' });
  if (!subject)    return res.status(400).json({ error: 'subject is required' });
  if (!body)       return res.status(400).json({ error: 'body is required' });

  const { clientId, clientSecret, refreshToken } = getOAuthCreds();
  if (!clientId || !clientSecret || !refreshToken) {
    return res.status(503).json({
      error: 'Gmail is not connected. Complete the Google OAuth setup in Settings → Email.',
    });
  }

  if (attachmentBase64 && attachmentName) {
    console.log(`[email/send] Sending via Gmail with attachment: ${attachmentName}`);
  } else {
    console.log(`[email/send] Sending via Gmail (no attachment)`);
  }

  const result = await sendGmailEmail({
    to,
    cc: cc?.length ? cc : undefined,
    subject,
    body,
    attachmentBase64: attachmentBase64 || undefined,
    attachmentName:   attachmentName   || undefined,
  });

  if (!result.ok) return res.status(500).json({ error: result.error });
  res.json({ ok: true, messageId: result.messageId });
});

// ─── SPA static + fallback (production only) ──────────────────────────────
if (isProd) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const distDir = path.resolve(__dirname, '..', 'dist');
  const indexHtmlPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    app.use(express.static(distDir, {
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(indexHtmlPath);
    });
  } else {
    console.warn(`[server] dist/ not found at ${distDir}. Run "npm run build" before starting in production.`);
  }
}

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
