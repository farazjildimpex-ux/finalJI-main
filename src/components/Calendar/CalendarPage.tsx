import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, eachDayOfInterval, isSameMonth, isToday, parseISO,
} from 'date-fns';
import { useNavigate } from 'react-router-dom';

type EventType = 'journal' | 'reminder' | 'contract' | 'sample';

interface CalendarEvent {
  id: string;
  type: EventType;
  title: string;
  date: string;
  subtitle?: string;
  link?: string;
}

const EVENT_CFG: Record<EventType, { label: string; pill: string; bar: string; text: string; badge: string }> = {
  journal:  { label: 'Journal',  pill: 'bg-violet-100 text-violet-800',  bar: 'bg-violet-500',  text: 'text-violet-700',  badge: 'bg-violet-500'  },
  reminder: { label: 'Reminder', pill: 'bg-amber-100 text-amber-800',   bar: 'bg-amber-400',   text: 'text-amber-700',   badge: 'bg-amber-500'   },
  contract: { label: 'Contract', pill: 'bg-emerald-100 text-emerald-800', bar: 'bg-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-500' },
  sample:   { label: 'Letter',   pill: 'bg-blue-100 text-blue-800',     bar: 'bg-blue-500',    text: 'text-blue-700',    badge: 'bg-blue-500'    },
};

const ABBR: Record<EventType, string> = {
  journal: 'JNL', reminder: 'REM', contract: 'CON', sample: 'LTR',
};

const WEEKDAYS_LONG  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const [viewDate, setViewDate]         = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [events, setEvents]             = useState<CalendarEvent[]>([]);
  const [loading, setLoading]           = useState(true);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate));
    const end   = endOfWeek(endOfMonth(viewDate));
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const rangeStart = format(calendarDays[0], 'yyyy-MM-dd');
    const rangeEnd   = format(calendarDays[calendarDays.length - 1], 'yyyy-MM-dd');

    const [journalRes, reminderRes, contractRes, sampleRes] = await Promise.allSettled([
      supabase.from('journal_entries').select('id, title, entry_date').gte('entry_date', rangeStart).lte('entry_date', rangeEnd),
      supabase.from('journal_entries').select('id, title, reminder_date, reminder_time').eq('reminder_enabled', true).not('reminder_date', 'is', null).gte('reminder_date', rangeStart).lte('reminder_date', rangeEnd),
      supabase.from('contracts').select('id, contract_no, buyer_name, delivery_date').not('delivery_date', 'is', null).gte('delivery_date', rangeStart).lte('delivery_date', rangeEnd),
      supabase.from('samples').select('id, sample_number, supplier_name, due_date').not('due_date', 'is', null).gte('due_date', rangeStart).lte('due_date', rangeEnd),
    ]);

    const next: CalendarEvent[] = [];

    if (journalRes.status === 'fulfilled' && journalRes.value.data) {
      journalRes.value.data.forEach(e => next.push({ id: e.id, type: 'journal', title: e.title || 'Journal Entry', date: e.entry_date, link: `/app/home?entry=${e.id}` }));
    }
    if (reminderRes.status === 'fulfilled' && reminderRes.value.data) {
      reminderRes.value.data.forEach(e => next.push({ id: `r-${e.id}`, type: 'reminder', title: e.title || 'Reminder', date: e.reminder_date as string, subtitle: e.reminder_time ? `at ${e.reminder_time}` : undefined, link: `/app/home?entry=${e.id}` }));
    }
    if (contractRes.status === 'fulfilled' && contractRes.value.data) {
      contractRes.value.data.forEach(c => next.push({ id: c.id, type: 'contract', title: c.contract_no, date: c.delivery_date as string, subtitle: c.buyer_name, link: `/app/contracts/${c.id}` }));
    }
    if (sampleRes.status === 'fulfilled' && sampleRes.value.data) {
      sampleRes.value.data.forEach(s => next.push({ id: s.id, type: 'sample', title: s.sample_number, date: s.due_date as string, subtitle: s.supplier_name, link: `/app/samples/${s.id}` }));
    }

    setEvents(next);
    setLoading(false);
  }, [calendarDays]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

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
        onClick={() => setSelectedDate(ds)}
        className={`group relative flex flex-col min-h-[72px] sm:min-h-[88px] p-1 sm:p-1.5 transition-colors text-left
          border-b border-r border-gray-100 overflow-hidden
          ${isLastRow ? 'border-b-0' : ''}
          ${isLastCol ? 'border-r-0' : ''}
          ${isSel ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : 'hover:bg-gray-50/80'}
        `}
      >
        {/* Date number */}
        <span className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full text-xs sm:text-sm font-bold mb-1 flex-shrink-0
          ${todayDay ? 'bg-blue-600 text-white' : ''}
          ${isSel && !todayDay ? 'text-blue-700' : ''}
          ${!isSel && !todayDay && inMonth ? 'text-slate-800' : ''}
          ${!inMonth ? 'text-gray-300' : ''}
        `}>
          {format(day, 'd')}
        </span>

        {/* Event chips */}
        <div className="flex flex-col gap-0.5 w-full">
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
            <div className="text-[9px] font-bold text-gray-400 px-1">+{types.length - 3} more</div>
          )}
        </div>
      </button>
    );
  };

  // ── Event Row ─────────────────────────────────────────────────────────────
  const EventRow = ({ ev }: { ev: CalendarEvent }) => {
    const cfg = EVENT_CFG[ev.type];
    return (
      <button
        onClick={() => ev.link && navigate(ev.link)}
        className="group w-full flex items-start gap-3 p-3 sm:p-4 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100 last:border-b-0"
      >
        <div className={`mt-0.5 w-1 h-full min-h-[36px] rounded-full flex-shrink-0 ${cfg.bar}`} />
        <div className="flex-1 min-w-0">
          <span className={`inline-block text-[10px] font-bold uppercase tracking-wider mb-0.5 ${cfg.text}`}>
            {cfg.label}
          </span>
          <p className="text-sm font-semibold text-slate-800 truncate leading-snug group-hover:text-blue-700 transition-colors">
            {ev.title}
          </p>
          {ev.subtitle && (
            <p className="text-xs text-slate-400 truncate mt-0.5">{ev.subtitle}</p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-400 flex-shrink-0 mt-1 transition-colors" />
      </button>
    );
  };

  const selectedParsed = parseISO(selectedDate);

  return (
    <div className="min-h-full bg-gray-50/40">
      <div className="px-3 sm:px-6 py-5 max-w-6xl mx-auto page-fade-in">

        {/* Header */}
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-500 mb-0.5">Overview</p>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Calendar</h1>
          <p className="text-xs text-slate-400 mt-0.5">Entries, reminders, deliveries &amp; due dates</p>
        </div>

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
                  {selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}
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
  );
};

export default CalendarPage;
