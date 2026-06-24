import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export function getZohoCreds() {
  const email =
    (process.env.ZOHO_EMAIL_ADDRESS || process.env.ZOHO_IMAP_USER || process.env.ZOHO_SMTP_USER || '').trim();
  const appPassword =
    (process.env.ZOHO_APP_PASSWORD || process.env.ZOHO_IMAP_PASSWORD || process.env.ZOHO_SMTP_PASSWORD || '').trim();

  return {
    email,
    appPassword,
    imapHost: (process.env.ZOHO_IMAP_HOST || 'imap.zoho.com').trim(),
    imapPort: Number(process.env.ZOHO_IMAP_PORT || 993),
    smtpHost: (process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com').trim(),
    smtpPort: Number(process.env.ZOHO_SMTP_PORT || 465),
  };
}

export function isZohoConfigured() {
  const { email, appPassword } = getZohoCreds();
  return Boolean(email && appPassword);
}

function stripHtml(html) {
  return (html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isUsableAttachment(att) {
  const mime = (att.mimeType || '').toLowerCase();
  const name = (att.filename || '').toLowerCase();
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.csv')) return 'text';
  if (mime === 'application/octet-stream' && name.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  return null;
}

function getMessageBody(parsed) {
  const body =
    (parsed.text || '').trim() ||
    stripHtml(parsed.html || '');
  return body;
}

async function withImapClient(fn) {
  const { email, appPassword, imapHost, imapPort } = getZohoCreds();
  if (!email || !appPassword) {
    throw new Error('Zoho IMAP is not configured. Set ZOHO_EMAIL_ADDRESS and ZOHO_APP_PASSWORD in secrets.');
  }

  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: true,
    auth: { user: email, pass: appPassword },
    logger: false,
  });

  try {
    await client.connect();
    return await fn(client);
  } finally {
    try {
      await client.logout();
    } catch {}
  }
}

export async function fetchZohoEmailsViaIMAP() {
  return withImapClient(async (client) => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await client.mailboxOpen('INBOX');
    const uids = await client.search({ since: sevenDaysAgo });
    const emails = [];
    const selected = uids.slice(-30);

    const { PDFParse } = await import('pdf-parse');

    for await (const msg of client.fetch(selected, { uid: true, envelope: true, source: true })) {
      try {
        const parsed = await simpleParser(msg.source);
        const attachments = [];
        const parsedAttachments = parsed.attachments || [];

        for (let i = 0; i < parsedAttachments.length; i++) {
          const att = parsedAttachments[i];
          const kind = isUsableAttachment(att);
          if (!kind) continue;

          const baseAttachment = {
            name: att.filename || `attachment-${i + 1}`,
            type: kind,
            text: '',
            mimeType: att.contentType || 'application/octet-stream',
          };

          if (kind === 'pdf' && att.content?.length > 100) {
            let text = '';
            try {
              const parser = new PDFParse({ data: att.content });
              const pdf = await parser.getText();
              text = (pdf.text || '').trim();
            } catch (parseErr) {
              console.warn(`PDF text extract failed for "${baseAttachment.name}": ${parseErr.message}`);
            }
            const needsOcr = text.length < 200;
            attachments.push({
              ...baseAttachment,
              text: text.slice(0, 8000),
              ...(needsOcr && att.content.length <= 6 * 1024 * 1024
                ? { dataBase64: att.content.toString('base64') }
                : {}),
            });
          } else if (kind === 'text') {
            attachments.push({
              ...baseAttachment,
              text: att.content.toString('utf8').slice(0, 4000),
            });
          } else if (kind === 'image') {
            attachments.push({
              ...baseAttachment,
              text: '',
              dataBase64: att.content.toString('base64'),
            });
          }
        }

        const body = getMessageBody(parsed);
        if (body.length > 10 || attachments.length > 0) {
          emails.push({
            id: String(msg.uid),
            subject: parsed.subject || '',
            from: parsed.from?.text || '',
            date: (parsed.date || new Date()).toISOString(),
            body: body.slice(0, 8000),
            attachments,
          });
        }
      } catch (msgErr) {
        console.error('Zoho message parse error for', msg.uid, msgErr.message);
      }
    }

    return { emails };
  });
}

export async function sendZohoEmail({ to, cc, subject, body, attachmentBase64, attachmentName, attachmentMime }) {
  const { email, appPassword, smtpHost, smtpPort } = getZohoCreds();
  if (!email || !appPassword) {
    return { ok: false, error: 'Zoho is not connected. Set ZOHO_EMAIL_ADDRESS and ZOHO_APP_PASSWORD.' };
  }
  try {
    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: email,
        pass: appPassword,
      },
    });

    await transport.sendMail({
      from: email,
      to,
      cc: cc?.length ? cc : undefined,
      subject,
      html: body,
      attachments: attachmentBase64 && attachmentName ? [{
        filename: attachmentName,
        content: Buffer.from(attachmentBase64, 'base64'),
        contentType: attachmentMime || 'application/pdf',
      }] : undefined,
    });
    return { ok: true, messageId: `${Date.now()}` };
  } catch (err) {
    return { ok: false, error: err?.message || 'Zoho SMTP send failed' };
  }
}

export async function fetchZohoRecentAttachmentsViaIMAP() {
  return withImapClient(async (client) => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await client.mailboxOpen('INBOX');
    const uids = await client.search({ since: sevenDaysAgo });
    const attachments = [];

    for (const uid of uids.slice(-20)) {
      try {
        const msg = await client.fetchOne(uid, { uid: true, source: true, envelope: true });
        if (!msg?.source) continue;
        const parsed = await simpleParser(msg.source);
        const date = (parsed.date || new Date()).toISOString();
        const parsedAttachments = parsed.attachments || [];

        parsedAttachments.forEach((att, index) => {
          const kind = isUsableAttachment(att);
          if (!kind) return;
          attachments.push({
            messageUid: String(uid),
            attachmentIndex: index,
            filename: att.filename || `attachment-${index + 1}`,
            mimeType: att.contentType || 'application/octet-stream',
            date,
          });
        });
      } catch (err) {
        console.warn('Zoho attachment scan failed for uid', uid, err?.message || err);
      }
    }

    return { attachments };
  });
}

export async function fetchZohoAttachmentViaIMAP(messageUid, attachmentIndex) {
  return withImapClient(async (client) => {
    await client.mailboxOpen('INBOX');
    const msg = await client.fetchOne(Number(messageUid), { uid: true, source: true });
    if (!msg?.source) throw new Error('Zoho message not found');
    const parsed = await simpleParser(msg.source);
    const attachments = (parsed.attachments || []).filter((att) => isUsableAttachment(att));
    const att = attachments[Number(attachmentIndex)];
    if (!att) throw new Error('Zoho attachment not found');
    return {
      base64: att.content.toString('base64'),
      filename: att.filename || 'attachment.pdf',
      mimeType: att.contentType || 'application/octet-stream',
    };
  });
}

export function renderZohoSuccessPage(message = 'Zoho connected!') {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${message}</title></head><body><pre>${message}</pre></body></html>`;
}

export function renderZohoErrorPage(title, detail) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body><pre>${title}\n\n${detail}</pre></body></html>`;
}
