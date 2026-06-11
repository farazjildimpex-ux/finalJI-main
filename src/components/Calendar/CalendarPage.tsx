import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Calendar, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, addDays, subMonths, eachDayOfInterval, isSameMonth, isToday, parseISO,
} from 'date-fns';
import { useNavigate } from 'react-router-dom';

type EventType = 'journal' | 'reminder' | 'contract' | 'sample' | 'invoice';

interface CalendarEvent {
  id: string;
  type: EventType;
  title: string;
  date: string;
  subtitle?: string;
  link?: string;
}

interface EventDetail {
  loaded: boolean;
  content?: string;       // journal content
  description?: string;   // contract / sample description
  article?: string;       // contract article
  quantity?: string;      // contract quantity
  notes?: string;         // sample notes
}

const EVENT_CFG: Record<EventType, { label: string; pill: string; bar: string; text: string; badge: string; openLabel: string }> = {
  journal:  { label: 'Journal',  pill: 'bg-violet-100 text-violet-800',  bar: 'bg-violet-500',  text: 'text-violet-700',  badge: 'bg-violet-500',  openLabel: 'Open Entry'    },
  reminder: { label: 'Reminder', pill: 'bg-amber-100 text-amber-800',    bar: 'bg-amber-400',   text: 'text-amber-700',   badge: 'bg-amber-500',   openLabel: 'View Reminder' },
  contract: { label: 'Contract', pill: 'bg-emerald-100 text-emerald-800', bar: 'bg-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-500', openLabel: 'Open Contract' },
  sample:   { label: 'Letter',   pill: 'bg-blue-100 text-blue-800',      bar: 'bg-blue-500',    text: 'text-blue-700',    badge: 'bg-blue-500',    openLabel: 'Open Letter'   },
  invoice:  { label: 'Invoice',  pill: 'bg-orange-100 text-orange-800',  bar: 'bg-orange-500',  text: 'text-orange-700',  badge: 'bg-orange-500',  openLabel: 'Open Contract' },
};

const ABBR: Record<EventType, string> = {
  journal: 'JNL', reminder: 'REM', contract: 'CON', sample: 'LTR', invoice: 'INV',
};

const WEEKDAYS_LONG  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// ── Date extraction from free-text delivery schedule lines ────────────────
const MONTHS: Record<string, string> = {
  january:'01', february:'02', march:'03', april:'04', may:'05', june:'06',
  july:'07', august:'08', september:'09', october:'10', november:'11', december:'12',
  jan:'01', feb:'02', mar:'03', apr:'04', jun:'06', jul:'07', aug:'08',
  sep:'09', oct:'10', nov:'11', dec:'12',
};

function extractDateFromText(text: string): string | null {
  const s = text.toLowerCase().trim();

  // ISO: 2026-06-10
  const iso = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // DD/MM/YYYY or MM/DD/YYYY — assume DD/MM/YYYY (Indian convention)
  const slash = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slash) {
    const [, d, m, y] = slash;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  // "10 June 2026" / "10th June 2026" / "June 10, 2026" / "by 10 June 2026"
  const named = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})\b/);
  if (named) {
    const [, d, mon, y] = named;
    const m = MONTHS[mon];
    if (m) return `${y}-${m}-${d.padStart(2,'0')}`;
  }

  // "June 10, 2026" / "June 2026" (day=last of month as fallback)
  const monthFirst = s.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/);
  if (monthFirst) {
    const [, mon, d, y] = monthFirst;
    const m = MONTHS[mon];
    if (m) return `${y}-${m}-${d.padStart(2,'0')}`;
  }

  // "June 2026" (month + year only) — use 1st of that month
  const monthYear = s.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})\b/);
  if (monthYear) {
    const [, mon, y] = monthYear;
    const m = MONTHS[mon];
    if (m) return `${y}-${m}-01`;
  }

  return null;
}

function extractDateFromSchedule(schedule: string[] | null | undefined): string | null {
  if (!schedule || !Array.isArray(schedule)) return null;
  for (const line of schedule) {
    if (!line) continue;
    const d = extractDateFromText(line);
    if (d) return d;
  }
  return null;
}

// Strip HTML tags for plain-text preview
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(?:div|p)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const [viewDate, setViewDate]         = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [events, setEvents]             = useState<CalendarEvent[]>([]);
  const [loading, setLoading]           = useState(true);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [details, setDetails]           = useState<Record<string, EventDetail>>({});
  const [contractQueryError, setContractQueryError] = useState<string | null>(null);
  const [mobileCalendarMode, setMobileCalendarMode] = useState<'week' | 'month'>('week');

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate));
    const end   = endOfWeek(endOfMonth(viewDate));
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const rangeStart = format(calendarDays[0], 'yyyy-MM-dd');
    const rangeEnd   = format(calendarDays[calendarDays.length - 1], 'yyyy-MM-dd');

    const [journalRes, reminderRes, contractRes, sampleRes, invoiceRes] = await Promise.allSettled([
      supabase.from('journal_entries').select('id, title, entry_date').gte('entry_date', rangeStart).lte('entry_date', rangeEnd),
      supabase.from('journal_entries').select('id, title, reminder_date, reminder_time').eq('reminder_enabled', true).not('reminder_date', 'is', null).gte('reminder_date', rangeStart).lte('reminder_date', rangeEnd),
      supabase.from('contracts').select('id, contract_no, buyer_name, delivery_schedule'),
      supabase.from('samples').select('id, sample_number, supplier_name, due_date').not('due_date', 'is', null).gte('due_date', rangeStart).lte('due_date', rangeEnd),
      supabase.from('invoices').select('id, invoice_number, contract_numbers, delivery_date').not('delivery_date', 'is', null).gte('delivery_date', rangeStart).lte('delivery_date', rangeEnd),
    ]);

    const next: CalendarEvent[] = [];

    if (journalRes.status === 'fulfilled' && journalRes.value.data) {
      journalRes.value.data.forEach(e => next.push({ id: e.id, type: 'journal', title: e.title || 'Journal Entry', date: e.entry_date, link: `/app/home?entry=${e.id}` }));
    }
    if (reminderRes.status === 'fulfilled' && reminderRes.value.data) {
      reminderRes.value.data.forEach(e => next.push({ id: `r-${e.id}`, type: 'reminder', title: e.title || 'Reminder', date: e.reminder_date as string, subtitle: e.reminder_time ? `at ${e.reminder_time}` : undefined, link: `/app/home?entry=${e.id}` }));
    }
    if (contractRes.status === 'fulfilled' && contractRes.value.data) {
      setContractQueryError(null);
      contractRes.value.data.forEach(c => {
        const date = extractDateFromSchedule(c.delivery_schedule);
        if (date && date >= rangeStart && date <= rangeEnd) {
          next.push({ id: c.id, type: 'contract', title: c.contract_no, date, subtitle: c.buyer_name, link: `/app/contracts/${c.id}` });
        }
      });
    } else if (contractRes.status === 'fulfilled' && contractRes.value.error) {
      setContractQueryError(contractRes.value.error.message || 'Unknown error');
    }
    if (sampleRes.status === 'fulfilled' && sampleRes.value.data) {
      sampleRes.value.data.forEach(s => next.push({ id: s.id, type: 'sample', title: s.sample_number, date: s.due_date as string, subtitle: s.supplier_name, link: `/app/samples/${s.id}` }));
    }
    if (invoiceRes.status === 'fulfilled' && invoiceRes.value.data) {
      const contractNos = [...new Set(
        invoiceRes.value.data.flatMap(inv => inv.contract_numbers || []).filter(Boolean),
      )];
      const contractLinkByNo: Record<string, string> = {};
      if (contractNos.length > 0) {
        const { data: contractRows } = await supabase
          .from('contracts')
          .select('id, contract_no')
          .in('contract_no', contractNos);
        for (const row of contractRows || []) {
          contractLinkByNo[row.contract_no] = `/app/contracts/${row.id}`;
        }
      }
      invoiceRes.value.data.forEach(inv => {
        const contractNo = inv.contract_numbers?.[0];
        next.push({
          id: `inv-${inv.id}`,
          type: 'invoice',
          title: inv.invoice_number,
          date: inv.delivery_date as string,
          subtitle: contractNo ? `Contract ${contractNo}` : 'Invoice delivery',
          link: contractNo && contractLinkByNo[contractNo] ? contractLinkByNo[contractNo] : undefined,
        });
      });
    }

    setEvents(next);
    setLoading(false);
  }, [calendarDays]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Lazy-load event details when expanded
  useEffect(() => {
    if (!expandedId) return;
    if (details[expandedId]?.loaded) return;

    const ev = events.find(e => e.id === expandedId);
    if (!ev) return;

    const mark = () => setDetails(p => ({ ...p, [expandedId]: { loaded: true } }));

    if (ev.type === 'contract') {
      supabase.from('contracts')
        .select('description, article, quantity')
        .eq('id', ev.id).single()
        .then(({ data }) => {
          if (!data) { mark(); return; }
          const qty = Array.isArray(data.quantity) ? data.quantity[0] : data.quantity;
          setDetails(p => ({ ...p, [expandedId]: { loaded: true, description: data.description, article: data.article, quantity: qty } }));
        });
    } else if (ev.type === 'journal') {
      supabase.from('journal_entries')
        .select('content')
        .eq('id', ev.id).single()
        .then(({ data }) => {
          setDetails(p => ({ ...p, [expandedId]: { loaded: true, content: data?.content || '' } }));
        });
    } else if (ev.type === 'sample') {
      supabase.from('samples')
        .select('description, notes')
        .eq('id', ev.id).single()
        .then(({ data }) => {
          setDetails(p => ({ ...p, [expandedId]: { loaded: true, description: data?.description, notes: data?.notes } }));
        });
    } else {
      // reminder — no extra fetch needed
      setDetails(p => ({ ...p, [expandedId]: { loaded: true } }));
    }
  }, [expandedId, events, details]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach(ev => map.set(ev.date, [...(map.get(ev.date) || []), ev]));
    return map;
  }, [events]);

  const selectedEvents = useMemo(() => byDate.get(selectedDate) || [], [byDate, selectedDate]);

  const goToday = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setViewDate(new Date());
    setSelectedDate(today);
  };

  const handleDateSelect = (ds: string) => {
    setSelectedDate(ds);
    setExpandedId(null);
  };

  // ── Day Cell ──────────────────────────────────────────────────────────────
  const DayCell = ({ day, idx }: { day: Date; idx: number }) => {
    const ds       = format(day, 'yyyy-MM-dd');
    const dayEvs   = byDate.get(ds) || [];
    const inMonth  = isSameMonth(day, viewDate);
    const isSel    = ds === selectedDate;
    const todayDay = isToday(day);
    const isLastRow = idx >= calendarDays.length - 7;
    const isLastCol = idx % 7 === 6;

    const groupedByType: Partial<Record<EventType, CalendarEvent[]>> = {};
    dayEvs.forEach(ev => { groupedByType[ev.type] = [...(groupedByType[ev.type] || []), ev]; });
    const types = (Object.keys(groupedByType) as EventType[]);

    return (
      <button
        onClick={() => handleDateSelect(ds)}
        className={`group relative flex flex-col min-h-[72px] sm:min-h-[88px] p-1 sm:p-1.5 transition-colors text-left
          border-b border-r border-gray-100 overflow-hidden
          ${isLastRow ? 'border-b-0' : ''}
          ${isLastCol ? 'border-r-0' : ''}
          ${isSel ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : 'hover:bg-gray-50/80'}
        `}
      >
        <span className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full text-xs sm:text-sm font-bold mb-1 flex-shrink-0
          ${todayDay ? 'bg-blue-600 text-white' : ''}
          ${isSel && !todayDay ? 'text-blue-700' : ''}
          ${!isSel && !todayDay && inMonth ? 'text-slate-800' : ''}
          ${!inMonth ? 'text-gray-300' : ''}
        `}>
          {format(day, 'd')}
        </span>

        <div className="flex flex-col gap-0.5 w-full min-h-[18px] sm:min-h-[36px]">
          {types.slice(0, 3).map(type => {
            const cfg   = EVENT_CFG[type];
            const count = groupedByType[type]!.length;
            return (
              <div key={type} className={`flex items-center gap-1 px-1 py-0.5 rounded text-[9px] sm:text-[10px] font-bold leading-none truncate ${cfg.pill}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.badge}`} />
                <span className="truncate">{ABBR[type]}{count > 1 ? ` ×${count}` : ''}</span>
              </div>
            );
          })}
          {types.length > 3 && (
            <div className="text-[9px] font-bold text-gray-400 px-1">+{types.length - 3}</div>
          )}
        </div>
      </button>
    );
  };

  // ── Expandable Event Row ──────────────────────────────────────────────────
  const EventRow = ({ ev }: { ev: CalendarEvent }) => {
    const cfg      = EVENT_CFG[ev.type];
    const isOpen   = expandedId === ev.id;
    const detail   = details[ev.id];

    const toggle = () => setExpandedId(isOpen ? null : ev.id);

    const renderDetail = () => {
      if (!detail?.loaded) {
        return (
          <div className="flex items-center gap-2 py-2 text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="text-xs">Loading…</span>
          </div>
        );
      }

      if (ev.type === 'contract') {
        return (
          <div className="space-y-1.5">
            {detail.article && (
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Article</span>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">{detail.article}</p>
              </div>
            )}
            {detail.description && (
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</span>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed line-clamp-3">{detail.description}</p>
              </div>
            )}
            {detail.quantity && (
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quantity</span>
                <p className="text-xs text-slate-600 mt-0.5">{detail.quantity}</p>
              </div>
            )}
          </div>
        );
      }

      if (ev.type === 'journal') {
        const preview = detail.content ? stripHtml(detail.content).slice(0, 280) : '';
        return (
          <div>
            {preview ? (
              <p className="text-xs text-slate-600 leading-relaxed">{preview}{detail.content && stripHtml(detail.content).length > 280 ? '…' : ''}</p>
            ) : (
              <p className="text-xs text-slate-400 italic">No content</p>
            )}
          </div>
        );
      }

      if (ev.type === 'sample') {
        return (
          <div className="space-y-1.5">
            {detail.description && (
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subject</span>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">{detail.description}</p>
              </div>
            )}
            {detail.notes && (
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Notes preview</span>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed line-clamp-2">{stripHtml(detail.notes).slice(0, 180)}</p>
              </div>
            )}
          </div>
        );
      }

      // reminder
      return (
        <div>
          {ev.subtitle && (
            <p className="text-sm font-semibold text-slate-700">{ev.subtitle}</p>
          )}
        </div>
      );
    };

    return (
      <div className={`border-b border-gray-100 last:border-b-0 transition-colors ${isOpen ? 'bg-slate-50/60' : ''}`}>
        {/* Header row — tap to expand */}
        <button
          type="button"
          onClick={toggle}
          className="w-full flex items-start gap-3 px-4 py-3.5 text-left active:bg-gray-100 transition-colors"
        >
          <div className={`mt-0.5 w-1 min-h-[36px] h-full rounded-full flex-shrink-0 ${cfg.bar}`} style={{ alignSelf: 'stretch' }} />
          <div className="flex-1 min-w-0">
            <span className={`inline-block text-[10px] font-bold uppercase tracking-wider mb-0.5 ${cfg.text}`}>
              {cfg.label}
            </span>
            <p className="text-sm font-semibold text-slate-800 truncate leading-snug">
              {ev.title}
            </p>
            {ev.subtitle && !isOpen && (
              <p className="text-xs text-slate-400 truncate mt-0.5">{ev.subtitle}</p>
            )}
          </div>
          {isOpen
            ? <ChevronUp className="h-4 w-4 text-blue-400 flex-shrink-0 mt-1" />
            : <ChevronDown className="h-4 w-4 text-gray-300 flex-shrink-0 mt-1" />
          }
        </button>

        {/* Expanded detail panel */}
        {isOpen && (
          <div className="px-4 pb-4 pt-0">
            <div className="ml-4 pl-4 border-l-2 border-gray-100">
              {renderDetail()}
              {ev.link && (
                <button
                  type="button"
                  onClick={() => navigate(ev.link!)}
                  className={`mt-3 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-colors
                    ${ev.type === 'contract' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : ''}
                    ${ev.type === 'journal'  ? 'bg-violet-50 text-violet-700 hover:bg-violet-100'   : ''}
                    ${ev.type === 'reminder' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'       : ''}
                    ${ev.type === 'sample'   ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'          : ''}
                    ${ev.type === 'invoice'  ? 'bg-orange-50 text-orange-700 hover:bg-orange-100'  : ''}
                  `}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {cfg.openLabel}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const selectedParsed = parseISO(selectedDate);
  const selectedWeekStart = startOfWeek(selectedParsed);

  return (
    <>
    <div className="md:hidden min-h-full bg-gray-50 px-4 pt-4 pb-24 page-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-gray-400">Calendar</p>
          <h1 className="mt-1 text-[22px] font-bold text-gray-900">{format(selectedParsed, 'd MMM yyyy')}</h1>
        </div>
        <button onClick={goToday} className="h-9 px-3 rounded-lg bg-white border border-gray-200 text-[12px] font-bold text-blue-600 shadow-sm">
          Today
        </button>
      </div>

      <div className="mt-4 rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          <button onClick={() => { const next = addMonths(selectedParsed, -1); setViewDate(next); setSelectedDate(format(next, 'yyyy-MM-dd')); }} className="h-8 w-8 rounded-lg bg-gray-50 border border-gray-200 text-gray-400 flex items-center justify-center">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setMobileCalendarMode(mode => mode === 'week' ? 'month' : 'week')}
            className="h-8 px-3 rounded-lg bg-blue-50 text-[12px] font-bold text-blue-600"
          >
            {mobileCalendarMode === 'week' ? 'Month view' : 'Week view'}
          </button>
          <button onClick={() => { const next = addMonths(selectedParsed, 1); setViewDate(next); setSelectedDate(format(next, 'yyyy-MM-dd')); }} className="h-8 w-8 rounded-lg bg-gray-50 border border-gray-200 text-gray-400 flex items-center justify-center">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 pt-3">
          <p className="text-[14px] font-bold text-gray-900 text-center">{format(selectedParsed, 'MMMM yyyy')}</p>
        </div>
        <div className="px-3 py-3">
          {mobileCalendarMode === 'month' && (
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS_SHORT.map(day => (
                <div key={day} className="h-6 flex items-center justify-center text-[10px] font-bold text-gray-400 uppercase">
                  {day}
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-7 gap-1">
            {(mobileCalendarMode === 'month' ? calendarDays : Array.from({ length: 7 }, (_, idx) => addDays(selectedWeekStart, idx))).map((day) => {
              const ds = format(day, 'yyyy-MM-dd');
              const count = (byDate.get(ds) || []).length;
              const active = ds === selectedDate;
              return (
                <button
                  key={ds}
                  onClick={() => handleDateSelect(ds)}
                  className={`${mobileCalendarMode === 'month' ? 'h-11' : 'h-14'} rounded-xl text-center transition-colors flex flex-col items-center justify-center ${active ? 'text-blue-600 bg-blue-50' : 'text-gray-500 active:bg-gray-50'} ${!isSameMonth(day, selectedParsed) ? 'opacity-35' : ''}`}
                >
                  <span className={`block h-3 text-[10px] font-semibold uppercase ${mobileCalendarMode === 'week' ? '' : 'opacity-0'}`}>
                    {mobileCalendarMode === 'week' ? format(day, 'EEE') : 'day'}
                  </span>
                  <span className="block mt-0.5 text-[15px] font-bold leading-none">{format(day, 'd')}</span>
                  <span className={`mx-auto mt-1 block h-1.5 w-1.5 rounded-full ${count > 0 ? (active ? 'bg-blue-600' : 'bg-gray-300') : 'bg-transparent'}`} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3.5 border-b border-gray-100">
          <p className="text-[15px] font-bold text-gray-900">{format(selectedParsed, 'EEEE')}</p>
          <p className="mt-0.5 text-[11px] text-gray-400">
            {selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}
          </p>
        </div>
        {loading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
          </div>
        ) : selectedEvents.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Calendar className="h-6 w-6 text-gray-300 mx-auto mb-2" />
            <p className="text-[13px] font-semibold text-gray-400">Nothing scheduled</p>
          </div>
        ) : (
          <div>
            {selectedEvents.map(ev => <EventRow key={ev.id} ev={ev} />)}
          </div>
        )}
      </div>
    </div>

    <div className="hidden md:block min-h-full bg-gray-50/40">
      <div className="px-3 sm:px-6 py-5 max-w-6xl mx-auto page-fade-in">

        {/* Header */}
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-500 mb-0.5">Overview</p>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Calendar</h1>
          <p className="text-xs text-slate-400 mt-0.5">Tap a date to see events — tap an event to expand details</p>
        </div>

        {/* Contract query error banner */}
        {contractQueryError && (
          <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
            <span className="text-red-500 text-xs font-bold flex-shrink-0 mt-0.5">⚠</span>
            <div>
              <p className="text-xs font-bold text-red-700">Contract deliveries couldn't load</p>
              <p className="text-[11px] text-red-500 mt-0.5">{contractQueryError}</p>
              <p className="text-[11px] text-red-400 mt-1">Run the SQL migration in Supabase to add the <code className="bg-red-100 px-1 rounded">delivery_date</code> column, then open the contract and set its Delivery Date.</p>
            </div>
          </div>
        )}

        {/* Legend bar */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4">
          {(Object.keys(EVENT_CFG) as EventType[]).map(type => (
            <div key={type} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-sm ${EVENT_CFG[type].bar}`} />
              <span className="text-[11px] font-semibold text-slate-500">{EVENT_CFG[type].label}</span>
            </div>
          ))}
        </div>

        {/* Desktop: 2-col. Mobile: stacked */}
        <div className="md:grid md:grid-cols-5 md:gap-5">

          {/* ── Calendar Grid (col-span-3) ─────────────────────────────────── */}
          <div className="md:col-span-3 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4 md:mb-0">

            {/* Month nav */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <button onClick={() => setViewDate(v => subMonths(v, 1))} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-3">
                <p className="text-sm font-bold text-slate-900">{format(viewDate, 'MMMM yyyy')}</p>
                <button onClick={goToday} className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200">
                  Today
                </button>
                {loading && <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
              </div>
              <button onClick={() => setViewDate(v => addMonths(v, 1))} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
              {WEEKDAYS_SHORT.map(d => (
                <div key={d} className="py-2 text-center text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  {d}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => (
                <DayCell key={format(day, 'yyyy-MM-dd') + idx} day={day} idx={idx} />
              ))}
            </div>
          </div>

          {/* ── Events Panel (col-span-2) ──────────────────────────────────── */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">

            {/* Panel header */}
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                {WEEKDAYS_LONG[selectedParsed.getDay()]}
              </p>
              <p className="text-lg font-black text-slate-900 mt-0.5 leading-tight">
                {format(selectedParsed, 'd MMM yyyy')}
              </p>
              {selectedEvents.length > 0 && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''} — tap to expand
                </p>
              )}
            </div>

            {/* Events list */}
            <div className="flex-1 overflow-y-auto">
              {selectedEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                    <Calendar className="h-5 w-5 text-gray-300" />
                  </div>
                  <p className="text-sm font-semibold text-gray-400">Nothing scheduled</p>
                  <p className="text-xs text-gray-300 mt-1 leading-snug">
                    Select a date with coloured chips to see what's on
                  </p>
                </div>
              ) : (
                <div>
                  {selectedEvents.map(ev => <EventRow key={ev.id} ev={ev} />)}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
    </>
  );
};

export default CalendarPage;
