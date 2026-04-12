"use client";

import React, { useState, useEffect, useId } from 'react';
import { X, Bell, BellOff, Calendar, Clock, FileText, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { JournalEntry } from '../../types';

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
  initialEntry = null,
}) => {
  const { user } = useAuth();
  const uid = useId();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [entryDate, setEntryDate] = useState(format(initialDate, 'yyyy-MM-dd'));
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('09:00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialEntry) {
      setTitle(initialEntry.title);
      setContent(initialEntry.content || '');
      setEntryDate(format(new Date(initialEntry.entry_date), 'yyyy-MM-dd'));
      setReminderEnabled(initialEntry.reminder_enabled || false);
      setReminderDate(initialEntry.reminder_date || '');
      setReminderTime(initialEntry.reminder_time || '09:00');
    }
  }, [initialEntry]);

  const scheduleLocalReminder = (entryTitle: string, date: string, time: string) => {
    try {
      const reminders = JSON.parse(localStorage.getItem('jild-reminders') || '[]');
      const existing = reminders.findIndex((r: any) => r.title === entryTitle);
      const reminder = {
        title: entryTitle,
        date,
        time,
        timestamp: new Date(`${date}T${time}`).getTime(),
      };
      if (existing >= 0) reminders[existing] = reminder;
      else reminders.push(reminder);
      localStorage.setItem('jild-reminders', JSON.stringify(reminders));
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;
    setError(null);
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
        updated_at: new Date().toISOString(),
      };

      if (initialEntry) {
        const { error: updateError } = await supabase
          .from('journal_entries')
          .update(payload)
          .eq('id', initialEntry.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('journal_entries').insert({
          ...payload,
          user_id: user.id,
          parent_id: parentId,
        });
        if (insertError) throw insertError;
      }

      if (reminderEnabled && reminderDate && reminderTime) {
        scheduleLocalReminder(title, reminderDate, reminderTime);
      }

      onSave();
    } catch (err) {
      console.error('Error saving entry:', err);
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isEditing = Boolean(initialEntry);
  const isReply = Boolean(parentId && !isEditing);

  const modalTitle = isEditing ? 'Edit Entry' : isReply ? 'Add to Thread' : 'New Journal Entry';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-3xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">{modalTitle}</h2>
            {isReply && (
              <p className="text-xs text-gray-400 mt-0.5">Adding a message to this thread</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form — wraps EVERYTHING including the action buttons */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* Error */}
            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* Entry Date */}
            <div>
              <label
                htmlFor={`${uid}-entry-date`}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5"
              >
                <Calendar className="h-3.5 w-3.5" />
                Entry Date
              </label>
              <input
                id={`${uid}-entry-date`}
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
                className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Title */}
            <div>
              <label
                htmlFor={`${uid}-title`}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5"
              >
                <Tag className="h-3.5 w-3.5" />
                Title
              </label>
              <input
                id={`${uid}-title`}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What's this about?"
                required
                autoFocus={!isEditing}
                className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-400"
              />
            </div>

            {/* Content */}
            <div>
              <label
                htmlFor={`${uid}-content`}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5"
              >
                <FileText className="h-3.5 w-3.5" />
                Notes
              </label>
              <textarea
                id={`${uid}-content`}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your thoughts here..."
                rows={5}
                className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-400 resize-none"
              />
            </div>

            {/* Reminder Section */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
              {/* Toggle Row */}
              <button
                type="button"
                onClick={() => {
                  setReminderEnabled(!reminderEnabled);
                  if (!reminderEnabled && !reminderDate) {
                    setReminderDate(entryDate || format(new Date(), 'yyyy-MM-dd'));
                  }
                }}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  {reminderEnabled ? (
                    <Bell className="h-4 w-4 text-blue-600" />
                  ) : (
                    <BellOff className="h-4 w-4 text-gray-400" />
                  )}
                  <span className={`text-sm font-medium ${reminderEnabled ? 'text-blue-700' : 'text-gray-500'}`}>
                    Set a reminder
                  </span>
                </div>
                {/* Toggle pill */}
                <div className={`relative w-10 h-6 rounded-full transition-colors ${reminderEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${reminderEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
              </button>

              {/* Reminder Date + Time */}
              {reminderEnabled && (
                <div className="px-4 pb-4 pt-1 grid grid-cols-2 gap-3 border-t border-gray-200">
                  <div>
                    <label
                      htmlFor={`${uid}-reminder-date`}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5"
                    >
                      <Calendar className="h-3 w-3" />
                      Date
                    </label>
                    <input
                      id={`${uid}-reminder-date`}
                      type="date"
                      value={reminderDate}
                      onChange={(e) => setReminderDate(e.target.value)}
                      required={reminderEnabled}
                      min={format(new Date(), 'yyyy-MM-dd')}
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`${uid}-reminder-time`}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5"
                    >
                      <Clock className="h-3 w-3" />
                      Time
                    </label>
                    <input
                      id={`${uid}-reminder-time`}
                      type="time"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      required={reminderEnabled}
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Summary */}
                  {reminderDate && reminderTime && (
                    <div className="col-span-2 flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
                      <Bell className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <p className="text-xs text-blue-700 font-medium">
                        Reminder set for{' '}
                        <span className="font-bold">
                          {format(new Date(reminderDate), 'MMM d, yyyy')} at {
                            (() => {
                              const [h, m] = reminderTime.split(':');
                              const d = new Date();
                              d.setHours(Number(h), Number(m));
                              return format(d, 'h:mm a');
                            })()
                          }
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons — inside the form so submit works */}
          <div className="shrink-0 flex gap-3 px-5 py-4 border-t border-gray-100 bg-white sm:rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-95 shadow-md shadow-blue-200"
            >
              {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JournalEntryForm;
