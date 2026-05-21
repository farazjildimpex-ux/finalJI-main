"use client";

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Users, MoreHorizontal,
  Zap, Bookmark, CalendarDays, Settings, CreditCard, X, FileText,
} from 'lucide-react';

const PRIMARY_TABS = [
  { name: 'Home',      path: '/app/home',      icon: Home      },
  { name: 'Contacts',  path: '/app/contacts',  icon: Users     },
  { name: 'Lead IQ',   path: '/app/sales',     icon: Zap       },
  { name: 'Calendar',  path: '/app/calendar',   icon: CalendarDays },
  { name: 'More',      path: null,             icon: MoreHorizontal },
] as const;

const MORE_ITEMS = [
  { name: 'Contracts', path: '/app/contracts',    icon: FileText,    color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { name: 'Payments', path: '/app/debit-notes', icon: CreditCard,  color: 'text-emerald-600',bg: 'bg-emerald-50' },
  { name: 'Letters',  path: '/app/samples',     icon: Bookmark,    color: 'text-blue-600',   bg: 'bg-blue-50'    },
  { name: 'Settings', path: '/app/settings',    icon: Settings,    color: 'text-gray-600',   bg: 'bg-gray-100'   },
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
      {/* ── BOTTOM NAV BAR ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white"
        style={{
          borderTop: '1px solid #EEF2F6',
          boxShadow: '0 -2px 12px rgba(15,23,42,0.03)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex items-stretch" style={{ height: 52 }}>
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

            const inner = (
              <div className="flex flex-col items-center justify-center gap-0.5 w-full h-full">
                <Icon
                  style={{ width: 20, height: 20, color: isActive ? '#2563FF' : '#9CA3AF' }}
                  strokeWidth={isActive ? 2.5 : 1.75}
                />
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: isActive ? '#2563FF' : '#9CA3AF',
                  fontFamily: 'Inter, sans-serif',
                }}>
                  {tab.name}
                </span>
              </div>
            );

            return isMore ? (
              <button key={tab.name} onClick={() => setShowMore(v => !v)} className="flex-1">
                {inner}
              </button>
            ) : (
              <Link key={tab.name} to={tab.path as string} onClick={() => setShowMore(false)} className="flex-1">
                {inner}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── MORE DRAWER ── */}
      {showMore && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/20"
            onClick={() => setShowMore(false)}
          />
          <div
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white"
            style={{
              borderRadius: '28px 28px 0 0',
              boxShadow: '0 -8px 32px rgba(15,23,42,0.10)',
              paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
            }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: '#E9EEF5' }} />
            </div>
            <div className="flex items-center justify-between px-6 pt-2 pb-4">
              <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', fontFamily: 'Inter, sans-serif' }}>More</p>
              <button
                onClick={() => setShowMore(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: '#F1F5F9' }}
              >
                <X style={{ width: 15, height: 15, color: '#667085' }} />
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
                    className="flex items-center gap-3 px-4 py-3.5 active:opacity-80"
                    style={{
                      borderRadius: 20,
                      border: isActive ? '1px solid #BFDBFE' : '1px solid #E9EEF5',
                      background: isActive ? '#EEF4FF' : '#F8FAFC',
                    }}
                  >
                    <div
                      className="flex items-center justify-center shrink-0"
                      style={{
                        width: 36, height: 36, borderRadius: 12,
                        background: isActive ? '#DBEAFE' : 'white',
                        border: '1px solid #E9EEF5',
                      }}
                    >
                      <Icon
                        style={{ width: 16, height: 16, color: isActive ? '#2563FF' : '#667085' }}
                        strokeWidth={1.75}
                      />
                    </div>
                    <span style={{
                      fontSize: 13, fontWeight: 600,
                      color: isActive ? '#2563FF' : '#0F172A',
                      fontFamily: 'Inter, sans-serif',
                    }}>
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
