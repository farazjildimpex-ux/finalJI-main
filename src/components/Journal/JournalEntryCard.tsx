import { Edit2, Trash2, Maximize2 } from 'lucide-react';
import { format } from 'date-fns';
import { JournalEntry } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { resolveJournalColor, getJournalColorStyles } from './journalColors';

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
    if (!confirm('Are you sure you want to delete this entry?')) return;

    try {
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', entry.id);

      if (error) throw error;
      onEntryUpdated();
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  const colorKey = resolveJournalColor(entry.color, entry.id);
  const styles = getJournalColorStyles(colorKey);

  return (
    <div
      onDoubleClick={() => onDoubleTap?.(entry)}
      className={`rounded-xl border p-4 transition-all cursor-pointer group shadow-sm hover:shadow-md select-none flex flex-col h-full ${styles.bg} ${styles.border} ${styles.hoverBorder}`}
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <h4 className={`text-base font-bold leading-tight ${styles.title}`}>{entry.title}</h4>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDoubleTap?.(entry);
            }}
            className={`p-1 rounded-md ${styles.iconButton}`}
            title="View Full"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(entry);
            }}
            className={`p-1 rounded-md ${styles.iconButton}`}
            title="Edit"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50/60 rounded-md"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {entry.content && (
        <p className={`text-sm line-clamp-4 mb-3 whitespace-pre-wrap leading-relaxed flex-1 ${styles.body}`}>
          {entry.content}
        </p>
      )}

      <div className="flex items-center justify-between mt-auto">
        <span className={`text-[11px] font-medium ${styles.meta}`}>
          {format(new Date(entry.created_at), 'h:mm a')}
        </span>
        {entry.parent_id && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${styles.badge}`}>
            Linked
          </span>
        )}
      </div>
    </div>
  );
};

export default JournalEntryCard;
