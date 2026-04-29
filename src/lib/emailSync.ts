import { supabase } from './supabaseClient';
import type { Contract } from '../types';

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

export type EmailScanStatus = 'no_invoices' | 'success' | 'partial' | 'error';

export interface EmailScanResult {
  email: EmailData;
  extracted: ExtractedInvoice[];
  results: SyncResult[];
  status: EmailScanStatus;
  errorMessage?: string;
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

function buildPrompt(knownContracts: string): string {
  return `You are a data extraction assistant for JILD IMPEX.
Read the email body and PDF text provided. Extract every invoice found.

KNOWN CONTRACTS (for reference): ${knownContracts}

CRITICAL EXTRACTION RULES:
1. contract_numbers: This MUST be a JSON array of strings.
   - If an invoice belongs to multiple contracts (e.g. "CJV/001 & CJV/002"), you MUST return: ["CJV/001", "CJV/002"].
   - Even if there is only one contract, it MUST be an array: ["CJV/001"].
2. Clean all contract numbers: Remove extra spaces, slashes, or symbols and ensure they match the format of our known contracts exactly.
3. line_items: Extract color, selection, quantity (sqft), and pieces.
4. invoice_value: Numeric total only.
5. bill_type: "Airway Bill" or "Bill of Lading".
6. notes: Always return "".

Return ONLY valid JSON in this format:
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
}

function emailToText(e: EmailData): string {
  return `Subject: ${e.subject}\nFrom: ${e.from}\nDate: ${e.date}\nBody:\n${e.body}\n${
    e.attachments.map(a => `--- Attachment: ${a.name} ---\n${a.text}`).join('\n')
  }`;
}

async function callOpenRouter(
  email: EmailData,
  contracts: Contract[],
  openRouterKey: string
): Promise<ExtractedInvoice[]> {
  const knownContracts = contracts.map(c => c.contract_no).join(', ') || 'none yet';
  const prompt = buildPrompt(knownContracts);

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
      messages: [{ role: 'user', content: prompt + '\n\nDATA TO ANALYZE:\n' + emailToText(email) }],
      temperature: 0.1,
    }),
  });

  if (!resp.ok) throw new Error(`AI request failed (${resp.status}). Check your OpenRouter key or try a different model.`);

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';

  try {
    const jsonStr = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed.invoices) ? parsed.invoices : [];
  } catch {
    throw new Error('AI returned data in an unexpected format.');
  }
}

async function upsertOne(inv: ExtractedInvoice, userId: string): Promise<SyncResult> {
  if (!inv.invoice_number?.trim()) {
    return { invoice_number: '(empty)', contract_numbers: [], action: 'skipped', reason: 'No invoice number found', invoice: inv };
  }
  try {
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
      return { invoice_number: inv.invoice_number, contract_numbers: cleanedContracts, action: 'updated', invoice: inv };
    }
    await supabase.from('invoices').insert([payload]);
    return { invoice_number: inv.invoice_number, contract_numbers: cleanedContracts, action: 'created', invoice: inv };
  } catch (err: any) {
    return { invoice_number: inv.invoice_number, contract_numbers: inv.contract_numbers, action: 'skipped', reason: err.message, invoice: inv };
  }
}

async function recordScan(scan: EmailScanResult, userId: string): Promise<void> {
  try {
    const emailDate = scan.email.date ? new Date(scan.email.date).toISOString() : null;
    await supabase.from('email_scan_log').insert([{
      user_id: userId,
      email_subject: scan.email.subject || '',
      email_from: scan.email.from || '',
      email_date: emailDate,
      body_chars: scan.email.body?.length || 0,
      attachments: scan.email.attachments.map(a => ({ name: a.name, type: a.type, chars: a.text.length })),
      extracted_invoices: scan.extracted,
      sync_results: scan.results.map(r => ({
        invoice_number: r.invoice_number,
        contract_numbers: r.contract_numbers,
        action: r.action,
        reason: r.reason || null,
      })),
      status: scan.status,
      error_message: scan.errorMessage || null,
    }]);
  } catch (err: any) {
    // Logging is best-effort. If the table doesn't exist yet, surface a helpful
    // console message but don't fail the sync run.
    console.warn('Could not write to email_scan_log (table may not be created yet):', err?.message || err);
  }
}

export async function syncEmailsWithLog(
  emails: EmailData[],
  contracts: Contract[],
  openRouterKey: string,
  userId: string,
  onProgress?: (i: number, total: number) => void
): Promise<EmailScanResult[]> {
  const out: EmailScanResult[] = [];
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    onProgress?.(i, emails.length);

    let extracted: ExtractedInvoice[] = [];
    let results: SyncResult[] = [];
    let status: EmailScanStatus = 'no_invoices';
    let errorMessage: string | undefined;

    try {
      extracted = await callOpenRouter(email, contracts, openRouterKey);
      if (extracted.length === 0) {
        status = 'no_invoices';
      } else {
        for (const inv of extracted) {
          results.push(await upsertOne(inv, userId));
        }
        const skipped = results.filter(r => r.action === 'skipped').length;
        status = skipped === 0 ? 'success' : (skipped === results.length ? 'error' : 'partial');
      }
    } catch (err: any) {
      status = 'error';
      errorMessage = err?.message || 'Unknown extraction error';
    }

    const scan: EmailScanResult = { email, extracted, results, status, errorMessage };
    await recordScan(scan, userId);
    out.push(scan);
  }
  onProgress?.(emails.length, emails.length);
  return out;
}

// ── Legacy helpers retained for any callers still importing them ──────────
export async function analyzeEmailsWithAI(
  emails: EmailData[],
  contracts: Contract[],
  openRouterKey: string
): Promise<ExtractedInvoice[]> {
  const all: ExtractedInvoice[] = [];
  for (const e of emails) {
    try {
      const extracted = await callOpenRouter(e, contracts, openRouterKey);
      all.push(...extracted);
    } catch {}
  }
  return all;
}

export async function upsertInvoices(
  extractedInvoices: ExtractedInvoice[],
  userId: string
): Promise<SyncResult[]> {
  const out: SyncResult[] = [];
  for (const inv of extractedInvoices) {
    out.push(await upsertOne(inv, userId));
  }
  return out;
}
