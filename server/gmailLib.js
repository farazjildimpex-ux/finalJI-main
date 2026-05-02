// Shared Gmail/OAuth helpers for the Replit Express server.
// Ported from netlify/functions/_lib.mjs.
// IMPORTANT: pdf-parse is intentionally NOT imported at module top — it's
// loaded lazily inside fetchGmailEmailsViaAPI so OAuth endpoints stay fast.

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export function getOAuthCreds() {
  return {
    clientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
    clientSecret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
    refreshToken: (process.env.GOOGLE_REFRESH_TOKEN || '').trim(),
  };
}

// Build the OAuth redirect URI. On Replit we prefer REPLIT_DEV_DOMAIN /
// REPLIT_DOMAINS (the proxied public host the user reaches the app at).
// In production behind a custom domain, fall back to the request host.
export function buildRedirectUri(req) {
  const replitDomain = (process.env.REPLIT_DEV_DOMAIN || '').trim()
    || (process.env.REPLIT_DOMAINS || '').split(',')[0].trim();
  if (replitDomain) {
    return `https://${replitDomain}/api/google/oauth/callback`;
  }
  // Fallback: derive from request headers (works behind any reverse proxy).
  try {
    const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https')
      .toString().split(',')[0].trim();
    const host = (req.headers['x-forwarded-host'] || req.headers.host || '')
      .toString().split(',')[0].trim();
    if (host) return `${proto}://${host}/api/google/oauth/callback`;
  } catch {}
  return '/api/google/oauth/callback';
}

// ─── Google access-token cache (per process, ~1h validity) ────────────────
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

export async function fetchGmailEmailsViaAPI() {
  const query = encodeURIComponent('has:attachment newer_than:7d');
  const list = await gmailFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=30`
  );
  const messages = list.messages || [];
  console.log(`Gmail API: found ${messages.length} messages with attachments in last 7 days`);

  const emails = [];
  // Lazy import — only loaded on actual sync runs.
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
            let text = '';
            try {
              const parser = new PDFParse({ data: buf });
              const pdf = await parser.getText();
              text = (pdf.text || '').trim();
            } catch (parseErr) {
              console.warn(`  ⚠ PDF text extract failed for "${att.filename}": ${parseErr.message}`);
            }
            // If pdf-parse got little/no text, the PDF is scanned/image-based.
            // Include the raw PDF (base64) so the AI can OCR it via the
            // OpenRouter file-parser plugin. Cap at ~6 MB to keep requests sane.
            const needsOcr = text.length < 200;
            const dataBase64 = needsOcr && buf.length <= 6 * 1024 * 1024
              ? buf.toString('base64')
              : null;
            console.log(
              `  ✓ PDF "${att.filename}" → ${text.length} chars` +
              (needsOcr ? ` (image PDF, ${dataBase64 ? `attaching ${(buf.length/1024).toFixed(0)} KB for OCR` : 'too large for OCR'})` : '')
            );
            emailData.attachments.push({
              name: att.filename,
              text: text.slice(0, 8000),
              type: 'pdf',
              ...(dataBase64 ? { dataBase64, mimeType: 'application/pdf' } : {}),
            });
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

// ─── HTML for the OAuth callback page ─────────────────────────────────────
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

export function renderSuccessPage(refreshToken, {
  title      = 'Gmail connected!',
  secretName = 'GOOGLE_REFRESH_TOKEN',
  step3      = 'Return to the app and click <strong>"Test Gmail Connection"</strong>. You\'re done!',
  footer     = 'This token never expires. The app uses it to read your Gmail messages. Revoke any time at <a href="https://myaccount.google.com/permissions" target="_blank">myaccount.google.com/permissions</a>.',
} = {}) {
  const token = escapeHtml(refreshToken);
  const safeTitle = escapeHtml(title);
  const safeSecret = escapeHtml(secretName);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
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
    <h1>${safeTitle}</h1>
    <p class="lead">Copy the refresh token below and save it as a Replit Secret — that's the last step.</p>

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
      <div>In Replit, open <strong>Secrets</strong> in the left sidebar and add:<br>
        <div style="margin-top:6px"><code>${safeSecret}</code> = <em>paste the token above</em></div>
        <div class="warn">After saving, restart the workflow so the server picks up the new secret.</div>
      </div>
    </div>

    <div class="step">
      <span class="num">3</span>
      <div>${step3}</div>
    </div>

    <p class="footer">${footer}</p>
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
