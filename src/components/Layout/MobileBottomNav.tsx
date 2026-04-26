"use client";

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Book, FileText, Bookmark, Receipt } from 'lucide-react';

interface MobileBottomNavProps {
  // onOpenMenu is no longer needed since we removed the menu button
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = () => {
  const location = useLocation();
  
  const navItems = [
    { name: 'Home', path: '/app/home', icon: Home },
    { name: 'Contacts', path: '/app/contacts', icon: Book },
    { name: 'Contracts', path: '/app/contracts', icon: FileText },
    { name: 'Letters', path: '/app/samples', icon: Bookmark },
    { name: 'Payments', path: '/app/debit-notes', icon: Receipt },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 z-50 md:hidden shadow-[0_-8px_20px_rgba(0,0,0,0.03)] pb-safe">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.name}
              to={item.path}
              className="relative flex flex-col items-center justify-center flex-1 min-w-0 h-full group"
            >
              <div className={`
                flex flex-col items-center justify-center w-full py-1.5 rounded-2xl transition-all duration-300 ease-out
                ${isActive ? 'bg-blue-50/80 scale-105' : 'bg-transparent'}
              `}>
                <Icon
                  className={`h-5 w-5 mb-0.5 transition-all duration-300 ${
                    isActive ? 'text-blue-600 scale-110' : 'text-gray-400'
                  }`}
                />
                <span className={`text-[9px] font-black uppercase tracking-tighter truncate w-full text-center transition-colors duration-300 ${
                  isActive ? 'text-blue-700' : 'text-gray-400'
                }`}>
                  {item.name}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;