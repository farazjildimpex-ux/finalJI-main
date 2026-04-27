import React, { useState } from 'react';
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
  Info,
} from 'lucide-react';
import { runEmailSync } from '../../lib/emailSync';
import type { SyncResult } from '../../lib/emailSync';

const OPENROUTER_KEY_STORAGE = 'jild_openrouter_key';

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

const EmailSyncSection: React.FC = () => {
  const [openRouterKey, setOpenRouterKey] = useState<string>(
    () => localStorage.getItem(OPENROUTER_KEY_STORAGE) || ''
  );
  const [showKey, setShowKey] = useState(false);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<
    'idle' | 'fetching' | 'analyzing' | 'saving' | 'done' | 'error'
  >('idle');
  const [results, setResults] = useState<SyncResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const created = results?.filter((r) => r.action === 'created').length || 0;
  const updated = results?.filter((r) => r.action === 'updated').length || 0;
  const skipped = results?.filter((r) => r.action === 'skipped').length || 0;

  const handleSync = async () => {
    if (!openRouterKey.trim()) {
      setShowSetup(true);
      return;
    }

    localStorage.setItem(OPENROUTER_KEY_STORAGE, openRouterKey.trim());
    setRunning(true);
    setError(null);
    setResults(null);
    setStage('fetching');

    try {
      setStage('fetching');
      await new Promise((r) => setTimeout(r, 300));

      const syncResults = await (async () => {
        const { fetchZohoEmails, analyzeEmailsWithAI, upsertInvoices } = await import(
          '../../lib/emailSync'
        );
        const { supabase } = await import('../../lib/supabaseClient');

        setStage('fetching');
        const { emails, total } = await fetchZohoEmails();

        if (emails.length === 0) {
          return [];
        }

        setStage('analyzing');
        const { data: contracts } = await supabase.from('contracts').select('*');
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('You must be signed in.');

        const extracted = await analyzeEmailsWithAI(
          emails,
          contracts || [],
          openRouterKey.trim()
        );

        if (extracted.length === 0) return [];

        setStage('saving');
        return upsertInvoices(extracted, user.id);
      })();

      setResults(syncResults);
      setStage('done');
      setShowResults(true);
    } catch (err: any) {
      setError(err?.message || 'An unknown error occurred.');
      setStage('error');
    } finally {
      setRunning(false);
    }
  };

  const stageLabel =
    stage === 'fetching'
      ? 'Fetching emails from Zoho Mail…'
      : stage === 'analyzing'
      ? 'AI is analyzing emails & attachments…'
      : stage === 'saving'
      ? 'Saving to database…'
      : '';

  const isZohoConfigured =
    !!import.meta.env.VITE_SUPABASE_URL;

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header row */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-violet-50">
            <Mail className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Auto Invoice Sync</p>
            <p className="text-xs text-gray-500">
              Scan Zoho Mail for invoices · AI fills in details automatically
            </p>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50 shadow-sm shadow-violet-100"
        >
          {running ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Zap className="h-3.5 w-3.5" />
          )}
          {running ? 'Syncing…' : 'Sync Now'}
        </button>
      </div>

      {/* Progress */}
      {running && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 p-3 bg-violet-50 rounded-2xl border border-violet-100">
            <RefreshCw className="h-4 w-4 text-violet-600 animate-spin shrink-0" />
            <p className="text-xs font-semibold text-violet-800">{stageLabel}</p>
          </div>
          <div className="mt-2 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-700"
              style={{
                width:
                  stage === 'fetching'
                    ? '30%'
                    : stage === 'analyzing'
                    ? '65%'
                    : stage === 'saving'
                    ? '90%'
                    : '100%',
              }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {stage === 'error' && error && (
        <div className="px-4 pb-4">
          <div className="flex gap-3 p-3 bg-red-50 border border-red-200 rounded-2xl">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-red-700">Sync failed</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Done summary */}
      {stage === 'done' && results !== null && (
        <div className="px-4 pb-4 space-y-3">
          {results.length === 0 ? (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-2xl border border-gray-200">
              <Info className="h-4 w-4 text-gray-400 shrink-0" />
              <p className="text-xs text-gray-600">
                No invoices found in emails from the last 7 days.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <p className="text-xs font-semibold text-emerald-800">
                  Sync complete —{' '}
                  {created > 0 && <span>{created} created</span>}
                  {created > 0 && updated > 0 && ', '}
                  {updated > 0 && <span>{updated} updated</span>}
                  {skipped > 0 && ` (${skipped} skipped)`}
                </p>
              </div>
              <button
                onClick={() => setShowResults((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-bold text-gray-700 transition-colors"
              >
                View detailed results ({results.length})
                {showResults ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              {showResults && (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {results.map((r, i) => (
                    <div
                      key={i}
                      className="p-3 bg-white border border-gray-200 rounded-xl space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-gray-900 truncate">
                          {r.invoice_number}
                        </span>
                        <StatusBadge action={r.action} />
                      </div>
                      {r.contract_numbers?.length > 0 && (
                        <p className="text-[11px] text-gray-500">
                          Contract:{' '}
                          <span className="font-semibold text-gray-700">
                            {r.contract_numbers.join(', ')}
                          </span>
                        </p>
                      )}
                      {r.action === 'skipped' && r.reason && (
                        <p className="text-[11px] text-red-500">{r.reason}</p>
                      )}
                      {r.invoice.line_items?.length > 0 && (
                        <div className="text-[11px] text-gray-500">
                          {r.invoice.line_items.map((li, j) => (
                            <span key={j} className="inline-block mr-2">
                              {li.color}{li.selection ? ` (${li.selection})` : ''}: {li.quantity} sqft
                            </span>
                          ))}
                        </div>
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

      {/* API Key + Setup collapsible */}
      <div className="border-t border-gray-100">
        <button
          onClick={() => setShowSetup((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-xs text-gray-500 font-medium"
        >
          <span>API Key & Setup Instructions</span>
          {showSetup ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>

        {showSetup && (
          <div className="px-4 pb-4 space-y-4">
            {/* OpenRouter Key */}
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">
                OpenRouter API Key
              </label>
              <div className="flex gap-2">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={openRouterKey}
                  onChange={(e) => setOpenRouterKey(e.target.value)}
                  placeholder="sk-or-..."
                  className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 bg-gray-50"
                />
                <button
                  onClick={() => setShowKey((v) => !v)}
                  className="px-3 py-2 text-xs border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50"
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem(OPENROUTER_KEY_STORAGE, openRouterKey.trim());
                    setShowSetup(false);
                  }}
                  className="px-3 py-2 text-xs bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700"
                >
                  Save
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Stored locally in your browser only. Get your key at{' '}
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-600 underline"
                >
                  openrouter.ai/keys
                </a>
              </p>
            </div>

            {/* Zoho setup instructions */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
              <p className="text-xs font-bold text-amber-800">
                Zoho Mail Setup (one-time)
              </p>
              <ol className="text-[11px] text-amber-800 space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>
                  Go to{' '}
                  <a
                    href="https://api-console.zoho.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold"
                  >
                    api-console.zoho.com
                  </a>{' '}
                  and sign in.
                </li>
                <li>
                  Click <strong>Add Client</strong> → choose{' '}
                  <strong>Self Client</strong>.
                </li>
                <li>
                  Copy the <strong>Client ID</strong> and{' '}
                  <strong>Client Secret</strong>.
                </li>
                <li>
                  Click <strong>Generate Code</strong>. In the scope field enter:{' '}
                  <code className="bg-amber-100 px-1 rounded text-[10px]">
                    ZohoMail.messages.READ,ZohoMail.accounts.READ
                  </code>
                  . Set expiry to <strong>10 minutes</strong>. Copy the code.
                </li>
                <li>
                  Run this in your terminal (or use Postman) to get a refresh token:
                  <pre className="mt-1 p-2 bg-white rounded text-[10px] font-mono whitespace-pre-wrap border border-amber-200">
{`curl -X POST "https://accounts.zoho.com/oauth/v2/token" \\
  -d "code=YOUR_CODE" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET" \\
  -d "redirect_uri=https://www.zoho.com" \\
  -d "grant_type=authorization_code"`}
                  </pre>
                </li>
                <li>
                  Add these 3 Replit Secrets:
                  <ul className="ml-3 mt-1 space-y-0.5 list-disc list-inside">
                    <li>
                      <code className="bg-amber-100 px-1 rounded text-[10px]">
                        ZOHO_CLIENT_ID
                      </code>
                    </li>
                    <li>
                      <code className="bg-amber-100 px-1 rounded text-[10px]">
                        ZOHO_CLIENT_SECRET
                      </code>
                    </li>
                    <li>
                      <code className="bg-amber-100 px-1 rounded text-[10px]">
                        ZOHO_REFRESH_TOKEN
                      </code>{' '}
                      (from the response above)
                    </li>
                  </ul>
                </li>
                <li>
                  Click <strong>Sync Now</strong> above — that's it!
                </li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailSyncSection;
