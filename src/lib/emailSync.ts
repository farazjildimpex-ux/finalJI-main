import { supabase } from './supabaseClient';
import type { Contract } from '../types';

export type EmailScanStatus = 'no_invoices' | 'success' | 'partial' | 'error';

export interface ExtractedInvoice {
  invoice_number: string;
  invoice_date?: string;
  contract_numbers?: string[];
  line_items?: { description: string; quantity: number; unit_price: number; total: number }[];
  invoice_value?: string;
  bill_type?: string;
  bill_number?: string;
  shipping_date?: string;
  notes?: string;
}

export interface EmailData {
  id?: string;
  subject: string;
  from: string;
  date: string;
  body: string;
  attachments: EmailAttachment[];
}

export interface EmailAttachment {
  name: string;
  type: string; // 'pdf', 'image', 'other'
  text: string;
  dataBase64?: string;
  mimeType?: string;
}

export interface SyncResult {
  invoice_number: string;
  contract_numbers: string[];
  action: 'imported' | 'skipped';
  reason?: string;
}

export interface EmailScanResult {
  email: EmailData;
  extracted: ExtractedInvoice[];
  results: SyncResult[];
  status: EmailScanStatus;
  errorMessage?: string;
}

function buildPrompt(knownContracts: string): string {
  return `You are an expert logistics and accounts assistant. 
Extract invoice details from the following email and its attachments.
The known contract numbers in our system are: ${knownContracts}.

Return ONLY valid JSON in this exact shape:
{
  "invoices": [
    {
      "invoice_number": "string",
      "invoice_date": "YYYY-MM-DD",
      "contract_numbers": ["matching contract numbers found in text"],
      "line_items": [
        { "description": "string", "quantity": 0, "unit_price": 0, "total": 0 }
      ],
      "invoice_value": "string (e.g. 1500.50 USD)",
      "bill_type": "Airway Bill" | "Bill of Lading" | null,
      "bill_number": "string",
      "shipping_date": "YYYY-MM-DD",
      "notes": "any extra context"
    }
  ]
}
If no invoice is found, return {"invoices": []}.`;
}

function emailHeaderText(email: EmailData): string {
  return `SUBJECT: ${email.subject}
FROM: ${email.from}
DATE: ${email.date}
BODY:
${email.body}

ATTACHMENTS SUMMARY:
${email.attachments.map((a) => `- ${a.name} (${a.type}): ${a.text.slice(0, 2000)}`).join('\n')}`;
}

async function callGoogleGemini(
  email: EmailData,
  contracts: Contract[],
  apiKey: string
): Promise<ExtractedInvoice[]> {
  const knownContracts = contracts.map((c) => c.contract_no).join(', ') || 'none yet';
  const prompt = buildPrompt(knownContracts);
  const model = localStorage.getItem('jild_google_model') || 'gemini-2.0-flash';

  const parts: any[] = [{ text: prompt + '\n\nDATA TO ANALYZE:\n' + emailHeaderText(email) }];

  for (const a of email.attachments) {
    if (a.dataBase64 && a.type === 'pdf') {
      parts.push({
        inlineData: {
          mimeType: a.mimeType || 'application/pdf',
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
      contents: [{ parts }],
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

async function callOpenAI(
  email: EmailData,
  contracts: Contract[],
  apiKey: string
): Promise<ExtractedInvoice[]> {
  const knownContracts = contracts.map((c) => c.contract_no).join(', ') || 'none yet';
  const prompt = buildPrompt(knownContracts);
  const model = localStorage.getItem('jild_openai_model') || 'gpt-4o-mini';

  const contentParts: any[] = [
    { type: 'text', text: prompt + '\n\nDATA TO ANALYZE:\n' + emailHeaderText(email) },
  ];

  for (const a of email.attachments) {
    if (a.dataBase64 && (a.mimeType?.startsWith('image/') || a.type === 'image')) {
      contentParts.push({
        type: 'image_url',
        image_url: {
          url: `data:${a.mimeType || 'image/jpeg'};base64,${a.dataBase64}`,
        },
      });
    }
  }

  const body = {
    model,
    messages: [{ role: 'user', content: contentParts }],
    temperature: 0.1,
    response_format: { type: 'json_object' }
  };

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    let detail = '';
    try { detail = (await resp.text()).slice(0, 400); } catch {}
    throw new Error(
      `OpenAI request failed (${resp.status}). ${detail || 'Check your OpenAI key.'}`
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
    throw new Error('OpenAI returned data in an unexpected format. Raw: ' + content.slice(0, 200));
  }
}

async function callOpenRouter(
  email: EmailData,
  contracts: Contract[],
  apiKey: string
): Promise<ExtractedInvoice[]> {
  const knownContracts = contracts.map((c) => c.contract_no).join(', ') || 'none yet';
  const prompt = buildPrompt(knownContracts);
  const model = localStorage.getItem('jild_openrouter_model') || 'google/gemini-2.5-flash';

  const contentParts: any[] = [
    { type: 'text', text: prompt + '\n\nDATA TO ANALYZE:\n' + emailHeaderText(email) },
  ];

  for (const a of email.attachments) {
    if (a.dataBase64 && (a.mimeType?.startsWith('image/') || a.type === 'image')) {
      contentParts.push({
        type: 'image_url',
        image_url: {
          url: `data:${a.mimeType || 'image/jpeg'};base64,${a.dataBase64}`,
        },
      });
    }
  }

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'JILD IMPEX',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: contentParts }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!resp.ok) {
    let detail = '';
    try { detail = (await resp.text()).slice(0, 400); } catch {}
    throw new Error(
      `OpenRouter request failed (${resp.status}). ${detail || 'Check your OpenRouter key and model.'}`
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
    throw new Error('OpenRouter returned data in an unexpected format. Raw: ' + content.slice(0, 200));
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

    const cleanDate = (v: string | null | undefined): string | null => {
      if (!v) return null;
      const t = String(v).trim();
      if (!t) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
      const d = new Date(t);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString().slice(0, 10);
    };

    const cleanBillType = (v: string | null | undefined) => {
      const t = (v || '').trim();
      return t === 'Airway Bill' || t === 'Bill of Lading' ? t : null;
    };

    const payload = {
      user_id: userId,
      invoice_number: inv.invoice_number.trim(),
      invoice_date: cleanDate(inv.invoice_date),
      contract_numbers: cleanedContracts,
      line_items: inv.line_items || [],
      invoice_value: inv.invoice_value || '',
      bill_type: cleanBillType(inv.bill_type),
      bill_number: (inv.bill_number || '').trim(),
      shipping_date: cleanDate(inv.shipping_date),
      notes: inv.notes || '',
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
    console.warn('Could not write to email_scan_log:', err?.message || err);
  }
}

async function previewOne(inv: ExtractedInvoice): Promise<SyncResult> {
  if (!inv.invoice_number?.trim()) {
    return {
      invoice_number: '(empty)',
      contract_numbers: [],
      action: 'skipped',
      reason: 'No invoice number found',
    };
  }
  return {
    invoice_number: inv.invoice_number,
    contract_numbers: inv.contract_numbers || [],
    action: 'imported',
  };
}

export type AIProvider = 'google' | 'openai' | 'openrouter';

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
        : credentials.provider === 'openrouter'
          ? await callOpenRouter(email, contracts, credentials.apiKey)
          : await callOpenAI(email, contracts, credentials.apiKey);
        
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

export async function fetchZohoEmails(): Promise<{ emails: EmailData[] }> {
  const resp = await fetch('/api/zoho/emails');
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to fetch emails (${resp.status}): ${text}`);
  }
  return resp.json();
}

export async function fetchGmailEmails(): Promise<{ emails: EmailData[] }> {
  return fetchZohoEmails();
}
