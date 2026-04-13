"use client";

import { useState, useEffect, useCallback } from 'react';
import { requestNotificationPermission, onForegroundMessage } from '../lib/firebase';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';

export type NotificationPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported';

export function useNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermissionStatus>('default');
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as NotificationPermissionStatus);
    
    // Auto-initialize if permission was already granted
    if (Notification.permission === 'granted') {
      enableNotifications();
    }
  }, []);

  // Listen for foreground messages
  useEffect(() => {
    const unsub = onForegroundMessage((payload) => {
      console.log('Foreground message received:', payload);
      const title = payload.notification?.title || 'JILD IMPEX';
      const body = payload.notification?.body || '';
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/icon-192.png' });
      }
    });
    return unsub;
  }, []);

  const enableNotifications = useCallback(async () => {
    setLoading(true);
    try {
      // null  = denied/unsupported; '' = granted but no FCM token; string = full FCM token
      const token = await requestNotificationPermission();

      if (token === null) {
        // Permission denied or browser unsupported
        setPermission(Notification.permission as NotificationPermissionStatus);
        return false;
      }

      // Permission granted (with or without FCM token)
      setPermission('granted');

      if (token) {
        setFcmToken(token);
        if (user) {
          await supabase.from('user_fcm_tokens').upsert(
            { user_id: user.id, token, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
          );
        }
      }
      return true;
    } catch (err) {
      console.error('Error enabling notifications:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  return { permission, fcmToken, loading, enableNotifications };
}