import express from 'express';
import cors from 'cors';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { initReplitSecretWatcher, refreshSecretsNow } from './replitSecrets.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

initReplitSecretWatcher();

const app = express();
app.use(cors());
app.use(express.json());

const isProd = process.env.NODE_ENV === 'production';
const PORT = isProd ? (process.env.PORT || 3000) : 3001;

// ─── Zoho OAuth & API Helpers ─────────────────────────────────────────────
async function getZohoAccessToken() {
  const region = process.env.ZOHO_REGION || 'in';
  const resp = await fetch(`https://accounts.zoho.${region}/oauth/v2/token`, {
    method: 'POST',
    body: new URLSearchParams({
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Zoho token error: ${data.error}`);
  return data.access_token;
}

async function fetchZohoEmails() {
  const token = await getZohoAccessToken();
  const region = process.env.ZOHO_REGION || 'in';
  
  // 1. Get Account ID
  const accResp = await fetch(`https://mail.zoho.${region}/api/v1/accounts`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const accData = await accResp.json();
  const accountId = accData.data?.[0]?.accountId;
  if (!accountId) throw new Error('No Zoho Mail account found');

  // 2. Fetch Messages (last 7 days)
  const messagesResp = await fetch(`https://mail.zoho.${region}/api/v1/accounts/${accountId}/messages?searchKey=hasAttachment:true`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const messagesData = await messagesResp.json();
  const messages = messagesData.data || [];

  const emails = [];
  const { PDFParse } = require('pdf-parse');

  for (const msg of messages.slice(0, 15)) {
    try {
      // Fetch full content and attachments
      const detailResp = await fetch(`https://mail.zoho.${region}/api/v1/accounts/${accountId}/messages/${msg.messageId}/content`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const detail = await detailResp.json();
      
      const emailData = {
        subject: msg.subject,
        from: msg.sender,
        date: new Date(parseInt(msg.receivedTime)).toISOString(),
        body: detail.data?.content || '',
        attachments: []
      };

      // Handle attachments
      if (detail.data?.attachments) {
        for (const att of detail.data.attachments) {
          if (att.attachmentName.toLowerCase().endsWith('.pdf')) {
            const attResp = await fetch(`https://mail.zoho.${region}/api/v1/accounts/${accountId}/messages/${msg.messageId}/attachments/${att.attachmentId}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const buffer = Buffer.from(await attResp.arrayBuffer());
            const parser = new PDFParse({ data: buffer });
            const pdf = await parser.getText();
            emailData.attachments.push({
              name: att.attachmentName,
              text: pdf.text || '',
              type: 'pdf'
            });
          }
        }
      }
      emails.push(emailData);
    } catch (e) {
      console.error('Error fetching Zoho message:', e.message);
    }
  }
  return { emails };
}

app.get('/api/gmail/emails', async (req, res) => {
  try {
    const result = await fetchZohoEmails();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/gmail/test', (req, res) => {
  const ok = !!(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_REFRESH_TOKEN);
  res.json({ connected: ok });
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));