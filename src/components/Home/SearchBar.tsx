import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ searchTerm, setSearchTerm, placeholder }) => {
  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-gray-400" />
      </div>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="block w-full pl-11 pr-10 py-2.5 border border-gray-300 rounded-lg leading-5 bg-white
                  placeholder-gray-500 focus:outline-none focus:placeholder-gray-400
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all"
        placeholder={placeholder || "Search tasks & orders..."}
        aria-label="Search tasks and orders"
      />
      {searchTerm && (
        <button
          onClick={() => setSearchTerm('')}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
          type="button"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

export default SearchBar;