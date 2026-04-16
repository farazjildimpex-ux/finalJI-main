import { useEffect, useState, useCallback } from 'react';
import SearchBar from './SearchBar';
import RecentOrdersList from './RecentOrdersList';
import JournalWidget from './JournalWidget';
import JournalSearchResults from '../Journal/JournalSearchResults';
import JournalEntryForm from '../Journal/JournalEntryForm';
import JournalEntryPopup from '../Journal/JournalEntryPopup';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { Building2, AlertCircle, FileText, Bookmark, Receipt, PlusCircle } from 'lucide-react';
import type { Order, JournalEntry } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [journalLoading, setJournalLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        supabase.from('contracts').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('samples').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('debit_notes').select('*').order('created_at', { ascending: false }).limit(50)
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
      setError('Failed to load recent orders.');
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
    const searchLower = searchTerm.toLowerCase();
    return (
      order.contractNumber.toLowerCase().includes(searchLower) ||
      order.supplierName.toLowerCase().includes(searchLower) ||
      order.article.toLowerCase().includes(searchLower) ||
      order.color.toLowerCase().includes(searchLower)
    );
  });

  const filteredJournal = journalEntries.filter((entry) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      entry.title.toLowerCase().includes(searchLower) || 
      (entry.content && entry.content.toLowerCase().includes(searchLower))
    );
  });

  const activeOrders = orders.filter((order) => order.status !== 'Completed');
  const stats = {
    contracts: orders.filter(o => o.type === 'contract' && o.status !== 'Completed').length,
    letters: orders.filter(o => o.type === 'sample' && o.status !== 'Completed').length,
    payments: orders.filter(o => o.type === 'debit_note' && o.status !== 'Completed').length,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8 page-fade-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">JILD IMPEX</h1>
          </div>
          <p className="text-slate-500 font-medium ml-11">Leather Import/Export Management</p>
        </div>
        
        <div className="w-full md:w-96">
          <SearchBar
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            placeholder="Search contracts, suppliers, articles..."
          />
        </div>
      </div>

      {/* Quick Stats Row */}
      {!searchTerm && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{stats.contracts}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Contracts</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
              <Bookmark className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{stats.letters}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Letters</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
              <Receipt className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{stats.payments}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Open Payments</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Journal & Search Results */}
        <div className="lg:col-span-4 space-y-6">
          {searchTerm ? (
            <JournalSearchResults
              entries={filteredJournal}
              searchTerm={searchTerm}
              onEntriesUpdated={fetchJournalEntries}
              onDoubleTap={(e) => setSelectedEntryForPopup(e)}
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
          
          {/* Quick Actions Card */}
          {!searchTerm && (
            <div className="bg-slate-900 rounded-[32px] p-6 text-white shadow-xl shadow-slate-200">
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => navigate('/app/contracts')}
                  className="flex flex-col items-center justify-center p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all group"
                >
                  <PlusCircle className="h-6 w-6 mb-2 text-blue-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold">New Contract</span>
                </button>
                <button 
                  onClick={() => navigate('/app/debit-notes')}
                  className="flex flex-col items-center justify-center p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all group"
                >
                  <PlusCircle className="h-6 w-6 mb-2 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold">New Payment</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Orders List */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                {searchTerm ? 'Search Results' : 'Recent Activity'}
              </h2>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {searchTerm ? `${filteredOrders.length} found` : 'Latest 50'}
              </span>
            </div>
            <RecentOrdersList
              orders={searchTerm ? filteredOrders : activeOrders}
              loading={loading}
              onStatusChange={fetchData}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
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
  );
};

export default HomePage;