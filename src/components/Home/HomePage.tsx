import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
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
  { label: 'All',       value: 'all' },
  { label: 'Contracts', value: 'contract' },
  { label: 'Letters',   value: 'sample' },
  { label: 'Payments',  value: 'debit_note' },
];

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [desktopFilter, setDesktopFilter] = useState('all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [journalLoading, setJournalLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Journal interaction states (used for search results + notification deep-link on mobile)
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [selectedEntryForPopup, setSelectedEntryForPopup] = useState<JournalEntry | null>(null);
  const [isJournalFormOpen, setIsJournalFormOpen] = useState(false);

  // Desktop journal new-entry button state
  const [isDesktopJournalFormOpen, setIsDesktopJournalFormOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setJournalLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [contractsRes, samplesRes, debitNotesRes] = await Promise.all([
        supabase.from('contracts').select('*')
          .order('contract_date', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('samples').select('*')
          .order('date', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('debit_notes').select('*')
          .order('debit_note_date', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      if (contractsRes.error) throw contractsRes.error;
      if (samplesRes.error) throw samplesRes.error;
      if (debitNotesRes.error) throw debitNotesRes.error;

      const contractOrders: Order[] = (contractsRes.data || []).map((contract) => ({
        id: contract.id,
        contractNumber: contract.contract_no,
        supplierName: contract.supplier_name,
        article: contract.article,
        color: contract.color?.join(', ') || '',
        date: contract.contract_date,
        createdAt: contract.created_at,
        status: contract.status,
        type: 'contract',
        contractData: contract,
      }));

      const sampleOrders: Order[] = (samplesRes.data || []).map((sample) => ({
        id: sample.id!,
        contractNumber: sample.sample_number,
        supplierName: sample.supplier_name,
        article: sample.description || '',
        color: sample.company_name || '',
        date: sample.date,
        createdAt: sample.created_at,
        status: sample.status,
        type: 'sample',
        sampleData: sample,
      }));

      const debitNoteOrders: Order[] = (debitNotesRes.data || []).map((debitNote) => ({
        id: debitNote.id!,
        contractNumber: debitNote.debit_note_no,
        supplierName: debitNote.supplier_name,
        article: debitNote.contract_no,
        color: debitNote.invoice_no,
        date: debitNote.debit_note_date,
        createdAt: debitNote.created_at,
        status: debitNote.status,
        type: 'debit_note',
        debitNoteData: debitNote,
      }));

      const toMs = (d?: string | null) => (d ? new Date(d).getTime() : 0);

      const allOrders = [...contractOrders, ...sampleOrders, ...debitNoteOrders].sort((a, b) => {
        const dateA = toMs((a as any).date);
        const dateB = toMs((b as any).date);
        if (dateB !== dateA) return dateB - dateA;
        return toMs((b as any).createdAt) - toMs((a as any).createdAt);
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
    if (!user || !isSupabaseConfigured) {
      setJournalLoading(false);
      return;
    }

    try {
      setJournalLoading(true);
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: false });

      if (error) throw error;
      setJournalEntries(data || []);
    } catch (err) {
      console.error('Error fetching journal entries:', err);
    } finally {
      setJournalLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (user) {
      fetchJournalEntries();
    }
  }, [user, fetchJournalEntries]);

  // Open specific journal entry when navigated from a notification (?entry=ID)
  useEffect(() => {
    const entryId = searchParams.get('entry');
    if (!entryId || journalLoading) return;

    const found = journalEntries.find((e) => e.id === entryId);
    if (found) {
      setSelectedEntryForPopup(found);
      setSearchParams({}, { replace: true });
    } else if (!journalLoading && journalEntries.length > 0) {
      supabase
        .from('journal_entries')
        .select('*')
        .eq('id', entryId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setSelectedEntryForPopup(data as JournalEntry);
          setSearchParams({}, { replace: true });
        });
    }
  }, [searchParams, journalEntries, journalLoading]);

  const filteredOrders = orders.filter((order) => {
    if (activeFilter !== 'all' && activeFilter !== 'journal' && order.type !== activeFilter) {
      return false;
    }
    const searchLower = searchTerm.toLowerCase();
    return (
      order.contractNumber.toLowerCase().includes(searchLower) ||
      order.supplierName.toLowerCase().includes(searchLower) ||
      order.article.toLowerCase().includes(searchLower) ||
      order.color.toLowerCase().includes(searchLower)
    );
  });

  const filteredJournal = journalEntries.filter((entry) => {
    if (activeFilter !== 'all' && activeFilter !== 'journal') return false;
    const searchLower = searchTerm.toLowerCase();
    return (
      entry.title.toLowerCase().includes(searchLower) || 
      (entry.content && entry.content.toLowerCase().includes(searchLower))
    );
  });

  const activeOrders = orders.filter((order) => order.status !== 'Completed');

  // Desktop filter
  const desktopOrders = desktopFilter === 'all'
    ? orders
    : orders.filter((o) => o.type === desktopFilter);

  const handlePullRefresh = useCallback(async () => {
    await Promise.all([fetchData(), fetchJournalEntries()]);
  }, [fetchData, fetchJournalEntries]);

  const firstName = useMemo(() => getFirstName(user), [user]);

  if (!isSupabaseConfigured) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Configuration Required</h2>
        <p className="text-gray-600 max-w-md">
          Please connect your Supabase project using the "Connect to Supabase" button to start managing your office data.
        </p>
      </div>
    );
  }

  const showJournal = activeFilter === 'all' || activeFilter === 'journal';
  const showOrders = activeFilter === 'all' || activeFilter !== 'journal';

  // Shared AI link logic used by desktop journal form
  const handleDesktopJournalSave = async (savedEntry?: JournalEntry) => {
    setIsDesktopJournalFormOpen(false);
    fetchJournalEntries();

    if (savedEntry && !savedEntry.parent_id) {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      const pastEntries = journalEntries.filter(
        e => e.id !== savedEntry.id && new Date(e.entry_date) >= tenDaysAgo
      );
      if (pastEntries.length > 0) {
        dialogService.toast({ message: 'AI is looking for related entries...', durationMs: 2000 });
        const suggestion = await suggestJournalLink(savedEntry, pastEntries);
        if (suggestion.suggested_parent_id) {
          const parentEntry = pastEntries.find(e => e.id === suggestion.suggested_parent_id);
          if (parentEntry) {
            const link = await dialogService.confirm({
              title: 'Link Journal Entry?',
              message: `AI noticed this entry is related to: "${parentEntry.title}".\n\nReason: ${suggestion.reasoning}\n\nWould you like to link them together in a thread?`,
              confirmLabel: 'Link Entries',
            });
            if (link) {
              await supabase.from('journal_entries').update({ parent_id: parentEntry.id }).eq('id', savedEntry.id);
              fetchJournalEntries();
              dialogService.success('Entries linked successfully.');
            }
          }
        }
      }
    }
  };

  return (
    <>
      {/* ══════════════════════════════════════════
          MOBILE LAYOUT — unchanged, hidden on desktop
          ══════════════════════════════════════════ */}
      <div className="md:hidden">
        <PullToRefresh onRefresh={handlePullRefresh}>
          <div className="max-w-7xl mx-auto page-fade-in px-4">

            {/* Welcome header */}
            <div className="pt-6 pb-5">
              <p className="text-2xl font-bold leading-tight">
                <span className="text-gray-900">JILD </span>
                <span className="text-blue-600">IMPEX </span>
                <span className="text-gray-900">Management</span>
              </p>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight mt-0.5">
                {getGreeting()} 👋
              </h1>
              <p className="text-sm text-gray-400 mt-0.5">{formatToday()}</p>
            </div>

            {/* Search & filters */}
            <div className="mb-5">
              <SearchBar
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
              />
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center text-red-700">
                <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
                {error}
                <button onClick={fetchData} className="ml-auto font-bold underline">Retry</button>
              </div>
            )}

            {/* Journal Section */}
            {showJournal && (
              <div className="mb-6">
                {searchTerm || activeFilter === 'journal' ? (
                  <JournalSearchResults
                    entries={filteredJournal}
                    searchTerm={searchTerm}
                    onEntriesUpdated={fetchJournalEntries}
                    onOpen={(e) => setSelectedEntryForPopup(e)}
                    onEdit={(e) => {
                      setEditingEntry(e);
                      setIsJournalFormOpen(true);
                    }}
                  />
                ) : (
                  <JournalWidget 
                    entries={journalEntries} 
                    loading={journalLoading} 
                    onEntriesUpdated={fetchJournalEntries} 
                  />
                )}
              </div>
            )}

            {/* Orders Section */}
            {showOrders && (
              <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wider mb-4">
                  {searchTerm || activeFilter !== 'all' ? 'Search Results' : 'Recent Orders'}
                </h2>
                <RecentOrdersList
                  orders={searchTerm || activeFilter !== 'all' ? filteredOrders : activeOrders}
                  loading={loading}
                  onStatusChange={fetchData}
                />
              </div>
            )}

            {/* Mobile modals */}
            {isJournalFormOpen && (
              <JournalEntryForm
                initialDate={editingEntry ? new Date(editingEntry.entry_date) : new Date()}
                initialEntry={editingEntry}
                onClose={() => { setIsJournalFormOpen(false); setEditingEntry(null); }}
                onSave={async (savedEntry?: JournalEntry) => {
                  setIsJournalFormOpen(false);
                  setEditingEntry(null);
                  fetchJournalEntries();
                  if (savedEntry && !savedEntry.parent_id && !editingEntry) {
                    const tenDaysAgo = new Date();
                    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
                    const pastEntries = journalEntries.filter(
                      e => e.id !== savedEntry.id && new Date(e.entry_date) >= tenDaysAgo
                    );
                    if (pastEntries.length > 0) {
                      dialogService.toast({ message: 'AI is looking for related entries...', durationMs: 2000 });
                      const suggestion = await suggestJournalLink(savedEntry, pastEntries);
                      if (suggestion.suggested_parent_id) {
                        const parentEntry = pastEntries.find(e => e.id === suggestion.suggested_parent_id);
                        if (parentEntry) {
                          const link = await dialogService.confirm({
                            title: 'Link Journal Entry?',
                            message: `AI noticed this entry is related to: "${parentEntry.title}".\n\nReason: ${suggestion.reasoning}\n\nWould you like to link them together in a thread?`,
                            confirmLabel: 'Link Entries',
                          });
                          if (link) {
                            await supabase.from('journal_entries').update({ parent_id: parentEntry.id }).eq('id', savedEntry.id);
                            fetchJournalEntries();
                            dialogService.success('Entries linked successfully.');
                          }
                        }
                      }
                    }
                  }
                }}
              />
            )}
            {selectedEntryForPopup && (
              <JournalEntryPopup
                entry={selectedEntryForPopup}
                allEntries={journalEntries}
                onClose={() => setSelectedEntryForPopup(null)}
                onUpdate={fetchJournalEntries}
              />
            )}
          </div>
        </PullToRefresh>
      </div>

      {/* ══════════════════════════════════════════
          DESKTOP SPLIT PANEL — hidden on mobile
          Left: Journal | Right: Recent Activity
          ══════════════════════════════════════════ */}
      <div className="hidden md:flex h-full page-fade-in">

        {/* ── LEFT PANEL: Journal ── */}
        <div className="w-[380px] shrink-0 border-r border-gray-100 flex flex-col bg-white overflow-hidden">
          {/* Panel header */}
          <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between shrink-0">
            <h2 className="text-[13px] font-bold text-gray-800 uppercase tracking-wide">Journal</h2>
            <button
              onClick={() => setIsDesktopJournalFormOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              New Entry
            </button>
          </div>

          {/* JournalWidget fills the rest — its own scroll */}
          <div className="flex-1 overflow-y-auto px-4 pt-4">
            <JournalWidget
              entries={journalEntries}
              loading={journalLoading}
              onEntriesUpdated={fetchJournalEntries}
              hideHeader
            />
          </div>
        </div>

        {/* ── RIGHT PANEL: Recent Activity ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">
          {/* Panel header + filter pills */}
          <div className="px-5 pt-4 pb-3 border-b border-gray-100 bg-white shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-[13px] font-bold text-gray-800 uppercase tracking-wide">Recent Activity</h2>
                <p className="text-[10px] text-gray-400 mt-0.5">Contracts · Letters · Payments</p>
              </div>
              {error && (
                <button onClick={fetchData} className="text-[11px] text-red-500 font-semibold underline">
                  Retry
                </button>
              )}
            </div>
            {/* Filter pills */}
            <div className="flex gap-1.5 flex-wrap">
              {DESKTOP_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setDesktopFilter(f.value)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all
                    ${desktopFilter === f.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}
                >
                  {f.label}
                  {f.value !== 'all' && (
                    <span className="ml-1 opacity-60">
                      {orders.filter(o => o.type === f.value).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Orders table — its own scroll */}
          <div className="flex-1 overflow-y-auto p-5">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center text-red-700 text-sm">
                <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
                {error}
              </div>
            )}
            <RecentOrdersList
              orders={desktopOrders}
              loading={loading}
              onStatusChange={fetchData}
            />
          </div>
        </div>
      </div>

      {/* Desktop journal form (triggered from panel header button) */}
      {isDesktopJournalFormOpen && (
        <JournalEntryForm
          initialDate={new Date()}
          initialEntry={null}
          onClose={() => setIsDesktopJournalFormOpen(false)}
          onSave={handleDesktopJournalSave}
        />
      )}

      {/* Notification deep-link popup (both layouts) */}
      {selectedEntryForPopup && (
        <JournalEntryPopup
          entry={selectedEntryForPopup}
          allEntries={journalEntries}
          onClose={() => setSelectedEntryForPopup(null)}
          onUpdate={fetchJournalEntries}
        />
      )}
    </>
  );
};

export default HomePage;
