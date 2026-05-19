import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronRight, FileText, Bookmark, Receipt, X, BookOpen, PenLine } from 'lucide-react';
import RecentOrdersList from './RecentOrdersList';
import JournalWidget from './JournalWidget';
import JournalEntryForm from '../Journal/JournalEntryForm';
import JournalEntryPopup from '../Journal/JournalEntryPopup';
import PullToRefresh from '../UI/PullToRefresh';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { AlertCircle } from 'lucide-react';
import type { Order, JournalEntry } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { suggestJournalLink } from '../../lib/journalAI';
import { dialogService } from '../../lib/dialogService';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getFirstName(user: { email?: string; user_metadata?: { full_name?: string; name?: string } } | null) {
  if (!user) return '';
  const full = user.user_metadata?.full_name || user.user_metadata?.name || '';
  if (full) return full.split(' ')[0];
  return user.email?.split('@')[0] || '';
}

function formatToday() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

const DESKTOP_FILTERS = [
  { label: 'All',       value: 'all',       activeClass: 'bg-gray-800 text-white border-gray-800',      inactiveClass: 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'   },
  { label: 'Open',      value: 'open',      activeClass: 'bg-amber-500 text-white border-amber-500',    inactiveClass: 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400' },
  { label: 'Contracts', value: 'contract',  activeClass: 'bg-indigo-600 text-white border-indigo-600',  inactiveClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:border-indigo-400' },
  { label: 'Letters',   value: 'sample',    activeClass: 'bg-blue-600 text-white border-blue-600',      inactiveClass: 'bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-400'   },
  { label: 'Payments',  value: 'debit_note',activeClass: 'bg-emerald-600 text-white border-emerald-600',inactiveClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400' },
];

const MOBILE_ACTIVITY_FILTERS = [
  { label: 'All',       value: 'all',        pillActive: 'bg-gray-900 text-white border-gray-900',                   pillInactive: 'bg-white text-gray-500 border-gray-200'                       },
  { label: 'Open',      value: 'open',       pillActive: 'bg-orange-500 text-white border-orange-500',               pillInactive: 'bg-white text-orange-500 border-orange-300'                   },
  { label: 'Contracts', value: 'contract',   pillActive: 'bg-indigo-600 text-white border-indigo-600',               pillInactive: 'bg-white text-indigo-500 border-indigo-200'                   },
  { label: 'Letters',   value: 'sample',     pillActive: 'bg-blue-600 text-white border-blue-600',                   pillInactive: 'bg-white text-blue-500 border-blue-200'                       },
  { label: 'Payments',  value: 'debit_note', pillActive: 'bg-emerald-600 text-white border-emerald-600',             pillInactive: 'bg-white text-emerald-600 border-emerald-200'                 },
];

const OPEN_STATUSES = ['Issued', 'Inspected'];

const DOT_COLOR: Record<string, string> = {
  contract:   'bg-indigo-500',
  sample:     'bg-purple-400',
  debit_note: 'bg-emerald-500',
};

const STATUS_BADGE: Record<string, string> = {
  issued:    'text-gray-600 border border-gray-200 bg-gray-50',
  inspected: 'text-amber-700 border border-amber-200 bg-amber-50',
  completed: 'text-emerald-700 border border-emerald-200 bg-emerald-50',
};

function getOrderIcon(type: string) {
  if (type === 'contract')   return FileText;
  if (type === 'sample')     return Bookmark;
  if (type === 'debit_note') return Receipt;
  return FileText;
}

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileActivityFilter, setMobileActivityFilter] = useState('all');

  const [desktopFilter, setDesktopFilter] = useState('all');
  const [desktopSearch, setDesktopSearch] = useState('');

  const [orders, setOrders] = useState<Order[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [journalLoading, setJournalLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [selectedEntryForPopup, setSelectedEntryForPopup] = useState<JournalEntry | null>(null);
  const [isJournalFormOpen, setIsJournalFormOpen] = useState(false);
  const [isDesktopJournalFormOpen, setIsDesktopJournalFormOpen] = useState(false);
  const [desktopJournalPage, setDesktopJournalPage] = useState(1);
  const JOURNAL_PAGE_SIZE = 12;

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); setJournalLoading(false); return; }
    try {
      setLoading(true); setError(null);
      const [contractsRes, samplesRes, debitNotesRes] = await Promise.all([
        supabase.from('contracts').select('*').order('contract_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200),
        supabase.from('samples').select('*').order('date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200),
        supabase.from('debit_notes').select('*').order('debit_note_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200),
      ]);
      if (contractsRes.error) throw contractsRes.error;
      if (samplesRes.error) throw samplesRes.error;
      if (debitNotesRes.error) throw debitNotesRes.error;

      const contractOrders: Order[] = (contractsRes.data || []).map((c) => ({ id: c.id, contractNumber: c.contract_no, supplierName: c.supplier_name, article: c.article, color: c.color?.join(', ') || '', date: c.contract_date, createdAt: c.created_at, status: c.status, type: 'contract', contractData: c }));
      const sampleOrders: Order[]   = (samplesRes.data   || []).map((s) => ({ id: s.id!, contractNumber: s.sample_number, supplierName: s.supplier_name, article: s.description || '', color: s.company_name || '', date: s.date, createdAt: s.created_at, status: s.status, type: 'sample', sampleData: s }));
      const debitNoteOrders: Order[] = (debitNotesRes.data || []).map((d) => ({ id: d.id!, contractNumber: d.debit_note_no, supplierName: d.supplier_name, article: d.contract_no, color: d.invoice_no, date: d.debit_note_date, createdAt: d.created_at, status: d.status, type: 'debit_note', debitNoteData: d }));

      const toMs = (d?: string | null) => (d ? new Date(d).getTime() : 0);
      const allOrders = [...contractOrders, ...sampleOrders, ...debitNoteOrders].sort((a, b) => {
        const diff = toMs((b as any).date) - toMs((a as any).date);
        return diff !== 0 ? diff : toMs((b as any).createdAt) - toMs((a as any).createdAt);
      });
      setOrders(allOrders);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to load recent orders.');
    } finally { setLoading(false); }
  }, []);

  const fetchJournalEntries = useCallback(async () => {
    if (!user || !isSupabaseConfigured) { setJournalLoading(false); return; }
    try {
      setJournalLoading(true);
      const { data, error } = await supabase.from('journal_entries').select('*').eq('user_id', user.id).order('entry_date', { ascending: false });
      if (error) throw error;
      setJournalEntries(data || []);
    } catch (err) { console.error('Error fetching journal entries:', err); }
    finally { setJournalLoading(false); }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (user) fetchJournalEntries(); }, [user, fetchJournalEntries]);

  useEffect(() => {
    const entryId = searchParams.get('entry');
    if (!entryId || journalLoading) return;
    const found = journalEntries.find((e) => e.id === entryId);
    if (found) { setSelectedEntryForPopup(found); setSearchParams({}, { replace: true }); }
    else if (!journalLoading && journalEntries.length > 0) {
      supabase.from('journal_entries').select('*').eq('id', entryId).maybeSingle().then(({ data }) => {
        if (data) setSelectedEntryForPopup(data as JournalEntry);
        setSearchParams({}, { replace: true });
      });
    }
  }, [searchParams, journalEntries, journalLoading]);

  const mobileActivityOrders = useMemo(() => {
    if (mobileActivityFilter === 'open') return orders.filter(o => OPEN_STATUSES.includes(o.status || ''));
    if (mobileActivityFilter !== 'all')  return orders.filter(o => o.type === mobileActivityFilter);
    return orders;
  }, [orders, mobileActivityFilter]);

  const searchOrderResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const s = searchTerm.toLowerCase();
    return orders.filter(o =>
      o.contractNumber.toLowerCase().includes(s) || o.supplierName.toLowerCase().includes(s) ||
      o.article.toLowerCase().includes(s) || o.color.toLowerCase().includes(s)
    ).slice(0, 20);
  }, [orders, searchTerm]);

  const searchJournalResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const s = searchTerm.toLowerCase();
    return journalEntries.filter(e => e.title.toLowerCase().includes(s) || (e.content && e.content.toLowerCase().includes(s))).slice(0, 8);
  }, [journalEntries, searchTerm]);

  const desktopOrders = useMemo(() => {
    let list = desktopFilter === 'all' ? orders : desktopFilter === 'open' ? orders.filter(o => OPEN_STATUSES.includes(o.status || '')) : orders.filter(o => o.type === desktopFilter);
    if (desktopSearch.trim()) {
      const s = desktopSearch.toLowerCase();
      list = list.filter(o => o.contractNumber.toLowerCase().includes(s) || o.supplierName.toLowerCase().includes(s) || o.article.toLowerCase().includes(s) || o.color.toLowerCase().includes(s));
    }
    return list;
  }, [orders, desktopFilter, desktopSearch]);

  const handlePullRefresh = useCallback(async () => { await Promise.all([fetchData(), fetchJournalEntries()]); }, [fetchData, fetchJournalEntries]);
  const firstName = useMemo(() => getFirstName(user), [user]);

  const handleOrderClick = useCallback((order: Order) => {
    if (order.type === 'contract')   navigate(`/app/contracts/${order.id}`,   { state: { contract:   order.contractData   } });
    else if (order.type === 'sample') navigate(`/app/samples/${order.id}`,    { state: { sample:     order.sampleData     } });
    else                              navigate(`/app/debit-notes/${order.id}`, { state: { debitNote:  order.debitNoteData  } });
  }, [navigate]);

  const handleDesktopJournalSave = async (savedEntry?: JournalEntry) => {
    setIsDesktopJournalFormOpen(false); fetchJournalEntries();
    if (savedEntry && !savedEntry.parent_id) {
      const tenDaysAgo = new Date(); tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      const pastEntries = journalEntries.filter(e => e.id !== savedEntry.id && new Date(e.entry_date) >= tenDaysAgo);
      if (pastEntries.length > 0) {
        dialogService.toast({ message: 'AI is looking for related entries...', durationMs: 2000 });
        const suggestion = await suggestJournalLink(savedEntry, pastEntries);
        if (suggestion.suggested_parent_id) {
          const parentEntry = pastEntries.find(e => e.id === suggestion.suggested_parent_id);
          if (parentEntry) {
            const link = await dialogService.confirm({ title: 'Link Journal Entry?', message: `AI noticed this entry is related to: "${parentEntry.title}".\n\nReason: ${suggestion.reasoning}\n\nWould you like to link them together in a thread?`, confirmLabel: 'Link Entries' });
            if (link) { await supabase.from('journal_entries').update({ parent_id: parentEntry.id }).eq('id', savedEntry.id); fetchJournalEntries(); dialogService.success('Entries linked successfully.'); }
          }
        }
      }
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayJournalEntries = useMemo(() => journalEntries.filter(e => e.entry_date === todayStr), [journalEntries, todayStr]);

  if (!isSupabaseConfigured) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Configuration Required</h2>
        <p className="text-gray-600 max-w-md">Please connect your Supabase project to start managing your office data.</p>
      </div>
    );
  }

  return (
    <>
      {/* ══════════════════════════════════════════
          MOBILE LAYOUT
          ══════════════════════════════════════════ */}
      <div className="md:hidden">
        <PullToRefresh onRefresh={handlePullRefresh}>
          <div
            className="bg-[#F7F8FA] min-h-screen"
            style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 8px)' }}
          >

            {/* ── Header ── */}
            <div className="bg-white px-5 pt-4 pb-3 flex items-center justify-between">
              <div>
                <p className="text-[20px] font-extrabold leading-tight tracking-tight">
                  <span className="text-gray-900">JILD </span>
                  <span className="text-blue-600">IMPEX</span>
                </p>
                <p className="text-[12px] text-gray-400 font-medium mt-[-1px]">Management</p>
              </div>
              <button
                onClick={() => { setShowSearch(true); setSearchTerm(''); }}
                className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center active:bg-gray-200"
                aria-label="Search"
              >
                <Search style={{ width: 17, height: 17 }} className="text-gray-600" />
              </button>
            </div>

            {/* ── Greeting ── */}
            <div className="bg-white px-5 pb-5 pt-1">
              <h1 className="text-[28px] font-extrabold text-gray-900 leading-tight">
                {getGreeting()} 👋
              </h1>
              <p className="text-[13px] text-gray-400 mt-0.5">{formatToday()}</p>
            </div>

            {/* ── Today's Journal card ── */}
            <div className="px-4 pt-3 pb-1">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 relative overflow-hidden">

                {/* Icon + label */}
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                    <BookOpen className="h-[18px] w-[18px] text-white" strokeWidth={2} />
                  </div>
                  <span className="text-[12px] font-bold text-blue-600 tracking-widest uppercase">Today's Journal</span>
                </div>

                {journalLoading ? (
                  <div className="flex items-center gap-2 py-2">
                    <div className="animate-spin h-4 w-4 rounded-full border-b-2 border-blue-600" />
                    <span className="text-[13px] text-gray-400">Loading…</span>
                  </div>
                ) : todayJournalEntries.length === 0 ? (
                  <>
                    <h2 className="text-[22px] font-extrabold text-gray-900 leading-snug mb-1">
                      No entries for today
                    </h2>
                    <p className="text-[13px] text-gray-400 leading-relaxed mb-5">
                      Keep your journal up to date.<br />Create your first entry for today.
                    </p>
                    <button
                      onClick={() => { setEditingEntry(null); setIsJournalFormOpen(true); }}
                      className="inline-flex items-center gap-2 bg-blue-600 text-white font-bold text-[14px] px-5 py-3 rounded-xl active:bg-blue-700 transition-colors"
                    >
                      <PenLine className="h-4 w-4" />
                      Create Entry
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] text-blue-500 font-semibold uppercase tracking-wide mb-1">
                      {todayJournalEntries.length} {todayJournalEntries.length === 1 ? 'entry' : 'entries'} today
                    </p>
                    <h2
                      className="text-[20px] font-extrabold text-gray-900 leading-snug mb-1 cursor-pointer"
                      onClick={() => setSelectedEntryForPopup(todayJournalEntries[0])}
                    >
                      {todayJournalEntries[0].title}
                    </h2>
                    {todayJournalEntries[0].content && (
                      <p className="text-[13px] text-gray-400 line-clamp-2 leading-relaxed mb-4">
                        {todayJournalEntries[0].content}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingEntry(null); setIsJournalFormOpen(true); }}
                        className="inline-flex items-center gap-2 bg-blue-600 text-white font-bold text-[13px] px-4 py-2.5 rounded-xl active:bg-blue-700"
                      >
                        <PenLine className="h-3.5 w-3.5" /> New Entry
                      </button>
                      <button
                        onClick={() => setSelectedEntryForPopup(todayJournalEntries[0])}
                        className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 font-bold text-[13px] px-4 py-2.5 rounded-xl active:bg-gray-50"
                      >
                        View <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}

                {/* Decorative illustration — positioned absolute right */}
                <div className="absolute right-4 bottom-3 pointer-events-none select-none" aria-hidden>
                  <svg width="110" height="110" viewBox="0 0 110 110" fill="none">
                    {/* Sparkles */}
                    <text x="82" y="18" fontSize="12" fill="#CBD5E1" opacity="0.7">✦</text>
                    <text x="96" y="52" fontSize="8"  fill="#CBD5E1" opacity="0.5">✦</text>
                    <text x="72" y="95" fontSize="10" fill="#CBD5E1" opacity="0.5">✦</text>
                    {/* Paper */}
                    <rect x="30" y="14" width="52" height="66" rx="6" fill="#EEF2FF" stroke="#C7D2FE" strokeWidth="1.5"/>
                    <rect x="39" y="28" width="34" height="3" rx="1.5" fill="#A5B4FC"/>
                    <rect x="39" y="36" width="34" height="3" rx="1.5" fill="#A5B4FC"/>
                    <rect x="39" y="44" width="24" height="3" rx="1.5" fill="#A5B4FC"/>
                    <rect x="39" y="52" width="30" height="3" rx="1.5" fill="#A5B4FC"/>
                    <rect x="39" y="60" width="20" height="3" rx="1.5" fill="#C7D2FE"/>
                    {/* Pen */}
                    <g transform="rotate(-30 90 90)">
                      <rect x="72" y="52" width="11" height="40" rx="5.5" fill="#3B82F6"/>
                      <rect x="72" y="52" width="11" height="12" rx="5.5" fill="#93C5FD"/>
                      <polygon points="72,92 83,92 77.5,106" fill="#1D4ED8"/>
                      <rect x="74" y="104" width="7" height="3" rx="1" fill="#374151"/>
                    </g>
                  </svg>
                </div>
              </div>
            </div>

            {/* ── Recent Activity ── */}
            <div className="px-4 pt-4 pb-2">

              {/* Row: heading + View All */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[18px] font-extrabold text-gray-900">Recent Activity</h2>
                <button
                  onClick={() => navigate('/app/contracts')}
                  className="flex items-center gap-0.5 text-[13px] font-semibold text-blue-600"
                >
                  View All <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Filter pills */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3">
                {MOBILE_ACTIVITY_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setMobileActivityFilter(f.value)}
                    className={`px-4 py-1.5 rounded-full text-[12.5px] font-semibold shrink-0 border transition-all ${
                      mobileActivityFilter === f.value ? f.pillActive : f.pillInactive
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Error */}
              {error && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center text-red-700 text-sm">
                  <AlertCircle className="h-4 w-4 mr-2 shrink-0" />{error}
                  <button onClick={fetchData} className="ml-auto font-bold underline text-xs">Retry</button>
                </div>
              )}

              {/* List card */}
              {loading ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 flex justify-center shadow-sm">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                </div>
              ) : mobileActivityOrders.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
                  <p className="text-[13px] text-gray-400">No records found</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {mobileActivityOrders.slice(0, 12).map((order, idx) => {
                    const dotCls   = DOT_COLOR[order.type]  || 'bg-gray-400';
                    const statusKey = (order.status || 'issued').toLowerCase();
                    const badgeCls  = STATUS_BADGE[statusKey] || 'text-gray-600 border border-gray-200 bg-gray-50';

                    return (
                      <div
                        key={`${order.type}-${order.id}`}
                        onClick={() => handleOrderClick(order)}
                        className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer active:bg-gray-50 transition-colors ${idx > 0 ? 'border-t border-gray-50' : ''}`}
                      >
                        {/* Colored dot */}
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotCls}`} />

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-bold text-gray-900 leading-tight truncate">{order.contractNumber}</p>
                          <p className="text-[12px] text-gray-400 truncate">{order.supplierName}</p>
                        </div>

                        {/* Status badge */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${badgeCls}`}>
                            {order.status || 'Issued'}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Journal entry form */}
            {isJournalFormOpen && (
              <JournalEntryForm
                initialDate={editingEntry ? new Date(editingEntry.entry_date) : new Date()}
                initialEntry={editingEntry}
                onClose={() => { setIsJournalFormOpen(false); setEditingEntry(null); }}
                onSave={async (savedEntry?: JournalEntry) => {
                  setIsJournalFormOpen(false); setEditingEntry(null); fetchJournalEntries();
                  if (savedEntry && !savedEntry.parent_id && !editingEntry) {
                    const tenDaysAgo = new Date(); tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
                    const pastEntries = journalEntries.filter(e => e.id !== savedEntry.id && new Date(e.entry_date) >= tenDaysAgo);
                    if (pastEntries.length > 0) {
                      dialogService.toast({ message: 'AI is looking for related entries...', durationMs: 2000 });
                      const suggestion = await suggestJournalLink(savedEntry, pastEntries);
                      if (suggestion.suggested_parent_id) {
                        const parentEntry = pastEntries.find(e => e.id === suggestion.suggested_parent_id);
                        if (parentEntry) {
                          const link = await dialogService.confirm({ title: 'Link Journal Entry?', message: `AI noticed this entry is related to: "${parentEntry.title}".\n\nReason: ${suggestion.reasoning}\n\nWould you like to link them together in a thread?`, confirmLabel: 'Link Entries' });
                          if (link) { await supabase.from('journal_entries').update({ parent_id: parentEntry.id }).eq('id', savedEntry.id); fetchJournalEntries(); dialogService.success('Entries linked successfully.'); }
                        }
                      }
                    }
                  }
                }}
              />
            )}
          </div>
        </PullToRefresh>

        {/* ── Search Overlay ── */}
        {showSearch && (
          <div className="fixed inset-0 z-[200] bg-white flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <button onClick={() => { setShowSearch(false); setSearchTerm(''); }} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                <X className="h-4 w-4 text-gray-600" />
              </button>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  autoFocus
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search contracts, suppliers, journal…"
                  className="w-full pl-9 pr-8 py-2.5 bg-gray-100 rounded-xl text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1">
                    <X className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50">
              {!searchTerm.trim() ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-8">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                    <Search className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-[15px] font-bold text-gray-700 mb-1">Search everything</p>
                  <p className="text-[13px] text-gray-400">Contracts, letters, payments, journal entries</p>
                </div>
              ) : (searchOrderResults.length === 0 && searchJournalResults.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-8">
                  <p className="text-[15px] font-bold text-gray-700 mb-1">No results</p>
                  <p className="text-[13px] text-gray-400">Try a different search term</p>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {searchOrderResults.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Records ({searchOrderResults.length})</p>
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        {searchOrderResults.map((order, idx) => {
                          const dotCls    = DOT_COLOR[order.type]  || 'bg-gray-400';
                          const statusKey = (order.status || 'issued').toLowerCase();
                          const badgeCls  = STATUS_BADGE[statusKey] || 'text-gray-600 border border-gray-200 bg-gray-50';
                          return (
                            <div key={`s-${order.type}-${order.id}`}
                              onClick={() => { handleOrderClick(order); setShowSearch(false); setSearchTerm(''); }}
                              className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer active:bg-gray-50 ${idx > 0 ? 'border-t border-gray-50' : ''}`}>
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotCls}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-[14px] font-bold text-gray-900 truncate">{order.contractNumber}</p>
                                <p className="text-[12px] text-gray-400 truncate">{order.supplierName}</p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${badgeCls}`}>{order.status || 'Issued'}</span>
                                <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {searchJournalResults.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Journal ({searchJournalResults.length})</p>
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        {searchJournalResults.map((entry, idx) => (
                          <div key={`sj-${entry.id}`}
                            onClick={() => { setSelectedEntryForPopup(entry); setShowSearch(false); setSearchTerm(''); }}
                            className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer active:bg-gray-50 ${idx > 0 ? 'border-t border-gray-50' : ''}`}>
                            <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-indigo-400" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-bold text-gray-900 truncate">{entry.title}</p>
                              <p className="text-[12px] text-gray-400 truncate">
                                {new Date(entry.entry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          DESKTOP SPLIT PANEL — unchanged
          ══════════════════════════════════════════ */}
      <div className="hidden md:flex flex-col h-full page-fade-in">
        <div className="shrink-0 bg-white border-b border-gray-100 px-6 pt-4 pb-3">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-2xl font-bold leading-tight">
                <span className="text-gray-900">JILD </span>
                <span className="text-blue-600">IMPEX </span>
                <span className="text-gray-900">Management</span>
              </p>
              <h1 className="text-xl font-bold text-gray-900 leading-tight mt-0.5">{getGreeting()} 👋</h1>
              <p className="text-[12px] text-gray-400 mt-1">{formatToday()}</p>
            </div>
            <div className="shrink-0 flex flex-col items-end justify-start pt-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input type="text" value={desktopSearch} onChange={e => setDesktopSearch(e.target.value)} placeholder="Search orders & journal…"
                  className="h-9 pl-8 pr-3 w-72 text-[13px] bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 focus:bg-white transition-colors" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden min-h-0">
          <div className="w-[360px] shrink-0 border-r border-gray-100 flex flex-col bg-white overflow-hidden">
            <div className="px-4 pt-3 pb-2.5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Journal</h2>
              <button onClick={() => setIsDesktopJournalFormOpen(true)} className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-[11px] font-bold rounded-lg hover:bg-blue-700 transition-colors">
                <Plus className="h-3 w-3" /> New Entry
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pt-3 flex flex-col">
              {desktopSearch.trim() ? (() => {
                const s = desktopSearch.toLowerCase();
                const matched = journalEntries.filter(e => e.title.toLowerCase().includes(s) || (e.content && e.content.toLowerCase().includes(s)));
                const totalPages = Math.max(1, Math.ceil(matched.length / JOURNAL_PAGE_SIZE));
                const page = Math.min(desktopJournalPage, totalPages);
                const slice = matched.slice((page - 1) * JOURNAL_PAGE_SIZE, page * JOURNAL_PAGE_SIZE);
                return (
                  <div className="flex flex-col flex-1 min-h-0">
                    {matched.length === 0 ? (
                      <p className="text-[12px] text-gray-400 text-center py-6">No entries match "{desktopSearch}"</p>
                    ) : (
                      <>
                        <div className="space-y-2 pb-3">
                          {slice.map(entry => (
                            <div key={entry.id} className="rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm cursor-pointer hover:border-blue-200 transition-colors" onClick={() => setSelectedEntryForPopup(entry)}>
                              <p className="text-[13px] font-bold text-gray-800 line-clamp-1">{entry.title}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{new Date(entry.entry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                              {entry.content && <p className="text-[12px] text-gray-500 mt-1 line-clamp-2">{entry.content}</p>}
                            </div>
                          ))}
                        </div>
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between pt-1 pb-3 border-t border-gray-100 mt-auto shrink-0">
                            <p className="text-[11px] text-gray-400">{(page-1)*JOURNAL_PAGE_SIZE+1}–{Math.min(page*JOURNAL_PAGE_SIZE, matched.length)} of {matched.length}</p>
                            <div className="flex gap-1">
                              <button onClick={() => setDesktopJournalPage(p => Math.max(1, p-1))} disabled={page===1} className="px-2.5 py-1 rounded-lg text-[11px] bg-gray-100 text-gray-600 disabled:opacity-30 hover:bg-gray-200">‹ Prev</button>
                              <button onClick={() => setDesktopJournalPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} className="px-2.5 py-1 rounded-lg text-[11px] bg-gray-100 text-gray-600 disabled:opacity-30 hover:bg-gray-200">Next ›</button>
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

          <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">
            <div className="px-4 pt-3 pb-2.5 border-b border-gray-100 bg-white shrink-0">
              <div className="flex items-center mb-2">
                <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Recent Activity</h2>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {DESKTOP_FILTERS.map((f) => (
                  <button key={f.value} onClick={() => setDesktopFilter(f.value)} className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all ${desktopFilter === f.value ? f.activeClass : f.inactiveClass}`}>{f.label}</button>
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

      {isDesktopJournalFormOpen && (
        <JournalEntryForm initialDate={new Date()} initialEntry={null} onClose={() => setIsDesktopJournalFormOpen(false)} onSave={handleDesktopJournalSave} />
      )}

      {selectedEntryForPopup && (
        <JournalEntryPopup entry={selectedEntryForPopup} allEntries={journalEntries} onClose={() => setSelectedEntryForPopup(null)} onUpdate={fetchJournalEntries} />
      )}
    </>
  );
};

export default HomePage;
