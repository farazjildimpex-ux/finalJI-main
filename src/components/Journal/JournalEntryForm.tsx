"use client";

import React, { useState, useEffect } from 'react';
import { X, Bell, BellOff } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { JournalEntry } from '../../types';
import DatePicker from '../UI/DatePicker';

interface JournalEntryFormProps {
  initialDate: Date;
  onClose: () => void;
  onSave: () => void;
  parentId?: string | null;
  initialEntry?: JournalEntry | null;
}

const JournalEntryForm: React.FC<JournalEntryFormProps> = ({
  initialDate,
  onClose,
  onSave,
  parentId = null,
  initialEntry = null,
}) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [entryDate, setEntryDate] = useState(format(initialDate, 'yyyy-MM-dd'));
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('09:00');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialEntry) {
      setTitle(initialEntry.title);
      setContent(initialEntry.content || '');
      setEntryDate(initialEntry.entry_date);
      setReminderEnabled(initialEntry.reminder_enabled || false);
      setReminderDate(initialEntry.reminder_date || '');
      setReminderTime(initialEntry.reminder_time || '09:00');
    }
  }, [initialEntry]);

  const scheduleLocalReminder = (entryTitle: string, date: string, time: string) => {
    try {
      const reminders = JSON.parse(localStorage.getItem('jild-reminders') || '[]');
      const existing = reminders.findIndex((r: any) => r.title === entryTitle);
      const reminder = { title: entryTitle, date, time, timestamp: new Date(`${date}T${time}`).getTime() };
      if (existing >= 0) reminders[existing] = reminder;
      else reminders.push(reminder);
      localStorage.setItem('jild-reminders', JSON.stringify(reminders));
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;

    setSaving(true);
    try {
      const payload = {
        title,
        content,
        entry_date: entryDate,
        reminder_enabled: reminderEnabled,
        reminder_date: reminderEnabled && reminderDate ? reminderDate : null,
        reminder_time: reminderEnabled && reminderTime ? reminderTime : null,
        reminder_sent: false,
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
          user_id: user.id,
          file_urls: [],
          parent_id: parentId,
          ...payload,
        });
        if (error) throw error;
      }

      if (reminderEnabled && reminderDate && reminderTime) {
        scheduleLocalReminder(title, reminderDate, reminderTime);
      }

      onSave();
    } catch (error) {
      console.error('Error saving entry:', error);
      alert('Error saving entry');
    } finally {
      setSaving(false);
    }
  };

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[150] p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-black text-gray-900 uppercase tracking-widest text-sm">
            {initialEntry ? 'Edit Entry' : (parentId ? 'Add to Thread' : 'New Journal Entry')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 gap-6">
          <DatePicker
            label="Entry Date"
            value={entryDate}
            onChange={(val) => setEntryDate(val)}
          />

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 uppercase tracking-widest text-[10px]">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's on your mind?"
              required
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1 uppercase tracking-widest text-[10px]">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your thoughts..."
              rows={6}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700"
            />
          </div>
          </div>

          {/* Reminder Section */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {reminderEnabled
                  ? <Bell className="h-4 w-4 text-blue-600" />
                  : <BellOff className="h-4 w-4 text-gray-400" />
                }
                <span className="text-sm font-bold text-gray-700">Set Reminder</span>
              </div>
              <button
                type="button"
                onClick={() => setReminderEnabled(!reminderEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  reminderEnabled ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  reminderEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {reminderEnabled && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-widest">Date</label>
                    <input
                      type="date"
                      value={reminderDate}
                      min={today}
                      onChange={(e) => setReminderDate(e.target.value)}
                      required={reminderEnabled}
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-widest">Time</label>
                    <input
                      type="time"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      required={reminderEnabled}
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 font-medium"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-blue-600 font-medium flex items-center gap-1">
                  <Bell className="h-3 w-3" />
                  Push notification will be sent on {reminderDate ? new Date(reminderDate + 'T' + reminderTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'the selected date & time'}.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-sm font-bold text-gray-500 bg-gray-100 rounded-2xl hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="px-8 py-3 text-sm font-bold text-white bg-blue-600 rounded-2xl hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-100 transition-all active:scale-95"
            >
              {saving ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JournalEntryForm;