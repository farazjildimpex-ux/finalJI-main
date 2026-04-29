import express from 'express';
import cors from 'cors';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { initReplitSecretWatcher } from './replitSecrets.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

initReplitSecretWatcher();

const app = express();
app.use(cors());
app.use(express.json());

const isProd = process.env.NODE_ENV === 'production';
const PORT = isProd ? (process.env.PORT || 3000) : 3001;

// ─── Gmail OAuth & API Helpers ─────────────────────────────────────────────
async function getGmailAccessToken() {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`Gmail token error: ${data.error}`);
  return data.access_token;
}

async function fetchGmailEmails() {
  const token = await getGmailAccessToken();
  const query = encodeURIComponent('has:attachment newer_than:7d');
  
  const listResp = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=20`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const listData = await listResp.json();
  const messages = listData.messages || [];

  const emails = [];
  const { PDFParse } = require('pdf-parse');

  for (const m of messages) {
    try {
      const msgResp = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const msg = await msgResp.json();
      
      const emailData = {
        subject: (msg.payload.headers.find(h => h.name === 'Subject') || {}).value || '',
        from: (msg.payload.headers.find(h => h.name === 'From') || {}).value || '',
        date: new Date(parseInt(msg.internalDate)).toISOString(),
        body: '',
        attachments: []
      };

      // Simple payload walker for body and attachments
      const parts = [msg.payload];
      while (parts.length) {
        const part = parts.shift();
        if (part.parts) parts.push(...part.parts);
        
        if (part.mimeType === 'text/plain' && part.body.data) {
          emailData.body += Buffer.from(part.body.data, 'base64url').toString();
        }
        
        if (part.filename && part.filename.toLowerCase().endsWith('.pdf') && part.body.attachmentId) {
          const attResp = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}/attachments/${part.body.attachmentId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const attData = await attResp.json();
          const buffer = Buffer.from(attData.data, 'base64url');
          const parser = new PDFParse({ data: buffer });
          const pdf = await parser.getText();
          emailData.attachments.push({
            name: part.filename,
            text: pdf.text || '',
            type: 'pdf'
          });
        }
      }
      emails.push(emailData);
    } catch (e) {
      console.error('Error fetching Gmail message:', e.message);
    }
  }
  return { emails };
}

app.get('/api/gmail/emails', async (req, res) => {
  try {
    const result = await fetchGmailEmails();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/gmail/test', (req, res) => {
  const ok = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN);
  res.json({ connected: ok });
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));