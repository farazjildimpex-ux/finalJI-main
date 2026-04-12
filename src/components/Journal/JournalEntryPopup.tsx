"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, Link2Off, Link as LinkIcon, X, MessageSquarePlus } from 'lucide-react';
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

  // Auto-scroll to the selected entry on mount
  useEffect(() => {
    if (activeEntryRef.current) {
      activeEntryRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const availableEntries = useMemo(() => {
    return allEntries
      .filter(e => 
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
    if (!confirm('Remove from thread?')) return;
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
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-2 sm:p-4"
      onDoubleClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-4xl h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onDoubleClick={(e) => e.stopPropagation()} // Prevent closing when double clicking the modal itself
      >
        {/* Content Area */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-8 bg-slate-50/30"
          onDoubleClick={onClose} // Double tap to close
        >
          {conversationThread.map((item) => {
            const isSelected = item.id === entry.id;
            return (
              <div 
                key={item.id} 
                ref={isSelected ? activeEntryRef : null}
                className="relative group"
                onDoubleClick={(e) => e.stopPropagation()} // Prevent closing when double clicking a message
              >
                <div className={`bg-white p-8 sm:p-10 rounded-[2rem] border transition-all ${
                  isSelected 
                    ? 'border-blue-500 shadow-lg ring-4 ring-blue-500/10' 
                    : 'border-slate-200 shadow-sm hover:shadow-md'
                }`}>
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex-1">
                      <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight mb-2">
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'
                        }`}>
                          {format(new Date(item.entry_date), 'MMM d, yyyy')}
                        </span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                          {format(new Date(item.created_at), 'h:mm a')}
                        </span>
                      </div>
                    </div>
                    {item.parent_id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnlinkEntry(item.id);
                        }}
                        className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                        title="Unlink"
                      >
                        <Link2Off className="h-6 w-6" />
                      </button>
                    )}
                  </div>
                  
                  <div className="text-xl leading-relaxed text-slate-700 whitespace-pre-wrap font-medium">
                    {item.content}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Actions */}
        <div className="p-6 border-t border-slate-100 bg-white flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowReplyForm(true);
              }}
              className="p-4 bg-green-600 text-white rounded-3xl hover:bg-green-700 transition-all shadow-xl shadow-green-100 active:scale-90"
              title="New Message"
            >
              <MessageSquarePlus className="h-7 w-7" />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowLinkPicker(true);
              }}
              className="p-4 bg-blue-50 text-blue-600 rounded-3xl hover:bg-blue-100 transition-all active:scale-90"
              title="Link Entry"
            >
              <LinkIcon className="h-7 w-7" />
            </button>
          </div>
          
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-4 bg-slate-100 text-slate-600 rounded-3xl hover:bg-slate-200 transition-all active:scale-90"
            title="Close"
          >
            <X className="h-7 w-7" />
          </button>
        </div>
      </div>

      {/* Link Picker Modal */}
      {showLinkPicker && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Link Existing Entry</h3>
              <button 
                onClick={() => setShowLinkPicker(false)} 
                className="p-2 hover:bg-slate-100 rounded-xl"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6">
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search entries to link..."
                  value={linkSearchTerm}
                  onChange={(e) => setLinkSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 text-base font-medium"
                  autoFocus
                />
              </div>

              <div className="max-h-[40vh] overflow-y-auto space-y-3 pr-1">
                {availableEntries.map(e => (
                  <button
                    key={e.id}
                    onClick={() => handleLinkEntry(e.id)}
                    className="w-full text-left p-5 hover:bg-blue-50 rounded-2xl transition-all flex flex-col gap-1 group border border-transparent hover:border-blue-100"
                  >
                    <div className="flex items-center justify-between w-full">
                      <p className="font-bold text-slate-900 truncate text-base">{e.title}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-black uppercase">{format(new Date(e.entry_date), 'MMM d')}</span>
                        <Plus className="h-4 w-4 text-blue-600 opacity-0 group-hover:opacity-100" />
                      </div>
                    </div>
                    {e.content && (
                      <p className="text-sm text-slate-500 line-clamp-1 italic font-medium">
                        {e.content}
                      </p>
                    )}
                  </button>
                ))}
                {availableEntries.length === 0 && (
                  <div className="py-16 text-center">
                    <p className="text-slate-300 text-[10px] font-black uppercase tracking-[0.3em]">No entries found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
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
    </div>
  );
};

export default JournalEntryPopup;