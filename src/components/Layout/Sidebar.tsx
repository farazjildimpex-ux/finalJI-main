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
    <div className="bg-white text-gray-700 h-full w-56 flex flex-col shadow-lg transition-all duration-300">
      <nav className="flex-1 py-3 px-3 overflow-y-auto">
        <ul className="space-y-1">
          {navigationItems.map((item) => {
            // @ts-ignore
            const Icon = LucideIcons[item.icon.charAt(0).toUpperCase() + item.icon.slice(1)];
            const isActive = location.pathname === item.path;

            return (
              <li key={item.name}>
                <Link
                  to={item.path}
                  className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {Icon && <Icon className="mr-3 h-5 w-5" />}
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-3 border-t border-gray-200 space-y-2">
        <button
          onClick={onManageCompanies}
          className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-all duration-200"
        >
          <Building2 className="mr-3 h-5 w-5" />
          <span>Manage Companies</span>
        </button>

        <button
          onClick={onChangePassword}
          className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-all duration-200"
        >
          <Key className="mr-3 h-5 w-5" />
          <span>Change Password</span>
        </button>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-all duration-200 disabled:opacity-50"
        >
          <LogOut className="mr-3 h-5 w-5" />
          <span>{loggingOut ? 'Logging out...' : 'Logout'}</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;