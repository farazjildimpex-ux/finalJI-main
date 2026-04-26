import { Edit2, Trash2, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { JournalEntry } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { dialogService } from '../../lib/dialogService';

interface JournalEntryCardProps {
  entry: JournalEntry;
  onEntryUpdated: () => void;
  onDoubleTap?: (entry: JournalEntry) => void;
  onEdit?: (entry: JournalEntry) => void;
}

const JournalEntryCard: React.FC<JournalEntryCardProps> = ({
  entry,
  onEntryUpdated,
  onDoubleTap,
  onEdit,
}) => {
  const { user } = useAuth();

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
      onClick={() => onDoubleTap?.(entry)}
      className="group relative rounded-xl border border-slate-200 bg-white cursor-pointer select-none flex flex-col transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-blue-300 shadow-[0_1px_3px_rgba(15,23,42,0.05),0_4px_14px_-6px_rgba(15,23,42,0.08)] hover:shadow-[0_8px_24px_-8px_rgba(37,99,235,0.18)]"
    >
      <div className="relative flex flex-col px-4 py-3.5">
        {/* Title row — title on left, time + actions on right */}
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-[15px] font-bold leading-snug tracking-tight line-clamp-1 flex-1 min-w-0 text-slate-900">
            {entry.title}
          </h4>
          <span className="text-[11px] font-semibold tabular-nums shrink-0 text-slate-500 group-hover:opacity-0 transition-opacity">
            {format(new Date(entry.created_at), 'h:mm a')}
          </span>
          <div className="absolute right-3 top-2.5 flex items-center gap-0 p-0.5 rounded-md shadow-sm backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0 bg-white/95 ring-1 ring-slate-200">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(entry);
              }}
              className="p-1 rounded transition-colors text-slate-600 hover:text-blue-700 hover:bg-blue-50"
              title="Edit"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="p-1 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Content — taller preview with extra rows + breathing room */}
        {entry.content && (
          <p className="text-[13px] line-clamp-4 leading-relaxed mt-2.5 text-slate-600 whitespace-pre-wrap">
            {entry.content}
          </p>
        )}

        {/* Linked badge — only shown when applicable */}
        {entry.parent_id && (
          <span className="mt-2.5 inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200 self-start">
            <Link2 className="h-2.5 w-2.5" />
            Linked
          </span>
        )}
      </div>
    </div>
  );
};

export default JournalEntryCard;
