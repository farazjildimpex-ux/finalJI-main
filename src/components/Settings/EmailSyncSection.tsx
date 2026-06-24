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
import type { SyncResult, EmailScanResult } from '../../lib/emailSync';
import { fetchZohoEmails, syncEmailsWithLog } from '../../lib/emailSync';
import { supabase } from '../../lib/supabaseClient';

const OPENAI_KEY_STORAGE = 'jild_openai_key';
const OPENAI_MODEL_STORAGE = 'jild_openai_model';
const GOOGLE_KEY_STORAGE = 'jild_google_key';
const GOOGLE_MODEL_STORAGE = 'jild_google_model';
const PROVIDER_STORAGE = 'jild_ai_provider';

type Provider = 'google' | 'openai';

// Direct Google AI Studio models — free tier: 1,500 requests/day, native PDF reading.
const GOOGLE_MODELS = [
  { value: 'gemini-2.0-flash',      label: 'Gemini 2.0 Flash — fast, reads PDFs · recommended' },
  { value: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash — newer, reads PDFs' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite — lighter, faster' },
];

// OpenAI models. gpt-4o is excellent for PDFs/Vision.
const OPENAI_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini — very cheap, fast, great reasoning · recommended' },
  { value: 'gpt-4o',      label: 'GPT-4o — smartest model, best for complex invoices' },
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

type ZohoStatus = 'unknown' | 'testing' | 'ok' | 'missing' | 'error';
type MissingMap = { ZOHO_EMAIL_ADDRESS?: boolean; ZOHO_APP_PASSWORD?: boolean };

const EmailSyncSection: React.FC = () => {
  const [provider, setProvider] = useState<Provider>(
    () => (localStorage.getItem(PROVIDER_STORAGE) as Provider) || 'google'
  );
  const [googleKey, setGoogleKey] = useState<string>(
    () => localStorage.getItem(GOOGLE_KEY_STORAGE) || ''
  );
  const [googleModel, setGoogleModel] = useState<string>(
    () => localStorage.getItem(GOOGLE_MODEL_STORAGE) || 'gemini-2.0-flash'
  );
  const [openaiKey, setOpenaiKey] = useState<string>(
    () => localStorage.getItem(OPENAI_KEY_STORAGE) || ''
  );
  const [openaiModel, setOpenaiModel] = useState<string>(
    () => localStorage.getItem(OPENAI_MODEL_STORAGE) || 'gpt-4o-mini'
  );
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);



  const activeKey = provider === 'google' ? googleKey : openaiKey;

  const [showSetup, setShowSetup] = useState(false);

  const [gmailStatus, setGmailStatus] = useState<ZohoStatus>('unknown');
  const [missing, setMissing] = useState<MissingMap>({});
  const [redirectUri, setRedirectUri] = useState<string>('');

  const [imapStatus, setImapStatus] = useState<'unknown' | 'testing' | 'ok' | 'error'>('unknown');
  const [imapInfo, setImapInfo] = useState<string | null>(null);
  const [imapEmail, setImapEmail] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<'idle' | 'fetching' | 'analyzing' | 'saving' | 'done' | 'error'>('idle');
  const [results, setResults] = useState<SyncResult[] | null>(null);
  const [scans, setScans] = useState<EmailScanResult[] | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const created = results?.filter((r) => r.action === 'created').length ?? 0;
  const updated = results?.filter((r) => r.action === 'updated').length ?? 0;
  const skipped = results?.filter((r) => r.action === 'skipped').length ?? 0;

  const testConnection = useCallback(async () => {
    setGmailStatus('testing');
    try {
      const resp = await fetch('/api/zoho/test');
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
    setRedirectUri('');
  }, []);

  const testImapConnection = useCallback(async () => {
    setImapStatus('testing');
    setImapInfo(null);
    try {
      const resp = await fetch('/api/zoho/test-imap');
      const data = await resp.json();
      if (data.ok) {
        setImapStatus('ok');
        setImapEmail(data.email || null);
        setImapInfo(`${data.messagesLast7Days} message(s) with attachments in the last 7 days`);
        setGmailStatus('ok');
      } else {
        setImapStatus('error');
        setImapInfo(data.error || 'Zoho connection failed');
      }
    } catch (e: any) {
      setImapStatus('error');
      setImapInfo(e.message);
    }
  }, []);

  useEffect(() => { testConnection(); }, [testConnection]);

  // Once /api/zoho/test reports all secrets present, run the live Zoho
  // verification automatically so the "Action needed" badge clears without the
  // user having to remember to press the test button.
  useEffect(() => {
    if (gmailStatus === 'ok' && imapStatus === 'unknown') {
      testImapConnection();
    }
  }, [gmailStatus, imapStatus, testImapConnection]);

  const handleSaveKey = () => {
    localStorage.setItem(PROVIDER_STORAGE, provider);
    if (provider === 'google') {
      if (!googleKey.trim()) return;
      localStorage.setItem(GOOGLE_KEY_STORAGE, googleKey.trim());
      localStorage.setItem(GOOGLE_MODEL_STORAGE, googleModel);
    } else {
      if (!openaiKey.trim()) return;
      localStorage.setItem(OPENAI_KEY_STORAGE, openaiKey.trim());
      localStorage.setItem(OPENAI_MODEL_STORAGE, openaiModel);
    }
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  };

  const handleOpenaiModelChange = (model: string) => {
    setOpenaiModel(model);
    localStorage.setItem(OPENAI_MODEL_STORAGE, model);
  };

  const handleGoogleModelChange = (model: string) => {
    setGoogleModel(model);
    localStorage.setItem(GOOGLE_MODEL_STORAGE, model);
  };

  const handleProviderChange = (next: Provider) => {
    setProvider(next);
    localStorage.setItem(PROVIDER_STORAGE, next);
    setKeySaved(false);
  };

  const handleConnectGoogle = () => {};

  const handleSync = async () => {
    const key = activeKey.trim();
    if (!key) { setShowSetup(true); return; }
    if (gmailStatus !== 'ok') { setShowSetup(true); return; }
    if (provider === 'google') localStorage.setItem(GOOGLE_KEY_STORAGE, key);
    else localStorage.setItem(OPENAI_KEY_STORAGE, key);

    setRunning(true); setSyncError(null); setResults(null); setScans(null); setStage('fetching');
    try {
      const { emails } = await fetchZohoEmails();
      if (emails.length === 0) { setResults([]); setScans([]); setStage('done'); setShowResults(true); return; }
      setStage('analyzing');
      const { data: contracts } = await supabase.from('contracts').select('*');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in.');
      const scanResults = await syncEmailsWithLog(
        emails,
        contracts || [],
        { provider, apiKey: key },
        user.id,
      );
      const syncResults = scanResults.flatMap((s) => s.results);
      setScans(scanResults);
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
    stage === 'fetching' ? 'Connecting to Zoho and downloading emails…'
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
            <p className="text-xs text-gray-500">
              Scan Zoho mail (last 7 days) · AI extracts invoices · review &amp; approve before they're saved
            </p>
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
            <RefreshCw className="h-3 w-3 animate-spin" /> Checking Zoho connection…
          </div>
        )}
        {gmailStatus === 'ok' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700">
            <Wifi className="h-3.5 w-3.5" />
            Zoho connected · office@jildimpex.com
          </div>
        )}
        {(gmailStatus === 'missing' || gmailStatus === 'error' || gmailStatus === 'unknown') && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-700">
            <WifiOff className="h-3.5 w-3.5" />
            {gmailStatus === 'missing' ? 'Zoho not set up yet' : 'Zoho not connected'}
          </div>
        )}
        {imapStatus === 'ok' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Inbox ready
          </div>
        )}
        {imapStatus === 'error' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
            <AlertCircle className="h-3.5 w-3.5" /> Zoho login failed
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
            <div className="space-y-2">
              {(() => {
                const errored = scans?.filter((s) => s.status === 'error') ?? [];
                const empties = scans?.filter((s) => s.status === 'no_invoices') ?? [];
                return (
                  <>
                    {errored.length > 0 && (
                      <div className="p-3 bg-red-50 rounded-2xl border border-red-200 space-y-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                          <p className="text-xs font-bold text-red-700">
                            AI couldn't read {errored.length} email{errored.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                          {errored.map((s, i) => (
                            <div key={i} className="bg-white border border-red-100 rounded-lg p-2">
                              <p className="text-[11px] font-semibold text-gray-800 truncate">{s.email.subject || '(no subject)'}</p>
                              <p className="text-[10px] text-red-600 mt-0.5 break-words">{s.errorMessage}</p>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-red-600 leading-relaxed">
                          Try a different model in Setup &amp; Configuration below. Vision-capable models (Gemini, GPT-4o) are needed for scanned PDFs.
                        </p>
                      </div>
                    )}
                    {empties.length > 0 && errored.length === 0 && (
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-2xl border border-gray-200">
                        <Info className="h-4 w-4 text-gray-400 shrink-0" />
                        <p className="text-xs text-gray-600">
                          Scanned {empties.length} email{empties.length !== 1 ? 's' : ''} — AI didn't find any invoice data inside.
                        </p>
                      </div>
                    )}
                    {!errored.length && !empties.length && (
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-2xl border border-gray-200">
                        <Info className="h-4 w-4 text-gray-400 shrink-0" />
                        <p className="text-xs text-gray-600">No invoices found in emails from the last 7 days.</p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs font-semibold text-emerald-800 space-y-1">
                  <p>
                    Found{' '}
                    {created > 0 && <>{created} new invoice{created !== 1 ? 's' : ''} for review</>}
                    {skipped > 0 && created > 0 && ', '}
                    {skipped > 0 && <>{skipped} already in your records</>}
                    {updated > 0 && created === 0 && <>{updated} updated</>}
                    .
                  </p>
                  {created > 0 && (
                    <p className="text-[11px] font-normal text-emerald-700">
                      Open the Approvals page to review and approve them — nothing has been saved
                      to your records yet.
                    </p>
                  )}
                </div>
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

            {/* ① AI Provider + Key */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white text-[10px] font-black shrink-0">1</div>
                <p className="text-xs font-bold text-gray-800">AI Provider &amp; Key</p>
                {keySaved && <span className="text-[11px] text-emerald-600 font-bold">✓ Saved!</span>}
              </div>

              <div className="ml-7 space-y-3">
                {/* Provider toggle */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 rounded-xl">
                  <button
                    onClick={() => handleProviderChange('google')}
                    className={`px-3 py-2 text-[11px] font-bold rounded-lg transition-colors ${
                      provider === 'google' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Google AI Studio
                    <span className="block text-[9px] font-normal text-emerald-600 mt-0.5">Free · 1,500/day · recommended</span>
                  </button>
                  <button
                    onClick={() => handleProviderChange('openai')}
                    className={`px-3 py-2 text-[11px] font-bold rounded-lg transition-colors ${
                      provider === 'openai' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    OpenAI (GPT-4o)
                    <span className="block text-[9px] font-normal text-gray-500 mt-0.5">Paid · reliable · best reasoning</span>
                  </button>
                </div>

                {/* Google AI Studio block */}
                {provider === 'google' && (
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={googleKey}
                        onChange={(e) => { setGoogleKey(e.target.value); setKeySaved(false); }}
                        placeholder="AIzaSy..."
                        className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50"
                      />
                      <button onClick={() => setShowKey((v) => !v)} className="px-3 py-2 text-xs border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50">
                        {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={handleSaveKey}
                        disabled={!googleKey.trim()}
                        className={`px-3 py-2 text-xs font-bold rounded-xl transition-colors disabled:opacity-40 ${keySaved ? 'bg-emerald-500 text-white' : 'bg-violet-600 text-white hover:bg-violet-700'}`}
                      >
                        {keySaved ? '✓ Saved' : 'Save'}
                      </button>
                    </div>
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-violet-600 hover:underline">
                      Get a free Gemini API key at aistudio.google.com <ExternalLink className="h-3 w-3" />
                    </a>
                    <div className="mt-2">
                      <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Gemini Model</label>
                      <select
                        value={googleModel}
                        onChange={(e) => handleGoogleModelChange(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none bg-gray-50"
                      >
                        {GOOGLE_MODELS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                      <p className="text-[10px] text-emerald-800 leading-relaxed">
                        <strong>Why this is recommended:</strong> Google's free tier gives you 1,500 invoice extractions per day,
                        reads scanned PDFs natively, and has no rate-sharing with other users. The key starts with <code className="bg-white px-1 rounded">AIzaSy</code>.
                      </p>
                    </div>
                  </div>
                )}

                {/* OpenAI block */}
                {provider === 'openai' && (
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={openaiKey}
                        onChange={(e) => { setOpenaiKey(e.target.value); setKeySaved(false); }}
                        placeholder="sk-..."
                        className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50"
                      />
                      <button onClick={() => setShowKey((v) => !v)} className="px-3 py-2 text-xs border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50">
                        {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={handleSaveKey}
                        disabled={!openaiKey.trim()}
                        className={`px-3 py-2 text-xs font-bold rounded-xl transition-colors disabled:opacity-40 ${keySaved ? 'bg-emerald-500 text-white' : 'bg-violet-600 text-white hover:bg-violet-700'}`}
                      >
                        {keySaved ? '✓ Saved' : 'Save'}
                      </button>
                    </div>
                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-violet-600 hover:underline">
                      Get an OpenAI API key at platform.openai.com <ExternalLink className="h-3 w-3" />
                    </a>
                    <div className="mt-2">
                      <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">
                        OpenAI Model
                      </label>
                      <select
                        value={openaiModel}
                        onChange={(e) => handleOpenaiModelChange(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none bg-gray-50"
                      >
                        {OPENAI_MODELS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg">
                      <p className="text-[10px] text-blue-800 leading-relaxed">
                        <strong>Stable &amp; Smart:</strong> OpenAI is the industry leader for stability. GPT-4o-mini is
                        extremely cheap and fast, while GPT-4o is the smartest model for complex document layouts.
                        Requires pre-funding your account with min. $5.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ② Connect Zoho IMAP / SMTP */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white text-[10px] font-black shrink-0">2</div>
                <p className="text-xs font-bold text-gray-800">
                  Connect Zoho
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
                      <p className="text-xs font-bold text-emerald-800">Zoho is connected — you're all set!</p>
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
                      <strong>One-time setup using Zoho IMAP and SMTP.</strong> Add your Zoho mailbox address and app password,
                      then the app can read mail, extract attachments, and send mail without the old mail flow.
                    </p>
                  </div>

                  {/* ── Phase A: get OAuth credentials from Google Cloud ── */}
                  <div className="space-y-3">
                    <p className="text-[12px] font-black text-gray-700 uppercase tracking-wide">
                      Phase A · Add Zoho secrets
                    </p>

                    <ol className="space-y-3 text-[12px] text-gray-700 leading-relaxed">
                      <li className="flex gap-2">
                        <span className="font-black text-violet-600 shrink-0">①</span>
                        <span>
                          In Zoho Mail, create an <strong>app password</strong> for this app and copy it into Replit Secrets.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-black text-violet-600 shrink-0">②</span>
                        <span>
                          Add{' '}
                          <strong>ZOHO_EMAIL_ADDRESS</strong> and <strong>ZOHO_APP_PASSWORD</strong> in Replit Secrets.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-black text-violet-600 shrink-0">③</span>
                        <span>
                          Use the mailbox you want the app to read and send from. No extra project or consent screen is needed.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-black text-violet-600 shrink-0">④</span>
                        <span>
                          Make sure IMAP is enabled in Zoho settings so the app can scan your inbox.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-black text-violet-600 shrink-0">⑤</span>
                        <span>
                          In Replit, click the <strong>🔒 Secrets</strong> icon and add these two secrets:
                          <div className="mt-2 space-y-1.5">
                            <div className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                              <code className="text-[11px] font-bold text-gray-700 shrink-0">ZOHO_EMAIL_ADDRESS</code>
                              <span className="text-[11px] text-gray-500">= your Zoho email address</span>
                            </div>
                            <div className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                              <code className="text-[11px] font-bold text-gray-700 shrink-0">ZOHO_APP_PASSWORD</code>
                              <span className="text-[11px] text-gray-500">= the app password from Zoho Mail</span>
                            </div>
                          </div>
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-black text-violet-600 shrink-0">⑥</span>
                        <span>
                          The app restarts automatically. Click <strong>"Re-test"</strong> below — you should see the secret check turn green, then move to Phase B.
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
                      Phase B · Test Zoho mailbox access
                    </p>

                    {!hasClientCreds && (
                      <p className="text-[11px] text-gray-500 italic">Complete Phase A first to unlock this step.</p>
                    )}

                    <ol className="space-y-3 text-[12px] text-gray-700 leading-relaxed">
                      <li className="flex gap-2">
                        <span className="font-black text-violet-600 shrink-0">①</span>
                        <span>
                          Click the <strong>"Re-test connection"</strong> button below to confirm the Zoho mailbox is reachable.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-black text-violet-600 shrink-0">②</span>
                        <span>
                          Use the Zoho mailbox that you want the app to read and send from.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-black text-violet-600 shrink-0">③</span>
                        <span>
                          The app will read messages over IMAP and send mail over SMTP with your Zoho app password.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-black text-violet-600 shrink-0">④</span>
                        <span>
                          No extra OAuth token is needed.
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-black text-violet-600 shrink-0">⑤</span>
                        <span>
                          Once saved, click <strong>"Test Zoho Connection"</strong> below. Green tick = done forever.
                        </span>
                      </li>
                    </ol>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={testImapConnection}
                        disabled={imapStatus === 'testing' || !hasClientCreds || needsRefresh}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 disabled:opacity-40 transition-colors"
                      >
                        {imapStatus === 'testing'
                          ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Testingâ€¦</>
                          : <><ExternalLink className="h-3.5 w-3.5" /> Re-test connection</>
                        }
                      </button>
                      <button
                        onClick={testImapConnection}
                        disabled={imapStatus === 'testing' || !hasClientCreds || needsRefresh}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-200 disabled:opacity-40 transition-colors"
                      >
                        {imapStatus === 'testing'
                          ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Testing…</>
                          : <><Wifi className="h-3.5 w-3.5" /> Test Zoho Connection</>
                        }
                      </button>
                    </div>

                    {imapStatus === 'ok' && (
                      <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-emerald-800">
                            Zoho connected{imapEmail && <> as {imapEmail}</>} — PDF attachments will be read automatically
                          </p>
                          {imapInfo && <p className="text-[11px] text-emerald-700 mt-0.5">{imapInfo}</p>}
                        </div>
                      </div>
                    )}
                    {imapStatus === 'error' && (
                      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-2xl">
                        <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-red-700">Zoho connection failed</p>
                          {imapInfo && <p className="text-[11px] text-red-600 mt-0.5 break-words">{imapInfo}</p>}
                          <p className="text-[11px] text-red-600 mt-1">
                            Common fixes: ① Make sure the two Zoho secrets are saved correctly. ② Confirm IMAP is enabled in Zoho Mail. ③ Make sure the mailbox password is an app password.
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
