"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, eachDayOfInterval } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';

interface DatePickerProps {
  value: string; // yyyy-MM-dd
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, label, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDate = useMemo(() => (value ? new Date(value) : null), [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate));
    const end = endOfWeek(endOfMonth(viewDate));
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  const handleDateSelect = (date: Date) => {
    onChange(format(date, 'yyyy-MM-dd'));
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-center gap-3 px-3 py-2.5 bg-white border border-blue-200 rounded-xl text-sm text-gray-900 shadow-sm hover:border-blue-400 transition-all"
      >
        <CalendarIcon className="h-4 w-4 text-blue-500" />
        <span className="font-bold">{selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Select Date'}</span>
      </button>

      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 z-[199] bg-black/30 backdrop-blur-sm sm:hidden"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="
              fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-[300px]
              sm:absolute sm:left-auto sm:top-auto sm:translate-x-0 sm:translate-y-0 sm:mt-2 sm:w-72
              z-[200] bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 animate-in fade-in zoom-in-95 duration-200
            "
          >
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setViewDate(subMonths(viewDate, 1))}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h4 className="font-bold text-slate-900">{format(viewDate, 'MMMM yyyy')}</h4>
            <button
              type="button"
              onClick={() => setViewDate(addMonths(viewDate, 1))}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day, i) => {
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, viewDate);
              const isToday = isSameDay(day, new Date());

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDateSelect(day)}
                  className={`
                    h-8 w-8 rounded-lg text-xs font-medium transition-all flex items-center justify-center
                    ${!isCurrentMonth ? 'text-slate-300' : 'text-slate-700'}
                    ${isSelected ? 'bg-blue-600 text-white shadow-md shadow-blue-200 scale-110' : 'hover:bg-blue-50'}
                    ${isToday && !isSelected ? 'border border-blue-200 text-blue-600' : ''}
                  `}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between">
            <button
              type="button"
              onClick={() => handleDateSelect(new Date())}
              className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:underline"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600"
            >
              Close
            </button>
          </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DatePicker;