import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';

export function useReminderChecker() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkReminders = async () => {
    if (!user) return;
    if (Notification.permission !== 'granted') return;

    try {
      const now = new Date();
      const todayDate = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().slice(0, 5);

      const { data: dueReminders } = await supabase
        .from('journal_entries')
        .select('id, title, content, reminder_date, reminder_time')
        .eq('user_id', user.id)
        .eq('reminder_enabled', true)
        .eq('reminder_sent', false)
        .not('reminder_date', 'is', null)
        .not('reminder_time', 'is', null)
        .lte('reminder_date', todayDate);

      if (!dueReminders || dueReminders.length === 0) return;

      for (const entry of dueReminders) {
        const reminderDateTime = new Date(`${entry.reminder_date}T${entry.reminder_time}`);
        if (reminderDateTime <= now) {
          try {
            const reg = await navigator.serviceWorker.ready;
            await reg.showNotification(`Reminder: ${entry.title}`, {
              body: entry.content || 'Journal reminder',
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: `reminder-${entry.id}`,
            });
          } catch {
            new Notification(`Reminder: ${entry.title}`, {
              body: entry.content || 'Journal reminder',
              icon: '/icon-192.png',
            });
          }

          await supabase
            .from('journal_entries')
            .update({ reminder_sent: true })
            .eq('id', entry.id);
        }
      }
    } catch (err) {
      console.error('Reminder check error:', err);
    }
  };

  useEffect(() => {
    if (!user) return;

    checkReminders();

    intervalRef.current = setInterval(checkReminders, 60_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user]);
}
