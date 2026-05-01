"use client";

import React, { useEffect, useRef, useState } from 'react';
import {
  Mail, MessageCircle, ChevronDown, X, Send, Plus, Loader2, Phone,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import type { EmailTemplate, Contact } from '../../types';
import type { EmailContext } from '../../lib/emailCompose';
import { buildVarsFromContext } from '../../lib/emailCompose';
import ComposeModal from './ComposeModal';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface CommunicateButtonProps {
  contextType: EmailContext['type'];
  contextData: Record<string, any>;
  /** If provided, "Attach document PDF" button appears in compose modal */
  getPdfBase64?: () => Promise<{ base64: string; filename: string }>;
  /** Pre-built WhatsApp message override */
  whatsappMessage?: string;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function sanitizePhone(raw: string): string {
  return raw.replace(/[\s\-().+]/g, '');
}

function buildWhatsAppMessage(contextType: EmailContext['type'], data: Record<string, any>, companyName: string): string {
  if (contextType === 'contract') {
    return (
      `Dear ${data.buyer_name || 'Sir/Madam'},\n\n` +
      `Please find below the details for Contract No. ${data.contract_no || '—'}.\n` +
      (data.commodity ? `Commodity: ${data.commodity}\n` : '') +
      (data.quantity && data.unit ? `Quantity: ${data.quantity} ${data.unit}\n` : '') +
      (data.price && data.currency ? `Price: ${data.currency} ${data.price}\n` : '') +
      `\nKindly confirm receipt.\n\nRegards,\n${companyName || 'JILD IMPEX'}`
    );
  }
  if (contextType === 'letter') {
    return (
      `Dear ${data.buyer_name || 'Sir/Madam'},\n\n` +
      `This is regarding your sample / letter no. ${data.sample_number || '—'}.\n` +
      `\nPlease feel free to reach out for any queries.\n\nRegards,\n${companyName || 'JILD IMPEX'}`
    );
  }
  if (contextType === 'payment') {
    return (
      `Dear ${data.buyer_name || 'Sir/Madam'},\n\n` +
      `This is a reminder for payment of Debit Note No. ${data.debit_note_no || '—'}` +
      (data.amount ? ` — Amount: ${data.currency || 'USD'} ${data.amount}` : '') +
      `.\n\nPlease confirm receipt of this message.\n\nRegards,\n${companyName || 'JILD IMPEX'}`
    );
  }
  return `Hello,\n\nPlease find the details below.\n\nRegards,\n${companyName || 'JILD IMPEX'}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

const CommunicateButton: React.FC<CommunicateButtonProps> = ({
  contextType, contextData, getPdfBase64, whatsappMessage, className = '',
}) => {
  const { user } = useAuth();

  /* main dropdown */
  const [menuOpen, setMenuOpen]     = useState(false);
  const menuRef                     = useRef<HTMLDivElement>(null);

  /* email flow */
  const [templates, setTemplates]                = useState<EmailTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates]  = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate]  = useState<EmailTemplate | null>(null);

  /* whatsapp flow */
  const [waPreviewOpen, setWaPreviewOpen] = useState(false);
  const [waMessage, setWaMessage]         = useState('');
  const [waPhone, setWaPhone]             = useState('');
  const [contacts, setContacts]           = useState<Contact[]>([]);
  const [companyName, setCompanyName]     = useState('');

  /* load contacts + company once */
  useEffect(() => {
    if (!user) return;
    supabase.from('contact_book').select('*').eq('user_id', user.id)
      .then(({ data }) => setContacts((data || []) as Contact[])).catch(() => {});
    supabase.from('companies').select('name').limit(1).maybeSingle()
      .then(({ data }) => setCompanyName(data?.name || '')).catch(() => {});
  }, [user?.id]);

  /* load templates (filtered by context) */
  useEffect(() => {
    if (!user) return;
    setLoadingTemplates(true);
    supabase.from('email_templates').select('*').eq('user_id', user.id).order('name')
      .then(({ data }) => {
        const all = (data || []) as EmailTemplate[];
        setTemplates(all.filter((t) => t.context === contextType || t.context === 'general'));
        setLoadingTemplates(false);
      });
  }, [user?.id, contextType]);

  /* close main menu on outside click */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setTemplatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* find contact phone from context */
  const findContactPhone = () => {
    const vars = buildVarsFromContext({ type: contextType, data: contextData }, companyName);
    const targetName = (vars.supplier_name || vars.buyer_name || '').toLowerCase();
    if (!targetName) return '';
    const match = contacts.find((c) =>
      c.name.toLowerCase().includes(targetName) || targetName.includes(c.name.toLowerCase()));
    return match?.phone || '';
  };

  const openWhatsApp = () => {
    const msg = whatsappMessage || buildWhatsAppMessage(contextType, contextData, companyName);
    setWaMessage(msg);
    setWaPhone(findContactPhone());
    setMenuOpen(false);
    setWaPreviewOpen(true);
  };

  const sendWhatsApp = () => {
    const raw = waPhone.trim();
    if (!raw) { alert('Please enter a WhatsApp number.'); return; }
    const phone = sanitizePhone(raw);
    const encoded = encodeURIComponent(waMessage);
    window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank', 'noopener');
    setWaPreviewOpen(false);
  };

  const openEmailFlow = () => {
    setMenuOpen(false);
    setTemplatePickerOpen(true);
  };

  const context: EmailContext = { type: contextType, data: contextData };

  return (
    <>
      {/* ── Trigger button ── */}
      <div className="relative inline-block" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((p) => !p)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 active:scale-95 transition ${className}`}
        >
          <Send className="h-4 w-4" />
          Send message
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>

        {/* ── Main choice dropdown ── */}
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1.5 z-[200] w-52 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Send via</p>
            </div>

            {/* Email */}
            <button
              onClick={openEmailFlow}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 border-b border-slate-100 transition"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800">Email</p>
                <p className="text-[10px] text-slate-500">Compose & send via Zoho</p>
              </div>
            </button>

            {/* WhatsApp */}
            <button
              onClick={openWhatsApp}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <MessageCircle className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800">WhatsApp</p>
                <p className="text-[10px] text-slate-500">Opens WhatsApp with message</p>
              </div>
            </button>
          </div>
        )}

        {/* ── Template picker (email) ── */}
        {templatePickerOpen && !selectedTemplate && (
          <div className="absolute right-0 top-full mt-1.5 z-[200] w-72 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select email template</p>
              <button onClick={() => setTemplatePickerOpen(false)} className="p-0.5 rounded hover:bg-slate-100 transition">
                <X className="h-3.5 w-3.5 text-slate-400" />
              </button>
            </div>

            {loadingTemplates ? (
              <div className="flex items-center gap-2 p-4 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : templates.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs text-slate-500 mb-2">No templates yet</p>
                <a href="/app/email-templates" className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
                  <Plus className="h-3.5 w-3.5" /> Create a template
                </a>
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedTemplate(t); setTemplatePickerOpen(false); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition"
                  >
                    <div className="text-xs font-bold text-slate-800">{t.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{t.subject}</div>
                    <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                      t.context === 'general' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-600'
                    }`}>{t.context}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="border-t border-slate-100 px-3 py-2">
              <a href="/app/email-templates" className="text-[10px] text-blue-600 hover:underline font-bold">
                Manage templates →
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ── Compose modal ── */}
      {selectedTemplate && (
        <ComposeModal
          template={selectedTemplate}
          context={context}
          getPdfBase64={getPdfBase64}
          onSent={() => setSelectedTemplate(null)}
          onClose={() => setSelectedTemplate(null)}
        />
      )}

      {/* ── WhatsApp preview modal ── */}
      {waPreviewOpen && (
        <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setWaPreviewOpen(false)}>
          <div
            className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <MessageCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-black text-slate-900">Send via WhatsApp</h2>
                <p className="text-[10px] text-slate-500">Review and edit the message before opening WhatsApp</p>
              </div>
              <button onClick={() => setWaPreviewOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Phone */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                  <Phone className="inline h-3 w-3 mr-1" /> WhatsApp number (with country code)
                </label>
                <input
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  placeholder="+971 50 123 4567"
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Message preview */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Message</label>
                <textarea
                  value={waMessage}
                  onChange={(e) => setWaMessage(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none resize-y font-sans"
                />
              </div>

              {/* WhatsApp preview bubble */}
              <div className="bg-[#e5ddd5] rounded-2xl p-3">
                <div className="max-w-xs bg-white rounded-xl rounded-tl-none px-3 py-2 shadow-sm">
                  <pre className="text-[11px] text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">{waMessage}</pre>
                  <p className="text-[9px] text-slate-400 text-right mt-1">sent</p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 px-5 py-3 flex justify-end gap-2 shrink-0 bg-white">
              <button onClick={() => setWaPreviewOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition">
                Cancel
              </button>
              <button
                onClick={sendWhatsApp}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition"
              >
                <MessageCircle className="h-4 w-4" /> Open WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CommunicateButton;
