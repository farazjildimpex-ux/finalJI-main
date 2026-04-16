"use client";

import React from 'react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-50">
      <style>{`
        @keyframes jiSlideJ {
          0%   { opacity: 0; transform: translateY(28px) scale(0.7) rotate(-6deg); }
          60%  { transform: translateY(-4px) scale(1.06) rotate(1deg); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
        }
        @keyframes jiSlideI {
          0%   { opacity: 0; transform: translateY(28px) scale(0.7) rotate(6deg); }
          60%  { transform: translateY(-4px) scale(1.06) rotate(-1deg); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
        }
        @keyframes jiUnderline {
          from { transform: scaleX(0); opacity: 0; }
          to   { transform: scaleX(1); opacity: 1; }
        }
        .ji-letter-j {
          animation: jiSlideJ 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.05s both;
        }
        .ji-letter-i {
          animation: jiSlideI 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both;
        }
        .ji-underline {
          animation: jiUnderline 0.4s ease-out 0.55s both;
          transform-origin: left;
        }
      `}</style>
      <div className="flex flex-col items-center">
        <div className="flex items-end gap-0.5 mb-3 select-none">
          <span className="ji-letter-j text-8xl font-black leading-none text-[#0f172a]">J</span>
          <span className="ji-letter-i text-8xl font-black leading-none text-[#2563eb]">I</span>
        </div>
        <div className="ji-underline w-16 h-1 rounded-full bg-gradient-to-r from-[#0f172a] to-[#2563eb]" />
      </div>
    </div>
  );
};

export default LoadingScreen;