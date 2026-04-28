import express from 'express';
import cors from 'cors';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

const isProd = process.env.NODE_ENV === 'production';
if (isProd) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
}

const PORT = isProd ? (process.env.PORT || 3000) : 3001;

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

function getOAuthCreds() {
  return {
    clientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
    clientSecret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
    refreshToken: (process.env.GOOGLE_REFRESH_TOKEN || '').trim(),
  };
}

function buildRedirectUri(req) {
  // Honour standard reverse-proxy headers (Replit terminates TLS upstream)
  const protoHeader = (req.headers['x-forwarded-proto'] || '').toString().split(',')[0].trim();
  const host = (req.headers['x-forwarded-host'] || req.get('host') || '').toString();
  const protocol = protoHeader || (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${protocol}://${host}/api/google/oauth/callback`;
}

function stripHtml(html) {
  return (html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Access-token cache (Google issues 1-hour tokens) ──────────────────────
let cachedAccessToken = null;
let cachedAccessTokenExpiry = 0;

async function getAccessToken() {
  const { clientId, clientSecret, refreshToken } = getOAuthCreds();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in Replit Secrets.'
    );
  }
  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiry) return cachedAccessToken;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    cachedAccessToken = null;
    throw new Error(`Google token refresh failed (${resp.status}): ${text}`);
  }
  const data = await resp.json();
  cachedAccessToken = data.access_token;
  cachedAccessTokenExpiry = Date.now() + ((data.expires_in || 3600) - 300) * 1000;
  return cachedAccessToken;
}

async function gmailFetch(url) {
  const token = await getAccessToken();
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gmail API error (${resp.status}): ${text}`);
  }
  return resp.json();
}

// ─── Walk a Gmail message payload tree to extract body + attachments ───────
function extractFromPayload(payload) {
  let bodyText = '';
  let bodyHtml = '';
  const attachments = [];

  function walk(part) {
    if (!part) return;
    const mime = (part.mimeType || '').toLowerCase();
    const filename = part.filename || '';

    if (part.body?.attachmentId && filename) {
      attachments.push({
        attachmentId: part.body.attachmentId,
        filename,
        mimeType: mime,
        size: part.body.size || 0,
      });
    } else if (part.body?.data) {
      const decoded = Buffer.from(part.body.data, 'base64url').toString('utf8');
      if (mime === 'text/plain') bodyText = bodyText || decoded;
      else if (mime === 'text/html') bodyHtml = bodyHtml || decoded;
    }
    if (part.parts) part.parts.forEach(walk);
  }

  walk(payload);
  const body = bodyText || stripHtml(bodyHtml);
  return { body, attachments };
}

function getHeader(headers, name) {
  const h = (headers || []).find((x) => (x.name || '').toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

async function fetchGmailEmailsViaAPI() {
  // Search for messages with attachments from last 7 days
  const query = encodeURIComponent('has:attachment newer_than:7d');
  const list = await gmailFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=30`
  );
  const messages = list.messages || [];
  console.log(`Gmail API: found ${messages.length} messages with attachments in last 7 days`);

  const emails = [];
  const pdfParse = require('pdf-parse');

  for (const m of messages) {
    try {
      const msg = await gmailFetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`
      );
      const headers = msg.payload?.headers || [];
      const { body, attachments } = extractFromPayload(msg.payload);

      const emailData = {
        subject: getHeader(headers, 'Subject'),
        from: getHeader(headers, 'From'),
        date: new Date(parseInt(msg.internalDate || '0', 10) || Date.now()).toISOString(),
        body: (body || '').slice(0, 8000),
        attachments: [],
      };

      for (const att of attachments) {
        const isPdf =
          att.mimeType === 'application/pdf' || att.filename.toLowerCase().endsWith('.pdf');
        const isText = att.mimeType.startsWith('text/');
        if (!isPdf && !isText) continue;

        try {
          const attResp = await gmailFetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}/attachments/${att.attachmentId}`
          );
          const buf = Buffer.from(attResp.data, 'base64url');

          if (isPdf && buf.length > 100) {
            const pdf = await pdfParse(buf);
            const text = (pdf.text || '').trim();
            console.log(`  ✓ PDF parsed: ${text.length} chars from "${att.filename}"`);
            if (text.length > 10) {
              emailData.attachments.push({
                name: att.filename,
                text: text.slice(0, 8000),
                type: 'pdf',
              });
            }
          } else if (isText) {
            emailData.attachments.push({
              name: att.filename,
              text: buf.toString('utf8').slice(0, 4000),
              type: 'text',
            });
          }
        } catch (attErr) {
          console.error(`  Attachment fetch error for "${att.filename}":`, attErr.message);
        }
      }

      if (emailData.body.length > 10 || emailData.attachments.length > 0) {
        emails.push(emailData);
      }
    } catch (msgErr) {
      console.error('Gmail API message error for', m.id, msgErr.message);
    }
  }

  return { emails };
}

// ─── Helpers for the OAuth callback HTML ───────────────────────────────────
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderSuccessPage(refreshToken) {
  const token = escapeHtml(refreshToken);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gmail connected!</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; max-width: 640px; margin: 32px auto; padding: 16px; background: #f9fafb; color: #1f2937; }
  .card { background: #fff; border-radius: 24px; padding: 28px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  .check { font-size: 44px; margin-bottom: 4px; }
  h1 { font-size: 22px; margin: 0 0 6px; color: #047857; }
  p.lead { color: #4b5563; margin: 0 0 18px; }
  .secret { background: #f3f4f6; padding: 14px; border-radius: 12px; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; word-break: break-all; margin: 10px 0 4px; border: 1px solid #e5e7eb; user-select: all; }
  button { background: #7c3aed; color: white; border: none; padding: 10px 18px; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 13px; }
  button:hover { background: #6d28d9; }
  button.copied { background: #059669; }
  .step { display: flex; gap: 12px; margin: 14px 0; align-items: flex-start; }
  .num { background: #7c3aed; color: white; border-radius: 999px; min-width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; flex-shrink: 0; }
  code { background: #ede9fe; color: #5b21b6; padding: 2px 6px; border-radius: 6px; font-size: 12px; font-family: ui-monospace, monospace; font-weight: 600; }
  .footer { color: #6b7280; font-size: 12px; margin-top: 18px; padding-top: 14px; border-top: 1px solid #e5e7eb; }
</style>
</head>
<body>
  <div class="card">
    <div class="check">✅</div>
    <h1>Gmail connected!</h1>
    <p class="lead">Save the refresh token below as a Replit secret — that's the last step.</p>

    <div class="step">
      <span class="num">1</span>
      <div style="flex:1">
        <strong>Copy your refresh token</strong>
        <div class="secret" id="token">${token}</div>
        <button onclick="copyToken()" id="copyBtn">📋 Copy refresh token</button>
      </div>
    </div>

    <div class="step">
      <span class="num">2</span>
      <div>In your app, click the <strong>🔒 Secrets</strong> icon in the left sidebar and add a new secret:<br>
        <div style="margin-top:6px"><code>GOOGLE_REFRESH_TOKEN</code> = <em>paste the token above</em></div>
      </div>
    </div>

    <div class="step">
      <span class="num">3</span>
      <div>Close this tab. Back in the app, click <strong>"Test Gmail Connection"</strong>. You're done!</div>
    </div>

    <p class="footer">This token never expires. The app will use it to read your Gmail messages from the last 7 days when you click <strong>Sync Now</strong>. Revoke any time at <a href="https://myaccount.google.com/permissions" target="_blank">myaccount.google.com/permissions</a>.</p>
  </div>
  <script>
    function copyToken() {
      const text = document.getElementById('token').innerText;
      navigator.clipboard.writeText(text).then(function() {
        const b = document.getElementById('copyBtn');
        b.innerText = '✓ Copied!';
        b.classList.add('copied');
        setTimeout(function(){ b.innerText = '📋 Copy refresh token'; b.classList.remove('copied'); }, 2200);
      });
    }
  </script>
</body>
</html>`;
}

function renderErrorPage(title, detail) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:20px;color:#1f2937}
.card{background:#fef2f2;border:1px solid #fecaca;border-radius:16px;padding:20px}
h1{color:#b91c1c;margin:0 0 8px;font-size:20px}
pre{background:#fff;border:1px solid #e5e7eb;padding:12px;border-radius:8px;overflow-x:auto;font-size:12px;white-space:pre-wrap;word-break:break-word}</style>
</head><body><div class="card"><h1>${escapeHtml(title)}</h1><pre>${escapeHtml(detail)}</pre><p>Close this tab and try again.</p></div></body></html>`;
}

// ─── /api/google/oauth/start ──────────────────────────────────────────────
// Redirects to Google's consent screen.
app.get('/api/google/oauth/start', (req, res) => {
  const { clientId } = getOAuthCreds();
  if (!clientId) {
    return res.status(400).send(renderErrorPage('Missing GOOGLE_CLIENT_ID',
      'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Replit Secrets, then try again.'));
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

// ─── /api/google/oauth/callback ───────────────────────────────────────────
// Google redirects here with ?code=... — exchange for refresh_token, render success page.
app.get('/api/google/oauth/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.status(400).send(renderErrorPage('Google sign-in cancelled', String(error)));
  if (!code) return res.status(400).send(renderErrorPage('Missing code parameter', 'No authorization code returned by Google.'));

  const { clientId, clientSecret } = getOAuthCreds();
  if (!clientId || !clientSecret) {
    return res.status(400).send(renderErrorPage(
      'OAuth credentials missing',
      'GOOGLE_CLIENT_ID and/or GOOGLE_CLIENT_SECRET are not set in Replit Secrets.'
    ));
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
      return res.status(500).send(renderErrorPage(`Token exchange failed (${resp.status})`, text));
    }
    const data = JSON.parse(text);
    if (!data.refresh_token) {
      return res.status(500).send(renderErrorPage(
        'No refresh token returned',
        'Google only issues a refresh token on the FIRST consent. Revoke this app at https://myaccount.google.com/permissions, then try again.'
      ));
    }
    res.send(renderSuccessPage(data.refresh_token));
  } catch (err) {
    res.status(500).send(renderErrorPage('Unexpected error', err.message));
  }
});

// ─── /api/google/oauth/redirect-uri ───────────────────────────────────────
// Returns the exact redirect URI the UI must show the user to add in Google Cloud.
app.get('/api/google/oauth/redirect-uri', (req, res) => {
  res.json({ redirectUri: buildRedirectUri(req) });
});

// ─── /api/gmail/test ──────────────────────────────────────────────────────
// Reports which secrets are present (does NOT call Google).
app.get('/api/gmail/test', (_req, res) => {
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

// ─── /api/gmail/test-imap ─────────────────────────────────────────────────
// Actually calls Google to verify credentials and count last-7-days mail.
// (Path kept for backward UI compat.)
app.get('/api/gmail/test-imap', async (_req, res) => {
  try {
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

// ─── /api/gmail/emails ────────────────────────────────────────────────────
app.get('/api/gmail/emails', async (_req, res) => {
  try {
    const result = await fetchGmailEmailsViaAPI();
    res.json({ ...result, total: result.emails.length });
  } catch (err) {
    console.error('Gmail email fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── /api/gmail/debug-emails ──────────────────────────────────────────────
app.get('/api/gmail/debug-emails', async (_req, res) => {
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

app.get('/api/health', (_req, res) => res.json({ ok: true }));

if (isProd) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (${isProd ? 'production' : 'development'})`);
});
