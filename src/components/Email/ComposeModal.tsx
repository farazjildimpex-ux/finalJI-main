"use client";

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  X, Send, Paperclip, Eye, EyeOff, AlertCircle,
  CheckCircle2, Loader2, Mail, Users, FileText, Inbox, Search,
  XCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import {
  renderTemplate, buildVarsFromContext, sendEmailViaServer, logEmail,
  type EmailContext,
} from '../../lib/emailCompose';
import type { EmailTemplate, Contact } from '../../types';
import RichTextEditor from './RichTextEditor';

interface GmailAttachment {
  messageId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  date: string;
}

interface ComposeModalProps {
  template: EmailTemplate;
  context: EmailContext;
  pdfBase64?: string;
  pdfFileName?: string;
  getPdfBase64?: () => Promise<{ base64: string; filename: string }>;
  onSent?: () => void;
  onClose: () => void;
}

/* Stable key from context data */
function ctxKey(ctx: EmailContext) {
  const d = ctx.data as Record<string, unknown>;
  return `${ctx.type}|${d?.contract_no ?? d?.sample_number ?? d?.debit_note_no ?? d?.id ?? ''}`;
}

/* Bigram similarity */
function bigrams(s: string): Set<string> {
  const b = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) b.add(s.slice(i, i + 2));
  return b;
}
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const ba = bigrams(a); const bb = bigrams(b);
  let n = 0; ba.forEach((g) => { if (bb.has(g)) n++; });
  return (2 * n) / (ba.size + bb.size);
}

/* Insert/replace greeting in HTML body */
function applyGreeting(html: string, name: string): string {
  const greeting = name
    ? `Dear ${name},`
    : 'Dear Sir/Madam,';
  // If body starts with "Dear" (case-insensitive), replace that line
  if (/^<?(p[^>]*>)?Dear\b/i.test(html.trim())) {
    return html.replace(/^(<p[^>]*>)?Dear[^<\n,]*[,]?/i, `$1${greeting}`);
  }
  // Otherwise prepend
  return `<p>${greeting}</p><p><br></p>${html}`;
}

/* Toast component */
const Toast: React.FC<{ ok: boolean; message: string; onDone: () => void }> = ({ ok, message, onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1300] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-2xl text-sm font-bold text-white ${
        ok ? 'bg-emerald-600' : 'bg-red-600'
      }`}>
        {ok
          ? <CheckCircle2 className="h-5 w-5 shrink-0" />
          : <XCircle className="h-5 w-5 shrink-0" />}
        {message}
      </div>
    </div>
  );
};

const ComposeModal: React.FC<ComposeModalProps> = ({
  template, context, pdfBase64, pdfFileName, getPdfBase64, onSent, onClose,
}) => {
  const { user } = useAuth();
  const [contacts, setContacts]         = useState<Contact[]>([]);
  const [toInput, setToInput]           = useState('');
  const [toList, setToList]             = useState<string[]>([]);
  const [ccInput, setCcInput]           = useState('');
  const [ccList, setCcList]             = useState<string[]>([]);
  const [subject, setSubject]           = useState('');
  const [body, setBody]                 = useState('');
  const [showPreview, setShowPreview]   = useState(false);
  const [busy, setBusy]                 = useState(false);
  const [toast, setToast]               = useState<{ ok: boolean; msg: string } | null>(null);
  const [attachmentB64, setAttachmentB64]   = useState<string | null>(pdfBase64 || null);
  const [attachmentName, setAttachmentName] = useState(pdfFileName || '');
  const [attachmentMime, setAttachmentMime] = useState('application/pdf');
  const fileRef = useRef<HTMLInputElement>(null);
  const [companyName, setCompanyName]   = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [contactPanelOpen, setContactPanelOpen] = useState(false);
  const [contactSearch, setContactSearch]       = useState('');
  const [gmailPickerOpen, setGmailPickerOpen]     = useState(false);
  const [gmailAttachments, setGmailAttachments]   = useState<GmailAttachment[]>([]);
  const [loadingGmail, setLoadingGmail]           = useState(false);
  const [fetchingAttachment, setFetchingAttachment] = useState<string | null>(null);

  /* ---- Load contacts & company ---- */
  useEffect(() => {
    if (!user) return;
    supabase.from('contact_book').select('*').eq('user_id', user.id)
      .then(({ data }) => setContacts((data || []) as Contact[])).catch(() => {});
    supabase.from('companies').select('name').limit(1).maybeSingle()
      .then(({ data }) => setCompanyName(data?.name || '')).catch(() => {});
  }, [user?.id]);

  /* ---- Render template ---- */
  useEffect(() => {
    const vars = buildVarsFromContext(context, companyName);
    setSubject(renderTemplate(template.subject, vars));
    setBody(renderTemplate(template.body, vars));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id, ctxKey(context), companyName]);

  /* ---- Pre-fill To/CC from matched contact ---- */
  useEffect(() => {
    if (!contacts.length) return;
    const vars = buildVarsFromContext(context, companyName);
    const targetNames = [vars.buyer_name, vars.supplier_name]
      .filter(Boolean).map((n) => n!.toLowerCase().trim());
    if (!targetNames.length) return;

    const match = contacts.find((c) => {
      const cname = c.name.toLowerCase();
      return targetNames.some(
        (t) => cname.includes(t) || t.includes(cname) || similarity(cname, t) > 0.6
      );
    });
    if (!match) return;

    if (match.email?.length && toList.length === 0) {
      setToList(match.email.filter(Boolean));
    }
    if (match.email_cc?.length && ccList.length === 0) {
      setCcList(match.email_cc.filter(Boolean));
    }
    // Apply greeting
    const greetingName = match.contact_person || match.name || '';
    setBody((prev) => applyGreeting(prev, greetingName));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts.length, ctxKey(context), companyName]);

  /* ---- Filtered contacts ---- */
  const filteredContacts = useMemo(() => {
    const q = contactSearch.toLowerCase().trim();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.contact_person?.toLowerCase().includes(q) ||
        c.email?.some((e) => e.toLowerCase().includes(q))
    );
  }, [contacts, contactSearch]);

  /* ---- Address helpers ---- */
  const addAddress = (val: string, list: string[], setList: (v: string[]) => void, clear: () => void) => {
    const emails = val.split(/[,;\s]+/).map((e) => e.trim()).filter((e) => e.includes('@'));
    if (!emails.length) return;
    setList([...new Set([...list, ...emails])]);
    clear();
  };

  const removeAddr = (idx: number, list: string[], setList: (v: string[]) => void) =>
    setList(list.filter((_, i) => i !== idx));

  /* ---- Pick contact ---- */
  const pickContact = (c: Contact) => {
    if (c.email?.length) addAddress(c.email[0], toList, setToList, () => {});
    if (c.email_cc?.length) setCcList((p) => [...new Set([...p, ...c.email_cc!])]);
    const greetingName = c.contact_person || c.name || '';
    setBody((prev) => applyGreeting(prev, greetingName));
    setContactPanelOpen(false);
    setContactSearch('');
  };

  /* ---- File attachment ---- */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAttachmentMime(f.type || 'application/octet-stream');
    setAttachmentName(f.name);
    const reader = new FileReader();
    reader.onload = () => setAttachmentB64((reader.result as string).split(',')[1]);
    reader.readAsDataURL(f);
  };

  const handleAttachPdf = async () => {
    if (!getPdfBase64) return;
    setGeneratingPdf(true);
    try {
      const { base64, filename } = await getPdfBase64();
      setAttachmentB64(base64);
      setAttachmentName(filename);
      setAttachmentMime('application/pdf');
    } catch (e: any) {
      setToast({ ok: false, msg: 'PDF generation failed: ' + (e?.message || 'unknown error') });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const clearAttachment = () => {
    setAttachmentB64(null);
    setAttachmentName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  /* ---- Gmail picker ---- */
  const openGmailPicker = async () => {
    setGmailPickerOpen(true);
    if (gmailAttachments.length) return;
    setLoadingGmail(true);
    try {
      const res = await fetch('/api/gmail/recent-attachments');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setGmailAttachments(data.attachments || []);
    } catch (e: any) {
      setToast({ ok: false, msg: 'Gmail: ' + (e?.message || 'check Gmail connection') });
    } finally {
      setLoadingGmail(false);
    }
  };

  const pickGmailAttachment = async (att: GmailAttachment) => {
    setFetchingAttachment(att.attachmentId);
    try {
      const res = await fetch(
        `/api/gmail/attachment?messageId=${att.messageId}&attachmentId=${att.attachmentId}&filename=${encodeURIComponent(att.filename)}`
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAttachmentB64(data.base64);
      setAttachmentName(att.filename);
      setAttachmentMime(att.mimeType || 'application/pdf');
      setGmailPickerOpen(false);
    } catch (e: any) {
      setToast({ ok: false, msg: 'Could not fetch attachment: ' + (e?.message || '') });
    } finally {
      setFetchingAttachment(null);
    }
  };

  /* ---- Send ---- */
  const handleSend = async () => {
    if (!toList.length) { setToast({ ok: false, msg: 'Add at least one To address.' }); return; }
    if (!subject.trim()) { setToast({ ok: false, msg: 'Subject cannot be empty.' }); return; }
    setBusy(true);

    const result = await sendEmailViaServer({
      to: toList,
      cc: ccList.length ? ccList : undefined,
      subject,
      body,
      attachmentBase64: attachmentB64 || undefined,
      attachmentName: attachmentName || undefined,
      attachmentMime: attachmentMime || 'application/pdf',
    });

    await logEmail(supabase, user!.id, {
      templateId: template.id,
      contextType: context.type,
      contextId:
        (context.data as any)?.contract_no ||
        (context.data as any)?.sample_number ||
        (context.data as any)?.id,
      to: toList,
      cc: ccList,
      subject,
      body,
      attachmentName: attachmentName || undefined,
      status: result.ok ? 'sent' : 'failed',
      errorMessage: result.error,
    });

    setBusy(false);
    setToast({
      ok: result.ok,
      msg: result.ok ? 'Email sent successfully!' : (result.error || 'Failed to send email.'),
    });

    if (result.ok) {
      setTimeout(() => { onSent?.(); onClose(); }, 2000);
    }
  };

  /* ---- Badge render ---- */
  const renderBadges = (list: string[], setList: (v: string[]) => void, color: string) =>
    list.map((e, i) => (
      <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${color}`}>
        {e}
        <button onClick={() => removeAddr(i, list, setList)} className="opacity-60 hover:opacity-100 hover:text-red-500 transition">
          <X className="h-3 w-3" />
        </button>
      </span>
    ));

  return (
    <>
      {/* Toast */}
      {toast && (
        <Toast ok={toast.ok} message={toast.msg} onDone={() => setToast(null)} />
      )}

      <div
        className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 bg-white">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900">Compose email</h2>
                <p className="text-[10px] text-slate-400">via {template.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowPreview((p) => !p)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
              >
                {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showPreview ? 'Edit' : 'Preview'}
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {showPreview ? (
              /* ── Preview ── */
              <div className="p-5">
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 space-y-1">
                    <p className="text-[11px] text-slate-600">
                      <span className="font-bold text-slate-800">To:</span> {toList.join(', ') || '—'}
                    </p>
                    {ccList.length > 0 && (
                      <p className="text-[11px] text-slate-600">
                        <span className="font-bold text-slate-800">CC:</span> {ccList.join(', ')}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-600">
                      <span className="font-bold text-slate-800">Subject:</span> {subject}
                    </p>
                    {attachmentB64 && (
                      <p className="text-[11px] text-slate-600 inline-flex items-center gap-1">
                        <Paperclip className="h-3 w-3" />
                        <span className="font-bold text-slate-800">Attachment:</span> {attachmentName}
                      </p>
                    )}
                  </div>
                  <div
                    className="p-5 text-sm text-slate-800"
                    style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', lineHeight: 1.75, minHeight: 180 }}
                    dangerouslySetInnerHTML={{ __html: body }}
                  />
                </div>
              </div>
            ) : (
              /* ── Edit ── */
              <div className="divide-y divide-slate-100">

                {/* ── TO ── */}
                <div className="px-5 py-3 bg-white">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider w-6 shrink-0">To</span>
                    <div className="flex-1 flex flex-wrap gap-1.5">
                      {renderBadges(toList, setToList, 'bg-blue-100 text-blue-700')}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setContactPanelOpen((p) => !p); setContactSearch(''); }}
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    >
                      <Users className="h-3.5 w-3.5" />
                      Contacts
                    </button>
                  </div>
                  <input
                    value={toInput}
                    autoComplete="off"
                    onChange={(e) => setToInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addAddress(toInput, toList, setToList, () => setToInput(''));
                      }
                    }}
                    onBlur={() => {
                      if (toInput.trim()) addAddress(toInput, toList, setToList, () => setToInput(''));
                    }}
                    placeholder="email@example.com — press Enter or comma to add"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-400 outline-none transition"
                  />

                  {/* Inline contact panel */}
                  {contactPanelOpen && (
                    <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden shadow-md">
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                        <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <input
                          autoFocus
                          value={contactSearch}
                          onChange={(e) => setContactSearch(e.target.value)}
                          placeholder="Search contacts…"
                          className="flex-1 bg-transparent text-xs outline-none text-slate-700 placeholder:text-slate-400"
                        />
                        <button onClick={() => setContactPanelOpen(false)}>
                          <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-700 transition" />
                        </button>
                      </div>
                      <div className="max-h-44 overflow-y-auto divide-y divide-slate-100">
                        {filteredContacts.length === 0 ? (
                          <p className="p-3 text-xs text-slate-400 text-center">
                            {contacts.length === 0 ? 'No contacts in your contact book yet.' : 'No match.'}
                          </p>
                        ) : filteredContacts.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => pickContact(c)}
                            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate">{c.name}</p>
                                {c.contact_person && (
                                  <p className="text-[10px] text-slate-500">{c.contact_person}</p>
                                )}
                              </div>
                              <p className="text-[10px] text-blue-600 font-semibold shrink-0 truncate max-w-[140px]">
                                {c.email?.[0] || '—'}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── CC ── */}
                <div className="px-5 py-3 bg-slate-50/50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider w-6 shrink-0">CC</span>
                    <div className="flex-1 flex flex-wrap gap-1.5">
                      {renderBadges(ccList, setCcList, 'bg-slate-200 text-slate-600')}
                    </div>
                  </div>
                  <input
                    value={ccInput}
                    autoComplete="off"
                    onChange={(e) => setCcInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addAddress(ccInput, ccList, setCcList, () => setCcInput(''));
                      }
                    }}
                    onBlur={() => {
                      if (ccInput.trim()) addAddress(ccInput, ccList, setCcList, () => setCcInput(''));
                    }}
                    placeholder="cc@example.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none transition"
                  />
                </div>

                {/* ── Subject ── */}
                <div className="px-5 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Subject</span>
                  </div>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none transition"
                  />
                </div>

                {/* ── Body ── */}
                <div className="px-5 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Message</span>
                  </div>
                  <RichTextEditor value={body} onChange={setBody} minHeight={240} />
                </div>

                {/* ── Attachment ── */}
                <div className="px-5 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Attachment</span>
                  </div>
                  {attachmentB64 ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs">
                      <Paperclip className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="flex-1 truncate font-semibold text-blue-800">{attachmentName}</span>
                      <button onClick={clearAttachment} className="text-blue-400 hover:text-red-500 transition">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-dashed border-slate-300 hover:bg-slate-50 text-slate-600 transition"
                      >
                        <Paperclip className="h-3.5 w-3.5" /> Local file
                      </button>
                      <input ref={fileRef} type="file" className="hidden" accept="*/*" onChange={handleFileChange} />

                      {getPdfBase64 && (
                        <button
                          type="button"
                          onClick={handleAttachPdf}
                          disabled={generatingPdf}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-dashed border-blue-300 hover:bg-blue-50 text-blue-700 transition disabled:opacity-50"
                        >
                          {generatingPdf
                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
                            : <><FileText className="h-3.5 w-3.5" /> Attach document PDF</>}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={openGmailPicker}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-dashed border-violet-300 hover:bg-violet-50 text-violet-700 transition"
                      >
                        <Inbox className="h-3.5 w-3.5" /> From Gmail
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between gap-3 bg-white shrink-0">
            <p className="text-[10px] text-slate-400">Sent via <span className="font-bold text-slate-600">Zoho Mail</span></p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={busy || !toList.length}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 active:scale-95 transition"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {busy ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>

        {/* Gmail picker overlay */}
        {gmailPickerOpen && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={() => setGmailPickerOpen(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">Recent Gmail attachments</h3>
                <button onClick={() => setGmailPickerOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 transition">
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>
              <div className="p-4 max-h-80 overflow-y-auto">
                {loadingGmail ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-slate-500 text-xs">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : gmailAttachments.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500">
                    <Inbox className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    No PDF attachments in last 3 days.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {gmailAttachments.map((att) => (
                      <button
                        key={att.attachmentId}
                        onClick={() => pickGmailAttachment(att)}
                        disabled={fetchingAttachment === att.attachmentId}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-left transition disabled:opacity-50"
                      >
                        <FileText className="h-5 w-5 text-red-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{att.filename}</p>
                          <p className="text-[10px] text-slate-500">{new Date(att.date).toLocaleDateString()}</p>
                        </div>
                        {fetchingAttachment === att.attachmentId && (
                          <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ComposeModal;
