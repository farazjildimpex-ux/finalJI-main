import express from 'express';
import cors from 'cors';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

// In production, serve the built Vite frontend from /dist
const isProd = process.env.NODE_ENV === 'production';
if (isProd) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
}

// In production use PORT env var (Replit deployment), in dev use 3001
const PORT = isProd ? (process.env.PORT || 3000) : 3001;

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

async function getAccountInfo(accessToken) {
  const region = process.env.ZOHO_REGION || 'com';
  const resp = await fetch(`${zohoMailBase(region)}/accounts`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  if (!resp.ok) throw new Error(`Failed to get Zoho accounts: ${await resp.text()}`);
  const data = await resp.json();
  const accounts = data.data;
  if (!accounts || accounts.length === 0) throw new Error('No Zoho Mail accounts found.');
  const acc = accounts[0];
  // emailAddress is an array of objects; incomingUserName is the plaintext IMAP username
  const email = acc.incomingUserName
    || (Array.isArray(acc.emailAddress) ? acc.emailAddress.find((e) => e.isPrimary)?.mailId : null)
    || acc.sendMailDetails?.[0]?.fromAddress
    || acc.accountName
    || null;
  return { accountId: acc.accountId, email };
}

// Legacy alias for test endpoint
async function getAccountId(accessToken) {
  const info = await getAccountInfo(accessToken);
  return info.accountId;
}

function zohoImapHost(region = 'com') {
  return `imap.zoho.${region}`;
}

function stripHtml(html) {
  return (html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchEmailsViaIMAP(accessToken, emailAddress) {
  const region = process.env.ZOHO_REGION || 'com';
  const host = zohoImapHost(region);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const imapPassword = process.env.ZOHO_IMAP_PASSWORD;
  if (!imapPassword) {
    throw new Error(
      'ZOHO_IMAP_PASSWORD is not set. ' +
      'Please create a Zoho App-Specific Password at mail.zoho.com/zm/#settings/security ' +
      'and add it as the ZOHO_IMAP_PASSWORD secret in your project.'
    );
  }

  const client = new ImapFlow({
    host,
    port: 993,
    secure: true,
    auth: { user: emailAddress, pass: imapPassword },
    logger: false,
    tls: { rejectUnauthorized: false },
  });

  const emails = [];

  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = sevenDaysAgo.toISOString().split('T')[0];
      const uids = await client.search({ since: new Date(since) });
      console.log(`IMAP: found ${uids.length} messages since ${since}`);

      // Process up to 30 most recent
      const subset = uids.slice(-30);

      for (const uid of subset) {
        try {
          const msg = await client.fetchOne(uid, { source: true });
          if (!msg?.source) continue;

          const parsed = await simpleParser(msg.source);
          const pdfParse = require('pdf-parse');

          const bodyText = parsed.text || stripHtml(parsed.html || '') || '';
          const emailData = {
            subject: parsed.subject || '',
            from: parsed.from?.text || '',
            date: (parsed.date || new Date()).toISOString(),
            body: bodyText.slice(0, 8000),
            attachments: [],
          };

          for (const att of parsed.attachments || []) {
            const mime = (att.contentType || '').toLowerCase();
            const name = att.filename || '';
            console.log(`  Attachment: "${name}" mime="${mime}" size=${att.size}`);

            if (mime === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) {
              try {
                const buf = att.content;
                if (buf && buf.length > 100) {
                  const pdfData = await pdfParse(buf);
                  const text = (pdfData.text || '').trim();
                  console.log(`  ✓ PDF parsed: ${text.length} chars from "${name}"`);
                  if (text.length > 10) {
                    emailData.attachments.push({ name, text: text.slice(0, 8000), type: 'pdf' });
                  }
                }
              } catch (pdfErr) {
                console.error(`  PDF parse error for "${name}":`, pdfErr.message);
              }
            } else if (mime.startsWith('text/')) {
              emailData.attachments.push({
                name,
                text: att.content.toString('utf8').slice(0, 4000),
                type: 'text',
              });
            }
          }

          if (emailData.body.length > 10 || emailData.attachments.length > 0) {
            emails.push(emailData);
          }
        } catch (msgErr) {
          console.error('IMAP message error for uid', uid, msgErr.message);
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return emails;
}

app.get('/api/zoho/emails', async (req, res) => {
  try {
    const accessToken = await refreshZohoToken();
    const { email } = await getAccountInfo(accessToken);
    if (!email) throw new Error('Could not determine Zoho email address from account info');
    console.log(`Fetching emails via IMAP for ${email}`);
    const emails = await fetchEmailsViaIMAP(accessToken, email);
    res.json({ emails, total: emails.length });
  } catch (error) {
    console.error('IMAP email fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint — shows what IMAP fetches (subjects, attachment names)
app.get('/api/zoho/debug-emails', async (req, res) => {
  try {
    const accessToken = await refreshZohoToken();
    const { email } = await getAccountInfo(accessToken);
    if (!email) throw new Error('Could not determine Zoho email address');
    const emails = await fetchEmailsViaIMAP(accessToken, email);
    const summary = emails.map((e) => ({
      subject: e.subject,
      from: e.from,
      date: e.date,
      bodyLength: e.body.length,
      attachments: e.attachments.map((a) => ({ name: a.name, type: a.type, chars: a.text.length })),
    }));
    res.json({ total: emails.length, emails: summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test IMAP connection
app.get('/api/zoho/test-imap', async (req, res) => {
  try {
    const hasPassword = !!process.env.ZOHO_IMAP_PASSWORD;
    if (!hasPassword) {
      return res.json({ ok: false, error: 'ZOHO_IMAP_PASSWORD secret not set' });
    }
    const accessToken = await refreshZohoToken();
    const { email } = await getAccountInfo(accessToken);
    if (!email) return res.json({ ok: false, error: 'Could not determine email address' });

    const region = process.env.ZOHO_REGION || 'com';
    const client = new ImapFlow({
      host: zohoImapHost(region),
      port: 993,
      secure: true,
      auth: { user: email, pass: process.env.ZOHO_IMAP_PASSWORD },
      logger: false,
      tls: { rejectUnauthorized: false },
    });
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    const uids = await client.search({ since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) });
    lock.release();
    await client.logout();
    res.json({ ok: true, email, messagesLast7Days: uids.length });
  } catch (err) {
    res.json({ ok: false, error: err.message });
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

// Catch-all: serve React frontend for any non-API route (client-side routing)
if (isProd) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (${isProd ? 'production' : 'development'})`);
});
