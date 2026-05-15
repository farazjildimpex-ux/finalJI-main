"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, FileText, Bookmark, CreditCard, Database, Zap, CalendarDays, GripHorizontal } from 'lucide-react';

const ALL_ITEMS = [
  { name: 'Home',      path: '/app/home',       icon: Home },
  { name: 'Contacts',  path: '/app/contacts',    icon: Users },
  { name: 'Lead IQ',   path: '/app/sales',       icon: Zap },
  { name: 'Contracts', path: '/app/contracts',   icon: FileText },
  { name: 'Letters',   path: '/app/samples',     icon: Bookmark },
  { name: 'Payments',  path: '/app/debit-notes', icon: CreditCard },
  { name: 'Calendar',  path: '/app/calendar',    icon: CalendarDays },
  { name: 'Settings',  path: '/app/settings',    icon: Database },
];

const STORAGE_KEY = 'jild_nav_order';

function loadOrder(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed: string[] = JSON.parse(saved);
      // Validate — ensure all saved names exist
      if (parsed.every(n => ALL_ITEMS.some(i => i.name === n))) return parsed;
    }
  } catch {}
  return ALL_ITEMS.map(i => i.name);
}

function saveOrder(order: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(order)); } catch {}
}

const MobileBottomNav: React.FC = () => {
  const location   = useLocation();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartX = useRef(0);
  const dragStartIndex = useRef(-1);
  const dragCurrentIndex = useRef(-1);
  const isDragging = useRef(false);

  const [order, setOrder]           = useState<string[]>(loadOrder);
  const [editMode, setEditMode]     = useState(false);
  const [dragIndex, setDragIndex]   = useState<number | null>(null);
  const [overIndex, setOverIndex]   = useState<number | null>(null);

  const navItems = order
    .map(name => ALL_ITEMS.find(i => i.name === name))
    .filter(Boolean) as typeof ALL_ITEMS;

  const activeIndex = navItems.findIndex(i => location.pathname.startsWith(i.path));

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || activeIndex < 0 || editMode) return;
    const target = el.children[activeIndex] as HTMLElement | undefined;
    if (target) target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeIndex, editMode]);

  // Exit edit mode when navigating
  useEffect(() => { setEditMode(false); }, [location.pathname]);

  const vibrate = (pattern: number | number[]) => {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
  };

  const exitEditMode = useCallback(() => {
    setEditMode(false);
    setDragIndex(null);
    setOverIndex(null);
    isDragging.current = false;
  }, []);

  // ── Long press detection ──────────────────────────────────────────────────
  const handleItemTouchStart = (e: React.TouchEvent, index: number) => {
    if (editMode) return; // Already in edit mode — handle drag instead
    dragStartX.current = e.touches[0].clientX;
    longPressTimer.current = setTimeout(() => {
      vibrate([40, 30, 40]);
      setEditMode(true);
      setDragIndex(index);
      dragStartIndex.current = index;
      dragCurrentIndex.current = index;
      isDragging.current = true;
    }, 500);
  };

  const handleItemTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleItemTouchMove = (e: React.TouchEvent) => {
    if (longPressTimer.current) {
      // Cancel long press if finger moves too much
      const dx = Math.abs(e.touches[0].clientX - dragStartX.current);
      if (dx > 8) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  };

  // ── Drag reorder (in edit mode) ───────────────────────────────────────────
  const handleDragTouchStart = (e: React.TouchEvent, index: number) => {
    if (!editMode) return;
    e.preventDefault();
    isDragging.current = true;
    dragStartIndex.current = index;
    dragCurrentIndex.current = index;
    setDragIndex(index);
    vibrate(20);
  };

  const handleDragTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || dragIndex === null) return;
    e.preventDefault();
    const el = scrollerRef.current;
    if (!el) return;
    const x = e.touches[0].clientX;
    const rect = el.getBoundingClientRect();
    const itemW = rect.width / Math.min(navItems.length, 5);
    const scrollLeft = el.scrollLeft;
    const relX = x - rect.left + scrollLeft;
    const newIndex = Math.max(0, Math.min(navItems.length - 1, Math.floor(relX / itemW)));
    if (newIndex !== dragCurrentIndex.current) {
      dragCurrentIndex.current = newIndex;
      setOverIndex(newIndex);
      vibrate(8);
    }
  }, [dragIndex, navItems.length]);

  const handleDragTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const from = dragStartIndex.current;
    const to = dragCurrentIndex.current ?? from;
    if (from !== to && from >= 0 && to >= 0) {
      setOrder(prev => {
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        saveOrder(next);
        vibrate([20, 10, 20]);
        return next;
      });
    }
    setDragIndex(null);
    setOverIndex(null);
    dragStartIndex.current = -1;
    dragCurrentIndex.current = -1;
  }, []);

  return (
    <>
      {/* Overlay when in edit mode */}
      {editMode && (
        <div className="fixed inset-0 z-40 bg-black/20" onClick={exitEditMode} />
      )}

      <nav className={`fixed bottom-0 left-0 right-0 z-50 md:hidden pb-safe transition-all duration-200 ${editMode ? 'bg-white/95 backdrop-blur-md border-t-2 border-blue-200 shadow-2xl' : 'bg-white border-t border-gray-100'}`}>

        {/* Edit mode header */}
        {editMode && (
          <div className="flex items-center justify-between px-4 pt-2 pb-1">
            <div className="flex items-center gap-1.5">
              <GripHorizontal className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-bold text-blue-600 tracking-wide">DRAG TO REARRANGE</span>
            </div>
            <button
              type="button"
              onClick={exitEditMode}
              className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg"
            >Done</button>
          </div>
        )}

        <div
          ref={scrollerRef}
          className="flex items-stretch overflow-x-auto overflow-y-hidden no-scrollbar"
          style={{ scrollbarWidth: 'none', height: editMode ? 60 : 56 }}
          onTouchMove={editMode ? handleDragTouchMove as any : undefined}
          onTouchEnd={editMode ? handleDragTouchEnd : undefined}
        >
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = !editMode && location.pathname.startsWith(item.path);
            const isDraggingThis = dragIndex === index;
            const isOver = overIndex === index && !isDraggingThis;

            return editMode ? (
              /* ── Edit mode item ── */
              <div
                key={item.name}
                className={`relative flex flex-col items-center justify-center flex-shrink-0 h-full gap-0.5 cursor-grab select-none transition-all duration-150
                  ${isDraggingThis ? 'scale-110 opacity-80 z-10 bg-blue-50 rounded-xl' : 'opacity-90'}
                  ${isOver ? 'bg-blue-50/60' : ''}
                `}
                style={{ width: 'calc(100vw / 5)', minWidth: 52 }}
                onTouchStart={e => handleDragTouchStart(e, index)}
              >
                <div className={`absolute inset-x-1 inset-y-1 rounded-xl border-2 transition-colors ${isDraggingThis ? 'border-blue-400' : 'border-transparent'}`} />
                {/* Wiggle animation */}
                <div className="flex flex-col items-center gap-0.5 animate-[wiggle_0.3s_ease-in-out_infinite]">
                  <Icon className="text-gray-500" style={{ width: 18, height: 18 }} strokeWidth={1.75} />
                  <span className="text-[9px] font-semibold text-gray-500 tracking-tight">{item.name}</span>
                </div>
              </div>
            ) : (
              /* ── Normal item ── */
              <Link
                key={item.name}
                to={item.path}
                className="relative flex flex-col items-center justify-center flex-shrink-0 h-full gap-0.5"
                style={{ width: 'calc(100vw / 5)', minWidth: 52 }}
                onTouchStart={e => handleItemTouchStart(e, index)}
                onTouchEnd={handleItemTouchEnd}
                onTouchMove={handleItemTouchMove}
              >
                <Icon
                  className={`transition-colors duration-200 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
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

      {/* Wiggle keyframe */}
      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(-2deg); }
          50%       { transform: rotate(2deg); }
        }
      `}</style>
    </>
  );
};

export default MobileBottomNav;
