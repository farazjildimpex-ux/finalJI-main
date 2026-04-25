"use client";

import React, { useState, useEffect } from 'react';
import { X, Bell, BellOff, Calendar, Clock, Tag, AlignLeft, Palette, Check } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { JournalEntry } from '../../types';
import DatePicker from '../UI/DatePicker';
import { JOURNAL_COLOR_OPTIONS, JournalColorKey } from './journalColors';

const JournalEntryForm: React.FC<{
  initialDate: Date;
  onClose: () => void;
  onSave: () => void;
  parentId?: string | null;
  initialEntry?: JournalEntry | null;
}> = ({
  initialDate,
  onClose,
  onSave,
  parentId = null,
  initialEntry = null
}) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [entryDate, setEntryDate] = useState(format(initialDate, 'yyyy-MM-dd'));
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('09:00');
  const [color, setColor] = useState<JournalColorKey | ''>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialEntry) {
      setTitle(initialEntry.title);
      setContent(initialEntry.content || '');
      setEntryDate(format(new Date(initialEntry.entry_date), 'yyyy-MM-dd'));
      setReminderEnabled(initialEntry.reminder_enabled || false);
      setReminderDate(initialEntry.reminder_date || '');
      setReminderTime(initialEntry.reminder_time || '09:00');
      setColor((initialEntry.color as JournalColorKey) || '');
    }
  }, [initialEntry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        entry_date: entryDate,
        reminder_enabled: reminderEnabled,
        reminder_date: reminderEnabled && reminderDate ? reminderDate : null,
        reminder_time: reminderEnabled && reminderTime ? reminderTime : null,
        reminder_sent: false,
        color: color || null,
        updated_at: new Date().toISOString(),
      };

      if (initialEntry) {
        const { error } = await supabase
          .from('journal_entries')
          .update(payload)
          .eq('id', initialEntry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('journal_entries').insert({
          ...payload,
          user_id: user.id,
          parent_id: parentId,
        });
        if (error) throw error;
      }

      onSave();
    } catch (error) {
      console.error('Error saving entry:', error);
      alert('Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all";
  const labelClass = "flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1";

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-50">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {initialEntry ? 'Edit Entry' : parentId ? 'Add to Thread' : 'New Entry'}
            </h2>
            <p className="text-xs font-medium text-slate-400 mt-0.5">Journal & Reminders</p>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 custom-scrollbar">
            {/* Date Picker */}
            <div>
              <label className={labelClass}><Calendar className="h-3 w-3" /> Entry Date</label>
              <DatePicker
                value={entryDate}
                onChange={(val) => setEntryDate(val)}
              />
            </div>

            {/* Title */}
            <div>
              <label className={labelClass}><Tag className="h-3 w-3" /> Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What's on your mind?"
                className={inputClass}
                required
                autoFocus
              />
            </div>

            {/* Content */}
            <div>
              <label className={labelClass}><AlignLeft className="h-3 w-3" /> Notes</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Add more details..."
                rows={4}
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Color Picker */}
            <div>
              <label className={labelClass}><Palette className="h-3 w-3" /> Card Color</label>
              <div className="flex flex-wrap gap-2 ml-1">
                <button
                  type="button"
                  onClick={() => setColor('')}
                  title="Auto / Random"
                  className={`relative h-9 w-9 rounded-full border-2 transition-all flex items-center justify-center text-[10px] font-bold ${
                    color === ''
                      ? 'border-blue-500 ring-2 ring-blue-200 text-blue-600'
                      : 'border-slate-200 text-slate-400 hover:border-slate-300'
                  }`}
                  style={{
                    background:
                      'conic-gradient(#fef3c7, #fed7aa, #fbcfe8, #ddd6fe, #bae6fd, #bbf7d0, #d9f99d, #fef3c7)',
                  }}
                >
                  <span className="bg-white/80 rounded-full px-1">A</span>
                </button>
                {JOURNAL_COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setColor(opt.key)}
                    title={opt.name}
                    className={`relative h-9 w-9 rounded-full border-2 transition-all flex items-center justify-center ${
                      color === opt.key
                        ? 'border-slate-900 ring-2 ring-slate-200 scale-110'
                        : 'border-white shadow ring-1 ring-slate-200 hover:scale-105'
                    }`}
                    style={{ backgroundColor: opt.swatch }}
                  >
                    {color === opt.key && (
                      <Check className="h-4 w-4 text-slate-700" strokeWidth={3} />
                    )}
                  </button>
                ))}
              </div>
              <p className="mt-2 ml-1 text-[10px] font-medium text-slate-400">
                {color ? `Selected: ${JOURNAL_COLOR_OPTIONS.find(o => o.key === color)?.name}` : 'Auto — a random color will be assigned'}
              </p>
            </div>

            {/* Reminder Section */}
            <div className="bg-slate-50 rounded-3xl p-5 border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${reminderEnabled ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                    {reminderEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Set Reminder</p>
                    <p className="text-[10px] font-medium text-slate-400">Get notified on your device</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReminderEnabled(!reminderEnabled);
                    if (!reminderEnabled && !reminderDate) setReminderDate(entryDate);
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    reminderEnabled ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    reminderEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {reminderEnabled && (
                <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top-2 duration-200">
                  <div>
                    <label className={labelClass}>Date</label>
                    <DatePicker
                      value={reminderDate}
                      onChange={(val) => setReminderDate(val)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Time</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="time"
                        value={reminderTime}
                        onChange={(e) => setReminderTime(e.target.value)}
                        className={`${inputClass} pl-10`}
                        required={reminderEnabled}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="px-8 py-6 border-t border-slate-50 bg-white flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 text-sm font-bold text-slate-500 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex-[2] px-6 py-3 text-sm font-bold text-white bg-blue-600 rounded-2xl hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-200 transition-all active:scale-95"
            >
              {saving ? 'Saving...' : initialEntry ? 'Update Entry' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JournalEntryForm;
