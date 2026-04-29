"use client";

import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, FileText, Bookmark, CreditCard, Database } from 'lucide-react';

const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const navItems = [
    { name: 'Home', path: '/app/home', icon: Home },
    { name: 'Contacts', path: '/app/contacts', icon: Users },
    { name: 'Contracts', path: '/app/contracts', icon: FileText },
    { name: 'Letters', path: '/app/samples', icon: Bookmark },
    { name: 'Payments', path: '/app/debit-notes', icon: CreditCard },
    { name: 'Data', path: '/app/settings', icon: Database },
  ];

  const activeIndex = navItems.findIndex((i) => location.pathname === i.path);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (activeIndex < 0) return;
    const target = el.children[activeIndex] as HTMLElement | undefined;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeIndex]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 z-50 md:hidden shadow-[0_-10px_30px_rgba(0,0,0,0.04)] pb-safe">
      <div
        ref={scrollerRef}
        className="flex items-stretch h-16 overflow-x-auto overflow-y-hidden no-scrollbar snap-x snap-mandatory overscroll-x-contain"
        style={{ scrollbarWidth: 'none' }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.name}
              to={item.path}
              className="relative flex flex-col items-center justify-center flex-shrink-0 h-full snap-start"
              style={{ width: '20%' }}
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
