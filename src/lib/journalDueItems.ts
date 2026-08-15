import type { Invoice, Order } from '../types';

export type JournalDueType = 'contract' | 'sample' | 'debit_note' | 'invoice';

export interface JournalDueItem {
  id: string;
  type: JournalDueType;
  title: string;
  subtitle: string;
  route: string;
  label: string;
}

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
  jan: '01', feb: '02', mar: '03', apr: '04', jun: '06', jul: '07', aug: '08',
  sep: '09', oct: '10', nov: '11', dec: '12',
};

export function extractDateFromText(text: string): string | null {
  const s = text.toLowerCase().trim();

  const iso = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slash = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slash) {
    const [, d, m, y] = slash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const named = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})\b/);
  if (named) {
    const [, d, mon, y] = named;
    const m = MONTHS[mon];
    if (m) return `${y}-${m}-${d.padStart(2, '0')}`;
  }

  const monthFirst = s.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/);
  if (monthFirst) {
    const [, mon, d, y] = monthFirst;
    const m = MONTHS[mon];
    if (m) return `${y}-${m}-${d.padStart(2, '0')}`;
  }

  const monthYear = s.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})\b/);
  if (monthYear) {
    const [, mon, y] = monthYear;
    const m = MONTHS[mon];
    if (m) return `${y}-${m}-01`;
  }

  return null;
}

export function extractDateFromSchedule(schedule: string[] | null | undefined): string | null {
  if (!Array.isArray(schedule)) return null;
  for (const line of schedule) {
    if (!line) continue;
    const date = extractDateFromText(line);
    if (date) return date;
  }
  return null;
}

const OPEN_ORDER_STATUSES = new Set(['Issued', 'Inspected', 'Open']);

function isOrderOpen(order: Order): boolean {
  const status = (order.status || '').trim();
  return !status || OPEN_ORDER_STATUSES.has(status) || (!['Completed', 'Cancelled'].includes(status));
}

export function buildJournalDueItems(
  orders: Order[],
  dateKey: string,
  invoices: Invoice[] = [],
): JournalDueItem[] {
  const items: JournalDueItem[] = [];

  for (const order of orders) {
    if (!isOrderOpen(order)) continue;

    if (order.type === 'contract') {
      const date = order.contractData?.delivery_date || extractDateFromSchedule(order.contractData?.delivery_schedule);
      if (date === dateKey) {
        items.push({
          id: `contract-${order.id}`,
          type: 'contract',
          title: order.contractNumber,
          subtitle: order.supplierName || order.contractData?.buyer_name || 'Contract delivery',
          route: `/app/contracts/${order.id}`,
          label: 'Delivery',
        });
      }
    }

    if (order.type === 'sample' && order.sampleData?.due_date === dateKey) {
      items.push({
        id: `sample-${order.id}`,
        type: 'sample',
        title: order.contractNumber,
        subtitle: order.supplierName || order.sampleData?.company_name || 'Letter due',
        route: `/app/samples/${order.id}`,
        label: 'Letter due',
      });
    }

    if (order.type === 'debit_note' && order.debitNoteData?.debit_note_date === dateKey) {
      items.push({
        id: `debit-${order.id}`,
        type: 'debit_note',
        title: order.contractNumber,
        subtitle: order.supplierName || order.debitNoteData?.invoice_no || 'Debit note',
        route: `/app/debit-notes/${order.id}`,
        label: 'Payment',
      });
    }
  }

  for (const invoice of invoices) {
    if (!invoice.delivery_date || invoice.delivery_date !== dateKey) continue;
    const contractNo = invoice.contract_numbers?.[0];
    const linkedContract = contractNo
      ? orders.find(order => order.type === 'contract' && order.contractNumber === contractNo)
      : null;
    items.push({
      id: `invoice-${invoice.id || invoice.invoice_number}`,
      type: 'invoice',
      title: invoice.invoice_number,
      subtitle: contractNo ? `Contract ${contractNo}` : 'Invoice delivery',
      route: linkedContract ? `/app/contracts/${linkedContract.id}` : '/app/contracts',
      label: 'Invoice',
    });
  }

  return items;
}
