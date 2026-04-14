export interface Todo {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  completed: boolean;
  completed_at?: string;
  hidden_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  contractNumber: string;
  supplierName: string;
  article: string;
  color: string;
  date: string;
  status: 'Issued' | 'Inspected' | 'Completed';
  type: 'contract' | 'sample' | 'debit_note';
  contractData?: Contract;
  sampleData?: Sample;
  debitNoteData?: DebitNote;
}

export interface NavigationItem {
  name: string;
  path: string;
  icon: string;
  mobile?: boolean;
}

export interface Contact {
  id: string;
  name: string;
  address: string[];
  mark: string | null;
  email: string[];
  contact_no: string[];
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  address: string[];
  phone?: string;
  email?: string;
  letterhead_url?: string;
  letterhead_name?: string;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: string;
  company_name: string;
  contract_no: string;
  contract_date: string;
  buyers_reference: string;
  buyer_name: string;
  buyer_address: string[];
  supplier_name: string;
  supplier_address: string[];
  description: string;
  article: string;
  size: string;
  average: string;
  substance: string;
  measurement: string;
  selection: string[];
  color: string[];
  swatch: string[];
  quantity: string[];
  price: string[];
  delivery_schedule: string[];
  destination: string[];
  local_commission: string;
  foreign_commission: string;
  payment_terms: string;
  notify_party: string;
  bank_documents: string;
  important_notes: string[];
  currency: string;
  created_at: string;
  updated_at: string;
  status: 'Issued' | 'Inspected' | 'Completed';
}

export interface Sample {
  id?: string;
  user_id?: string;
  sample_number: string;
  date: string;
  status: 'Issued' | 'Completed';
  company_name: string;
  supplier_name: string;
  supplier_address: string[];
  description: string;
  article: string;
  size: string;
  substance: string;
  selection: string[];
  color: string[];
  swatch: string[];
  quantity: string[];
  delivery: string[];
  notes: string;
  shipment_reference: string[];
  customer_comments: string;
  created_at?: string;
  updated_at?: string;
}

export interface DebitNote {
  id?: string;
  user_id?: string;
  debit_note_no: string;
  debit_note_date: string;
  status: 'Issued' | 'Completed';
  supplier_name: string;
  supplier_address: string[];
  contract_no: string;
  contract_date?: string;
  buyer_name: string;
  invoice_no: string;
  invoice_date?: string;
  quantity: string;
  pieces: string;
  destination: string;
  local_commission: string;
  invoice_value: string;
  commissioning: number;
  exchange_rate: number;
  commission_in_rupees: number;
  commission_in_words: string;
  currency: string;
  company: string;
  created_at?: string;
  updated_at?: string;
}

export interface Lead {
  id?: string;
  user_id?: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone?: string;
  website?: string;
  address?: string[];
  country: string;
  source: 'leatherworkinggroup' | 'lineapelle' | 'aplf' | 'manual' | 'other';
  status: 'new' | 'contacted' | 'interested' | 'qualified' | 'proposal_sent' | 'negotiating' | 'won' | 'lost';
  industry_focus?: string;
  company_size?: string;
  notes?: string;
  last_contact_date?: string;
  next_follow_up?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface EmailTemplate {
  id?: string;
  user_id?: string;
  name: string;
  subject: string;
  body: string;
  category: 'introduction' | 'follow_up' | 'proposal' | 'thank_you' | 'other';
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EmailLog {
  id?: string;
  user_id?: string;
  lead_id: string;
  template_id?: string;
  to_email: string;
  subject: string;
  body: string;
  sent_at: string;
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced';
  reply_received?: boolean;
  reply_content?: string;
  reply_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CallLog {
  id?: string;
  user_id?: string;
  lead_id: string;
  call_date: string;
  duration_minutes?: number;
  call_type: 'outbound' | 'inbound';
  outcome: 'connected' | 'voicemail' | 'no_answer' | 'busy' | 'disconnected';
  notes: string;
  follow_up_required: boolean;
  follow_up_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LeadSource {
  id: string;
  name: string;
  url: string;
  last_updated: string;
  total_leads: number;
  active: boolean;
}

export interface FileAttachment {
  name: string;
  url: string;
  type: 'image' | 'pdf' | 'other';
}

export interface JournalEntry {
  id: string;
  user_id: string;
  title: string;
  content: string;
  entry_date: string;
  file_urls: FileAttachment[];
  reminder_enabled: boolean;
  reminder_date: string | null;
  reminder_time: string | null;
  reminder_sent: boolean;
  parent_id?: string | null;
  created_at: string;
  updated_at: string;
}