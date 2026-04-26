import { useRef } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { JournalEntry } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { dialogService } from '../../lib/dialogService';

interface JournalEntryCardProps {
  entry: JournalEntry;
  onEntryUpdated: () => void;
  /** Fired on a double tap/click to open the conversation thread popup. */
  onOpen?: (entry: JournalEntry) => void;
  onEdit?: (entry: JournalEntry) => void;
}

const JournalEntryCard: React.FC<JournalEntryCardProps> = ({
  entry,
  onEntryUpdated,
  onOpen,
  onEdit,
}) => {
  const { user } = useAuth();
  const lastTap = useRef<number>(0);

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      // Double tap detected
      onOpen?.(entry);
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
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', entry.id);

      if (error) throw error;
      dialogService.success('Entry deleted.');
      onEntryUpdated();
    } catch (error: any) {
      console.error('Error deleting entry:', error);
      dialogService.alert({
        title: 'Failed to delete entry',
        message: error?.message || 'Please try again.',
        tone: 'danger',
      });
    }
  };

  return (
    <div
      onClick={handleInteraction}
      className="group relative rounded-2xl border border-slate-200 bg-white cursor-pointer select-none flex flex-col transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-blue-300 shadow-[0_1px_3px_rgba(15,23,42,0.05),0_4px_14px_-6px_rgba(15,23,42,0.08)] hover:shadow-[0_8px_24px_-8px_rgba(37,99,235,0.18)]"
    >
      <div className="relative flex flex-col px-5 py-5">
        {/* Title row */}
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <h4 className="text-[16px] font-black leading-tight tracking-tight line-clamp-1 flex-1 min-w-0 text-slate-900">
            {entry.title}
          </h4>
          <span className="text-[11px] font-bold tabular-nums shrink-0 text-slate-400 group-hover:opacity-0 transition-opacity uppercase tracking-wider">
            {format(new Date(entry.created_at), 'h:mm a')}
          </span>
          
          {/* Actions - visible on hover */}
          <div className="absolute right-4 top-4 flex items-center gap-1 p-1 rounded-xl shadow-sm backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0 bg-white/95 ring-1 ring-slate-200">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(entry);
              }}
              className="p-1.5 rounded-lg transition-colors text-slate-500 hover:text-blue-600 hover:bg-blue-50"
              title="Edit"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content - Larger preview */}
        {entry.content && (
          <p className="text-[14px] line-clamp-6 leading-relaxed mt-3 text-slate-600 whitespace-pre-wrap">
            {entry.content}
          </p>
        )}
        
        {/* Double tap hint (subtle) */}
        <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
            Double tap to view thread
          </span>
        </div>
      </div>
    </div>
  );
};

export default JournalEntryCard;