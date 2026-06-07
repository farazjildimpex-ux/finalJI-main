"use client";

import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';
import ChangePasswordModal from './ChangePasswordModal';
import CompanyManagementModal from '../Companies/CompanyManagementModal';
import InstallPrompt from '../UI/InstallPrompt';
import { useReminderChecker } from '../../hooks/useReminderChecker';

const Layout: React.FC = () => {
  useReminderChecker();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const location = useLocation();
  const scrollContainerRef = useRef<HTMLElement>(null);

  // Home page uses its own internal split-panel scroll — all other pages scroll normally
  const isHomePage = location.pathname === '/app/home';

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
        {/* Main content: overflow-hidden only on home (split panel handles own scroll);
            all other pages scroll normally via overflow-y-auto */}
        <main
          ref={scrollContainerRef}
          className={`flex-1 overflow-x-hidden bg-gray-50/50 min-h-0 ${
            isHomePage ? 'md:overflow-hidden overflow-y-auto' : 'overflow-y-auto'
          }`}
        >
          <div className={`min-h-full pb-24 md:pb-0 ${isHomePage ? 'md:h-full' : ''}`}>
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
