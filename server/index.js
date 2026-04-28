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

const GMAIL_IMAP_HOST = 'imap.gmail.com';
const GMAIL_IMAP_PORT = 993;

function getGmailCredentials() {
  const user = (process.env.GMAIL_USER || '').trim();
  const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  if (!user || !pass) {
    return { ok: false, reason: 'missing_secrets', user, pass: '' };
  }
  return { ok: true, user, pass };
}

function stripHtml(html) {
  return (html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function openGmailClient() {
  const creds = getGmailCredentials();
  if (!creds.ok) {
    throw new Error(
      'Gmail is not configured. Add GMAIL_USER (your Gmail address) and GMAIL_APP_PASSWORD ' +
      '(a 16-character Google App Password from https://myaccount.google.com/apppasswords) as Replit secrets.'
    );
  }

  const client = new ImapFlow({
    host: GMAIL_IMAP_HOST,
    port: GMAIL_IMAP_PORT,
    secure: true,
    auth: { user: creds.user, pass: creds.pass },
    logger: false,
    tls: { rejectUnauthorized: false },
  });

  await client.connect();
  return { client, email: creds.user };
}

async function fetchGmailEmailsViaIMAP() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const { client, email } = await openGmailClient();
  const emails = [];

  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = sevenDaysAgo.toISOString().split('T')[0];
      const uids = await client.search({ since: new Date(since) });
      console.log(`Gmail IMAP: found ${uids.length} messages since ${since} for ${email}`);

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
          console.error('Gmail IMAP message error for uid', uid, msgErr.message);
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return { emails, email };
}

// ── /api/gmail/test ─────────────────────────────────────────────────────────
// Quick existence check — does NOT connect to IMAP, just reports whether
// the secrets are present. Used by the UI on page load.
app.get('/api/gmail/test', async (_req, res) => {
  try {
    const creds = getGmailCredentials();
    if (!creds.ok) {
      return res.status(200).json({
        connected: false,
        reason: 'missing_secrets',
        message: 'GMAIL_USER and/or GMAIL_APP_PASSWORD are not set in Replit Secrets.',
      });
    }
    res.json({ connected: true, email: creds.user });
  } catch (err) {
    res.status(200).json({ connected: false, reason: 'error', message: err.message });
  }
});

// ── /api/gmail/test-imap ────────────────────────────────────────────────────
// Actually opens an IMAP connection and counts messages from the last 7 days.
// This proves the App Password is correct.
app.get('/api/gmail/test-imap', async (_req, res) => {
  try {
    const creds = getGmailCredentials();
    if (!creds.ok) {
      return res.json({ ok: false, error: 'GMAIL_USER and/or GMAIL_APP_PASSWORD are not set in Replit Secrets.' });
    }

    const client = new ImapFlow({
      host: GMAIL_IMAP_HOST,
      port: GMAIL_IMAP_PORT,
      secure: true,
      auth: { user: creds.user, pass: creds.pass },
      logger: false,
      tls: { rejectUnauthorized: false },
    });

    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    let count = 0;
    try {
      const uids = await client.search({ since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) });
      count = uids.length;
    } finally {
      lock.release();
    }
    await client.logout();

    res.json({ ok: true, email: creds.user, messagesLast7Days: count });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// ── /api/gmail/emails ───────────────────────────────────────────────────────
// Pulls full message bodies + parsed PDF attachments from the last 7 days.
app.get('/api/gmail/emails', async (_req, res) => {
  try {
    const { emails } = await fetchGmailEmailsViaIMAP();
    res.json({ emails, total: emails.length });
  } catch (error) {
    console.error('Gmail email fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── /api/gmail/debug-emails ─────────────────────────────────────────────────
// Compact summary for debugging without flooding the response with full text.
app.get('/api/gmail/debug-emails', async (_req, res) => {
  try {
    const { emails } = await fetchGmailEmailsViaIMAP();
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
