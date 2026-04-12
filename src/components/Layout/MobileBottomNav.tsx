import { Link, useLocation } from 'react-router-dom';
import { navigationItems } from '../../data/mockData';
import * as LucideIcons from 'lucide-react';

interface MobileBottomNavProps {
  onManageCompanies: () => void;
  onChangePassword: () => void;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onManageCompanies, onChangePassword }) => {
  const location = useLocation();
  
  // Define the specific order for mobile as requested
  const mobileOrder = ['Contacts', 'Contracts', 'Home', 'Letters', 'Payments'];
  
  const mobileNavigationItems = mobileOrder
    .map(name => navigationItems.find(item => item.name === name))
    .filter((item): item is typeof navigationItems[0] => !!item && item.mobile !== false);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 md:hidden shadow-lg pb-safe">
      <div className="flex justify-around items-center py-2 px-1">
        {mobileNavigationItems.map((item) => {
          // @ts-ignore
          const Icon = LucideIcons[item.icon.charAt(0).toUpperCase() + item.icon.slice(1)];
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex flex-col items-center justify-center py-2 px-1 min-w-0 flex-1 transition-all duration-200 relative rounded-lg ${
                isActive ? 'text-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {Icon && (
                <Icon
                  className={`h-5 w-5 mb-1 transition-all duration-200 ${
                    isActive ? 'text-blue-600 scale-110' : 'text-gray-500'
                  }`}
                />
              )}
              <span
                className={`text-[10px] font-bold uppercase tracking-tight transition-colors duration-200 ${
                  isActive ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;