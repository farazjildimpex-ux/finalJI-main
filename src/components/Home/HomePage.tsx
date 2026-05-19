import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Plus, Search, X, ChevronRight, AlertCircle, BookOpen, PenLine,
} from 'lucide-react';
import RecentOrdersList from './RecentOrdersList';
import JournalWidget from './JournalWidget';
import JournalEntryCard from '../Journal/JournalEntryCard';
import JournalEntryForm from '../Journal/JournalEntryForm';
import JournalEntryPopup from '../Journal/JournalEntryPopup';
import PullToRefresh from '../UI/PullToRefresh';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import type { Order, JournalEntry } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { suggestJournalLink } from '../../lib/journalAI';
import { dialogService } from '../../lib/dialogService';

/* ─── tokens (exact blueprint values) ─────────────────────────── */
const T = {
  blue:       '#2563FF',
  dark:       '#0F172A',
  muted:      '#667085',
  bg:         '#F8FAFC',
  card:       '#FFFFFF',
  border:     '#E9EEF5',
  entryBorder:'#EEF2F6',
  cardBorder: '#EDF2F7',
  issuedBg:   '#EEF4FF', issuedTxt:    '#2563FF',
  openBg:     '#FFF3E8', openTxt:      '#D97706',
  doneBg:     '#EAFBF0', doneTxt:      '#16A34A',
  logoBorder: '#DCE6F5',
};

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

function statusPill(status?: string | null) {
  const s = (status || 'Issued').toLowerCase();
  if (s === 'completed' || s === 'delivered')  return { bg: T.doneBg,   txt: T.doneTxt,  label: status };
  if (s === 'open' || s === 'inspected')        return { bg: T.openBg,   txt: T.openTxt,  label: status };
  return                                               { bg: T.issuedBg, txt: T.issuedTxt,label: status || 'Issued' };
}

function entryBullets(content?: string | null): string[] {
  if (!content?.trim()) return [];
  return content.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 3);
}

/* ─── filter config ────────────────────────────────────────────── */
const MOBILE_FILTERS = [
  { label: 'All',       value: 'all'       },
  { label: 'Open',      value: 'open'      },
  { label: 'Contracts', value: 'contract'  },
  { label: 'Letters',   value: 'sample'    },
  { label: 'Payments',  value: 'debit_note'},
];

const DESKTOP_FILTERS = [
  { label: 'All',       value: 'all',        activeClass: 'bg-gray-800 text-white border-gray-800',       inactiveClass: 'bg-white text-gray-600 border-gray-200 hover:border-gray-400' },
  { label: 'Open',      value: 'open',       activeClass: 'bg-amber-500 text-white border-amber-500',     inactiveClass: 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400' },
  { label: 'Contracts', value: 'contract',   activeClass: 'bg-indigo-600 text-white border-indigo-600',   inactiveClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:border-indigo-400' },
  { label: 'Letters',   value: 'sample',     activeClass: 'bg-blue-600 text-white border-blue-600',       inactiveClass: 'bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-400' },
  { label: 'Payments',  value: 'debit_note', activeClass: 'bg-emerald-600 text-white border-emerald-600', inactiveClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400' },
];

const OPEN_STATUSES = ['Issued', 'Inspected'];
const JOURNAL_PAGE_SIZE = 12;

/* ─── component ────────────────────────────────────────────────── */
const HomePage: React.FC = () => {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /* state */
  const [showSearch,    setShowSearch]    = useState(false);
  const [searchTerm,    setSearchTerm]    = useState('');
  const [mobileFilter,  setMobileFilter]  = useState('all');
  const [desktopFilter, setDesktopFilter] = useState('all');
  const [desktopSearch, setDesktopSearch] = useState('');
  const [desktopJournalPage, setDesktopJournalPage] = useState(1);

  const [orders,         setOrders]         = useState<Order[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [journalLoading, setJournalLoading] = useState(true);
  const [error,          setError]          = useState<string | null>(null);

  const [editingEntry,           setEditingEntry]           = useState<JournalEntry | null>(null);
  const [selectedEntryForPopup,  setSelectedEntryForPopup]  = useState<JournalEntry | null>(null);
  const [isJournalFormOpen,      setIsJournalFormOpen]      = useState(false);
  const [isDesktopFormOpen,      setIsDesktopFormOpen]      = useState(false);

  /* ── fetch ─────────────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    try {
      setLoading(true); setError(null);
      const [cR, sR, dR] = await Promise.all([
        supabase.from('contracts').select('*').order('contract_date',   { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200),
        supabase.from('samples').select('*').order('date',              { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200),
        supabase.from('debit_notes').select('*').order('debit_note_date',{ ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200),
      ]);
      if (cR.error) throw cR.error;
      if (sR.error) throw sR.error;
      if (dR.error) throw dR.error;

      const contracts:  Order[] = (cR.data || []).map(c => ({ id: c.id, contractNumber: c.contract_no,   supplierName: c.supplier_name, article: c.article, color: c.color?.join(', ') || '', date: c.contract_date,    createdAt: c.created_at, status: c.status, type: 'contract',   contractData: c }));
      const samples:    Order[] = (sR.data || []).map(s => ({ id: s.id!, contractNumber: s.sample_number, supplierName: s.supplier_name, article: s.description || '', color: s.company_name || '', date: s.date,           createdAt: s.created_at, status: s.status, type: 'sample',    sampleData: s }));
      const debitNotes: Order[] = (dR.data || []).map(d => ({ id: d.id!, contractNumber: d.debit_note_no, supplierName: d.supplier_name, article: d.contract_no,     color: d.invoice_no,       date: d.debit_note_date, createdAt: d.created_at, status: d.status, type: 'debit_note', debitNoteData: d }));

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
      const { data, error } = await supabase.from('journal_entries').select('*').eq('user_id', user.id).order('entry_date', { ascending: false });
      if (error) throw error;
      setJournalEntries(data || []);
    } catch (e) { console.error(e); }
    finally { setJournalLoading(false); }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (user) fetchJournalEntries(); }, [user, fetchJournalEntries]);

  /* deep-link */
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
  const todayStr    = new Date().toISOString().split('T')[0];
  const todayEntries = useMemo(() => journalEntries.filter(e => e.entry_date === todayStr), [journalEntries, todayStr]);

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
      o.article.toLowerCase().includes(s) || o.color.toLowerCase().includes(s)
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
    setIsJournalFormOpen(false); setIsDesktopFormOpen(false); setEditingEntry(null);
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
        <p className="text-gray-600">Please connect your Supabase project to start managing your office data.</p>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━  MOBILE  ━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="md:hidden">
        <PullToRefresh onRefresh={handlePullRefresh}>
          <div style={{ background: T.bg, minHeight: '100vh', paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}>

            {/* ── Header ──────────────────────────────────────────── */}
            <div style={{ background: T.card, paddingTop: 32, paddingBottom: 20, paddingLeft: 24, paddingRight: 24 }}>
              {/* Row: logo + search */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <p style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', fontFamily: 'Inter, sans-serif' }}>
                    <span style={{ color: T.dark }}>JILD </span>
                    <span style={{ color: T.blue }}>IMPEX</span>
                  </p>
                </div>
                <button
                  onClick={() => { setShowSearch(true); setSearchTerm(''); }}
                  style={{
                    width: 52, height: 52, borderRadius: 18,
                    background: T.card, border: `1px solid ${T.border}`,
                    boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Search style={{ width: 20, height: 20, color: T.muted }} />
                </button>
              </div>

              {/* Greeting */}
              <p style={{ fontSize: 22, fontWeight: 700, color: T.dark, fontFamily: 'Inter, sans-serif', lineHeight: 1.2 }}>
                {getGreeting()} 👋
              </p>
              <p style={{ fontSize: 14, fontWeight: 500, color: T.muted, fontFamily: 'Inter, sans-serif', marginTop: 4 }}>
                {formatFullDate()}
              </p>
            </div>

            {/* ── Journal Card ─────────────────────────────────────── */}
            <div style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 20 }}>
              <div style={{
                background: 'linear-gradient(180deg, #FFFFFF 0%, #F7FAFF 100%)',
                borderRadius: 28, padding: 24,
                border: `1px solid ${T.cardBorder}`,
                boxShadow: '0 8px 24px rgba(15,23,42,0.04)',
              }}>
                {/* Card header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 14, background: T.blue,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <BookOpen style={{ width: 22, height: 22, color: 'white' }} strokeWidth={1.75} />
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: T.dark, letterSpacing: '0.02em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
                      Today's Journal
                    </p>
                  </div>
                  <button
                    onClick={() => { setEditingEntry(null); setIsJournalFormOpen(true); }}
                    style={{
                      height: 42, paddingLeft: 18, paddingRight: 18, borderRadius: 14,
                      border: `1.5px solid ${T.blue}`, background: 'transparent',
                      display: 'flex', alignItems: 'center', gap: 6,
                      flexShrink: 0,
                    }}
                  >
                    <Plus style={{ width: 15, height: 15, color: T.blue }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.blue, fontFamily: 'Inter, sans-serif' }}>Add Entry</span>
                  </button>
                </div>

                {/* Journal entries — shown directly, no counter */}
                {journalLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                    <div className="animate-spin" style={{ width: 24, height: 24, borderRadius: 999, borderBottom: `2px solid ${T.blue}`, border: `2px solid ${T.border}`, borderBottomColor: T.blue }} />
                  </div>
                ) : todayEntries.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
                    <p style={{ fontSize: 15, fontWeight: 500, color: T.muted, fontFamily: 'Inter, sans-serif', marginBottom: 12 }}>
                      No entries for today
                    </p>
                    <button
                      onClick={() => { setEditingEntry(null); setIsJournalFormOpen(true); }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        background: T.blue, color: 'white',
                        fontSize: 13, fontWeight: 700, fontFamily: 'Inter, sans-serif',
                        padding: '12px 20px', borderRadius: 16, border: 'none',
                      }}
                    >
                      <PenLine style={{ width: 14, height: 14 }} />
                      Create Entry
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {todayEntries.map(entry => {
                      const bullets = entryBullets(entry.content);
                      const timeStr = new Date(entry.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                      return (
                        <div
                          key={entry.id}
                          style={{
                            background: T.card, borderRadius: 20, padding: 20,
                            border: `1px solid ${T.entryBorder}`,
                            display: 'flex', flexDirection: 'column', gap: 8,
                          }}
                        >
                          {/* Time inline */}
                          <p style={{ fontSize: 12, fontWeight: 500, color: T.muted, fontFamily: 'Inter, sans-serif' }}>
                            {timeStr} •
                          </p>
                          {/* Title */}
                          <p style={{ fontSize: 17, fontWeight: 700, color: T.dark, fontFamily: 'Inter, sans-serif', lineHeight: 1.3 }}
                            className="line-clamp-2">
                            {entry.title}
                          </p>
                          {/* Bullet lines */}
                          {bullets.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {bullets.map((line, i) => (
                                <p key={i} style={{ fontSize: 14, fontWeight: 500, color: T.muted, fontFamily: 'Inter, sans-serif', lineHeight: 1.4 }}>
                                  • {line}
                                </p>
                              ))}
                            </div>
                          )}
                          {/* Action row */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, paddingTop: 8, borderTop: `1px solid ${T.entryBorder}` }}>
                            <div style={{ display: 'flex', gap: 16 }}>
                              <button
                                onClick={() => { setEditingEntry(entry); setIsJournalFormOpen(true); }}
                                style={{ fontSize: 13, fontWeight: 600, color: T.blue, fontFamily: 'Inter, sans-serif', background: 'none', border: 'none' }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={async () => {
                                  const ok = await dialogService.confirm({ title: 'Delete entry?', message: 'This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' });
                                  if (!ok) return;
                                  await supabase.from('journal_entries').delete().eq('id', entry.id);
                                  fetchJournalEntries();
                                }}
                                style={{ fontSize: 13, fontWeight: 600, color: '#EF4444', fontFamily: 'Inter, sans-serif', background: 'none', border: 'none' }}
                              >
                                Delete
                              </button>
                            </div>
                            <button
                              onClick={() => setSelectedEntryForPopup(entry)}
                              style={{ display: 'flex', alignItems: 'center', gap: 2 }}
                            >
                              <ChevronRight style={{ width: 18, height: 18, color: T.muted }} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Recent Activity ──────────────────────────────────── */}
            <div style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 24 }}>
              {/* Section title */}
              <p style={{ fontSize: 15, fontWeight: 700, color: T.dark, letterSpacing: '0.02em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', marginBottom: 16 }}>
                Recent Activity
              </p>

              {/* Filter pills */}
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16 }} className="no-scrollbar">
                {MOBILE_FILTERS.map(f => {
                  const active = mobileFilter === f.value;
                  return (
                    <button
                      key={f.value}
                      onClick={() => setMobileFilter(f.value)}
                      style={{
                        height: 40, paddingLeft: 16, paddingRight: 16, borderRadius: 999,
                        border: `1.5px solid ${active ? T.dark : T.border}`,
                        background: active ? T.dark : T.card,
                        fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif',
                        color: active ? 'white' : T.muted,
                        flexShrink: 0, cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              {/* Error */}
              {error && (
                <div style={{ marginBottom: 12, padding: 12, background: '#FEF2F2', borderRadius: 16, border: '1px solid #FECACA', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle style={{ width: 16, height: 16, color: '#EF4444', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#EF4444', flex: 1 }}>{error}</span>
                  <button onClick={fetchData} style={{ fontSize: 13, fontWeight: 700, color: '#EF4444' }}>Retry</button>
                </div>
              )}

              {/* List */}
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                  <div className="animate-spin" style={{ width: 24, height: 24, borderRadius: 999, border: `2px solid ${T.border}`, borderBottomColor: T.blue }} />
                </div>
              ) : activityList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <p style={{ fontSize: 15, fontWeight: 500, color: T.muted, fontFamily: 'Inter, sans-serif' }}>No records found</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: T.card, borderRadius: 24, border: `1px solid ${T.border}`, overflow: 'hidden', boxShadow: '0 2px 8px rgba(15,23,42,0.03)' }}>
                  {activityList.slice(0, 15).map((order, idx) => {
                    const pill = statusPill(order.status);
                    return (
                      <button
                        key={`${order.type}-${order.id}`}
                        onClick={() => goToOrder(order)}
                        style={{
                          height: 88, display: 'flex', alignItems: 'center',
                          gap: 16, paddingLeft: 16, paddingRight: 16, textAlign: 'left',
                          borderTop: idx > 0 ? `1px solid ${T.border}` : 'none',
                          background: 'transparent', width: '100%', cursor: 'pointer',
                        }}
                      >
                        {/* JI logo square */}
                        <div style={{
                          width: 44, height: 44, borderRadius: 10,
                          border: `1px solid ${T.logoBorder}`,
                          background: T.issuedBg, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: T.blue, fontFamily: 'Inter, sans-serif', letterSpacing: '-0.5px' }}>JI</span>
                        </div>

                        {/* Text block */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 15, fontWeight: 700, color: T.dark, fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                            {order.contractNumber}
                          </p>
                          <p style={{ fontSize: 13, fontWeight: 500, color: T.muted, fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                            {order.supplierName}
                          </p>
                          {order.article && (
                            <p style={{ fontSize: 13, fontWeight: 500, color: T.muted, fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                              {order.article}
                            </p>
                          )}
                        </div>

                        {/* Status pill + chevron */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <div style={{
                            height: 30, paddingLeft: 14, paddingRight: 14, borderRadius: 999,
                            background: pill.bg, display: 'flex', alignItems: 'center',
                          }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: pill.txt, fontFamily: 'Inter, sans-serif' }}>
                              {pill.label}
                            </span>
                          </div>
                          <ChevronRight style={{ width: 16, height: 16, color: T.border }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </PullToRefresh>

        {/* ── Search overlay ─────────────────────────────────────── */}
        {showSearch && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: T.card, display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            {/* Search input row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px', borderBottom: `1px solid ${T.border}` }}>
              <button
                onClick={() => { setShowSearch(false); setSearchTerm(''); }}
                style={{ width: 44, height: 44, borderRadius: 16, background: T.bg, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <X style={{ width: 16, height: 16, color: T.muted }} />
              </button>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: T.muted }} />
                <input
                  autoFocus type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search anything…"
                  style={{
                    width: '100%', height: 48, paddingLeft: 44, paddingRight: searchTerm ? 36 : 16,
                    borderRadius: 18, border: `1px solid ${T.border}`, background: T.bg,
                    fontSize: 15, fontWeight: 500, color: T.dark, fontFamily: 'Inter, sans-serif',
                    outline: 'none',
                  }}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', padding: 4 }}>
                    <X style={{ width: 14, height: 14, color: T.muted }} />
                  </button>
                )}
              </div>
            </div>

            {/* Results */}
            <div style={{ flex: 1, overflowY: 'auto', background: T.bg }}>
              {!searchTerm.trim() ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 32px', textAlign: 'center' }}>
                  <div style={{ width: 60, height: 60, borderRadius: 20, background: T.card, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Search style={{ width: 24, height: 24, color: T.muted }} />
                  </div>
                  <p style={{ fontSize: 17, fontWeight: 700, color: T.dark, fontFamily: 'Inter, sans-serif', marginBottom: 8 }}>Search everything</p>
                  <p style={{ fontSize: 14, fontWeight: 500, color: T.muted, fontFamily: 'Inter, sans-serif' }}>Contracts, letters, payments, journal entries</p>
                </div>
              ) : searchOrderResults.length === 0 && searchJournalResults.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 32px' }}>
                  <p style={{ fontSize: 17, fontWeight: 700, color: T.dark, fontFamily: 'Inter, sans-serif', marginBottom: 8 }}>No results</p>
                  <p style={{ fontSize: 14, fontWeight: 500, color: T.muted, fontFamily: 'Inter, sans-serif' }}>Try a different search term</p>
                </div>
              ) : (
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {searchOrderResults.length > 0 && (
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', marginBottom: 12, paddingLeft: 4 }}>
                        Records ({searchOrderResults.length})
                      </p>
                      <div style={{ background: T.card, borderRadius: 20, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
                        {searchOrderResults.map((order, idx) => {
                          const pill = statusPill(order.status);
                          return (
                            <button key={`sr-${order.type}-${order.id}`}
                              onClick={() => { goToOrder(order); setShowSearch(false); setSearchTerm(''); }}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', textAlign: 'left', borderTop: idx > 0 ? `1px solid ${T.border}` : 'none', background: 'transparent' }}>
                              <div style={{ width: 40, height: 40, borderRadius: 10, background: T.issuedBg, border: `1px solid ${T.logoBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ fontSize: 12, fontWeight: 800, color: T.blue, fontFamily: 'Inter, sans-serif' }}>JI</span>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 14, fontWeight: 700, color: T.dark, fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.contractNumber}</p>
                                <p style={{ fontSize: 12, fontWeight: 500, color: T.muted, fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.supplierName}</p>
                              </div>
                              <div style={{ height: 28, paddingLeft: 12, paddingRight: 12, borderRadius: 999, background: pill.bg, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: pill.txt, fontFamily: 'Inter, sans-serif' }}>{pill.label}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {searchJournalResults.length > 0 && (
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', marginBottom: 12, paddingLeft: 4 }}>
                        Journal ({searchJournalResults.length})
                      </p>
                      <div style={{ background: T.card, borderRadius: 20, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
                        {searchJournalResults.map((entry, idx) => (
                          <button key={`sj-${entry.id}`}
                            onClick={() => { setSelectedEntryForPopup(entry); setShowSearch(false); setSearchTerm(''); }}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', textAlign: 'left', borderTop: idx > 0 ? `1px solid ${T.border}` : 'none', background: 'transparent' }}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#EEF4FF', border: `1px solid ${T.logoBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <BookOpen style={{ width: 16, height: 16, color: T.blue }} strokeWidth={1.75} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 14, fontWeight: 700, color: T.dark, fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.title}</p>
                              <p style={{ fontSize: 12, fontWeight: 500, color: T.muted, fontFamily: 'Inter, sans-serif' }}>
                                {new Date(entry.entry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                            <ChevronRight style={{ width: 16, height: 16, color: T.border, flexShrink: 0 }} />
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
        {isJournalFormOpen && (
          <JournalEntryForm
            initialDate={editingEntry ? new Date(editingEntry.entry_date) : new Date()}
            initialEntry={editingEntry}
            onClose={() => { setIsJournalFormOpen(false); setEditingEntry(null); }}
            onSave={handleJournalSave}
          />
        )}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━  DESKTOP  ━━━━━━━━━━━━━━━━━━━━━━━ */}
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
              <button onClick={() => setIsDesktopFormOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-[11px] font-bold rounded-lg hover:bg-blue-700 transition-colors">
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
                              <p className="text-[10px] text-gray-400 mt-0.5">{new Date(entry.entry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
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
                {DESKTOP_FILTERS.map(f => (
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
        <JournalEntryForm initialDate={new Date()} initialEntry={null}
          onClose={() => setIsDesktopFormOpen(false)} onSave={handleJournalSave} />
      )}

      {/* Journal popup — both layouts */}
      {selectedEntryForPopup && (
        <JournalEntryPopup entry={selectedEntryForPopup} allEntries={journalEntries}
          onClose={() => setSelectedEntryForPopup(null)} onUpdate={fetchJournalEntries} />
      )}
    </>
  );
};

export default HomePage;
