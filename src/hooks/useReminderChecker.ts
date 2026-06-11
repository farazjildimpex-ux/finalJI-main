import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';

const ICON  = '/icon-192.png';
const BADGE = '/icon-192.png';
const ONE_DAY_MS = 86_400_000;

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function wasAlreadyNotified(tag: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(`jild_notified_${tag}`) === '1';
}

function markNotified(tag: string) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(`jild_notified_${tag}`, '1');
}

async function sendNotification(title: string, body: string, tag: string, url: string) {
  if (wasAlreadyNotified(tag)) return;

  const options: NotificationOptions = {
    body,
    icon:   ICON,
    badge:  BADGE,
    tag,
    renotify: false,
    data: { url },
  };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, options);
    } else {
      new Notification(title, { body, icon: ICON });
    }
    markNotified(tag);
  } catch {
    new Notification(title, { body, icon: ICON });
    markNotified(tag);
  }
}

export function useReminderChecker() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkReminders = async () => {
    if (!user) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const now          = new Date();
    const todayStr     = localDateKey(now);
    const tomorrowStr  = localDateKey(new Date(now.getTime() + ONE_DAY_MS));

    try {
      // ── 1. Journal entry reminders (by time) ─────────────────────────────
      const { data: dueReminders } = await supabase
        .from('journal_entries')
        .select('id, title, content, reminder_date, reminder_time')
        .eq('user_id', user.id)
        .eq('reminder_enabled', true)
        .eq('reminder_sent', false)
        .not('reminder_date', 'is', null)
        .not('reminder_time', 'is', null)
        .lte('reminder_date', todayStr);

      for (const entry of dueReminders || []) {
        const reminderDT = new Date(`${entry.reminder_date}T${entry.reminder_time}`);
        if (reminderDT <= now) {
          const plainBody = (entry.content || '').replace(/<[^>]*>/g, '').slice(0, 120) || 'Tap to open journal entry';
          await sendNotification(
            `Reminder: ${entry.title}`,
            plainBody,
            `reminder-${entry.id}`,
            `/app/home?entry=${entry.id}`
          );
          await supabase
            .from('journal_entries')
            .update({ reminder_sent: true })
            .eq('id', entry.id);
        }
      }

      // ── 2. Contract delivery dates (today + tomorrow) ─────────────────────
      // contracts table has no user_id — RLS handles row-level security
      const { data: deliveryContracts, error: deliveryError } = await supabase
        .from('contracts')
        .select('id, contract_no, buyer_name, delivery_date')
        .not('delivery_date', 'is', null)
        .in('delivery_date', [todayStr, tomorrowStr]);

      if (deliveryError) {
        console.warn('Contract delivery reminder query skipped:', deliveryError.message);
      } else {
        for (const c of deliveryContracts || []) {
          const isToday = c.delivery_date === todayStr;
          await sendNotification(
            isToday ? `Delivery today: ${c.contract_no}` : `Delivery tomorrow: ${c.contract_no}`,
            c.buyer_name ? `Buyer: ${c.buyer_name}` : 'Tap to open contract',
            `contract-${c.id}-${c.delivery_date}`,
            `/app/contracts/${c.id}`
          );
        }
      }

      // ── 3. Invoice delivery dates (today + tomorrow) ────────────────────────
      const { data: deliveryInvoices, error: invoiceDeliveryError } = await supabase
        .from('invoices')
        .select('id, invoice_number, contract_numbers, delivery_date')
        .eq('user_id', user.id)
        .not('delivery_date', 'is', null)
        .in('delivery_date', [todayStr, tomorrowStr]);

      if (invoiceDeliveryError) {
        console.warn('Invoice delivery reminder query skipped:', invoiceDeliveryError.message);
      } else {
        for (const inv of deliveryInvoices || []) {
          const isToday = inv.delivery_date === todayStr;
          const contractNo = inv.contract_numbers?.[0];
          let url = '/app/home';
          if (contractNo) {
            const { data: contractRow } = await supabase
              .from('contracts')
              .select('id')
              .eq('contract_no', contractNo)
              .maybeSingle();
            if (contractRow?.id) url = `/app/contracts/${contractRow.id}`;
          }
          await sendNotification(
            isToday ? `Invoice delivery today: ${inv.invoice_number}` : `Invoice delivery tomorrow: ${inv.invoice_number}`,
            contractNo ? `Contract: ${contractNo}` : 'Tap to open invoice',
            `invoice-${inv.id}-${inv.delivery_date}`,
            url,
          );
        }
      }

      // ── 4. Sample letter due dates (today + tomorrow) ─────────────────────
      const { data: dueSamples, error: sampleError } = await supabase
        .from('samples')
        .select('id, sample_number, supplier_name, due_date')
        .eq('user_id', user.id)
        .not('due_date', 'is', null)
        .in('due_date', [todayStr, tomorrowStr]);

      if (sampleError) {
        console.warn('Sample due reminder query skipped:', sampleError.message);
      } else {
        for (const s of dueSamples || []) {
          const isToday = s.due_date === todayStr;
          await sendNotification(
            isToday ? `Letter due today: ${s.sample_number}` : `Letter due tomorrow: ${s.sample_number}`,
            s.supplier_name ? `Supplier: ${s.supplier_name}` : 'Tap to open letter',
            `sample-${s.id}-${s.due_date}`,
            `/app/samples/${s.id}`
          );
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
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [user?.id]);
}
