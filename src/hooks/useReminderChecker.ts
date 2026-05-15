import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';

const ICON   = '/icon-192.png';
const BADGE  = '/icon-192.png';

async function sendNotification(title: string, body: string, tag: string, url: string) {
  const options: NotificationOptions = {
    body,
    icon:   ICON,
    badge:  BADGE,
    tag,
    data:   { url },
    silent: false,
  };

  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, options);
  } catch {
    new Notification(title, { body, icon: ICON });
  }
}

export function useReminderChecker() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkReminders = async () => {
    if (!user) return;
    if (Notification.permission !== 'granted') return;

    const now       = new Date();
    const todayDate = now.toISOString().split('T')[0];
    const tomorrowDate = new Date(now.getTime() + 86400000).toISOString().split('T')[0];

    try {
      // ── Journal reminders ─────────────────────────────────────────────────
      const { data: dueReminders } = await supabase
        .from('journal_entries')
        .select('id, title, content, reminder_date, reminder_time')
        .eq('user_id', user.id)
        .eq('reminder_enabled', true)
        .eq('reminder_sent', false)
        .not('reminder_date', 'is', null)
        .not('reminder_time', 'is', null)
        .lte('reminder_date', todayDate);

      for (const entry of dueReminders || []) {
        const reminderDT = new Date(`${entry.reminder_date}T${entry.reminder_time}`);
        if (reminderDT <= now) {
          await sendNotification(
            `Reminder: ${entry.title}`,
            entry.content?.replace(/<[^>]*>/g, '').slice(0, 120) || 'Tap to open journal entry',
            `reminder-${entry.id}`,
            `/app/home?entry=${entry.id}`
          );
          await supabase.from('journal_entries').update({ reminder_sent: true }).eq('id', entry.id);
        }
      }

      // ── Contract delivery dates — notify on delivery day ──────────────────
      const { data: deliveryContracts } = await supabase
        .from('contracts')
        .select('id, contract_no, buyer_name, delivery_date')
        .eq('user_id', user.id)
        .not('delivery_date', 'is', null)
        .or(`delivery_date.eq.${todayDate},delivery_date.eq.${tomorrowDate}`);

      for (const contract of deliveryContracts || []) {
        const isToday = contract.delivery_date === todayDate;
        await sendNotification(
          isToday ? `Delivery today: ${contract.contract_no}` : `Delivery tomorrow: ${contract.contract_no}`,
          contract.buyer_name ? `Buyer: ${contract.buyer_name}` : 'Tap to open contract',
          `contract-delivery-${contract.id}-${contract.delivery_date}`,
          `/app/contracts/${contract.id}`
        );
      }

      // ── Sample due dates — notify on due day ───────────────────────────────
      const { data: dueSamples } = await supabase
        .from('samples')
        .select('id, sample_number, supplier_name, due_date')
        .eq('user_id', user.id)
        .not('due_date', 'is', null)
        .or(`due_date.eq.${todayDate},due_date.eq.${tomorrowDate}`);

      for (const sample of dueSamples || []) {
        const isToday = sample.due_date === todayDate;
        await sendNotification(
          isToday ? `Letter due today: ${sample.sample_number}` : `Letter due tomorrow: ${sample.sample_number}`,
          sample.supplier_name ? `Supplier: ${sample.supplier_name}` : 'Tap to open letter',
          `sample-due-${sample.id}-${sample.due_date}`,
          `/app/samples/${sample.id}`
        );
      }
    } catch (err) {
      console.error('Reminder check error:', err);
    }
  };

  useEffect(() => {
    if (!user) return;
    checkReminders();
    intervalRef.current = setInterval(checkReminders, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [user]);
}
