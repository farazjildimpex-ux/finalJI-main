import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Send, CheckCircle2, AlertCircle, ChevronDown,
  Mail, Users, Loader2, LayoutTemplate as Template,
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

interface LeadResult {
  leadId: string;
  company: string;
  email: string;
  ok: boolean;
  error?: string;
}

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

function applyVars(text: string, lead: Lead): string {
  return text
    .replace(/\{\{company_name\}\}/g, lead.company_name || '')
    .replace(/\{\{contact_person\}\}/g, lead.contact_person || 'Sir/Madam')
    .replace(/\{\{country\}\}/g, lead.country || '')
    .replace(/\{\{email\}\}/g, lead.email || '')
    .replace(/\{\{industry_focus\}\}/g, lead.industry_focus || '')
    .replace(/\{\{phone\}\}/g, lead.phone || '')
    .replace(/\{\{website\}\}/g, lead.website || '');
}

// Deduplicate leads by email address
function dedupeByEmail(leads: Lead[]): Lead[] {
  const seen = new Set<string>();
  return leads.filter(l => {
    if (!l.email || seen.has(l.email.toLowerCase())) return false;
    seen.add(l.email.toLowerCase());
    return true;
  });
}

const BulkEmailModal: React.FC<BulkEmailModalProps> = ({ isOpen, onClose, leads }) => {
  const [templates, setTemplates]       = useState<TemplateEntry[]>([]);
  const [selectedTpl, setSelectedTpl]   = useState('');
  const [subject, setSubject]           = useState(DEFAULT_SUBJECT);
  const [body, setBody]                 = useState(DEFAULT_BODY);
  const [countryFilter, setCountryFilter] = useState('all');
  const [showCountry, setShowCountry]   = useState(false);
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [sendState, setSendState]       = useState<SendState>('idle');
  const [results, setResults]           = useState<LeadResult[]>([]);
  const [progress, setProgress]         = useState(0);

  // All unique countries from leads with emails
  const countries = useMemo(() => {
    const c = [...new Set(leads.filter(l => l.email).map(l => l.country || 'Unknown'))].sort();
    return c;
  }, [leads]);

  // Eligible leads: must have email, deduplicated
  const eligible = useMemo(() => dedupeByEmail(
    leads.filter(l => l.email)
  ), [leads]);

  // Filtered eligible leads by country
  const filtered = useMemo(() =>
    countryFilter === 'all'
      ? eligible
      : eligible.filter(l => (l.country || 'Unknown') === countryFilter),
    [eligible, countryFilter]
  );

  // When filter changes, auto-select all
  useEffect(() => {
    setSelected(new Set(filtered.map(l => l.id!)));
  }, [filtered]);

  useEffect(() => {
    if (!isOpen) return;
    fetchTemplates();
    setSubject(DEFAULT_SUBJECT);
    setBody(DEFAULT_BODY);
    setSendState('idle');
    setResults([]);
    setProgress(0);
    setSelectedTpl('');
    setCountryFilter('all');
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
    setSubject(tpl.subject);
    setBody(tpl.body);
  };

  const toggleLead = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(l => l.id!)));
  };

  const selectedLeads = filtered.filter(l => selected.has(l.id!));

  const handleSend = async () => {
    if (selectedLeads.length === 0) return;
    setSendState('sending');
    setProgress(0);
    setResults([]);

    const { data: { user } } = await supabase.auth.getUser();
    const allResults: LeadResult[] = [];

    for (let i = 0; i < selectedLeads.length; i++) {
      const lead = selectedLeads[i];
      const filledSubject = applyVars(subject, lead);
      const filledBody    = applyVars(body, lead).replace(/\n/g, '<br>');

      const result = await sendEmailViaServer({
        to: [lead.email],
        subject: filledSubject,
        body: filledBody,
      });

      // Log to lead_email_logs
      try {
        if (user) {
          await supabase.from('lead_email_logs').insert([{
            user_id:  user.id,
            lead_id:  lead.id,
            to_email: lead.email,
            subject:  filledSubject,
            body:     applyVars(body, lead),
            status:   result.ok ? 'sent' : 'failed',
            sent_at:  new Date().toISOString(),
          }]);
          if (result.ok) {
            await supabase.from('leads').update({
              last_contact_date: new Date().toISOString().split('T')[0],
              status: lead.status === 'new' ? 'contacted' : lead.status,
            }).eq('id', lead.id!);
          }
        }
      } catch { /* non-fatal */ }

      allResults.push({
        leadId: lead.id!, company: lead.company_name, email: lead.email,
        ok: result.ok, error: result.error,
      });
      setResults([...allResults]);
      setProgress(Math.round(((i + 1) / selectedLeads.length) * 100));

      // Small delay to avoid rate limits
      if (i < selectedLeads.length - 1) await new Promise(r => setTimeout(r, 400));
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
                <p className="text-xs text-gray-500 mt-0.5">
                  Send outreach to LWG leads via office@jildimpex.com
                </p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Recipient selection ── */}
          <div className="p-5 border-b border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Recipients</p>

              {/* Country filter */}
              <div className="relative">
                <button
                  onClick={() => setShowCountry(!showCountry)}
                  disabled={sendState !== 'idle'}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-gray-200 rounded-xl shadow-sm hover:border-gray-300 text-slate-600 disabled:opacity-50"
                >
                  {countryFilter === 'all' ? 'All countries' : countryFilter}
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                </button>
                {showCountry && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowCountry(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden min-w-[180px] max-h-60 overflow-y-auto">
                      <button onClick={() => { setCountryFilter('all'); setShowCountry(false); }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-gray-50 ${countryFilter === 'all' ? 'text-blue-600 bg-blue-50/60' : 'text-slate-700'}`}>
                        All countries
                        <span className="ml-1 text-gray-400 font-normal">({eligible.length})</span>
                      </button>
                      {countries.map(c => {
                        const cnt = eligible.filter(l => (l.country || 'Unknown') === c).length;
                        return (
                          <button key={c} onClick={() => { setCountryFilter(c); setShowCountry(false); }}
                            className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-gray-50 ${countryFilter === c ? 'text-blue-600 bg-blue-50/60' : 'text-slate-700'}`}>
                            {c}
                            <span className="ml-1 text-gray-400 font-normal">({cnt})</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center">
                <Users className="h-6 w-6 text-gray-300 mx-auto mb-1" />
                <p className="text-xs text-gray-400">No leads with email addresses in this country</p>
              </div>
            ) : (
              <>
                {/* Select all toggle */}
                <div className="flex items-center justify-between">
                  <button onClick={toggleAll} disabled={sendState !== 'idle'}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50">
                    {selected.size === filtered.length ? 'Deselect all' : `Select all (${filtered.length})`}
                  </button>
                  <span className="text-xs text-gray-400 font-medium">{selected.size} selected</span>
                </div>

                {/* Lead list */}
                <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100 max-h-44 overflow-y-auto">
                  {filtered.map(lead => {
                    const result = results.find(r => r.leadId === lead.id);
                    return (
                      <label key={lead.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${sendState !== 'idle' ? 'cursor-default' : ''}`}>
                        <input
                          type="checkbox"
                          checked={selected.has(lead.id!)}
                          onChange={() => sendState === 'idle' && toggleLead(lead.id!)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 accent-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{lead.company_name}</p>
                          <p className="text-[11px] text-gray-400 truncate">{lead.email}</p>
                        </div>
                        {lead.country && (
                          <span className="text-[10px] text-gray-400 font-medium shrink-0">{lead.country}</span>
                        )}
                        {/* Send result icon */}
                        {result && (
                          result.ok
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            : <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                        )}
                        {!result && sendState === 'sending' && selected.has(lead.id!) && (
                          <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin shrink-0" />
                        )}
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* ── Template & message ── */}
          <div className="p-5 space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Email Content</p>

            {/* Template picker */}
            {templates.length > 0 && (
              <div className="flex gap-2">
                <select
                  value={selectedTpl}
                  onChange={e => setSelectedTpl(e.target.value)}
                  disabled={sendState !== 'idle'}
                  className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white disabled:opacity-50"
                >
                  <option value="">— default cold email —</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button
                  onClick={applyTemplate}
                  disabled={!selectedTpl || sendState !== 'idle'}
                  className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors flex items-center gap-1.5"
                >
                  <Template className="h-4 w-4" /> Apply
                </button>
              </div>
            )}

            {/* Variable hint */}
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Use <code className="bg-gray-100 px-1 rounded text-gray-600">{'{{company_name}}'}</code>, <code className="bg-gray-100 px-1 rounded text-gray-600">{'{{contact_person}}'}</code>, <code className="bg-gray-100 px-1 rounded text-gray-600">{'{{country}}'}</code> — these are filled per-lead before sending.
            </p>

            {/* Subject */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Subject *</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                disabled={sendState !== 'idle'}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white disabled:bg-gray-50 disabled:opacity-70 transition-colors"
                placeholder="Email subject"
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Message *</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                disabled={sendState !== 'idle'}
                rows={10}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white disabled:bg-gray-50 disabled:opacity-70 resize-none font-mono text-[13px] leading-relaxed transition-colors"
                placeholder="Enter email body…"
              />
            </div>
          </div>

          {/* ── Progress / results ── */}
          {(sendState === 'sending' || allDone) && (
            <div className="px-5 pb-5 space-y-3">
              {sendState === 'sending' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" /> Sending…</span>
                    <span>{results.length} / {selectedLeads.length}</span>
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
                    : <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  }
                  <div className="text-sm">
                    <p className="font-bold text-slate-800">
                      {sent} email{sent !== 1 ? 's' : ''} sent successfully{failed > 0 ? `, ${failed} failed` : ''}
                    </p>
                    {failed > 0 && (
                      <div className="mt-2 space-y-1 text-xs text-amber-700">
                        {results.filter(r => !r.ok).map(r => (
                          <p key={r.leadId}>• {r.company}: {r.error || 'Unknown error'}</p>
                        ))}
                      </div>
                    )}
                    {sent > 0 && (
                      <p className="text-xs text-slate-500 mt-1">
                        Lead statuses updated to "Contacted". Activity logged on each lead.
                      </p>
                    )}
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
              disabled={sendState !== 'idle' || selectedLeads.length === 0 || !subject.trim() || !body.trim()}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {sendState === 'sending'
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                : <><Send className="h-4 w-4" /> Send to {selectedLeads.length} Lead{selectedLeads.length !== 1 ? 's' : ''}</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkEmailModal;
