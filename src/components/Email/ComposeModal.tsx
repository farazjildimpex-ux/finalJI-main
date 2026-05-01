"use client";

import React, { useEffect, useRef, useState } from 'react';
import {
  X, Send, Paperclip, Eye, EyeOff, ChevronDown, AlertCircle,
  CheckCircle2, Loader2, Mail, User,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import {
  renderTemplate, buildVarsFromContext, sendEmailViaServer, logEmail,
  type EmailContext,
} from '../../lib/emailCompose';
import type { EmailTemplate, Contact } from '../../types';

interface ComposeModalProps {
  /** The template to use (required — select it before opening). */
  template: EmailTemplate;
  /** Context data used to fill template variables. */
  context: EmailContext;
  /** If provided the PDF is attached automatically. */
  pdfBase64?: string;
  pdfFileName?: string;
  /** Called after the email is sent successfully. */
  onSent?: () => void;
  onClose: () => void;
}

const ComposeModal: React.FC<ComposeModalProps> = ({
  template, context, pdfBase64, pdfFileName, onSent, onClose,
}) => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [toInput, setToInput]   = useState('');
  const [toList, setToList]     = useState<string[]>([]);
  const [ccInput, setCcInput]   = useState('');
  const [ccList, setCcList]     = useState<string[]>([]);
  const [subject, setSubject]   = useState('');
  const [body, setBody]         = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentB64, setAttachmentB64]   = useState<string | null>(pdfBase64 || null);
  const [attachmentName, setAttachmentName] = useState(pdfFileName || '');
  const fileRef = useRef<HTMLInputElement>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');

  // Load contacts + company name for template rendering.
  useEffect(() => {
    if (!user) return;
    supabase.from('contact_book').select('*').eq('user_id', user.id).then(({ data }) => {
      setContacts((data || []) as Contact[]);
    }).catch(() => {});
    supabase.from('companies').select('name').limit(1).maybeSingle().then(({ data }) => {
      setCompanyName(data?.name || '');
    }).catch(() => {});
  }, [user?.id]);

  // Render template whenever it or context changes.
  useEffect(() => {
    const vars = buildVarsFromContext(context, companyName);
    setSubject(renderTemplate(template.subject, vars));
    setBody(renderTemplate(template.body, vars));
  }, [template.id, context.type, companyName]);

  // Pre-fill To/CC from context's supplier/buyer if we can match a contact.
  useEffect(() => {
    if (!contacts.length) return;
    const vars = buildVarsFromContext(context, companyName);
    const targetName = (vars.supplier_name || vars.buyer_name || '').toLowerCase();
    if (!targetName) return;
    const match = contacts.find((c) => c.name.toLowerCase().includes(targetName) || targetName.includes(c.name.toLowerCase()));
    if (!match) return;
    if (match.email?.length && toList.length === 0) {
      setToList(match.email.filter(Boolean));
    }
    if (match.email_cc?.length && ccList.length === 0) {
      setCcList(match.email_cc.filter(Boolean));
    }
  }, [contacts, context.type, companyName]);

  const addAddress = (val: string, list: string[], setList: (v: string[]) => void, clearInput: () => void) => {
    const emails = val.split(/[,;\s]+/).map((e) => e.trim()).filter((e) => e.includes('@'));
    if (!emails.length) return;
    setList([...new Set([...list, ...emails])]);
    clearInput();
  };

  const removeAddress = (idx: number, list: string[], setList: (v: string[]) => void) => {
    setList(list.filter((_, i) => i !== idx));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAttachmentFile(f);
    setAttachmentName(f.name);
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(',')[1];
      setAttachmentB64(b64);
    };
    reader.readAsDataURL(f);
  };

  const handleSend = async () => {
    if (!toList.length) { setError('Add at least one To address.'); return; }
    if (!subject.trim()) { setError('Subject cannot be empty.'); return; }
    setError(null);
    setBusy(true);

    const result = await sendEmailViaServer({
      to:              toList,
      cc:              ccList.length ? ccList : undefined,
      subject,
      body,
      attachmentBase64: attachmentB64 || undefined,
      attachmentName:   attachmentName || undefined,
      attachmentMime:   attachmentFile?.type || 'application/pdf',
    });

    await logEmail(supabase, user!.id, {
      templateId:     template.id,
      contextType:    context.type,
      contextId:      (context.data as any)?.contract_no || (context.data as any)?.sample_number || (context.data as any)?.id,
      to:             toList,
      cc:             ccList,
      subject,
      body,
      attachmentName: attachmentName || undefined,
      status:         result.ok ? 'sent' : 'failed',
      errorMessage:   result.error,
    });

    setBusy(false);

    if (result.ok) {
      setSuccess(true);
      setTimeout(() => { onSent?.(); onClose(); }, 1500);
    } else {
      setError(result.error || 'Failed to send email.');
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-black text-slate-900">Compose email</h2>
              <p className="text-[10px] text-slate-500">Template: {template.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview((p) => !p)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showPreview ? 'Edit' : 'Preview'}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Success overlay */}
        {success && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center py-10">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-sm font-black text-slate-900">Email sent!</p>
            </div>
          </div>
        )}

        {!success && (
          <div className="flex-1 overflow-y-auto">
            {showPreview ? (
              /* Preview pane */
              <div className="px-5 py-4 space-y-4">
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                    <div className="text-[11px] text-slate-500"><span className="font-bold">To:</span> {toList.join(', ') || '—'}</div>
                    {ccList.length > 0 && <div className="text-[11px] text-slate-500"><span className="font-bold">CC:</span> {ccList.join(', ')}</div>}
                    <div className="text-[11px] text-slate-500"><span className="font-bold">Subject:</span> {subject}</div>
                    {(attachmentB64 || attachmentFile) && (
                      <div className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                        <Paperclip className="h-3 w-3" /><span className="font-bold">Attachment:</span> {attachmentName}
                      </div>
                    )}
                  </div>
                  <div
                    className="p-4 text-[12px] text-slate-800 prose prose-sm max-w-none whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: body.replace(/\n/g, '<br />') }}
                  />
                </div>
              </div>
            ) : (
              /* Edit pane */
              <div className="px-5 py-4 space-y-4">
                {/* To */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">To *</label>
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {toList.map((e, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700">
                        {e} <button onClick={() => removeAddress(i, toList, setToList)} className="text-blue-400 hover:text-red-500"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={toInput}
                      onChange={(e) => setToInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          addAddress(toInput, toList, setToList, () => setToInput(''));
                        }
                      }}
                      placeholder="email@example.com  (press Enter or , to add)"
                      className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                    {/* Contact picker */}
                    <div className="relative">
                      <button
                        onClick={() => setContactOpen((p) => !p)}
                        className="h-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 hover:bg-slate-50 inline-flex items-center gap-1"
                      >
                        <User className="h-3.5 w-3.5" /> <ChevronDown className="h-3 w-3" />
                      </button>
                      {contactOpen && (
                        <div className="absolute right-0 top-full mt-1 z-10 w-60 bg-white border border-slate-200 rounded-xl shadow-lg overflow-auto max-h-52">
                          {contacts.length === 0 && <p className="p-3 text-xs text-slate-500">No contacts</p>}
                          {contacts.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => {
                                if (c.email?.length) addAddress(c.email[0], toList, setToList, () => {});
                                if (c.email_cc?.length) setCcList((p) => [...new Set([...p, ...c.email_cc!])]);
                                setContactOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 border-b border-slate-100 last:border-0"
                            >
                              <div className="font-bold text-slate-800">{c.name}</div>
                              {c.contact_person && <div className="text-slate-500">{c.contact_person}</div>}
                              <div className="text-slate-400 truncate">{c.email?.join(', ')}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* CC */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">CC</label>
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {ccList.map((e, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                        {e} <button onClick={() => removeAddress(i, ccList, setCcList)} className="text-slate-400 hover:text-red-500"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                  <input
                    value={ccInput}
                    onChange={(e) => setCcInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addAddress(ccInput, ccList, setCcList, () => setCcInput(''));
                      }
                    }}
                    placeholder="cc@example.com"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Subject *</label>
                  <input value={subject} onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                </div>

                {/* Body */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Body</label>
                  <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono resize-y" />
                </div>

                {/* Attachment */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Attachment</label>
                  {attachmentB64 ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                      <Paperclip className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span className="flex-1 truncate font-semibold">{attachmentName}</span>
                      <button onClick={() => { setAttachmentB64(null); setAttachmentFile(null); setAttachmentName(''); }}
                        className="text-red-500 hover:text-red-700">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => fileRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-dashed border-slate-300 hover:bg-slate-50 text-slate-600">
                        <Paperclip className="h-3.5 w-3.5" /> Attach file (PDF, image…)
                      </button>
                      <input ref={fileRef} type="file" className="hidden" accept="*/*" onChange={handleFileChange} />
                    </>
                  )}
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!success && (
          <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between gap-3 bg-white">
            <div className="text-[10px] text-slate-500">
              Sent via <span className="font-bold">Zoho Mail</span>
            </div>
            <div className="flex gap-2">
              <button onClick={onClose}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200">
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={busy || !toList.length}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 active:scale-95 transition"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {busy ? 'Sending…' : 'Send email'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComposeModal;
