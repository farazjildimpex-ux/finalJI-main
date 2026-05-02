"use client";

import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, FileText, Bookmark, CreditCard, Database, Mail } from 'lucide-react';

interface MobileBottomNavProps {
  onOpenMenu?: () => void;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = () => {
  const location = useLocation();
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const navItems = [
    { name: 'Home',      path: '/app/home',           icon: Home },
    { name: 'Contacts',  path: '/app/contacts',        icon: Users },
    { name: 'Contracts', path: '/app/contracts',       icon: FileText },
    { name: 'Letters',   path: '/app/samples',         icon: Bookmark },
    { name: 'Payments',  path: '/app/debit-notes',     icon: CreditCard },
    { name: 'Emails',    path: '/app/email-templates', icon: Mail },
    { name: 'Settings',  path: '/app/settings',        icon: Database },
  ];

  const activeIndex = navItems.findIndex((i) => location.pathname.startsWith(i.path));

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || activeIndex < 0) return;
    const target = el.children[activeIndex] as HTMLElement | undefined;
    if (target) target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeIndex]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 md:hidden pb-safe">
      <div
        ref={scrollerRef}
        className="flex items-stretch h-14 overflow-x-auto overflow-y-hidden no-scrollbar"
        style={{ scrollbarWidth: 'none' }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.name}
              to={item.path}
              className="relative flex flex-col items-center justify-center flex-shrink-0 h-full gap-0.5"
              style={{ width: 'calc(100vw / 5)', minWidth: 52 }}
            >
              <Icon
                className={`h-4.5 w-4.5 transition-colors duration-200 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
                style={{ width: 18, height: 18 }}
                strokeWidth={isActive ? 2.5 : 1.75}
              />
              <span className={`text-[9px] font-semibold tracking-tight transition-colors duration-200 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                {item.name}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-blue-600 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
