import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Plus, Search, X, ChevronRight, AlertCircle, FileText, Bookmark, Receipt,
} from 'lucide-react';
import RecentOrdersList from './RecentOrdersList';
import JournalWidget from './JournalWidget';
import JournalEntryForm from '../Journal/JournalEntryForm';
import JournalEntryPopup from '../Journal/JournalEntryPopup';
import PullToRefresh from '../UI/PullToRefresh';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import type { Order, JournalEntry } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { suggestJournalLink } from '../../lib/journalAI';
import { dialogService } from '../../lib/dialogService';

/* ─── helpers ──────────────────────────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatFullDate() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

/* ─── filter config ────────────────────────────────────────────── */
const FILTERS = [
  { label: 'All',       value: 'all',        activeClass: 'bg-gray-800 text-white border-gray-800',       inactiveClass: 'bg-white text-gray-600 border-gray-200' },
  { label: 'Open',      value: 'open',       activeClass: 'bg-amber-500 text-white border-amber-500',     inactiveClass: 'bg-white text-amber-700 border-amber-200' },
  { label: 'Contracts', value: 'contract',   activeClass: 'bg-indigo-600 text-white border-indigo-600',   inactiveClass: 'bg-white text-indigo-700 border-indigo-200' },
  { label: 'Letters',   value: 'sample',     activeClass: 'bg-blue-600 text-white border-blue-600',       inactiveClass: 'bg-white text-blue-700 border-blue-200' },
  { label: 'Payments',  value: 'debit_note', activeClass: 'bg-emerald-600 text-white border-emerald-600', inactiveClass: 'bg-white text-emerald-700 border-emerald-200' },
];

const TYPE_ICON: Record<string, React.FC<{ className?: string }>> = {
  contract:   FileText,
  sample:     Bookmark,
  debit_note: Receipt,
};

const TYPE_DOT: Record<string, string> = {
  contract:   'bg-indigo-500',
  sample:     'bg-purple-400',
  debit_note: 'bg-emerald-500',
};

const STATUS_BADGE: Record<string, string> = {
  issued:    'text-blue-700 bg-blue-50 border border-blue-100',
  inspected: 'text-amber-700 bg-amber-50 border border-amber-100',
  open:      'text-amber-700 bg-amber-50 border border-amber-100',
  completed: 'text-emerald-700 bg-emerald-50 border border-emerald-100',
  delivered: 'text-emerald-700 bg-emerald-50 border border-emerald-100',
};

const OPEN_STATUSES = ['Issued', 'Inspected'];
const JOURNAL_PAGE_SIZE = 12;

/* ─── component ────────────────────────────────────────────────── */
const HomePage: React.FC = () => {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /* ui state */
  const [showSearch,    setShowSearch]    = useState(false);
  const [searchTerm,    setSearchTerm]    = useState('');
  const [mobileFilter,  setMobileFilter]  = useState('all');
  const [desktopFilter, setDesktopFilter] = useState('all');
  const [desktopSearch, setDesktopSearch] = useState('');
  const [desktopJournalPage, setDesktopJournalPage] = useState(1);

  /* data state */
  const [orders,         setOrders]         = useState<Order[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [journalLoading, setJournalLoading] = useState(true);
  const [error,          setError]          = useState<string | null>(null);

  /* modal state */
  const [editingEntry,          setEditingEntry]          = useState<JournalEntry | null>(null);
  const [selectedEntryForPopup, setSelectedEntryForPopup] = useState<JournalEntry | null>(null);
  const [isMobileFormOpen,      setIsMobileFormOpen]      = useState(false);
  const [isDesktopFormOpen,     setIsDesktopFormOpen]     = useState(false);

  /* ── fetch ─────────────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    try {
      setLoading(true); setError(null);
      const [cR, sR, dR] = await Promise.all([
        supabase.from('contracts').select('*').order('contract_date',    { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200),
        supabase.from('samples').select('*').order('date',               { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200),
        supabase.from('debit_notes').select('*').order('debit_note_date',{ ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200),
      ]);
      if (cR.error) throw cR.error;
      if (sR.error) throw sR.error;
      if (dR.error) throw dR.error;

      const contracts:  Order[] = (cR.data || []).map(c => ({ id: c.id,  contractNumber: c.contract_no,   supplierName: c.supplier_name, article: c.article,            color: c.color?.join(', ') || '', date: c.contract_date,    createdAt: c.created_at, status: c.status, type: 'contract',   contractData: c }));
      const samples:    Order[] = (sR.data || []).map(s => ({ id: s.id!, contractNumber: s.sample_number, supplierName: s.supplier_name, article: s.description || '',   color: s.company_name || '',      date: s.date,             createdAt: s.created_at, status: s.status, type: 'sample',    sampleData: s }));
      const debitNotes: Order[] = (dR.data || []).map(d => ({ id: d.id!, contractNumber: d.debit_note_no, supplierName: d.supplier_name, article: d.contract_no || '',   color: d.invoice_no || '',        date: d.debit_note_date,  createdAt: d.created_at, status: d.status, type: 'debit_note', debitNoteData: d }));

      const ms = (v?: string | null) => v ? new Date(v).getTime() : 0;
      setOrders([...contracts, ...samples, ...debitNotes].sort((a, b) => {
        const d = ms((b as any).date) - ms((a as any).date);
        return d !== 0 ? d : ms((b as any).createdAt) - ms((a as any).createdAt);
      }));
    } catch (e) { console.error(e); setError('Failed to load data.'); }
    finally { setLoading(false); }
  }, []);

  const fetchJournalEntries = useCallback(async () => {
    if (!user || !isSupabaseConfigured) { setJournalLoading(false); return; }
    try {
      setJournalLoading(true);
      const { data, error } = await supabase
        .from('journal_entries').select('*')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: false });
      if (error) throw error;
      setJournalEntries(data || []);
    } catch (e) { console.error(e); }
    finally { setJournalLoading(false); }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (user) fetchJournalEntries(); }, [user, fetchJournalEntries]);

  /* deep-link from notification */
  useEffect(() => {
    const entryId = searchParams.get('entry');
    if (!entryId || journalLoading) return;
    const found = journalEntries.find(e => e.id === entryId);
    if (found) { setSelectedEntryForPopup(found); setSearchParams({}, { replace: true }); }
    else {
      supabase.from('journal_entries').select('*').eq('id', entryId).maybeSingle().then(({ data }) => {
        if (data) setSelectedEntryForPopup(data as JournalEntry);
        setSearchParams({}, { replace: true });
      });
    }
  }, [searchParams, journalEntries, journalLoading]);

  /* ── derived ───────────────────────────────────────────────────── */
  const activityList = useMemo(() => {
    if (mobileFilter === 'open') return orders.filter(o => OPEN_STATUSES.includes(o.status || ''));
    if (mobileFilter !== 'all')  return orders.filter(o => o.type === mobileFilter);
    return orders;
  }, [orders, mobileFilter]);

  const desktopOrders = useMemo(() => {
    let list = desktopFilter === 'all' ? orders
      : desktopFilter === 'open' ? orders.filter(o => OPEN_STATUSES.includes(o.status || ''))
      : orders.filter(o => o.type === desktopFilter);
    if (desktopSearch.trim()) {
      const s = desktopSearch.toLowerCase();
      list = list.filter(o =>
        o.contractNumber.toLowerCase().includes(s) || o.supplierName.toLowerCase().includes(s) ||
        o.article.toLowerCase().includes(s) || o.color.toLowerCase().includes(s)
      );
    }
    return list;
  }, [orders, desktopFilter, desktopSearch]);

  const searchOrderResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const s = searchTerm.toLowerCase();
    return orders.filter(o =>
      o.contractNumber.toLowerCase().includes(s) || o.supplierName.toLowerCase().includes(s) ||
      o.article.toLowerCase().includes(s)
    ).slice(0, 20);
  }, [orders, searchTerm]);

  const searchJournalResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const s = searchTerm.toLowerCase();
    return journalEntries.filter(e =>
      e.title.toLowerCase().includes(s) || (e.content && e.content.toLowerCase().includes(s))
    ).slice(0, 8);
  }, [journalEntries, searchTerm]);

  /* ── handlers ──────────────────────────────────────────────────── */
  const handlePullRefresh = useCallback(async () => {
    await Promise.all([fetchData(), fetchJournalEntries()]);
  }, [fetchData, fetchJournalEntries]);

  const goToOrder = useCallback((order: Order) => {
    if (order.type === 'contract')    navigate(`/app/contracts/${order.id}`,   { state: { contract:  order.contractData  } });
    else if (order.type === 'sample') navigate(`/app/samples/${order.id}`,     { state: { sample:    order.sampleData    } });
    else                              navigate(`/app/debit-notes/${order.id}`,  { state: { debitNote: order.debitNoteData } });
  }, [navigate]);

  const handleJournalSave = useCallback(async (savedEntry?: JournalEntry) => {
    setIsMobileFormOpen(false);
    setIsDesktopFormOpen(false);
    setEditingEntry(null);
    fetchJournalEntries();
    if (savedEntry && !savedEntry.parent_id) {
      const tenDaysAgo = new Date(); tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      const past = journalEntries.filter(e => e.id !== savedEntry.id && new Date(e.entry_date) >= tenDaysAgo);
      if (past.length > 0) {
        dialogService.toast({ message: 'AI is looking for related entries…', durationMs: 2000 });
        const sg = await suggestJournalLink(savedEntry, past);
        if (sg.suggested_parent_id) {
          const parent = past.find(e => e.id === sg.suggested_parent_id);
          if (parent) {
            const link = await dialogService.confirm({ title: 'Link Journal Entry?', message: `AI noticed this entry is related to: "${parent.title}".\n\nReason: ${sg.reasoning}\n\nLink them?`, confirmLabel: 'Link Entries' });
            if (link) { await supabase.from('journal_entries').update({ parent_id: parent.id }).eq('id', savedEntry.id); fetchJournalEntries(); dialogService.success('Entries linked.'); }
          }
        }
      }
    }
  }, [journalEntries, fetchJournalEntries]);

  if (!isSupabaseConfigured) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Configuration Required</h2>
        <p className="text-gray-600">Please connect your Supabase project.</p>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ━━━━━━━━━━━━━━━━━━━━━━  MOBILE  ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="md:hidden bg-gray-50 min-h-screen" style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}>
        <PullToRefresh onRefresh={handlePullRefresh}>

          {/* ── Header — same design language as desktop ── */}
          <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold leading-tight">
                  <span className="text-gray-900">JILD </span>
                  <span className="text-blue-600">IMPEX</span>
                </p>
                <h1 className="text-xl font-bold text-gray-900 mt-0.5 leading-tight">{getGreeting()} 👋</h1>
                <p className="text-[12px] text-gray-400 mt-1">{formatFullDate()}</p>
              </div>
              <button
                onClick={() => { setShowSearch(true); setSearchTerm(''); }}
                className="w-10 h-10 shrink-0 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center mt-0.5 active:bg-gray-100 transition-colors"
              >
                <Search className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* ── Journal section — mirrors desktop left panel ── */}
          <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Panel header — same as desktop */}
            <div className="px-4 pt-3 pb-2.5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Journal</h2>
              <button
                onClick={() => { setEditingEntry(null); setIsMobileFormOpen(true); }}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-[11px] font-bold rounded-lg hover:bg-blue-700 active:bg-blue-700 transition-colors"
              >
                <Plus className="h-3 w-3" /> New Entry
              </button>
            </div>
            {/* JournalWidget — full functionality: date nav, all entries, swipe, edit, delete */}
            <div className="p-3">
              <JournalWidget
                entries={journalEntries}
                loading={journalLoading}
                onEntriesUpdated={fetchJournalEntries}
                hideHeader
              />
            </div>
          </div>

          {/* ── Recent Activity — mirrors desktop right panel ── */}
          <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Panel header */}
            <div className="px-4 pt-3 pb-2.5 border-b border-gray-100">
              <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2.5">Recent Activity</h2>
              {/* Filter pills — horizontal scroll, same style as desktop */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setMobileFilter(f.value)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all shrink-0 ${
                      mobileFilter === f.value ? f.activeClass : f.inactiveClass
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div className="mx-3 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-[12px]">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="flex-1">{error}</span>
                <button onClick={fetchData} className="font-bold underline">Retry</button>
              </div>
            )}

            {/* Orders list */}
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin h-5 w-5 rounded-full border-2 border-gray-200 border-b-blue-600" />
              </div>
            ) : activityList.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-[13px] text-gray-400">No records found</p>
              </div>
            ) : (
              <div>
                {activityList.slice(0, 20).map((order, idx) => {
                  const dot  = TYPE_DOT[order.type]  || 'bg-gray-400';
                  const sk   = (order.status || 'issued').toLowerCase();
                  const badge = STATUS_BADGE[sk] || 'text-gray-600 bg-gray-50 border border-gray-200';
                  return (
                    <button
                      key={`${order.type}-${order.id}`}
                      onClick={() => goToOrder(order)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 transition-colors ${idx > 0 ? 'border-t border-gray-50' : ''}`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-gray-900 truncate leading-snug">{order.contractNumber}</p>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{order.supplierName}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${badge}`}>
                          {order.status || 'Issued'}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </PullToRefresh>
      </div>

      {/* ── Search overlay ─────────────────────────────────────────── */}
      {showSearch && (
        <div className="md:hidden fixed inset-0 z-[200] bg-white flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom,0px)' }}>
          {/* Input row */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
            <button
              onClick={() => { setShowSearch(false); setSearchTerm(''); }}
              className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 active:bg-gray-200"
            >
              <X className="h-4 w-4 text-gray-600" />
            </button>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                autoFocus type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search contracts, journal…"
                className="w-full h-10 pl-9 pr-8 bg-gray-100 rounded-xl text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1">
                  <X className="h-3.5 w-3.5 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
            {!searchTerm.trim() ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mb-4 shadow-sm">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <p className="text-[14px] font-bold text-gray-700 mb-1">Search everything</p>
                <p className="text-[12px] text-gray-400">Contracts, letters, payments, journal</p>
              </div>
            ) : searchOrderResults.length === 0 && searchJournalResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-[14px] font-bold text-gray-700 mb-1">No results</p>
                <p className="text-[12px] text-gray-400">Try a different search term</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {searchOrderResults.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">
                      Records ({searchOrderResults.length})
                    </p>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      {searchOrderResults.map((order, idx) => {
                        const dot   = TYPE_DOT[order.type] || 'bg-gray-400';
                        const sk    = (order.status || 'issued').toLowerCase();
                        const badge = STATUS_BADGE[sk] || 'text-gray-600 bg-gray-50 border border-gray-200';
                        return (
                          <button
                            key={`sr-${order.type}-${order.id}`}
                            onClick={() => { goToOrder(order); setShowSearch(false); setSearchTerm(''); }}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 ${idx > 0 ? 'border-t border-gray-50' : ''}`}
                          >
                            <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-bold text-gray-900 truncate">{order.contractNumber}</p>
                              <p className="text-[11px] text-gray-400 truncate">{order.supplierName}</p>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${badge}`}>{order.status || 'Issued'}</span>
                            <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {searchJournalResults.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">
                      Journal ({searchJournalResults.length})
                    </p>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      {searchJournalResults.map((entry, idx) => (
                        <button
                          key={`sj-${entry.id}`}
                          onClick={() => { setSelectedEntryForPopup(entry); setShowSearch(false); setSearchTerm(''); }}
                          className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 ${idx > 0 ? 'border-t border-gray-50' : ''}`}
                        >
                          <span className="w-2 h-2 rounded-full shrink-0 bg-indigo-400" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold text-gray-900 truncate">{entry.title}</p>
                            <p className="text-[11px] text-gray-400">
                              {new Date(entry.entry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile journal form */}
      {isMobileFormOpen && (
        <JournalEntryForm
          initialDate={editingEntry ? new Date(editingEntry.entry_date) : new Date()}
          initialEntry={editingEntry}
          onClose={() => { setIsMobileFormOpen(false); setEditingEntry(null); }}
          onSave={handleJournalSave}
        />
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━  DESKTOP  ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="hidden md:flex flex-col h-full page-fade-in">

        {/* Desktop header */}
        <div className="shrink-0 bg-white border-b border-gray-100 px-6 pt-4 pb-3">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-2xl font-bold leading-tight">
                <span className="text-gray-900">JILD </span>
                <span className="text-blue-600">IMPEX </span>
                <span className="text-gray-900">Management</span>
              </p>
              <h1 className="text-xl font-bold text-gray-900 leading-tight mt-0.5">{getGreeting()} 👋</h1>
              <p className="text-[12px] text-gray-400 mt-1">{formatFullDate()}</p>
            </div>
            <div className="shrink-0 pt-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text" value={desktopSearch} onChange={e => setDesktopSearch(e.target.value)}
                  placeholder="Search orders & journal…"
                  className="h-9 pl-8 pr-3 w-72 text-[13px] bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Desktop split panel */}
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* LEFT: Journal */}
          <div className="w-[360px] shrink-0 border-r border-gray-100 flex flex-col bg-white overflow-hidden">
            <div className="px-4 pt-3 pb-2.5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Journal</h2>
              <button
                onClick={() => setIsDesktopFormOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-[11px] font-bold rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-3 w-3" /> New Entry
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pt-3 flex flex-col">
              {desktopSearch.trim() ? (() => {
                const s = desktopSearch.toLowerCase();
                const matched = journalEntries.filter(e => e.title.toLowerCase().includes(s) || (e.content && e.content.toLowerCase().includes(s)));
                const total = Math.max(1, Math.ceil(matched.length / JOURNAL_PAGE_SIZE));
                const pg    = Math.min(desktopJournalPage, total);
                const slice = matched.slice((pg - 1) * JOURNAL_PAGE_SIZE, pg * JOURNAL_PAGE_SIZE);
                return (
                  <div className="flex flex-col flex-1 min-h-0">
                    {matched.length === 0 ? (
                      <p className="text-[12px] text-gray-400 text-center py-6">No entries match "{desktopSearch}"</p>
                    ) : (
                      <>
                        <div className="space-y-2 pb-3">
                          {slice.map(entry => (
                            <div key={entry.id}
                              className="rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm cursor-pointer hover:border-blue-200 transition-colors"
                              onClick={() => setSelectedEntryForPopup(entry)}>
                              <p className="text-[13px] font-bold text-gray-800 line-clamp-1">{entry.title}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {new Date(entry.entry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                              {entry.content && <p className="text-[12px] text-gray-500 mt-1 line-clamp-2">{entry.content}</p>}
                            </div>
                          ))}
                        </div>
                        {total > 1 && (
                          <div className="flex items-center justify-between pt-1 pb-3 border-t border-gray-100 mt-auto shrink-0">
                            <p className="text-[11px] text-gray-400">{(pg-1)*JOURNAL_PAGE_SIZE+1}–{Math.min(pg*JOURNAL_PAGE_SIZE, matched.length)} of {matched.length}</p>
                            <div className="flex gap-1">
                              <button onClick={() => setDesktopJournalPage(p => Math.max(1, p-1))} disabled={pg===1} className="px-2.5 py-1 rounded-lg text-[11px] bg-gray-100 text-gray-600 disabled:opacity-30 hover:bg-gray-200">‹ Prev</button>
                              <button onClick={() => setDesktopJournalPage(p => Math.min(total, p+1))} disabled={pg===total} className="px-2.5 py-1 rounded-lg text-[11px] bg-gray-100 text-gray-600 disabled:opacity-30 hover:bg-gray-200">Next ›</button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })() : (
                <JournalWidget entries={journalEntries} loading={journalLoading} onEntriesUpdated={fetchJournalEntries} hideHeader />
              )}
            </div>
          </div>

          {/* RIGHT: Recent Activity */}
          <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">
            <div className="px-4 pt-3 pb-2.5 border-b border-gray-100 bg-white shrink-0">
              <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Recent Activity</h2>
              <div className="flex gap-1.5 flex-wrap">
                {FILTERS.map(f => (
                  <button key={f.value} onClick={() => setDesktopFilter(f.value)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all ${desktopFilter === f.value ? f.activeClass : f.inactiveClass}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center text-red-700 text-sm">
                  <AlertCircle className="h-5 w-5 mr-3 shrink-0" />{error}
                  <button onClick={fetchData} className="ml-auto font-bold underline">Retry</button>
                </div>
              )}
              <RecentOrdersList orders={desktopOrders} loading={loading} onStatusChange={fetchData} />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop journal form */}
      {isDesktopFormOpen && (
        <JournalEntryForm
          initialDate={new Date()} initialEntry={null}
          onClose={() => setIsDesktopFormOpen(false)}
          onSave={handleJournalSave}
        />
      )}

      {/* Journal popup — both layouts */}
      {selectedEntryForPopup && (
        <JournalEntryPopup
          entry={selectedEntryForPopup} allEntries={journalEntries}
          onClose={() => setSelectedEntryForPopup(null)}
          onUpdate={fetchJournalEntries}
        />
      )}
    </>
  );
};

export default HomePage;
