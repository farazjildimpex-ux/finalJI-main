"use client";

import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';
import ChangePasswordModal from './ChangePasswordModal';
import CompanyManagementModal from '../Companies/CompanyManagementModal';
import InstallPrompt from '../UI/InstallPrompt';
import { useReminderChecker } from '../../hooks/useReminderChecker';

function formatHeaderDate() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

const Layout: React.FC = () => {
  useReminderChecker();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const location = useLocation();
  const scrollContainerRef = useRef<HTMLElement>(null);
  const today = formatHeaderDate();

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location.pathname, location.search]);

  return (
    <div className="flex h-screen bg-white overflow-hidden pt-safe">
      {/* Desktop Sidebar — hidden on mobile */}
      <aside className="hidden md:block h-full shrink-0">
        <Sidebar
          onManageCompanies={() => setIsCompanyModalOpen(true)}
          onChangePassword={() => setIsChangePasswordOpen(true)}
        />
      </aside>

      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Desktop top header — hidden on mobile */}
        <header className="hidden md:flex items-center h-14 bg-white border-b border-gray-100 px-5 shrink-0 gap-4">
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[15px] font-black tracking-tight text-gray-900">JILD IMPEX</span>
              <span className="text-[11px] text-gray-400 font-medium">Management Portal</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-px">{today}</p>
          </div>
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
            <Bell className="w-4 h-4" />
          </button>
        </header>

        {/* Main content area — scrolls on mobile, overflow-hidden on desktop (split panels handle own scroll) */}
        <main
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto md:overflow-hidden overflow-x-hidden bg-gray-50/50 min-h-0"
        >
          <div className="min-h-full pb-24 md:pb-0 md:h-full">
            <Outlet />
          </div>
        </main>

        {/* Bottom nav — mobile only */}
        <MobileBottomNav />
      </div>

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
      <CompanyManagementModal
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
        onCompanyUpdated={() => {}}
      />
      <InstallPrompt />
    </div>
  );
};

export default Layout;
