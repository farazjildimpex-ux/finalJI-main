import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Plus, Search, X, ChevronRight, AlertCircle,
  FileText, Bookmark, Receipt, Edit2, Trash2, GitBranch,
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

/* ── helpers ─────────────────────────────────────────────────── */
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
function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function addCalendarDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
function startOfWeekMonday(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}
function formatMobileDay(date: Date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

/* ── filter config ───────────────────────────────────────────── */
const FILTERS = [
  { label: 'All',       value: 'all',        on: 'bg-gray-800 text-white border-gray-800',       off: 'bg-white text-gray-600 border-gray-200'       },
  { label: 'Open',      value: 'open',       on: 'bg-amber-500 text-white border-amber-500',     off: 'bg-white text-amber-700 border-amber-200'     },
  { label: 'Contracts', value: 'contract',   on: 'bg-indigo-600 text-white border-indigo-600',   off: 'bg-white text-indigo-700 border-indigo-200'   },
  { label: 'Letters',   value: 'sample',     on: 'bg-blue-600 text-white border-blue-600',       off: 'bg-white text-blue-700 border-blue-200'       },
  { label: 'Payments',  value: 'debit_note', on: 'bg-emerald-600 text-white border-emerald-600', off: 'bg-white text-emerald-700 border-emerald-200' },
];

const TYPE_ICON: Record<string, { Icon: any; bg: string; iconCls: string }> = {
  contract:   { Icon: FileText, bg: 'bg-indigo-50', iconCls: 'text-indigo-600' },
  sample:     { Icon: Bookmark, bg: 'bg-blue-50',   iconCls: 'text-blue-600'   },
  debit_note: { Icon: Receipt,  bg: 'bg-emerald-50',iconCls: 'text-emerald-600'},
};

const STATUS_BADGE: Record<string, string> = {
  issued:    'text-blue-700 bg-blue-50 border border-blue-100',
  inspected: 'text-amber-700 bg-amber-50 border border-amber-100',
  open:      'text-amber-700 bg-amber-50 border border-amber-100',
  completed: 'text-emerald-700 bg-emerald-50 border border-emerald-100',
  delivered: 'text-emerald-700 bg-emerald-50 border border-emerald-100',
};

const OPEN_STATUSES = ['Issued', 'Inspected'];
const ACTIVITY_PAGE_SIZE = 10;
const JOURNAL_PAGE_SIZE  = 12;

/* ── component ───────────────────────────────────────────────── */
const HomePage: React.FC = () => {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [showSearch,    setShowSearch]    = useState(false);
  const [searchTerm,    setSearchTerm]    = useState('');
  // Journal tab is the default (left tab)
  const [searchTab,     setSearchTab]     = useState<'journal' | 'records'>('journal');
  const [mobileFilter,  setMobileFilter]  = useState('open');
  const [activityPage,  setActivityPage]  = useState(1);
  const [desktopFilter, setDesktopFilter] = useState('all');
  const [desktopSearch, setDesktopSearch] = useState('');
  const [desktopJournalPage, setDesktopJournalPage] = useState(1);

  const [orders,          setOrders]         = useState<Order[]>([]);
  const [journalEntries,  setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading,         setLoading]        = useState(true);
  const [journalLoading,  setJournalLoading] = useState(true);
  const [error,           setError]          = useState<string | null>(null);

  const [editingEntry,          setEditingEntry]          = useState<JournalEntry | null>(null);
  const [selectedEntryForPopup, setSelectedEntryForPopup] = useState<JournalEntry | null>(null);
  const [isMobileFormOpen,      setIsMobileFormOpen]      = useState(false);
  const [isDesktopFormOpen,     setIsDesktopFormOpen]     = useState(false);
  const [mobileJournalDate,     setMobileJournalDate]     = useState(new Date());
  const [mobileWeekStart,       setMobileWeekStart]       = useState(() => startOfWeekMonday(new Date()));
  const [mobileOpenEntryId,     setMobileOpenEntryId]     = useState<string | null>(null);
  const weekTouchStartX = useRef<number | null>(null);
  const mobileEntryTapRef = useRef<{ id: string; time: number } | null>(null);
  const mobileEntryLongPressRef = useRef<number | null>(null);

  /* ── fetch ───────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    try {
      setLoading(true); setError(null);
      const [cR, sR, dR] = await Promise.all([
        supabase.from('contracts').select('*').order('contract_date',     { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200),
        supabase.from('samples').select('*').order('date',                { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200),
        supabase.from('debit_notes').select('*').order('debit_note_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200),
      ]);
      if (cR.error) throw cR.error;
      if (sR.error) throw sR.error;
      if (dR.error) throw dR.error;
      const c: Order[] = (cR.data||[]).map(c=>({ id:c.id,  contractNumber:c.contract_no,   supplierName:c.supplier_name, article:c.article||'',     color:c.color?.join(', ')||'', date:c.contract_date,   createdAt:c.created_at, status:c.status, type:'contract',   contractData:c }));
      const s: Order[] = (sR.data||[]).map(s=>({ id:s.id!, contractNumber:s.sample_number, supplierName:s.supplier_name, article:s.description||'', color:s.company_name||'',      date:s.date,            createdAt:s.created_at, status:s.status, type:'sample',    sampleData:s }));
      const d: Order[] = (dR.data||[]).map(d=>({ id:d.id!, contractNumber:d.debit_note_no, supplierName:d.supplier_name, article:d.contract_no||'', color:d.invoice_no||'',        date:d.debit_note_date, createdAt:d.created_at, status:d.status, type:'debit_note', debitNoteData:d }));
      const ms = (v?:string|null) => v ? new Date(v).getTime() : 0;
      setOrders([...c,...s,...d].sort((a,b)=>{ const dd=ms((b as any).date)-ms((a as any).date); return dd!==0?dd:ms((b as any).createdAt)-ms((a as any).createdAt); }));
    } catch(e){ console.error(e); setError('Failed to load data.'); }
    finally { setLoading(false); }
  }, []);

  const fetchJournalEntries = useCallback(async () => {
    if (!user||!isSupabaseConfigured) { setJournalLoading(false); return; }
    try {
      setJournalLoading(true);
      const { data, error } = await supabase.from('journal_entries').select('*').eq('user_id', user.id).order('entry_date', { ascending: false });
      if (error) throw error;
      setJournalEntries(data||[]);
    } catch(e){ console.error(e); }
    finally { setJournalLoading(false); }
  }, [user]);

  useEffect(()=>{ fetchData(); }, [fetchData]);
  useEffect(()=>{ if(user) fetchJournalEntries(); }, [user, fetchJournalEntries]);

  // Reset page when filter changes
  useEffect(()=>{ setActivityPage(1); }, [mobileFilter]);

  useEffect(()=>{
    const id = searchParams.get('entry');
    if (!id||journalLoading) return;
    const found = journalEntries.find(e=>e.id===id);
    if (found) { setSelectedEntryForPopup(found); setSearchParams({},{replace:true}); }
    else {
      supabase.from('journal_entries').select('*').eq('id',id).maybeSingle().then(({data})=>{
        if(data) setSelectedEntryForPopup(data as JournalEntry);
        setSearchParams({},{replace:true});
      });
    }
  }, [searchParams, journalEntries, journalLoading]);

  /* ── derived ─────────────────────────────────────────────── */
  const activityList = useMemo(()=>{
    if (mobileFilter==='open') return orders.filter(o=>OPEN_STATUSES.includes(o.status||''));
    if (mobileFilter!=='all')  return orders.filter(o=>o.type===mobileFilter);
    return orders;
  }, [orders, mobileFilter]);

  const activityTotal = Math.ceil(activityList.length / ACTIVITY_PAGE_SIZE);
  const activitySlice = activityList.slice((activityPage-1)*ACTIVITY_PAGE_SIZE, activityPage*ACTIVITY_PAGE_SIZE);

  const desktopOrders = useMemo(()=>{
    let list = desktopFilter==='all'  ? orders
      : desktopFilter==='open' ? orders.filter(o=>OPEN_STATUSES.includes(o.status||''))
      : orders.filter(o=>o.type===desktopFilter);
    if (desktopSearch.trim()) {
      const s=desktopSearch.toLowerCase();
      list=list.filter(o=>o.contractNumber.toLowerCase().includes(s)||o.supplierName.toLowerCase().includes(s)||o.article.toLowerCase().includes(s)||o.color.toLowerCase().includes(s));
    }
    return list;
  }, [orders, desktopFilter, desktopSearch]);

  const searchOrderResults = useMemo(()=>{
    if (!searchTerm.trim()) return [];
    const s=searchTerm.toLowerCase();
    return orders.filter(o=>o.contractNumber.toLowerCase().includes(s)||o.supplierName.toLowerCase().includes(s)||o.article.toLowerCase().includes(s)).slice(0,20);
  }, [orders, searchTerm]);

  const searchJournalResults = useMemo(()=>{
    if (!searchTerm.trim()) return [];
    const s=searchTerm.toLowerCase();
    return journalEntries.filter(e=>e.title.toLowerCase().includes(s)||(e.content&&e.content.toLowerCase().includes(s))).slice(0,12);
  }, [journalEntries, searchTerm]);

  const mobileJournalDateKey = useMemo(() => toDateKey(mobileJournalDate), [mobileJournalDate]);

  const mobileJournalEntries = useMemo(
    () => journalEntries.filter(entry => entry.entry_date === mobileJournalDateKey),
    [journalEntries, mobileJournalDateKey],
  );

  const mobileQueuePreview = activityList.slice((activityPage - 1) * ACTIVITY_PAGE_SIZE, activityPage * ACTIVITY_PAGE_SIZE);

  const weeklySearchActivity = useMemo(() => {
    const now = new Date();
    const thisStart = startOfWeekMonday(now).getTime();
    const lastStart = addCalendarDays(new Date(thisStart), -7).getTime();
    const nextStart = addCalendarDays(new Date(thisStart), 7).getTime();
    const toTime = (value?: string | null) => value ? new Date(value).getTime() : 0;
    return [
      { label: 'This week', items: orders.filter(o => {
        const t = toTime(o.date || o.createdAt);
        return t >= thisStart && t < nextStart;
      }).slice(0, 6) },
      { label: 'Last week', items: orders.filter(o => {
        const t = toTime(o.date || o.createdAt);
        return t >= lastStart && t < thisStart;
      }).slice(0, 6) },
    ];
  }, [orders]);

  const handleWeekTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (weekTouchStartX.current == null) return;
    const delta = e.changedTouches[0].clientX - weekTouchStartX.current;
    if (Math.abs(delta) > 48) {
      setMobileWeekStart(d => addCalendarDays(d, delta < 0 ? 7 : -7));
    }
    weekTouchStartX.current = null;
  };

  const handleMobileDeleteEntry = async (entry: JournalEntry) => {
    const ok = await dialogService.confirm({
      title: 'Delete entry?',
      message: 'Are you sure you want to delete this journal entry? This action cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    const { error } = await supabase.from('journal_entries').delete().eq('id', entry.id);
    if (error) {
      dialogService.alert({ title: 'Failed to delete entry', message: error.message, tone: 'danger' });
      return;
    }
    setMobileOpenEntryId(null);
    fetchJournalEntries();
    dialogService.success('Entry deleted.');
  };

  const handleMobileEntryPress = (entry: JournalEntry) => {
    if (mobileEntryLongPressRef.current) window.clearTimeout(mobileEntryLongPressRef.current);
    mobileEntryLongPressRef.current = window.setTimeout(() => {
      setSelectedEntryForPopup(entry);
      setMobileOpenEntryId(null);
      mobileEntryLongPressRef.current = null;
    }, 520);
  };

  const clearMobileEntryPress = () => {
    if (mobileEntryLongPressRef.current) window.clearTimeout(mobileEntryLongPressRef.current);
    mobileEntryLongPressRef.current = null;
  };

  const handleMobileEntryTap = (entry: JournalEntry) => {
    const now = Date.now();
    const last = mobileEntryTapRef.current;
    if (last?.id === entry.id && now - last.time < 320) {
      setSelectedEntryForPopup(entry);
      setMobileOpenEntryId(null);
      mobileEntryTapRef.current = null;
      return;
    }
    mobileEntryTapRef.current = { id: entry.id, time: now };
    setMobileOpenEntryId(id => id === entry.id ? null : entry.id);
  };

  /* ── handlers ────────────────────────────────────────────── */
  const handlePullRefresh = useCallback(async()=>{ await Promise.all([fetchData(), fetchJournalEntries()]); }, [fetchData, fetchJournalEntries]);

  const goToOrder = useCallback((order: Order)=>{
    if (order.type==='contract')    navigate(`/app/contracts/${order.id}`,   {state:{contract:order.contractData}});
    else if (order.type==='sample') navigate(`/app/samples/${order.id}`,     {state:{sample:order.sampleData}});
    else                            navigate(`/app/debit-notes/${order.id}`, {state:{debitNote:order.debitNoteData}});
  }, [navigate]);

  const handleJournalSave = useCallback(async(savedEntry?: JournalEntry)=>{
    setIsMobileFormOpen(false); setIsDesktopFormOpen(false); setEditingEntry(null);
    fetchJournalEntries();
    if (savedEntry&&!savedEntry.parent_id) {
      const ten=new Date(); ten.setDate(ten.getDate()-10);
      const past=journalEntries.filter(e=>e.id!==savedEntry.id&&new Date(e.entry_date)>=ten);
      if (past.length>0) {
        dialogService.toast({message:'AI is looking for related entries…',durationMs:2000});
        const sg=await suggestJournalLink(savedEntry,past);
        if (sg.suggested_parent_id) {
          const parent=past.find(e=>e.id===sg.suggested_parent_id);
          if (parent) {
            const link=await dialogService.confirm({title:'Link Journal Entry?',message:`AI noticed this entry is related to: "${parent.title}".\n\nReason: ${sg.reasoning}\n\nLink them?`,confirmLabel:'Link Entries'});
            if (link) { await supabase.from('journal_entries').update({parent_id:parent.id}).eq('id',savedEntry.id); fetchJournalEntries(); dialogService.success('Entries linked.'); }
          }
        }
      }
    }
  }, [journalEntries, fetchJournalEntries]);

  const openSearch = () => {
    setShowSearch(true);
    setSearchTerm('');
    setSearchTab('journal');
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Configuration Required</h2>
        <p className="text-gray-600">Please connect your Supabase project.</p>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ━━━━━━━━━━━━━━━━━━  MOBILE  ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div
        className="md:hidden min-h-screen bg-gray-50 text-gray-900"
        style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
      >
        <PullToRefresh onRefresh={handlePullRefresh}>
          <div className="px-4 pt-4 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-gray-400">{formatFullDate()}</p>
                <h1 className="mt-1 text-[22px] font-bold leading-tight tracking-normal">{getGreeting()}</h1>
              </div>
              <button
                onClick={openSearch}
                className="h-10 w-10 rounded-xl bg-white border border-gray-200 text-gray-600 flex items-center justify-center active:bg-gray-100 transition-colors shadow-sm"
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>

            <section className="mt-4 rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between gap-4 border-b border-gray-100">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-bold text-gray-900 leading-tight">Journal</h2>
                  <p className="mt-0.5 text-[11px] font-medium text-gray-400">
                    {formatMobileDay(mobileWeekStart)} - {formatMobileDay(addCalendarDays(mobileWeekStart, 6))}
                  </p>
                </div>
                <button
                  onClick={() => { setEditingEntry(null); setIsMobileFormOpen(true); }}
                  className="h-8 px-3 rounded-lg bg-blue-600 text-white text-[11px] font-bold flex items-center gap-1.5 active:bg-blue-700 transition-colors"
                >
                  <Plus className="h-3 w-3" /> New
                </button>
              </div>

              <div
                className="px-4 py-3 border-b border-gray-50"
                onTouchStart={(e) => { weekTouchStartX.current = e.changedTouches[0].clientX; }}
                onTouchEnd={handleWeekTouchEnd}
              >
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 7 }, (_, offset) => {
                    const date = addCalendarDays(mobileWeekStart, offset);
                    const isSelected = toDateKey(date) === mobileJournalDateKey;
                    return (
                      <button
                        key={offset}
                        onClick={() => setMobileJournalDate(date)}
                        className={`h-11 rounded-lg text-center transition-colors ${
                          isSelected
                            ? 'text-blue-600'
                            : 'text-gray-500 active:bg-gray-50'
                        }`}
                      >
                        <span className="block text-[10px] font-semibold uppercase leading-none">
                          {date.toLocaleDateString('en-GB', { weekday: 'short' })}
                        </span>
                        <span className="block mt-1 text-[13px] font-bold leading-none">
                          {date.getDate()}
                        </span>
                        {isSelected && <span className="mx-auto mt-1 block h-0.5 w-5 rounded-full bg-blue-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="px-4 pb-3 space-y-2">
                {journalLoading ? (
                  <div className="h-20 rounded-xl bg-gray-50 flex items-center justify-center">
                    <div className="h-5 w-5 rounded-full border-2 border-gray-200 border-b-blue-600 animate-spin" />
                  </div>
                ) : mobileJournalEntries.length === 0 ? (
                  <button onClick={() => { setEditingEntry(null); setIsMobileFormOpen(true); }} className="w-full rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-4 text-left active:bg-gray-100">
                    <p className="text-[13px] font-semibold text-gray-700">No journal entries</p>
                    <p className="mt-1 text-[11px] leading-5 text-gray-400">Add a note for this day.</p>
                  </button>
                ) : (
                  mobileJournalEntries.slice(0, 3).map(entry => (
                    <div key={entry.id} className="rounded-xl bg-gray-50 border border-gray-100 overflow-hidden">
                      <button
                        onMouseDown={() => handleMobileEntryPress(entry)}
                        onMouseUp={clearMobileEntryPress}
                        onMouseLeave={clearMobileEntryPress}
                        onTouchStart={() => handleMobileEntryPress(entry)}
                        onTouchEnd={clearMobileEntryPress}
                        onTouchCancel={clearMobileEntryPress}
                        onClick={() => handleMobileEntryTap(entry)}
                        className="w-full px-3.5 py-3 text-left active:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold text-gray-900 truncate">{entry.title}</p>
                            {entry.content && <p className="mt-1 text-[11px] leading-5 text-gray-500 line-clamp-2">{entry.content}</p>}
                          </div>
                          <ChevronRight className={`h-4 w-4 text-gray-300 mt-1 shrink-0 transition-transform ${mobileOpenEntryId === entry.id ? 'rotate-90' : ''}`} />
                        </div>
                      </button>
                      <div className={`overflow-hidden transition-all duration-200 ${mobileOpenEntryId === entry.id ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-t border-gray-100 bg-white">
                          <button
                            onClick={() => { setEditingEntry(entry); setIsMobileFormOpen(true); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-blue-600 bg-blue-50 active:bg-blue-100"
                          >
                            <Edit2 className="h-3 w-3" /> Edit
                          </button>
                          <button
                            onClick={() => setSelectedEntryForPopup(entry)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-gray-600 bg-gray-100 active:bg-gray-200"
                          >
                            <GitBranch className="h-3 w-3" /> Thread
                          </button>
                          <button
                            onClick={() => handleMobileDeleteEntry(entry)}
                            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-rose-600 bg-rose-50 active:bg-rose-100"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="mt-4">
              <div className="rounded-2xl bg-white overflow-hidden shadow-sm border border-gray-100">
                <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-100">
                  <div>
                    <h2 className="text-[15px] font-bold text-gray-900">Recents</h2>
                    <p className="mt-0.5 text-[11px] text-gray-400">{activityList.length} items shown</p>
                  </div>
                  <button onClick={openSearch} className="text-[12px] font-bold text-blue-600">Search</button>
                </div>

                <div className="px-3 py-2.5 border-b border-gray-100 overflow-x-auto no-scrollbar">
                  <div className="flex gap-1.5 min-w-max">
                    {FILTERS.map(f => (
                      <button
                        key={f.value}
                        onClick={() => setMobileFilter(f.value)}
                        className={`h-7 px-3 rounded-full text-[11px] font-semibold border transition-colors ${mobileFilter === f.value ? f.on : f.off}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="m-3 p-3 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-2 text-red-700 text-[12px]">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{error}</span>
                    <button onClick={fetchData} className="font-black underline">Retry</button>
                  </div>
                )}

                {loading ? (
                  <div className="py-10 flex justify-center">
                    <div className="h-5 w-5 rounded-full border-2 border-slate-200 border-b-slate-950 animate-spin" />
                  </div>
                ) : mobileQueuePreview.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-[13px] font-bold text-slate-400">No records found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {mobileQueuePreview.map(order => {
                      const tc = TYPE_ICON[order.type] || { Icon: FileText, bg: 'bg-slate-50', iconCls: 'text-slate-500' };
                      const Icon = tc.Icon;
                      const badge = STATUS_BADGE[(order.status || 'issued').toLowerCase()] || 'text-slate-600 bg-slate-50 border border-slate-200';
                      return (
                        <button key={`${order.type}-${order.id}`} onClick={() => goToOrder(order)} className="w-full px-4 py-3.5 text-left flex items-center gap-3 active:bg-slate-50">
                          <div className={`h-10 w-10 rounded-2xl ${tc.bg} flex items-center justify-center shrink-0`}>
                            <Icon className={`h-4 w-4 ${tc.iconCls}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold text-gray-900 truncate">{order.contractNumber}</p>
                            <p className="mt-0.5 text-[11px] text-gray-500 truncate">{order.supplierName}</p>
                            {[order.article, order.color].filter(Boolean).length > 0 && (
                              <p className="mt-0.5 text-[10px] text-gray-400 truncate">
                                {[order.article, order.color].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </div>
                          <span className={`px-2 py-1 rounded-full text-[10px] font-semibold shrink-0 ${badge}`}>{order.status || 'Issued'}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {activityTotal > 1 && (
                  <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-3">
                    <p className="text-[11px] font-medium text-gray-400">
                      {(activityPage - 1) * ACTIVITY_PAGE_SIZE + 1}-{Math.min(activityPage * ACTIVITY_PAGE_SIZE, activityList.length)} of {activityList.length}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: Math.min(activityTotal, 5) }, (_, idx) => idx + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setActivityPage(page)}
                          className={`h-7 w-7 rounded-lg text-[11px] font-bold ${
                            activityPage === page ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-500 border border-gray-200'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </PullToRefresh>
      </div>

      <div
        className="hidden"
        style={{
          background: 'linear-gradient(180deg, #F7F9FC 0%, #FFFFFF 48%, #F8FAFC 100%)',
          paddingBottom: 'calc(52px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <PullToRefresh onRefresh={handlePullRefresh}>

          {/* ── Header ──────────────────────────────────────── */}
          <div className="sticky top-0 z-20 bg-[#F8FAFC]/95 backdrop-blur-xl px-4 pt-3 pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 leading-none">
                  {formatFullDate()}
                </p>
                <p className="mt-1 text-[22px] font-black text-slate-950 leading-tight">{getGreeting()}</p>
              </div>
              <button
                onClick={openSearch}
                className="h-11 w-11 shrink-0 rounded-2xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center active:scale-95 transition-transform shadow-sm"
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Journal — single unified card ───────────────── */}
          <div className="mx-4 mt-2">
            <div className="bg-white rounded-[26px] border border-slate-100 shadow-[0_14px_40px_rgba(15,23,42,0.07)] overflow-hidden">
              <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-black text-slate-950 leading-tight">Journal</h2>
                  <p className="text-[12px] text-slate-400 mt-0.5">Notes for the selected day</p>
                </div>
                <button
                  onClick={() => { setEditingEntry(null); setIsMobileFormOpen(true); }}
                  className="h-10 px-3.5 rounded-2xl bg-slate-950 text-white text-[12px] font-bold flex items-center gap-1.5 active:scale-95 transition-transform"
                >
                  <Plus className="h-3.5 w-3.5" /> New
                </button>
              </div>
              <div className="px-3 pb-3 pt-0">
                <JournalWidget
                  entries={journalEntries}
                  loading={journalLoading}
                  onEntriesUpdated={fetchJournalEntries}
                  hideHeader
                  noCard
                />
              </div>
            </div>
          </div>

          {/* ── Recent Activity ──────────────────────────────── */}
          <div className="mx-4 mt-5 mb-3">
            <div className="space-y-3">
              <div>
                <h2 className="text-[18px] font-black text-slate-950 leading-tight">Work Queue</h2>
                <p className="text-[12px] text-slate-400 mt-0.5 mb-3">{activityList.length} matching records</p>
                <div className="-mx-4 px-4 flex gap-2 overflow-x-auto no-scrollbar">
                  {FILTERS.map(f => (
                    <button
                      key={f.value}
                      onClick={() => setMobileFilter(f.value)}
                      className={`h-9 px-4 rounded-2xl text-[12px] font-bold border transition-all shrink-0 ${mobileFilter===f.value ? 'bg-slate-950 text-white border-slate-950 shadow-sm' : 'bg-white text-slate-500 border-slate-200'}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-2 text-red-700 text-[12px]">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{error}</span>
                  <button onClick={fetchData} className="font-bold underline">Retry</button>
                </div>
              )}

              {loading ? (
                <div className="bg-white rounded-[22px] border border-gray-100 shadow-sm flex justify-center py-9">
                  <div className="animate-spin h-5 w-5 rounded-full border-2 border-gray-200 border-b-blue-600" />
                </div>
              ) : activityList.length === 0 ? (
                <div className="bg-white rounded-[22px] border border-gray-100 shadow-sm py-9 text-center">
                  <p className="text-[13px] font-semibold text-gray-500">No records found</p>
                </div>
              ) : (
                <>
                  {activitySlice.map((order) => {
                    const tc   = TYPE_ICON[order.type] || { Icon: FileText, bg:'bg-gray-50', iconCls:'text-gray-500' };
                    const Icon = tc.Icon;
                    const sk   = (order.status||'issued').toLowerCase();
                    const badge = STATUS_BADGE[sk] || 'text-gray-600 bg-gray-50 border border-gray-200';
                    const line1 = [order.article, order.color].filter(Boolean).join(' · ') || order.contractNumber;
                    return (
                      <button
                        key={`${order.type}-${order.id}`}
                        onClick={() => goToOrder(order)}
                        className="w-full bg-white rounded-[20px] border border-slate-100 shadow-sm px-3.5 py-3.5 text-left active:scale-[0.99] transition-transform flex items-center gap-3"
                      >
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${tc.bg}`}>
                          <Icon className={`h-4 w-4 ${tc.iconCls}`} strokeWidth={1.75} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-[13px] font-black text-slate-950 truncate leading-snug">{line1}</p>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${badge}`}>
                              {order.status || 'Issued'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-1">{order.supplierName}</p>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">{order.contractNumber}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
                      </button>
                    );
                  })}

                  {/* Pagination */}
                  {activityTotal > 1 && (
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-[11px] text-gray-400">
                        {(activityPage-1)*ACTIVITY_PAGE_SIZE+1}–{Math.min(activityPage*ACTIVITY_PAGE_SIZE, activityList.length)} of {activityList.length}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setActivityPage(p => Math.max(1, p-1))}
                          disabled={activityPage === 1}
                          className="h-8 px-3 rounded-full text-[11px] font-bold bg-white border border-gray-200 text-gray-600 disabled:opacity-30 active:bg-gray-50 transition-colors"
                        >
                          ‹ Prev
                        </button>
                        <button
                          onClick={() => setActivityPage(p => Math.min(activityTotal, p+1))}
                          disabled={activityPage === activityTotal}
                          className="h-8 px-3 rounded-full text-[11px] font-bold bg-white border border-gray-200 text-gray-600 disabled:opacity-30 active:bg-gray-50 transition-colors"
                        >
                          Next ›
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

        </PullToRefresh>
      </div>

      {/* ── Search overlay ── */}
      {showSearch && (
        <div
          className="md:hidden fixed inset-0 z-[200] flex flex-col bg-gray-50"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom,0px)',
            animation: 'fadeIn 0.18s ease-out',
          }}
        >
          {/* Input bar */}
          <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-3 shadow-sm">
            <div className="flex items-center gap-2 mb-0">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  autoFocus
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search journals, contracts, suppliers…"
                  className="w-full h-11 pl-9 pr-10 bg-gray-50 border border-gray-200 rounded-xl text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center active:bg-gray-400"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                )}
              </div>
              <button
                onClick={() => { setShowSearch(false); setSearchTerm(''); }}
                className="shrink-0 h-11 px-2 text-[13px] font-semibold text-gray-500 active:text-gray-700"
              >
                Cancel
              </button>
            </div>

            {/* Tabs — Journal (left, default) | Records (right) */}
            <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
              <button
                onClick={() => setSearchTab('journal')}
                className={`h-8 rounded-lg text-[12px] font-semibold transition-colors ${searchTab==='journal' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                Journal
              </button>
              <button
                onClick={() => setSearchTab('records')}
                className={`h-8 rounded-lg text-[12px] font-semibold transition-colors ${searchTab==='records' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                Recents
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            {!searchTerm.trim() ? (
              <div className="p-4" style={{animation:'fadeIn 0.2s ease-out'}}>
                <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-[13px] font-bold text-gray-900">Activity by week</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Recent contracts, letters and payments</p>
                  </div>
                  {weeklySearchActivity.map((group) => (
                    <div key={group.label} className="border-b border-gray-100 last:border-b-0">
                      <div className="px-4 py-2 bg-gray-50">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{group.label}</p>
                      </div>
                      {group.items.length === 0 ? (
                        <div className="px-4 py-4">
                          <p className="text-[12px] text-gray-400">No activity</p>
                        </div>
                      ) : (
                        group.items.map((order) => {
                          const tc = TYPE_ICON[order.type] || { Icon: FileText, bg:'bg-gray-50', iconCls:'text-gray-500' };
                          const Icon = tc.Icon;
                          return (
                            <button
                              key={`weekly-${group.label}-${order.type}-${order.id}`}
                              onClick={() => { goToOrder(order); setShowSearch(false); }}
                              className="w-full px-4 py-3 flex items-center gap-3 text-left active:bg-gray-50 border-t border-gray-50 first:border-t-0"
                            >
                              <div className={`h-8 w-8 rounded-lg ${tc.bg} flex items-center justify-center shrink-0`}>
                                <Icon className={`h-4 w-4 ${tc.iconCls}`} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[12px] font-semibold text-gray-900 truncate">{order.contractNumber}</p>
                                <p className="text-[10px] text-gray-400 truncate">{order.supplierName}</p>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                            </button>
                          );
                        })
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : searchOrderResults.length === 0 && searchJournalResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center" style={{animation:'fadeIn 0.15s ease-out'}}>
                <p className="text-[15px] font-bold text-gray-700 mb-1.5">No results</p>
                <p className="text-[12px] text-gray-400">Try a different search term</p>
              </div>
            ) : (
              <div className="p-4" key={searchTab} style={{animation:'fadeIn 0.15s ease-out'}}>

                {/* JOURNAL TAB */}
                {searchTab === 'journal' && (
                  searchJournalResults.length === 0 ? (
                    <div className="text-center py-14">
                      <p className="text-[13px] text-gray-400">No matching journal entries</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      {searchJournalResults.map((entry, idx) => (
                        <button
                          key={`sj-${entry.id}`}
                          onClick={() => { setSelectedEntryForPopup(entry); setShowSearch(false); setSearchTerm(''); }}
                          className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 ${idx>0?'border-t border-gray-50':''}`}
                        >
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-indigo-50">
                            <FileText className="h-4 w-4 text-indigo-500" strokeWidth={1.75} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-bold text-gray-900 truncate">{entry.title}</p>
                            <p className="text-[10px] text-gray-400">
                              {new Date(entry.entry_date).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'})}
                            </p>
                            {entry.content && (
                              <p className="text-[10px] text-gray-400 truncate mt-0.5">{entry.content}</p>
                            )}
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )
                )}

                {/* RECORDS TAB */}
                {searchTab === 'records' && (
                  searchOrderResults.length === 0 ? (
                    <div className="text-center py-14">
                      <p className="text-[13px] text-gray-400">No matching contracts, letters or payments</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      {searchOrderResults.map((order, idx) => {
                        const tc   = TYPE_ICON[order.type] || { Icon: FileText, bg:'bg-gray-50', iconCls:'text-gray-500' };
                        const Icon = tc.Icon;
                        const sk   = (order.status||'issued').toLowerCase();
                        const badge = STATUS_BADGE[sk] || 'text-gray-600 bg-gray-50 border border-gray-200';
                        const line1 = [order.article, order.color].filter(Boolean).join(' · ') || order.contractNumber;
                        return (
                          <button
                            key={`sr-${order.type}-${order.id}`}
                            onClick={() => { goToOrder(order); setShowSearch(false); setSearchTerm(''); }}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 ${idx>0?'border-t border-gray-50':''}`}
                          >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${tc.bg}`}>
                              <Icon className={`h-4 w-4 ${tc.iconCls}`} strokeWidth={1.75} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-bold text-gray-900 truncate">{line1}</p>
                              <p className="text-[10px] text-gray-400 truncate">{order.supplierName}</p>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${badge}`}>{order.status||'Issued'}</span>
                            <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  )
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

      {/* ━━━━━━━━━━━━━━━━━━  DESKTOP  ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
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
              <p className="text-[12px] text-gray-400 mt-1">{formatFullDate()}</p>
            </div>
            <div className="shrink-0 pt-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text" value={desktopSearch} onChange={e=>setDesktopSearch(e.target.value)}
                  placeholder="Search orders & journal…"
                  className="h-9 pl-8 pr-3 w-72 text-[13px] bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* LEFT: Journal */}
          <div className="w-[360px] shrink-0 border-r border-gray-100 flex flex-col bg-gray-50 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3 flex flex-col momentum-scroll">
              {desktopSearch.trim() ? (() => {
                const s = desktopSearch.toLowerCase();
                const matched = journalEntries.filter(e=>e.title.toLowerCase().includes(s)||(e.content&&e.content.toLowerCase().includes(s)));
                const total = Math.max(1, Math.ceil(matched.length/JOURNAL_PAGE_SIZE));
                const pg    = Math.min(desktopJournalPage, total);
                const slice = matched.slice((pg-1)*JOURNAL_PAGE_SIZE, pg*JOURNAL_PAGE_SIZE);
                return (
                  <div className="flex flex-col flex-1 min-h-0">
                    {matched.length===0 ? (
                      <p className="text-[12px] text-gray-400 text-center py-6">No entries match "{desktopSearch}"</p>
                    ) : (
                      <>
                        <div className="space-y-2 pb-3">
                          {slice.map(entry=>(
                            <div key={entry.id}
                              className="rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm cursor-pointer hover:border-blue-200 transition-colors"
                              onClick={()=>setSelectedEntryForPopup(entry)}>
                              <p className="text-[13px] font-bold text-gray-800 line-clamp-1">{entry.title}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{new Date(entry.entry_date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</p>
                              {entry.content&&<p className="text-[12px] text-gray-500 mt-1 line-clamp-2">{entry.content}</p>}
                            </div>
                          ))}
                        </div>
                        {total>1&&(
                          <div className="flex items-center justify-between pt-1 pb-3 border-t border-gray-100 mt-auto shrink-0">
                            <p className="text-[11px] text-gray-400">{(pg-1)*JOURNAL_PAGE_SIZE+1}–{Math.min(pg*JOURNAL_PAGE_SIZE,matched.length)} of {matched.length}</p>
                            <div className="flex gap-1">
                              <button onClick={()=>setDesktopJournalPage(p=>Math.max(1,p-1))} disabled={pg===1} className="px-2.5 py-1 rounded-lg text-[11px] bg-gray-100 text-gray-600 disabled:opacity-30 hover:bg-gray-200">‹ Prev</button>
                              <button onClick={()=>setDesktopJournalPage(p=>Math.min(total,p+1))} disabled={pg===total} className="px-2.5 py-1 rounded-lg text-[11px] bg-gray-100 text-gray-600 disabled:opacity-30 hover:bg-gray-200">Next ›</button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })() : (
                <section className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between gap-4 border-b border-gray-100">
                    <div className="min-w-0">
                      <h2 className="text-[15px] font-bold text-gray-900 leading-tight">Journal</h2>
                      <p className="mt-0.5 text-[11px] font-medium text-gray-400">
                        {formatMobileDay(mobileWeekStart)} - {formatMobileDay(addCalendarDays(mobileWeekStart, 6))}
                      </p>
                    </div>
                    <button
                      onClick={() => { setEditingEntry(null); setIsDesktopFormOpen(true); }}
                      className="h-8 px-3 rounded-lg bg-blue-600 text-white text-[11px] font-bold flex items-center gap-1.5 hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="h-3 w-3" /> New
                    </button>
                  </div>

                  <div
                    className="px-4 py-3 border-b border-gray-50"
                    onTouchStart={(e) => { weekTouchStartX.current = e.changedTouches[0].clientX; }}
                    onTouchEnd={handleWeekTouchEnd}
                  >
                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: 7 }, (_, offset) => {
                        const date = addCalendarDays(mobileWeekStart, offset);
                        const isSelected = toDateKey(date) === mobileJournalDateKey;
                        return (
                          <button
                            key={offset}
                            onClick={() => setMobileJournalDate(date)}
                            className={`h-11 rounded-lg text-center transition-colors ${
                              isSelected
                                ? 'text-blue-600'
                                : 'text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            <span className="block text-[10px] font-semibold uppercase leading-none">
                              {date.toLocaleDateString('en-GB', { weekday: 'short' })}
                            </span>
                            <span className="block mt-1 text-[13px] font-bold leading-none">
                              {date.getDate()}
                            </span>
                            {isSelected && <span className="mx-auto mt-1 block h-0.5 w-5 rounded-full bg-blue-600" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="px-4 pb-3 pt-3 space-y-2">
                    {journalLoading ? (
                      <div className="h-20 rounded-xl bg-gray-50 flex items-center justify-center">
                        <div className="h-5 w-5 rounded-full border-2 border-gray-200 border-b-blue-600 animate-spin" />
                      </div>
                    ) : mobileJournalEntries.length === 0 ? (
                      <button onClick={() => { setEditingEntry(null); setIsDesktopFormOpen(true); }} className="w-full rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-4 text-left hover:bg-gray-100">
                        <p className="text-[13px] font-semibold text-gray-700">No journal entries</p>
                        <p className="mt-1 text-[11px] leading-5 text-gray-400">Add a note for this day.</p>
                      </button>
                    ) : (
                      mobileJournalEntries.slice(0, 8).map(entry => (
                        <div key={entry.id} className="rounded-xl bg-gray-50 border border-gray-100 overflow-hidden">
                          <button
                            onMouseDown={() => handleMobileEntryPress(entry)}
                            onMouseUp={clearMobileEntryPress}
                            onMouseLeave={clearMobileEntryPress}
                            onClick={() => handleMobileEntryTap(entry)}
                            className="w-full px-3.5 py-3 text-left hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-semibold text-gray-900 truncate">{entry.title}</p>
                                {entry.content && <p className="mt-1 text-[11px] leading-5 text-gray-500 line-clamp-2">{entry.content}</p>}
                              </div>
                              <ChevronRight className={`h-4 w-4 text-gray-300 mt-1 shrink-0 transition-transform ${mobileOpenEntryId === entry.id ? 'rotate-90' : ''}`} />
                            </div>
                          </button>
                          <div className={`overflow-hidden transition-all duration-200 ${mobileOpenEntryId === entry.id ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'}`}>
                            <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-t border-gray-100 bg-white">
                              <button
                                onClick={() => { setEditingEntry(entry); setIsDesktopFormOpen(true); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100"
                              >
                                <Edit2 className="h-3 w-3" /> Edit
                              </button>
                              <button
                                onClick={() => setSelectedEntryForPopup(entry)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200"
                              >
                                <GitBranch className="h-3 w-3" /> Thread
                              </button>
                              <button
                                onClick={() => handleMobileDeleteEntry(entry)}
                                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100"
                              >
                                <Trash2 className="h-3 w-3" /> Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>

          {/* RIGHT: Recent Activity */}
          <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">
            <div className="px-4 pt-3 pb-2.5 border-b border-gray-100 bg-white shrink-0">
              <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Recent Activity</h2>
              <div className="flex gap-1.5 flex-wrap">
                {FILTERS.map(f=>(
                  <button key={f.value} onClick={()=>setDesktopFilter(f.value)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all ${desktopFilter===f.value?f.on:f.off}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {error&&(
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center text-red-700 text-sm">
                  <AlertCircle className="h-5 w-5 mr-3 shrink-0"/>{error}
                  <button onClick={fetchData} className="ml-auto font-bold underline">Retry</button>
                </div>
              )}
              <RecentOrdersList orders={desktopOrders} loading={loading} onStatusChange={fetchData} />
            </div>
          </div>
        </div>
      </div>

      {isDesktopFormOpen&&(
        <JournalEntryForm initialDate={new Date()} initialEntry={null}
          onClose={()=>setIsDesktopFormOpen(false)} onSave={handleJournalSave} />
      )}

      {selectedEntryForPopup&&(
        <JournalEntryPopup entry={selectedEntryForPopup} allEntries={journalEntries}
          onClose={()=>setSelectedEntryForPopup(null)} onUpdate={fetchJournalEntries} />
      )}
    </>
  );
};

export default HomePage;
