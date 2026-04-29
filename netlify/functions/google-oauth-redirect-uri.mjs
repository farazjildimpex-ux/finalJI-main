import { buildRedirectUri, json } from './_lib.mjs';

export default async (req) => {
  return json({ redirectUri: buildRedirectUri(req) });
};
