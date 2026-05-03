import { useEffect, useState, useCallback, useMemo } from 'react';
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

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [journalLoading, setJournalLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Journal interaction states
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [selectedEntryForPopup, setSelectedEntryForPopup] = useState<JournalEntry | null>(null);
  const [isJournalFormOpen, setIsJournalFormOpen] = useState(false);

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
        supabase.from('contracts').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('samples').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('debit_notes').select('*').order('created_at', { ascending: false }).limit(100)
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
        status: debitNote.status,
        type: 'debit_note',
        debitNoteData: debitNote,
      }));

      const allOrders = [...contractOrders, ...sampleOrders, ...debitNoteOrders].sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB.getTime() - dateA.getTime();
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

  const filteredOrders = orders.filter((order) => {
    // First check database filter
    if (activeFilter !== 'all' && activeFilter !== 'journal' && order.type !== activeFilter) {
      return false;
    }
    
    // Then check search term
    const searchLower = searchTerm.toLowerCase();
    return (
      order.contractNumber.toLowerCase().includes(searchLower) ||
      order.supplierName.toLowerCase().includes(searchLower) ||
      order.article.toLowerCase().includes(searchLower) ||
      order.color.toLowerCase().includes(searchLower)
    );
  });

  const filteredJournal = journalEntries.filter((entry) => {
    // First check database filter
    if (activeFilter !== 'all' && activeFilter !== 'journal') {
      return false;
    }

    // Then check search term
    const searchLower = searchTerm.toLowerCase();
    return (
      entry.title.toLowerCase().includes(searchLower) || 
      (entry.content && entry.content.toLowerCase().includes(searchLower))
    );
  });

  const activeOrders = orders.filter((order) => order.status !== 'Completed');

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

  const handlePullRefresh = useCallback(async () => {
    await Promise.all([fetchData(), fetchJournalEntries()]);
  }, [fetchData, fetchJournalEntries]);

  const firstName = useMemo(() => getFirstName(user), [user]);

  return (
    <PullToRefresh onRefresh={handlePullRefresh}>
    <div className="max-w-7xl mx-auto page-fade-in px-4">

      {/* ── Welcome header ── */}
      <div className="pt-6 pb-5">
        <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-1">JILD IMPEX Management</p>
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">
          {getGreeting()}{firstName ? `, ${firstName}` : ''} 👋
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">{formatToday()}</p>
      </div>

      {/* ── Search & filters ── */}
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
        <div className="mb-6 md:mb-8">
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
        <div className="mb-6 md:mb-8">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 uppercase tracking-wider mb-4">
            {searchTerm || activeFilter !== 'all' ? 'Search Results' : 'Recent Orders'}
          </h2>
          <RecentOrdersList
            orders={searchTerm || activeFilter !== 'all' ? filteredOrders : activeOrders}
            loading={loading}
            onStatusChange={fetchData}
          />
        </div>
      )}

      {/* Shared Modals for Journal */}
      {isJournalFormOpen && (
        <JournalEntryForm
          initialDate={editingEntry ? new Date(editingEntry.entry_date) : new Date()}
          initialEntry={editingEntry}
          onClose={() => {
            setIsJournalFormOpen(false);
            setEditingEntry(null);
          }}
          onSave={() => {
            setIsJournalFormOpen(false);
            setEditingEntry(null);
            fetchJournalEntries();
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
  );
};

export default HomePage;