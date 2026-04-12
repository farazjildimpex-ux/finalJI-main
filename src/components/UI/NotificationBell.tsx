import React, { useState } from 'react';
import { Bell, BellOff, BellRing, X } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';

const NotificationBell: React.FC = () => {
  const { permission, loading, enableNotifications } = useNotifications();
  const [showBanner, setShowBanner] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);

  const handleClick = async () => {
    if (permission === 'granted') {
      setShowBanner(true);
      return;
    }
    if (permission === 'denied') {
      setShowBanner(true);
      return;
    }
    if (permission === 'unsupported') return;
    const ok = await enableNotifications();
    if (ok) setJustEnabled(true);
    setShowBanner(true);
  };

  if (permission === 'unsupported') return null;

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        title={permission === 'granted' ? 'Notifications enabled' : 'Enable notifications'}
        className={`relative p-2 rounded-xl transition-all ${
          permission === 'granted'
            ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
            : permission === 'denied'
            ? 'text-gray-400 hover:bg-gray-100'
            : 'text-gray-500 hover:bg-gray-100'
        }`}
      >
        {permission === 'granted' ? (
          <BellRing className="h-5 w-5" />
        ) : permission === 'denied' ? (
          <BellOff className="h-5 w-5" />
        ) : (
          <Bell className="h-5 w-5" />
        )}
        {permission === 'granted' && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-blue-500 rounded-full" />
        )}
      </button>

      {showBanner && (
        <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-80 z-[200] bg-white rounded-2xl shadow-2xl border border-gray-100 p-4">
          <button
            onClick={() => setShowBanner(false)}
            className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
          {permission === 'granted' ? (
            <div className="flex items-start gap-3">
              <BellRing className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {justEnabled ? 'Notifications enabled!' : 'Push notifications are on'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  You'll receive reminders for journal entries and other alerts.
                </p>
              </div>
            </div>
          ) : permission === 'denied' ? (
            <div className="flex items-start gap-3">
              <BellOff className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-gray-900">Notifications blocked</p>
                <p className="text-xs text-gray-500 mt-1">
                  To enable, go to your browser settings → Site Settings → Notifications → Allow for this site.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <Bell className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-gray-900">Enable notifications?</p>
                <p className="text-xs text-gray-500 mt-1">Get reminders for journal entries and important alerts.</p>
                <button
                  onClick={async () => { await enableNotifications(); setShowBanner(false); }}
                  className="mt-2 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Enable Now
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default NotificationBell;
