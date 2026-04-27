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
} from 'lucide-react';
import type { SyncResult } from '../../lib/emailSync';

const OPENROUTER_KEY_STORAGE = 'jild_openrouter_key';

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

// ─── types ─────────────────────────────────────────────────────────────────
type ZohoStatus = 'unknown' | 'testing' | 'ok' | 'missing' | 'error';

// ─── main component ────────────────────────────────────────────────────────
const EmailSyncSection: React.FC = () => {
  // OpenRouter key (stored in localStorage — not sensitive enough to need a secret)
  const [openRouterKey, setOpenRouterKey] = useState<string>(
    () => localStorage.getItem(OPENROUTER_KEY_STORAGE) || ''
  );
  const [showKey, setShowKey] = useState(false);

  // Zoho setup wizard state
  const [showSetup, setShowSetup] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wizardClientId, setWizardClientId] = useState('');
  const [wizardClientSecret, setWizardClientSecret] = useState('');
  const [wizardCode, setWizardCode] = useState('');
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  // Zoho connection status
  const [zohoStatus, setZohoStatus] = useState<ZohoStatus>('unknown');
  const [zohoEmail, setZohoEmail] = useState<string | null>(null);
  const [zohoError, setZohoError] = useState<string | null>(null);

  // Sync state
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<'idle' | 'fetching' | 'analyzing' | 'saving' | 'done' | 'error'>('idle');
  const [results, setResults] = useState<SyncResult[] | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const created = results?.filter((r) => r.action === 'created').length ?? 0;
  const updated = results?.filter((r) => r.action === 'updated').length ?? 0;
  const skipped = results?.filter((r) => r.action === 'skipped').length ?? 0;

  // ── test Zoho connection ──────────────────────────────────────────────────
  const testConnection = useCallback(async () => {
    setZohoStatus('testing');
    setZohoError(null);
    setZohoEmail(null);
    try {
      const resp = await fetch('/api/zoho/test');
      const data = await resp.json();
      if (data.connected) {
        setZohoStatus('ok');
        setZohoEmail(data.email || null);
      } else if (data.reason === 'missing_secrets') {
        setZohoStatus('missing');
        setZohoError(data.message);
      } else {
        setZohoStatus('error');
        setZohoError(data.message || 'Connection failed');
      }
    } catch {
      setZohoStatus('error');
      setZohoError('Could not reach the API server. Make sure the app has restarted after saving secrets.');
    }
  }, []);

  // Auto-test on first load
  useEffect(() => {
    testConnection();
  }, [testConnection]);

  // ── wizard: exchange code for token ──────────────────────────────────────
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
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setWizardError(data.error || 'Token exchange failed. The code may have expired — generate a new one.');
        return;
      }
      setRefreshToken(data.refresh_token);
      setWizardStep(3);
    } catch (err: any) {
      setWizardError(err.message || 'Unexpected error');
    } finally {
      setWizardLoading(false);
    }
  };

  // ── run email sync ────────────────────────────────────────────────────────
  const handleSync = async () => {
    if (!openRouterKey.trim()) {
      setShowSetup(true);
      return;
    }
    if (zohoStatus !== 'ok') {
      alert('Please connect Zoho Mail first using the setup wizard below.');
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
      if (emails.length === 0) {
        setResults([]);
        setStage('done');
        setShowResults(true);
        return;
      }

      setStage('analyzing');
      const { data: contracts } = await supabase.from('contracts').select('*');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in.');

      const extracted = await analyzeEmailsWithAI(emails, contracts || [], openRouterKey.trim());
      if (extracted.length === 0) {
        setResults([]);
        setStage('done');
        setShowResults(true);
        return;
      }

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

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">

      {/* ── Top header ────────────────────────────────────────────── */}
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

      {/* ── Zoho connection status badge ─────────────────────────── */}
      <div className="px-4 pb-4 flex items-center gap-3">
        {zohoStatus === 'testing' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500">
            <RefreshCw className="h-3 w-3 animate-spin" /> Checking Zoho connection…
          </div>
        )}
        {zohoStatus === 'ok' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700">
            <Wifi className="h-3.5 w-3.5" />
            Zoho Mail connected
            {zohoEmail && <span className="opacity-70">· {zohoEmail}</span>}
          </div>
        )}
        {(zohoStatus === 'missing' || zohoStatus === 'error' || zohoStatus === 'unknown') && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-700">
            <WifiOff className="h-3.5 w-3.5" />
            {zohoStatus === 'missing' ? 'Zoho not set up yet' : 'Zoho connection failed'}
          </div>
        )}
        {zohoStatus !== 'testing' && (
          <button
            onClick={testConnection}
            className="text-[11px] text-gray-400 hover:text-gray-600 underline"
          >
            Re-test
          </button>
        )}
      </div>

      {/* ── Sync progress bar ────────────────────────────────────── */}
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

      {/* ── Sync error ───────────────────────────────────────────── */}
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

      {/* ── Sync results ─────────────────────────────────────────── */}
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
                View details ({results.length} invoice{results.length !== 1 ? 's' : ''})
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
                        <p className="text-[11px] text-gray-500">
                          Contract: <span className="font-semibold text-gray-700">{r.contract_numbers.join(', ')}</span>
                        </p>
                      )}
                      {r.action === 'skipped' && r.reason && (
                        <p className="text-[11px] text-red-500">{r.reason}</p>
                      )}
                      {r.invoice.line_items?.length > 0 && (
                        <p className="text-[11px] text-gray-500">
                          {r.invoice.line_items.map((li, j) => (
                            <span key={j} className="mr-2">
                              {li.color}{li.selection ? ` (${li.selection})` : ''}: {li.quantity} sqft
                            </span>
                          ))}
                        </p>
                      )}
                      {(r.invoice.bill_type || r.invoice.bill_number) && (
                        <p className="text-[11px] text-blue-600 font-medium">
                          {r.invoice.bill_type} {r.invoice.bill_number}
                          {r.invoice.shipping_date && ` · ${r.invoice.shipping_date}`}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Collapsible setup panel ───────────────────────────────── */}
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

            {/* ── 1 · OpenRouter Key ─────────────────────────────────── */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white text-[10px] font-black shrink-0">1</div>
                <p className="text-xs font-bold text-gray-800">OpenRouter AI Key <span className="text-gray-400 font-normal">(powers the invoice extraction)</span></p>
              </div>
              <div className="ml-7 space-y-1.5">
                <div className="flex gap-2">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={openRouterKey}
                    onChange={(e) => setOpenRouterKey(e.target.value)}
                    placeholder="sk-or-..."
                    className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50"
                  />
                  <button onClick={() => setShowKey((v) => !v)} className="px-3 py-2 text-xs border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50">
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => { localStorage.setItem(OPENROUTER_KEY_STORAGE, openRouterKey.trim()); }}
                    className="px-3 py-2 text-xs bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700"
                  >
                    Save
                  </button>
                </div>
                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-violet-600 hover:underline">
                  Get a free key at openrouter.ai <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* ── 2 · Zoho Setup Wizard ──────────────────────────────── */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white text-[10px] font-black shrink-0">2</div>
                <p className="text-xs font-bold text-gray-800">
                  Connect Zoho Mail
                  {zohoStatus === 'ok'
                    ? <span className="ml-2 text-emerald-600 font-semibold">✓ Connected</span>
                    : <span className="ml-2 text-amber-600 font-semibold">· Setup required (one-time only)</span>}
                </p>
              </div>

              {zohoStatus === 'ok' ? (
                <div className="ml-7 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-emerald-800">Zoho Mail is connected — you're all set!</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      You <strong>never</strong> need to do this again. The connection stays active automatically.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="ml-7 space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex gap-2">
                    <Sparkles className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      This is a <strong>one-time setup</strong> — takes about 3 minutes. Once done, you just click "Sync Now" anytime and it works automatically. No repeating needed.
                    </p>
                  </div>

                  {/* Step tabs */}
                  <div className="flex gap-1">
                    {([1, 2, 3] as const).map((s) => (
                      <div key={s} className={`flex-1 h-1 rounded-full ${wizardStep >= s ? 'bg-violet-500' : 'bg-gray-200'}`} />
                    ))}
                  </div>

                  {/* ── Wizard Step 1: Get Client ID + Secret ─── */}
                  {wizardStep === 1 && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-gray-700">Step 1 of 3 — Get your Zoho API credentials</p>

                      <ol className="space-y-3 text-[12px] text-gray-700 leading-relaxed">
                        <li className="flex gap-2">
                          <span className="font-black text-violet-600 shrink-0">①</span>
                          <span>
                            Open{' '}
                            <a href="https://api-console.zoho.com/" target="_blank" rel="noopener noreferrer"
                              className="text-violet-600 font-bold underline inline-flex items-center gap-0.5">
                              api-console.zoho.com <ExternalLink className="h-3 w-3" />
                            </a>{' '}
                            in a new tab and sign in with your Zoho account.
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-black text-violet-600 shrink-0">②</span>
                          <span>Click the big <strong>"Add Client"</strong> button.</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-black text-violet-600 shrink-0">③</span>
                          <span>Choose <strong>"Self Client"</strong> (the last option on the page).</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-black text-violet-600 shrink-0">④</span>
                          <span>You will now see a <strong>Client ID</strong> and <strong>Client Secret</strong>. Copy both and paste them below.</span>
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

                  {/* ── Wizard Step 2: Generate Code ─────────── */}
                  {wizardStep === 2 && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-gray-700">Step 2 of 3 — Generate a one-time code in Zoho</p>

                      <ol className="space-y-3 text-[12px] text-gray-700 leading-relaxed">
                        <li className="flex gap-2">
                          <span className="font-black text-violet-600 shrink-0">①</span>
                          <span>
                            On the Zoho API Console page, click the <strong>"Generate Code"</strong> tab (at the top of your Self Client).
                          </span>
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
                          <span>Set <strong>Time Duration</strong> to <strong>10 minutes</strong>.</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-black text-violet-600 shrink-0">④</span>
                          <span>Click <strong>"Create"</strong>. A popup will appear with a code. <strong>Copy that code</strong> and paste it below immediately (it expires in 10 min).</span>
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
                            <p className="text-red-600">
                              Common fixes: ① The code expires in 10 minutes — go back to Zoho and generate a fresh code, then try again. ② Make sure your Client ID and Client Secret are correct (go back to Step 1 to re-enter them).
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button onClick={() => { setWizardStep(1); setWizardError(null); }}
                          className="px-3 py-2 text-xs border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
                          Back
                        </button>
                        <button onClick={handleExchangeToken} disabled={wizardLoading || !wizardCode.trim()}
                          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 disabled:opacity-40 transition-colors">
                          {wizardLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                          {wizardLoading ? 'Connecting…' : 'Connect Zoho'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Wizard Step 3: Save refresh token as secret ── */}
                  {wizardStep === 3 && refreshToken && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-gray-700">Step 3 of 3 — Save the token as a Replit Secret</p>

                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <p className="text-[12px] text-emerald-800 font-semibold">
                          Successfully connected to Zoho! Now save the token below as a Replit Secret — this is the last step.
                        </p>
                      </div>

                      <ol className="space-y-3 text-[12px] text-gray-700 leading-relaxed">
                        <li className="flex gap-2">
                          <span className="font-black text-violet-600 shrink-0">①</span>
                          <span>
                            Copy your <strong>Client ID</strong> and <strong>Client Secret</strong> (from step 1) and add them as Replit Secrets named <code className="bg-gray-100 px-1 rounded text-[11px]">ZOHO_CLIENT_ID</code> and <code className="bg-gray-100 px-1 rounded text-[11px]">ZOHO_CLIENT_SECRET</code>.
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-black text-violet-600 shrink-0">②</span>
                          <span>Copy the <strong>Refresh Token</strong> below:</span>
                        </li>
                      </ol>

                      <div className="p-3 bg-gray-100 rounded-xl">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black text-gray-500 uppercase">ZOHO_REFRESH_TOKEN</span>
                          <CopyButton text={refreshToken} />
                        </div>
                        <p className="font-mono text-[11px] text-gray-700 break-all">{refreshToken}</p>
                      </div>

                      <div className="space-y-2 text-[12px] text-gray-700 leading-relaxed">
                        <p className="flex gap-2">
                          <span className="font-black text-violet-600 shrink-0">③</span>
                          <span>In Replit, click the <strong>lock icon 🔒</strong> in the left sidebar (Secrets), then add a new secret: Name = <code className="bg-gray-100 px-1 rounded text-[11px]">ZOHO_REFRESH_TOKEN</code>, Value = the token you copied above.</span>
                        </p>
                        <p className="flex gap-2">
                          <span className="font-black text-violet-600 shrink-0">④</span>
                          <span>The app will restart automatically. Come back here and click <strong>"Re-test"</strong> — you should see "Zoho Mail connected".</span>
                        </p>
                      </div>

                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex gap-2 mt-2">
                        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-blue-800 leading-relaxed">
                          <strong>You never need to do this again.</strong> The refresh token doesn't expire. Every time you click "Sync Now", the app automatically gets a fresh connection to Zoho behind the scenes.
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
