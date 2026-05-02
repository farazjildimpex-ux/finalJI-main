/**
 * Zoho Mail API helpers — OAuth2 + send email.
 *
 * Required Replit Secrets:
 *   ZOHO_CLIENT_ID       — From your Zoho Developer Console app
 *   ZOHO_CLIENT_SECRET   — From your Zoho Developer Console app
 *   ZOHO_REFRESH_TOKEN   — Obtained after first OAuth consent
 *   ZOHO_FROM_EMAIL      — The Zoho address you send from
 *   ZOHO_ACCOUNT_ID      — Zoho account numeric ID (auto-fetched and cached)
 *
 * Zoho OAuth docs:  https://www.zoho.com/mail/help/api/
 * Auth server:      https://accounts.zoho.com  (or .eu / .in / .com.au depending on your DC)
 */

// Zoho data-center auth base — default is .com; update if your account is on .eu/.in etc.
const ZOHO_AUTH_BASE = process.env.ZOHO_AUTH_BASE || 'https://accounts.zoho.com';
const ZOHO_API_BASE  = process.env.ZOHO_API_BASE  || 'https://mail.zoho.com';

export function getZohoCreds() {
  return {
    clientId:     (process.env.ZOHO_CLIENT_ID     || '').trim(),
    clientSecret: (process.env.ZOHO_CLIENT_SECRET  || '').trim(),
    refreshToken: (process.env.ZOHO_REFRESH_TOKEN  || '').trim(),
    fromEmail:    (process.env.ZOHO_FROM_EMAIL     || '').trim(),
    fromName:     (process.env.ZOHO_FROM_NAME      || '').trim(),
    accountId:    (process.env.ZOHO_ACCOUNT_ID     || '').trim(),
  };
}

let _accessToken   = null;
let _tokenExpiry   = 0;
let _accountId     = null;

/** Exchange refresh token → short-lived access token (cached). */
export async function getZohoAccessToken() {
  if (_accessToken && Date.now() < _tokenExpiry - 60_000) return _accessToken;

  const { clientId, clientSecret, refreshToken } = getZohoCreds();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Zoho credentials not configured. Set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN in Replit Secrets.');
  }

  const resp = await fetch(`${ZOHO_AUTH_BASE}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  const data = await resp.json();
  if (!resp.ok || data.error) {
    throw new Error(`Zoho token refresh failed: ${data.error || resp.status} — ${data.error_description || ''}`);
  }

  _accessToken = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  return _accessToken;
}

/** Fetch the numeric Zoho account ID (cached in process memory + env var). */
export async function getZohoAccountId() {
  const envId = getZohoCreds().accountId;
  if (envId) return envId;
  if (_accountId) return _accountId;

  const token = await getZohoAccessToken();
  const resp = await fetch(`${ZOHO_API_BASE}/api/accounts`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  const data = await resp.json();
  if (!resp.ok || !data.data?.[0]?.accountId) {
    throw new Error('Could not fetch Zoho account ID. Ensure ZohoMail.messages.CREATE scope is granted.');
  }
  _accountId = String(data.data[0].accountId);
  return _accountId;
}

/**
 * Send an email via Zoho Mail API.
 *
 * @param {object} opts
 * @param {string|string[]} opts.to
 * @param {string|string[]} [opts.cc]
 * @param {string} opts.subject
 * @param {string} opts.body          HTML or plain text
 * @param {string} [opts.contentType] 'html' | 'plaintext'  (default 'html')
 * @param {Buffer|string} [opts.attachmentBuffer]
 * @param {string} [opts.attachmentName]
 * @param {string} [opts.attachmentMime]
 * @returns {Promise<{ok: boolean, messageId?: string, error?: string}>}
 */
export async function sendZohoEmail({ to, cc, subject, body, contentType = 'html', attachmentBuffer, attachmentName, attachmentMime }) {
  try {
    const token     = await getZohoAccessToken();
    const accountId = await getZohoAccountId();
    const { fromEmail, fromName } = getZohoCreds();

    if (!fromEmail) throw new Error('ZOHO_FROM_EMAIL is not set in Replit Secrets.');

    const toArr  = Array.isArray(to) ? to : [to];
    const ccArr  = cc ? (Array.isArray(cc) ? cc : [cc]) : [];

    // If there is an attachment we must upload it first, then send.
    let uploadId = null;
    if (attachmentBuffer && attachmentName) {
      const mime = attachmentMime || 'application/pdf';
      const formData = new FormData();
      const blob = attachmentBuffer instanceof Buffer
        ? new Blob([attachmentBuffer], { type: mime })
        : new Blob([Buffer.from(attachmentBuffer, 'base64')], { type: mime });
      formData.append('attach', blob, attachmentName);

      const uploadUrl = `${ZOHO_API_BASE}/api/accounts/${accountId}/messages/attachments`;
      console.log('[zoho-attach] uploading to:', uploadUrl, 'filename:', attachmentName, 'mime:', mime);
      const upResp = await fetch(
        uploadUrl,
        { method: 'POST', headers: { Authorization: `Zoho-oauthtoken ${token}` }, body: formData },
      );
      const upText = await upResp.text();
      console.log('[zoho-attach] response status:', upResp.status, 'body:', upText);
      let upData;
      try { upData = JSON.parse(upText); } catch { upData = { raw: upText }; }
      if (!upResp.ok || !upData.data?.[0]?.attachmentId) {
        throw new Error(`Attachment upload failed (${upResp.status}): ${upText}`);
      }
      uploadId = upData.data[0].attachmentId;
      console.log('[zoho-attach] upload success, attachmentId:', uploadId);
    }

    const payload = {
      fromAddress: fromEmail,
      ...(fromName ? { senderName: fromName } : {}),
      toAddress:   toArr.join(','),
      ccAddress:   ccArr.join(','),
      subject,
      content:     body,
      mailFormat:  contentType,
    };
    if (uploadId) payload.attachmentId = [uploadId];

    const resp = await fetch(`${ZOHO_API_BASE}/api/accounts/${accountId}/messages`, {
      method:  'POST',
      headers: {
        Authorization:  `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();
    if (!resp.ok || data.status?.code !== 200) {
      throw new Error(`Zoho send failed (${resp.status}): ${JSON.stringify(data)}`);
    }

    return { ok: true, messageId: data.data?.messageId };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Build the Zoho OAuth authorization URL for first-time consent. */
export function buildZohoAuthUrl(redirectUri) {
  const { clientId } = getZohoCreds();
  if (!clientId) throw new Error('ZOHO_CLIENT_ID not set.');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     clientId,
    scope:         'ZohoMail.messages.ALL,ZohoMail.accounts.READ',
    redirect_uri:  redirectUri,
    access_type:   'offline',
    prompt:        'consent',
  });
  return `${ZOHO_AUTH_BASE}/oauth/v2/auth?${params}`;
}

/** Exchange the one-time code for a refresh token. */
export async function exchangeZohoCode(code, redirectUri) {
  const { clientId, clientSecret } = getZohoCreds();
  const resp = await fetch(`${ZOHO_AUTH_BASE}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  redirectUri,
      code,
    }),
  });
  const data = await resp.json();
  if (!resp.ok || data.error) {
    throw new Error(`Zoho code exchange failed: ${data.error} — ${data.error_description || ''}`);
  }
  return data; // { access_token, refresh_token, expires_in, ... }
}

export function zohoConfigured() {
  const { clientId, clientSecret, refreshToken } = getZohoCreds();
  return !!(clientId && clientSecret && refreshToken);
}
