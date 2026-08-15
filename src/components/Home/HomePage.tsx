import { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Plus, Search, X, ChevronRight, AlertCircle,
  FileText, Bookmark, Receipt, Edit2, Trash2, GitBranch, CalendarClock,
  Pin, CheckCircle2, GripVertical,
} from 'lucide-react';
import RecentOrdersList from './RecentOrdersList';
import JournalWidget from './JournalWidget';
import EmailPreviewSection from '../Email/EmailPreviewSection';
import JournalEntryForm from '../Journal/JournalEntryForm';
import JournalEntryPopup from '../Journal/JournalEntryPopup';
import MobilePageHeader from '../Layout/MobilePageHeader';
import PullToRefresh from '../UI/PullToRefresh';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import type { Order, JournalEntry, Invoice } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { suggestJournalLink } from '../../lib/journalAI';
import StatusChangePopup from '../UI/StatusChangePopup';
import { updateOrderStatus } from '../../utils/orderStatus';
import { dialogService } from '../../lib/dialogService';
import { buildJournalDueItems, type JournalDueItem } from '../../lib/journalDueItems';

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

function formatWeekRange(start: Date) {
  const end = addCalendarDays(start, 6);
  return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
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

const DUE_THEME: Record<string, { Icon: any; wrap: string; icon: string; badge: string }> = {
  contract:   { Icon: FileText, wrap: 'border-blue-100 bg-blue-50/70',       icon: 'bg-white text-blue-600 border-blue-100',       badge: 'bg-blue-100 text-blue-700' },
  sample:     { Icon: Bookmark, wrap: 'border-sky-100 bg-sky-50/70',         icon: 'bg-white text-sky-600 border-sky-100',         badge: 'bg-sky-100 text-sky-700' },
  debit_note: { Icon: Receipt,  wrap: 'border-emerald-100 bg-emerald-50/70', icon: 'bg-white text-emerald-600 border-emerald-100', badge: 'bg-emerald-100 text-emerald-700' },
  invoice:    { Icon: Receipt,  wrap: 'border-amber-100 bg-amber-50/70',     icon: 'bg-white text-amber-600 border-amber-100',     badge: 'bg-amber-100 text-amber-700' },
};

const STATUS_BADGE: Record<string, string> = {
  issued:    'text-blue-700 bg-blue-50 border border-blue-100',
  inspected: 'text-amber-700 bg-amber-50 border border-amber-100',
  open:      'text-amber-700 bg-amber-50 border border-amber-100',
  completed: 'text-emerald-700 bg-emerald-50 border border-emerald-100',
  delivered: 'text-emerald-700 bg-emerald-50 border border-emerald-100',
  cancelled: 'text-red-700 bg-red-50 border border-red-100',
};

const OPEN_STATUSES = ['Issued', 'Inspected'];
const ACTIVITY_PAGE_SIZE = 10;
const JOURNAL_PAGE_SIZE  = 12;
type MobileHomePanel = 'recent' | 'journal' | 'email' | 'search';
const MOBILE_HOME_PANELS: MobileHomePanel[] = ['recent', 'journal', 'email', 'search'];

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

  // Search pagination (mobile)
  const [searchOrderPage, setSearchOrderPage] = useState(1);
  const [searchJournalPage, setSearchJournalPage] = useState(1);
  const SEARCH_ORDER_PAGE_SIZE = 20;
  const SEARCH_JOURNAL_PAGE_SIZE = 12;

  const [orders,          setOrders]         = useState<Order[]>([]);
  const [invoiceDeliveries, setInvoiceDeliveries] = useState<Invoice[]>([]);
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
  const [mobileHomePanel,      setMobileHomePanel]       = useState<MobileHomePanel>('journal');
  const [mobileOpenEntryId,     setMobileOpenEntryId]     = useState<string | null>(null);
  const [mobileOpenDueId,       setMobileOpenDueId]       = useState<string | null>(null);
  const [statusPopupOrder,      setStatusPopupOrder]      = useState<Order | null>(null);
  const [followUpReorderMode,   setFollowUpReorderMode]   = useState(false);
  const [followUpReorderList,   setFollowUpReorderList]   = useState<JournalEntry[]>([]);
  const [draggingFollowUpId,    setDraggingFollowUpId]    = useState<string | null>(null);
  const [savingFollowUpOrder,   setSavingFollowUpOrder]   = useState(false);
  const [showFollowUpReorderHint, setShowFollowUpReorderHint] = useState(false);
  const [highlightedJournalEntryId, setHighlightedJournalEntryId] = useState<string | null>(null);
  const [showWeekPicker, setShowWeekPicker] = useState(false);
  const weekTouchStartX = useRef<number | null>(null);
  const daySwipeStart = useRef<{ x: number; y: number } | null>(null);
  const mobilePanelTouchStart = useRef<{ x: number; y: number; panel: MobileHomePanel } | null>(null);
  const followUpLongPressTimer = useRef<number | null>(null);
  const followUpLongPressTriggered = useRef(false);
  const followUpDragState = useRef<{ id: string; startY: number } | null>(null);

  /* ── fetch ───────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    try {
      setLoading(true); setError(null);
      const [cR, sR, dR, iR] = await Promise.all([
        supabase.from('contracts').select('*').order('contract_date',     { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200),
        supabase.from('samples').select('*').order('date',                { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200),
        supabase.from('debit_notes').select('*').order('debit_note_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200),
        supabase.from('invoices').select('*').not('delivery_date', 'is', null).order('delivery_date', { ascending: false, nullsFirst: false }).limit(200),
      ]);
      if (cR.error) throw cR.error;
      if (sR.error) throw sR.error;
      if (dR.error) throw dR.error;
      if (iR.error) {
        console.warn('Invoice delivery query skipped:', iR.error.message);
        setInvoiceDeliveries([]);
      } else {
        setInvoiceDeliveries((iR.data || []) as Invoice[]);
      }
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
  useLayoutEffect(() => {
    if (window.innerWidth < 768) {
      setMobileHomePanel('journal');
      setShowSearch(false);
      setSearchTerm('');
      setSearchTab('journal');
    }
  }, []);

  const resetJournalToToday = useCallback(() => {
    const today = new Date();
    setMobileJournalDate(today);
    setMobileWeekStart(startOfWeekMonday(today));
    setMobileOpenEntryId(null);
    setMobileHomePanel('journal');
  }, []);

  useEffect(() => {
    window.addEventListener('home-journal-reset', resetJournalToToday);
    const handleSwipe = (ev: any) => {
      const dir = ev?.detail?.direction || 0;
      if (!dir) return;
      setMobileJournalDate((curr) => {
        const next = addCalendarDays(curr, dir);
        setMobileWeekStart(startOfWeekMonday(next));
        return next;
      });
    };
    window.addEventListener('home-journal-swipe', handleSwipe as any);

    return () => {
      window.removeEventListener('home-journal-reset', resetJournalToToday);
      window.removeEventListener('home-journal-swipe', handleSwipe as any);
      if (followUpLongPressTimer.current != null) {
        window.clearTimeout(followUpLongPressTimer.current);
      }
    };
  }, [resetJournalToToday]);

  const activateMobilePanel = useCallback((panel: MobileHomePanel) => {
    setMobileHomePanel(panel);
    setMobileOpenEntryId(null);
    if (panel === 'search') setSearchTab('journal');
  }, []);

  const handleMobilePanelTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    mobilePanelTouchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      panel: mobileHomePanel,
    };
  };

  const handleMobilePanelTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!mobilePanelTouchStart.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - mobilePanelTouchStart.current.x;
    const dy = touch.clientY - mobilePanelTouchStart.current.y;
    if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy)) {
      e.preventDefault();
    }
  };

  const handleMobilePanelTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = mobilePanelTouchStart.current;
    mobilePanelTouchStart.current = null;
    if (!start) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy)) return;

    const currentIndex = MOBILE_HOME_PANELS.indexOf(start.panel);
    const nextIndex = dx < 0
      ? Math.min(MOBILE_HOME_PANELS.length - 1, currentIndex + 1)
      : Math.max(0, currentIndex - 1);
    activateMobilePanel(MOBILE_HOME_PANELS[nextIndex]);
  };

  // Reset page when filter changes
  useEffect(()=>{ setActivityPage(1); }, [mobileFilter]);

  // Reset search pages when search term changes
  useEffect(() => { setSearchOrderPage(1); setSearchJournalPage(1); }, [searchTerm]);
  useEffect(() => {
    setDesktopJournalPage(1);
    setMobileOpenEntryId(null);
  }, [desktopSearch]);

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

  const searchOrderAll = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const s = searchTerm.toLowerCase();
    return orders.filter(o => o.contractNumber.toLowerCase().includes(s) || o.supplierName.toLowerCase().includes(s) || o.article.toLowerCase().includes(s));
  }, [orders, searchTerm]);
  const searchOrderTotalPages = Math.max(1, Math.ceil(searchOrderAll.length / SEARCH_ORDER_PAGE_SIZE));
  const searchOrderResults = useMemo(() => {
    const start = (searchOrderPage - 1) * SEARCH_ORDER_PAGE_SIZE;
    return searchOrderAll.slice(start, start + SEARCH_ORDER_PAGE_SIZE);
  }, [searchOrderAll, searchOrderPage]);

  const searchJournalAll = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const s = searchTerm.toLowerCase();
    return journalEntries.filter(e => e.title.toLowerCase().includes(s) || (e.content && e.content.toLowerCase().includes(s)));
  }, [journalEntries, searchTerm]);
  const searchJournalTotalPages = Math.max(1, Math.ceil(searchJournalAll.length / SEARCH_JOURNAL_PAGE_SIZE));
  const searchJournalResults = useMemo(() => {
    const start = (searchJournalPage - 1) * SEARCH_JOURNAL_PAGE_SIZE;
    return searchJournalAll.slice(start, start + SEARCH_JOURNAL_PAGE_SIZE);
  }, [searchJournalAll, searchJournalPage]);

  const mobileJournalDateKey = useMemo(() => toDateKey(mobileJournalDate), [mobileJournalDate]);

  const mobileWeekOptions = useMemo(() => {
    const todayWeekStart = startOfWeekMonday(new Date());
    const dates = journalEntries
      .map(entry => new Date(entry.entry_date))
      .filter(date => !Number.isNaN(date.getTime()));

    if (dates.length === 0) return [todayWeekStart];

    const earliest = dates.reduce((min, date) => (date < min ? date : min), dates[0]);
    const latest = dates.reduce((max, date) => (date > max ? date : max), dates[0]);
    const firstWeek = startOfWeekMonday(earliest < todayWeekStart ? earliest : todayWeekStart);
    const lastWeek = startOfWeekMonday(latest > todayWeekStart ? latest : todayWeekStart);

    const weeks: Date[] = [];
    for (let cursor = new Date(firstWeek); cursor.getTime() <= lastWeek.getTime(); cursor = addCalendarDays(cursor, 7)) {
      weeks.push(new Date(cursor));
    }
    return weeks;
  }, [journalEntries]);

  const mobileJournalDueItems = useMemo(() => {
    const weekStart = mobileWeekStart;
    const keys = Array.from({ length: 7 }, (_, i) => toDateKey(addCalendarDays(weekStart, i)));
    const items = keys.flatMap(k => buildJournalDueItems(orders, k, invoiceDeliveries));
    const map = new Map<string, JournalDueItem>();
    for (const it of items) map.set(it.id, it);
    return Array.from(map.values());
  }, [orders, mobileWeekStart, invoiceDeliveries]);

  const activeFollowUps = useMemo(
    () => journalEntries
      .filter(entry => entry.follow_up_required && !entry.follow_up_completed_at)
      .sort((a, b) => {
        const ao = a.follow_up_sort_order ?? Number.MAX_SAFE_INTEGER;
        const bo = b.follow_up_sort_order ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
      }),
    [journalEntries],
  );

  const datedMobileJournalEntries = useMemo(
    () => journalEntries.filter(entry =>
      entry.entry_date === mobileJournalDateKey &&
      !(entry.follow_up_required && !entry.follow_up_completed_at)
    ),
    [journalEntries, mobileJournalDateKey],
  );

  useEffect(() => {
    if (activeFollowUps.length < 2) {
      setShowFollowUpReorderHint(false);
      return;
    }
    setShowFollowUpReorderHint(true);
    const timer = window.setTimeout(() => setShowFollowUpReorderHint(false), 5000);
    return () => window.clearTimeout(timer);
  }, [activeFollowUps.length]);

  useEffect(() => {
    if (!highlightedJournalEntryId || showSearch) return;

    const scrollTimer = window.setTimeout(() => {
      document.getElementById(`journal-entry-${highlightedJournalEntryId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);

    const clearTimer = window.setTimeout(() => setHighlightedJournalEntryId(null), 4000);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [highlightedJournalEntryId, showSearch, mobileJournalDateKey]);

  const mobileJournalEntries = useMemo(
    () => {
      const datedEntries = journalEntries.filter(entry => entry.entry_date === mobileJournalDateKey);
      return [
        ...activeFollowUps,
        ...datedEntries.filter(entry => !(entry.follow_up_required && !entry.follow_up_completed_at)),
      ];
    },
    [activeFollowUps, journalEntries, mobileJournalDateKey],
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

  const openWeekPicker = useCallback(() => {
    setShowWeekPicker(true);
  }, []);

  const closeWeekPicker = useCallback(() => {
    setShowWeekPicker(false);
  }, []);

  const jumpToWeek = useCallback((weekStart: Date) => {
    setMobileWeekStart(weekStart);
    setMobileJournalDate(weekStart);
    setShowWeekPicker(false);
  }, []);

  const handleDaySwipeStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    daySwipeStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleDaySwipeEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!daySwipeStart.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - daySwipeStart.current.x;
    const dy = Math.abs(touch.clientY - daySwipeStart.current.y);
    daySwipeStart.current = null;
    if (Math.abs(dx) < 40 || Math.abs(dx) < dy) return;

    const direction = dx < 0 ? 1 : -1;
    setMobileJournalDate((current) => {
      const next = addCalendarDays(current, direction);
      setMobileWeekStart(startOfWeekMonday(next));
      return next;
    });
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

  const handleCompleteFollowUp = async (entry: JournalEntry) => {
    const { error } = await supabase
      .from('journal_entries')
      .update({
        follow_up_required: false,
        follow_up_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', entry.id);
    if (error) {
      dialogService.alert({ title: 'Could not complete follow-up', message: error.message, tone: 'danger' });
      return;
    }
    setMobileOpenEntryId(null);
    await fetchJournalEntries();
    dialogService.success('Follow-up completed.');
  };

  const handleMarkFollowUp = async (entry: JournalEntry) => {
    const maxOrder = activeFollowUps.reduce(
      (max, item) => Math.max(max, item.follow_up_sort_order ?? -1),
      -1,
    );
    const { error } = await supabase
      .from('journal_entries')
      .update({
        follow_up_required: true,
        follow_up_completed_at: null,
        follow_up_sort_order: maxOrder + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entry.id);
    if (error) {
      dialogService.alert({ title: 'Could not mark follow-up', message: error.message, tone: 'danger' });
      return;
    }
    setMobileOpenEntryId(null);
    await fetchJournalEntries();
    dialogService.success('Added to follow-up.');
  };

  const closeEntryActions = () => setMobileOpenEntryId(null);

  const handleMobileEntryTap = (entry: JournalEntry) => {
    if (followUpReorderMode || followUpLongPressTriggered.current) return;
    setMobileOpenEntryId(id => id === entry.id ? null : entry.id);
  };

  const openJournalFromSearch = (entry: JournalEntry) => {
    const entryDate = new Date(entry.entry_date);
    setShowSearch(false);
    setSearchTerm('');
    setMobileJournalDate(entryDate);
    setMobileWeekStart(startOfWeekMonday(entryDate));
    setMobileHomePanel('journal');
    setMobileOpenEntryId(entry.id);
    setHighlightedJournalEntryId(entry.id);
  };

  const cancelFollowUpLongPress = () => {
    if (followUpLongPressTimer.current != null) {
      window.clearTimeout(followUpLongPressTimer.current);
      followUpLongPressTimer.current = null;
    }
  };

  const enterFollowUpReorderMode = () => {
    if (activeFollowUps.length < 2) {
      dialogService.toast({ message: 'Add at least 2 follow-ups to reorder', durationMs: 2200 });
      return;
    }
    setFollowUpReorderMode(true);
    setFollowUpReorderList([...activeFollowUps]);
    setMobileOpenEntryId(null);
    navigator.vibrate?.(40);
  };

  const startFollowUpLongPress = (entry: JournalEntry) => {
    if (followUpReorderMode) return;
    if (!(entry.follow_up_required && !entry.follow_up_completed_at)) return;
    cancelFollowUpLongPress();
    followUpLongPressTriggered.current = false;
    followUpLongPressTimer.current = window.setTimeout(() => {
      followUpLongPressTriggered.current = true;
      enterFollowUpReorderMode();
    }, 480);
  };

  const cancelFollowUpReorderMode = () => {
    setFollowUpReorderMode(false);
    setFollowUpReorderList([]);
    setDraggingFollowUpId(null);
    followUpDragState.current = null;
  };

  const handleFollowUpReorderTouchStart = (entry: JournalEntry, _index: number, e: React.TouchEvent) => {
    e.stopPropagation();
    followUpDragState.current = { id: entry.id, startY: e.touches[0].clientY };
    setDraggingFollowUpId(entry.id);
  };

  const handleFollowUpReorderTouchMove = (_index: number, e: React.TouchEvent) => {
    if (!followUpDragState.current) return;
    e.preventDefault();
    const y = e.touches[0].clientY;
    const dy = y - followUpDragState.current.startY;
    if (Math.abs(dy) < 28) return;

    const direction = dy > 0 ? 1 : -1;

    setFollowUpReorderList(prev => {
      const currentIndex = prev.findIndex(item => item.id === followUpDragState.current!.id);
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;

      const next = [...prev];
      [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
      navigator.vibrate?.(12);
      followUpDragState.current = { id: followUpDragState.current!.id, startY: y };
      return next;
    });
  };

  const handleFollowUpReorderTouchEnd = () => {
    followUpDragState.current = null;
    setDraggingFollowUpId(null);
  };

  const saveFollowUpOrder = async () => {
    if (followUpReorderList.length === 0) {
      cancelFollowUpReorderMode();
      return;
    }
    setSavingFollowUpOrder(true);
    try {
      const results = await Promise.all(
        followUpReorderList.map((entry, index) =>
          supabase
            .from('journal_entries')
            .update({
              follow_up_sort_order: index,
              updated_at: new Date().toISOString(),
            })
            .eq('id', entry.id)
        ),
      );
      const failed = results.find(result => result.error);
      if (failed?.error) throw failed.error;
      await fetchJournalEntries();
      cancelFollowUpReorderMode();
      dialogService.success('Follow-up order saved.');
    } catch (error: any) {
      dialogService.alert({
        title: 'Failed to save order',
        message: error?.message || 'Please try again.',
        tone: 'danger',
      });
    } finally {
      setSavingFollowUpOrder(false);
    }
  };

  const renderFollowUpReorderCard = (entry: JournalEntry, index: number) => (
    <div
      key={entry.id}
      className={`rounded-xl border overflow-hidden follow-up-shake touch-none select-none ${
        draggingFollowUpId === entry.id
          ? 'border-blue-300 bg-blue-50/80 shadow-md scale-[1.02]'
          : 'border-blue-100 bg-white'
      }`}
      onTouchStart={(e) => handleFollowUpReorderTouchStart(entry, index, e)}
      onTouchMove={(e) => handleFollowUpReorderTouchMove(index, e)}
      onTouchEnd={handleFollowUpReorderTouchEnd}
      onTouchCancel={handleFollowUpReorderTouchEnd}
    >
      <div className="px-3.5 py-3 flex items-start gap-3">
        <GripVertical className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-[13px] font-semibold text-gray-900 truncate">{entry.title}</p>
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-100">
              <Pin className="h-2.5 w-2.5" /> Follow-up
            </span>
          </div>
          {entry.content && (
            <p className="mt-1 text-[11px] leading-5 text-gray-500 line-clamp-2">{entry.content}</p>
          )}
        </div>
        <span className="text-[10px] font-bold text-blue-500 shrink-0">{index + 1}</span>
      </div>
    </div>
  );

  const renderDueItems = (items: JournalDueItem[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-0.5">
          <CalendarClock className="h-3.5 w-3.5 text-blue-600" />
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Due this week</p>
        </div>
        {items.map(item => {
          const theme = DUE_THEME[item.type] || DUE_THEME.contract;
          const Icon = theme.Icon;
          const isOpen = mobileOpenDueId === item.id;
          return (
            <div key={item.id} className={`w-full rounded-xl border ${theme.wrap} overflow-hidden`}>
              <button
                type="button"
                onClick={() => setMobileOpenDueId(id => id === item.id ? null : item.id)}
                className="w-full px-3 py-2.5 text-left flex items-start gap-3"
              >
                <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${theme.icon}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-bold text-slate-900 truncate">{item.title}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${theme.badge}`}>
                      {item.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500 truncate">{item.subtitle}</p>
                </div>
              </button>

              <div className={`transition-all duration-200 ${isOpen ? 'max-h-28 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="flex items-center gap-2 px-3.5 py-2.5 border-t bg-white">
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      // Try to open the linked order if possible
                      const parts = item.id.split('-');
                      const kind = parts[0];
                      const id = parts.slice(1).join('-');
                      const order = orders.find(o => String(o.id) === id && o.type === kind);
                      if (order) {
                        goToOrder(order);
                        setMobileOpenDueId(null);
                        return;
                      }
                      // Fallback to route
                      if (item.route) navigate(item.route);
                      setMobileOpenDueId(null);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-gray-700 bg-gray-50"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const parts = item.id.split('-');
                      const kind = parts[0];
                      const id = parts.slice(1).join('-');
                      const order = orders.find(o => String(o.id) === id && o.type === kind);
                      if (!order) {
                        await dialogService.alert({ title: 'Cannot mark completed', message: 'This item cannot be completed from here.' });
                        return;
                      }
                      try {
                        await updateOrderStatus(order, 'Completed');
                        await fetchData();
                        dialogService.success('Marked completed.');
                        setMobileOpenDueId(null);
                      } catch (err: any) {
                        await dialogService.alert({ title: 'Failed', message: err?.message || 'Please try again.', tone: 'danger' });
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-emerald-700 bg-emerald-50"
                  >
                    Mark completed
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderJournalEntryCard = (entry: JournalEntry, useDesktopForm = false, enableFollowUpLongPress = false) => {
    const isOpen = mobileOpenEntryId === entry.id;
    const isHighlighted = highlightedJournalEntryId === entry.id;
    const isFollowUp = entry.follow_up_required && !entry.follow_up_completed_at;
    const rowTapClass = useDesktopForm ? 'hover:bg-gray-100' : 'active:bg-gray-100';
    const editBtnClass = useDesktopForm ? 'hover:bg-blue-100' : 'active:bg-blue-100';
    const threadBtnClass = useDesktopForm ? 'hover:bg-gray-200' : 'active:bg-gray-200';
    const followBtnClass = useDesktopForm ? 'hover:bg-blue-100' : 'active:bg-blue-100';
    const doneBtnClass = useDesktopForm ? 'hover:bg-emerald-100' : 'active:bg-emerald-100';
    const deleteBtnClass = useDesktopForm ? 'hover:bg-rose-100' : 'active:bg-rose-100';

    const openEditForm = () => {
      closeEntryActions();
      setEditingEntry(entry);
      if (useDesktopForm) setIsDesktopFormOpen(true);
      else setIsMobileFormOpen(true);
    };

    const openThreadPopup = () => {
      closeEntryActions();
      setSelectedEntryForPopup(entry);
    };

    return (
      <div
        id={`journal-entry-${entry.id}`}
        key={entry.id}
        className={`rounded-xl border overflow-hidden transition-all duration-300 ${
          isHighlighted
            ? 'border-blue-400 ring-2 ring-blue-500 journal-entry-highlight bg-blue-50/40'
            : `border-gray-100 ${isFollowUp ? 'bg-white' : 'bg-gray-50'}`
        }`}
      >
        <button
          type="button"
          onClick={() => {
            cancelFollowUpLongPress();
            handleMobileEntryTap(entry);
          }}
          onTouchStart={() => {
            if (enableFollowUpLongPress && isFollowUp) startFollowUpLongPress(entry);
          }}
          onTouchEnd={cancelFollowUpLongPress}
          onTouchMove={cancelFollowUpLongPress}
          onTouchCancel={cancelFollowUpLongPress}
          className={`w-full px-3.5 py-3 text-left transition-colors ${rowTapClass}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 truncate">{entry.title}</p>
                {isFollowUp && (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-100">
                    <Pin className="h-2.5 w-2.5" /> Follow-up
                  </span>
                )}
              </div>
              {entry.content && (
                <p className={`mt-1 text-[11px] leading-5 text-gray-500 ${isOpen ? 'line-clamp-5' : 'line-clamp-3'}`}>
                  {entry.content}
                </p>
              )}
              {useDesktopForm && (
                <p className="mt-1 text-[10px] text-gray-400">
                  {new Date(entry.entry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
            <ChevronRight className={`h-4 w-4 text-gray-300 mt-1 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          </div>
        </button>
        <div className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-t border-gray-100 bg-white overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openEditForm(); }}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-blue-600 bg-blue-50 ${editBtnClass} shrink-0`}
            >
              <Edit2 className="h-3 w-3" /> Edit
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openThreadPopup(); }}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-gray-600 bg-gray-100 ${threadBtnClass} shrink-0`}
            >
              <GitBranch className="h-3 w-3" /> Thread
            </button>
            {isFollowUp ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleCompleteFollowUp(entry); }}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-emerald-700 bg-emerald-50 ${doneBtnClass} shrink-0`}
              >
                <CheckCircle2 className="h-3 w-3" /> Done
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleMarkFollowUp(entry); }}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-blue-700 bg-blue-50 ${followBtnClass} shrink-0`}
              >
                <Pin className="h-3 w-3" /> Follow
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleMobileDeleteEntry(entry); }}
              className={`ml-auto flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-rose-600 bg-rose-50 ${deleteBtnClass} shrink-0`}
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ── handlers ────────────────────────────────────────────── */
  const handlePullRefresh = useCallback(async()=>{ await Promise.all([fetchData(), fetchJournalEntries()]); }, [fetchData, fetchJournalEntries]);

  const goToOrder = useCallback((order: Order)=>{
    if (order.type==='contract')    navigate(`/app/contracts/${order.id}`,   {state:{contract:order.contractData}});
    else if (order.type==='sample') navigate(`/app/samples/${order.id}`,     {state:{sample:order.sampleData}});
    else                            navigate(`/app/debit-notes/${order.id}`, {state:{debitNote:order.debitNoteData}});
  }, [navigate]);

  const handleStatusChange = useCallback(async (order: Order, newStatus: string) => {
    try {
      await updateOrderStatus(order, newStatus);
      await fetchData();
      setStatusPopupOrder(null);
    } catch (error: any) {
      dialogService.alert({ title: 'Failed to update status', message: error?.message || 'Please try again.', tone: 'danger' });
    }
  }, [fetchData]);

  const handleJournalSave = useCallback(async(savedEntry?: JournalEntry)=>{
    setIsMobileFormOpen(false); setIsDesktopFormOpen(false); setEditingEntry(null);
    fetchJournalEntries();
    if (savedEntry?.follow_up_required && !savedEntry.follow_up_completed_at && savedEntry.follow_up_sort_order == null) {
      const maxOrder = journalEntries
        .filter(e => e.follow_up_required && !e.follow_up_completed_at && e.id !== savedEntry.id)
        .reduce((max, e) => Math.max(max, e.follow_up_sort_order ?? -1), -1);
      await supabase
        .from('journal_entries')
        .update({ follow_up_sort_order: maxOrder + 1, updated_at: new Date().toISOString() })
        .eq('id', savedEntry.id);
      fetchJournalEntries();
    }
    if (savedEntry&&!savedEntry.parent_id) {
      const ten=new Date(); ten.setDate(ten.getDate()-10);
      const past=journalEntries.filter(e=>e.id!==savedEntry.id&&new Date(e.entry_date)>=ten);
      if (past.length>0) {
        dialogService.toast({message:'AI is looking for related entries…',durationMs:2000});
        const sg=await suggestJournalLink(savedEntry,past);
        if (sg.suggested_parent_id) {
          const parent=past.find(e=>e.id===sg.suggested_parent_id);
          if (parent) {
            const { error } = await supabase.from('journal_entries').update({parent_id:parent.id}).eq('id',savedEntry.id);
            if (error) {
              await dialogService.alert({
                title: 'Thread link failed',
                message: error.message,
                tone: 'danger',
              });
              return;
            }
            await fetchJournalEntries();
            await dialogService.alert({
              title: 'Journal Thread Linked',
              message: `This entry was linked with "${parent.title}".\n\n${sg.reasoning || 'AI found this as the closest related thread.'}`,
              confirmLabel: 'Done',
              tone: 'success',
            });
          }
        } else if (sg.reasoning && !/not configured/i.test(sg.reasoning)) {
          dialogService.toast({
            title: 'No thread linked',
            message: sg.reasoning,
            tone: sg.reasoning.toLowerCase().includes('failed') || sg.reasoning.toLowerCase().includes('request') ? 'warning' : 'default',
            durationMs: 4500,
          });
        }
      }
    }
  }, [journalEntries, fetchJournalEntries]);

  const openSearch = () => {
    setShowSearch(false);
    setSearchTerm('');
    setSearchTab('journal');
    activateMobilePanel('search');
  };

  const renderMobileJournalPanel = () => (
    <section className="h-full min-h-0 flex flex-col">
      <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
        <button
          type="button"
          onClick={openWeekPicker}
          className="min-w-0 text-left active:opacity-80"
        >
          <h2 className="text-[15px] font-bold text-gray-900 leading-tight">Journal</h2>
          <p className="mt-0.5 text-[11px] font-medium text-gray-400">
            {formatWeekRange(mobileWeekStart)}
          </p>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { setEditingEntry(null); setIsMobileFormOpen(true); }}
            className="h-8 px-3 rounded-lg bg-blue-600 text-white text-[11px] font-bold flex items-center gap-1.5 active:bg-blue-700 transition-colors"
          >
            <Plus className="h-3 w-3" /> New
          </button>
        </div>
      </div>

      <div
        className="px-4 py-2 border-b border-gray-50 bg-white"
        onTouchStart={(e) => { e.stopPropagation(); weekTouchStartX.current = e.changedTouches[0].clientX; }}
        onTouchEnd={(e) => { e.stopPropagation(); handleWeekTouchEnd(e); }}
      >
        <div
          className="grid grid-cols-7 gap-1"
          onTouchStart={handleDaySwipeStart}
          onTouchEnd={handleDaySwipeEnd}
        >
          {Array.from({ length: 7 }, (_, offset) => {
            const date = addCalendarDays(mobileWeekStart, offset);
            const isSelected = toDateKey(date) === mobileJournalDateKey;
            return (
              <button
                type="button"
                key={offset}
                onClick={(event) => {
                  event.stopPropagation();
                  setMobileJournalDate(date);
                }}
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

      <div className={`flex-1 px-4 pt-2 space-y-1 overflow-y-auto overflow-x-hidden momentum-scroll min-h-0 overscroll-contain no-scrollbar ${followUpReorderMode ? 'pb-28' : 'pb-2'}`}>
        {renderDueItems(mobileJournalDueItems)}

        {journalLoading ? (
          <div className="h-20 rounded-xl bg-gray-50 flex items-center justify-center">
            <div className="h-5 w-5 rounded-full border-2 border-gray-200 border-t-gray-400 animate-spin" />
          </div>
        ) : mobileJournalEntries.length === 0 ? (
          <button onClick={() => { setEditingEntry(null); setIsMobileFormOpen(true); }} className="w-full rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-4 text-left active:bg-gray-100">
            <p className="text-[13px] font-semibold text-gray-700">No journal entries</p>
            <p className="mt-1 text-[11px] leading-5 text-gray-400">Add a note for this day.</p>
          </button>
        ) : (
          <>
            {followUpReorderMode ? (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-blue-600 px-0.5">
                  Drag follow-ups to reorder, then tap Save
                </p>
                {followUpReorderList.map((entry, index) => renderFollowUpReorderCard(entry, index))}
              </div>
            ) : (
              activeFollowUps.length > 0 && (
                <div className="space-y-2">
                  <div
                    className={`overflow-hidden transition-all duration-700 ease-in-out ${
                      showFollowUpReorderHint && activeFollowUps.length >= 2
                        ? 'max-h-10 opacity-100 mb-1'
                        : 'max-h-0 opacity-0 mb-0'
                    }`}
                  >
                    <p className="text-[10px] text-gray-400 px-0.5 leading-5">
                      Hold a follow-up to reorder
                    </p>
                  </div>
                  {activeFollowUps.map(entry => renderJournalEntryCard(entry, false, true))}
                </div>
              )
            )}
            {datedMobileJournalEntries.length > 0 && (
              <div className={`space-y-2 ${activeFollowUps.length > 0 || followUpReorderMode ? 'mt-2' : ''}`}>
                {datedMobileJournalEntries.map(entry => renderJournalEntryCard(entry))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );

  const renderMobileRecentPanel = () => (
    <section className="h-full min-h-0 flex flex-col">
      <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-slate-100 bg-white/95 backdrop-blur-sm">
        <div>
          <h2 className="text-[15px] font-bold text-gray-900">Recents</h2>
          <p className="mt-0.5 text-[11px] text-gray-400">{activityList.length} items shown</p>
        </div>
        <button
          onClick={() => activateMobilePanel('search')}
          className="text-[12px] font-bold text-blue-600"
        >
          Search
        </button>
      </div>

      <div className="px-3 py-2.5 border-b border-gray-100 overflow-x-auto no-scrollbar bg-white">
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

      <div className="flex-1 overflow-y-auto overflow-x-hidden momentum-scroll overscroll-contain no-scrollbar px-0">
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
          <div className="divide-y divide-slate-100 bg-white">
            {mobileQueuePreview.map(order => {
              const tc = TYPE_ICON[order.type] || { Icon: FileText, bg: 'bg-slate-50', iconCls: 'text-slate-500' };
              const Icon = tc.Icon;
              const badge = STATUS_BADGE[(order.status || 'issued').toLowerCase()] || 'text-slate-600 bg-slate-50 border border-slate-200';
              return (
                <div key={`${order.type}-${order.id}`} onClick={() => goToOrder(order)} className="w-full px-4 py-3.5 flex items-center gap-3 active:bg-slate-50 cursor-pointer">
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
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setStatusPopupOrder(order); }}
                    className={`px-2 py-1 rounded-full text-[10px] font-semibold shrink-0 ${badge}`}
                  >
                    {order.status || 'Issued'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {activityTotal > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-3 bg-white">
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
  );

  const renderMobileEmailPanel = () => (
    <section className="h-full min-h-0 flex flex-col">
      <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-slate-100 bg-white/95 backdrop-blur-sm">
        <div>
          <h2 className="text-[15px] font-bold text-gray-900">Email</h2>
          <p className="mt-0.5 text-[11px] text-gray-400">Quick preview of important mail</p>
        </div>
        <button
          onClick={() => navigate('/app/email')}
          className="text-[12px] font-bold text-blue-600"
        >
          Open
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden momentum-scroll overscroll-contain no-scrollbar px-4 pt-3 pb-4">
        <EmailPreviewSection
          compact
          onOpenPage={() => navigate('/app/email')}
          showHeader={false}
        />
      </div>
    </section>
  );

  const renderMobileSearchPanel = () => (
    <section className="h-full min-h-0 flex flex-col overflow-hidden">
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
            onClick={() => activateMobilePanel('journal')}
            className="shrink-0 h-11 px-2 text-[13px] font-semibold text-gray-500 active:text-gray-700"
          >
            Close
          </button>
        </div>

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

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden momentum-scroll overscroll-contain no-scrollbar pb-4">
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
                          onClick={() => { goToOrder(order); activateMobilePanel('recent'); }}
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
        ) : searchTab === 'journal' ? (
          searchJournalResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center" style={{animation:'fadeIn 0.15s ease-out'}}>
              <p className="text-[13px] text-gray-400">No matching journal entries</p>
            </div>
          ) : (
            <div className="p-4" style={{animation:'fadeIn 0.15s ease-out'}}>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {searchJournalResults.map((entry, idx) => (
                  <button
                    key={`sj-${entry.id}`}
                    type="button"
                    onClick={() => openJournalFromSearch(entry)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 ${idx > 0 ? 'border-t border-gray-50' : ''}`}
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-indigo-50">
                      <FileText className="h-4 w-4 text-indigo-500" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-gray-900 truncate">{entry.title}</p>
                      <p className="text-[10px] text-gray-400">
                        {new Date(entry.entry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      {entry.content && (
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">{entry.content}</p>
                      )}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                  </button>
                ))}
              </div>
              {searchJournalTotalPages > 1 && (
                <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-3 bg-white">
                  <p className="text-[11px] font-medium text-gray-400">
                    {(searchJournalPage - 1) * SEARCH_JOURNAL_PAGE_SIZE + 1}-{Math.min(searchJournalPage * SEARCH_JOURNAL_PAGE_SIZE, searchJournalAll.length)} of {searchJournalAll.length}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: Math.min(searchJournalTotalPages, 5) }, (_, idx) => idx + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setSearchJournalPage(page)}
                        className={`h-7 w-7 rounded-lg text-[11px] font-bold ${searchJournalPage === page ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          searchOrderResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center" style={{animation:'fadeIn 0.15s ease-out'}}>
              <p className="text-[13px] text-gray-400">No matching contracts, letters or payments</p>
            </div>
          ) : (
            <div className="p-4" style={{animation:'fadeIn 0.15s ease-out'}}>
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
                      onClick={() => { goToOrder(order); activateMobilePanel('recent'); setSearchTerm(''); }}
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
              {searchOrderTotalPages > 1 && (
                <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-3 bg-white">
                  <p className="text-[11px] font-medium text-gray-400">
                    {(searchOrderPage - 1) * SEARCH_ORDER_PAGE_SIZE + 1}-{Math.min(searchOrderPage * SEARCH_ORDER_PAGE_SIZE, searchOrderAll.length)} of {searchOrderAll.length}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: Math.min(searchOrderTotalPages, 5) }, (_, idx) => idx + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setSearchOrderPage(page)}
                        className={`h-7 w-7 rounded-lg text-[11px] font-bold ${searchOrderPage === page ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </section>
  );

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
        className="md:hidden h-[100dvh] overflow-hidden bg-gray-50 text-gray-900 mobile-smooth-scroll"
        style={{ paddingBottom: 'calc(82px + env(safe-area-inset-bottom, 0px))' }}
      >
        <PullToRefresh onRefresh={handlePullRefresh}>
          <div className="flex h-full min-h-0 flex-col mobile-page-enter">
            <div className="px-4 pt-4 pb-3 shrink-0">
              <MobilePageHeader
                eyebrow={formatFullDate()}
                title={getGreeting()}
                subtitle="Recent activity, journal, email and search."
              />

              <div className="grid grid-cols-4 gap-1 rounded-2xl bg-white p-1 shadow-sm">
                {[
                  { id: 'recent', label: 'Recent' },
                  { id: 'journal', label: 'Journal' },
                  { id: 'email', label: 'Email' },
                  { id: 'search', label: 'Search' },
                ].map((item) => {
                  const active = mobileHomePanel === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => activateMobilePanel(item.id as MobileHomePanel)}
                      className={`h-8 rounded-lg text-[11px] font-semibold transition-colors ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 active:bg-gray-50'}`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="relative flex-1 min-h-0 overflow-hidden"
              onTouchStart={handleMobilePanelTouchStart}
              onTouchMove={handleMobilePanelTouchMove}
              onTouchEnd={handleMobilePanelTouchEnd}
              onTouchCancel={handleMobilePanelTouchEnd}
              style={{ touchAction: 'pan-y' }}
            >
              <div key={mobileHomePanel} className="h-full min-h-0 mobile-panel-enter">
                {mobileHomePanel === 'recent' && renderMobileRecentPanel()}
                {mobileHomePanel === 'journal' && renderMobileJournalPanel()}
                {mobileHomePanel === 'email' && renderMobileEmailPanel()}
                {mobileHomePanel === 'search' && renderMobileSearchPanel()}
              </div>
            </div>
          </div>

          <div className="hidden px-4 pt-4 pb-2">
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

            <div className="mt-2">
              <EmailPreviewSection
                compact
                onOpenPage={() => navigate('/app/email')}
              />
            </div>

            <section className="mt-1.5 rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
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
                className="px-4 py-2 border-b border-gray-50"
                onTouchStart={(e) => { weekTouchStartX.current = e.changedTouches[0].clientX; }}
                onTouchEnd={handleWeekTouchEnd}
              >
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 7 }, (_, offset) => {
                    const date = addCalendarDays(mobileWeekStart, offset);
                    const isSelected = toDateKey(date) === mobileJournalDateKey;
                    return (
                      <button
                        type="button"
                        key={offset}
                        onClick={(event) => {
                          event.stopPropagation();
                          setMobileJournalDate(date);
                        }}
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

              <div className={`px-4 pt-2 space-y-1 ${followUpReorderMode ? 'pb-28' : 'pb-2'}`}>
                {renderDueItems(mobileJournalDueItems)}

                {journalLoading ? (
                  <div className="h-20 rounded-xl bg-gray-50 flex items-center justify-center">
                    <div className="h-5 w-5 rounded-full border-2 border-gray-200 border-t-gray-400 animate-spin" />
                  </div>
                ) : mobileJournalEntries.length === 0 ? (
                  <button onClick={() => { setEditingEntry(null); setIsMobileFormOpen(true); }} className="w-full rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-4 text-left active:bg-gray-100">
                    <p className="text-[13px] font-semibold text-gray-700">No journal entries</p>
                    <p className="mt-1 text-[11px] leading-5 text-gray-400">Add a note for this day.</p>
                  </button>
                ) : (
                  <>
                    {followUpReorderMode ? (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-blue-600 px-0.5">
                          Drag follow-ups to reorder, then tap Save
                        </p>
                        {followUpReorderList.map((entry, index) => renderFollowUpReorderCard(entry, index))}
                      </div>
                    ) : (
                      activeFollowUps.length > 0 && (
                        <div className="space-y-2">
                          <div
                            className={`overflow-hidden transition-all duration-700 ease-in-out ${
                              showFollowUpReorderHint && activeFollowUps.length >= 2
                                ? 'max-h-10 opacity-100 mb-1'
                                : 'max-h-0 opacity-0 mb-0'
                            }`}
                          >
                            <p className="text-[10px] text-gray-400 px-0.5 leading-5">
                              Hold a follow-up to reorder
                            </p>
                          </div>
                          {activeFollowUps.map(entry => renderJournalEntryCard(entry, false, true))}
                        </div>
                      )
                    )}
                    {datedMobileJournalEntries.length > 0 && (
                      <div className={`space-y-2 ${activeFollowUps.length > 0 || followUpReorderMode ? 'mt-2' : ''}`}>
                        {datedMobileJournalEntries.map(entry => renderJournalEntryCard(entry))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

            <section className="hidden mt-4">
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
                        <div key={`${order.type}-${order.id}`} onClick={() => goToOrder(order)} className="w-full px-4 py-3.5 flex items-center gap-3 active:bg-slate-50 cursor-pointer">
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
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setStatusPopupOrder(order); }}
                            className={`px-2 py-1 rounded-full text-[10px] font-semibold shrink-0 ${badge}`}
                          >
                            {order.status || 'Issued'}
                          </button>
                        </div>
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

      {followUpReorderMode && (
        <div
          className="fixed inset-x-0 z-40 md:hidden px-4"
          style={{ bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="rounded-2xl bg-white border border-gray-200 shadow-xl p-3 flex gap-2">
            <button
              type="button"
              onClick={cancelFollowUpReorderMode}
              disabled={savingFollowUpOrder}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 active:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveFollowUpOrder}
              disabled={savingFollowUpOrder}
              className="flex-[1.4] px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 active:bg-blue-700 disabled:opacity-50 shadow-md shadow-blue-200/60"
            >
              {savingFollowUpOrder ? 'Saving…' : 'Save order'}
            </button>
          </div>
        </div>
      )}

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
                  orders={orders}
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
                  <div className="animate-spin h-5 w-5 rounded-full border-2 border-gray-200 border-t-gray-400" />
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
          className="md:hidden fixed inset-0 z-[200] flex h-[100dvh] flex-col bg-gray-50"
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
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden momentum-scroll overscroll-contain no-scrollbar">
            {!searchTerm.trim() ? (
              <div className="p-4 pb-6" style={{animation:'fadeIn 0.2s ease-out'}}>
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
              <div className="p-4 pb-6" key={searchTab} style={{animation:'fadeIn 0.15s ease-out'}}>

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
                          type="button"
                          onClick={() => openJournalFromSearch(entry)}
                          className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 ${idx > 0 ? 'border-t border-gray-50' : ''}`}
                        >
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-indigo-50">
                            <FileText className="h-4 w-4 text-indigo-500" strokeWidth={1.75} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-bold text-gray-900 truncate">{entry.title}</p>
                            <p className="text-[10px] text-gray-400">
                              {new Date(entry.entry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
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
      <div className="hidden md:flex flex-col h-full min-h-0 overflow-hidden page-fade-in bg-gray-50">

        <div className="shrink-0 bg-white border-b border-gray-100 px-6 pt-4 pb-3">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{getGreeting()}</h1>
              <p className="text-[12px] text-gray-400 mt-1">{formatFullDate()}</p>
            </div>
            <div className="shrink-0 pt-1">
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

        <div className="flex-1 flex min-h-0 overflow-hidden gap-3 p-3">
          {/* LEFT: Journal */}
          <div className="w-[360px] shrink-0 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {desktopSearch.trim() ? (() => {
                const s = desktopSearch.toLowerCase();
                const matched = journalEntries.filter(e=>e.title.toLowerCase().includes(s)||(e.content&&e.content.toLowerCase().includes(s)));
                const total = Math.max(1, Math.ceil(matched.length/JOURNAL_PAGE_SIZE));
                const pg    = Math.min(desktopJournalPage, total);
                const slice = matched.slice((pg-1)*JOURNAL_PAGE_SIZE, pg*JOURNAL_PAGE_SIZE);
                return (
                  <section className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden flex flex-col min-h-0 h-full">
                    <div className="px-4 py-3 border-b border-gray-100 shrink-0">
                      <h2 className="text-[15px] font-bold text-gray-900 leading-tight">Journal results</h2>
                      <p className="mt-0.5 text-[11px] font-medium text-gray-400">
                        {matched.length} {matched.length === 1 ? 'entry' : 'entries'} for "{desktopSearch}"
                      </p>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden momentum-scroll overscroll-contain no-scrollbar px-4 py-3 space-y-2">
                      {matched.length === 0 ? (
                        <p className="text-[12px] text-gray-400 text-center py-6">No entries match "{desktopSearch}"</p>
                      ) : (
                        slice.map(entry => renderJournalEntryCard(entry, true))
                      )}
                    </div>
                    {total > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 shrink-0">
                        <p className="text-[11px] text-gray-400">{(pg - 1) * JOURNAL_PAGE_SIZE + 1}–{Math.min(pg * JOURNAL_PAGE_SIZE, matched.length)} of {matched.length}</p>
                        <div className="flex gap-1">
                          <button onClick={() => setDesktopJournalPage(p => Math.max(1, p - 1))} disabled={pg === 1} className="px-2.5 py-1 rounded-lg text-[11px] bg-gray-100 text-gray-600 disabled:opacity-30 hover:bg-gray-200">‹ Prev</button>
                          <button onClick={() => setDesktopJournalPage(p => Math.min(total, p + 1))} disabled={pg === total} className="px-2.5 py-1 rounded-lg text-[11px] bg-gray-100 text-gray-600 disabled:opacity-30 hover:bg-gray-200">Next ›</button>
                        </div>
                      </div>
                    )}
                  </section>
                );
              })() : (
                <section className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden flex flex-col min-h-0 h-full">
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

                  <div
                    className="flex-1 px-4 pb-3 pt-3 space-y-2 overflow-y-auto overflow-x-hidden momentum-scroll min-h-0 overscroll-contain no-scrollbar"
                    onWheel={(e) => {
                      if (e.deltaY !== 0) {
                        e.currentTarget.scrollTop += e.deltaY;
                        e.preventDefault();
                      }
                    }}
                  >
                    {renderDueItems(mobileJournalDueItems)}

                    {journalLoading ? (
                      <div className="h-20 rounded-xl bg-gray-50 flex items-center justify-center">
                        <div className="h-5 w-5 rounded-full border-2 border-gray-200 border-t-gray-400 animate-spin" />
                      </div>
                    ) : mobileJournalEntries.length === 0 ? (
                      <button onClick={() => { setEditingEntry(null); setIsDesktopFormOpen(true); }} className="w-full rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-4 text-left hover:bg-gray-100">
                        <p className="text-[13px] font-semibold text-gray-700">No journal entries</p>
                        <p className="mt-1 text-[11px] leading-5 text-gray-400">Add a note for this day.</p>
                      </button>
                    ) : (
                      mobileJournalEntries.map(entry => renderJournalEntryCard(entry, true))
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>

          {/* RIGHT: Recent Activity */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden gap-3">
            <EmailPreviewSection onOpenPage={() => navigate('/app/email')} className="shrink-0" />

            <section className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden flex flex-col min-h-0 flex-1">
              <div className="px-4 py-3 border-b border-gray-100 shrink-0">
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div>
                    <h2 className="text-[15px] font-bold text-gray-900 leading-tight">Recent Activity</h2>
                    <p className="mt-0.5 text-[11px] font-medium text-gray-400">Work queue and recent records</p>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {FILTERS.map(f => (
                    <button
                      key={f.value}
                      onClick={() => setDesktopFilter(f.value)}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all ${desktopFilter === f.value ? f.on : f.off}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden momentum-scroll overscroll-contain no-scrollbar"
                onWheel={(e) => {
                  if (e.deltaY !== 0) {
                    e.currentTarget.scrollTop += e.deltaY;
                    e.preventDefault();
                  }
                }}
              >
                {error && (
                  <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center text-red-700 text-sm">
                    <AlertCircle className="h-5 w-5 mr-3 shrink-0" />{error}
                    <button onClick={fetchData} className="ml-auto font-bold underline">Retry</button>
                  </div>
                )}
                <RecentOrdersList orders={desktopOrders} loading={loading} onStatusChange={fetchData} embedded />
              </div>
            </section>
          </div>
        </div>
      </div>

      {isDesktopFormOpen&&(
        <JournalEntryForm
          initialDate={editingEntry ? new Date(editingEntry.entry_date) : new Date()}
          initialEntry={editingEntry}
          onClose={()=>{ setIsDesktopFormOpen(false); setEditingEntry(null); }}
          onSave={handleJournalSave}
        />
      )}

      {selectedEntryForPopup&&(
        <JournalEntryPopup entry={selectedEntryForPopup} allEntries={journalEntries}
          onClose={()=>setSelectedEntryForPopup(null)} onUpdate={fetchJournalEntries} />
      )}

      {showWeekPicker && (
        <div className="fixed inset-0 z-[210] flex items-end md:items-center justify-center bg-slate-900/40 backdrop-blur-sm px-0 md:p-4">
          <div className="w-full md:max-w-sm rounded-t-[28px] md:rounded-[28px] bg-white shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
            <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-500">Journal week</p>
                <h3 className="mt-1 text-[16px] font-bold text-slate-900">Jump to a week</h3>
              </div>
              <button
                type="button"
                onClick={closeWeekPicker}
                className="h-9 w-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center active:bg-slate-200"
                aria-label="Close week picker"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[72dvh] overflow-y-auto no-scrollbar p-3 space-y-2">
              {mobileWeekOptions.map((weekStart) => {
                const weekEnd = addCalendarDays(weekStart, 6);
                const isCurrent = toDateKey(weekStart) === toDateKey(mobileWeekStart);
                return (
                  <button
                    key={toDateKey(weekStart)}
                    type="button"
                    onClick={() => jumpToWeek(weekStart)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors active:scale-[0.99] ${
                      isCurrent
                        ? 'border-blue-200 bg-blue-50/70'
                        : 'border-slate-100 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-slate-900">
                          Week of {weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {weekStart.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} - {weekEnd.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      {isCurrent && <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">Current</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {statusPopupOrder && (
        <StatusChangePopup
          order={statusPopupOrder}
          onClose={() => setStatusPopupOrder(null)}
          onSelect={(status) => handleStatusChange(statusPopupOrder, status)}
        />
      )}
    </>
  );
};

export default HomePage;
