import { Edit2, Trash2, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { JournalEntry } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { resolveJournalColor, getJournalColorStyles } from './journalColors';
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

  const colorKey = resolveJournalColor(entry.color, entry.id);
  const styles = getJournalColorStyles(colorKey);

  return (
    <div
      onClick={() => onDoubleTap?.(entry)}
      className={`group relative rounded-xl border overflow-hidden cursor-pointer select-none flex flex-col transition-all duration-200 ease-out hover:-translate-y-0.5 ${styles.gradient} ${styles.border} ${styles.hoverBorder} ${styles.shadow} ${styles.hoverShadow}`}
    >
      {/* Left accent strip */}
      <div className={`absolute inset-y-0 left-0 w-1 ${styles.accent}`} />

      <div className="relative flex flex-col px-3 py-2 pl-3.5">
        {/* Title row — title on left, time + actions on right */}
        <div className="flex items-baseline justify-between gap-2">
          <h4 className={`text-[13px] font-bold leading-snug tracking-tight line-clamp-1 flex-1 min-w-0 ${styles.title}`}>
            {entry.title}
          </h4>
          <span
            className={`text-[10px] font-semibold tabular-nums shrink-0 ${styles.meta} group-hover:opacity-0 transition-opacity`}
          >
            {format(new Date(entry.created_at), 'h:mm a')}
          </span>
          <div
            className={`absolute right-2 top-1.5 flex items-center gap-0 p-0.5 rounded-md shadow-sm backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0 ${styles.actionBar}`}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(entry);
              }}
              className={`p-0.5 rounded transition-colors ${styles.iconButton}`}
              title="Edit"
            >
              <Edit2 className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="p-0.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Content — single line preview, fades to indicate more */}
        {entry.content && (
          <p
            className={`text-[12px] line-clamp-2 leading-snug mt-0.5 ${styles.body}`}
          >
            {entry.content}
          </p>
        )}

        {/* Linked badge — only shown when applicable, inline at bottom-right */}
        {entry.parent_id && (
          <span
            className={`absolute bottom-1.5 right-2 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${styles.badge}`}
          >
            <Link2 className="h-2 w-2" />
            Linked
          </span>
        )}
      </div>
    </div>
  );
};

export default JournalEntryCard;
