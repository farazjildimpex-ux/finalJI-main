"use client";

import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';
import ChangePasswordModal from './ChangePasswordModal';
import CompanyManagementModal from '../Companies/CompanyManagementModal';
import { useReminderChecker } from '../../hooks/useReminderChecker';

const Layout: React.FC = () => {
  useReminderChecker();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const location = useLocation();
  const scrollContainerRef = useRef<HTMLElement>(null);

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
        <main
          ref={scrollContainerRef}
          className="flex-1 h-full overflow-y-auto overflow-x-hidden bg-gray-50/50"
        >
          <div className="min-h-full pb-24 md:pb-0">
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
    </div>
  );
};

export default Layout;
