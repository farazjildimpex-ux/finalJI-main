import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import ChangePasswordModal from './ChangePasswordModal';
import CompanyManagementModal from '../Companies/CompanyManagementModal';
import { useReminderChecker } from '../../hooks/useReminderChecker';

const Layout: React.FC = () => {
  useReminderChecker();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const location = useLocation();
  const scrollContainerRef = useRef<HTMLElement>(null);

  // Reset scroll position of the main container on every route change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location.pathname, location.search]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <aside className="hidden md:block h-full">
        <Sidebar
          onManageCompanies={() => setIsCompanyModalOpen(true)}
          onChangePassword={() => setIsChangePasswordOpen(true)}
        />
      </aside>

      <main 
        ref={scrollContainerRef}
        className="flex-1 h-full overflow-y-auto overflow-x-hidden scroll-smooth"
      >
        <div className="min-h-full">
          <Outlet />
        </div>
      </main>

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