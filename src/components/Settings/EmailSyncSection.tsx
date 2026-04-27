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
  Copy,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  Key,
  ArrowRight,
  Info,
  Sparkles,
  Globe,
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

const ZOHO_REGIONS = [
  { value: 'in',     label: '🇮🇳  India',        hint: 'You sign in at mail.zoho.in or zoho.in' },
  { value: 'com',    label: '🌎  US / Global',   hint: 'You sign in at mail.zoho.com or zoho.com' },
  { value: 'eu',     label: '🇪🇺  Europe',        hint: 'You sign in at mail.zoho.eu or zoho.eu' },
  { value: 'com.au', label: '🇦🇺  Australia',     hint: 'You sign in at mail.zoho.com.au' },
  { value: 'jp',     label: '🇯🇵  Japan',         hint: 'You sign in at mail.zoho.jp' },
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
    >
      <Copy className="h-3 w-3" />
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

type ZohoStatus = 'unknown' | 'testing' | 'ok' | 'missing' | 'error';

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

  // Wizard state
  const [showSetup, setShowSetup] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardRegion, setWizardRegion] = useState('in'); // default India — most likely
  const [wizardClientId, setWizardClientId] = useState('');
  const [wizardClientSecret, setWizardClientSecret] = useState('');
  const [wizardCode, setWizardCode] = useState('');
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [returnedRegion, setReturnedRegion] = useState<string>('in');

  // Connection status
  const [zohoStatus, setZohoStatus] = useState<ZohoStatus>('unknown');
  const [zohoEmail, setZohoEmail] = useState<string | null>(null);

  // Sync state
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<'idle' | 'fetching' | 'analyzing' | 'saving' | 'done' | 'error'>('idle');
  const [results, setResults] = useState<SyncResult[] | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const created = results?.filter((r) => r.action === 'created').length ?? 0;
  const updated = results?.filter((r) => r.action === 'updated').length ?? 0;
  const skipped = results?.filter((r) => r.action === 'skipped').length ?? 0;

  // ── test Zoho connection ─────────────────────────────────────────────────
  const testConnection = useCallback(async () => {
    setZohoStatus('testing');
    setZohoEmail(null);
    try {
      const resp = await fetch('/api/zoho/test');
      const data = await resp.json();
      if (data.connected) {
        setZohoStatus('ok');
        setZohoEmail(data.email || null);
      } else if (data.reason === 'missing_secrets') {
        setZohoStatus('missing');
      } else {
        setZohoStatus('error');
      }
    } catch {
      setZohoStatus('error');
    }
  }, []);

  useEffect(() => { testConnection(); }, [testConnection]);

  // ── wizard: exchange code for token ─────────────────────────────────────
  const handleExchangeToken = async () => {
    if (!wizardClientId.trim() || !wizardClientSecret.trim() || !wizardCode.trim()) {
      setWizardError('Please fill in all three fields.');
      return;
    }
    setWizardLoading(true);
    setWizardError(null);
    try {
      const resp = await fetch('/api/zoho/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: wizardClientId.trim(),
          client_secret: wizardClientSecret.trim(),
          code: wizardCode.trim(),
          region: wizardRegion,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setWizardError(data.error || 'Connection failed.');
        return;
      }
      setRefreshToken(data.refresh_token);
      setReturnedRegion(data.region || wizardRegion);
      setWizardStep(3);
    } catch (err: any) {
      setWizardError(err.message || 'Unexpected error');
    } finally {
      setWizardLoading(false);
    }
  };

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
    if (zohoStatus !== 'ok') {
      setShowSetup(true);
      return;
    }
    localStorage.setItem(OPENROUTER_KEY_STORAGE, openRouterKey.trim());
    setRunning(true);
    setSyncError(null);
    setResults(null);
    setStage('fetching');
    try {
      const { fetchZohoEmails, analyzeEmailsWithAI, upsertInvoices } = await import('../../lib/emailSync');
      const { supabase } = await import('../../lib/supabaseClient');
      const { emails } = await fetchZohoEmails();
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
    stage === 'fetching' ? 'Connecting to Zoho Mail and downloading emails…'
    : stage === 'analyzing' ? 'AI is reading emails & attachments for invoice data…'
    : stage === 'saving' ? 'Saving invoices to database…'
    : '';

  const regionLabel = ZOHO_REGIONS.find(r => r.value === wizardRegion)?.label || wizardRegion;

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
            <p className="text-xs text-gray-500">Scan Zoho Mail (last 7 days) · AI fills invoice details automatically</p>
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
        {zohoStatus === 'testing' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500">
            <RefreshCw className="h-3 w-3 animate-spin" /> Checking Zoho connection…
          </div>
        )}
        {zohoStatus === 'ok' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700">
            <Wifi className="h-3.5 w-3.5" />
            Zoho Mail connected{zohoEmail && <span className="opacity-70">· {zohoEmail}</span>}
          </div>
        )}
        {(zohoStatus === 'missing' || zohoStatus === 'error' || zohoStatus === 'unknown') && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-700">
            <WifiOff className="h-3.5 w-3.5" />
            {zohoStatus === 'missing' ? 'Zoho not set up yet' : 'Zoho not connected'}
          </div>
        )}
        {zohoStatus !== 'testing' && (
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
            {zohoStatus !== 'ok' && (
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

            {/* ② Connect Zoho */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white text-[10px] font-black shrink-0">2</div>
                <p className="text-xs font-bold text-gray-800">
                  Connect Zoho Mail
                  {zohoStatus === 'ok'
                    ? <span className="ml-2 text-emerald-600 font-semibold">✓ Connected</span>
                    : <span className="ml-2 text-amber-600 font-normal">(one-time setup)</span>}
                </p>
              </div>

              {zohoStatus === 'ok' ? (
                <div className="ml-7 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-emerald-800">Zoho Mail is connected — you're all set!</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">You never need to repeat this. Click "Sync Now" any time.</p>
                  </div>
                </div>
              ) : (
                <div className="ml-7 space-y-4">

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex gap-2">
                    <Sparkles className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      <strong>One-time setup — about 5 minutes.</strong> After this, just click "Sync Now" anytime and it works automatically.
                    </p>
                  </div>

                  {/* Progress dots */}
                  <div className="flex gap-1">
                    {([1, 2, 3] as const).map((s) => (
                      <div key={s} className={`flex-1 h-1 rounded-full ${wizardStep >= s ? 'bg-violet-500' : 'bg-gray-200'}`} />
                    ))}
                  </div>

                  {/* ── Step 1: Region + Client ID/Secret ── */}
                  {wizardStep === 1 && (
                    <div className="space-y-4">
                      <p className="text-xs font-bold text-gray-700">Step 1 of 3 — Get your Zoho API credentials</p>

                      {/* Region picker — MOST IMPORTANT */}
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-black text-amber-800">
                          <Globe className="h-3.5 w-3.5" />
                          First: which Zoho region are you in?
                        </div>
                        <p className="text-[11px] text-amber-700">Check your Zoho email address or what website you log into Zoho on.</p>
                        <div className="grid grid-cols-1 gap-1.5 mt-1">
                          {ZOHO_REGIONS.map((r) => (
                            <label key={r.value} className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${wizardRegion === r.value ? 'bg-violet-50 border-violet-400' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                              <input
                                type="radio"
                                name="zohoRegion"
                                value={r.value}
                                checked={wizardRegion === r.value}
                                onChange={() => setWizardRegion(r.value)}
                                className="mt-0.5 accent-violet-600"
                              />
                              <div>
                                <p className="text-[12px] font-bold text-gray-800">{r.label}</p>
                                <p className="text-[10px] text-gray-500">{r.hint}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      <ol className="space-y-3 text-[12px] text-gray-700 leading-relaxed">
                        <li className="flex gap-2">
                          <span className="font-black text-violet-600 shrink-0">①</span>
                          <span>
                            Open{' '}
                            <a href={`https://api-console.zoho.${wizardRegion}/`} target="_blank" rel="noopener noreferrer"
                              className="text-violet-600 font-bold underline inline-flex items-center gap-0.5">
                              api-console.zoho.{wizardRegion} <ExternalLink className="h-3 w-3" />
                            </a>{' '}
                            in a new tab and sign in with your Zoho account.
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-black text-violet-600 shrink-0">②</span>
                          <span>Click <strong>"Add Client"</strong> → choose <strong>"Self Client"</strong> (the last option).</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-black text-violet-600 shrink-0">③</span>
                          <span>You'll see a <strong>Client ID</strong> and <strong>Client Secret</strong>. Copy them and paste below.</span>
                        </li>
                      </ol>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Client ID</label>
                          <input value={wizardClientId} onChange={(e) => setWizardClientId(e.target.value)}
                            placeholder="1000.XXXXXXXXXXXXXXXX..."
                            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none bg-gray-50" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Client Secret</label>
                          <input value={wizardClientSecret} onChange={(e) => setWizardClientSecret(e.target.value)}
                            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            type="password"
                            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none bg-gray-50" />
                        </div>
                      </div>

                      <button
                        onClick={() => { if (wizardClientId && wizardClientSecret) setWizardStep(2); }}
                        disabled={!wizardClientId.trim() || !wizardClientSecret.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 disabled:opacity-40 transition-colors"
                      >
                        Next <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* ── Step 2: Generate code ── */}
                  {wizardStep === 2 && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-gray-700">Step 2 of 3 — Generate a one-time code in Zoho</p>

                      <div className="p-2 bg-violet-50 border border-violet-200 rounded-xl text-[11px] text-violet-800 font-semibold">
                        Region selected: {regionLabel}
                      </div>

                      <ol className="space-y-3 text-[12px] text-gray-700 leading-relaxed">
                        <li className="flex gap-2">
                          <span className="font-black text-violet-600 shrink-0">①</span>
                          <span>On the Zoho API Console page, click the <strong>"Generate Code"</strong> tab at the top of your Self Client.</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-black text-violet-600 shrink-0">②</span>
                          <span>
                            In the <strong>Scope</strong> box, paste this exactly:
                            <div className="mt-1.5 flex items-center gap-2 p-2 bg-gray-100 rounded-lg font-mono text-[10px] break-all">
                              ZohoMail.messages.READ,ZohoMail.accounts.READ
                              <CopyButton text="ZohoMail.messages.READ,ZohoMail.accounts.READ" />
                            </div>
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-black text-violet-600 shrink-0">③</span>
                          <span>Set <strong>Time Duration</strong> to <strong>10 minutes</strong>, then click <strong>"Create"</strong>.</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-black text-violet-600 shrink-0">④</span>
                          <span>A popup shows a code. <strong>Copy it immediately</strong> (it expires in 10 min) and paste below.</span>
                        </li>
                      </ol>

                      <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Paste the code here</label>
                        <input value={wizardCode} onChange={(e) => setWizardCode(e.target.value)}
                          placeholder="1000.xxxxxxxxxxxxxxxxxxxx..."
                          className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none bg-gray-50" />
                      </div>

                      {wizardError && (
                        <div className="flex gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold mb-0.5">{wizardError}</p>
                            <p className="text-red-600 leading-relaxed">
                              Common fixes: ① Code expires in 10 min — go back to Zoho and generate a fresh one. ② Check your Client ID &amp; Secret are correct — click Back to re-enter them. ③ Make sure you chose the correct region above.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button onClick={() => { setWizardStep(1); setWizardError(null); setWizardCode(''); }}
                          className="px-3 py-2 text-xs border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
                          ← Back
                        </button>
                        <button onClick={handleExchangeToken} disabled={wizardLoading || !wizardCode.trim()}
                          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 disabled:opacity-40 transition-colors">
                          {wizardLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                          {wizardLoading ? 'Connecting…' : 'Connect Zoho'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Step 3: Save secrets ── */}
                  {wizardStep === 3 && refreshToken && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-gray-700">Step 3 of 3 — Save 3 secrets in Replit</p>

                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <p className="text-[12px] text-emerald-800 font-semibold">
                          Zoho connected successfully! Now save the values below as Replit Secrets — this is the last step.
                        </p>
                      </div>

                      <p className="text-[12px] text-gray-600 leading-relaxed">
                        In Replit, click the <strong>🔒 lock icon</strong> in the left sidebar (Secrets), then add these three secrets:
                      </p>

                      {[
                        { name: 'ZOHO_CLIENT_ID', value: wizardClientId, label: 'Your Client ID from Step 1' },
                        { name: 'ZOHO_CLIENT_SECRET', value: wizardClientSecret, label: 'Your Client Secret from Step 1' },
                        { name: 'ZOHO_REGION', value: returnedRegion, label: `Your Zoho region (${regionLabel})` },
                      ].map(({ name, value, label }) => (
                        <div key={name} className="p-3 bg-gray-100 rounded-xl">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] font-black text-gray-500 uppercase">{name}</span>
                            <CopyButton text={value} />
                          </div>
                          <p className="font-mono text-[11px] text-gray-700 break-all">{value}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
                        </div>
                      ))}

                      <div className="p-3 bg-gray-100 rounded-xl">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] font-black text-gray-500 uppercase">ZOHO_REFRESH_TOKEN</span>
                          <CopyButton text={refreshToken} />
                        </div>
                        <p className="font-mono text-[11px] text-gray-700 break-all">{refreshToken}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Your long-lived token (never expires)</p>
                      </div>

                      <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-2xl flex gap-2 mt-1">
                        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-blue-800 leading-relaxed">
                          After adding all 4 secrets, the app restarts automatically. Come back here and click <strong>"Re-test"</strong> — it should say "Zoho Mail connected". <strong>You never need to do this again.</strong>
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
