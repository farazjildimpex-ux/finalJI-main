import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { JournalEntry } from '../../types';
import JournalEntryCard from './JournalEntryCard';

interface JournalSearchResultsProps {
  entries: JournalEntry[];
  searchTerm: string;
  onEntriesUpdated: () => void;
  onDoubleTap: (entry: JournalEntry) => void;
  onEdit: (entry: JournalEntry) => void;
}

const RESULTS_PER_PAGE = 10;

const JournalSearchResults: React.FC<JournalSearchResultsProps> = ({
  entries,
  searchTerm,
  onEntriesUpdated,
  onDoubleTap,
  onEdit,
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(entries.length / RESULTS_PER_PAGE));
  const startIndex = (currentPage - 1) * RESULTS_PER_PAGE;
  const paginatedEntries = useMemo(
    () => entries.slice(startIndex, startIndex + RESULTS_PER_PAGE),
    [entries, startIndex]
  );

  const visiblePages = useMemo(() => {
    const pages: number[] = [];
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);

    for (let page = startPage; page <= endPage; page += 1) {
      pages.push(page);
    }

    return pages;
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, entries.length]);

  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-center text-gray-500">No journal entries found matching "{searchTerm}"</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-medium text-gray-700">Search Results</h3>
        <p className="text-sm text-gray-500">
          Showing {startIndex + 1}-{Math.min(startIndex + RESULTS_PER_PAGE, entries.length)} of {entries.length}
        </p>
      </div>

      <div className="space-y-3">
        {paginatedEntries.map((entry) => (
          <JournalEntryCard
            key={entry.id}
            entry={entry}
            onEntryUpdated={onEntriesUpdated}
            onDoubleTap={onDoubleTap}
            onEdit={onEdit}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <button
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {visiblePages.map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`min-w-10 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  page === currentPage
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={currentPage === totalPages}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default JournalSearchResults;