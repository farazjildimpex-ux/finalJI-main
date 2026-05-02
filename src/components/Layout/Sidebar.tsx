import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { navigationItems } from '../../data/mockData';
import { Building2, Key, LogOut } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface SidebarProps {
  onManageCompanies: () => void;
  onChangePassword: () => void;
}

interface TooltipProps {
  label: string;
  children: React.ReactNode;
}

const Tip: React.FC<TooltipProps> = ({ label, children }) => (
  <div className="relative group/tip flex items-center justify-center">
    {children}
    <div className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg whitespace-nowrap
      opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-[200] shadow-lg">
      {label}
      <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-0 h-0
        border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[5px] border-r-gray-900" />
    </div>
  </div>
);

const Sidebar: React.FC<SidebarProps> = ({ onManageCompanies, onChangePassword }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="bg-white h-full w-44 flex flex-col border-r border-gray-100">
      {/* Nav items */}
      <nav className="flex-1 py-2 px-2 flex flex-col gap-0.5 overflow-y-auto no-scrollbar">
        {navigationItems.map((item) => {
          // @ts-ignore
          const Icon = LucideIcons[item.icon.charAt(0).toUpperCase() + item.icon.slice(1)];
          const isActive = location.pathname === item.path ||
            (item.path !== '/app/home' && location.pathname.startsWith(item.path));

          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150
                ${isActive
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                }`}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={isActive ? 2.5 : 1.75} />}
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="py-2 px-2 flex flex-col gap-0.5 border-t border-gray-100 shrink-0">
        <button
          onClick={onManageCompanies}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-all duration-150"
        >
          <Building2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>Companies</span>
        </button>

        <button
          onClick={onChangePassword}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-all duration-150"
        >
          <Key className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>Password</span>
        </button>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all duration-150 disabled:opacity-40"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>{loggingOut ? 'Logging out…' : 'Logout'}</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
