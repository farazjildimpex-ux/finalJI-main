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
    { id: 'contract', label: 'Contracts', icon: FileText,
      activeClass: 'bg-blue-600 text-white border-blue-600',
      inactiveClass: 'bg-white text-blue-700 border-slate-200 hover:border-blue-300',
      iconColor: 'text-blue-500' },
    { id: 'sample', label: 'Samples', icon: Bookmark,
      activeClass: 'bg-purple-600 text-white border-purple-600',
      inactiveClass: 'bg-white text-purple-700 border-slate-200 hover:border-purple-300',
      iconColor: 'text-purple-500' },
    { id: 'debit_note', label: 'Payments', icon: Receipt,
      activeClass: 'bg-emerald-600 text-white border-emerald-600',
      inactiveClass: 'bg-white text-emerald-700 border-slate-200 hover:border-emerald-300',
      iconColor: 'text-emerald-500' },
    { id: 'journal', label: 'Journal', icon: Clipboard,
      activeClass: 'bg-amber-500 text-white border-amber-500',
      inactiveClass: 'bg-white text-amber-700 border-slate-200 hover:border-amber-300',
      iconColor: 'text-amber-500' },
  ];

  const handleFilterClick = (filterId: string) => {
    onFilterChange(activeFilter === filterId ? 'all' : filterId);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Search input — shrinks to give filters room */}
      <div className="relative min-w-0 flex-1">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
          <Search className={`h-3.5 w-3.5 transition-colors duration-200 ${isFocused ? 'text-blue-600' : 'text-slate-400'}`} />
        </div>
        <input
          type="text"
          value={searchTerm}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`block w-full py-2 pl-9 pr-8 bg-white border rounded-xl text-sm text-slate-900
            transition-all duration-200 focus:outline-none
            ${isFocused ? 'border-blue-500 shadow-md shadow-blue-500/10' : 'border-slate-200 shadow-sm hover:border-slate-300'}`}
          placeholder="Search..."
          aria-label="Search"
        />
        {searchTerm && (
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center z-10">
            <button
              onClick={() => setSearchTerm('')}
              className="p-1 text-slate-300 hover:text-rose-500 rounded-lg transition-colors"
              type="button"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Filter pills — inline, scrollable on very small screens */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        {quickFilters.map((filter) => {
          const isActive = activeFilter === filter.id;
          return (
            <button
              key={filter.id}
              onClick={() => handleFilterClick(filter.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-2 border rounded-xl text-xs font-semibold
                transition-all duration-200 shrink-0 active:scale-95
                ${isActive ? filter.activeClass : filter.inactiveClass}`}
            >
              <filter.icon className={`h-3 w-3 ${isActive ? 'text-white' : filter.iconColor}`} />
              <span className="hidden sm:inline">{filter.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SearchBar;
