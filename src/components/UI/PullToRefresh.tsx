"use client";

import React, { useEffect, useRef, useState } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | void;
  /**
   * Distance the user must drag before a release triggers a refresh.
   * Defaults to 110px so casual touches never fire it.
   */
  threshold?: number;
  /**
   * Maximum drag distance (the indicator caps here). Defaults to 160px.
   */
  maxPull?: number;
  /**
   * Minimum drag distance before the indicator becomes visible at all.
   * Filters out small finger jitter. Defaults to 30px.
   */
  activationDistance?: number;
  children: React.ReactNode;
}

/**
 * Mobile pull-to-refresh that is intentionally hard to trigger by accident.
 *
 * Rules for a valid pull:
 *   1. The page MUST be at scrollTop 0 when the finger touches down.
 *   2. NO scroll event may fire during the touch session — if the page
 *      scrolls at all, the gesture is permanently disqualified until the
 *      finger lifts. This kills "swipe up to scroll up" false positives.
 *   3. The very first move must already be a downward drag of at least
 *      `activationDistance` pixels. If the user moved their finger upward
 *      first (i.e. they're trying to scroll down), the gesture is disarmed.
 *   4. Only single-finger touches count.
 *   5. Release must be past `threshold` (110px by default).
 *
 * While refreshing it shows one compact, consistent indicator.
 */
const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  threshold = 150,
  maxPull = 190,
  activationDistance = 55,
  children,
}) => {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // All gesture state lives in refs so listeners stay stable.
  const startY = useRef<number | null>(null);
  const armed = useRef(false);
  const disqualified = useRef(false);
  const movedUpFirst = useRef(false);

  useEffect(() => {
    // Disable the browser's native pull-to-refresh chrome on mobile so our
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

    const reset = () => {
      armed.current = false;
      disqualified.current = false;
      movedUpFirst.current = false;
      startY.current = null;
      setPull(0);
    };

    const onScroll = () => {
      // Any scroll during a touch invalidates the pull permanently for
      // this gesture. This is the key fix: scrolling up to the top will
      // fire scroll events along the way, so even when the touch
      // continues after reaching the top it can't be misread as a pull.
      if (armed.current || startY.current != null) {
        disqualified.current = true;
        if (pull !== 0) setPull(0);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;

      // Multi-touch (pinch, etc.) — never treat as pull.
      if (e.touches.length !== 1) {
        reset();
        return;
      }

      // Must start at the very top and near the top edge to even consider arming.
      if (!atTop() || e.touches[0].clientY > 96) {
        armed.current = false;
        startY.current = null;
        return;
      }

      armed.current = true;
      disqualified.current = false;
      movedUpFirst.current = false;
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (refreshing) return;
      if (!armed.current || disqualified.current || startY.current == null) return;
      if (e.touches.length !== 1) {
        disqualified.current = true;
        setPull(0);
        return;
      }

      const delta = e.touches[0].clientY - startY.current;

      // First detectable motion: if it was upward (negative), the user
      // wants to scroll the content, not pull. Disarm permanently.
      if (delta < -4) {
        movedUpFirst.current = true;
        disqualified.current = true;
        setPull(0);
        return;
      }

      if (delta < activationDistance) {
        // Below the activation threshold — show nothing yet, but don't
        // disarm in case the user is gradually starting their pull.
        if (pull !== 0) setPull(0);
        return;
      }

      // Re-check that we're still at the top. If the page somehow
      // scrolled in the meantime (rare, but possible with nested
      // scrollers), disqualify.
      if (!atTop()) {
        disqualified.current = true;
        setPull(0);
        return;
      }

      // Valid pull. Apply rubber-band resistance and cap at maxPull.
      const adjusted = delta - activationDistance;
      const resisted = Math.min(maxPull, adjusted * 0.55);
      setPull(resisted);

      // Stop the page from also rubber-banding while we drag.
      if (e.cancelable) e.preventDefault();
    };

    const onTouchEnd = async () => {
      if (refreshing) return;

      const triggered =
        armed.current &&
        !disqualified.current &&
        !movedUpFirst.current &&
        pull >= threshold;

      reset();

      if (!triggered) return;

      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setTimeout(() => setRefreshing(false), 350);
      }
    };

    // `passive: false` on touchmove so we can preventDefault during the pull.
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [pull, threshold, maxPull, activationDistance, onRefresh, refreshing]);

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
            {ready ? 'Release to refresh' : 'Keep pulling…'}
          </span>
        </div>
      )}

      {refreshing && (
        <div className="fixed left-0 right-0 top-3 z-[9999] flex items-center justify-center pointer-events-none">
          <div className="rounded-full bg-white px-4 py-2 shadow-lg ring-1 ring-slate-200 flex items-center gap-2">
            <div className="h-4 w-4 rounded-full border-2 border-slate-200 border-b-blue-600 animate-spin" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Refreshing</span>
          </div>
        </div>
      )}

      {children}
    </>
  );
};

export default PullToRefresh;
