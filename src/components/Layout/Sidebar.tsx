import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { navigationItems } from '../../data/mockData';
import { Building2, Key, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface SidebarProps {
  onManageCompanies: () => void;
  onChangePassword: () => void;
}

const COLLAPSED_KEY = 'jild_sidebar_collapsed';

function loadCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSED_KEY) === 'true'; } catch { return false; }
}
function saveCollapsed(v: boolean) {
  try { localStorage.setItem(COLLAPSED_KEY, String(v)); } catch {}
}

const Sidebar: React.FC<SidebarProps> = ({ onManageCompanies, onChangePassword }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [collapsed, setCollapsed] = useState(loadCollapsed);

  const toggle = () => {
    setCollapsed(v => {
      saveCollapsed(!v);
      return !v;
    });
  };

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

  const w = collapsed ? 'w-12' : 'w-44';

  return (
    <div className={`bg-white h-full ${w} flex flex-col border-r border-gray-100 transition-all duration-200 overflow-hidden`}>

      {/* Logo mark */}
      <div className={`flex items-center border-b border-gray-100 shrink-0 h-14 ${collapsed ? 'justify-center px-0' : 'px-3 gap-2.5'}`}>
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shrink-0">
          <span className="text-white text-[10px] font-black">JI</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[11px] font-black text-gray-900 leading-tight truncate">JILD IMPEX</p>
            <p className="text-[9px] text-gray-400 leading-tight truncate">Management Portal</p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-2 flex flex-col overflow-y-auto no-scrollbar">
        {navigationItems.map((item) => {
          // @ts-ignore
          const Icon = LucideIcons[item.icon.charAt(0).toUpperCase() + item.icon.slice(1)];
          const isActive = location.pathname === item.path ||
            (item.path !== '/app/home' && location.pathname.startsWith(item.path));

          return (
            <div key={item.name} className="relative flex items-center w-full">
              {/* Left accent stripe */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-600 rounded-r-full z-10" />
              )}
              <Link
                to={item.path}
                title={collapsed ? item.name : undefined}
                className={`flex items-center gap-2.5 w-full py-2.5 transition-all duration-150
                  ${collapsed ? 'justify-center px-0' : 'px-3'}
                  ${isActive
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'
                  }`}
              >
                {Icon && (
                  <Icon
                    className="shrink-0"
                    style={{ width: 15, height: 15 }}
                    strokeWidth={isActive ? 2.5 : 1.75}
                  />
                )}
                {!collapsed && (
                  <span className={`text-[12px] font-semibold whitespace-nowrap truncate ${isActive ? 'text-blue-700' : ''}`}>
                    {item.name}
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className={`py-2 flex flex-col border-t border-gray-100 shrink-0 ${collapsed ? 'items-center' : ''}`}>
        {[
          { label: 'Manage Companies', icon: Building2, onClick: onManageCompanies, danger: false },
          { label: 'Change Password',  icon: Key,       onClick: onChangePassword,  danger: false },
          { label: loggingOut ? 'Logging out…' : 'Logout', icon: LogOut, onClick: handleLogout, danger: true },
        ].map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              onClick={a.onClick}
              disabled={a.label.includes('Logging')}
              title={collapsed ? a.label : undefined}
              className={`flex items-center gap-2.5 py-2.5 w-full transition-all duration-150 disabled:opacity-40
                ${collapsed ? 'justify-center px-0' : 'px-3'}
                ${a.danger
                  ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
                }`}
            >
              <Icon style={{ width: 14, height: 14, flexShrink: 0 }} strokeWidth={1.75} />
              {!collapsed && <span className="text-[12px] font-medium truncate">{a.label}</span>}
            </button>
          );
        })}

        {/* Collapse toggle */}
        <button
          onClick={toggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`flex items-center gap-2 py-2 w-full text-gray-300 hover:text-gray-500 transition-colors
            ${collapsed ? 'justify-center px-0' : 'px-3'}`}
        >
          {collapsed
            ? <ChevronRight style={{ width: 13, height: 13 }} />
            : (
              <>
                <ChevronLeft style={{ width: 13, height: 13 }} />
                <span className="text-[11px] font-medium">Collapse</span>
              </>
            )
          }
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
