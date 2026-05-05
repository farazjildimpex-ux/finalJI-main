import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Send, CheckCircle2, AlertCircle, ChevronDown,
  Mail, Users, Loader2, LayoutTemplate as Template,
  Globe, RefreshCw,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Lead } from '../../types';
import { sendEmailViaServer } from '../../lib/emailCompose';

interface BulkEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads: Lead[];
}

interface TemplateEntry {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
}

type SendState = 'idle' | 'sending' | 'done';

interface SendResult {
  key: string;
  company: string;
  email: string;
  ok: boolean;
  error?: string;
}

interface LWGSupplier {
  company_name: string;
  country: string;
  certification_type: string;
  facility_type: string;
  description: string;
  website: string;
  email: string;
  in_db: boolean;
  selected: boolean;
}

const LWG_COUNTRIES_LIST = [
  'Albania','Algeria','Argentina','Australia','Austria','Azerbaijan','Bangladesh',
  'Belgium','Bolivia','Bosnia and Herzegovina','Brazil','Bulgaria','Cambodia',
  'Canada','Chile','China','Colombia','Croatia','Czech Republic','Denmark',
  'Dominican Republic','Ecuador','Egypt','Ethiopia','France','Germany','Hungary',
  'India','Indonesia','Iran','Italy','Japan','Kazakhstan','Kenya','Lithuania',
  'Mexico','Morocco','Netherlands','New Zealand','Nigeria','Norway','Pakistan',
  'Paraguay','Poland','Portugal','Romania','Saudi Arabia','Serbia','Singapore',
  'Slovakia','Slovenia','South Africa','South Korea','Spain','Sweden','Syria',
  'Taiwan','Tajikistan','Thailand','Tunisia','Turkiye','Uganda','Ukraine',
  'United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vietnam',
];

const LWG_RATINGS_LIST = ['Gold', 'Silver', 'Bronze', 'Audited', 'Approved'];

const LWG_MEMBER_TYPES = [
  'Tannery',
  'Chemical Manufacturer',
  'Component Manufacturer',
  'Trader',
  'Supplier',
  'Retailer',
  'Brand',
  'Importer',
  'Service Provider',
];

const LWG_ANIMAL_TYPES = [
  'Bovine',
  'Ovine',
  'Caprine',
  'Equine',
  'Porcine',
  'Reptile',
  'Exotic',
];

const LWG_MATERIAL_CONDITIONS = [
  'Wet-Blue',
  'Crust',
  'Finished',
  'Pickled',
  'Limed',
];

const RATING_BADGE: Record<string, string> = {
  Gold:     'bg-yellow-100 text-yellow-800 border-yellow-300',
  Silver:   'bg-gray-100 text-gray-700 border-gray-300',
  Bronze:   'bg-orange-100 text-orange-700 border-orange-300',
  Audited:  'bg-blue-100 text-blue-700 border-blue-300',
  Approved: 'bg-teal-100 text-teal-700 border-teal-300',
};

const DEFAULT_SUBJECT = 'JILD IMPEX — Premium Leather Sourcing Partnership';
const DEFAULT_BODY = `Dear {{contact_person}},

I hope this message finds you well.

My name is Faraz, and I represent JILD IMPEX, a Chennai-based leather trading company specialising in high-quality finished and semi-finished leather for the global market.

We noticed that {{company_name}} is an LWG-certified tannery based in {{country}}, and we believe there may be a strong synergy between our businesses. We are actively looking to establish long-term sourcing partnerships with quality-focused manufacturers.

We would love to explore the possibility of working together — whether for regular supply arrangements or specific product requirements.

Could we schedule a brief call or exchange product specifications at your earliest convenience?

Looking forward to hearing from you.

Warm regards,
Faraz
JILD IMPEX, Chennai, India
Email: office@jildimpex.com | Mob: +91 98410 91189`;

function decodeHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function applyVars(text: string, vars: {
  company_name: string; contact_person: string; country: string;
  email: string; industry_focus?: string; phone?: string; website?: string;
}): string {
  return text
    .replace(/\{\{company_name\}\}/g,    vars.company_name    || '')
    .replace(/\{\{contact_person\}\}/g,  vars.contact_person  || 'Sir/Madam')
    .replace(/\{\{country\}\}/g,         vars.country         || '')
    .replace(/\{\{email\}\}/g,           vars.email           || '')
    .replace(/\{\{industry_focus\}\}/g,  vars.industry_focus  || '')
    .replace(/\{\{phone\}\}/g,           vars.phone           || '')
    .replace(/\{\{website\}\}/g,         vars.website         || '');
}

function dedupeByEmail(arr: Lead[]): Lead[] {
  const seen = new Set<string>();
  return arr.filter(l => {
    if (!l.email || seen.has(l.email.toLowerCase())) return false;
    seen.add(l.email.toLowerCase());
    return true;
  });
}

const BulkEmailModal: React.FC<BulkEmailModalProps> = ({ isOpen, onClose, leads }) => {
  const [tab, setTab] = useState<'leads' | 'lwg'>('leads');

  const [templates, setTemplates]     = useState<TemplateEntry[]>([]);
  const [selectedTpl, setSelectedTpl] = useState('');
  const [subject, setSubject]         = useState(DEFAULT_SUBJECT);
  const [body, setBody]               = useState(DEFAULT_BODY);
  const [sendState, setSendState]     = useState<SendState>('idle');
  const [results, setResults]         = useState<SendResult[]>([]);
  const [progress, setProgress]       = useState(0);

  const [leadsCountry, setLeadsCountry]             = useState('all');
  const [showLeadsCountryDrop, setShowLeadsCountryDrop] = useState(false);
  const [leadsSelected, setLeadsSelected]           = useState<Set<string>>(new Set());

  const [lwgCountry, setLwgCountry]           = useState('');
  const [lwgRating, setLwgRating]             = useState('');
  const [lwgMemberType, setLwgMemberType]     = useState('');
  const [lwgAnimalType, setLwgAnimalType]     = useState('');
  const [lwgMaterialCond, setLwgMaterialCond] = useState('');
  const [lwgFetching, setLwgFetching]         = useState(false);
  const [lwgSuppliers, setLwgSuppliers]   = useState<LWGSupplier[]>([]);
  const [lwgFetched, setLwgFetched]       = useState(false);
  const [lwgError, setLwgError]           = useState('');
  const [lwgSearch, setLwgSearch]         = useState('');

  const eligible = useMemo(() => dedupeByEmail(leads.filter(l => l.email)), [leads]);
  const leadsCountries = useMemo(
    () => [...new Set(eligible.map(l => l.country || 'Unknown'))].sort(),
    [eligible]
  );
  const filteredLeads = useMemo(
    () => leadsCountry === 'all' ? eligible : eligible.filter(l => (l.country || 'Unknown') === leadsCountry),
    [eligible, leadsCountry]
  );

  useEffect(() => {
    setLeadsSelected(new Set(filteredLeads.map(l => l.id!)));
  }, [filteredLeads]);

  const visibleLwgSuppliers = useMemo(() => {
    const q = lwgSearch.toLowerCase();
    return !q ? lwgSuppliers : lwgSuppliers.filter(s => s.company_name.toLowerCase().includes(q));
  }, [lwgSuppliers, lwgSearch]);

  const lwgSelectedCount  = lwgSuppliers.filter(s => s.selected).length;
  const lwgSendableCount  = lwgSuppliers.filter(s => s.selected && s.email).length;
  const lwgNoEmailSelected = lwgSuppliers.filter(s => s.selected && !s.email).length;

  useEffect(() => {
    if (!isOpen) return;
    fetchTemplates();
    setSubject(DEFAULT_SUBJECT);
    setBody(DEFAULT_BODY);
    setSendState('idle');
    setResults([]);
    setProgress(0);
    setSelectedTpl('');
    setTab('leads');
    setLeadsCountry('all');
    setLwgCountry('');
    setLwgRating('');
    setLwgMemberType('');
    setLwgAnimalType('');
    setLwgMaterialCond('');
    setLwgSuppliers([]);
    setLwgFetched(false);
    setLwgError('');
    setLwgSearch('');
  }, [isOpen]);

  const fetchTemplates = async () => {
    try {
      const { data } = await supabase.from('email_templates').select('*').eq('is_active', true).order('name');
      setTemplates(data || []);
    } catch { /* optional */ }
  };

  const applyTemplate = () => {
    const tpl = templates.find(t => t.id === selectedTpl);
    if (!tpl) return;
    setSubject(decodeHtml(tpl.subject));
    setBody(decodeHtml(tpl.body));
  };

  const fetchLWGSuppliers = async () => {
    if (!lwgCountry) return;
    setLwgFetching(true);
    setLwgFetched(false);
    setLwgError('');
    setLwgSearch('');
    setLwgSuppliers([]);
    try {
      const params = new URLSearchParams({ country: lwgCountry });
      if (lwgRating) params.set('rating', lwgRating);
      // Combine keyword filters: member type + animal type + material condition
      const keywords = [lwgMemberType, lwgAnimalType, lwgMaterialCond].filter(Boolean).join(' ');
      if (keywords) params.set('memberType', keywords);

      const apiBase = (import.meta as any).env?.VITE_API_URL || '';
      const res = await fetch(`${apiBase}/api/scrape/lwg?${params}`);

      // Check the response is actually JSON (not an HTML error page from Vercel/CDN)
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(
          'The LWG scraper API is not reachable from this deployment. ' +
          'Make sure the app is deployed with its Express backend (use Replit deployment, not a static host). ' +
          `Server returned ${res.status} ${res.statusText}.`
        );
      }

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Scrape failed');

      const suppliers: LWGSupplier[] = (data.suppliers as any[]).map(s => {
        const matched = leads.find(l =>
          l.company_name.toLowerCase().trim() === s.company_name.toLowerCase().trim()
        );
        return {
          company_name:      s.company_name,
          country:           s.country || lwgCountry,
          certification_type: s.certification_type || '',
          facility_type:     s.facility_type || '',
          description:       s.description   || '',
          website:           s.website       || '',
          email:             matched?.email  || '',
          in_db:             !!matched,
          selected:          true,
        };
      });

      setLwgSuppliers(suppliers);
      setLwgFetched(true);
    } catch (err: any) {
      setLwgError(err.message || 'Failed to fetch from LWG');
    } finally {
      setLwgFetching(false);
    }
  };

  const toggleLwgOne = (idx: number) =>
    setLwgSuppliers(prev => prev.map((s, i) => i === idx ? { ...s, selected: !s.selected } : s));

  const toggleLwgAll = (val: boolean) =>
    setLwgSuppliers(prev => prev.map(s => ({ ...s, selected: val })));

  const toggleLeadOne = (id: string) =>
    setLeadsSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleLeadsAll = () => {
    if (leadsSelected.size === filteredLeads.length) setLeadsSelected(new Set());
    else setLeadsSelected(new Set(filteredLeads.map(l => l.id!)));
  };

  const selectedLeads = filteredLeads.filter(l => leadsSelected.has(l.id!));
  const sendCount = tab === 'leads' ? selectedLeads.length : lwgSendableCount;

  const handleSend = async () => {
    if (sendCount === 0) return;
    setSendState('sending');
    setProgress(0);
    setResults([]);

    const { data: { user } } = await supabase.auth.getUser();
    const allResults: SendResult[] = [];

    type Target = {
      key: string; company_name: string; contact_person: string;
      email: string; country: string; website?: string;
      industry_focus?: string; phone?: string; lead_id?: string;
    };

    const targets: Target[] = tab === 'leads'
      ? selectedLeads.map(l => ({
          key: l.id!, company_name: l.company_name, contact_person: l.contact_person,
          email: l.email, country: l.country || '', website: l.website,
          industry_focus: l.industry_focus, phone: l.phone, lead_id: l.id,
        }))
      : lwgSuppliers.filter(s => s.selected && s.email).map(s => {
          const matched = leads.find(l =>
            l.company_name.toLowerCase().trim() === s.company_name.toLowerCase().trim()
          );
          return {
            key: s.company_name,
            company_name: s.company_name,
            contact_person: matched?.contact_person || s.company_name,
            email: s.email,
            country: s.country,
            website: s.website,
            industry_focus: matched?.industry_focus || s.facility_type,
            lead_id: matched?.id,
          };
        });

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const vars = {
        company_name: t.company_name, contact_person: t.contact_person,
        email: t.email, country: t.country, website: t.website,
        industry_focus: t.industry_focus, phone: t.phone || '',
      };
      const filledSubject = applyVars(subject, vars);
      const filledBody    = applyVars(body, vars).replace(/\n/g, '<br>');

      const result = await sendEmailViaServer({ to: [t.email], subject: filledSubject, body: filledBody });

      try {
        if (user && t.lead_id) {
          await supabase.from('lead_email_logs').insert([{
            user_id: user.id, lead_id: t.lead_id, to_email: t.email,
            subject: filledSubject, body: applyVars(body, vars),
            status: result.ok ? 'sent' : 'failed', sent_at: new Date().toISOString(),
          }]);
          if (result.ok) {
            const matchedLead = leads.find(l => l.id === t.lead_id);
            await supabase.from('leads').update({
              last_contact_date: new Date().toISOString().split('T')[0],
              status: matchedLead?.status === 'new' ? 'approached' : matchedLead?.status,
            }).eq('id', t.lead_id);
          }
        }
      } catch { /* non-fatal */ }

      allResults.push({ key: t.key, company: t.company_name, email: t.email, ok: result.ok, error: result.error });
      setResults([...allResults]);
      setProgress(Math.round(((i + 1) / targets.length) * 100));

      if (i < targets.length - 1) await new Promise(r => setTimeout(r, 400));
    }

    setSendState('done');
  };

  if (!isOpen) return null;

  const sent    = results.filter(r => r.ok).length;
  const failed  = results.filter(r => !r.ok).length;
  const allDone = sendState === 'done';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl flex flex-col overflow-hidden" style={{ maxHeight: '95dvh' }}>

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="px-6 pt-4 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-50">
                <Mail className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Bulk Cold Email</h2>
                <p className="text-xs text-gray-500 mt-0.5">Send outreach via office@jildimpex.com</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tab selector */}
          <div className="flex mt-4 bg-gray-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => { if (sendState === 'idle') setTab('leads'); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${tab === 'leads' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              My Leads
            </button>
            <button
              onClick={() => { if (sendState === 'idle') setTab('lwg'); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 ${tab === 'lwg' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Globe className="h-3 w-3" /> LWG Live
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── My Leads tab ── */}
          {tab === 'leads' && (
            <div className="p-5 border-b border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Recipients</p>
                <div className="relative">
                  <button
                    onClick={() => setShowLeadsCountryDrop(!showLeadsCountryDrop)}
                    disabled={sendState !== 'idle'}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-gray-200 rounded-xl shadow-sm hover:border-gray-300 text-slate-600 disabled:opacity-50"
                  >
                    {leadsCountry === 'all' ? 'All countries' : leadsCountry}
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                  {showLeadsCountryDrop && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowLeadsCountryDrop(false)} />
                      <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden min-w-[180px] max-h-60 overflow-y-auto">
                        <button onClick={() => { setLeadsCountry('all'); setShowLeadsCountryDrop(false); }}
                          className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-gray-50 ${leadsCountry === 'all' ? 'text-blue-600 bg-blue-50/60' : 'text-slate-700'}`}>
                          All countries <span className="text-gray-400 font-normal">({eligible.length})</span>
                        </button>
                        {leadsCountries.map(c => {
                          const cnt = eligible.filter(l => (l.country || 'Unknown') === c).length;
                          return (
                            <button key={c} onClick={() => { setLeadsCountry(c); setShowLeadsCountryDrop(false); }}
                              className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-gray-50 ${leadsCountry === c ? 'text-blue-600 bg-blue-50/60' : 'text-slate-700'}`}>
                              {c} <span className="text-gray-400 font-normal">({cnt})</span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {filteredLeads.length === 0 ? (
                <div className="p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center">
                  <Users className="h-6 w-6 text-gray-300 mx-auto mb-1" />
                  <p className="text-xs text-gray-400">No leads with email addresses{leadsCountry !== 'all' ? ` in ${leadsCountry}` : ''}</p>
                  <p className="text-xs text-gray-400 mt-1">Use LWG Live tab to fetch directly from leatherworkinggroup.com</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <button onClick={toggleLeadsAll} disabled={sendState !== 'idle'} className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50">
                      {leadsSelected.size === filteredLeads.length ? 'Deselect all' : `Select all (${filteredLeads.length})`}
                    </button>
                    <span className="text-xs text-gray-400 font-medium">{leadsSelected.size} selected</span>
                  </div>
                  <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100 max-h-44 overflow-y-auto">
                    {filteredLeads.map(lead => {
                      const result = results.find(r => r.key === lead.id);
                      return (
                        <label key={lead.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${sendState !== 'idle' ? 'cursor-default' : ''}`}>
                          <input type="checkbox" checked={leadsSelected.has(lead.id!)} onChange={() => sendState === 'idle' && toggleLeadOne(lead.id!)} className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 accent-blue-600" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{lead.company_name}</p>
                            <p className="text-[11px] text-gray-400 truncate">{lead.email}</p>
                          </div>
                          {lead.country && <span className="text-[10px] text-gray-400 font-medium shrink-0">{lead.country}</span>}
                          {result && (result.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> : <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />)}
                          {!result && sendState === 'sending' && leadsSelected.has(lead.id!) && <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin shrink-0" />}
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── LWG Live tab ── */}
          {tab === 'lwg' && (
            <div className="border-b border-gray-100">

              {/* Filters */}
              <div className="p-5 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Fetch from LWG Certified Suppliers</p>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Country *</label>
                  <select
                    value={lwgCountry}
                    onChange={e => { setLwgCountry(e.target.value); setLwgFetched(false); setLwgSuppliers([]); setLwgError(''); }}
                    disabled={sendState !== 'idle' || lwgFetching}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white disabled:opacity-60"
                  >
                    <option value="">— select a country —</option>
                    {LWG_COUNTRIES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">LWG Rating</label>
                    <select value={lwgRating} onChange={e => setLwgRating(e.target.value)}
                      disabled={sendState !== 'idle' || lwgFetching}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white disabled:opacity-60">
                      <option value="">Any rating</option>
                      {LWG_RATINGS_LIST.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Member Type</label>
                    <select value={lwgMemberType} onChange={e => setLwgMemberType(e.target.value)}
                      disabled={sendState !== 'idle' || lwgFetching}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white disabled:opacity-60">
                      <option value="">Any type</option>
                      {LWG_MEMBER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Animal Type</label>
                    <select value={lwgAnimalType} onChange={e => setLwgAnimalType(e.target.value)}
                      disabled={sendState !== 'idle' || lwgFetching}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white disabled:opacity-60">
                      <option value="">Any animal</option>
                      {LWG_ANIMAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Material Condition</label>
                    <select value={lwgMaterialCond} onChange={e => setLwgMaterialCond(e.target.value)}
                      disabled={sendState !== 'idle' || lwgFetching}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white disabled:opacity-60">
                      <option value="">Any condition</option>
                      {LWG_MATERIAL_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <button
                  onClick={fetchLWGSuppliers}
                  disabled={!lwgCountry || lwgFetching || sendState !== 'idle'}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors"
                >
                  {lwgFetching
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Fetching all suppliers for {lwgCountry}…</>
                    : lwgFetched
                      ? <><RefreshCw className="h-4 w-4" /> Re-fetch</>
                      : <><Globe className="h-4 w-4" /> Fetch All Suppliers</>
                  }
                </button>

                {lwgError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {lwgError}
                  </div>
                )}
              </div>

              {/* Empty state before fetch */}
              {!lwgFetched && !lwgFetching && (
                <div className="px-5 pb-5">
                  <div className="p-5 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center">
                    <Globe className="h-7 w-7 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-gray-500">Select a country above and click Fetch</p>
                    <p className="text-xs text-gray-400 mt-1">All LWG-certified suppliers for that country will appear here. Suppliers already in your leads will show their stored email address.</p>
                  </div>
                </div>
              )}

              {/* LWG results */}
              {lwgFetched && lwgSuppliers.length > 0 && (
                <div>
                  {/* Summary bar */}
                  <div className="px-5 py-2.5 bg-gray-50 border-y border-gray-100 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-gray-800">
                        {lwgSuppliers.length} supplier{lwgSuppliers.length !== 1 ? 's' : ''} for {lwgCountry}
                        {lwgRating ? ` · ${lwgRating}` : ''}
                        {lwgMemberType ? ` · ${lwgMemberType}` : ''}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {lwgSuppliers.filter(s => s.email).length} have email · {lwgSuppliers.filter(s => !s.email).length} no email (import to Lead IQ first)
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs shrink-0">
                      <button onClick={() => toggleLwgAll(true)}  className="text-blue-600 font-semibold hover:underline">All</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => toggleLwgAll(false)} className="text-gray-500 hover:underline">None</button>
                      <span className="ml-1 px-2 py-0.5 bg-blue-600 text-white rounded-full text-xs font-bold">{lwgSelectedCount}</span>
                    </div>
                  </div>

                  {/* Search */}
                  <div className="px-4 py-2 border-b border-gray-100">
                    <input
                      type="text"
                      placeholder="Search companies…"
                      value={lwgSearch}
                      onChange={e => setLwgSearch(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  {lwgNoEmailSelected > 0 && (
                    <div className="px-5 py-2 text-[11px] text-amber-600 bg-amber-50 border-b border-amber-100 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {lwgNoEmailSelected} selected supplier{lwgNoEmailSelected !== 1 ? 's have' : ' has'} no email — they will be skipped when sending. Import them to Lead IQ to add contact details.
                    </div>
                  )}

                  {/* Supplier list */}
                  <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {visibleLwgSuppliers.length === 0 && (
                      <p className="px-5 py-8 text-center text-xs text-gray-400">No suppliers match your search</p>
                    )}
                    {visibleLwgSuppliers.map(s => {
                      const idx = lwgSuppliers.indexOf(s);
                      const ratingStyle = RATING_BADGE[s.certification_type] || 'bg-gray-100 text-gray-600 border-gray-200';
                      const result = results.find(r => r.key === s.company_name);
                      return (
                        <label
                          key={s.company_name}
                          className={`flex items-center gap-3 px-5 py-3 transition-colors ${sendState !== 'idle' ? 'cursor-default' : 'cursor-pointer'} ${s.selected ? 'hover:bg-blue-50/30' : 'hover:bg-gray-50'}`}
                        >
                          <input
                            type="checkbox"
                            checked={s.selected}
                            onChange={() => sendState === 'idle' && toggleLwgOne(idx)}
                            disabled={sendState !== 'idle'}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{s.company_name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {s.certification_type && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${ratingStyle}`}>
                                  {s.certification_type}
                                </span>
                              )}
                              {s.facility_type && (
                                <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-medium">
                                  {s.facility_type}
                                </span>
                              )}
                              {s.email
                                ? <span className="text-[11px] text-gray-500 truncate">{s.email}</span>
                                : <span className="text-[10px] text-amber-600 font-semibold">No email</span>
                              }
                            </div>
                          </div>
                          {result && (result.ok
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            : <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                          )}
                          {!result && sendState === 'sending' && s.selected && s.email && (
                            <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin shrink-0" />
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Email content ── */}
          <div className="p-5 space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Email Content</p>

            {templates.length > 0 && (
              <div className="flex gap-2">
                <select value={selectedTpl} onChange={e => setSelectedTpl(e.target.value)} disabled={sendState !== 'idle'}
                  className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white disabled:opacity-50">
                  <option value="">— default cold email —</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button onClick={applyTemplate} disabled={!selectedTpl || sendState !== 'idle'}
                  className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors flex items-center gap-1.5">
                  <Template className="h-4 w-4" /> Apply
                </button>
              </div>
            )}

            <p className="text-[11px] text-gray-400 leading-relaxed">
              Use <code className="bg-gray-100 px-1 rounded text-gray-600">{'{{company_name}}'}</code>, <code className="bg-gray-100 px-1 rounded text-gray-600">{'{{contact_person}}'}</code>, <code className="bg-gray-100 px-1 rounded text-gray-600">{'{{country}}'}</code> — filled per recipient before sending.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Subject *</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} disabled={sendState !== 'idle'}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white disabled:bg-gray-50 disabled:opacity-70 transition-colors"
                placeholder="Email subject" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Message *</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} disabled={sendState !== 'idle'} rows={10}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white disabled:bg-gray-50 disabled:opacity-70 resize-none font-mono text-[13px] leading-relaxed transition-colors"
                placeholder="Enter email body…" />
            </div>
          </div>

          {/* ── Progress ── */}
          {(sendState === 'sending' || allDone) && (
            <div className="px-5 pb-5 space-y-3">
              {sendState === 'sending' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" /> Sending…</span>
                    <span>{results.length} / {sendCount}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
              {allDone && (
                <div className={`flex items-start gap-3 p-4 rounded-2xl border ${failed === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  {failed === 0
                    ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    : <AlertCircle  className="h-5 w-5 text-amber-600  shrink-0 mt-0.5" />
                  }
                  <div className="text-sm">
                    <p className="font-bold text-slate-800">
                      {sent} email{sent !== 1 ? 's' : ''} sent successfully{failed > 0 ? `, ${failed} failed` : ''}
                    </p>
                    {failed > 0 && (
                      <div className="mt-2 space-y-1 text-xs text-amber-700">
                        {results.filter(r => !r.ok).map(r => <p key={r.key}>• {r.company}: {r.error || 'Unknown error'}</p>)}
                      </div>
                    )}
                    {sent > 0 && <p className="text-xs text-slate-500 mt-1">Activity logged on each lead. Lead statuses advanced to "Approached".</p>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-3xl flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            {allDone ? 'Close' : 'Cancel'}
          </button>
          {!allDone && (
            <button
              onClick={handleSend}
              disabled={sendState !== 'idle' || sendCount === 0 || !subject.trim() || !body.trim()}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {sendState === 'sending'
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                : <><Send className="h-4 w-4" /> Send to {sendCount} recipient{sendCount !== 1 ? 's' : ''}</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkEmailModal;
