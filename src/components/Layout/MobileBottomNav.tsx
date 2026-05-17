"use client";

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BookOpen, FileText, CreditCard, Users, MoreHorizontal,
  Package, Zap, Bookmark, CalendarDays, Database, X, ChevronRight,
} from 'lucide-react';

const PRIMARY_TABS = [
  { name: 'Journal',   path: '/app/home',       icon: BookOpen   },
  { name: 'Contracts', path: '/app/contracts',   icon: FileText   },
  { name: 'Payments',  path: '/app/debit-notes', icon: CreditCard },
  { name: 'Contacts',  path: '/app/contacts',    icon: Users      },
  { name: 'More',      path: null,               icon: MoreHorizontal },
] as const;

const MORE_ITEMS = [
  { name: 'Letters',   path: '/app/samples',  icon: Bookmark,    badge: null },
  { name: 'Lead IQ',   path: '/app/sales',    icon: Zap,         badge: null },
  { name: 'Calendar',  path: '/app/calendar', icon: CalendarDays,badge: null },
  { name: 'Settings',  path: '/app/settings', icon: Database,    badge: null },
];

const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  const isMoreActive = showMore || MORE_ITEMS.some(i => location.pathname.startsWith(i.path));

  return (
    <>
      {/* ── BOTTOM NAV ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 pb-safe">
        <div className="flex items-stretch" style={{ height: 56 }}>
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

            return (
              <button
                key={tab.name}
                onClick={() => {
                  if (isMore) {
                    setShowMore(v => !v);
                  } else {
                    setShowMore(false);
                  }
                }}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 relative"
                {...(!isMore && tab.path ? { as: Link, to: tab.path } : {})}
              >
                {/* Active top-line pill */}
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-blue-600 rounded-b-full" />
                )}

                {isMore ? (
                  /* More button — no Link wrapper */
                  <>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isActive ? 'bg-blue-50' : ''}`}>
                      <Icon
                        style={{ width: 18, height: 18 }}
                        strokeWidth={isActive ? 2.5 : 1.75}
                        className={isActive ? 'text-blue-600' : 'text-gray-400'}
                      />
                    </div>
                    <span className={`text-[10px] font-semibold ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                      {tab.name}
                    </span>
                  </>
                ) : (
                  /* Regular nav link */
                  <Link
                    to={tab.path as string}
                    className="flex flex-col items-center justify-center gap-0.5 w-full h-full"
                    onClick={() => setShowMore(false)}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isActive ? 'bg-blue-50' : ''}`}>
                      <Icon
                        style={{ width: 18, height: 18 }}
                        strokeWidth={isActive ? 2.5 : 1.75}
                        className={isActive ? 'text-blue-600' : 'text-gray-400'}
                      />
                    </div>
                    <span className={`text-[10px] font-semibold ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                      {tab.name}
                    </span>
                  </Link>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── MORE DRAWER ── */}
      {showMore && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/25"
            onClick={() => setShowMore(false)}
          />

          {/* Sheet */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl"
               style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            <div className="flex items-center justify-between px-5 pt-2 pb-3">
              <p className="text-[15px] font-bold text-gray-900">More</p>
              <button
                onClick={() => setShowMore(false)}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>

            <div className="px-4 pb-4 space-y-1">
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setShowMore(false)}
                    className={`flex items-center gap-3 px-3 py-3.5 rounded-xl transition-colors ${isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      <Icon
                        className={isActive ? 'text-blue-600' : 'text-gray-600'}
                        style={{ width: 16, height: 16 }}
                        strokeWidth={isActive ? 2.5 : 1.75}
                      />
                    </div>
                    <span className={`flex-1 text-[14px] font-medium text-left ${isActive ? 'text-blue-700' : 'text-gray-800'}`}>
                      {item.name}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
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
