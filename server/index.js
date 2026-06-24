import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import * as cheerio from 'cheerio';
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
  getZohoCreds,
  isZohoConfigured,
  fetchZohoEmailsViaIMAP,
  fetchZohoRecentAttachmentsViaIMAP,
  fetchZohoAttachmentViaIMAP,
  sendZohoEmail,
  renderZohoSuccessPage,
  renderZohoErrorPage,
} from './zohoLib.js';
import { retrievePdf } from './pdfLinks.js';

initReplitSecretWatcher();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.set('trust proxy', true);

const isProd = process.env.NODE_ENV === 'production';
const PORT = isProd ? (process.env.PORT || 3000) : 3001;

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    uptimeSeconds: Math.round(process.uptime()),
    zohoConfigured: Boolean(getZohoCreds().email && getZohoCreds().appPassword),
    timestamp: new Date().toISOString(),
  });
});

function zohoStatusPayload() {
  const { email, appPassword } = getZohoCreds();
  return {
    configured: Boolean(email && appPassword),
    email: email || null,
    hasSendScope: Boolean(email && appPassword),
  };
}

app.get('/api/zoho/test', (req, res) => {
  const { email, appPassword } = getZohoCreds();
  if (!email || !appPassword) {
    return res.json({
      connected: false,
      reason: 'missing_secrets',
      missing: {
        ZOHO_EMAIL_ADDRESS: !email,
        ZOHO_APP_PASSWORD: !appPassword,
      },
    });
  }
  res.json({ connected: true, email });
});

app.get('/api/zoho/test-imap', async (req, res) => {
  try {
    const { emails } = await fetchZohoEmailsViaIMAP();
    const { email } = getZohoCreds();
    res.json({ ok: true, email, messagesLast7Days: emails.length });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.get('/api/zoho/emails', async (req, res) => {
  try {
    const result = await fetchZohoEmailsViaIMAP();
    res.json({ ...result, total: result.emails.length });
  } catch (err) {
    console.error('Zoho email fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/zoho/debug-emails', async (req, res) => {
  try {
    const { emails } = await fetchZohoEmailsViaIMAP();
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

app.get('/api/zoho/recent-attachments', async (req, res) => {
  try {
    const result = await fetchZohoRecentAttachmentsViaIMAP();
    res.json(result);
  } catch (err) {
    console.error('[zoho-attachments] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/zoho/attachment', async (req, res) => {
  const { messageUid, attachmentIndex } = req.query;
  if (!messageUid && messageUid !== '0') return res.status(400).json({ error: 'messageUid required' });
  if (attachmentIndex === undefined) return res.status(400).json({ error: 'attachmentIndex required' });
  try {
    const result = await fetchZohoAttachmentViaIMAP(messageUid, attachmentIndex);
    res.json(result);
  } catch (err) {
    console.error('[zoho-attachment] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/zoho/send-status', (req, res) => {
  res.json(zohoStatusPayload());
});

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
  res.json(zohoStatusPayload());
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

  const result = await sendZohoEmail({
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

// ─── LWG Certified Suppliers Scraper ──────────────────────────────────────
// Country IDs from LWG's filter form
const LWG_COUNTRIES = {
  'Albania':19,'Algeria':59,'Argentina':11,'Australia':14,'Austria':13,
  'Azerbaijan':16,'Bangladesh':19,'Belgium':20,'Bolivia':28,'Bosnia and Herzegovina':17,
  'Brazil':29,'Bulgaria':22,'Cambodia':110,'Canada':36,'Chile':44,'China':46,
  'Colombia':47,'Croatia':93,'Czech Republic':53,'Denmark':56,
  'Dominican Republic':58,'Ecuador':60,'Egypt':62,'Ethiopia':66,'France':72,
  'Germany':54,'Hungary':95,'India':99,'Indonesia':96,'Iran':102,'Italy':104,
  'Japan':107,'Kazakhstan':118,'Kenya':108,'Lithuania':126,'Mexico':148,
  'Morocco':130,'Netherlands':157,'New Zealand':162,'Nigeria':155,'Norway':158,
  'Pakistan':169,'Paraguay':176,'Poland':170,'Portugal':174,'Romania':179,
  'Saudi Arabia':182,'Serbia':243,'Singapore':187,'Slovakia':191,'Slovenia':189,
  'South Africa':235,'South Korea':115,'Spain':65,'Sweden':186,'Syria':199,
  'Taiwan':215,'Tajikistan':206,'Thailand':205,'Tunisia':209,'Turkiye':212,
  'Uganda':218,'Ukraine':217,'United Arab Emirates':2,'United Kingdom':74,
  'United States':220,'Uruguay':221,'Uzbekistan':222,'Vietnam':228,
};

// Rating IDs
const LWG_RATINGS = { 'Gold':8, 'Silver':2, 'Bronze':24, 'Audited':13, 'Approved':541 };

async function fetchLWGPage(pageIndex, params) {
  const base = pageIndex === 0
    ? 'https://www.leatherworkinggroup.com/get-involved/our-community/certified-suppliers/'
    : `https://www.leatherworkinggroup.com/get-involved/our-community/certified-suppliers/${pageIndex}/`;

  const qs = new URLSearchParams();
  if (params.countryId)  qs.set('tx_llcatalog_pi[filters][country][]', params.countryId);
  if (params.ratingId)   qs.set('tx_llcatalog_pi[filters][rating][]',  params.ratingId);
  if (params.keywords)   qs.set('tx_llcatalog_pi[filters][keywords]',  params.keywords);

  const url = qs.toString() ? `${base}?${qs}` : base;

  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`LWG returned ${resp.status}`);
  return resp.text();
}

function parseLWGPage(html, countryLabel, certLabel) {
  const $ = cheerio.load(html);
  const suppliers = [];

  $('.record.card').each((_, el) => {
    const $el = $(el);
    const nameEl = $el.find('.details h2 a, h2 a').first();
    const name = nameEl.text().trim();
    if (!name) return;
    const href = nameEl.attr('href') || '';
    const detailUrl = href.startsWith('http') ? href : `https://www.leatherworkinggroup.com${href}`;

    // Try to extract LWG rating from the card (populated when no certLabel passed)
    const ratingEl = $el.find('.rating, .certificate-rating, .cert-level, .llcatalog-rating, [class*="rating"]').first();
    const ratingFromCard = ratingEl.text().replace(/[^a-zA-Z]/g, '').trim();
    const validRatings = ['Gold', 'Silver', 'Bronze', 'Audited', 'Approved'];
    const detectedRating = validRatings.find(r => ratingFromCard.toLowerCase().includes(r.toLowerCase())) || '';

    // Try to extract member/facility type from the card
    const typeEl = $el.find(
      '.details .type, .type, .facility-type, .member-type, .listing-type, ' +
      '.record-type, .catalog-type, [class*="type"]:not([class*="content"])'
    ).first();
    const facilityType = typeEl.text().trim().replace(/\s+/g, ' ');

    // Try to extract a description / "about" blurb
    const descEl = $el.find('.details .description, .details .about, .details .intro, .details p:not(:has(a))').first();
    const description = descEl.text().trim().replace(/\s+/g, ' ');

    suppliers.push({
      company_name:      name,
      country:           countryLabel || '',
      certification_type: certLabel || detectedRating || '',
      facility_type:     facilityType  || '',
      description:       description   || '',
      website:           detailUrl,
      address:           '',
    });
  });

  // Extract total count from pagination
  const paginationText = $('.pagination p, .catalog-pagination p, [class*="pagination"] p').text().trim();
  const totalMatch = paginationText.match(/out of\s+(\d[\d,]*)/i);
  const total = totalMatch ? parseInt(totalMatch[1].replace(/,/g, '')) : suppliers.length;

  return { suppliers, total };
}

app.get('/api/scrape/lwg', async (req, res) => {
  try {
    const countryName  = req.query.country    || '';
    const ratingName   = req.query.rating     || '';
    const keywords     = req.query.keywords   || '';
    const memberType   = req.query.memberType || '';

    const countryId = countryName ? LWG_COUNTRIES[countryName] : undefined;
    const ratingId  = ratingName  ? LWG_RATINGS[ratingName]    : undefined;
    // memberType is passed as a keyword search so it works regardless of exact LWG filter IDs
    const effectiveKeywords = memberType || keywords;

    const params = {};
    if (countryId)         params.countryId = countryId;
    if (ratingId)          params.ratingId  = ratingId;
    if (effectiveKeywords) params.keywords  = effectiveKeywords;

    // Fetch first page to learn the total count
    const html0 = await fetchLWGPage(0, params);
    const { suppliers: page0, total } = parseLWGPage(html0, countryName, ratingName);
    const allSuppliers = [...page0];

    // If total not detected from pagination text, estimate from first page results
    // (Some LWG pages don't show "out of X" when filtered)
    const effectiveTotal = total > 0 ? total : page0.length;

    // Calculate remaining pages needed (12 suppliers per page typical)
    const perPage = page0.length > 0 ? page0.length : 12;
    const totalPages = Math.max(1, Math.ceil(effectiveTotal / perPage));

    // Fetch remaining pages in batches of 5 to avoid hammering the server
    const BATCH = 5;
    for (let start = 1; start < totalPages; start += BATCH) {
      const end = Math.min(start + BATCH, totalPages);
      const batch = [];
      for (let p = start; p < end; p++) {
        batch.push(
          fetchLWGPage(p, params)
            .then(html => parseLWGPage(html, countryName, ratingName).suppliers)
            .catch(() => [])
        );
      }
      const pages = await Promise.all(batch);
      for (const pg of pages) allSuppliers.push(...pg);
    }

    // Deduplicate by company name
    const seen = new Set();
    const unique = allSuppliers.filter(s => {
      if (seen.has(s.company_name)) return false;
      seen.add(s.company_name);
      return true;
    });

    return res.json({
      ok: true,
      suppliers: unique,
      total: unique.length,
      lwg_total: total,
      countries: Object.keys(LWG_COUNTRIES).sort(),
      ratings: Object.keys(LWG_RATINGS),
    });
  } catch (err) {
    console.error('[scrape/lwg]', err.message);
    return res.json({ ok: false, error: err.message });
  }
});

// ─── LWG Single Supplier Profile Scraper ──────────────────────────────────
app.get('/api/scrape/lwg/profile', async (req, res) => {
  try {
    const url = req.query.url || '';
    if (!url.startsWith('https://www.leatherworkinggroup.com')) {
      return res.json({ ok: false, error: 'Invalid URL — must be a leatherworkinggroup.com link' });
    }
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`LWG returned ${resp.status}`);
    const html = await resp.text();
    const $p = cheerio.load(html);

    // LWG profiles use <strong>Label</strong> Value inside <p> tags
    // inside div.box.cta — NOT mailto: links.
    let email = '';
    let phone = '';
    let contactPerson = '';
    let address = '';

    $p('.box.cta p, .column.two p, .wrapper.standard p').each((_, el) => {
      const $el = $p(el);
      const strong = $el.find('strong').text().trim().toLowerCase();
      const fullText = $el.text().trim();
      const value = fullText.replace($el.find('strong').text(), '').trim();

      if (strong.includes('email') && value) {
        email = email || value;
      } else if (strong.includes('phone') && value) {
        phone = phone || value;
      } else if (strong.includes('contact') && value) {
        contactPerson = contactPerson || value;
      } else if (strong.includes('address') && value) {
        address = address || value;
      }
    });

    // Fallback: try mailto: links
    if (!email) {
      const mailtoHref = $p('a[href^="mailto:"]').first().attr('href');
      if (mailtoHref) email = mailtoHref.replace('mailto:', '').trim();
    }
    // Fallback: regex scan for email in body text
    if (!email) {
      const emailMatch = $p('body').text().match(/[\w.-]+@[\w.-]+\.[A-Za-z]{2,}/);
      if (emailMatch) email = emailMatch[0];
    }
    // Fallback for phone: try tel: links
    if (!phone) {
      const telHref = $p('a[href^="tel:"]').first().attr('href');
      if (telHref) phone = telHref.replace('tel:', '').trim();
    }

    // Extract company website (skip social/tracking links)
    let website = '';
    $p('a[href^="http"]').each((_, el) => {
      if (website) return;
      const href = $p(el).attr('href') || '';
      if (!href.includes('leatherworkinggroup.com') &&
          !href.includes('linkedin.com') &&
          !href.includes('facebook.com') &&
          !href.includes('twitter.com') &&
          !href.includes('instagram.com') &&
          !href.includes('hs-scripts.com') &&
          !href.includes('hubspot') &&
          !href.includes('google')) {
        website = href;
      }
    });

    const bodyText = $p('body').text();
    const ANIMAL_TYPES   = ['Bovine','Ovine','Caprine','Equine','Porcine','Reptile','Exotic'];
    const MATERIAL_CONDS = ['Wet-Blue','Crust','Finished','Pickled','Limed'];
    const animalTypes        = ANIMAL_TYPES.filter(t => bodyText.toLowerCase().includes(t.toLowerCase()));
    const materialConditions = MATERIAL_CONDS.filter(t => bodyText.toLowerCase().includes(t.toLowerCase()));

    const desc = $p('.supplier-description, .about-text, .profile-description, .field-description, main p').first().text().trim().replace(/\s+/g, ' ').slice(0, 400);

    return res.json({ ok: true, email, phone, contactPerson, website, animalTypes, materialConditions, desc, address });
  } catch (err) {
    console.error('[scrape/lwg/profile]', err.message);
    return res.json({ ok: false, error: err.message });
  }
});

// ─── Android TWA: Digital Asset Links ────────────────────────────────────
app.get('/.well-known/assetlinks.json', (req, res) => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const assetLinksPath = isProd
    ? path.resolve(__dirname, '..', 'dist', '.well-known', 'assetlinks.json')
    : path.resolve(__dirname, '..', 'public', '.well-known', 'assetlinks.json');
  if (fs.existsSync(assetLinksPath)) {
    res.setHeader('Content-Type', 'application/json');
    res.sendFile(assetLinksPath);
  } else {
    res.status(404).json({ error: 'assetlinks.json not found' });
  }
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

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}

export default app;
