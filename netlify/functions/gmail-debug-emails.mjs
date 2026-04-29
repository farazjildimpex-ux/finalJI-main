import { fetchGmailEmailsViaAPI, json } from './_lib.mjs';

export const config = { timeout: 26 };

export default async () => {
  try {
    const { emails } = await fetchGmailEmailsViaAPI();
    return json({
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
    return json({ error: err.message }, { status: 500 });
  }
};
