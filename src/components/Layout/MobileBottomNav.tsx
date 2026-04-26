"use client";

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, FileText, Bookmark, CreditCard } from 'lucide-react';

const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  
  const navItems = [
    { name: 'Home', path: '/app/home', icon: Home },
    { name: 'Contacts', path: '/app/contacts', icon: Users },
    { name: 'Contracts', path: '/app/contracts', icon: FileText },
    { name: 'Letters', path: '/app/samples', icon: Bookmark },
    { name: 'Payments', path: '/app/debit-notes', icon: CreditCard },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 z-50 md:hidden shadow-[0_-10px_30px_rgba(0,0,0,0.04)] pb-safe">
      <div className="flex justify-around items-center h-16 px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.name}
              to={item.path}
              className="relative flex flex-col items-center justify-center flex-1 h-full"
            >
              <div className={`
                flex flex-col items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                ${isActive ? '-translate-y-1 scale-110' : 'translate-y-0 scale-100'}
              `}>
                <div className={`
                  p-1.5 rounded-xl transition-colors duration-300
                  ${isActive ? 'text-blue-600' : 'text-slate-400'}
                `}>
                  <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={`
                  text-[9px] font-bold uppercase tracking-tighter transition-all duration-300
                  ${isActive ? 'text-blue-700 opacity-100 mt-0.5' : 'text-slate-400 opacity-80 mt-0'}
                `}>
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