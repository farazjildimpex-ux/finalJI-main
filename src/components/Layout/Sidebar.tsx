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
    <div className="bg-slate-50 h-full w-44 flex flex-col border-r border-slate-200 overflow-hidden">

      {/* Nav items */}
      <nav className="flex-1 pt-4 pb-2 flex flex-col overflow-y-auto no-scrollbar">
        {navigationItems.map((item) => {
          // @ts-ignore
          const Icon = LucideIcons[item.icon.charAt(0).toUpperCase() + item.icon.slice(1)];
          const isActive = location.pathname === item.path ||
            (item.path !== '/app/home' && location.pathname.startsWith(item.path));

          return (
            <div key={item.name} className="relative flex items-center w-full">
              {/* Left accent stripe */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-slate-900 rounded-r" />
              )}
              <Link
                to={item.path}
                onClick={() => {
                  if (item.path === '/app/home') {
                    window.dispatchEvent(new Event('home-journal-reset'));
                  }
                }}
                className={`flex items-center gap-3 w-full py-2.5 px-3 transition-all duration-150 ml-0.5
                  ${isActive
                    ? 'text-slate-900 bg-slate-100'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                  }`}
              >
                {Icon && (
                  <Icon
                    className={`shrink-0 ${isActive ? 'text-slate-900' : 'text-slate-400'}`}
                    style={{ width: 16, height: 16 }}
                    strokeWidth={isActive ? 2 : 1.5}
                  />
                )}
                <span className={`text-[12px] font-medium whitespace-nowrap truncate ${isActive ? 'text-slate-900 font-semibold' : 'text-slate-600'}`}>
                  {item.name}
                </span>
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="py-2 flex flex-col border-t border-slate-200 shrink-0">
        {[
          { label: 'Companies', icon: Building2, onClick: onManageCompanies, danger: false },
          { label: 'Change Password', icon: Key, onClick: onChangePassword, danger: false },
          { label: loggingOut ? 'Logging out…' : 'Logout', icon: LogOut, onClick: handleLogout, danger: true },
        ].map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              onClick={a.onClick}
              disabled={loggingOut && a.label.includes('Logging')}
              className={`flex items-center gap-3 py-2.5 px-3 w-full transition-all duration-150 disabled:opacity-40
                ${a.danger
                  ? 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
            >
              <Icon style={{ width: 15, height: 15, flexShrink: 0 }} strokeWidth={1.5} />
              <span className="text-[12px] font-medium truncate">{a.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Sidebar;
