"use client";

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  X, Send, Paperclip, Eye, EyeOff, AlertCircle,
  CheckCircle2, Loader2, Mail, Users, FileText, Inbox, Search,
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
  /** Async function to generate a PDF on demand (contract/letter/payment). */
  getPdfBase64?: () => Promise<{ base64: string; filename: string }>;
  onSent?: () => void;
  onClose: () => void;
}

/* Helper: stable key from context data for useEffect deps */
function ctxKey(ctx: EmailContext) {
  const d = ctx.data as Record<string, unknown>;
  return `${ctx.type}|${d?.contract_no ?? d?.sample_number ?? d?.debit_note_no ?? d?.id ?? ''}`;
}

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
  const [error, setError]               = useState<string | null>(null);
  const [success, setSuccess]           = useState(false);
  const [attachmentB64, setAttachmentB64]   = useState<string | null>(pdfBase64 || null);
  const [attachmentName, setAttachmentName] = useState(pdfFileName || '');
  const [attachmentMime, setAttachmentMime] = useState('application/pdf');
  const fileRef = useRef<HTMLInputElement>(null);
  const [companyName, setCompanyName]   = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  /* Inline contact panel */
  const [contactPanelOpen, setContactPanelOpen] = useState(false);
  const [contactSearch, setContactSearch]       = useState('');

  /* Gmail attachment picker */
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

    // Try buyer_name first, then supplier_name
    const targetNames = [
      vars.buyer_name,
      vars.supplier_name,
    ].filter(Boolean).map((n) => n!.toLowerCase().trim());

    if (!targetNames.length) return;

    const match = contacts.find((c) => {
      const cname = c.name.toLowerCase();
      return targetNames.some(
        (t) => cname.includes(t) || t.includes(cname) || similarity(cname, t) > 0.6
      );
    });

    if (match) {
      if (match.email?.length && toList.length === 0) {
        setToList(match.email.filter(Boolean));
      }
      if (match.email_cc?.length && ccList.length === 0) {
        setCcList(match.email_cc.filter(Boolean));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts.length, ctxKey(context), companyName]);

  /* ---- Filtered contacts for picker panel ---- */
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

  const removeAddress = (idx: number, list: string[], setList: (v: string[]) => void) =>
    setList(list.filter((_, i) => i !== idx));

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

  /* ---- PDF generation ---- */
  const handleAttachPdf = async () => {
    if (!getPdfBase64) return;
    setGeneratingPdf(true);
    try {
      const { base64, filename } = await getPdfBase64();
      setAttachmentB64(base64);
      setAttachmentName(filename);
      setAttachmentMime('application/pdf');
    } catch (e: any) {
      setError('Could not generate PDF: ' + (e?.message || 'unknown error'));
    } finally {
      setGeneratingPdf(false);
    }
  };

  const clearAttachment = () => {
    setAttachmentB64(null);
    setAttachmentName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  /* ---- Gmail attachment picker ---- */
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
      setError('Could not load Gmail attachments: ' + (e?.message || 'check Gmail connection'));
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
      setError('Could not fetch attachment: ' + (e?.message || 'unknown error'));
    } finally {
      setFetchingAttachment(null);
    }
  };

  /* ---- Send ---- */
  const handleSend = async () => {
    if (!toList.length) { setError('Add at least one To address.'); return; }
    if (!subject.trim()) { setError('Subject cannot be empty.'); return; }
    setError(null);
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
    if (result.ok) {
      setSuccess(true);
      setTimeout(() => { onSent?.(); onClose(); }, 1500);
    } else {
      setError(result.error || 'Failed to send email.');
    }
  };

  /* ---- Pick a contact from the inline panel ---- */
  const pickContact = (c: Contact) => {
    if (c.email?.length) addAddress(c.email[0], toList, setToList, () => {});
    if (c.email_cc?.length) setCcList((p) => [...new Set([...p, ...c.email_cc!])]);
    setContactPanelOpen(false);
    setContactSearch('');
  };

  /* ---- Address badge render ---- */
  const renderBadges = (list: string[], setList: (v: string[]) => void, color: string) =>
    list.map((e, i) => (
      <span
        key={i}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${color}`}
      >
        {e}
        <button onClick={() => removeAddress(i, list, setList)} className="opacity-60 hover:opacity-100 hover:text-red-500 transition">
          <X className="h-3 w-3" />
        </button>
      </span>
    ));

  /* ============================================================ */

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
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
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
            >
              {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showPreview ? 'Edit' : 'Preview'}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* ── Success ── */}
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
              /* ── Preview ── */
              <div className="px-5 py-4">
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 space-y-0.5">
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
                    style={{
                      fontFamily:
                        'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      lineHeight: 1.7,
                      minHeight: 180,
                    }}
                    dangerouslySetInnerHTML={{ __html: body }}
                  />
                </div>
              </div>
            ) : (
              /* ── Edit ── */
              <div className="px-5 py-4 space-y-4">

                {/* ── To ── */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">To *</label>
                    <button
                      type="button"
                      onClick={() => { setContactPanelOpen((p) => !p); setContactSearch(''); }}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 transition"
                    >
                      <Users className="h-3.5 w-3.5" />
                      {contactPanelOpen ? 'Close contacts' : 'Pick from contacts'}
                    </button>
                  </div>

                  {/* Badges */}
                  {toList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {renderBadges(toList, setToList, 'bg-blue-50 text-blue-700')}
                    </div>
                  )}

                  {/* Manual input */}
                  <input
                    value={toInput}
                    onChange={(e) => setToInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addAddress(toInput, toList, setToList, () => setToInput(''));
                      }
                    }}
                    onBlur={() => { if (toInput) addAddress(toInput, toList, setToList, () => setToInput('')); }}
                    placeholder="email@example.com — press Enter or comma to add"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />

                  {/* Inline contact picker panel */}
                  {contactPanelOpen && (
                    <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                        <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <input
                          autoFocus
                          value={contactSearch}
                          onChange={(e) => setContactSearch(e.target.value)}
                          placeholder="Search contacts…"
                          className="flex-1 bg-transparent text-xs outline-none text-slate-700 placeholder:text-slate-400"
                        />
                      </div>
                      <div className="max-h-44 overflow-y-auto divide-y divide-slate-100">
                        {filteredContacts.length === 0 ? (
                          <p className="p-3 text-xs text-slate-400 text-center">
                            {contacts.length === 0 ? 'No contacts in your contact book yet.' : 'No contacts match your search.'}
                          </p>
                        ) : (
                          filteredContacts.map((c) => (
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
                                <div className="text-right shrink-0">
                                  <p className="text-[10px] text-blue-600 font-semibold truncate max-w-[140px]">
                                    {c.email?.[0] || '—'}
                                  </p>
                                  {c.email_cc?.length ? (
                                    <p className="text-[9px] text-slate-400">+CC</p>
                                  ) : null}
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── CC ── */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">CC</label>
                  {ccList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {renderBadges(ccList, setCcList, 'bg-slate-100 text-slate-700')}
                    </div>
                  )}
                  <input
                    value={ccInput}
                    onChange={(e) => setCcInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addAddress(ccInput, ccList, setCcList, () => setCcInput(''));
                      }
                    }}
                    onBlur={() => { if (ccInput) addAddress(ccInput, ccList, setCcList, () => setCcInput('')); }}
                    placeholder="cc@example.com"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* ── Subject ── */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Subject *</label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* ── Body ── */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Body</label>
                  <RichTextEditor value={body} onChange={setBody} minHeight={220} />
                </div>

                {/* ── Attachment ── */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Attachment</label>
                  {attachmentB64 ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                      <Paperclip className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span className="flex-1 truncate font-semibold text-slate-800">{attachmentName}</span>
                      <button onClick={clearAttachment} className="text-red-500 hover:text-red-700 transition">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-dashed border-slate-300 hover:bg-slate-50 text-slate-600 transition"
                      >
                        <Paperclip className="h-3.5 w-3.5" /> Attach local file
                      </button>
                      <input ref={fileRef} type="file" className="hidden" accept="*/*" onChange={handleFileChange} />

                      {getPdfBase64 && (
                        <button
                          type="button"
                          onClick={handleAttachPdf}
                          disabled={generatingPdf}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-dashed border-blue-300 hover:bg-blue-50 text-blue-700 transition disabled:opacity-50"
                        >
                          {generatingPdf ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating PDF…</>
                          ) : (
                            <><FileText className="h-3.5 w-3.5" /> Attach document PDF</>
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={openGmailPicker}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-dashed border-violet-300 hover:bg-violet-50 text-violet-700 transition"
                      >
                        <Inbox className="h-3.5 w-3.5" /> From Gmail (recent)
                      </button>
                    </div>
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

        {/* ── Footer ── */}
        {!success && (
          <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between gap-3 bg-white shrink-0">
            <div className="text-[10px] text-slate-500">
              Sent via <span className="font-bold">Zoho Mail</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
              >
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

      {/* ── Gmail attachment picker overlay ── */}
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
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading attachments from Gmail…
                </div>
              ) : gmailAttachments.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  <Inbox className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  No PDF attachments found in the last 3 days.<br />
                  Make sure Gmail is connected and sync has run.
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
                        <p className="text-[10px] text-slate-500">
                          {new Date(att.date).toLocaleDateString()}
                        </p>
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
  );
};

/* ---- Very simple bigram similarity (0–1) ---- */
function bigrams(s: string): Set<string> {
  const b = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) b.add(s.slice(i, i + 2));
  return b;
}
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const ba = bigrams(a);
  const bb = bigrams(b);
  let intersection = 0;
  ba.forEach((g) => { if (bb.has(g)) intersection++; });
  return (2 * intersection) / (ba.size + bb.size);
}

export default ComposeModal;
