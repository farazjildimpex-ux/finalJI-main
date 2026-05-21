"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, Link2Off, Link as LinkIcon, X, MessageSquarePlus, Pencil, Bell, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import type { JournalEntry } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import JournalEntryForm from './JournalEntryForm';
import { dialogService } from '../../lib/dialogService';
import { suggestJournalLink } from '../../lib/journalAI';

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

  const handleAskAI = async () => {
    try {
      setIsProcessing(true);
      dialogService.toast({ message: 'AI is analyzing related entries...', durationMs: 2000 });
      
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      
      const pastEntries = allEntries.filter(
        e => e.id !== currentEntry.id && 
             e.id !== rootId && 
             e.parent_id !== rootId &&
             new Date(e.entry_date) >= tenDaysAgo
      );

      if (pastEntries.length === 0) {
        dialogService.alert({ title: 'No entries found', message: 'No entries found from the last 10 days to analyze.' });
        return;
      }

      const suggestion = await suggestJournalLink(currentEntry, pastEntries);
      
      if (suggestion.suggested_parent_id) {
        const parent = pastEntries.find(e => e.id === suggestion.suggested_parent_id);
        if (parent) {
          const ok = await dialogService.confirm({
            title: 'AI Suggestion',
            message: `AI suggests linking to: "${parent.title}"\n\nReason: ${suggestion.reasoning}\n\nLink them now?`,
            confirmLabel: 'Link'
          });
          if (ok) {
            await handleLinkEntry(parent.id);
          }
        } else {
          dialogService.toast({ message: 'AI didn\'t find a strong match.' });
        }
      } else {
        dialogService.alert({ title: 'No match', message: 'AI didn\'t find any strongly related entries for this one.' });
      }
    } catch (error: any) {
      console.error('AI Link error:', error);
      dialogService.alert({ title: 'AI Error', message: error.message });
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
        className="fixed inset-0 bg-slate-950/35 backdrop-blur-sm z-[100] flex items-stretch md:items-center justify-center md:p-6"
        onClick={onClose}
        onDoubleClick={onClose}
      >
        <div
          className="bg-[#F8FAFC] w-full h-full md:h-auto md:max-w-2xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: '100vh' }}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 pt-4 pb-3 shrink-0 border-b border-slate-200/70 bg-white">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Journal Thread</p>
                <h2 className="mt-1 text-[17px] font-bold text-slate-950 truncate">{currentEntry.title}</h2>
                <p className="mt-1 text-[11px] text-slate-400">
                  {conversationThread.length} {conversationThread.length === 1 ? 'entry' : 'entries'} linked
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowReplyForm(true)}
                className="h-9 rounded-xl bg-blue-600 text-white text-[12px] font-semibold flex items-center justify-center gap-2 active:bg-blue-700"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
                Add entry
              </button>
              <button
                onClick={() => setShowLinkPicker(true)}
                className="h-9 rounded-xl bg-white text-slate-700 border border-slate-200 text-[12px] font-semibold flex items-center justify-center gap-2 active:bg-slate-50"
              >
                <LinkIcon className="h-3.5 w-3.5" />
                Link existing
              </button>
            </div>
          </div>

          {/* Scroll area — double tap to close */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
            onClick={handleDoubleTap}
            onTouchEnd={handleDoubleTap}
          >
            {conversationThread.map((item, index) => {
              const isSelected = item.id === entry.id;
              const hasReminder = item.reminder_enabled && item.reminder_date;

              return (
                <div
                  key={item.id}
                  ref={isSelected ? activeEntryRef : null}
                  className="relative pl-9"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={`absolute left-0 top-1.5 h-7 w-7 rounded-full border flex items-center justify-center text-[11px] font-bold ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}>
                    {index + 1}
                  </div>
                  {index < conversationThread.length - 1 && (
                    <div className="absolute left-[13px] top-9 bottom-[-18px] w-px bg-slate-200" />
                  )}
                  <div
                    className={`rounded-[22px] border transition-all duration-200 overflow-hidden ${
                      isSelected
                        ? 'border-slate-300 bg-white shadow-sm'
                        : 'border-slate-100 bg-white shadow-sm'
                    }`}
                  >

                    <div className="p-4 sm:p-6">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-slate-400 mb-1">
                            {format(new Date(item.entry_date), 'MMM d, yyyy')} at {format(new Date(item.created_at), 'h:mm a')}
                          </p>
                          <h3 className={`text-[15px] sm:text-lg font-bold leading-snug ${
                            isSelected ? 'text-slate-950' : 'text-slate-900'
                          }`}>
                            {item.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 -mt-0.5">
                          <button
                            onClick={() => setEditingEntry(item)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {item.parent_id && (
                            <button
                              onClick={() => handleUnlinkEntry(item.id)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-50 transition-all"
                              title="Remove from thread"
                            >
                              <Link2Off className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Content — this is the star */}
                      {item.content && (
                        <p className="text-[14px] leading-6 text-slate-700 whitespace-pre-wrap mb-4">
                          {item.content}
                        </p>
                      )}

                      {/* Metadata row */}
                      <div className="flex items-center flex-wrap gap-2 pt-3 border-t border-slate-100">
                        <span className="text-xs text-slate-400 font-semibold">
                          {format(new Date(item.entry_date), 'MMM d, yyyy')}
                        </span>
                        <span className="text-xs text-slate-300">·</span>
                        <span className="text-xs text-slate-400">
                          {format(new Date(item.created_at), 'h:mm a')}
                        </span>
                        {hasReminder && (
                          <>
                            <span className="text-xs text-slate-300">·</span>
                            <span className="flex items-center gap-1 text-xs text-amber-500 font-semibold">
                              <Bell className="h-3.5 w-3.5" />
                              {format(new Date(item.reminder_date!), 'MMM d')}
                              {item.reminder_time ? ` ${formatReminderTime(item.reminder_time)}` : ''}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Thread connector line between entries */}
                </div>
              );
            })}

            {/* Double-tap hint — fades out */}
            <div className="h-1" />
          </div>

          <div className="shrink-0 px-4 sm:px-5 py-3 border-t border-slate-100 bg-white">
            <button
              onClick={onClose}
              className="h-10 w-full rounded-xl bg-blue-600 text-white text-xs font-semibold active:bg-blue-700"
            >
              Done
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
                  <div className="flex gap-2">
                    <div className="relative flex-1">
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
                    <button
                      onClick={handleAskAI}
                      disabled={isProcessing}
                      className="px-3 bg-violet-50 text-violet-600 rounded-xl border border-violet-100 hover:bg-violet-100 transition-colors flex items-center justify-center disabled:opacity-50"
                      title="Ask AI to find link"
                    >
                      <Sparkles className={`h-4 w-4 ${isProcessing ? 'animate-pulse' : ''}`} />
                    </button>
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
