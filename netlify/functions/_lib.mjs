// Shared helpers for all Netlify Functions in this app.
// IMPORTANT: pdf-parse is intentionally NOT imported at module top — it's
// loaded lazily inside fetchGmailEmailsViaAPI so the lighter OAuth functions
// (gmail-test, redirect-uri, etc.) stay small and cold-start fast.

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

// ─── Env / secrets ────────────────────────────────────────────────────────
export function getOAuthCreds() {
  return {
    clientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
    clientSecret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
    refreshToken: (process.env.GOOGLE_REFRESH_TOKEN || '').trim(),
  };
}

// Build the OAuth redirect URI. On Netlify, the deployed site URL is exposed
// as URL (production) or DEPLOY_PRIME_URL (deploy previews / branch deploys).
// We prefer DEPLOY_PRIME_URL when set so OAuth also works on preview deploys.
export function buildRedirectUri(req) {
  const envUrl =
    (process.env.DEPLOY_PRIME_URL || process.env.URL || '').replace(/\/$/, '');
  if (envUrl) return `${envUrl}/api/google/oauth/callback`;

  // Fallback for local netlify-dev or unknown environments — derive from request.
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}/api/google/oauth/callback`;
  } catch {
    return '/api/google/oauth/callback';
  }
}

// ─── Google access-token cache (per function instance, ~1h validity) ──────
let cachedAccessToken = null;
let cachedAccessTokenExpiry = 0;

export function clearAccessTokenCache() {
  cachedAccessToken = null;
  cachedAccessTokenExpiry = 0;
}

export async function getAccessToken() {
  const { clientId, clientSecret, refreshToken } = getOAuthCreds();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN as Netlify environment variables.'
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

export async function gmailFetch(url) {
  const token = await getAccessToken();
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gmail API error (${resp.status}): ${text}`);
  }
  return resp.json();
}

// ─── Payload walker — handles forwarded msgs / missing filenames / octet-stream ──
function getPartHeader(part, name) {
  const h = (part.headers || []).find(
    (x) => (x.name || '').toLowerCase() === name.toLowerCase()
  );
  return h?.value || '';
}

function filenameFromHeaders(part) {
  const disp = getPartHeader(part, 'Content-Disposition');
  let m = disp.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (m) return decodeURIComponent(m[1].trim());
  const ctype = getPartHeader(part, 'Content-Type');
  m = ctype.match(/name\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (m) return decodeURIComponent(m[1].trim());
  return '';
}

function stripHtml(html) {
  return (html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractFromPayload(payload) {
  let bodyText = '';
  let bodyHtml = '';
  const attachments = [];

  function walk(part) {
    if (!part) return;
    const mime = (part.mimeType || '').toLowerCase();
    const filename = part.filename || filenameFromHeaders(part);

    if (part.body?.attachmentId) {
      attachments.push({
        attachmentId: part.body.attachmentId,
        filename: filename || `attachment-${attachments.length + 1}`,
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

export function isUsableAttachment(att) {
  const mime = (att.mimeType || '').toLowerCase();
  const name = (att.filename || '').toLowerCase();
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.csv')) return 'text';
  if (mime === 'application/octet-stream' && name.endsWith('.pdf')) return 'pdf';
  return null;
}

function getHeader(headers, name) {
  const h = (headers || []).find((x) => (x.name || '').toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

// ─── Main email fetch (lazy-loads pdf-parse to keep other functions slim) ──
export async function fetchGmailEmailsViaAPI() {
  const query = encodeURIComponent('has:attachment newer_than:7d');
  const list = await gmailFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=30`
  );
  const messages = list.messages || [];
  console.log(`Gmail API: found ${messages.length} messages with attachments in last 7 days`);

  const emails = [];
  // Lazy import — only loaded when this function actually runs, not for OAuth.
  const { PDFParse } = await import('pdf-parse');

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

      console.log(`  Email "${emailData.subject}" → ${attachments.length} attachment(s):`,
        attachments.map((a) => `${a.filename} (${a.mimeType}, ${a.size}b)`).join(', ') || 'none');

      for (const att of attachments) {
        const kind = isUsableAttachment(att);
        if (!kind) {
          console.log(`  ⊗ Skipped "${att.filename}" — unsupported type ${att.mimeType}`);
          continue;
        }
        try {
          const attResp = await gmailFetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}/attachments/${att.attachmentId}`
          );
          const buf = Buffer.from(attResp.data, 'base64url');

          if (kind === 'pdf' && buf.length > 100) {
            const parser = new PDFParse({ data: buf });
            const pdf = await parser.getText();
            const text = (pdf.text || '').trim();
            console.log(`  ✓ PDF parsed: ${text.length} chars from "${att.filename}"`);
            if (text.length > 10) {
              emailData.attachments.push({
                name: att.filename,
                text: text.slice(0, 8000),
                type: 'pdf',
              });
            }
          } else if (kind === 'text') {
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

// ─── Web-standard response helpers (Netlify Functions v2 returns Response) ─
export function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(init.headers || {}),
    },
  });
}

export function html(body, init = {}) {
  return new Response(body, {
    status: init.status || 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(init.headers || {}),
    },
  });
}

export function redirect(location, status = 302) {
  return new Response(null, { status, headers: { Location: location } });
}

// ─── HTML pages for the OAuth callback ────────────────────────────────────
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

export function renderSuccessPage(refreshToken) {
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
  .warn { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 10px; padding: 10px 12px; font-size: 12px; color: #92400e; margin-top: 10px; }
</style>
</head>
<body>
  <div class="card">
    <div class="check">✅</div>
    <h1>Gmail connected!</h1>
    <p class="lead">Save the refresh token below as a Netlify environment variable — that's the last step.</p>

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
      <div>In Netlify, open <strong>Site configuration → Environment variables</strong> and add:<br>
        <div style="margin-top:6px"><code>GOOGLE_REFRESH_TOKEN</code> = <em>paste the token above</em></div>
        <div class="warn">After saving, trigger a new deploy (Deploys → Trigger deploy → Deploy site). Netlify env vars only take effect on the next build.</div>
      </div>
    </div>

    <div class="step">
      <span class="num">3</span>
      <div>Once the redeploy is live, return to the app and click <strong>"Test Gmail Connection"</strong>. You're done!</div>
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

export function renderErrorPage(title, detail) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:20px;color:#1f2937}
.card{background:#fef2f2;border:1px solid #fecaca;border-radius:16px;padding:20px}
h1{color:#b91c1c;margin:0 0 8px;font-size:20px}
pre{background:#fff;border:1px solid #e5e7eb;padding:12px;border-radius:8px;overflow-x:auto;font-size:12px;white-space:pre-wrap;word-break:break-word}</style>
</head><body><div class="card"><h1>${escapeHtml(title)}</h1><pre>${escapeHtml(detail)}</pre><p>Close this tab and try again.</p></div></body></html>`;
}
