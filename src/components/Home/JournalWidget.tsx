import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { JournalEntry } from '../../types';
import JournalEntryForm from '../Journal/JournalEntryForm';
import JournalEntryCard from '../Journal/JournalEntryCard';
import JournalEntryPopup from '../Journal/JournalEntryPopup';
import DatePicker from '../UI/DatePicker';

interface JournalWidgetProps {
  entries: JournalEntry[];
  loading: boolean;
  onEntriesUpdated: () => void;
}

const SWIPE_THRESHOLD = 50;

const JournalWidget: React.FC<JournalWidgetProps> = ({ entries, loading, onEntriesUpdated }) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [selectedEntryForPopup, setSelectedEntryForPopup] = useState<JournalEntry | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const selectedDateKey = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);

  const selectedDayEntries = useMemo(() => {
    return entries.filter((entry) => entry.entry_date === selectedDateKey);
  }, [entries, selectedDateKey]);

  const handleDateChange = (nextDate: Date) => {
    setSelectedDate(nextDate);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    setTouchStartX(event.changedTouches[0]?.clientX ?? null);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) return;

    const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX;
    const swipeDistance = touchEndX - touchStartX;

    if (Math.abs(swipeDistance) >= SWIPE_THRESHOLD) {
      handleDateChange(addDays(selectedDate, swipeDistance < 0 ? 1 : -1));
    }

    setTouchStartX(null);
  };

  return (
    <div className="mb-4 md:mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg md:text-xl font-bold text-gray-900 uppercase tracking-wider">Journal</h2>
        <button
          onClick={() => {
            setEditingEntry(null);
            setIsFormOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Entry</span>
        </button>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <button
          onClick={() => handleDateChange(addDays(selectedDate, -1))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-white text-blue-600 hover:bg-blue-50 transition-colors shadow-sm"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex-1 flex justify-center">
          <DatePicker 
            value={selectedDateKey} 
            onChange={(val) => setSelectedDate(new Date(`${val}T00:00:00`))}
            className="w-full max-w-[200px]"
          />
        </div>

        <button
          onClick={() => handleDateChange(addDays(selectedDate, 1))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-white text-blue-600 hover:bg-blue-50 transition-colors shadow-sm"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div 
        className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm"
        onTouchStart={handleTouchStart} 
        onTouchEnd={handleTouchEnd}
      >
        {loading ? (
          <div className="text-center py-4 text-gray-500">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-xs font-medium">Loading...</p>
          </div>
        ) : selectedDayEntries.length === 0 ? (
          <div className="text-center py-3">
            <p className="text-gray-400 text-xs mb-2 font-medium">No entries for this day</p>
            <button 
              onClick={() => setIsFormOpen(true)} 
              className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all"
            >
              Create Entry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 p-1">
            {selectedDayEntries.map((entry) => (
              <JournalEntryCard
                key={entry.id}
                entry={entry}
                onEntryUpdated={onEntriesUpdated}
                onDoubleTap={(e) => setSelectedEntryForPopup(e)}
                onEdit={(e) => {
                  setEditingEntry(e);
                  setIsFormOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {isFormOpen && (
        <JournalEntryForm
          initialDate={selectedDate}
          initialEntry={editingEntry}
          onClose={() => {
            setIsFormOpen(false);
            setEditingEntry(null);
          }}
          onSave={() => {
            setIsFormOpen(false);
            setEditingEntry(null);
            onEntriesUpdated();
          }}
        />
      )}

      {selectedEntryForPopup && (
        <JournalEntryPopup
          entry={selectedEntryForPopup}
          allEntries={entries}
          onClose={() => setSelectedEntryForPopup(null)}
          onUpdate={onEntriesUpdated}
        />
      )}
    </div>
  );
};

export default JournalWidget;