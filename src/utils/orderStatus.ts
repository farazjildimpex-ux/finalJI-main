import type { Order } from '../types';
import { supabase } from '../lib/supabaseClient';

export function getAvailableStatuses(orderType: string): string[] {
  return orderType === 'contract'
    ? ['Issued', 'Inspected', 'Completed', 'Cancelled']
    : ['Issued', 'Completed', 'Cancelled'];
}

export async function updateOrderStatus(order: Order, newStatus: string): Promise<void> {
  let error;
  if (order.type === 'contract') {
    ({ error } = await supabase.from('contracts').update({ status: newStatus }).eq('id', order.id));
  } else if (order.type === 'sample') {
    ({ error } = await supabase.from('samples').update({ status: newStatus }).eq('id', order.id));
  } else if (order.type === 'debit_note') {
    ({ error } = await supabase.from('debit_notes').update({ status: newStatus }).eq('id', order.id));
  }
  if (error) throw error;
}

export function orderKey(order: Order): string {
  return `${order.type}-${order.id}`;
}
