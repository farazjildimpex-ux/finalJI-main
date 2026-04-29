import React, { useCallback, useEffect, useState } from 'react';
import {
  History,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Mail,
  Paperclip,
  FileText,
  Trash2,
  Info,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface ScanLogRow {
  id: string;
  scanned_at: string;
  email_subject: string;
  email_from: string;
  email_date: string | null;
  body_chars: number;
  attachments: { name: string; type: string; chars: number }[];
  extracted_invoices: any[];
  sync_results: { invoice_number: string; contract_numbers: string[]; action: 'created' | 'updated' | 'skipped'; reason?: string | null }[];
  status: 'no_invoices' | 'success' | 'partial' | 'error';
  error_message: string | null;
}

const StatusPill: React.FC<{ status: ScanLogRow['status'] }> = ({ status }) => {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Saved
      </span>
    );
  }
  if (status === 'partial') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-700">
        <AlertCircle className="h-3 w-3" /> Partial
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-700">
        <XCircle className="h-3 w-3" /> Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-gray-100 text-gray-500">
      <Info className="h-3 w-3" /> No invoice
    </span>
  );
};

const ActionPill: React.FC<{ action: 'created' | 'updated' | 'skipped' }> = ({ action }) => {
  const map = {
    created: 'bg-emerald-100 text-emerald-700',
    updated: 'bg-blue-100 text-blue-700',
    skipped: 'bg-gray-100 text-gray-500',
  } as const;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${map[action]}`}>
      {action}
    </span>
  );
};

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const EmailScanHistory: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ScanLogRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [missingTable, setMissingTable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('email_scan_log')
        .select('*')
        .order('scanned_at', { ascending: false })
        .limit(50);
      if (fetchError) {
        const msg = fetchError.message || '';
        if (/relation .*email_scan_log.* does not exist/i.test(msg) || /Could not find the table/i.test(msg)) {
          setMissingTable(true);
          setRows([]);
        } else {
          throw fetchError;
        }
      } else {
        setMissingTable(false);
        setRows((data || []) as ScanLogRow[]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load scan history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && rows === null) load();
  }, [open, rows, load]);

  useEffect(() => {
    const handler = () => { if (open) load(); else setRows(null); };
    window.addEventListener('jild-email-scan-log-refresh', handler);
    return () => window.removeEventListener('jild-email-scan-log-refresh', handler);
  }, [open, load]);

  const handleClearAll = async () => {
    if (!rows || rows.length === 0) return;
    if (!window.confirm(`Delete all ${rows.length} scan log entries? This cannot be undone.`)) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('email_scan_log').delete().eq('user_id', user.id);
      setRows([]);
      setExpandedId(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to clear log');
    }
  };

  const handleDeleteOne = async (id: string) => {
    try {
      await supabase.from('email_scan_log').delete().eq('id', id);
      setRows((prev) => (prev || []).filter((r) => r.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete entry');
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-50">
            <History className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-gray-900">Scanned emails history</p>
            <p className="text-xs text-gray-500">See what was processed in the last few syncs</p>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            {rows && rows.length > 0 && (
              <button
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-red-50 hover:bg-red-100 text-red-600"
              >
                <Trash2 className="h-3 w-3" /> Clear all
              </button>
            )}
          </div>

          {missingTable && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-800 leading-relaxed">
              <p className="font-bold mb-1">One-time database setup needed</p>
              <p>Open your Supabase project → SQL Editor and run the migration file{' '}
                <code className="bg-white border border-amber-200 px-1.5 py-0.5 rounded text-[10px]">
                  supabase/migrations/20260429173000_create_email_scan_log.sql
                </code>{' '}
                from this repo. After that, click Refresh and the scan history will appear here automatically.
              </p>
            </div>
          )}

          {error && !missingTable && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-[11px] text-red-700">{error}</div>
          )}

          {!error && !missingTable && rows && rows.length === 0 && !loading && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-2xl border border-gray-200">
              <Info className="h-4 w-4 text-gray-400 shrink-0" />
              <p className="text-xs text-gray-600">No scans yet. Run "Sync Now" to populate this list.</p>
            </div>
          )}

          {rows && rows.length > 0 && (
            <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
              {rows.map((r) => {
                const isOpen = expandedId === r.id;
                return (
                  <div key={r.id} className="border border-gray-200 rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setExpandedId(isOpen ? null : r.id)}
                      className="w-full text-left p-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            <span className="text-xs font-bold text-gray-900 truncate">
                              {r.email_subject || '(no subject)'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap text-[11px] text-gray-500">
                            <span className="truncate max-w-[180px]">{r.email_from}</span>
                            <span>·</span>
                            <span>{formatTimeAgo(r.scanned_at)}</span>
                            {r.attachments.length > 0 && (
                              <>
                                <span>·</span>
                                <span className="inline-flex items-center gap-0.5">
                                  <Paperclip className="h-3 w-3" /> {r.attachments.length}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <StatusPill status={r.status} />
                          {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-gray-100 bg-gray-50 p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <p className="text-gray-400 font-bold uppercase text-[9px]">Email date</p>
                            <p className="text-gray-700">{r.email_date ? new Date(r.email_date).toLocaleString() : '—'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 font-bold uppercase text-[9px]">Body length</p>
                            <p className="text-gray-700">{r.body_chars.toLocaleString()} chars</p>
                          </div>
                        </div>

                        {r.attachments.length > 0 && (
                          <div>
                            <p className="text-[10px] font-black text-gray-500 uppercase mb-1.5">Attachments</p>
                            <div className="space-y-1">
                              {r.attachments.map((a, i) => (
                                <div key={i} className="flex items-center gap-2 text-[11px] bg-white px-2 py-1.5 rounded-lg border border-gray-200">
                                  <FileText className="h-3 w-3 text-gray-400 shrink-0" />
                                  <span className="font-medium text-gray-700 truncate flex-1">{a.name}</span>
                                  <span className="text-gray-400 shrink-0">{a.type} · {a.chars.toLocaleString()} chars</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {r.error_message && (
                          <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700">
                            <p className="font-bold mb-0.5">Error</p>
                            <p className="break-words">{r.error_message}</p>
                          </div>
                        )}

                        {r.sync_results.length > 0 ? (
                          <div>
                            <p className="text-[10px] font-black text-gray-500 uppercase mb-1.5">
                              Invoices found ({r.sync_results.length})
                            </p>
                            <div className="space-y-1.5">
                              {r.sync_results.map((s, i) => (
                                <div key={i} className="bg-white border border-gray-200 rounded-xl p-2.5 space-y-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-gray-900 truncate">{s.invoice_number}</span>
                                    <ActionPill action={s.action} />
                                  </div>
                                  {s.contract_numbers && s.contract_numbers.length > 0 && (
                                    <p className="text-[10px] text-gray-500">
                                      Contract{s.contract_numbers.length > 1 ? 's' : ''}:{' '}
                                      <span className="font-semibold text-gray-700">{s.contract_numbers.join(', ')}</span>
                                    </p>
                                  )}
                                  {s.reason && (
                                    <p className="text-[10px] text-red-500">{s.reason}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          r.status === 'no_invoices' && (
                            <p className="text-[11px] text-gray-500 italic">
                              The AI didn't find any invoice in this email.
                            </p>
                          )
                        )}

                        <div className="flex justify-end pt-1 border-t border-gray-200">
                          <button
                            onClick={() => handleDeleteOne(r.id)}
                            className="inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3 w-3" /> Delete entry
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmailScanHistory;
