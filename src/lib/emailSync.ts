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
  line_items: { color: string; selection: string; quantity: string; pieces: string }[];
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
  // Note: The endpoint name remains /api/gmail/emails for frontend compatibility, 
  // but the backend has been updated to fetch from Zoho.
  const resp = await fetch('/api/gmail/emails');
  if (!resp.ok) {
    let errMsg = 'Failed to fetch emails from Zoho';
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

  const knownContracts = contracts.map(c => c.contract_no).join(', ') || 'none yet';

  const prompt = `You are a data extraction assistant for JILD IMPEX.
Read the email bodies and PDF text below. Extract every invoice found.

KNOWN CONTRACTS (for reference): ${knownContracts}

EXTRACTION RULES:
1. contract_numbers: This MUST be an array of strings. If an invoice belongs to multiple contracts (e.g. "CJV/001, CJV/002"), extract them as separate items in the array: ["CJV/001", "CJV/002"].
2. Clean all contract numbers: Remove extra spaces and ensure they match the format of our known contracts.
3. line_items: Extract color, selection, quantity (sqft), and pieces.
4. invoice_value: Numeric total only.
5. bill_type: "Airway Bill" or "Bill of Lading".
6. notes: Always return "".

Return ONLY valid JSON:
{
  "invoices": [
    {
      "invoice_number": "string",
      "invoice_date": "YYYY-MM-DD",
      "contract_numbers": ["CONTRACT1", "CONTRACT2"],
      "line_items": [{"color": "string", "selection": "string", "quantity": "number", "pieces": "number"}],
      "invoice_value": "string",
      "bill_type": "string",
      "bill_number": "string",
      "shipping_date": "YYYY-MM-DD",
      "notes": ""
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

  if (!resp.ok) throw new Error('AI analysis failed. Check your OpenRouter key.');

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';

  try {
    const jsonStr = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(jsonStr);
    return parsed.invoices || [];
  } catch {
    throw new Error('AI returned invalid data format.');
  }
}

export async function upsertInvoices(
  extractedInvoices: ExtractedInvoice[],
  userId: string
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (const inv of extractedInvoices) {
    if (!inv.invoice_number?.trim()) continue;

    try {
      // Clean contract numbers to ensure they match exactly (Uppercase, trimmed)
      const cleanedContracts = (inv.contract_numbers || [])
        .map(c => c.trim().toUpperCase())
        .filter(c => c.length > 0);

      const { data: existing } = await supabase
        .from('invoices')
        .select('id')
        .eq('invoice_number', inv.invoice_number.trim())
        .maybeSingle();

      const payload = {
        user_id: userId,
        invoice_number: inv.invoice_number.trim(),
        invoice_date: inv.invoice_date,
        contract_numbers: cleanedContracts,
        line_items: inv.line_items,
        invoice_value: inv.invoice_value,
        bill_type: inv.bill_type,
        bill_number: inv.bill_number,
        shipping_date: inv.shipping_date,
        notes: '',
        price_adjustment: '',
      };

      if (existing?.id) {
        await supabase.from('invoices').update(payload).eq('id', existing.id);
        results.push({ invoice_number: inv.invoice_number, contract_numbers: cleanedContracts, action: 'updated', invoice: inv });
      } else {
        await supabase.from('invoices').insert([payload]);
        results.push({ invoice_number: inv.invoice_number, contract_numbers: cleanedContracts, action: 'created', invoice: inv });
      }
    } catch (err: any) {
      results.push({ invoice_number: inv.invoice_number, contract_numbers: inv.contract_numbers, action: 'skipped', reason: err.message, invoice: inv });
    }
  }

  return results;
}