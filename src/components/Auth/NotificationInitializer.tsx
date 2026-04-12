"use client";

import React, { useEffect } from 'react';
import { useNotifications } from '../../hooks/useNotifications';

const NotificationInitializer: React.FC = () => {
  const { enableNotifications } = useNotifications();

  useEffect(() => {
    // Attempt to initialize notifications on mount
    // This ensures the service worker and token are ready even if logged out
    if ('Notification' in window && Notification.permission === 'granted') {
      enableNotifications();
    }
  }, [enableNotifications]);

  return null;
};

export default NotificationInitializer;