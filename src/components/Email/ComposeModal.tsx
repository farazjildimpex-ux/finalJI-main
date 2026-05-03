"use client";

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  X, Send, Paperclip, Eye, EyeOff, CheckCircle2,
  Loader2, Mail, Users, FileText, Inbox, Search, XCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import {
  renderTemplate, buildVarsFromContext, sendEmailViaServer, logEmail,
  type EmailContext,
} from '../../lib/emailCompose';
import type { EmailTemplate, Contact } from '../../types';
import RichTextEditor from './RichTextEditor';

/* ── Types ── */
interface GmailAttachment {
  messageId: string; attachmentId: string; filename: string; mimeType: string; date: string;
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

/* ── Helpers ── */
function ctxKey(ctx: EmailContext) {
  const d = ctx.data as Record<string, unknown>;
  return `${ctx.type}|${d?.contract_no ?? d?.sample_number ?? d?.debit_note_no ?? d?.id ?? ''}`;
}
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
function applyGreeting(html: string, name: string): string {
  const greeting = name ? `Dear ${name},` : 'Dear Sir/Madam,';
  if (/^(<p[^>]*>|<div[^>]*>)?Dear\b/i.test(html.trim())) {
    return html.replace(/^(<(?:p|div)[^>]*>)?Dear[^<\n,]*[,]?/i, `$1${greeting}`);
  }
  return `<p>${greeting}</p><p><br></p>${html}`;
}

/* ── Toast ── */
const Toast: React.FC<{ ok: boolean; message: string; onDone: () => void }> = ({ ok, message, onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 4000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[1300] pointer-events-none">
      <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-[15px] font-semibold text-white ${ok ? 'bg-emerald-600' : 'bg-red-600'}`}
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif' }}>
        {ok ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <XCircle className="h-5 w-5 shrink-0" />}
        {message}
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────── */

const BASE_FONT = '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif';

const ComposeModal: React.FC<ComposeModalProps> = ({
  template, context, pdfBase64, pdfFileName, getPdfBase64, onSent, onClose,
}) => {
  const { user } = useAuth();
  const [contacts, setContacts]       = useState<Contact[]>([]);
  const [toInput, setToInput]         = useState('');
  const [toList, setToList]           = useState<string[]>([]);
  const [ccInput, setCcInput]         = useState('');
  const [ccList, setCcList]           = useState<string[]>([]);
  const [subject, setSubject]         = useState('');
  const [body, setBody]               = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [busy, setBusy]               = useState(false);
  const [toast, setToast]             = useState<{ ok: boolean; msg: string } | null>(null);
  const [attachB64, setAttachB64]     = useState<string | null>(pdfBase64 || null);
  const [attachName, setAttachName]   = useState(pdfFileName || '');
  const [attachMime, setAttachMime]   = useState('application/pdf');
  const fileRef                       = useRef<HTMLInputElement>(null);
  const [companyName, setCompanyName] = useState('');
  const [genPdf, setGenPdf]           = useState(false);
  const [cpOpen, setCpOpen]           = useState(false);   // contact panel
  const [cpSearch, setCpSearch]       = useState('');
  const [gmailOpen, setGmailOpen]     = useState(false);
  const [gmailList, setGmailList]     = useState<GmailAttachment[]>([]);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailFetching, setGmailFetching] = useState<string | null>(null);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError]     = useState<string | null>(null);

  /* ─ Load contacts — no user_id filter, RLS handles access ─ */
  useEffect(() => {
    setContactsLoading(true);
    setContactsError(null);
    supabase
      .from('contact_book')
      .select('*')
      .order('name')
      .then(({ data, error }) => {
        if (error) {
          console.error('[ComposeModal] contact_book error:', error);
          setContactsError(error.message);
        } else {
          setContacts((data || []) as Contact[]);
        }
        setContactsLoading(false);
      });
    supabase.from('companies').select('name').limit(1).maybeSingle()
      .then(({ data }) => setCompanyName(data?.name || '')).catch(() => {});
  }, []);

  /* ─ Render template ─ */
  useEffect(() => {
    const vars = buildVarsFromContext(context, companyName);
    setSubject(renderTemplate(template.subject, vars));
    setBody(renderTemplate(template.body, vars));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id, ctxKey(context), companyName]);

  /* ─ Quick-pick: supplier / buyer chips derived from context ─ */
  const quickPicks = useMemo(() => {
    const vars = buildVarsFromContext(context, companyName);
    return [
      { role: 'Supplier', name: vars.supplier_name || '' },
      { role: 'Buyer',    name: vars.buyer_name    || '' },
    ].filter(q => q.name.trim());
  }, [context, companyName]);

  const addQuickPick = (name: string) => {
    const q = name.toLowerCase();
    const match = contacts.find(c => {
      const cn = c.name.toLowerCase();
      return cn.includes(q) || q.includes(cn) || similarity(cn, q) > 0.55;
    });
    if (!match) { setToast({ ok: false, msg: `No contact found matching "${name}"` }); return; }
    if (match.email?.length) addEmail(match.email[0], toList, setToList, () => {});
    if (match.email_cc?.length) setCcList(p => [...new Set([...p, ...match.email_cc!])]);
  };

  /* ─ Filtered contact list ─ */
  const filtered = useMemo(() => {
    const q = cpSearch.toLowerCase().trim();
    if (!q) return contacts;
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.contact_person?.toLowerCase().includes(q) ||
      c.email?.some(e => e.toLowerCase().includes(q))
    );
  }, [contacts, cpSearch]);

  /* ─ Helpers ─ */
  const addEmail = (val: string, list: string[], set: (v: string[]) => void, clear: () => void) => {
    const emails = val.split(/[,;\s]+/).map(e => e.trim()).filter(e => e.includes('@'));
    if (!emails.length) return;
    set([...new Set([...list, ...emails])]);
    clear();
  };
  const removeTo  = (i: number) => setToList(l => l.filter((_, j) => j !== i));
  const removeCc  = (i: number) => setCcList(l => l.filter((_, j) => j !== i));

  const pickContact = (c: Contact) => {
    if (c.email?.length) addEmail(c.email[0], toList, setToList, () => {});
    if (c.email_cc?.length) setCcList(p => [...new Set([...p, ...c.email_cc!])]);
    setBody(prev => applyGreeting(prev, c.contact_person || c.name || ''));
    setCpOpen(false); setCpSearch('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setAttachMime(f.type || 'application/octet-stream'); setAttachName(f.name);
    const r = new FileReader();
    r.onload = () => setAttachB64((r.result as string).split(',')[1]);
    r.readAsDataURL(f);
  };

  const attachPdf = async () => {
    if (!getPdfBase64) return;
    setGenPdf(true);
    try {
      const { base64, filename } = await getPdfBase64();
      setAttachB64(base64); setAttachName(filename); setAttachMime('application/pdf');
    } catch (e: any) {
      setToast({ ok: false, msg: 'PDF failed: ' + (e?.message || '') });
    } finally { setGenPdf(false); }
  };

  const clearAttach = () => { setAttachB64(null); setAttachName(''); if (fileRef.current) fileRef.current.value = ''; };

  const openGmail = async () => {
    setGmailOpen(true);
    if (gmailList.length) return;
    setGmailLoading(true);
    try {
      const res = await fetch('/api/gmail/recent-attachments');
      if (!res.ok) throw new Error(await res.text());
      setGmailList((await res.json()).attachments || []);
    } catch (e: any) {
      setToast({ ok: false, msg: 'Gmail: ' + (e?.message || 'check connection') });
    } finally { setGmailLoading(false); }
  };

  const pickGmail = async (att: GmailAttachment) => {
    setGmailFetching(att.attachmentId);
    try {
      const res = await fetch(`/api/gmail/attachment?messageId=${att.messageId}&attachmentId=${att.attachmentId}&filename=${encodeURIComponent(att.filename)}`);
      if (!res.ok) throw new Error(await res.text());
      const d = await res.json();
      setAttachB64(d.base64); setAttachName(att.filename); setAttachMime(att.mimeType || 'application/pdf');
      setGmailOpen(false);
    } catch (e: any) {
      setToast({ ok: false, msg: 'Could not fetch: ' + (e?.message || '') });
    } finally { setGmailFetching(null); }
  };

  const handleSend = async () => {
    if (!toList.length) { setToast({ ok: false, msg: 'Add at least one recipient.' }); return; }
    if (!subject.trim()) { setToast({ ok: false, msg: 'Subject is required.' }); return; }
    setBusy(true);
    const result = await sendEmailViaServer({
      to: toList, cc: ccList.length ? ccList : undefined,
      subject, body,
      attachmentBase64: attachB64 || undefined,
      attachmentName: attachName || undefined,
      attachmentMime: attachMime || 'application/pdf',
    });
    await logEmail(supabase, user!.id, {
      templateId: template.id, contextType: context.type,
      contextId: (context.data as any)?.contract_no || (context.data as any)?.sample_number || (context.data as any)?.id,
      to: toList, cc: ccList, subject, body,
      attachmentName: attachName || undefined,
      status: result.ok ? 'sent' : 'failed', errorMessage: result.error,
    });
    setBusy(false);
    setToast({ ok: result.ok, msg: result.ok ? 'Email sent successfully!' : (result.error || 'Failed to send.') });
    if (result.ok) setTimeout(() => { onSent?.(); onClose(); }, 2000);
  };

  /* ─ Badge row ─ */
  const BadgeRow = ({ list, remove, color }: { list: string[]; remove: (i: number) => void; color: string }) => (
    <>
      {list.map((e, i) => (
        <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
          {e}
          <button type="button" onClick={() => remove(i)} className="ml-0.5 opacity-50 hover:opacity-100 transition">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </>
  );

  return (
    <>
      {toast && <Toast ok={toast.ok} message={toast.msg} onDone={() => setToast(null)} />}

      <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div
          className="bg-white w-full sm:max-w-xl sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[96vh] overflow-hidden"
          style={{ fontFamily: BASE_FONT }}
          onClick={e => e.stopPropagation()}
        >
          {/* ─ Header ─ */}
          <div className="px-5 pt-5 pb-4 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-blue-600 flex items-center justify-center shrink-0">
                <Mail className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <p className="text-[15px] font-bold text-slate-900">New email</p>
                <p className="text-xs text-slate-400">{template.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowPreview(p => !p)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition">
                {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showPreview ? 'Edit' : 'Preview'}
              </button>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition">
                <X className="h-4.5 w-4.5 text-slate-400" style={{ width: 18, height: 18 }} />
              </button>
            </div>
          </div>
          <div className="h-px bg-slate-100 mx-5" />

          <div className="flex-1 overflow-y-auto">
            {showPreview ? (
              /* ─ Preview ─ */
              <div className="p-5">
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 space-y-1">
                    <p className="text-sm text-slate-600"><span className="font-semibold text-slate-800">To:</span> {toList.join(', ') || '—'}</p>
                    {ccList.length > 0 && <p className="text-sm text-slate-600"><span className="font-semibold text-slate-800">CC:</span> {ccList.join(', ')}</p>}
                    <p className="text-sm text-slate-600"><span className="font-semibold text-slate-800">Subject:</span> {subject}</p>
                    {attachB64 && <p className="text-sm text-slate-500 flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" /> {attachName}</p>}
                  </div>
                  <div className="p-5 text-sm text-slate-800 leading-7" dangerouslySetInnerHTML={{ __html: body }} />
                </div>
              </div>
            ) : (
              /* ─ Edit ─ */
              <div className="px-5 py-4 space-y-5">
                {/* Hidden decoy inputs — trick browsers into filling these instead of real fields */}
                <div style={{ display: 'none' }} aria-hidden="true">
                  <input type="text" name="username" autoComplete="username" tabIndex={-1} />
                  <input type="email" name="email" autoComplete="email" tabIndex={-1} />
                </div>

                {/* TO */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">To *</label>
                    <button type="button" onClick={() => { setCpOpen(p => !p); setCpSearch(''); }}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
                      <Users className="h-3.5 w-3.5" />
                      {cpOpen ? 'Close' : 'Pick contact'}
                    </button>
                  </div>

                  {/* Supplier / Buyer quick-add chips */}
                  {quickPicks.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {quickPicks.map(q => (
                        <button key={q.role} type="button" onClick={() => addQuickPick(q.name)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 hover:border-blue-200 transition">
                          <Users className="h-3 w-3" />
                          <span className="text-slate-400">{q.role}:</span> {q.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {toList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <BadgeRow list={toList} remove={removeTo} color="bg-blue-50 text-blue-700 border border-blue-200" />
                    </div>
                  )}

                  <input
                    value={toInput}
                    name="compose-to-field"
                    autoComplete="new-password"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={e => setToInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addEmail(toInput, toList, setToList, () => setToInput(''));
                      }
                    }}
                    onBlur={() => { if (toInput.trim()) addEmail(toInput, toList, setToList, () => setToInput('')); }}
                    placeholder="Type email and press Enter…"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  />

                  {/* Inline contact panel */}
                  {cpOpen && (
                    <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden shadow-lg">
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border-b border-slate-100">
                        <Search className="h-4 w-4 text-slate-400 shrink-0" />
                        <input autoFocus value={cpSearch} onChange={e => setCpSearch(e.target.value)}
                          placeholder="Search contacts…"
                          className="flex-1 bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400" />
                        <button onClick={() => setCpOpen(false)}>
                          <X className="h-4 w-4 text-slate-400 hover:text-slate-600 transition" />
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {contactsLoading ? (
                          <div className="flex items-center justify-center gap-2 p-4 text-sm text-slate-400">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading contacts…
                          </div>
                        ) : contactsError ? (
                          <p className="p-4 text-sm text-red-500 text-center">Error: {contactsError}</p>
                        ) : contacts.length === 0 ? (
                          <p className="p-4 text-sm text-slate-400 text-center">No contacts in your contact book yet.</p>
                        ) : filtered.length === 0 ? (
                          <p className="p-4 text-sm text-slate-400 text-center">No contacts match "{cpSearch}".</p>
                        ) : filtered.map(c => (
                          <button key={c.id} type="button" onClick={() => pickContact(c)}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 transition">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                                {c.contact_person && <p className="text-xs text-slate-400">{c.contact_person}</p>}
                              </div>
                              <p className="text-xs text-blue-600 shrink-0 truncate max-w-[160px]">{c.email?.[0] || '—'}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* CC */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">CC</label>
                  {ccList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <BadgeRow list={ccList} remove={removeCc} color="bg-slate-100 text-slate-600 border border-slate-200" />
                    </div>
                  )}
                  <input
                    value={ccInput}
                    name="compose-cc-field"
                    autoComplete="new-password"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={e => setCcInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addEmail(ccInput, ccList, setCcList, () => setCcInput(''));
                      }
                    }}
                    onBlur={() => { if (ccInput.trim()) addEmail(ccInput, ccList, setCcList, () => setCcInput('')); }}
                    placeholder="cc@example.com"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-100 outline-none transition"
                  />
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Subject *</label>
                  <input value={subject} onChange={e => setSubject(e.target.value)}
                    name="compose-subject"
                    autoComplete="off"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition" />
                </div>

                {/* Body */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Message</label>
                  <RichTextEditor value={body} onChange={setBody} minHeight={220} />
                </div>

                {/* Attachment */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">PDF Document</label>
                  {attachB64 ? (
                    <div>
                      <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
                        <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="block truncate font-medium text-blue-800">{attachName}</span>
                          <span className="text-xs text-blue-500">Recipient gets a download button in the email</span>
                        </div>
                        <button type="button" onClick={clearAttach} className="text-blue-400 hover:text-red-500 transition shrink-0">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => fileRef.current?.click()}
                          className="flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium rounded-xl border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 transition">
                          <Paperclip className="h-4 w-4" /> Local file
                        </button>
                        <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />

                        {getPdfBase64 && (
                          <button type="button" onClick={attachPdf} disabled={genPdf}
                            className="flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium rounded-xl border border-dashed border-blue-300 text-blue-700 hover:bg-blue-50 transition disabled:opacity-50">
                            {genPdf ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><FileText className="h-4 w-4" /> Include PDF</>}
                          </button>
                        )}

                        <button type="button" onClick={openGmail}
                          className="flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium rounded-xl border border-dashed border-violet-300 text-violet-700 hover:bg-violet-50 transition">
                          <Inbox className="h-4 w-4" /> From Gmail
                        </button>
                      </div>
                      <p className="text-xs text-slate-400">PDF is stored securely and the recipient receives a download button — expires in 72 h.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ─ Footer ─ */}
          <div className="h-px bg-slate-100 mx-5" />
          <div className="px-5 py-4 flex items-center justify-between shrink-0">
            <p className="text-xs text-slate-400">via <span className="font-semibold text-slate-600">Zoho Mail</span></p>
            <div className="flex gap-2">
              <button onClick={onClose}
                className="px-4 py-2.5 text-sm font-semibold rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition">
                Cancel
              </button>
              <button onClick={handleSend} disabled={busy || !toList.length}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 active:scale-95 transition shadow-sm">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {busy ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>

        {/* Gmail picker overlay */}
        {gmailOpen && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={() => setGmailOpen(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <p className="text-[15px] font-bold text-slate-900">Gmail attachments</p>
                <button onClick={() => setGmailOpen(false)} className="p-1.5 rounded-xl hover:bg-slate-100 transition">
                  <X className="h-4 w-4 text-slate-400" />
                </button>
              </div>
              <div className="p-4 max-h-72 overflow-y-auto">
                {gmailLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-slate-400 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : gmailList.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-400">
                    <Inbox className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    No PDF attachments in the last 3 days.
                  </div>
                ) : gmailList.map(att => (
                  <button key={att.attachmentId} onClick={() => pickGmail(att)} disabled={gmailFetching === att.attachmentId}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 text-left transition disabled:opacity-50">
                    <FileText className="h-5 w-5 text-red-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{att.filename}</p>
                      <p className="text-xs text-slate-400">{new Date(att.date).toLocaleDateString()}</p>
                    </div>
                    {gmailFetching === att.attachmentId && <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ComposeModal;
