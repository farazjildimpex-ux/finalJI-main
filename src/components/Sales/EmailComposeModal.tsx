import React, { useState, useEffect } from 'react';
import { X, Send, LayoutTemplate as Template, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Lead } from '../../types';
import { dialogService } from '../../lib/dialogService';
import { sendEmailViaServer } from '../../lib/emailCompose';

interface EmailComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  onEmailSent: () => void;
}

interface EmailTemplateEntry {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  is_active: boolean;
}

const inputCls = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white transition-colors';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5';

const COLD_EMAIL_TEMPLATE = {
  subject: 'JILD IMPEX — Premium Leather Sourcing Partnership',
  body: `Dear {{contact_person}},

I hope this message finds you well.

My name is Faraz, and I represent JILD IMPEX, a Chennai-based leather trading company specialising in high-quality finished and semi-finished leather for the global market.

We noticed that {{company_name}} is an LWG-certified tannery, and we believe there may be a strong synergy between our businesses. We are actively looking to establish long-term sourcing partnerships with quality-focused manufacturers like yourselves.

We would love to explore the possibility of working together — whether for regular supply arrangements or specific product requirements.

Could we schedule a brief call or exchange product specifications at your earliest convenience?

Looking forward to hearing from you.

Warm regards,
Faraz
JILD IMPEX
Chennai, India
Email: office@jildimpex.com
Mob: +91 98410 91189`,
};

const EmailComposeModal: React.FC<EmailComposeModalProps> = ({
  isOpen, onClose, lead, onEmailSent
}) => {
  const [templates, setTemplates]               = useState<EmailTemplateEntry[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [loading, setLoading]                   = useState(false);
  const [emailData, setEmailData]               = useState({ to: '', subject: '', body: '' });
  const [sendResult, setSendResult]             = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!isOpen) { setSendResult(null); return; }
    fetchTemplates();
    if (lead) {
      setEmailData({
        to: lead.email,
        subject: COLD_EMAIL_TEMPLATE.subject,
        body: applyVars(COLD_EMAIL_TEMPLATE.body, lead),
      });
    }
  }, [isOpen, lead?.id]);

  function applyVars(text: string, l: Lead): string {
    return text
      .replace(/\{\{company_name\}\}/g, l.company_name || '')
      .replace(/\{\{contact_person\}\}/g, l.contact_person || '')
      .replace(/\{\{email\}\}/g, l.email || '')
      .replace(/\{\{country\}\}/g, l.country || '')
      .replace(/\{\{industry_focus\}\}/g, l.industry_focus || '')
      .replace(/\{\{phone\}\}/g, l.phone || '')
      .replace(/\{\{website\}\}/g, l.website || '');
  }

  const fetchTemplates = async () => {
    try {
      const { data } = await supabase
        .from('email_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');
      setTemplates(data || []);
    } catch { /* templates optional */ }
  };

  const applyTemplate = (templateId: string) => {
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl || !lead) return;
    setEmailData({
      to: lead.email,
      subject: applyVars(tpl.subject, lead),
      body: applyVars(tpl.body, lead),
    });
    setSelectedTemplate(templateId);
    setSendResult(null);
  };

  const handleSend = async () => {
    if (!lead) return;
    if (!emailData.to) {
      dialogService.alert({ title: 'No email address', message: 'This lead has no email address on record.', tone: 'warning' });
      return;
    }
    if (!emailData.subject || !emailData.body) {
      dialogService.alert({ title: 'Incomplete email', message: 'Please fill in subject and message.', tone: 'warning' });
      return;
    }

    setLoading(true);
    setSendResult(null);

    // Send via Gmail
    const result = await sendEmailViaServer({
      to: [emailData.to],
      subject: emailData.subject,
      body: emailData.body.replace(/\n/g, '<br>'),
    });

    // Log to lead_email_logs regardless
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('lead_email_logs').insert([{
          user_id:     user.id,
          lead_id:     lead.id,
          template_id: selectedTemplate || null,
          to_email:    emailData.to,
          subject:     emailData.subject,
          body:        emailData.body,
          status:      result.ok ? 'sent' : 'failed',
          sent_at:     new Date().toISOString(),
        }]);
        if (result.ok) {
          await supabase.from('leads').update({
            last_contact_date: new Date().toISOString().split('T')[0],
            status: lead.status === 'new' ? 'contacted' : lead.status,
          }).eq('id', lead.id!);
        }
      }
    } catch { /* log failure is non-fatal */ }

    setLoading(false);
    setSendResult({
      ok: result.ok,
      msg: result.ok ? 'Email sent successfully!' : (result.error || 'Send failed — check Gmail is connected in Settings.'),
    });

    if (result.ok) {
      setTimeout(() => { onEmailSent(); onClose(); }, 1800);
    }
  };

  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">Send Cold Email</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              To: <span className="font-medium text-slate-700">{lead.company_name}</span>
              {lead.contact_person && <> · {lead.contact_person}</>}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Result banner */}
          {sendResult && (
            <div className={`flex items-center gap-3 p-3 rounded-2xl border ${sendResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {sendResult.ok
                ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                : <AlertCircle className="h-4 w-4 shrink-0" />
              }
              <p className="text-xs font-semibold">{sendResult.msg}</p>
            </div>
          )}

          {/* Template picker */}
          {templates.length > 0 && (
            <div>
              <label className={labelCls}>Use Saved Template</label>
              <div className="flex gap-2">
                <select
                  value={selectedTemplate}
                  onChange={e => setSelectedTemplate(e.target.value)}
                  className={`flex-1 ${inputCls}`}
                >
                  <option value="">— or use default cold email below —</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.category.replace('_', ' ')})</option>
                  ))}
                </select>
                <button
                  onClick={() => applyTemplate(selectedTemplate)}
                  disabled={!selectedTemplate}
                  className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors flex items-center gap-1.5"
                >
                  <Template className="h-4 w-4" /> Apply
                </button>
              </div>
            </div>
          )}

          {/* To */}
          <div>
            <label className={labelCls}>To</label>
            {lead.email
              ? <input type="email" value={emailData.to} readOnly className={`${inputCls} bg-gray-50 text-gray-500 cursor-not-allowed`} />
              : <div className="flex items-center gap-2 px-3 py-2.5 text-sm bg-amber-50 border border-amber-200 rounded-xl text-amber-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  No email address for this lead
                </div>
            }
          </div>

          {/* Subject */}
          <div>
            <label className={labelCls}>Subject *</label>
            <input
              type="text"
              value={emailData.subject}
              onChange={e => setEmailData({ ...emailData, subject: e.target.value })}
              className={inputCls}
              placeholder="Enter email subject"
            />
          </div>

          {/* Body */}
          <div>
            <label className={labelCls}>Message *</label>
            <textarea
              value={emailData.body}
              onChange={e => setEmailData({ ...emailData, body: e.target.value })}
              rows={12}
              className={`${inputCls} resize-none font-mono text-[13px] leading-relaxed`}
              placeholder="Enter your message here…"
            />
          </div>

          {/* Lead info chips */}
          <div className="flex flex-wrap gap-2">
            {lead.country && (
              <span className="px-2.5 py-1 text-xs rounded-xl bg-teal-50 text-teal-700 border border-teal-100 font-medium">
                {lead.country}
              </span>
            )}
            {lead.industry_focus && (
              <span className="px-2.5 py-1 text-xs rounded-xl bg-gray-100 text-gray-600 font-medium">
                {lead.industry_focus}
              </span>
            )}
            {(lead.tags || []).map(t => (
              <span key={t} className="px-2.5 py-1 text-xs rounded-xl bg-blue-50 text-blue-600 font-medium">{t}</span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-3xl flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={loading || !emailData.subject || !emailData.body || !lead.email}
            className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Send className="h-4 w-4" />
            {loading ? 'Sending…' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailComposeModal;
