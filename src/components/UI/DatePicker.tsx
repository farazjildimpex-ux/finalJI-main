"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, eachDayOfInterval } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface DatePickerProps {
  value: string; // yyyy-MM-dd
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, label, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedDate = useMemo(() => (value ? new Date(value) : null), [value]);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
    }
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(event.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node)
      ) {
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

  const calendarContent = (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 z-[999] bg-black/20 backdrop-blur-[1px] sm:hidden"
        onClick={() => setIsOpen(false)}
      />
      <div
        ref={dropdownRef}
        style={{
          top: window.innerWidth >= 640 ? `${coords.top + 8}px` : '50%',
          left: window.innerWidth >= 640 ? `${coords.left}px` : '50%',
          transform: window.innerWidth >= 640 ? 'none' : 'translate(-50%, -50%)',
          minWidth: window.innerWidth >= 640 ? '280px' : '300px'
        }}
        className="
          fixed z-[1000] bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 
          animate-in fade-in zoom-in-95 duration-200
        "
      >
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => setViewDate(subMonths(viewDate, 1))}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h4 className="font-bold text-slate-900">{format(viewDate, 'MMMM yyyy')}</h4>
          <button
            type="button"
            onClick={() => setViewDate(addMonths(viewDate, 1))}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
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
                  h-9 w-9 rounded-lg text-xs font-medium transition-all flex items-center justify-center
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
  );

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

      {isOpen && createPortal(calendarContent, document.body)}
    </div>
  );
};

export default DatePicker;