"use client";

import React from 'react';
import { Menu, Building2 } from 'lucide-react';
import NotificationBell from '../UI/NotificationBell';

interface MobileHeaderProps {
  onOpenMenu: () => void;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({ onOpenMenu }) => {
  return (
    <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMenu}
          className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-blue-600" />
          <span className="font-bold text-gray-900 tracking-tight">JILD IMPEX</span>
        </div>
      </div>
      
      <div className="flex items-center gap-1">
        <NotificationBell />
      </div>
    </header>
  );
};

export default MobileHeader;