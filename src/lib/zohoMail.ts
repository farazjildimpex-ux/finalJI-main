import type { EmailData } from './emailSync';

const IMPORTANT_HINTS = [
  'contract', 'invoice', 'payment', 'urgent', 'delivery', 'sample',
  'order', 'follow up', 'follow-up', 'quote', 'quotation', 'lc', 'letter of credit',
];

export function scoreZohoEmail(email: EmailData) {
  const subject = (email.subject || '').toLowerCase();
  const from = (email.from || '').toLowerCase();
  const body = (email.body || '').toLowerCase();
  const attachments = email.attachments?.length || 0;

  let score = 0;
  if (attachments > 0) score += 3;
  if (attachments > 1) score += 1;
  if (/urgent|asap|important/.test(subject)) score += 3;
  if (/invoice|payment|delivery|sample|contract/.test(subject)) score += 3;
  if (/invoice|payment|delivery|sample|contract/.test(body)) score += 2;
  if (/accounts?|accounts? payable|shipping|logistics|supplier|buyer/.test(from)) score += 1;
  if (IMPORTANT_HINTS.some((hint) => subject.includes(hint) || body.includes(hint))) score += 1;
  return score;
}

export function sortZohoEmails(emails: EmailData[]) {
  return [...emails].sort((a, b) => {
    const byScore = scoreZohoEmail(b) - scoreZohoEmail(a);
    if (byScore !== 0) return byScore;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

export function getEmailSnippet(email: EmailData) {
  const text = (email.body || '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 120) : 'No preview available';
}
