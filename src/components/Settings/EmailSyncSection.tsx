import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowUpCircle,
  PlusCircle,
  XCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  Key,
  Info,
  Sparkles,
} from 'lucide-react';
import type { SyncResult } from '../../lib/emailSync';

const OPENROUTER_KEY_STORAGE = 'jild_openrouter_key';
const OPENROUTER_MODEL_STORAGE = 'jild_openrouter_model';

const FREE_MODELS = [
  { value: 'openai/gpt-oss-20b:free',                label: 'OpenAI GPT OSS 20B (free) — recommended' },
  { value: 'openai/gpt-oss-120b:free',               label: 'OpenAI GPT OSS 120B (free) — slower but smarter' },
  { value: 'google/gemma-4-31b-it:free',             label: 'Google Gemma 4 31B (free)' },
  { value: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'NVIDIA Nemotron 120B (free)' },
  { value: 'qwen/qwen3-next-80b-a3b-instruct:free',  label: 'Qwen 3 80B (free)' },
  { value: 'google/gemma-4-26b-a4b-it:free',         label: 'Google Gemma 4 26B (free)' },
];

// ─── tiny helpers ──────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ action: SyncResult['action'] }> = ({ action }) => {
  if (action === 'created')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-700">
        <PlusCircle className="h-3 w-3" /> Created
      </span>
    );
  if (action === 'updated')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-700">
        <ArrowUpCircle className="h-3 w-3" /> Updated
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-gray-100 text-gray-500">
      <XCircle className="h-3 w-3" /> Skipped
    </span>
  );
};

type GmailStatus = 'unknown' | 'testing' | 'ok' | 'missing' | 'error';

// ─── main component ────────────────────────────────────────────────────────
const EmailSyncSection: React.FC = () => {
  const [openRouterKey, setOpenRouterKey] = useState<string>(
    () => localStorage.getItem(OPENROUTER_KEY_STORAGE) || ''
  );
  const [selectedModel, setSelectedModel] = useState<string>(
    () => localStorage.getItem(OPENROUTER_MODEL_STORAGE) || 'openai/gpt-oss-20b:free'
  );
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  // Setup panel
  const [showSetup, setShowSetup] = useState(false);

  // Connection status (secret-presence check)
  const [gmailStatus, setGmailStatus] = useState<GmailStatus>('unknown');
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);

  // IMAP test status (actual login test)
  const [imapStatus, setImapStatus] = useState<'unknown' | 'testing' | 'ok' | 'error'>('unknown');
  const [imapInfo, setImapInfo] = useState<string | null>(null);

  // Sync state
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<'idle' | 'fetching' | 'analyzing' | 'saving' | 'done' | 'error'>('idle');
  const [results, setResults] = useState<SyncResult[] | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const created = results?.filter((r) => r.action === 'created').length ?? 0;
  const updated = results?.filter((r) => r.action === 'updated').length ?? 0;
  const skipped = results?.filter((r) => r.action === 'skipped').length ?? 0;

  // ── test that secrets are set ─────────────────────────────────────────────
  const testConnection = useCallback(async () => {
    setGmailStatus('testing');
    setGmailEmail(null);
    try {
      const resp = await fetch('/api/gmail/test');
      const data = await resp.json();
      if (data.connected) {
        setGmailStatus('ok');
        setGmailEmail(data.email || null);
      } else if (data.reason === 'missing_secrets') {
        setGmailStatus('missing');
      } else {
        setGmailStatus('error');
      }
    } catch {
      setGmailStatus('error');
    }
  }, []);

  // ── actually login via IMAP and count messages ────────────────────────────
  const testImapConnection = useCallback(async () => {
    setImapStatus('testing');
    setImapInfo(null);
    try {
      const resp = await fetch('/api/gmail/test-imap');
      const data = await resp.json();
      if (data.ok) {
        setImapStatus('ok');
        setImapInfo(`${data.messagesLast7Days} message(s) found in the last 7 days`);
        setGmailStatus('ok');
        setGmailEmail(data.email || null);
      } else {
        setImapStatus('error');
        setImapInfo(data.error || 'Gmail IMAP connection failed');
      }
    } catch (e: any) {
      setImapStatus('error');
      setImapInfo(e.message);
    }
  }, []);

  useEffect(() => { testConnection(); }, [testConnection]);

  // ── save OpenRouter key ──────────────────────────────────────────────────
  const handleSaveKey = () => {
    if (!openRouterKey.trim()) return;
    localStorage.setItem(OPENROUTER_KEY_STORAGE, openRouterKey.trim());
    localStorage.setItem(OPENROUTER_MODEL_STORAGE, selectedModel);
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem(OPENROUTER_MODEL_STORAGE, model);
  };

  // ── run email sync ───────────────────────────────────────────────────────
  const handleSync = async () => {
    if (!openRouterKey.trim()) {
      setShowSetup(true);
      return;
    }
    if (gmailStatus !== 'ok') {
      setShowSetup(true);
      return;
    }
    localStorage.setItem(OPENROUTER_KEY_STORAGE, openRouterKey.trim());
    setRunning(true);
    setSyncError(null);
    setResults(null);
    setStage('fetching');
    try {
      const { fetchGmailEmails, analyzeEmailsWithAI, upsertInvoices } = await import('../../lib/emailSync');
      const { supabase } = await import('../../lib/supabaseClient');
      const { emails } = await fetchGmailEmails();
      if (emails.length === 0) { setResults([]); setStage('done'); setShowResults(true); return; }
      setStage('analyzing');
      const { data: contracts } = await supabase.from('contracts').select('*');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in.');
      const extracted = await analyzeEmailsWithAI(emails, contracts || [], openRouterKey.trim());
      if (extracted.length === 0) { setResults([]); setStage('done'); setShowResults(true); return; }
      setStage('saving');
      const syncResults = await upsertInvoices(extracted, user.id);
      setResults(syncResults);
      setStage('done');
      setShowResults(true);
    } catch (err: any) {
      setSyncError(err?.message || 'Unknown error.');
      setStage('error');
    } finally {
      setRunning(false);
    }
  };

  const stageLabel =
    stage === 'fetching' ? 'Connecting to Gmail and downloading emails…'
    : stage === 'analyzing' ? 'AI is reading emails & attachments for invoice data…'
    : stage === 'saving' ? 'Saving invoices to database…'
    : '';

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">

      {/* Top header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-violet-50">
            <Mail className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Auto Invoice Sync</p>
            <p className="text-xs text-gray-500">Scan Gmail (last 7 days) · AI fills invoice details automatically</p>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50 shadow-sm"
        >
          {running ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          {running ? 'Syncing…' : 'Sync Now'}
        </button>
      </div>

      {/* Connection badge */}
      <div className="px-4 pb-4 flex items-center gap-3 flex-wrap">
        {gmailStatus === 'testing' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500">
            <RefreshCw className="h-3 w-3 animate-spin" /> Checking Gmail connection…
          </div>
        )}
        {gmailStatus === 'ok' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700">
            <Wifi className="h-3.5 w-3.5" />
            Gmail connected{gmailEmail && <span className="opacity-70">· {gmailEmail}</span>}
          </div>
        )}
        {(gmailStatus === 'missing' || gmailStatus === 'error' || gmailStatus === 'unknown') && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-700">
            <WifiOff className="h-3.5 w-3.5" />
            {gmailStatus === 'missing' ? 'Gmail not set up yet' : 'Gmail not connected'}
          </div>
        )}
        {imapStatus === 'ok' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Inbox ready
          </div>
        )}
        {imapStatus === 'error' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
            <AlertCircle className="h-3.5 w-3.5" /> Inbox login failed
          </div>
        )}
        {gmailStatus !== 'testing' && (
          <button onClick={testConnection} className="text-[11px] text-gray-400 hover:text-gray-600 underline">
            Re-test
          </button>
        )}
      </div>

      {/* Progress bar */}
      {running && (
        <div className="px-4 pb-4 space-y-2">
          <div className="flex items-center gap-2 p-3 bg-violet-50 rounded-2xl border border-violet-100">
            <RefreshCw className="h-4 w-4 text-violet-600 animate-spin shrink-0" />
            <p className="text-xs font-semibold text-violet-800">{stageLabel}</p>
          </div>
          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-700"
              style={{ width: stage === 'fetching' ? '30%' : stage === 'analyzing' ? '65%' : stage === 'saving' ? '90%' : '100%' }}
            />
          </div>
        </div>
      )}

      {/* Sync error */}
      {stage === 'error' && syncError && (
        <div className="px-4 pb-4">
          <div className="flex gap-3 p-3 bg-red-50 border border-red-200 rounded-2xl">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-red-700">Sync failed</p>
              <p className="text-xs text-red-600 mt-0.5">{syncError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Sync results */}
      {stage === 'done' && results !== null && (
        <div className="px-4 pb-4 space-y-3">
          {results.length === 0 ? (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-2xl border border-gray-200">
              <Info className="h-4 w-4 text-gray-400 shrink-0" />
              <p className="text-xs text-gray-600">No invoices found in emails from the last 7 days.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <p className="text-xs font-semibold text-emerald-800">
                  Sync complete —{' '}
                  {created > 0 && <>{created} invoice{created !== 1 ? 's' : ''} created</>}
                  {created > 0 && updated > 0 && ', '}
                  {updated > 0 && <>{updated} updated</>}
                  {skipped > 0 && ` (${skipped} skipped)`}
                </p>
              </div>
              <button
                onClick={() => setShowResults((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-bold text-gray-700 transition-colors"
              >
                View details ({results.length})
                {showResults ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {showResults && (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {results.map((r, i) => (
                    <div key={i} className="p-3 bg-white border border-gray-200 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-gray-900 truncate">{r.invoice_number}</span>
                        <StatusBadge action={r.action} />
                      </div>
                      {r.contract_numbers?.length > 0 && (
                        <p className="text-[11px] text-gray-500">Contract: <span className="font-semibold text-gray-700">{r.contract_numbers.join(', ')}</span></p>
                      )}
                      {r.action === 'skipped' && r.reason && (
                        <p className="text-[11px] text-red-500">{r.reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Setup panel ────────────────────────────────────────────── */}
      <div className="border-t border-gray-100">
        <button
          onClick={() => setShowSetup((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-xs font-semibold text-gray-600"
        >
          <span className="flex items-center gap-2">
            <Key className="h-3.5 w-3.5 text-gray-400" />
            Setup &amp; Configuration
            {(gmailStatus !== 'ok' || imapStatus !== 'ok') && (
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black rounded-full uppercase">Action needed</span>
            )}
          </span>
          {showSetup ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {showSetup && (
          <div className="px-4 pb-5 space-y-5">

            {/* ① OpenRouter key */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white text-[10px] font-black shrink-0">1</div>
                <p className="text-xs font-bold text-gray-800">OpenRouter AI Key</p>
                {keySaved && <span className="text-[11px] text-emerald-600 font-bold">✓ Saved!</span>}
              </div>
              <div className="ml-7 space-y-1.5">
                <div className="flex gap-2">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={openRouterKey}
                    onChange={(e) => { setOpenRouterKey(e.target.value); setKeySaved(false); }}
                    placeholder="sk-or-..."
                    className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50"
                  />
                  <button onClick={() => setShowKey((v) => !v)} className="px-3 py-2 text-xs border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50">
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={handleSaveKey}
                    disabled={!openRouterKey.trim()}
                    className={`px-3 py-2 text-xs font-bold rounded-xl transition-colors disabled:opacity-40 ${keySaved ? 'bg-emerald-500 text-white' : 'bg-violet-600 text-white hover:bg-violet-700'}`}
                  >
                    {keySaved ? '✓ Saved' : 'Save'}
                  </button>
                </div>
                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-violet-600 hover:underline">
                  Get a free key at openrouter.ai <ExternalLink className="h-3 w-3" />
                </a>
                <div className="mt-2">
                  <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">
                    AI Model <span className="text-gray-400 font-normal normal-case">(all are free — if one fails, switch to another)</span>
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => handleModelChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none bg-gray-50"
                  >
                    {FREE_MODELS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* ② Connect Gmail */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white text-[10px] font-black shrink-0">2</div>
                <p className="text-xs font-bold text-gray-800">
                  Connect Gmail
                  {gmailStatus === 'ok'
                    ? <span className="ml-2 text-emerald-600 font-semibold">✓ Connected</span>
                    : <span className="ml-2 text-amber-600 font-normal">(one-time setup, ~3 minutes)</span>}
                </p>
              </div>

              {gmailStatus === 'ok' && imapStatus === 'ok' ? (
                <div className="ml-7 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-emerald-800">Gmail is connected — you're all set!</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">You never need to repeat this. Click "Sync Now" any time.</p>
                  </div>
                </div>
              ) : (
                <div className="ml-7 space-y-4">

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex gap-2">
                    <Sparkles className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      <strong>One-time setup.</strong> You'll create a Google App Password (a special 16-character password just for this app),
                      then save it as a Replit Secret. After that, just click "Sync Now" anytime.
                    </p>
                  </div>

                  <ol className="space-y-3 text-[12px] text-gray-700 leading-relaxed">
                    <li className="flex gap-2">
                      <span className="font-black text-violet-600 shrink-0">①</span>
                      <span>
                        Make sure 2-Step Verification is ON for your Google account at{' '}
                        <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer"
                          className="text-violet-600 font-bold underline inline-flex items-center gap-0.5">
                          myaccount.google.com/security <ExternalLink className="h-3 w-3" />
                        </a>{' '}
                        (App Passwords only appear once 2-Step is enabled).
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-black text-violet-600 shrink-0">②</span>
                      <span>
                        Open{' '}
                        <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer"
                          className="text-violet-600 font-bold underline inline-flex items-center gap-0.5">
                          myaccount.google.com/apppasswords <ExternalLink className="h-3 w-3" />
                        </a>{' '}
                        — name the app <em>"JILD Sync"</em> and click <strong>Create</strong>.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-black text-violet-600 shrink-0">③</span>
                      <span>
                        Google shows you a <strong>16-character password</strong> (e.g. <code className="px-1 bg-gray-100 rounded">abcd efgh ijkl mnop</code>).
                        <strong> Copy it now</strong> — Google will not show it again.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-black text-violet-600 shrink-0">④</span>
                      <span>
                        In Replit, click the <strong>🔒 Secrets</strong> icon in the left sidebar and add <strong>two</strong> secrets:
                        <div className="mt-2 space-y-1.5">
                          <div className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                            <span className="font-mono text-[11px] font-bold text-gray-700 shrink-0">GMAIL_USER</span>
                            <span className="text-[11px] text-gray-500">= your Gmail address (e.g. you@gmail.com)</span>
                          </div>
                          <div className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                            <span className="font-mono text-[11px] font-bold text-gray-700 shrink-0">GMAIL_APP_PASSWORD</span>
                            <span className="text-[11px] text-gray-500">= the 16-character password you just copied (spaces are fine)</span>
                          </div>
                        </div>
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-black text-violet-600 shrink-0">⑤</span>
                      <span>
                        Replit will restart the app automatically. Come back here and click the <strong>"Test Gmail Connection"</strong> button below.
                      </span>
                    </li>
                  </ol>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={testImapConnection}
                      disabled={imapStatus === 'testing'}
                      className="flex items-center gap-2 px-3 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors"
                    >
                      {imapStatus === 'testing'
                        ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Testing…</>
                        : <><Wifi className="h-3.5 w-3.5" /> Test Gmail Connection</>
                      }
                    </button>
                  </div>

                  {imapStatus === 'ok' && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-emerald-800">Gmail connected — PDF attachments will be read automatically</p>
                        {imapInfo && <p className="text-[11px] text-emerald-700 mt-0.5">{imapInfo}</p>}
                      </div>
                    </div>
                  )}
                  {imapStatus === 'error' && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-2xl">
                      <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-red-700">Gmail connection failed</p>
                        {imapInfo && <p className="text-[11px] text-red-600 mt-0.5">{imapInfo}</p>}
                        <p className="text-[11px] text-red-600 mt-1">
                          Common fixes: ① Make sure you used the App Password (16 chars), not your regular Google password.
                          ② Confirm 2-Step Verification is enabled. ③ Check that GMAIL_USER is your full email address.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default EmailSyncSection;
