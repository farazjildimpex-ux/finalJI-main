"use client";

import React, { useEffect, useRef, useState } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | void;
  /**
   * Distance the user must drag before a release triggers a refresh.
   * Defaults to 80px. The indicator becomes "ready" past this point.
   */
  threshold?: number;
  /**
   * Maximum drag distance (the indicator caps here). Defaults to 140px.
   */
  maxPull?: number;
  children: React.ReactNode;
}

/**
 * Mobile-first pull-to-refresh. Listens for touch gestures on the document
 * (so it works regardless of which inner element is scrolled) and only fires
 * when the page is already scrolled to the very top.
 *
 * While refreshing it shows the JILD "JI" splash animation as a full-screen
 * overlay so the action feels like a fresh launch.
 */
const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  threshold = 80,
  maxPull = 140,
  children,
}) => {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const tracking = useRef(false);

  useEffect(() => {
    // Disable native browser pull-to-refresh chrome on mobile so our
    // gesture and animation don't fight it.
    const prev = document.body.style.overscrollBehaviorY;
    document.body.style.overscrollBehaviorY = 'contain';
    return () => {
      document.body.style.overscrollBehaviorY = prev;
    };
  }, []);

  useEffect(() => {
    const atTop = () => {
      const sy =
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;
      return sy <= 0;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      if (!atTop()) {
        tracking.current = false;
        return;
      }
      tracking.current = true;
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking.current || refreshing || startY.current == null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        // user is scrolling up — let the page do its normal thing
        setPull(0);
        return;
      }
      // Resistance: feels rubbery, never exceeds maxPull.
      const resisted = Math.min(maxPull, delta * 0.55);
      setPull(resisted);

      if (delta > 8 && atTop()) {
        // Prevent the page from also scrolling while we drag.
        if (e.cancelable) e.preventDefault();
      }
    };

    const onTouchEnd = async () => {
      if (!tracking.current) return;
      tracking.current = false;
      const triggered = pull >= threshold;
      startY.current = null;

      if (!triggered) {
        setPull(0);
        return;
      }

      setRefreshing(true);
      setPull(0);
      try {
        await onRefresh();
      } finally {
        // Keep the splash visible briefly so the animation feels intentional.
        setTimeout(() => setRefreshing(false), 650);
      }
    };

    // `passive: false` so we can preventDefault during the pull.
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [pull, threshold, maxPull, onRefresh, refreshing]);

  const ready = pull >= threshold;
  const progress = Math.min(1, pull / threshold);

  return (
    <>
      {/* Drag indicator: the small "JI" badge that grows as the user pulls. */}
      {pull > 0 && !refreshing && (
        <div
          className="fixed left-0 right-0 z-[9998] flex items-center justify-center pointer-events-none"
          style={{
            top: 0,
            transform: `translateY(${Math.min(pull, maxPull) - 32}px)`,
            transition: 'none',
          }}
        >
          <div
            className="flex items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-slate-200"
            style={{
              width: 56,
              height: 56,
              transform: `scale(${0.7 + progress * 0.4}) rotate(${progress * 360}deg)`,
              transition: 'transform 60ms linear',
            }}
          >
            <span className="select-none text-2xl font-black leading-none tracking-tight">
              <span className="text-[#0f172a]">J</span>
              <span className="text-[#2563eb]">I</span>
            </span>
          </div>
        </div>
      )}

      {/* Hint text just below the badge. */}
      {pull > 0 && !refreshing && (
        <div
          className="fixed left-0 right-0 z-[9998] flex items-center justify-center pointer-events-none"
          style={{
            top: 0,
            transform: `translateY(${Math.min(pull, maxPull) + 30}px)`,
          }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {ready ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        </div>
      )}

      {/* Full-screen splash while the refresh is running. */}
      {refreshing && <RefreshSplash />}

      {children}
    </>
  );
};

/**
 * The refresh splash mirrors the app's launch loading screen so a pull-to-
 * refresh feels like reopening JILD IMPEX from scratch.
 */
const RefreshSplash: React.FC = () => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-50">
    <style>{`
      @keyframes ptrJ {
        0%   { opacity: 0; transform: translateY(28px) scale(0.7) rotate(-6deg); }
        60%  { transform: translateY(-4px) scale(1.06) rotate(1deg); }
        100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
      }
      @keyframes ptrI {
        0%   { opacity: 0; transform: translateY(28px) scale(0.7) rotate(6deg); }
        60%  { transform: translateY(-4px) scale(1.06) rotate(-1deg); }
        100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
      }
      @keyframes ptrUnderline {
        from { transform: scaleX(0); opacity: 0; }
        to   { transform: scaleX(1); opacity: 1; }
      }
      @keyframes ptrPulse {
        0%, 100% { opacity: 0.9; }
        50%      { opacity: 0.55; }
      }
      .ptr-letter-j { animation: ptrJ 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.05s both; }
      .ptr-letter-i { animation: ptrI 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both; }
      .ptr-underline {
        animation:
          ptrUnderline 0.4s ease-out 0.55s both,
          ptrPulse 1.2s ease-in-out 0.95s infinite;
        transform-origin: left;
      }
    `}</style>
    <div className="flex flex-col items-center">
      <div className="flex items-end gap-0.5 mb-3 select-none">
        <span className="ptr-letter-j text-8xl font-black leading-none text-[#0f172a]">J</span>
        <span className="ptr-letter-i text-8xl font-black leading-none text-[#2563eb]">I</span>
      </div>
      <div className="ptr-underline w-16 h-1 rounded-full bg-gradient-to-r from-[#0f172a] to-[#2563eb]" />
    </div>
  </div>
);

export default PullToRefresh;
