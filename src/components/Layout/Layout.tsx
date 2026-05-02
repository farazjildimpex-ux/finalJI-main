"use client";

import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';
import ChangePasswordModal from './ChangePasswordModal';
import CompanyManagementModal from '../Companies/CompanyManagementModal';
import { useReminderChecker } from '../../hooks/useReminderChecker';
import { navigationItems } from '../../data/mockData';
import { Menu } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

const Layout: React.FC = () => {
  useReminderChecker();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  // Derive current page title from nav items
  const currentNav = navigationItems.find(
    (i) => location.pathname === i.path ||
      (i.path !== '/app/home' && location.pathname.startsWith(i.path))
  );
  const pageTitle = currentNav?.name ?? 'Home';

  return (
    <div className="flex h-screen bg-white overflow-hidden pt-safe">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block h-full shrink-0">
        <Sidebar
          onManageCompanies={() => setIsCompanyModalOpen(true)}
          onChangePassword={() => setIsChangePasswordOpen(true)}
        />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside className={`fixed inset-y-0 left-0 w-56 bg-white z-[70] border-r border-gray-100 transform transition-transform duration-250 ease-out md:hidden ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          <div className="h-12 px-4 border-b border-gray-100 flex items-center justify-between">
            <span className="font-black tracking-tighter text-base">
              <span className="text-gray-900">JILD</span> <span className="text-blue-600">IMPEX</span>
            </span>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto py-2 px-2">
            {navigationItems.map((item) => {
              // @ts-ignore
              const Icon = LucideIcons[item.icon.charAt(0).toUpperCase() + item.icon.slice(1)];
              const isActive = location.pathname === item.path ||
                (item.path !== '/app/home' && location.pathname.startsWith(item.path));
              return (
                <button
                  key={item.name}
                  onClick={() => { navigate(item.path); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 mb-0.5
                    ${isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={isActive ? 2.5 : 1.75} />}
                  {item.name}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top header bar */}
        <header className="h-12 shrink-0 bg-white border-b border-gray-100 flex items-center px-4 gap-3">
          {/* Mobile menu button */}
          <button
            className="md:hidden p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </button>
          <h1 className="text-sm font-semibold text-gray-800">{pageTitle}</h1>
        </header>

        <main
          ref={scrollContainerRef}
          className="flex-1 h-full overflow-y-auto overflow-x-hidden bg-gray-50/50"
        >
          <div className="min-h-full pb-24 md:pb-0">
            <Outlet />
          </div>
        </main>

        <MobileBottomNav onOpenMenu={() => setIsMobileMenuOpen(true)} />
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
