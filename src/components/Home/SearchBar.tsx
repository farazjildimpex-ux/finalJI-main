import React from 'react';
import { Search, X, FileText, Bookmark, Receipt, Clipboard } from 'lucide-react';

interface SearchBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ searchTerm, setSearchTerm }) => {
  const quickFilters = [
    { label: 'Contracts', icon: FileText, color: 'text-blue-500' },
    { label: 'Samples', icon: Bookmark, color: 'text-purple-500' },
    { label: 'Payments', icon: Receipt, color: 'text-green-500' },
    { label: 'Journal', icon: Clipboard, color: 'text-amber-500' },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="relative group">
        {/* Search Label - Only visible when empty */}
        {!searchTerm && (
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none animate-in fade-in duration-200">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 group-focus-within:text-blue-600 transition-colors">
              Search
            </span>
          </div>
        )}
        
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`block w-full py-4 bg-white border border-slate-200 rounded-[24px] text-sm text-slate-900
                    shadow-sm transition-all duration-200
                    focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 focus:shadow-md
                    ${searchTerm ? 'pl-6' : 'pl-20'}`}
          placeholder=""
          aria-label="Search"
        />
        
        <div className="absolute inset-y-0 right-0 pr-4 flex items-center gap-2">
          {searchTerm ? (
            <button
              onClick={() => setSearchTerm('')}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          ) : (
            <div className="p-2 text-slate-300">
              <Search className="h-5 w-5" />
            </div>
          )}
        </div>
      </div>

      {/* Quick Options / Filters */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">Quick Options:</span>
        {quickFilters.map((filter) => (
          <button
            key={filter.label}
            onClick={() => setSearchTerm(filter.label)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-100 rounded-full text-[11px] font-bold text-slate-600 
                       hover:border-blue-200 hover:bg-blue-50/50 hover:text-blue-600 transition-all shadow-sm active:scale-95"
          >
            <filter.icon className={`h-3.5 w-3.5 ${filter.color}`} />
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SearchBar;