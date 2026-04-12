"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, Link2Off, Link as LinkIcon, X, MessageSquarePlus, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { JournalEntry } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import JournalEntryForm from './JournalEntryForm';

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

  const rootId = useMemo(() => entry.parent_id || entry.id, [entry]);

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

  const handleLinkEntry = async (targetEntryId: string) => {
    try {
      setIsProcessing(true);
      await supabase.from('journal_entries').update({ parent_id: rootId }).eq('id', targetEntryId);
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
    if (!confirm('Remove this entry from the thread?')) return;
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

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-2 sm:p-4"
        onClick={onClose}
      >
        <div
          className="bg-white w-full max-w-2xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {conversationThread.length > 1 ? `Thread · ${conversationThread.length} entries` : 'Journal Entry'}
            </span>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Thread scroll area */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50"
          >
            {conversationThread.map((item) => {
              const isSelected = item.id === entry.id;
              return (
                <div
                  key={item.id}
                  ref={isSelected ? activeEntryRef : null}
                  className="relative"
                >
                  <div
                    className={`bg-white p-5 sm:p-6 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-blue-400 shadow-md ring-4 ring-blue-400/10'
                        : 'border-slate-200 shadow-sm'
                    }`}
                  >
                    {/* Entry header row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-slate-900 leading-snug truncate">
                          {item.title}
                        </h3>
                        <div className="flex items-center flex-wrap gap-2 mt-1.5">
                          <span
                            className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-blue-50 text-blue-600'
                            }`}
                          >
                            {format(new Date(item.entry_date), 'MMM d, yyyy')}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            {format(new Date(item.created_at), 'h:mm a')}
                          </span>
                          {item.reminder_enabled && item.reminder_date && (
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                              🔔 {format(new Date(item.reminder_date), 'MMM d')}
                              {item.reminder_time
                                ? ` · ${(() => {
                                    const [h, m] = item.reminder_time.split(':');
                                    const d = new Date();
                                    d.setHours(Number(h), Number(m));
                                    return format(d, 'h:mm a');
                                  })()}`
                                : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons per entry */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setEditingEntry(item)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                          title="Edit entry"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {item.parent_id && (
                          <button
                            onClick={() => handleUnlinkEntry(item.id)}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            title="Remove from thread"
                          >
                            <Link2Off className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    {item.content && (
                      <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">
                        {item.content}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Actions */}
          <div className="shrink-0 px-5 py-4 border-t border-slate-100 bg-white flex items-center gap-3">
            <button
              onClick={() => setShowReplyForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors active:scale-95 shadow-md shadow-blue-200"
            >
              <MessageSquarePlus className="h-4 w-4" />
              <span>Add to thread</span>
            </button>
            <button
              onClick={() => setShowLinkPicker(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors active:scale-95"
            >
              <LinkIcon className="h-4 w-4" />
              <span>Link entry</span>
            </button>
          </div>
        </div>
      </div>

      {/* Link Picker Modal */}
      {showLinkPicker && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowLinkPicker(false)}
        >
          <div
            className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-slate-900">Link an existing entry</h3>
              <button
                onClick={() => setShowLinkPicker(false)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 flex-1 flex flex-col min-h-0">
              <div className="relative mb-3 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search entries…"
                  value={linkSearchTerm}
                  onChange={(e) => setLinkSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                {availableEntries.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => handleLinkEntry(e.id)}
                    disabled={isProcessing}
                    className="w-full text-left p-4 hover:bg-blue-50 rounded-xl transition-all group border border-transparent hover:border-blue-100 disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between w-full gap-2">
                      <p className="font-semibold text-slate-900 truncate text-sm">{e.title}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-400 font-medium">
                          {format(new Date(e.entry_date), 'MMM d')}
                        </span>
                        <Plus className="h-4 w-4 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    {e.content && (
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{e.content}</p>
                    )}
                  </button>
                ))}
                {availableEntries.length === 0 && (
                  <div className="py-12 text-center">
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest">
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
