/**
 * Temporary PDF link storage using the local filesystem.
 * Files are stored in server/.pdf-cache/<uuid>.pdf
 * with a companion <uuid>.json for metadata (filename, expiry).
 *
 * TTL: 72 hours.  Expired files are pruned on each store() call.
 */

import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir    = dirname(fileURLToPath(import.meta.url));
const CACHE    = join(__dir, '.pdf-cache');
const TTL_MS   = 72 * 60 * 60 * 1000; // 72 hours

if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });

/** Remove expired files. */
function pruneExpired() {
  try {
    for (const f of readdirSync(CACHE)) {
      if (!f.endsWith('.json')) continue;
      const metaPath = join(CACHE, f);
      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
        if (Date.now() > meta.expiresAt) {
          unlinkSync(metaPath);
          const pdfPath = metaPath.replace('.json', '.pdf');
          if (existsSync(pdfPath)) unlinkSync(pdfPath);
        }
      } catch (_) {}
    }
  } catch (_) {}
}

/**
 * Store a PDF buffer and return a token.
 * @param {Buffer} pdfBuffer
 * @param {string} filename  e.g. "Contract_2026.pdf"
 * @returns {string} token (UUID)
 */
export function storePdf(pdfBuffer, filename) {
  pruneExpired();
  const token    = randomUUID();
  const expiresAt = Date.now() + TTL_MS;
  writeFileSync(join(CACHE, `${token}.pdf`),  pdfBuffer);
  writeFileSync(join(CACHE, `${token}.json`), JSON.stringify({ filename, expiresAt }), 'utf8');
  return token;
}

/**
 * Retrieve a stored PDF.
 * @param {string} token
 * @returns {{ buffer: Buffer, filename: string } | null}
 */
export function retrievePdf(token) {
  // Sanitise — only allow UUID-shaped tokens (prevents path traversal)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return null;
  const metaPath = join(CACHE, `${token}.json`);
  const pdfPath  = join(CACHE, `${token}.pdf`);
  if (!existsSync(metaPath) || !existsSync(pdfPath)) return null;
  try {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    if (Date.now() > meta.expiresAt) return null;
    return { buffer: readFileSync(pdfPath), filename: meta.filename };
  } catch (_) { return null; }
}
