import { useRef, useState } from 'react';
import { Edit2, Trash2, GitBranch } from 'lucide-react';
import { format } from 'date-fns';
import { JournalEntry } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { dialogService } from '../../lib/dialogService';

interface JournalEntryCardProps {
  entry: JournalEntry;
  onEntryUpdated: () => void;
  onOpen?: (entry: JournalEntry) => void;
  onEdit?: (entry: JournalEntry) => void;
}

const JournalEntryCard: React.FC<JournalEntryCardProps> = ({ entry, onEntryUpdated, onOpen, onEdit }) => {
  const { user } = useAuth();
  const lastTap = useRef<number>(0);
  const [showActions, setShowActions] = useState(false);

  const handleInteraction = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // double-tap → open thread popup
      setShowActions(false);
      onOpen?.(entry);
    } else {
      // single tap → toggle action row on mobile
      setShowActions(v => !v);
    }
    lastTap.current = now;
  };

  const handleDelete = async () => {
    if (!user) return;
    const ok = await dialogService.confirm({
      title: 'Delete entry?',
      message: 'Are you sure you want to delete this journal entry? This action cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const { error } = await supabase.from('journal_entries').delete().eq('id', entry.id);
      if (error) throw error;
      dialogService.success('Entry deleted.');
      onEntryUpdated();
    } catch (error: any) {
      dialogService.alert({ title: 'Failed to delete entry', message: error?.message || 'Please try again.', tone: 'danger' });
    }
  };

  return (
    <div
      onClick={handleInteraction}
      className="group relative rounded-xl border border-slate-200 bg-white cursor-pointer select-none flex flex-col transition-all duration-200 ease-out hover:border-blue-200 shadow-sm hover:shadow-md"
    >
      <div className="relative flex flex-col px-4 py-3.5">
        {/* Title + time row */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h4 className="text-[14px] font-bold leading-snug flex-1 min-w-0 text-slate-900 line-clamp-1">
            {entry.title}
          </h4>
          <span className="text-[11px] font-medium tabular-nums shrink-0 text-slate-400 mt-0.5">
            {format(new Date(entry.created_at), 'h:mm a')}
          </span>
          {/* Desktop-only hover action buttons */}
          <div className="hidden md:flex absolute right-3 top-3 items-center gap-0.5 p-0.5 rounded-lg shadow-sm backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0 bg-white/95 ring-1 ring-slate-200">
            <button
              onClick={e => { e.stopPropagation(); onEdit?.(entry); }}
              className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Edit"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); handleDelete(); }}
              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Content preview */}
        {entry.content && (
          <p className="text-[13px] line-clamp-3 leading-relaxed text-slate-500 whitespace-pre-wrap">
            {entry.content}
          </p>
        )}

        {/* Mobile tap-hint when collapsed */}
        <p className={`md:hidden text-[10px] text-slate-300 mt-1.5 transition-opacity duration-150 ${showActions ? 'opacity-0 h-0 overflow-hidden mt-0' : 'opacity-100'}`}>
          Tap for actions · Double-tap to open
        </p>
      </div>

      {/* Mobile action row — revealed on single tap, hidden by default */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-200 ease-in-out ${
          showActions ? 'max-h-14 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-1 px-4 py-2.5 border-t border-gray-100 bg-gray-50/60">
          <button
            onClick={e => { e.stopPropagation(); onEdit?.(entry); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-blue-600 bg-blue-50 active:bg-blue-100 transition-colors"
          >
            <Edit2 className="h-3 w-3" /> Edit
          </button>
          <button
            onClick={e => { e.stopPropagation(); handleDelete(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-rose-600 bg-rose-50 active:bg-rose-100 transition-colors"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </button>
          {onOpen && (
            <button
              onClick={e => { e.stopPropagation(); onOpen(entry); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-gray-500 bg-gray-100 active:bg-gray-200 ml-auto transition-colors"
            >
              <GitBranch className="h-3 w-3" /> Thread
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default JournalEntryCard;
