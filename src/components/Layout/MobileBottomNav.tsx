"use client";

import React, { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Users, MoreHorizontal, Zap, Bookmark, CalendarDays, Settings,
  CreditCard, FileText,
  Mail,
} from 'lucide-react';

const PRIMARY_TABS = [
  { name: 'Home',      path: '/app/home',      icon: Home      },
  { name: 'Contacts',  path: '/app/contacts',  icon: Users     },
  { name: 'Lead IQ',   path: '/app/sales',     icon: Zap       },
  { name: 'Calendar',  path: '/app/calendar',   icon: CalendarDays },
  { name: 'More',      path: null,             icon: MoreHorizontal },
] as const;

const CONTROL_CENTER_ITEMS = [
  { name: 'Home',       path: '/app/home',              icon: Home,           color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
  { name: 'Email',      path: '/app/email',             icon: Mail,           color: '#0F766E', bg: 'rgba(15,118,110,0.12)' },
  { name: 'Contacts',   path: '/app/contacts',          icon: Users,          color: '#7C3AED', bg: 'rgba(124,58,237,0.12)' },
  { name: 'Lead IQ',    path: '/app/sales',             icon: Zap,            color: '#EA580C', bg: 'rgba(234,88,12,0.12)' },
  { name: 'Calendar',   path: '/app/calendar',          icon: CalendarDays,   color: '#0891B2', bg: 'rgba(8,145,178,0.12)' },
  { name: 'Contracts',  path: '/app/contracts',         icon: FileText,       color: '#4F46E5', bg: 'rgba(79,70,229,0.12)' },
  { name: 'Letters',    path: '/app/samples',           icon: Bookmark,       color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
  { name: 'Payments',   path: '/app/debit-notes',       icon: CreditCard,     color: '#059669', bg: 'rgba(5,150,105,0.12)' },
  { name: 'Settings',   path: '/app/settings',          icon: Settings,       color: '#64748B', bg: 'rgba(100,116,139,0.12)' },
];

const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);
  const startXRef = useRef<number | null>(null);

  const handlePrimaryNav = (tabName: string) => {
    setShowMore(false);
    if (tabName === 'Home') {
      window.dispatchEvent(new Event('home-journal-reset'));
    }
  };

  const isMoreActive = showMore || CONTROL_CENTER_ITEMS.some(i => {
    if (i.path === '/app/home' || i.path === '/app/email') return location.pathname === i.path;
    return location.pathname.startsWith(i.path);
  });

  return (
    <>
      <nav
        className="md:hidden fixed left-4 right-4 z-50 bg-white/95 backdrop-blur-xl"
        style={{
          bottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
          border: '1px solid rgba(226,232,240,0.95)',
          borderRadius: 24,
          boxShadow: '0 12px 34px rgba(15,23,42,0.16)',
        }}
        onTouchStart={(e) => { const t = e.touches[0]; (startXRef.current as any) = t.clientX; }}
        onTouchEnd={(e) => {
          const startX = startXRef.current as number | null;
          startXRef.current = null;
          if (startX == null) return;
          const dx = e.changedTouches[0].clientX - startX;
          if (Math.abs(dx) < 48) return;
          const direction = dx < 0 ? 1 : -1;
          window.dispatchEvent(new CustomEvent('home-journal-swipe', { detail: { direction } }));
        }}
      >
        <div className="flex items-stretch px-1.5" style={{ height: 58 }}>
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
              <Link key={tab.name} to={tab.path as string} onClick={() => handlePrimaryNav(tab.name)} className="flex-1">
                {inner}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Control Center overlay ── */}
      {showMore && (
        <>
          <div
            className="md:hidden fixed inset-0 z-[60]"
            style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
            onClick={() => setShowMore(false)}
          />

          <div
            className="md:hidden fixed z-[70] left-3 right-3"
            style={{
              bottom: 'calc(78px + env(safe-area-inset-bottom, 0px))',
              animation: 'fadeIn 0.22s ease-out',
            }}
          >
            <div
              className="rounded-[28px] overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.82)',
                backdropFilter: 'blur(40px) saturate(180%)',
                WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.6)',
                boxShadow: '0 24px 64px rgba(15,23,42,0.22), inset 0 1px 0 rgba(255,255,255,0.8)',
              }}
            >
              <div className="px-5 pt-4 pb-2">
                <p className="text-[13px] font-bold text-slate-500 tracking-wide">Quick Access</p>
              </div>

              <div className="px-4 pb-4 grid grid-cols-3 gap-2.5">
                {CONTROL_CENTER_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.path === '/app/home'
                    ? location.pathname === '/app/home'
                    : location.pathname.startsWith(item.path);

                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      onClick={() => setShowMore(false)}
                      className="flex flex-col items-center gap-1.5 py-2 active:scale-95 transition-transform"
                    >
                      <div
                        className="w-[52px] h-[52px] rounded-[18px] flex items-center justify-center transition-all"
                        style={{
                          background: isActive ? item.bg : 'rgba(248,250,252,0.9)',
                          border: isActive ? `1.5px solid ${item.color}33` : '1px solid rgba(226,232,240,0.8)',
                          boxShadow: isActive ? `0 4px 14px ${item.color}22` : '0 2px 8px rgba(15,23,42,0.06)',
                        }}
                      >
                        <Icon
                          style={{ width: 22, height: 22, color: isActive ? item.color : '#64748B' }}
                          strokeWidth={1.75}
                        />
                      </div>
                      <span
                        className="text-[10px] font-semibold text-center leading-tight max-w-[64px] truncate"
                        style={{ color: isActive ? item.color : '#475569' }}
                      >
                        {item.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default MobileBottomNav;
