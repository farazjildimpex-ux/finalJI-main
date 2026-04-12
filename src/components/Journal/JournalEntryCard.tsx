import { Edit2, Trash2, Maximize2 } from 'lucide-react';
import { format } from 'date-fns';
import { JournalEntry } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';

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

  return (
    <div 
      onDoubleClick={() => onDoubleTap?.(entry)}
      className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition-all cursor-pointer group shadow-sm hover:shadow-md select-none"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-base font-bold text-gray-900">{entry.title}</h4>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDoubleTap?.(entry);
            }}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md"
            title="View Full"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(entry);
            }}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-50 rounded-md"
            title="Edit"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {entry.content && (
        <p className="text-sm text-gray-700 line-clamp-3 mb-3 whitespace-pre-wrap leading-relaxed">
          {entry.content}
        </p>
      )}
      
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-gray-400">
          {format(new Date(entry.created_at), 'h:mm a')}
        </span>
        {entry.parent_id && (
          <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
            Linked Thread
          </span>
        )}
      </div>
    </div>
  );
};

export default JournalEntryCard;