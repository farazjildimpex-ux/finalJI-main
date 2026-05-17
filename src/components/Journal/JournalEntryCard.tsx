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
  onOpen?: (entry: JournalEntry) => void;
  onEdit?: (entry: JournalEntry) => void;
}

const JournalEntryCard: React.FC<JournalEntryCardProps> = ({ entry, onEntryUpdated, onOpen, onEdit }) => {
  const { user } = useAuth();
  const lastTap = useRef<number>(0);

  const handleInteraction = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) onOpen?.(entry);
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
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h4 className="text-[14px] font-bold leading-snug flex-1 min-w-0 text-slate-900 line-clamp-1">
            {entry.title}
          </h4>
          <span className="text-[11px] font-medium tabular-nums shrink-0 text-slate-400 group-hover:opacity-0 transition-opacity mt-0.5">
            {format(new Date(entry.created_at), 'h:mm a')}
          </span>
          {/* Hover actions */}
          <div className="absolute right-3 top-3 flex items-center gap-0.5 p-0.5 rounded-lg shadow-sm backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0 bg-white/95 ring-1 ring-slate-200">
            <button onClick={(e) => { e.stopPropagation(); onEdit?.(entry); }}
              className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit">
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleDelete(); }}
              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {/* Content */}
        {entry.content && (
          <p className="text-[13px] line-clamp-4 leading-relaxed text-slate-600 whitespace-pre-wrap">
            {entry.content}
          </p>
        )}
      </div>
    </div>
  );
};

export default JournalEntryCard;
