import express from 'express';
import cors from 'cors';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

// Region-aware Zoho base URLs
// Supported: com (US/global), in (India), eu (Europe), com.au (Australia), jp (Japan)
function zohoAuthBase(region = 'com') {
  return `https://accounts.zoho.${region}/oauth/v2/token`;
}
function zohoMailBase(region = 'com') {
  return `https://mail.zoho.${region}/api`;
}

async function refreshZohoToken() {
  const { ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_REGION } = process.env;
  if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_REFRESH_TOKEN) {
    throw new Error('ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN must be set as secrets.');
  }

  const region = ZOHO_REGION || 'com';
  const params = new URLSearchParams({
    refresh_token: ZOHO_REFRESH_TOKEN,
    client_id: ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });

  const resp = await fetch(zohoAuthBase(region), {
    method: 'POST',
    body: params,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Zoho token refresh failed: ${text}`);
  }

  const data = await resp.json();
  if (!data.access_token) throw new Error(`No access token returned: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function getAccountId(accessToken) {
  const region = process.env.ZOHO_REGION || 'com';
  const resp = await fetch(`${zohoMailBase(region)}/accounts`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  if (!resp.ok) throw new Error(`Failed to get Zoho accounts: ${await resp.text()}`);
  const data = await resp.json();
  const accounts = data.data;
  if (!accounts || accounts.length === 0) throw new Error('No Zoho Mail accounts found.');
  return accounts[0].accountId;
}

async function getRecentMessages(accessToken, accountId) {
  const region = process.env.ZOHO_REGION || 'com';
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const url = `${zohoMailBase(region)}/accounts/${accountId}/messages/view?limit=100&start=1`;
  const resp = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  if (!resp.ok) throw new Error(`Failed to fetch messages: ${await resp.text()}`);
  const data = await resp.json();
  const messages = data.data || [];

  return messages.filter((msg) => {
    const ts = parseInt(msg.receivedTime, 10);
    return ts >= sevenDaysAgo;
  });
}

async function getMessageContent(accessToken, accountId, folderId, messageId) {
  const region = process.env.ZOHO_REGION || 'com';
  const resp = await fetch(
    `${zohoMailBase(region)}/accounts/${accountId}/folders/${folderId}/messages/${messageId}/content`,
    { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
  );
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.data || null;
}

async function getAttachmentBuffer(accessToken, accountId, folderId, messageId, storeName) {
  const region = process.env.ZOHO_REGION || 'com';
  const resp = await fetch(
    `${zohoMailBase(region)}/accounts/${accountId}/folders/${folderId}/messages/${messageId}/attachments/${storeName}`,
    { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
  );
  if (!resp.ok) return null;
  const arrayBuf = await resp.arrayBuffer();
  return Buffer.from(arrayBuf);
}

function stripHtml(html) {
  return (html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

app.get('/api/zoho/emails', async (req, res) => {
  try {
    const accessToken = await refreshZohoToken();
    const accountId = await getAccountId(accessToken);
    const messages = await getRecentMessages(accessToken, accountId);

    const emailsWithContent = [];

    for (const msg of messages.slice(0, 30)) {
      try {
        const content = await getMessageContent(accessToken, accountId, msg.folderId, msg.messageId);
        if (!content) continue;

        const bodyHtml = content.content || '';
        const bodyText = stripHtml(bodyHtml);

        const emailData = {
          subject: msg.subject || '',
          from: msg.fromAddress || '',
          date: msg.receivedTime ? new Date(parseInt(msg.receivedTime, 10)).toISOString() : '',
          body: bodyText.slice(0, 8000),
          attachments: [],
        };

        if (content.attachments && Array.isArray(content.attachments)) {
          for (const att of content.attachments) {
            const mimeType = (att.mimeType || '').toLowerCase();
            const name = att.attachmentName || '';

            if (mimeType === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) {
              try {
                const buf = await getAttachmentBuffer(
                  accessToken, accountId, msg.folderId, msg.messageId, att.storeName || att.attachmentId
                );
                if (buf) {
                  const pdfParse = require('pdf-parse');
                  const pdfData = await pdfParse(buf);
                  emailData.attachments.push({
                    name,
                    text: (pdfData.text || '').slice(0, 6000),
                    type: 'pdf',
                  });
                }
              } catch (pdfErr) {
                console.error('PDF parse error for', name, pdfErr.message);
              }
            } else if (mimeType.startsWith('text/')) {
              try {
                const buf = await getAttachmentBuffer(
                  accessToken, accountId, msg.folderId, msg.messageId, att.storeName || att.attachmentId
                );
                if (buf) {
                  emailData.attachments.push({
                    name,
                    text: buf.toString('utf8').slice(0, 4000),
                    type: 'text',
                  });
                }
              } catch {}
            }
          }
        }

        const hasContent =
          emailData.body.length > 10 ||
          emailData.attachments.length > 0;

        if (hasContent) {
          emailsWithContent.push(emailData);
        }
      } catch (msgErr) {
        console.error('Error processing message', msg.messageId, msgErr.message);
      }
    }

    res.json({ emails: emailsWithContent, total: messages.length });
  } catch (error) {
    console.error('Zoho error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Exchange a Zoho authorization code for a refresh token (one-time setup)
app.post('/api/zoho/exchange-token', async (req, res) => {
  try {
    const { client_id, client_secret, code, region } = req.body || {};
    if (!client_id || !client_secret || !code) {
      return res.status(400).json({ error: 'client_id, client_secret, and code are required.' });
    }

    const safeRegion = (region || 'com').replace(/[^a-z.]/g, '');
    const tokenUrl = zohoAuthBase(safeRegion);

    // Self Client does NOT use a redirect_uri — omitting it is required
    const params = new URLSearchParams({
      code: code.trim(),
      client_id: client_id.trim(),
      client_secret: client_secret.trim(),
      grant_type: 'authorization_code',
    });

    const resp = await fetch(tokenUrl, {
      method: 'POST',
      body: params,
    });

    const data = await resp.json();

    if (!data.refresh_token) {
      return res.status(400).json({
        error: data.error_description || data.error || 'No refresh token returned. The code may have expired — generate a new one.',
        raw: data,
      });
    }

    res.json({ refresh_token: data.refresh_token, region: safeRegion });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test if Zoho credentials are working
app.get('/api/zoho/test', async (req, res) => {
  try {
    if (!process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET || !process.env.ZOHO_REFRESH_TOKEN) {
      return res.status(200).json({
        connected: false,
        reason: 'missing_secrets',
        message: 'ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, or ZOHO_REFRESH_TOKEN not set in Replit Secrets.',
      });
    }

    const accessToken = await refreshZohoToken();
    const accountId = await getAccountId(accessToken);

    // Get a basic account info
    const resp = await fetch(`https://mail.zoho.com/api/accounts/${accountId}`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    const data = await resp.json();
    const account = data.data || {};

    res.json({
      connected: true,
      email: account.emailAddress || account.sendMailDetails?.[0]?.fromAddress || 'Connected',
      accountId,
    });
  } catch (err) {
    res.status(200).json({ connected: false, reason: 'error', message: err.message });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API server running on port ${PORT}`);
});
