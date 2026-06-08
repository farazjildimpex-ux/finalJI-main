"use client";

import React, { useState, useEffect } from 'react';
import { X, Bell, BellOff, Calendar, Clock, Tag, AlignLeft, Pin } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import type { JournalEntry } from '../../types';
import DatePicker from '../UI/DatePicker';
import { dialogService } from '../../lib/dialogService';

const REMINDER_PRESETS: { label: string; days: number }[] = [
  { label: '2 days',  days: 2 },
  { label: '1 week',  days: 7 },
  { label: '10 days', days: 10 },
  { label: '2 weeks', days: 14 },
  { label: '3 weeks', days: 21 },
  { label: '4 weeks', days: 28 },
];

const JournalEntryForm: React.FC<{
  initialDate: Date;
  onClose: () => void;
  onSave: (entry?: JournalEntry) => void;
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
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialEntry) {
      setTitle(initialEntry.title);
      setContent(initialEntry.content || '');
      setEntryDate(format(new Date(initialEntry.entry_date), 'yyyy-MM-dd'));
      setReminderEnabled(initialEntry.reminder_enabled || false);
      setReminderDate(initialEntry.reminder_date || '');
      setReminderTime(initialEntry.reminder_time || '09:00');
      setFollowUpRequired(Boolean(initialEntry.follow_up_required && !initialEntry.follow_up_completed_at));
    } else {
      setTitle('');
      setContent('');
      setEntryDate(format(initialDate, 'yyyy-MM-dd'));
      setReminderEnabled(false);
      setReminderDate('');
      setReminderTime('09:00');
      setFollowUpRequired(false);
    }
  }, [initialEntry, initialDate]);

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
        color: null,
        follow_up_required: followUpRequired,
        follow_up_completed_at: followUpRequired ? null : initialEntry?.follow_up_completed_at || null,
        updated_at: new Date().toISOString(),
      };

      let savedEntry: JournalEntry;

      if (initialEntry) {
        const { data, error } = await supabase
          .from('journal_entries')
          .update(payload)
          .eq('id', initialEntry.id)
          .select()
          .single();
        if (error) throw error;
        savedEntry = data;
      } else {
        const { data, error } = await supabase.from('journal_entries').insert({
          ...payload,
          user_id: user.id,
          parent_id: parentId,
        }).select().single();
        if (error) throw error;
        savedEntry = data;
      }

      onSave(savedEntry);
    } catch (error: any) {
      console.error('Error saving entry:', error);
      dialogService.alert({
        title: 'Failed to save entry',
        message: error?.message || 'Please try again.',
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  const labelClass = "flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white shadow-2xl w-full max-w-md flex flex-col max-h-[min(92dvh,720px)] overflow-hidden rounded-[28px] animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-500">Journal</p>
            <h2 className="mt-0.5 text-lg font-bold text-slate-900 tracking-tight truncate">
              {initialEntry ? 'Edit Entry' : parentId ? 'Add to Thread' : 'New Entry'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar px-5 py-4 space-y-3">
            {/* Date + Title */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-white">
                <label className={labelClass}>
                  <Calendar className="h-3 w-3" /> Date
                </label>
                <div className="mt-2">
                  <DatePicker value={entryDate} onChange={setEntryDate} />
                </div>
              </div>

              <div className="px-4 py-3 bg-white">
                <label className={labelClass}>
                  <Tag className="h-3 w-3" /> Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What is this about?"
                  className="mt-2 w-full bg-transparent text-base font-bold text-slate-900 placeholder-slate-300 focus:outline-none"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Notes */}
            <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
              <label className={labelClass}>
                <AlignLeft className="h-3 w-3" /> Notes
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Add details, context, or next steps…"
                rows={5}
                className="mt-2 w-full resize-none bg-transparent text-sm leading-6 text-slate-700 placeholder-slate-300 focus:outline-none"
              />
            </div>

            {/* Follow-up */}
            {!parentId && (
              <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-xl shrink-0 ${followUpRequired ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Pin className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">Follow-up required</p>
                      <p className="text-[11px] text-slate-400 leading-snug">Pin until marked done</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={followUpRequired}
                    onClick={() => setFollowUpRequired(v => !v)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                      followUpRequired ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      followUpRequired ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>
            )}

            {/* Reminder */}
            <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-xl shrink-0 ${reminderEnabled ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                    {reminderEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">Reminder</p>
                    <p className="text-[11px] text-slate-400 leading-snug">Notify on this device</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={reminderEnabled}
                  onClick={() => {
                    setReminderEnabled(!reminderEnabled);
                    if (!reminderEnabled && !reminderDate) setReminderDate(entryDate);
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                    reminderEnabled ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    reminderEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {reminderEnabled && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 animate-in slide-in-from-top-2 duration-200">
                  <div>
                    <label className={labelClass}>Quick remind in…</label>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {REMINDER_PRESETS.map((p) => {
                        const target = format(addDays(new Date(), p.days), 'yyyy-MM-dd');
                        const isActive = reminderDate === target && reminderTime === '09:00';
                        return (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => {
                              setReminderDate(target);
                              setReminderTime('09:00');
                            }}
                            className={`px-2 py-2 text-[11px] font-semibold rounded-xl border transition-all active:scale-95 ${
                              isActive
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelClass}>Date</label>
                      <div className="mt-2">
                        <DatePicker value={reminderDate} onChange={setReminderDate} />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Time</label>
                      <div className="relative mt-2">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <input
                          type="time"
                          value={reminderTime}
                          onChange={(e) => setReminderTime(e.target.value)}
                          className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors"
                          required={reminderEnabled}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-slate-100 bg-white flex gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex-[1.5] px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 shadow-md shadow-blue-200/60 transition-all active:scale-95"
            >
              {saving ? 'Saving…' : initialEntry ? 'Update' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JournalEntryForm;
