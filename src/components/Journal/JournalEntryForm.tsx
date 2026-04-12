"use client";

import React, { useState, useEffect } from 'react';
import { X, Bell, BellOff } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { JournalEntry } from '../../types';
import DatePicker from '../UI/DatePicker';

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
  const [saving, setSaving] = useState(false);

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
        timestamp: new Date(`${date}T${time}`).getTime() 
      };
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
          ...payload,
          user_id: user.id,
          parent_id: parentId,
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

  const handleToggleReminder = () => {
    setReminderEnabled(!reminderEnabled);
    if (!reminderEnabled) {
      setReminderDate('');
      setReminderTime('09:00');
    }
  };

  const inputClass = "mt-1 block w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-xs font-medium text-gray-700";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[150] p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 uppercase tracking-widest">
            {initialEntry ? 'Edit Entry' : parentId ? 'Add to Thread' : 'New Journal Entry'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 uppercase tracking-widest">Entry Date</label>
              <DatePicker                label="Date"
                value={entryDate}
                onChange={(val) => setEntryDate(val)}
                className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 uppercase tracking-widest">
                {reminderEnabled ? 'Reminder Date' : 'Reminder'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="reminder-toggle"
                  checked={reminderEnabled}
                  onChange={handleToggleReminder}
                  className="rounded border border-blue-200"
                />
                <label htmlFor="reminder-toggle" className="ml-2 text-sm text-gray-700">
                  Set Reminder
                </label>
              </div>

              {reminderEnabled && (
                <div className="mt-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
                  <DatePicker
                    label="Reminder Date"
                    value={reminderDate}
                    onChange={(val) => setReminderDate(val)}
                    className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <label className="block text-sm font-bold text-gray-700 mb-1">Time</label>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="mt-2 flex items-center">
                <span className="text-sm text-blue-600">
                  Reminder will trigger on {reminderDate} at {reminderTime}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 uppercase tracking-widest">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter title"
                className={inputClass}
                required              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 uppercase tracking-widest">Content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your thoughts..."
                rows={8}
                className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </form>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
          >
            Cancel          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 shadow-lg"
          >
            {saving ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default JournalEntryForm;