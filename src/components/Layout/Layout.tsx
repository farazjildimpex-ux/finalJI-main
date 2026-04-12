"use client";

import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileHeader from './MobileHeader';
import ChangePasswordModal from './ChangePasswordModal';
import CompanyManagementModal from '../Companies/CompanyManagementModal';
import { useReminderChecker } from '../../hooks/useReminderChecker';
import { X } from 'lucide-react';

const Layout: React.FC = () => {
  useReminderChecker();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const scrollContainerRef = useRef<HTMLElement>(null);

  // Reset scroll position and close mobile menu on route change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block h-full">
        <Sidebar
          onManageCompanies={() => setIsCompanyModalOpen(true)}
          onChangePassword={() => setIsChangePasswordOpen(true)}
        />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-white z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <span className="font-black text-blue-600 tracking-tighter text-xl">JILD IMPEX</span>
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <Sidebar
              onManageCompanies={() => {
                setIsCompanyModalOpen(true);
                setIsMobileMenuOpen(false);
              }}
              onChangePassword={() => {
                setIsChangePasswordOpen(true);
                setIsMobileMenuOpen(false);
              }}
            />
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <MobileHeader onOpenMenu={() => setIsMobileMenuOpen(true)} />
        
        <main 
          ref={scrollContainerRef}
          className="flex-1 h-full overflow-y-auto overflow-x-hidden scroll-smooth"
        >
          <div className="min-h-full pb-20 md:pb-0">
            <Outlet />
          </div>
        </main>
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