"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Bell, BellOff, Calendar, Clock, Tag, AlignLeft, Pin, Trash2, AtSign, FileText, Landmark } from 'lucide-react';
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

const NOTE_REFERENCES = [
  { label: 'Contract', value: '@contract', helper: 'Link contract details' },
  { label: 'Letter', value: '@letter', helper: 'Link letter details' },
  { label: 'Payment', value: '@payment', helper: 'Link payment details' },
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
  const initialDateKey = format(initialDate, 'yyyy-MM-dd');
  const draftKey = useMemo(() => (
    `journal-entry-draft:${initialEntry?.id ?? parentId ?? 'new'}:${initialDateKey}`
  ), [initialEntry?.id, parentId, initialDateKey]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [entryDate, setEntryDate] = useState(format(initialDate, 'yyyy-MM-dd'));
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('09:00');
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [referenceMenu, setReferenceMenu] = useState<{ start: number; end: number; query: string } | null>(null);

  const applyInitialState = useCallback(() => {
    if (initialEntry) {
      setTitle(initialEntry.title);
      setContent(initialEntry.content || '');
      setEntryDate(format(new Date(initialEntry.entry_date), 'yyyy-MM-dd'));
      setReminderEnabled(initialEntry.reminder_enabled || false);
      setReminderDate(initialEntry.reminder_date || '');
      setReminderTime(initialEntry.reminder_time || '09:00');
      setFollowUpRequired(Boolean(initialEntry.follow_up_required && !initialEntry.follow_up_completed_at));
      setReferenceMenu(null);
      return;
    }

    setTitle('');
    setContent('');
    setEntryDate(initialDateKey);
    setReminderEnabled(false);
    setReminderDate('');
    setReminderTime('09:00');
    setFollowUpRequired(false);
    setReferenceMenu(null);
  }, [initialEntry, initialDateKey]);

  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(draftKey);
  }, [draftKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const draft = window.localStorage.getItem(draftKey);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setTitle(parsed.title ?? '');
        setContent(parsed.content ?? '');
        setEntryDate(parsed.entryDate ?? initialDateKey);
        setReminderEnabled(Boolean(parsed.reminderEnabled));
        setReminderDate(parsed.reminderDate ?? '');
        setReminderTime(parsed.reminderTime ?? '09:00');
        setFollowUpRequired(Boolean(parsed.followUpRequired));
        setReferenceMenu(null);
        return;
      } catch {
        window.localStorage.removeItem(draftKey);
      }
    }

    applyInitialState();
  }, [applyInitialState, draftKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(draftKey, JSON.stringify({
      title,
      content,
      entryDate,
      reminderEnabled,
      reminderDate,
      reminderTime,
      followUpRequired,
    }));
  }, [draftKey, title, content, entryDate, reminderEnabled, reminderDate, reminderTime, followUpRequired]);

  const updateReferenceMenu = (value: string, cursor: number) => {
    const textBeforeCursor = value.slice(0, cursor);
    const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z]*)$/);
    if (!match) {
      setReferenceMenu(null);
      return;
    }

    const atIndex = textBeforeCursor.lastIndexOf('@');
    if (atIndex < 0) {
      setReferenceMenu(null);
      return;
    }

    setReferenceMenu({
      start: atIndex,
      end: cursor,
      query: match[1].toLowerCase(),
    });
  };

  const handleContentChange = (value: string, cursor: number) => {
    setContent(value);
    updateReferenceMenu(value, cursor);
  };

  const insertReferenceToken = (token: string) => {
    if (!referenceMenu) return;
    const nextValue = `${content.slice(0, referenceMenu.start)}${token} ${content.slice(referenceMenu.end).replace(/^\s+/, ' ')}`.replace(/[ ]{2,}/g, ' ');
    setContent(nextValue);
    setReferenceMenu(null);
    window.setTimeout(() => {
      const nextCursor = referenceMenu.start + token.length + 1;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  };

  const handleDiscard = async () => {
    const ok = await dialogService.confirm({
      title: initialEntry ? 'Reset changes?' : 'Discard draft?',
      message: initialEntry
        ? 'This will restore the saved entry content.'
        : 'This will clear everything you typed and close the form.',
      confirmLabel: initialEntry ? 'Reset' : 'Discard',
      cancelLabel: 'Keep editing',
      tone: 'warning',
    });
    if (!ok) return;

    clearDraft();
    setReferenceMenu(null);
    if (initialEntry) {
      applyInitialState();
    } else {
      onClose();
    }
  };

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
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(draftKey);
      }
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
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-slate-900/45 backdrop-blur-sm animate-in fade-in duration-200 p-0 md:p-4"
    >
      <div
        className="bg-white shadow-2xl w-full md:max-w-md flex flex-col h-[100dvh] md:h-auto md:max-h-[min(92dvh,720px)] overflow-hidden rounded-none md:rounded-[28px] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-500">Journal</p>
            <h2 className="mt-0.5 text-lg font-bold text-slate-900 tracking-tight truncate">
              {initialEntry ? 'Edit Entry' : parentId ? 'Add to Thread' : 'New Entry'}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleDiscard}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {initialEntry ? 'Reset' : 'Clear'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar px-4 md:px-5 py-4 space-y-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:pb-4">
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
            <div className="relative rounded-2xl border border-slate-100 bg-white px-4 py-3">
              <label className={labelClass}>
                <AlignLeft className="h-3 w-3" /> Notes
              </label>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => handleContentChange(e.target.value, e.currentTarget.selectionStart ?? e.target.value.length)}
                onSelect={(e) => updateReferenceMenu(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                placeholder="Add details, context, or next steps…"
                rows={5}
                className="mt-2 w-full resize-none bg-transparent text-sm leading-6 text-slate-700 placeholder-slate-300 focus:outline-none"
              />

              {referenceMenu && (
                <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-2 shadow-sm">
                  <div className="flex items-center gap-2 px-2 pb-2">
                    <AtSign className="h-3.5 w-3.5 text-blue-600" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Add a reference</p>
                  </div>
                  <div className="grid gap-1">
                    {NOTE_REFERENCES.filter(item => item.label.toLowerCase().includes(referenceMenu.query) || item.value.includes(referenceMenu.query)).map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          insertReferenceToken(item.value);
                        }}
                        className="w-full flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-left border border-slate-100 hover:border-blue-100 hover:bg-blue-50/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            {item.label === 'Contract' ? <FileText className="h-3.5 w-3.5" /> : item.label === 'Payment' ? <Landmark className="h-3.5 w-3.5" /> : <AtSign className="h-3.5 w-3.5" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold text-slate-900">{item.label}</p>
                            <p className="text-[10px] text-slate-400">{item.helper}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-400">{item.value}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
          <div className="sticky bottom-0 px-4 md:px-5 py-3 border-t border-slate-100 bg-white/95 backdrop-blur-sm flex gap-2 shrink-0">
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
