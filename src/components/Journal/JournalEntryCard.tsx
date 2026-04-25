import { Edit2, Trash2, Maximize2, Clock, Link2 } from 'lucide-react';
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
      onDoubleClick={() => onDoubleTap?.(entry)}
      className={`group relative rounded-2xl border overflow-hidden cursor-pointer select-none flex flex-col h-full transition-all duration-300 ease-out hover:-translate-y-1 ${styles.gradient} ${styles.border} ${styles.hoverBorder} ${styles.shadow} ${styles.hoverShadow}`}
    >
      {/* Top accent strip */}
      <div className={`absolute inset-x-0 top-0 h-1 ${styles.accent}`} />

      {/* Subtle inner highlight */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />

      <div className="relative flex flex-col h-full p-4 pt-[18px]">
        <div className="flex items-start justify-between mb-2 gap-2">
          <h4 className={`text-base font-bold leading-tight tracking-tight ${styles.title}`}>
            {entry.title}
          </h4>
          <div
            className={`flex items-center gap-0.5 p-0.5 rounded-lg shadow-sm backdrop-blur-sm opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 shrink-0 ${styles.actionBar}`}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDoubleTap?.(entry);
              }}
              className={`p-1 rounded-md transition-colors ${styles.iconButton}`}
              title="View Full"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(entry);
              }}
              className={`p-1 rounded-md transition-colors ${styles.iconButton}`}
              title="Edit"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {entry.content && (
          <p
            className={`text-sm line-clamp-4 mb-3 whitespace-pre-wrap leading-relaxed flex-1 ${styles.body}`}
          >
            {entry.content}
          </p>
        )}

        <div className="flex items-center justify-between mt-auto pt-2 border-t border-black/5">
          <span
            className={`flex items-center gap-1 text-[11px] font-semibold ${styles.meta}`}
          >
            <Clock className="h-3 w-3" />
            {format(new Date(entry.created_at), 'h:mm a')}
          </span>
          {entry.parent_id && (
            <span
              className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${styles.badge}`}
            >
              <Link2 className="h-2.5 w-2.5" />
              Linked
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default JournalEntryCard;
