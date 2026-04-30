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

// ─── Provider: Google AI Studio (direct Gemini API) ─────────────────────
// Google's free tier on aistudio.google.com gives 1,500 requests/day and
// reads PDFs natively. Recommended over OpenRouter for free use.
async function callGoogleGemini(
  email: EmailData,
  contracts: Contract[],
  apiKey: string
): Promise<ExtractedInvoice[]> {
  const knownContracts = contracts.map((c) => c.contract_no).join(', ') || 'none yet';
  const prompt = buildPrompt(knownContracts);
  const model = localStorage.getItem('jild_google_model') || 'gemini-2.0-flash';

  const parts: any[] = [
    { text: prompt + '\n\nDATA TO ANALYZE:\n' + emailHeaderText(email) },
  ];
  for (const a of email.attachments) {
    if (a.dataBase64 && a.type === 'pdf') {
      parts.push({
        inline_data: {
          mime_type: a.mimeType || 'application/pdf',
          data: a.dataBase64,
        },
      });
    }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!resp.ok) {
    let detail = '';
    try { detail = (await resp.text()).slice(0, 400); } catch {}
    throw new Error(`Google Gemini request failed (${resp.status}). ${detail || 'Check your API key.'}`);
  }

  const data = await resp.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  try {
    let jsonStr = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    if (!jsonStr.startsWith('{')) {
      const m = jsonStr.match(/\{[\s\S]*\}/);
      if (m) jsonStr = m[0];
    }
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed.invoices) ? parsed.invoices : [];
  } catch {
    throw new Error('Gemini returned data in an unexpected format. Raw: ' + content.slice(0, 200));
  }
}

// ─── Provider: Qwen (Alibaba DashScope) ──────────────────────────────────
// DashScope International gives a generous free tier and qwen-vl-max-latest
// reads images (and short PDFs converted to images) natively. Get a key at
// https://dashscope.console.aliyun.com (or the international console).
async function callQwen(
  email: EmailData,
  contracts: Contract[],
  apiKey: string
): Promise<ExtractedInvoice[]> {
  const knownContracts = contracts.map((c) => c.contract_no).join(', ') || 'none yet';
  const prompt = buildPrompt(knownContracts);
  const model = localStorage.getItem('jild_qwen_model') || 'qwen-vl-max-latest';

  // Qwen uses OpenAI-compatible chat completions with image_url multipart.
  // We pass the PDF as a data URI on image_url — qwen-vl reads it.
  const contentParts: any[] = [
    { type: 'text', text: prompt + '\n\nDATA TO ANALYZE:\n' + emailHeaderText(email) },
  ];

  for (const a of email.attachments) {
    if (a.dataBase64 && a.type === 'pdf') {
      contentParts.push({
        type: 'image_url',
        image_url: {
          url: `data:${a.mimeType || 'application/pdf'};base64,${a.dataBase64}`,
        },
      });
    }
  }

  const body = {
    model,
    messages: [{ role: 'user', content: contentParts }],
    temperature: 0.1,
  };

  const resp = await fetch(
    'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    }
  );

  if (!resp.ok) {
    let detail = '';
    try { detail = (await resp.text()).slice(0, 400); } catch {}
    throw new Error(
      `Qwen request failed (${resp.status}). ${detail || 'Check your DashScope key or try qwen-plus.'}`
    );
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';

  try {
    let jsonStr = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    if (!jsonStr.startsWith('{')) {
      const m = jsonStr.match(/\{[\s\S]*\}/);
      if (m) jsonStr = m[0];
    }
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed.invoices) ? parsed.invoices : [];
  } catch {
    throw new Error('Qwen returned data in an unexpected format. Raw: ' + content.slice(0, 200));
  }
}

// Email sync NEVER writes directly to the `invoices` table. Extracted
// invoices are only staged in `email_scan_log.extracted_invoices` and the
// user must explicitly approve them on the Approvals page, which is the only
// place that performs the actual insert.
async function previewOne(inv: ExtractedInvoice): Promise<SyncResult> {
  if (!inv.invoice_number?.trim()) {
    return {
      invoice_number: '(empty)',
      contract_numbers: [],
      action: 'skipped',
      reason: 'No invoice number found',
      invoice: inv,
    };
  }

  const cleanedContracts = (inv.contract_numbers || [])
    .map((c) => c.trim().toUpperCase())
    .filter((c) => c.length > 0);

  try {
    const { data: existing } = await supabase
      .from('invoices')
      .select('id, is_approved')
      .eq('invoice_number', inv.invoice_number.trim())
      .maybeSingle();

    if (existing?.id) {
      return {
        invoice_number: inv.invoice_number,
        contract_numbers: cleanedContracts,
        action: 'skipped',
        reason: existing.is_approved
          ? 'Already approved — kept as-is'
          : 'Already pending approval',
        invoice: inv,
      };
    }

    return {
      invoice_number: inv.invoice_number,
      contract_numbers: cleanedContracts,
      action: 'created',
      reason: 'Awaiting your approval',
      invoice: inv,
    };
  } catch (err: any) {
    return {
      invoice_number: inv.invoice_number,
      contract_numbers: cleanedContracts,
      action: 'skipped',
      reason: err.message,
      invoice: inv,
    };
  }
}

export async function approveExtractedInvoice(
  inv: ExtractedInvoice,
  userId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!inv.invoice_number?.trim()) {
    return { ok: false, error: 'Missing invoice number' };
  }
  try {
    const cleanedContracts = (inv.contract_numbers || [])
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c.length > 0);

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
      source: 'email_sync',
      is_approved: true,
      approved_at: new Date().toISOString(),
      approved_by: userId,
    };

    const { data: existing } = await supabase
      .from('invoices')
      .select('id')
      .eq('invoice_number', payload.invoice_number)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from('invoices')
        .update(payload)
        .eq('id', existing.id);
      if (error) throw error;
      return { ok: true, id: existing.id };
    }

    const { data: inserted, error } = await supabase
      .from('invoices')
      .insert([payload])
      .select('id')
      .single();
    if (error) throw error;
    return { ok: true, id: inserted!.id };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to approve invoice' };
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

export type AIProvider = 'google' | 'qwen';

export interface AICredentials {
  provider: AIProvider;
  apiKey: string;
}

export async function syncEmailsWithLog(
  emails: EmailData[],
  contracts: Contract[],
  credentials: AICredentials,
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
      extracted = credentials.provider === 'google'
        ? await callGoogleGemini(email, contracts, credentials.apiKey)
        : await callQwen(email, contracts, credentials.apiKey);
      if (extracted.length === 0) {
        status = 'no_invoices';
      } else {
        for (const inv of extracted) {
          results.push(await previewOne(inv));
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

