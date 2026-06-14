import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { addDays, format } from 'date-fns';
import type { JournalEntry } from '../../types';
import JournalEntryForm from '../Journal/JournalEntryForm';
import JournalEntryCard from '../Journal/JournalEntryCard';
import JournalEntryPopup from '../Journal/JournalEntryPopup';
import DatePicker from '../UI/DatePicker';
import { suggestJournalLink } from '../../lib/journalAI';
import { dialogService } from '../../lib/dialogService';
import { supabase } from '../../lib/supabaseClient';

interface JournalWidgetProps {
  entries: JournalEntry[];
  loading: boolean;
  onEntriesUpdated: () => void;
  /** When true, hides the "Journal" heading + New Entry button */
  hideHeader?: boolean;
  /** When true, removes the inner card border/bg/shadow — use when embedded in an outer card */
  noCard?: boolean;
}

const SWIPE_THRESHOLD = 50;

const JournalWidget: React.FC<JournalWidgetProps> = ({
  entries, loading, onEntriesUpdated, hideHeader = false, noCard = false,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [selectedEntryForPopup, setSelectedEntryForPopup] = useState<JournalEntry | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const selectedDateKey = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);

  const selectedDayEntries = useMemo(
    () => entries.filter(e => e.entry_date === selectedDateKey),
    [entries, selectedDateKey],
  );

  const handleDateChange = (nextDate: Date) => setSelectedDate(nextDate);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setTouchStartX(e.changedTouches[0]?.clientX ?? null);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0]?.clientX ?? touchStartX;
    const dist = touchEndX - touchStartX;
    if (Math.abs(dist) >= SWIPE_THRESHOLD) {
      handleDateChange(addDays(selectedDate, dist < 0 ? 1 : -1));
    }
    setTouchStartX(null);
  };

  return (
    <div className="mb-4 md:mb-0">
      {!hideHeader && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 uppercase tracking-wider">Journal</h2>
          <button
            onClick={() => { setEditingEntry(null); setIsFormOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Entry</span>
          </button>
        </div>
      )}

      {/* Date navigation — minimal chevrons, swipe is the primary gesture */}
      <div className="flex items-center gap-1 mb-2">
        <button
          onClick={() => handleDateChange(addDays(selectedDate, -1))}
          className="w-7 h-7 flex items-center justify-center select-none transition-colors text-gray-300 hover:text-gray-400 active:text-gray-500 text-[18px] leading-none font-light"
          aria-label="Previous day"
        >
          ‹
        </button>
        <div className="flex-1 flex justify-center">
          <DatePicker
            value={selectedDateKey}
            onChange={(val) => setSelectedDate(new Date(`${val}T00:00:00`))}
            className="w-full max-w-[180px] text-[11px]"
          />
        </div>
        <button
          onClick={() => handleDateChange(addDays(selectedDate, 1))}
          className="w-7 h-7 flex items-center justify-center select-none transition-colors text-gray-300 hover:text-gray-400 active:text-gray-500 text-[18px] leading-none font-light"
          aria-label="Next day"
        >
          ›
        </button>
      </div>

      {/* Entries container — noCard removes border/bg/shadow for embedding in an outer card */}
      <div
        className={noCard
          ? ''
          : 'bg-white rounded-2xl border border-gray-200 p-3 shadow-sm'}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {loading ? (
          <div className="text-center py-4 text-gray-500">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-gray-400 mx-auto mb-2" />
            <p className="text-xs font-medium">Loading…</p>
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
          <div className="grid grid-cols-1 gap-3 p-1">
            {selectedDayEntries.map(entry => (
              <JournalEntryCard
                key={entry.id}
                entry={entry}
                onEntryUpdated={onEntriesUpdated}
                onOpen={e => setSelectedEntryForPopup(e)}
                onEdit={e => { setEditingEntry(e); setIsFormOpen(true); }}
              />
            ))}
          </div>
        )}
      </div>

      {isFormOpen && (
        <JournalEntryForm
          initialDate={selectedDate}
          initialEntry={editingEntry}
          onClose={() => { setIsFormOpen(false); setEditingEntry(null); }}
          onSave={async (savedEntry?: JournalEntry) => {
            setIsFormOpen(false);
            setEditingEntry(null);
            onEntriesUpdated();

            if (savedEntry && !savedEntry.parent_id && !editingEntry) {
              const tenDaysAgo = new Date();
              tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
              const pastEntries = entries.filter(
                e => e.id !== savedEntry.id && new Date(e.entry_date) >= tenDaysAgo,
              );
              if (pastEntries.length > 0) {
                dialogService.toast({ message: 'AI is looking for related entries…', durationMs: 2000 });
                const suggestion = await suggestJournalLink(savedEntry, pastEntries);
                if (suggestion.suggested_parent_id) {
                  const parentEntry = pastEntries.find(e => e.id === suggestion.suggested_parent_id);
                  if (parentEntry) {
                    const link = await dialogService.confirm({
                      title: 'Link Journal Entry?',
                      message: `AI noticed this entry is related to: "${parentEntry.title}".\n\nReason: ${suggestion.reasoning}\n\nWould you like to link them?`,
                      confirmLabel: 'Link Entries',
                    });
                    if (link) {
                      await supabase.from('journal_entries').update({ parent_id: parentEntry.id }).eq('id', savedEntry.id);
                      onEntriesUpdated();
                      dialogService.success('Entries linked successfully.');
                    }
                  }
                }
              }
            }
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
