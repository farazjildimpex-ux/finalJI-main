"use client";

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, FileText, Users, MoreHorizontal,
  Zap, Bookmark, CalendarDays, Settings, CreditCard, X, ChevronRight, BookOpen,
} from 'lucide-react';

const PRIMARY_TABS = [
  { name: 'Home',      path: '/app/home',       icon: Home      },
  { name: 'Contacts',  path: '/app/contacts',    icon: Users     },
  { name: 'Lead IQ',   path: '/app/sales',       icon: Zap       },
  { name: 'Contracts', path: '/app/contracts',   icon: FileText  },
  { name: 'More',      path: null,               icon: MoreHorizontal },
] as const;

const MORE_ITEMS = [
  { name: 'Journal',   path: '/app/home',         icon: BookOpen,    color: 'text-indigo-600', bg: 'bg-indigo-50'   },
  { name: 'Payments',  path: '/app/debit-notes',  icon: CreditCard,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { name: 'Letters',   path: '/app/samples',      icon: Bookmark,    color: 'text-blue-600',    bg: 'bg-blue-50'    },
  { name: 'Calendar',  path: '/app/calendar',     icon: CalendarDays,color: 'text-amber-600',   bg: 'bg-amber-50'   },
  { name: 'Settings',  path: '/app/settings',     icon: Settings,    color: 'text-gray-600',    bg: 'bg-gray-100'   },
];

const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  const isMoreActive = showMore || MORE_ITEMS.some(i => {
    if (i.path === '/app/home') return false;
    return location.pathname.startsWith(i.path);
  });

  return (
    <>
      {/* ── BOTTOM NAV ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100"
           style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-stretch" style={{ height: 60 }}>
          {PRIMARY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isMore = tab.name === 'More';
            const isActive = isMore
              ? isMoreActive
              : !showMore && (
                  tab.path === '/app/home'
                    ? location.pathname === '/app/home'
                    : location.pathname.startsWith(tab.path as string)
                );

            const content = (
              <>
                <div className={`w-8 h-8 rounded-2xl flex items-center justify-center transition-colors ${
                  isActive ? 'bg-blue-600' : ''
                }`}>
                  <Icon
                    style={{ width: 18, height: 18 }}
                    strokeWidth={isActive ? 2.5 : 1.75}
                    className={isActive ? 'text-white' : 'text-gray-400'}
                  />
                </div>
                <span className={`text-[10px] font-semibold mt-0.5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                  {tab.name}
                </span>
              </>
            );

            return isMore ? (
              <button
                key={tab.name}
                onClick={() => setShowMore(v => !v)}
                className="flex-1 flex flex-col items-center justify-center gap-0 pt-1"
              >
                {content}
              </button>
            ) : (
              <Link
                key={tab.name}
                to={tab.path as string}
                onClick={() => setShowMore(false)}
                className="flex-1 flex flex-col items-center justify-center gap-0 pt-1"
              >
                {content}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── MORE DRAWER ── */}
      {showMore && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setShowMore(false)}
          />
          <div
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl"
            style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            <div className="flex items-center justify-between px-5 pt-2 pb-4">
              <p className="text-[16px] font-bold text-gray-900">More</p>
              <button
                onClick={() => setShowMore(false)}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>

            <div className="px-4 pb-4 grid grid-cols-2 gap-3">
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = item.path !== '/app/home' && location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setShowMore(false)}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-colors ${
                      isActive ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-gray-50/60 hover:bg-gray-100'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isActive ? 'bg-blue-100' : item.bg}`}>
                      <Icon
                        className={isActive ? 'text-blue-600' : item.color}
                        style={{ width: 17, height: 17 }}
                        strokeWidth={1.75}
                      />
                    </div>
                    <span className={`text-[13px] font-semibold ${isActive ? 'text-blue-700' : 'text-gray-800'}`}>
                      {item.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default MobileBottomNav;
