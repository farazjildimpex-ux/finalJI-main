import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import SearchBar from './SearchBar';
import RecentOrdersList from './RecentOrdersList';
import JournalWidget from './JournalWidget';
import JournalSearchResults from '../Journal/JournalSearchResults';
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

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Mobile state
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  // Desktop state
  const [desktopFilter, setDesktopFilter] = useState('all');
  const [desktopSearch, setDesktopSearch] = useState('');

  const [orders, setOrders] = useState<Order[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [journalLoading, setJournalLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Journal modals (mobile search + notification deep-link)
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [selectedEntryForPopup, setSelectedEntryForPopup] = useState<JournalEntry | null>(null);
  const [isJournalFormOpen, setIsJournalFormOpen] = useState(false);
  const [isDesktopJournalFormOpen, setIsDesktopJournalFormOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); setJournalLoading(false); return; }
    try {
      setLoading(true);
      setError(null);
      const [contractsRes, samplesRes, debitNotesRes] = await Promise.all([
        supabase.from('contracts').select('*').order('contract_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200),
        supabase.from('samples').select('*').order('date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200),
        supabase.from('debit_notes').select('*').order('debit_note_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200),
      ]);
      if (contractsRes.error) throw contractsRes.error;
      if (samplesRes.error) throw samplesRes.error;
      if (debitNotesRes.error) throw debitNotesRes.error;

      const contractOrders: Order[] = (contractsRes.data || []).map((c) => ({
        id: c.id, contractNumber: c.contract_no, supplierName: c.supplier_name,
        article: c.article, color: c.color?.join(', ') || '', date: c.contract_date,
        createdAt: c.created_at, status: c.status, type: 'contract', contractData: c,
      }));
      const sampleOrders: Order[] = (samplesRes.data || []).map((s) => ({
        id: s.id!, contractNumber: s.sample_number, supplierName: s.supplier_name,
        article: s.description || '', color: s.company_name || '', date: s.date,
        createdAt: s.created_at, status: s.status, type: 'sample', sampleData: s,
      }));
      const debitNoteOrders: Order[] = (debitNotesRes.data || []).map((d) => ({
        id: d.id!, contractNumber: d.debit_note_no, supplierName: d.supplier_name,
        article: d.contract_no, color: d.invoice_no, date: d.debit_note_date,
        createdAt: d.created_at, status: d.status, type: 'debit_note', debitNoteData: d,
      }));

      const toMs = (d?: string | null) => (d ? new Date(d).getTime() : 0);
      const allOrders = [...contractOrders, ...sampleOrders, ...debitNoteOrders].sort((a, b) => {
        const diff = toMs((b as any).date) - toMs((a as any).date);
        return diff !== 0 ? diff : toMs((b as any).createdAt) - toMs((a as any).createdAt);
      });
      setOrders(allOrders);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to load recent orders. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchJournalEntries = useCallback(async () => {
    if (!user || !isSupabaseConfigured) { setJournalLoading(false); return; }
    try {
      setJournalLoading(true);
      const { data, error } = await supabase.from('journal_entries').select('*').eq('user_id', user.id).order('entry_date', { ascending: false });
      if (error) throw error;
      setJournalEntries(data || []);
    } catch (err) {
      console.error('Error fetching journal entries:', err);
    } finally {
      setJournalLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (user) fetchJournalEntries(); }, [user, fetchJournalEntries]);

  // Notification deep-link
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

  const filteredOrders = orders.filter((order) => {
    if (activeFilter !== 'all' && activeFilter !== 'journal' && order.type !== activeFilter) return false;
    const s = searchTerm.toLowerCase();
    return order.contractNumber.toLowerCase().includes(s) || order.supplierName.toLowerCase().includes(s) ||
      order.article.toLowerCase().includes(s) || order.color.toLowerCase().includes(s);
  });
  const filteredJournal = journalEntries.filter((entry) => {
    if (activeFilter !== 'all' && activeFilter !== 'journal') return false;
    const s = searchTerm.toLowerCase();
    return entry.title.toLowerCase().includes(s) || (entry.content && entry.content.toLowerCase().includes(s));
  });

  // Desktop filtered orders
  const desktopOrders = useMemo(() => {
    const OPEN_STATUSES = ['Issued', 'Inspected'];
    let list = desktopFilter === 'all'
      ? orders
      : desktopFilter === 'open'
        ? orders.filter(o => OPEN_STATUSES.includes(o.status || ''))
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

  const activeOrders = orders.filter((o) => o.status !== 'Completed');
  const [desktopJournalPage, setDesktopJournalPage] = useState(1);
  const JOURNAL_PAGE_SIZE = 12;
  const handlePullRefresh = useCallback(async () => { await Promise.all([fetchData(), fetchJournalEntries()]); }, [fetchData, fetchJournalEntries]);
  const firstName = useMemo(() => getFirstName(user), [user]);

  const handleDesktopJournalSave = async (savedEntry?: JournalEntry) => {
    setIsDesktopJournalFormOpen(false);
    fetchJournalEntries();
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

  if (!isSupabaseConfigured) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Configuration Required</h2>
        <p className="text-gray-600 max-w-md">Please connect your Supabase project using the "Connect to Supabase" button to start managing your office data.</p>
      </div>
    );
  }

  const showJournal = activeFilter === 'all' || activeFilter === 'journal';
  const showOrders = activeFilter === 'all' || activeFilter !== 'journal';

  return (
    <>
      {/* ══════════════════════════════════════════
          MOBILE LAYOUT — unchanged, hidden on desktop
          ══════════════════════════════════════════ */}
      <div className="md:hidden">
        <PullToRefresh onRefresh={handlePullRefresh}>
          <div className="max-w-7xl mx-auto page-fade-in px-4">
            <div className="pt-6 pb-5">
              <p className="text-2xl font-bold leading-tight">
                <span className="text-gray-900">JILD </span>
                <span className="text-blue-600">IMPEX </span>
                <span className="text-gray-900">Management</span>
              </p>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight mt-0.5">{getGreeting()} 👋</h1>
              <p className="text-sm text-gray-400 mt-0.5 text-center">{formatToday()}</p>
            </div>

            <div className="mb-5">
              <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} activeFilter={activeFilter} onFilterChange={setActiveFilter} />
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center text-red-700">
                <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />{error}
                <button onClick={fetchData} className="ml-auto font-bold underline">Retry</button>
              </div>
            )}

            {showJournal && (
              <div className="mb-6">
                {searchTerm || activeFilter === 'journal' ? (
                  <JournalSearchResults entries={filteredJournal} searchTerm={searchTerm} onEntriesUpdated={fetchJournalEntries}
                    onOpen={(e) => setSelectedEntryForPopup(e)}
                    onEdit={(e) => { setEditingEntry(e); setIsJournalFormOpen(true); }} />
                ) : (
                  <JournalWidget entries={journalEntries} loading={journalLoading} onEntriesUpdated={fetchJournalEntries} />
                )}
              </div>
            )}

            {showOrders && (
              <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wider mb-4">
                  {searchTerm || activeFilter !== 'all' ? 'Search Results' : 'Recent Orders'}
                </h2>
                <RecentOrdersList orders={searchTerm || activeFilter !== 'all' ? filteredOrders : activeOrders} loading={loading} onStatusChange={fetchData} />
              </div>
            )}

            {isJournalFormOpen && (
              <JournalEntryForm initialDate={editingEntry ? new Date(editingEntry.entry_date) : new Date()} initialEntry={editingEntry}
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
                }} />
            )}
          </div>
        </PullToRefresh>
      </div>

      {/* ══════════════════════════════════════════
          DESKTOP SPLIT PANEL — hidden on mobile
          ══════════════════════════════════════════ */}
      <div className="hidden md:flex flex-col h-full page-fade-in">

        {/* ── Full-width branding header ── */}
        <div className="shrink-0 bg-white border-b border-gray-100 px-6 pt-4 pb-3">
          <div className="flex items-start gap-4">
            {/* Left: branding + greeting + date */}
            <div className="flex-1 min-w-0">
              <p className="text-2xl font-bold leading-tight">
                <span className="text-gray-900">JILD </span>
                <span className="text-blue-600">IMPEX </span>
                <span className="text-gray-900">Management</span>
              </p>
              <h1 className="text-xl font-bold text-gray-900 leading-tight mt-0.5">{getGreeting()} 👋</h1>
              <p className="text-[12px] text-gray-400 mt-1">{formatToday()}</p>
            </div>
            {/* Right: search */}
            <div className="shrink-0 flex flex-col items-end justify-start pt-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={desktopSearch}
                  onChange={e => setDesktopSearch(e.target.value)}
                  placeholder="Search orders & journal…"
                  className="h-9 pl-8 pr-3 w-72 text-[13px] bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Split panels ── */}
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* LEFT: Journal */}
          <div className="w-[360px] shrink-0 border-r border-gray-100 flex flex-col bg-white overflow-hidden">
            {/* Panel header */}
            <div className="px-4 pt-3 pb-2.5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Journal</h2>
              <button
                onClick={() => setIsDesktopJournalFormOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-[11px] font-bold rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-3 w-3" /> New Entry
              </button>
            </div>
            {/* Scrollable journal content */}
            <div className="flex-1 overflow-y-auto px-3 pt-3 flex flex-col">
              {desktopSearch.trim() ? (() => {
                const s = desktopSearch.toLowerCase();
                const matched = journalEntries.filter(e =>
                  e.title.toLowerCase().includes(s) || (e.content && e.content.toLowerCase().includes(s))
                );
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
                            <div key={entry.id}
                              className="rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm cursor-pointer hover:border-blue-200 transition-colors"
                              onClick={() => setSelectedEntryForPopup(entry)}>
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
                              <button onClick={() => setDesktopJournalPage(p => Math.max(1, p-1))} disabled={page === 1}
                                className="px-2.5 py-1 rounded-lg text-[11px] bg-gray-100 text-gray-600 disabled:opacity-30 hover:bg-gray-200">
                                ‹ Prev
                              </button>
                              <button onClick={() => setDesktopJournalPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
                                className="px-2.5 py-1 rounded-lg text-[11px] bg-gray-100 text-gray-600 disabled:opacity-30 hover:bg-gray-200">
                                Next ›
                              </button>
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
            {/* Panel header: label + filter pills */}
            <div className="px-4 pt-3 pb-2.5 border-b border-gray-100 bg-white shrink-0">
              <div className="flex items-center mb-2">
                <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Recent Activity</h2>
              </div>
              {/* Filter pills */}
              <div className="flex gap-1.5 flex-wrap">
                {DESKTOP_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setDesktopFilter(f.value)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all
                      ${desktopFilter === f.value ? f.activeClass : f.inactiveClass}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable orders list */}
            <div className="flex-1 overflow-y-auto p-4">
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center text-red-700 text-sm">
                  <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />{error}
                  <button onClick={fetchData} className="ml-auto font-bold underline">Retry</button>
                </div>
              )}
              <RecentOrdersList orders={desktopOrders} loading={loading} onStatusChange={fetchData} />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop journal form */}
      {isDesktopJournalFormOpen && (
        <JournalEntryForm initialDate={new Date()} initialEntry={null}
          onClose={() => setIsDesktopJournalFormOpen(false)}
          onSave={handleDesktopJournalSave} />
      )}

      {/* Notification deep-link popup (both layouts) */}
      {selectedEntryForPopup && (
        <JournalEntryPopup entry={selectedEntryForPopup} allEntries={journalEntries}
          onClose={() => setSelectedEntryForPopup(null)} onUpdate={fetchJournalEntries} />
      )}
    </>
  );
};

export default HomePage;
