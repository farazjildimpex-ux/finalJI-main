import { supabase } from './supabaseClient';
import type { Contract } from '../types';

export interface EmailData {
  subject: string;
  from: string;
  date: string;
  body: string;
  attachments: {
    name: string;
    text: string;
    type: string;
    /** Base64-encoded raw PDF, present only when text extraction failed (image PDF). */
    dataBase64?: string;
    mimeType?: string;
  }[];
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
Read the email body AND every attached PDF (some are scanned/image PDFs — read them visually).
Extract every invoice found.

KNOWN CONTRACTS (for reference, match exactly when possible): ${knownContracts}

CRITICAL EXTRACTION RULES:
1. invoice_number: The invoice number printed inside the PDF (e.g. "1119/25-26/EX" or "1119"). Do NOT prepend or merge contract codes (e.g. "CJV") into the invoice number. The filename may say "CJV INV - 1119" but the actual invoice_number is just "1119" or "1119/25-26/EX" as written on the document.
2. contract_numbers: MUST be a JSON array of strings.
   - Look inside the invoice/packing list — contracts are usually listed under "CONTRACT NO." or beside each line item (e.g. "CJV-885", "CJV-886", "CJV-887"). Return every distinct contract number.
   - If an invoice covers multiple contracts you MUST return them all: ["CJV-885","CJV-886","CJV-887"].
   - Even with one contract, return an array: ["CJV-885"].
   - Normalise format: trim spaces, keep the separator the company uses (typically a hyphen or slash), and match the format of the known contracts list above.
3. line_items: Extract color, selection, quantity (sqft), and pieces from the invoice line table.
4. invoice_value: Numeric total only (no currency symbol).
5. bill_type: "Airway Bill" or "Bill of Lading".
6. notes: Always return "".

If you genuinely cannot find an invoice in the provided data, return {"invoices": []}. Do not guess or fabricate numbers from the filename alone.

Return ONLY valid JSON in this exact shape:
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

function emailHeaderText(e: EmailData): string {
  return `Subject: ${e.subject}\nFrom: ${e.from}\nDate: ${e.date}\nBody:\n${e.body}\n${
    e.attachments
      .map((a) => `--- Attachment: ${a.name} (${a.type}) ---\n${a.text || '[no extractable text — see attached PDF file]'}`)
      .join('\n')
  }`;
}

async function callOpenRouter(
  email: EmailData,
  contracts: Contract[],
  openRouterKey: string
): Promise<ExtractedInvoice[]> {
  const knownContracts = contracts.map((c) => c.contract_no).join(', ') || 'none yet';
  const prompt = buildPrompt(knownContracts);

  const model = localStorage.getItem('jild_openrouter_model') || 'google/gemini-2.0-flash-exp:free';

  // Build OpenAI-style multipart message: text part + every PDF that came with
  // base64 data (server only attaches data when text extraction failed).
  const contentParts: any[] = [
    { type: 'text', text: prompt + '\n\nDATA TO ANALYZE:\n' + emailHeaderText(email) },
  ];

  let needsFileParser = false;
  for (const a of email.attachments) {
    if (a.dataBase64 && a.type === 'pdf') {
      needsFileParser = true;
      contentParts.push({
        type: 'file',
        file: {
          filename: a.name,
          file_data: `data:${a.mimeType || 'application/pdf'};base64,${a.dataBase64}`,
        },
      });
    }
  }

  const body: any = {
    model,
    messages: [{ role: 'user', content: contentParts }],
    temperature: 0.1,
  };
  // When at least one PDF needs OCR, ask OpenRouter's file-parser plugin to
  // hand the PDF to the model natively (Gemini & GPT-4o read PDFs directly).
  if (needsFileParser) {
    body.plugins = [{ id: 'file-parser', pdf: { engine: 'native' } }];
  }

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openRouterKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'JILD IMPEX Email Sync',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    let detail = '';
    try { detail = (await resp.text()).slice(0, 300); } catch {}
    throw new Error(`AI request failed (${resp.status}). ${detail || 'Check your OpenRouter key or try a different model.'}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';

  try {
    // Some models wrap JSON in code fences or include surrounding prose — pull
    // out the first {...} block as a fallback.
    let jsonStr = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    if (!jsonStr.startsWith('{')) {
      const m = jsonStr.match(/\{[\s\S]*\}/);
      if (m) jsonStr = m[0];
    }
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
