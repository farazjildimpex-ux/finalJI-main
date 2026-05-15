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

const EVENT_CFG: Record<EventType, { label: string; dot: string; text: string; bg: string }> = {
  journal:  { label: 'Journal',    dot: 'bg-violet-500',  text: 'text-violet-700',  bg: 'bg-violet-50'  },
  reminder: { label: 'Reminder',   dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50'   },
  contract: { label: 'Contract',   dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  sample:   { label: 'Letter',     dot: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50'    },
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
      supabase
        .from('journal_entries')
        .select('id, title, entry_date, color')
        .gte('entry_date', rangeStart)
        .lte('entry_date', rangeEnd),

      supabase
        .from('journal_entries')
        .select('id, title, reminder_date, reminder_time')
        .eq('reminder_enabled', true)
        .not('reminder_date', 'is', null)
        .gte('reminder_date', rangeStart)
        .lte('reminder_date', rangeEnd),

      supabase
        .from('contracts')
        .select('id, contract_no, buyer_name, delivery_date')
        .not('delivery_date', 'is', null)
        .gte('delivery_date', rangeStart)
        .lte('delivery_date', rangeEnd),

      supabase
        .from('samples')
        .select('id, sample_number, supplier_name, due_date')
        .not('due_date', 'is', null)
        .gte('due_date', rangeStart)
        .lte('due_date', rangeEnd),
    ]);

    const next: CalendarEvent[] = [];

    if (journalRes.status === 'fulfilled' && journalRes.value.data) {
      journalRes.value.data.forEach(e => next.push({
        id: e.id, type: 'journal', title: e.title || 'Journal Entry',
        date: e.entry_date, link: '/app/home',
      }));
    }

    if (reminderRes.status === 'fulfilled' && reminderRes.value.data) {
      reminderRes.value.data.forEach(e => next.push({
        id: `r-${e.id}`, type: 'reminder', title: e.title || 'Reminder',
        date: e.reminder_date as string,
        subtitle: e.reminder_time ? `at ${e.reminder_time}` : undefined,
        link: '/app/home',
      }));
    }

    if (contractRes.status === 'fulfilled' && contractRes.value.data) {
      contractRes.value.data.forEach(c => next.push({
        id: c.id, type: 'contract', title: c.contract_no,
        date: c.delivery_date as string,
        subtitle: c.buyer_name,
        link: `/app/contracts/${c.id}`,
      }));
    }

    if (sampleRes.status === 'fulfilled' && sampleRes.value.data) {
      sampleRes.value.data.forEach(s => next.push({
        id: s.id, type: 'sample', title: s.sample_number,
        date: s.due_date as string,
        subtitle: s.supplier_name,
        link: `/app/samples/${s.id}`,
      }));
    }

    setEvents(next);
    setLoading(false);
  }, [calendarDays]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach(ev => {
      map.set(ev.date, [...(map.get(ev.date) || []), ev]);
    });
    return map;
  }, [events]);

  const selectedEvents = useMemo(() => byDate.get(selectedDate) || [], [byDate, selectedDate]);

  return (
    <div className="min-h-full bg-gray-50/60">
      <div className="px-4 py-6 max-w-3xl mx-auto space-y-5 page-fade-in">

        {/* Page header */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-500 mb-1">Overview</p>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Calendar</h1>
          <p className="text-xs text-slate-500 mt-0.5">Entries, reminders, deliveries &amp; due dates</p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {(Object.keys(EVENT_CFG) as EventType[]).map(type => (
            <div key={type} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${EVENT_CFG[type].dot}`} />
              <span className="text-[11px] font-semibold text-slate-500">{EVENT_CFG[type].label}</span>
            </div>
          ))}
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Month nav */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <button
              onClick={() => setViewDate(v => subMonths(v, 1))}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <p className="text-base font-bold text-slate-900">{format(viewDate, 'MMMM yyyy')}</p>

            <div className="flex items-center gap-1">
              <button
                onClick={() => { setViewDate(new Date()); setSelectedDate(format(new Date(), 'yyyy-MM-dd')); }}
                className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => setViewDate(v => addMonths(v, 1))}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {WEEKDAYS.map(day => (
              <div key={day} className="py-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const ds        = format(day, 'yyyy-MM-dd');
              const dayEvents = byDate.get(ds) || [];
              const inMonth   = isSameMonth(day, viewDate);
              const isSelected = ds === selectedDate;
              const todayDay   = isToday(day);
              const types      = [...new Set(dayEvents.map(e => e.type))];
              const isLastRow  = idx >= calendarDays.length - 7;
              const isLastCol  = idx % 7 === 6;

              return (
                <button
                  key={ds + idx}
                  onClick={() => setSelectedDate(ds)}
                  className={`relative min-h-[52px] sm:min-h-[62px] flex flex-col items-center pt-2 pb-1 transition-colors
                    border-b border-r border-gray-100
                    ${isLastRow ? 'border-b-0' : ''}
                    ${isLastCol ? 'border-r-0' : ''}
                    ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50 active:bg-gray-100'}
                  `}
                >
                  <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold
                    ${todayDay ? 'bg-blue-600 text-white' : ''}
                    ${isSelected && !todayDay ? 'text-blue-700' : ''}
                    ${!isSelected && !todayDay && inMonth ? 'text-slate-800' : ''}
                    ${!inMonth ? 'text-gray-300' : ''}
                  `}>
                    {format(day, 'd')}
                  </span>

                  {types.length > 0 && (
                    <div className="flex items-center gap-0.5 mt-1 flex-wrap justify-center px-0.5">
                      {types.slice(0, 4).map(t => (
                        <span key={t} className={`w-1.5 h-1.5 rounded-full ${EVENT_CFG[t].dot}`} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected date panel */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {format(parseISO(selectedDate), 'EEEE')}
              </p>
              <p className="text-base font-bold text-slate-900 mt-0.5">
                {format(parseISO(selectedDate), 'd MMMM yyyy')}
              </p>
            </div>
            {loading && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {selectedEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-8 w-8 text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-400">Nothing on this day</p>
              <p className="text-xs text-gray-300 mt-0.5">Tap a date with dots to see events</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {selectedEvents.map(ev => {
                const cfg = EVENT_CFG[ev.type];
                return (
                  <button
                    key={ev.id}
                    onClick={() => ev.link && navigate(ev.link)}
                    className="w-full flex items-start gap-3.5 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors group"
                  >
                    <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${cfg.text}`}>
                          {cfg.label}
                        </span>
                        {ev.subtitle && (
                          <span className="text-[10px] text-gray-400 truncate">{ev.subtitle}</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-slate-800 truncate mt-0.5 group-hover:text-blue-700 transition-colors">
                        {ev.title}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-400 flex-shrink-0 mt-1 transition-colors" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default CalendarPage;
