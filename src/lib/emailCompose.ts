/**
 * Email composition helpers.
 *
 * Templates use {{variable}} placeholders that are replaced with context
 * data at compose time. Anything unrecognised is left as-is so the user
 * can spot and fix it before sending.
 */

export type EmailContext =
  | { type: 'contract';  data: Record<string, any> }
  | { type: 'letter';    data: Record<string, any> }
  | { type: 'payment';   data: Record<string, any> }
  | { type: 'general';   data: Record<string, any> };

/** All variables that can appear in a template. */
export interface TemplateVars {
  // Shared
  company_name?:   string;
  contact_person?: string;
  today?:          string;

  // Contract
  contract_no?:      string;
  buyer_name?:       string;
  supplier_name?:    string;
  description?:      string;
  quantity?:         string | number;
  unit_price?:       string;
  total_value?:      string;
  payment_terms?:    string;
  delivery_date?:    string;
  origin?:           string;
  destination?:      string;
  inco_terms?:       string;

  // Invoice / payment
  invoice_number?: string;
  invoice_date?:   string;
  invoice_value?:  string;
  bill_type?:      string;
  bill_number?:    string;
  shipping_date?:  string;

  // Letter (sample book)
  letter_number?: string;
  subject_line?:  string;
  letter_body?:   string;

  // Free override
  [key: string]: string | number | undefined;
}

/** Replace all {{variable}} placeholders in a template string. */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, key) => {
    const k = key.trim();
    const val = vars[k];
    return val !== undefined && val !== null ? String(val) : `{{${k}}}`;
  });
}

/**
 * Extract a TemplateVars map from a raw context data object.
 * Handles all three context types.
 */
export function buildVarsFromContext(ctx: EmailContext, companyName?: string): TemplateVars {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const base: TemplateVars = { today, company_name: companyName || '' };

  if (ctx.type === 'contract') {
    const d = ctx.data;
    return {
      ...base,
      contract_no:    d.contract_no   || '',
      buyer_name:     d.buyer_name    || '',
      supplier_name:  d.supplier_name || '',
      description:    d.description   || d.commodity || '',
      quantity:       d.quantity      || '',
      unit_price:     d.unit_price    || d.price || '',
      total_value:    d.total_value   || d.contract_value || '',
      payment_terms:  d.payment_terms || '',
      delivery_date:  fmtDate(d.delivery_date || d.shipment_date),
      origin:         d.origin        || d.port_of_loading || '',
      destination:    d.destination   || d.port_of_discharge || '',
      inco_terms:     d.inco_terms    || '',
      contact_person: d.contact_person || '',
    };
  }

  if (ctx.type === 'letter') {
    const d = ctx.data;
    return {
      ...base,
      letter_number:  d.sample_number  || d.letter_number || '',
      supplier_name:  d.supplier       || d.supplier_name || '',
      buyer_name:     d.buyer          || d.buyer_name    || '',
      subject_line:   d.subject        || '',
      letter_body:    d.body           || d.details       || '',
      contact_person: d.contact_person || '',
    };
  }

  if (ctx.type === 'payment') {
    const d = ctx.data;
    return {
      ...base,
      contract_no:    d.contract_no    || '',
      supplier_name:  d.supplier_name  || '',
      buyer_name:     d.buyer_name     || '',
      invoice_number: d.invoice_number || '',
      invoice_date:   fmtDate(d.invoice_date),
      invoice_value:  d.invoice_value  || '',
      bill_type:      d.bill_type      || '',
      bill_number:    d.bill_number    || '',
      shipping_date:  fmtDate(d.shipping_date),
      contact_person: d.contact_person || '',
    };
  }

  return base;
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Return the list of variable names used in a template string. */
export function extractUsedVars(template: string): string[] {
  const matches = [...template.matchAll(/\{\{([^}]+)\}\}/g)];
  return [...new Set(matches.map((m) => m[1].trim()))];
}

/**
 * Send an email via our Express server endpoint.
 * Returns { ok, error? }.
 */
export async function sendEmailViaServer(opts: {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  attachmentBase64?: string;
  attachmentName?: string;
  attachmentMime?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    });
    const data = await resp.json();
    if (!resp.ok) return { ok: false, error: data.error || `HTTP ${resp.status}` };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error' };
  }
}

/**
 * Log a sent (or failed) email to the `email_logs` Supabase table.
 */
export async function logEmail(
  supabase: any,
  userId: string,
  opts: {
    templateId?: string;
    contextType?: string;
    contextId?: string;
    to: string[];
    cc?: string[];
    subject: string;
    body: string;
    attachmentName?: string;
    status: 'sent' | 'failed';
    errorMessage?: string;
  },
) {
  try {
    await supabase.from('email_logs').insert([{
      user_id:         userId,
      template_id:     opts.templateId     || null,
      context_type:    opts.contextType    || null,
      context_id:      opts.contextId      || null,
      to_email:        opts.to,
      cc_email:        opts.cc             || [],
      subject:         opts.subject,
      body:            opts.body,
      attachment_name: opts.attachmentName || null,
      status:          opts.status,
      error_message:   opts.errorMessage   || null,
    }]);
  } catch (e) {
    console.warn('Failed to log email:', e);
  }
}

/** Return a list of all variables with their descriptions for the help panel. */
export const VARIABLE_DOCS: Array<{ key: string; description: string; contexts: string[] }> = [
  { key: 'today',           description: 'Today\'s date',                    contexts: ['all'] },
  { key: 'company_name',    description: 'Your company name',                contexts: ['all'] },
  { key: 'contact_person',  description: 'Contact person at supplier/buyer', contexts: ['all'] },
  { key: 'contract_no',     description: 'Contract number',                  contexts: ['contract', 'payment'] },
  { key: 'buyer_name',      description: 'Buyer company name',               contexts: ['contract', 'letter'] },
  { key: 'supplier_name',   description: 'Supplier company name',            contexts: ['contract', 'letter', 'payment'] },
  { key: 'description',     description: 'Contract commodity / description', contexts: ['contract'] },
  { key: 'quantity',        description: 'Contract quantity',                contexts: ['contract'] },
  { key: 'unit_price',      description: 'Unit price',                       contexts: ['contract'] },
  { key: 'total_value',     description: 'Total contract value',             contexts: ['contract'] },
  { key: 'payment_terms',   description: 'Payment terms',                    contexts: ['contract'] },
  { key: 'delivery_date',   description: 'Expected delivery date',           contexts: ['contract'] },
  { key: 'origin',          description: 'Port / city of origin',            contexts: ['contract'] },
  { key: 'destination',     description: 'Port / city of destination',       contexts: ['contract'] },
  { key: 'inco_terms',      description: 'Incoterms (FOB, CIF…)',           contexts: ['contract'] },
  { key: 'invoice_number',  description: 'Invoice number',                   contexts: ['payment'] },
  { key: 'invoice_date',    description: 'Invoice date',                     contexts: ['payment'] },
  { key: 'invoice_value',   description: 'Invoice value',                    contexts: ['payment'] },
  { key: 'bill_type',       description: 'Airway Bill / Bill of Lading',     contexts: ['payment'] },
  { key: 'bill_number',     description: 'AWB / B/L number',                contexts: ['payment'] },
  { key: 'shipping_date',   description: 'Shipping / departure date',        contexts: ['payment'] },
  { key: 'letter_number',   description: 'Letter reference number',          contexts: ['letter'] },
  { key: 'subject_line',    description: 'Letter subject heading',           contexts: ['letter'] },
  { key: 'letter_body',     description: 'Letter body text',                 contexts: ['letter'] },
];
