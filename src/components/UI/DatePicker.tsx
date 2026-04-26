"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, eachDayOfInterval } from 'date-fns';
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedDate = useMemo(() => (value ? new Date(value) : null), [value]);

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate));
    const end = endOfWeek(endOfMonth(viewDate));
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  const handleDateSelect = (date: Date) => {
    onChange(format(date, 'yyyy-MM-dd'));
    setIsOpen(false);
  };

  const calendarContent = (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Modal Content */}
      <div
        ref={dropdownRef}
        className="
          relative w-full max-w-[320px] bg-white rounded-[32px] shadow-2xl border border-slate-100 p-6 
          animate-in fade-in zoom-in-95 duration-200
        "
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col">
            <h4 className="font-bold text-slate-900 text-lg tracking-tight">{format(viewDate, 'MMMM')}</h4>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{format(viewDate, 'yyyy')}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewDate(subMonths(viewDate, 1))}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setViewDate(addMonths(viewDate, 1))}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest py-1">
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
                  h-9 w-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center
                  ${!isCurrentMonth ? 'text-slate-200' : 'text-slate-700'}
                  ${isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-110' : 'hover:bg-slate-50'}
                  ${isToday && !isSelected ? 'text-blue-600 ring-1 ring-blue-100' : ''}
                `}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="h-3 w-3" /> Close
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`relative ${className}`}>
      {label && <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 shadow-sm hover:border-blue-400 transition-all group"
      >
        <CalendarIcon className="h-4 w-4 text-blue-500 group-hover:scale-110 transition-transform" />
        <span className="font-bold">{selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Select Date'}</span>
      </button>

      {isOpen && createPortal(calendarContent, document.body)}
    </div>
  );
};

export default DatePicker;