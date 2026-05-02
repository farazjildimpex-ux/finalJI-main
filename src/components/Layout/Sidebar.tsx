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
    <div className="bg-white h-full w-12 flex flex-col border-r border-gray-100">
      {/* Nav items */}
      <nav className="flex-1 py-2 flex flex-col items-center gap-0.5 overflow-y-auto no-scrollbar">
        {navigationItems.map((item) => {
          // @ts-ignore
          const Icon = LucideIcons[item.icon.charAt(0).toUpperCase() + item.icon.slice(1)];
          const isActive = location.pathname === item.path ||
            (item.path !== '/app/home' && location.pathname.startsWith(item.path));

          return (
            <Tip key={item.name} label={item.name}>
              <Link
                to={item.path}
                className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-150
                  ${isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                  }`}
              >
                {Icon && <Icon className="h-4 w-4" strokeWidth={isActive ? 2.5 : 1.75} />}
              </Link>
            </Tip>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="py-2 flex flex-col items-center gap-0.5 border-t border-gray-100 shrink-0">
        <Tip label="Manage Companies">
          <button
            onClick={onManageCompanies}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all duration-150"
          >
            <Building2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </Tip>

        <Tip label="Change Password">
          <button
            onClick={onChangePassword}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all duration-150"
          >
            <Key className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </Tip>

        <Tip label={loggingOut ? 'Logging out…' : 'Logout'}>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all duration-150 disabled:opacity-40"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </Tip>
      </div>
    </div>
  );
};

export default Sidebar;
