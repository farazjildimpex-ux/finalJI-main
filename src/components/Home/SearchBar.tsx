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
        {/* Search Label - Hides on focus OR when text exists */}
        {!searchTerm && !isFocused && (
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none animate-in fade-in duration-200">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 transition-colors">
              Search
            </span>
          </div>
        )}
        
        <input
          type="text"
          value={searchTerm}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`block w-full py-4 bg-white border border-slate-200 rounded-[24px] text-sm text-slate-900
                    shadow-sm transition-all duration-200
                    focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 focus:shadow-md
                    ${(searchTerm || isFocused) ? 'pl-6' : 'pl-20'}`}
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
        {quickFilters.map((filter) => {
          const isActive = activeFilter === filter.id;
          return (
            <button
              key={filter.id}
              onClick={() => handleFilterClick(filter.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-[11px] font-bold transition-all shadow-sm active:scale-95
                         ${isActive 
                           ? `${filter.bg} ${filter.border} ${filter.color} ring-2 ring-offset-1 ring-slate-100` 
                           : 'bg-white border-slate-100 text-slate-600 hover:border-blue-200 hover:bg-blue-50/50 hover:text-blue-600'}`}
            >
              <filter.icon className={`h-3.5 w-3.5 ${isActive ? filter.color : filter.color}`} />
              {filter.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SearchBar;