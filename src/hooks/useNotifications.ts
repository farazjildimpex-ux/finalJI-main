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

  // Listen for foreground messages — use the SW so the notification is
  // clickable with data (plain new Notification() can't carry data for click nav)
  useEffect(() => {
    const unsub = onForegroundMessage((payload) => {
      console.log('Foreground message received:', payload);
      if (Notification.permission !== 'granted') return;

      const title     = payload.notification?.title || 'JILD IMPEX';
      const body      = payload.notification?.body  || '';
      const entryId   = payload.data?.entryId || '';
      const targetUrl = payload.data?.url || '/app/home';

      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, {
          body,
          icon:               '/icon-192.png',
          badge:              '/icon-192.png',
          tag:                payload.data?.tag || 'jild-foreground',
          data:               { url: targetUrl, entryId },
          requireInteraction: true,
          vibrate:            [200, 100, 200, 100, 200],
          actions: [
            { action: 'open',    title: '📖 Open Entry' },
            { action: 'dismiss', title: 'Dismiss'       },
          ],
        } as NotificationOptions);
      }).catch(() => {
        // SW not ready fallback
        new Notification(title, { body, icon: '/icon-192.png' });
      });
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