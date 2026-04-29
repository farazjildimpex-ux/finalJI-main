import { getAccessToken, gmailFetch, clearAccessTokenCache, json } from './_lib.mjs';

export default async () => {
  try {
    clearAccessTokenCache();
    const token = await getAccessToken();
    const profileResp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!profileResp.ok) {
      const t = await profileResp.text();
      return json({ ok: false, error: `Gmail API error (${profileResp.status}): ${t}` });
    }
    const profile = await profileResp.json();

    const query = encodeURIComponent('has:attachment newer_than:7d');
    const list = await gmailFetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=100`
    );
    const count = (list.messages || []).length;

    return json({ ok: true, email: profile.emailAddress, messagesLast7Days: count });
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
};
