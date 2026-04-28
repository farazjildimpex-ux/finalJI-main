import { supabase } from './supabaseClient';
import type { Invoice, Contract } from '../types';

export interface EmailData {
  subject: string;
  from: string;
  date: string;
  body: string;
  attachments: { name: string; text: string; type: string }[];
}

export interface ExtractedInvoice {
  invoice_number: string;
  invoice_date: string | null;
  contract_numbers: string[];
  line_items: { color: string; selection: string; quantity: string }[];
  invoice_value: string;
  bill_type: 'Airway Bill' | 'Bill of Lading' | '';
  bill_number: string;
  shipping_date: string | null;
  notes: string;
}

export interface SyncResult {
  invoice_number: string;
  contract_numbers: string[];
  action: 'created' | 'updated' | 'skipped';
  reason?: string;
  invoice: ExtractedInvoice;
}

export async function fetchGmailEmails(): Promise<{ emails: EmailData[]; total: number }> {
  const resp = await fetch('/api/gmail/emails');
  if (!resp.ok) {
    let errMsg = 'Failed to fetch emails from Gmail';
    try {
      const err = await resp.json();
      errMsg = err.error || errMsg;
    } catch {}
    throw new Error(errMsg);
  }
  return resp.json();
}

export async function analyzeEmailsWithAI(
  emails: EmailData[],
  contracts: Contract[],
  openRouterKey: string
): Promise<ExtractedInvoice[]> {
  const contractsContext = contracts.map((c) => ({
    contract_no: c.contract_no,
    buyer_name: c.buyer_name,
    supplier_name: c.supplier_name,
    color: c.color,
    selection: c.selection,
    currency: c.currency,
    description: c.description,
    article: c.article,
  }));

  const emailsText = emails
    .map(
      (e, i) =>
        `=== EMAIL ${i + 1} ===
Subject: ${e.subject}
From: ${e.from}
Date: ${e.date}
Body:
${e.body}
${
  e.attachments.length > 0
    ? e.attachments
        .map((a) => `--- Attachment: ${a.name} ---\n${a.text}`)
        .join('\n')
    : ''
}`
    )
    .join('\n\n');

  const knownContracts = contractsContext.map(c => c.contract_no).join(', ') || 'none yet';

  const prompt = `You are a data extraction assistant for JILD IMPEX, a leather import/export company in Chennai, India.

YOUR JOB: Read the email bodies and PDF attachment text below. Extract every invoice you find. ALWAYS extract an invoice if you see any invoice number, regardless of whether a contract number matches our system.

KNOWN CONTRACT NUMBERS IN OUR SYSTEM (for reference only — do not skip invoices if they don't match):
${knownContracts}

EMAILS AND ATTACHMENTS TO ANALYZE:
${emailsText}

EXTRACTION RULES:
1. ALWAYS extract an invoice if you can find any invoice number (INV, Invoice No, Commercial Invoice, etc.).
2. contract_numbers: Look for any contract/order/PO number mentioned alongside the invoice. It may appear as "Contract No", "CJV", "Order No", "PO No", etc. Extract whatever is written — even if it's not in our system list.
3. line_items: Extract leather colors/shades with their grades and square footage. "Selection" or grade can be anything: TR, TRR, First, Second, AB, BC, A/B, etc. — extract exactly as written.
4. Quantities: May be in sqft, sq.ft, square feet, pieces, pcs, nos — extract the number AND note the unit in the quantity field (e.g. "10848.70 sqft" or "1666 pcs").
5. invoice_value: Extract the total amount as a number string. No currency symbols.
6. bill_type: "Airway Bill" if you see AWB/Airway Bill, "Bill of Lading" if you see B/L or Bill of Lading, "" if neither.
7. Dates: Convert to YYYY-MM-DD format. If only month/year, use the 1st of that month.
8. If no invoice is found at all, return an empty invoices array.

Return ONLY valid JSON (no markdown, no explanation, no code blocks):
{
  "invoices": [
    {
      "invoice_number": "exact invoice number as written",
      "invoice_date": "YYYY-MM-DD or null",
      "contract_numbers": ["contract/order numbers found — can be anything"],
      "line_items": [{"color": "color name", "selection": "grade/type as written", "quantity": "number and unit"}],
      "invoice_value": "numeric amount only",
      "bill_type": "Airway Bill" or "Bill of Lading" or "",
      "bill_number": "AWB or B/L number",
      "shipping_date": "YYYY-MM-DD or null",
      "notes": "any other relevant info"
    }
  ]
}`;

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openRouterKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'JILD IMPEX Email Sync',
    },
    body: JSON.stringify({
      model: localStorage.getItem('jild_openrouter_model') || 'openai/gpt-oss-20b:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    }),
  });

  if (!resp.ok) {
    let errMsg = 'AI analysis failed';
    try {
      const err = await resp.json();
      errMsg = err.error?.message || err.error?.code || errMsg;
    } catch {}
    throw new Error(`AI error: ${errMsg}. Check that your OpenRouter key is correct and has been saved.`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';

  let parsed: { invoices: ExtractedInvoice[] };
  try {
    const jsonStr = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('AI returned invalid JSON. Try again.');
  }

  return parsed.invoices || [];
}

export async function upsertInvoices(
  extractedInvoices: ExtractedInvoice[],
  userId: string
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (const inv of extractedInvoices) {
    if (!inv.invoice_number?.trim()) {
      results.push({
        invoice_number: '(unknown)',
        contract_numbers: inv.contract_numbers,
        action: 'skipped',
        reason: 'No invoice number found',
        invoice: inv,
      });
      continue;
    }

    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('invoices')
        .select('id, invoice_number')
        .eq('invoice_number', inv.invoice_number.trim())
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      const payload: Partial<Invoice> & { user_id: string } = {
        user_id: userId,
        invoice_number: inv.invoice_number.trim(),
        invoice_date: inv.invoice_date || null,
        contract_numbers: (inv.contract_numbers || []).filter((c) => c.trim()),
        line_items: (inv.line_items || []).filter(
          (i) => i.color || i.selection || i.quantity
        ),
        invoice_value: inv.invoice_value || '',
        bill_type: (inv.bill_type as Invoice['bill_type']) || '',
        bill_number: inv.bill_number || '',
        shipping_date: inv.shipping_date || null,
        notes: inv.notes || '',
        price_adjustment: '',
      };

      if (existing?.id) {
        const { error: updateErr } = await supabase
          .from('invoices')
          .update(payload)
          .eq('id', existing.id);
        if (updateErr) throw updateErr;
        results.push({
          invoice_number: inv.invoice_number,
          contract_numbers: inv.contract_numbers,
          action: 'updated',
          invoice: inv,
        });
      } else {
        const { error: insertErr } = await supabase.from('invoices').insert([payload]);
        if (insertErr) throw insertErr;
        results.push({
          invoice_number: inv.invoice_number,
          contract_numbers: inv.contract_numbers,
          action: 'created',
          invoice: inv,
        });
      }
    } catch (err: any) {
      results.push({
        invoice_number: inv.invoice_number,
        contract_numbers: inv.contract_numbers,
        action: 'skipped',
        reason: err?.message || 'Database error',
        invoice: inv,
      });
    }
  }

  return results;
}

export async function runEmailSync(openRouterKey: string): Promise<SyncResult[]> {
  const { emails } = await fetchGmailEmails();
  if (emails.length === 0) return [];

  const { data: contracts } = await supabase.from('contracts').select('*');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in.');

  const extracted = await analyzeEmailsWithAI(emails, contracts || [], openRouterKey);
  if (extracted.length === 0) return [];

  return upsertInvoices(extracted, user.id);
}
