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
  Copy,
  Check,
} from 'lucide-react';
import type { SyncResult } from '../../lib/emailSync';

const OPENROUTER_KEY_STORAGE = 'jild_openrouter_key';
const OPENROUTER_MODEL_STORAGE = 'jild_openrouter_model';

// Vision-capable models are listed first because scanned/image PDFs need OCR.
// Text-only models will only see the filename and email body for image PDFs.
const FREE_MODELS = [
  { value: 'google/gemini-2.0-flash-exp:free',          label: 'Gemini 2.0 Flash (free) — reads scanned PDFs · recommended' },
  { value: 'google/gemini-2.5-flash-lite-preview-09-2025:free', label: 'Gemini 2.5 Flash Lite (free) — reads scanned PDFs' },
  { value: 'meta-llama/llama-3.2-11b-vision-instruct:free', label: 'Llama 3.2 11B Vision (free) — reads images' },
  { value: 'qwen/qwen2.5-vl-72b-instruct:free',         label: 'Qwen 2.5 VL 72B (free) — reads images' },
  { value: 'openai/gpt-oss-20b:free',                   label: 'OpenAI GPT OSS 20B (free) — text PDFs only' },
  { value: 'openai/gpt-oss-120b:free',                  label: 'OpenAI GPT OSS 120B (free) — text PDFs only' },
];

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

const CopyChip: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md bg-white border border-gray-300 hover:bg-gray-50 transition-colors text-gray-600"
    >
      {copied ? <><Check className="h-3 w-3 text-emerald-600" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
    </button>
  );
};

type GmailStatus = 'unknown' | 'testing' | 'ok' | 'missing' | 'error';
type MissingMap = { GOOGLE_CLIENT_ID?: boolean; GOOGLE_CLIENT_SECRET?: boolean; GOOGLE_REFRESH_TOKEN?: boolean };

const EmailSyncSection: React.FC = () => {
  const [openRouterKey, setOpenRouterKey] = useState<string>(
    () => localStorage.getItem(OPENROUTER_KEY_STORAGE) || ''
  );
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const saved = localStorage.getItem(OPENROUTER_MODEL_STORAGE);
    // The old text-only default couldn't read scanned PDFs. Auto-upgrade
    // anyone still on it to the new vision-capable default.
    const OLD_DEFAULTS = ['openai/gpt-oss-20b:free', 'openai/gpt-oss-120b:free'];
    if (!saved || OLD_DEFAULTS.includes(saved)) {
      const next = 'google/gemini-2.0-flash-exp:free';
      localStorage.setItem(OPENROUTER_MODEL_STORAGE, next);
      return next;
    }
    return saved;
  });
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  const [showSetup, setShowSetup] = useState(false);

  const [gmailStatus, setGmailStatus] = useState<GmailStatus>('unknown');
  const [missing, setMissing] = useState<MissingMap>({});
  const [redirectUri, setRedirectUri] = useState<string>('');

  const [imapStatus, setImapStatus] = useState<'unknown' | 'testing' | 'ok' | 'error'>('unknown');
  const [imapInfo, setImapInfo] = useState<string | null>(null);
  const [imapEmail, setImapEmail] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<'idle' | 'fetching' | 'analyzing' | 'saving' | 'done' | 'error'>('idle');
  const [results, setResults] = useState<SyncResult[] | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const created = results?.filter((r) => r.action === 'created').length ?? 0;
  const updated = results?.filter((r) => r.action === 'updated').length ?? 0;
  const skipped = results?.filter((r) => r.action === 'skipped').length ?? 0;

  const testConnection = useCallback(async () => {
    setGmailStatus('testing');
    try {
      const resp = await fetch('/api/gmail/test');
      const data = await resp.json();
      if (data.connected) {
        setGmailStatus('ok');
        setMissing({});
      } else if (data.reason === 'missing_secrets') {
        setGmailStatus('missing');
        setMissing(data.missing || {});
      } else {
        setGmailStatus('error');
      }
    } catch {
      setGmailStatus('error');
    }
  }, []);

  const fetchRedirectUri = useCallback(async () => {
    try {
      const resp = await fetch('/api/google/oauth/redirect-uri');
      const data = await resp.json();
      if (data.redirectUri) setRedirectUri(data.redirectUri);
    } catch {
      setRedirectUri(`${window.location.origin}/api/google/oauth/callback`);
    }
  }, []);

  const testImapConnection = useCallback(async () => {
    setImapStatus('testing');
    setImapInfo(null);
    try {
      const resp = await fetch('/api/gmail/test-imap');
      const data = await resp.json();
      if (data.ok) {
        setImapStatus('ok');
        setImapEmail(data.email || null);
        setImapInfo(`${data.messagesLast7Days} message(s) with attachments in the last 7 days`);
        setGmailStatus('ok');
      } else {
        setImapStatus('error');
        setImapInfo(data.error || 'Gmail connection failed');
      }
    } catch (e: any) {
      setImapStatus('error');
      setImapInfo(e.message);
    }
  }, []);

  useEffect(() => { testConnection(); fetchRedirectUri(); }, [testConnection, fetchRedirectUri]);

  // Once /api/gmail/test reports all 3 secrets present, run the live Gmail
  // verification automatically so the "Action needed" badge clears without the
  // user having to remember to press the test button.
  useEffect(() => {
    if (gmailStatus === 'ok' && imapStatus === 'unknown') {
      testImapConnection();
    }
  }, [gmailStatus, imapStatus, testImapConnection]);

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

  const handleConnectGoogle = () => {
    window.open('/api/google/oauth/start', '_blank', 'noopener,noreferrer');
  };

  const handleSync = async () => {
    if (!openRouterKey.trim()) { setShowSetup(true); return; }
    if (gmailStatus !== 'ok') { setShowSetup(true); return; }
    localStorage.setItem(OPENROUTER_KEY_STORAGE, openRouterKey.trim());
    setRunning(true); setSyncError(null); setResults(null); setStage('fetching');
    try {
      const { fetchGmailEmails, syncEmailsWithLog } = await import('../../lib/emailSync');
      const { supabase } = await import('../../lib/supabaseClient');
      const { emails } = await fetchGmailEmails();
      if (emails.length === 0) { setResults([]); setStage('done'); setShowResults(true); return; }
      setStage('analyzing');
      const { data: contracts } = await supabase.from('contracts').select('*');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in.');
      const scans = await syncEmailsWithLog(emails, contracts || [], openRouterKey.trim(), user.id);
      const syncResults = scans.flatMap((s) => s.results);
      setResults(syncResults);
      setStage('done');
      setShowResults(true);
      // Refresh history list after a sync run.
      window.dispatchEvent(new Event('jild-email-scan-log-refresh'));
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

  const hasClientCreds = !missing.GOOGLE_CLIENT_ID && !missing.GOOGLE_CLIENT_SECRET;
  const needsRefresh = hasClientCreds && missing.GOOGLE_REFRESH_TOKEN;

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

      {/* Status badges */}
      <div className="px-4 pb-4 flex items-center gap-3 flex-wrap">
        {gmailStatus === 'testing' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500">
            <RefreshCw className="h-3 w-3 animate-spin" /> Checking Gmail connection…
          </div>
        )}
        {gmailStatus === 'ok' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700">
            <Wifi className="h-3.5 w-3.5" />
            Gmail connected{imapEmail && <span className="opacity-70">· {imapEmail}</span>}
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
            <AlertCircle className="h-3.5 w-3.5" /> Gmail login failed
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

      {/* Setup panel */}
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

            {/* ② Connect Gmail via OAuth */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white text-[10px] font-black shrink-0">2</div>
                <p className="text-xs font-bold text-gray-800">
                  Connect Gmail
                  {gmailStatus === 'ok'
                    ? <span className="ml-2 text-emerald-600 font-semibold">✓ Connected</span>
                    : <span className="ml-2 text-amber-600 font-normal">(one-time setup)</span>}
                </p>
              </div>

              {gmailStatus === 'ok' && imapStatus === 'ok' ? (
                <div className="ml-7 space-y-2">
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-emerald-800">Gmail is connected — you're all set!</p>
                      <p className="text-[11px] text-emerald-700 mt-0.5">{imapInfo}</p>
                    </div>
                  </div>
                  <button
                    onClick={testImapConnection}
                    className="text-[11px] text-gray-400 hover:text-gray-600 underline ml-1"
                  >
                    Re-test connection
                  </button>
                </div>
              ) : (
                <div className="ml-7 space-y-4">

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex gap-2">
                    <Sparkles className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      <strong>One-time setup using Google's official OAuth.</strong> You'll create a small Google Cloud project,
                      paste 2 secrets, click "Connect Google", and you're done. Works for any Gmail or Workspace account.
                    </p>
                  </div>

                  {/* ── Phase A: get OAuth credentials from Google Cloud ── */}
                  <div className="space-y-3">
                    <p className="text-[12px] font-black text-gray-700 uppercase tracking-wide">
                      Phase A · Create OAuth credentials in Google Cloud
                    </p>

                    <ol className="space-y-3 text-[12px] text-gray-700 leading-relaxed">
                      <li className="flex gap-2">
                        <span className="font-black text-violet-600 shrink-0">①</span>
                        <span>
                          Open{' '}
                          <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener noreferrer"
                            className="text-violet-600 font-bold underline inline-flex items-center gap-0.5">
                            Google Cloud Console <ExternalLink className="h-3 w-3" />
                          </a>{' '}
                          and create a new project (e.g. <em>"JILD Sync"</em>). Wait ~10 seconds for it to provision, then select it.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-black text-violet-600 shrink-0">②</span>
                        <span>
                          Go to{' '}
                          <a href="https://console.cloud.google.com/apis/library/gmail.googleapis.com" target="_blank" rel="noopener noreferrer"
                            className="text-violet-600 font-bold underline inline-flex items-center gap-0.5">
                            Gmail API <ExternalLink className="h-3 w-3" />
                          </a>{' '}
                          and click <strong>Enable</strong>.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-black text-violet-600 shrink-0">③</span>
                        <span>
                          Open{' '}
                          <a href="https://console.cloud.google.com/auth/branding" target="_blank" rel="noopener noreferrer"
                            className="text-violet-600 font-bold underline inline-flex items-center gap-0.5">
                            OAuth consent screen <ExternalLink className="h-3 w-3" />
                          </a>{' '}
                          → choose <strong>External</strong> → fill in app name (<em>"JILD Sync"</em>), your email as support email and developer contact → save and continue through the steps.
                          On the <strong>Test users</strong> step, click <strong>Add Users</strong> and add your own Gmail address. Save.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-black text-violet-600 shrink-0">④</span>
                        <span>
                          Open{' '}
                          <a href="https://console.cloud.google.com/auth/clients" target="_blank" rel="noopener noreferrer"
                            className="text-violet-600 font-bold underline inline-flex items-center gap-0.5">
                            Credentials <ExternalLink className="h-3 w-3" />
                          </a>{' '}
                          → <strong>Create Client</strong> → application type <strong>Web application</strong> → name it <em>"JILD Sync"</em>.
                          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                            <p className="text-[11px] font-black text-amber-800 mb-1">Under "Authorized redirect URIs", add this exact URL:</p>
                            <div className="flex items-center gap-2 p-2 bg-white border border-amber-200 rounded-md">
                              <code className="flex-1 text-[10px] font-mono text-gray-700 break-all select-all">
                                {redirectUri || `${window.location.origin}/api/google/oauth/callback`}
                              </code>
                              <CopyChip text={redirectUri || `${window.location.origin}/api/google/oauth/callback`} />
                            </div>
                            <p className="text-[10px] text-amber-700 mt-1.5">
                              ⚠️ Must match <em>exactly</em>, including <code>https://</code> and no trailing slash.
                            </p>
                          </div>
                          Click <strong>Create</strong>. A popup shows your <strong>Client ID</strong> and <strong>Client Secret</strong>.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-black text-violet-600 shrink-0">⑤</span>
                        <span>
                          In Replit, click the <strong>🔒 Secrets</strong> icon and add these two secrets:
                          <div className="mt-2 space-y-1.5">
                            <div className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                              <code className="text-[11px] font-bold text-gray-700 shrink-0">GOOGLE_CLIENT_ID</code>
                              <span className="text-[11px] text-gray-500">= the Client ID from Google (ends in <code className="bg-white px-1 rounded">.apps.googleusercontent.com</code>)</span>
                            </div>
                            <div className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                              <code className="text-[11px] font-bold text-gray-700 shrink-0">GOOGLE_CLIENT_SECRET</code>
                              <span className="text-[11px] text-gray-500">= the Client Secret from Google (starts with <code className="bg-white px-1 rounded">GOCSPX-</code>)</span>
                            </div>
                          </div>
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-black text-violet-600 shrink-0">⑥</span>
                        <span>
                          The app restarts automatically. Click <strong>"Re-test"</strong> below — you should see "Client credentials saved" turn green, then move to Phase B.
                        </span>
                      </li>
                    </ol>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={testConnection}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-200 transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Re-test secrets
                      </button>
                      {hasClientCreds && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Client credentials saved
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ── Phase B: OAuth dance ── */}
                  <div className={`space-y-3 ${!hasClientCreds ? 'opacity-50 pointer-events-none' : ''}`}>
                    <p className="text-[12px] font-black text-gray-700 uppercase tracking-wide">
                      Phase B · Authorise Gmail access
                    </p>

                    {!hasClientCreds && (
                      <p className="text-[11px] text-gray-500 italic">Complete Phase A first to unlock this step.</p>
                    )}

                    <ol className="space-y-3 text-[12px] text-gray-700 leading-relaxed">
                      <li className="flex gap-2">
                        <span className="font-black text-violet-600 shrink-0">①</span>
                        <span>
                          Click the <strong>"Connect Google"</strong> button below — a new tab opens with Google's sign-in screen.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-black text-violet-600 shrink-0">②</span>
                        <span>
                          Sign in with the Gmail account you want to read invoices from.
                          You'll see a warning <em>"Google hasn't verified this app"</em> — that's normal because you just made the app yourself.
                          Click <strong>Advanced</strong> → <strong>Go to JILD Sync (unsafe)</strong>.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-black text-violet-600 shrink-0">③</span>
                        <span>
                          Approve the <strong>"Read your email"</strong> permission. Google redirects you back, and the page shows a long <strong>refresh token</strong>.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-black text-violet-600 shrink-0">④</span>
                        <span>
                          Copy that token and add a third Replit secret:
                          <div className="mt-2 flex items-start gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                            <code className="text-[11px] font-bold text-gray-700 shrink-0">GOOGLE_REFRESH_TOKEN</code>
                            <span className="text-[11px] text-gray-500">= the refresh token (starts with <code className="bg-white px-1 rounded">1//</code>)</span>
                          </div>
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-black text-violet-600 shrink-0">⑤</span>
                        <span>
                          Once saved, click <strong>"Test Gmail Connection"</strong> below. Green tick = done forever.
                        </span>
                      </li>
                    </ol>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={handleConnectGoogle}
                        disabled={!hasClientCreds}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 disabled:opacity-40 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Connect Google
                      </button>
                      <button
                        onClick={testImapConnection}
                        disabled={imapStatus === 'testing' || !hasClientCreds || needsRefresh}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-200 disabled:opacity-40 transition-colors"
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
                          <p className="text-xs font-bold text-emerald-800">
                            Gmail connected{imapEmail && <> as {imapEmail}</>} — PDF attachments will be read automatically
                          </p>
                          {imapInfo && <p className="text-[11px] text-emerald-700 mt-0.5">{imapInfo}</p>}
                        </div>
                      </div>
                    )}
                    {imapStatus === 'error' && (
                      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-2xl">
                        <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-red-700">Gmail connection failed</p>
                          {imapInfo && <p className="text-[11px] text-red-600 mt-0.5 break-words">{imapInfo}</p>}
                          <p className="text-[11px] text-red-600 mt-1">
                            Common fixes: ① Make sure all 3 secrets are saved correctly. ② If you re-ran the OAuth flow, generate a brand-new refresh token (revoke at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="underline">myaccount.google.com/permissions</a> first). ③ Confirm your Gmail address is added as a test user on the OAuth consent screen.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

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
