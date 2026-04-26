"use client";

import React, { useState } from 'react';
import { Search, X, FileText, Bookmark, Receipt, Clipboard } from 'lucide-react';

interface SearchBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ searchTerm, setSearchTerm, activeFilter, onFilterChange }) => {
  const [isFocused, setIsFocused] = useState(false);

  const quickFilters = [
    { id: 'contract', label: 'Contracts', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' },
    { id: 'sample', label: 'Samples', icon: Bookmark, color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-200' },
    { id: 'debit_note', label: 'Payments', icon: Receipt, color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-200' },
    { id: 'journal', label: 'Journal', icon: Clipboard, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
  ];

  const handleFilterClick = (filterId: string) => {
    if (activeFilter === filterId) {
      onFilterChange('all');
    } else {
      onFilterChange(filterId);
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="relative group">
        {/* Search Label - Fades out smoothly */}
        {!searchTerm && !isFocused && (
          <div className="absolute inset-y-0 left-0 pl-12 flex items-center pointer-events-none animate-in fade-in duration-500">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Search
            </span>
          </div>
        )}
        
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className={`h-4 w-4 transition-colors duration-300 ${isFocused ? 'text-blue-500' : 'text-slate-300'}`} />
        </div>

        <input
          type="text"
          value={searchTerm}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full py-2.5 pl-12 pr-12 bg-white border border-slate-200 rounded-2xl text-sm text-slate-900
                    shadow-sm transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]
                    focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 focus:shadow-md"
          placeholder=""
          aria-label="Search"
        />
        
        {searchTerm && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <button
              onClick={() => setSearchTerm('')}
              className="p-1.5 text-slate-300 hover:text-slate-500 hover:bg-slate-50 rounded-lg transition-all duration-200"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Quick Filters - Horizontal Scrollable */}
      <div className="flex items-center gap-2 px-1 overflow-hidden">
        <span className="hidden sm:block text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1 shrink-0">Quick Filters:</span>
        <div className="flex flex-nowrap gap-2 overflow-x-auto no-scrollbar pb-1 -mb-1 w-full">
          {quickFilters.map((filter) => {
            const isActive = activeFilter === filter.id;
            return (
              <button
                key={filter.id}
                onClick={() => handleFilterClick(filter.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 border rounded-full text-[11px] font-bold transition-all duration-300 shrink-0 active:scale-95
                           ${isActive 
                             ? `${filter.bg} ${filter.border} ${filter.color} shadow-sm ring-2 ring-blue-500/10` 
                             : 'bg-white border-slate-100 text-slate-600 hover:border-blue-200 hover:text-blue-600 shadow-sm'}`}
              >
                <filter.icon className="h-3.5 w-3.5" />
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SearchBar;