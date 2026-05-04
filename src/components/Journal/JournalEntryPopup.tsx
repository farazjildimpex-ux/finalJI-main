"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, Link2Off, Link as LinkIcon, X, MessageSquarePlus, Pencil, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { JournalEntry } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import JournalEntryForm from './JournalEntryForm';
import { dialogService } from '../../lib/dialogService';

interface JournalEntryPopupProps {
  entry: JournalEntry;
  allEntries: JournalEntry[];
  onClose: () => void;
  onUpdate: () => void;
}

const JournalEntryPopup: React.FC<JournalEntryPopupProps> = ({
  entry,
  allEntries,
  onClose,
  onUpdate,
}) => {
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [linkSearchTerm, setLinkSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeEntryRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);

  // Always use the freshest version of the entry from allEntries so that
  // parent_id changes (e.g. after another session links this entry) are reflected.
  const currentEntry = useMemo(
    () => allEntries.find((e) => e.id === entry.id) || entry,
    [allEntries, entry]
  );

  const rootId = useMemo(() => currentEntry.parent_id || currentEntry.id, [currentEntry]);

  const conversationThread = useMemo(() => {
    return allEntries
      .filter((e) => e.id === rootId || e.parent_id === rootId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [rootId, allEntries]);

  useEffect(() => {
    if (activeEntryRef.current) {
      activeEntryRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const availableEntries = useMemo(() => {
    return allEntries
      .filter(
        (e) =>
          e.id !== entry.id &&
          e.id !== rootId &&
          e.parent_id !== rootId &&
          (e.title.toLowerCase().includes(linkSearchTerm.toLowerCase()) ||
            e.content.toLowerCase().includes(linkSearchTerm.toLowerCase()))
      )
      .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
  }, [allEntries, entry, rootId, linkSearchTerm]);

  const handleDoubleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      onClose();
    }
    lastTapRef.current = now;
  }, [onClose]);

  const handleLinkEntry = async (targetEntryId: string) => {
    try {
      setIsProcessing(true);
      // Move the target entry into this thread
      await supabase.from('journal_entries').update({ parent_id: rootId }).eq('id', targetEntryId);
      // Also pull in any children the target entry already had — prevents them
      // becoming orphaned when their former root joins a different thread.
      await supabase.from('journal_entries').update({ parent_id: rootId }).eq('parent_id', targetEntryId);
      setShowLinkPicker(false);
      setLinkSearchTerm('');
      onUpdate();
    } catch (error) {
      console.error('Error linking entry:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnlinkEntry = async (targetEntryId: string) => {
    const ok = await dialogService.confirm({
      title: 'Unlink from thread?',
      message: 'Remove this entry from the conversation thread?',
      confirmLabel: 'Unlink',
      tone: 'warning',
    });
    if (!ok) return;
    try {
      setIsProcessing(true);
      await supabase.from('journal_entries').update({ parent_id: null }).eq('id', targetEntryId);
      if (targetEntryId === entry.id && conversationThread.length <= 1) onClose();
      onUpdate();
    } catch (error) {
      console.error('Error unlinking entry:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatReminderTime = (time: string) => {
    const [h, m] = time.split(':');
    const d = new Date();
    d.setHours(Number(h), Number(m));
    return format(d, 'h:mm a');
  };

  return (
    <>
      {/* Backdrop — single click closes, double tap also closes */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-6"
        onClick={onClose}
        onDoubleClick={onClose}
      >
        <div
          className="bg-white w-full max-w-xl rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: 'min(88vh, 680px)' }}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {/* Header bar */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
            <div className="flex items-center gap-2">
              {/* Thread indicator dots */}
              {conversationThread.length > 1 && (
                <div className="flex items-center gap-0.5">
                  {conversationThread.slice(0, Math.min(conversationThread.length, 5)).map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-full transition-all ${
                        conversationThread[i]?.id === entry.id
                          ? 'w-4 h-1.5 bg-blue-500'
                          : 'w-1.5 h-1.5 bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
              )}
              <span className="text-[11px] font-semibold text-slate-400 tracking-wide">
                {conversationThread.length > 1
                  ? `${conversationThread.length} entries`
                  : 'Journal'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scroll area — double tap to close */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto px-4 sm:px-5 pb-3 space-y-3"
            onClick={handleDoubleTap}
            onTouchEnd={handleDoubleTap}
          >
            {conversationThread.map((item) => {
              const isSelected = item.id === entry.id;
              const hasReminder = item.reminder_enabled && item.reminder_date;

              return (
                <div
                  key={item.id}
                  ref={isSelected ? activeEntryRef : null}
                  className="relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                      isSelected
                        ? 'border-blue-200 bg-blue-50/40 shadow-sm shadow-blue-100'
                        : 'border-slate-100 bg-white'
                    }`}
                  >
                    {/* Accent bar for selected */}
                    {isSelected && (
                      <div className="h-0.5 bg-gradient-to-r from-blue-400 to-indigo-400 w-full" />
                    )}

                    <div className="p-4 sm:p-5">
                      {/* Title row with actions */}
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <h3 className={`text-base font-bold leading-snug flex-1 ${
                          isSelected ? 'text-blue-900' : 'text-slate-900'
                        }`}>
                          {item.title}
                        </h3>
                        <div className="flex items-center gap-0.5 shrink-0 -mt-0.5">
                          <button
                            onClick={() => setEditingEntry(item)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-all"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {item.parent_id && (
                            <button
                              onClick={() => handleUnlinkEntry(item.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-all"
                              title="Remove from thread"
                            >
                              <Link2Off className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Content — this is the star */}
                      {item.content && (
                        <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap mb-3">
                          {item.content}
                        </p>
                      )}

                      {/* Metadata row — small, subtle */}
                      <div className="flex items-center flex-wrap gap-2 mt-1">
                        <span className="text-[11px] text-slate-400 font-medium">
                          {format(new Date(item.entry_date), 'MMM d, yyyy')}
                        </span>
                        <span className="text-[11px] text-slate-300">·</span>
                        <span className="text-[11px] text-slate-400">
                          {format(new Date(item.created_at), 'h:mm a')}
                        </span>
                        {hasReminder && (
                          <>
                            <span className="text-[11px] text-slate-300">·</span>
                            <span className="flex items-center gap-1 text-[11px] text-amber-500 font-medium">
                              <Bell className="h-3 w-3" />
                              {format(new Date(item.reminder_date!), 'MMM d')}
                              {item.reminder_time ? ` ${formatReminderTime(item.reminder_time)}` : ''}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Thread connector line between entries */}
                  {conversationThread.indexOf(item) < conversationThread.length - 1 && (
                    <div className="flex justify-center py-1">
                      <div className="w-0.5 h-3 bg-slate-200 rounded-full" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Double-tap hint — fades out */}
            <p className="text-center text-[10px] text-slate-300 pb-1 select-none">
              double-tap background to close
            </p>
          </div>

          {/* Action bar */}
          <div className="shrink-0 px-4 sm:px-5 py-3.5 border-t border-slate-100 bg-slate-50/80 flex items-center gap-2">
            {/* Add to thread */}
            <button
              onClick={() => setShowReplyForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-2xl hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-200/60"
            >
              <MessageSquarePlus className="h-4 w-4" />
              <span>Add</span>
            </button>

            {/* Link entry */}
            <button
              onClick={() => setShowLinkPicker(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-600 text-xs font-bold rounded-2xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all"
            >
              <LinkIcon className="h-4 w-4" />
              <span>Link</span>
            </button>

            <div className="flex-1" />

            {/* Close */}
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-slate-500 text-xs font-bold rounded-2xl border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all"
            >
              <X className="h-3.5 w-3.5" />
              <span>Close</span>
            </button>
          </div>
        </div>
      </div>

      {/* Link Picker — bottom sheet on mobile */}
      {showLinkPicker && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[110] flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setShowLinkPicker(false)}
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: '75vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle (mobile) */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>

            <div className="px-5 pt-3 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-slate-900">Link an entry</h3>
              <button
                onClick={() => setShowLinkPicker(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 flex-1 flex flex-col min-h-0 gap-3">
              <div className="relative shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search entries…"
                  value={linkSearchTerm}
                  onChange={(e) => setLinkSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                  autoFocus
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5">
                {availableEntries.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => handleLinkEntry(e.id)}
                    disabled={isProcessing}
                    className="w-full text-left p-3.5 hover:bg-blue-50 rounded-xl transition-all group border border-transparent hover:border-blue-100 disabled:opacity-50 active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm truncate">{e.title}</p>
                        {e.content && (
                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{e.content}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                        <span className="text-[11px] text-slate-400">
                          {format(new Date(e.entry_date), 'MMM d')}
                        </span>
                        <Plus className="h-3.5 w-3.5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </button>
                ))}
                {availableEntries.length === 0 && (
                  <div className="py-12 text-center">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                      No entries found
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Form */}
      {editingEntry && (
        <JournalEntryForm
          initialDate={new Date(editingEntry.entry_date)}
          initialEntry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSave={() => {
            setEditingEntry(null);
            onUpdate();
          }}
        />
      )}

      {/* Reply Form */}
      {showReplyForm && (
        <JournalEntryForm
          initialDate={new Date()}
          parentId={rootId}
          onClose={() => setShowReplyForm(false)}
          onSave={() => {
            setShowReplyForm(false);
            onUpdate();
          }}
        />
      )}
    </>
  );
};

export default JournalEntryPopup;
