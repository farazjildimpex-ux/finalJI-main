"use client";

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Book, FileText, Bookmark, Receipt, Menu } from 'lucide-react';

interface MobileBottomNavProps {
  onOpenMenu: () => void;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenMenu }) => {
  const location = useLocation();
  
  const navItems = [
    { name: 'Home', path: '/app/home', icon: Home },
    { name: 'Contacts', path: '/app/contacts', icon: Book },
    { name: 'Contracts', path: '/app/contracts', icon: FileText },
    { name: 'Letters', path: '/app/samples', icon: Bookmark },
    { name: 'Payments', path: '/app/debit-notes', icon: Receipt },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 md:hidden shadow-[0_-4px_10px_rgba(0,0,0,0.05)] pb-safe">
      <div className="flex justify-around items-center h-16 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 min-w-0 h-full transition-all duration-200 ${
                isActive ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              <Icon
                className={`h-5 w-5 mb-1 transition-transform duration-200 ${
                  isActive ? 'scale-110' : ''
                }`}
              />
              <span className="text-[10px] font-bold uppercase tracking-tighter truncate w-full text-center">
                {item.name}
              </span>
              {isActive && (
                <div className="absolute bottom-1 w-1 h-1 bg-blue-600 rounded-full" />
              )}
            </Link>
          );
        })}
        
        {/* Menu Trigger for Sidebar Actions */}
        <button
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center flex-1 min-w-0 h-full text-gray-500 hover:text-gray-700"
        >
          <Menu className="h-5 w-5 mb-1" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Menu</span>
        </button>
      </div>
    </nav>
  );
};

export default MobileBottomNav;