import { fetchGmailEmailsViaAPI, json } from './_lib.mjs';

export const config = { timeout: 26 };

export default async () => {
  try {
    const result = await fetchGmailEmailsViaAPI();
    return json({ ...result, total: result.emails.length });
  } catch (err) {
    console.error('Gmail email fetch error:', err);
    return json({ error: err.message }, { status: 500 });
  }
};
