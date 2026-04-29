import fs from 'fs';
import path from 'path';

const REPLIT_ENV_FILE = '/run/replit/env/latest.json';

let lastLoadedKeys = new Set();
let lastError = null;

function loadFromReplit() {
  try {
    if (!fs.existsSync(REPLIT_ENV_FILE)) return { ok: false, reason: 'file_not_found' };
    const raw = fs.readFileSync(REPLIT_ENV_FILE, 'utf8');
    const data = JSON.parse(raw);
    const env = data?.environment;
    if (!env || typeof env !== 'object') return { ok: false, reason: 'bad_format' };

    const newKeys = new Set();
    let added = 0;
    let changed = 0;

    for (const [key, value] of Object.entries(env)) {
      newKeys.add(key);
      const stringValue = value == null ? '' : String(value);
      if (process.env[key] !== stringValue) {
        if (lastLoadedKeys.has(key) || process.env[key] !== undefined) changed += 1;
        else added += 1;
        process.env[key] = stringValue;
      }
    }

    // Remove keys that disappeared from the secrets file (only if we loaded them previously)
    let removed = 0;
    for (const key of lastLoadedKeys) {
      if (!newKeys.has(key)) {
        delete process.env[key];
        removed += 1;
      }
    }

    lastLoadedKeys = newKeys;
    lastError = null;
    return { ok: true, total: newKeys.size, added, changed, removed };
  } catch (err) {
    lastError = err.message;
    return { ok: false, reason: 'error', error: err.message };
  }
}

let watcher = null;
let debounceTimer = null;

export function initReplitSecretWatcher({ onChange } = {}) {
  // Initial load: pick up any secrets the parent process didn't have at boot.
  const initial = loadFromReplit();
  if (initial.ok) {
    console.log(`[secrets] Loaded ${initial.total} secrets from Replit env file (added=${initial.added}, changed=${initial.changed})`);
  } else {
    console.log(`[secrets] Replit env file unavailable (${initial.reason}) — falling back to process.env only`);
    return;
  }

  // Watch the directory (fs.watch on the file itself can miss replace-style updates).
  try {
    const dir = path.dirname(REPLIT_ENV_FILE);
    const filename = path.basename(REPLIT_ENV_FILE);
    watcher = fs.watch(dir, (_event, changed) => {
      if (changed && changed !== filename) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const result = loadFromReplit();
        if (result.ok && (result.added || result.changed || result.removed)) {
          console.log(`[secrets] Refreshed: +${result.added} added, ~${result.changed} changed, -${result.removed} removed`);
          if (typeof onChange === 'function') {
            try { onChange(result); } catch (e) { console.error('[secrets] onChange handler error:', e.message); }
          }
        }
      }, 250);
    });
    console.log('[secrets] Watching Replit env file for live updates');
  } catch (err) {
    console.warn('[secrets] Could not set up watcher:', err.message);
  }
}

export function refreshSecretsNow() {
  return loadFromReplit();
}

export function getSecretWatcherStatus() {
  return {
    fileExists: fs.existsSync(REPLIT_ENV_FILE),
    watching: !!watcher,
    loadedKeyCount: lastLoadedKeys.size,
    lastError,
  };
}
