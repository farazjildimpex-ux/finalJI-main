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
    { 
      id: 'contract', 
      label: 'Contracts', 
      icon: FileText, 
      activeClass: 'bg-blue-600 text-white border-blue-600 shadow-blue-200',
      inactiveClass: 'bg-blue-50 text-blue-700 border-blue-100 hover:border-blue-300',
      iconColor: 'text-blue-500'
    },
    { 
      id: 'sample', 
      label: 'Samples', 
      icon: Bookmark, 
      activeClass: 'bg-purple-600 text-white border-purple-600 shadow-purple-200',
      inactiveClass: 'bg-purple-50 text-purple-700 border-purple-100 hover:border-purple-300',
      iconColor: 'text-purple-500'
    },
    { 
      id: 'debit_note', 
      label: 'Payments', 
      icon: Receipt, 
      activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-200',
      inactiveClass: 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-300',
      iconColor: 'text-emerald-500'
    },
    { 
      id: 'journal', 
      label: 'Journal', 
      icon: Clipboard, 
      activeClass: 'bg-amber-500 text-white border-amber-500 shadow-amber-200',
      inactiveClass: 'bg-amber-50 text-amber-700 border-amber-100 hover:border-amber-300',
      iconColor: 'text-amber-500'
    },
  ];

  const handleFilterClick = (filterId: string) => {
    if (activeFilter === filterId) {
      onFilterChange('all');
    } else {
      onFilterChange(filterId);
    }
  };

  return (
    <div className="w-full space-y-5">
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
          <Search className={`h-4 w-4 transition-all duration-500 ${isFocused ? 'text-blue-600 scale-110' : 'text-slate-400'}`} />
        </div>

        <input
          type="text"
          value={searchTerm}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`
            block w-full py-3 pl-11 pr-12 bg-white border rounded-2xl text-sm text-slate-900
            transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
            focus:outline-none focus:ring-8 focus:ring-blue-500/[0.03]
            ${isFocused 
              ? 'border-blue-500 shadow-xl shadow-blue-500/10 -translate-y-0.5' 
              : 'border-slate-200 shadow-sm hover:border-slate-300'}
          `}
          placeholder="Search contracts, samples, or journal..."
          aria-label="Search"
        />
        
        {searchTerm && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center z-10">
            <button
              onClick={() => setSearchTerm('')}
              className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all duration-300"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Quick Filters - Horizontal Scrollable */}
      <div className="flex items-center gap-3 px-1 overflow-hidden">
        <span className="hidden sm:block text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] shrink-0">Filters</span>
        <div className="flex flex-nowrap gap-2.5 overflow-x-auto no-scrollbar pb-1 -mb-1 w-full">
          {quickFilters.map((filter) => {
            const isActive = activeFilter === filter.id;
            return (
              <button
                key={filter.id}
                onClick={() => handleFilterClick(filter.id)}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 border rounded-xl text-[11px] font-bold transition-all duration-300 shrink-0 active:scale-95 shadow-sm
                  ${isActive ? `${filter.activeClass} shadow-lg` : `${filter.inactiveClass}`}
                `}
              >
                <filter.icon className={`h-3.5 w-3.5 ${isActive ? 'text-white' : filter.iconColor}`} />
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