"use client";

import React, { useEffect, useState, useMemo } from 'react';
import {
  Mail, Plus, Pencil, Trash2, X, Save, ChevronDown, ChevronUp,
  Send, Info, Copy, CheckCircle2, Loader2, Clock, MailOpen,
  XCircle, Paperclip, Search,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { dialogService } from '../../lib/dialogService';
import { VARIABLE_DOCS } from '../../lib/emailCompose';
import type { EmailTemplate, EmailLog } from '../../types';
import ComposeModal from '../Email/ComposeModal';
import RichTextEditor from '../Email/RichTextEditor';

/* ── constants ── */
const FONT = '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif';

const CONTEXT_LABELS: Record<string, string> = {
  general: 'General', contract: 'Contract', letter: 'Letter', payment: 'Payment',
};
const CONTEXT_COLORS: Record<string, string> = {
  general:  'bg-slate-100 text-slate-600',
  contract: 'bg-blue-100 text-blue-700',
  letter:   'bg-violet-100 text-violet-700',
  payment:  'bg-emerald-100 text-emerald-700',
};

/* ── Page ── */
const EmailTemplatesPage: React.FC = () => {
  const { user } = useAuth();
  const [templates, setTemplates]             = useState<EmailTemplate[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | 'new' | null>(null);
  const [composeTemplate, setComposeTemplate] = useState<EmailTemplate | null>(null);
  const [zohoConfigured, setZohoConfigured]   = useState<boolean | null>(null);
  const [tab, setTab]                         = useState<'templates' | 'history'>('templates');

  /* email log */
  const [logs, setLogs]           = useState<EmailLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('email_templates').select('*').eq('user_id', user.id).order('updated_at', { ascending: false });
    setTemplates((data || []) as EmailTemplate[]);
    setLoading(false);
  };

  const loadLogs = async () => {
    if (!user) return;
    setLogsLoading(true);
    const { data } = await supabase
      .from('email_logs').select('*').eq('user_id', user.id).order('sent_at', { ascending: false }).limit(200);
    setLogs((data || []) as EmailLog[]);
    setLogsLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);
  useEffect(() => {
    fetch('/api/zoho/status').then(r => r.json()).then(d => setZohoConfigured(!!d.configured)).catch(() => setZohoConfigured(false));
  }, []);
  useEffect(() => { if (tab === 'history') loadLogs(); }, [tab, user?.id]);

  const handleDeleteLog = async (id: string) => {
    const ok = await dialogService.confirm({ title: 'Delete log entry?', message: 'This failed email entry will be removed from history.', confirmLabel: 'Delete', tone: 'danger' });
    if (!ok) return;
    await supabase.from('email_logs').delete().eq('id', id);
    setLogs(prev => prev.filter(l => l.id !== id));
  };

  const handleDelete = async (t: EmailTemplate) => {
    const ok = await dialogService.confirm({ title: 'Delete template?', message: `"${t.name}" will be permanently deleted.`, confirmLabel: 'Delete', tone: 'danger' });
    if (!ok) return;
    await supabase.from('email_templates').delete().eq('id', t.id);
    load();
  };

  const filteredLogs = useMemo(() => {
    if (!logSearch.trim()) return logs;
    const q = logSearch.toLowerCase();
    return logs.filter(l =>
      l.subject?.toLowerCase().includes(q) ||
      l.to_email?.some(e => e.toLowerCase().includes(q)) ||
      l.context_type?.toLowerCase().includes(q)
    );
  }, [logs, logSearch]);

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto" style={{ fontFamily: FONT }}>
      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Emails</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage templates and view your full send history.
          </p>
        </div>
        {tab === 'templates' && (
          <button onClick={() => setEditingTemplate('new')}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition shadow-sm">
            <Plus className="h-4 w-4" /> New
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl mb-6">
        {(['templates', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'templates' ? <><Mail className="h-4 w-4" /> Templates</> : <><Clock className="h-4 w-4" /> Send History</>}
          </button>
        ))}
      </div>

      {/* ── Zoho warning ── */}
      {zohoConfigured === false && tab === 'templates' && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800 flex items-start gap-3">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
          <span>Zoho Mail is not connected. Go to <strong>Settings → Email (Zoho)</strong> to complete setup.</span>
        </div>
      )}

      {/* ══ TEMPLATES TAB ══ */}
      {tab === 'templates' && (
        loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Mail className="h-7 w-7 text-slate-400" />
            </div>
            <p className="text-base font-semibold text-slate-700">No templates yet</p>
            <p className="text-sm text-slate-400 mt-1 mb-5">Create your first template to start sending emails.</p>
            <button onClick={() => setEditingTemplate('new')}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 mx-auto">
              <Plus className="h-4 w-4" /> Create template
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {templates.map(t => (
                <TemplateCard key={t.id} template={t}
                  onEdit={() => setEditingTemplate(t)}
                  onDelete={() => handleDelete(t)}
                  onCompose={() => setComposeTemplate(t)} />
              ))}
            </div>
            <VariableReference />
          </>
        )
      )}

      {/* ══ HISTORY TAB ══ */}
      {tab === 'history' && (
        <div>
          {/* Search */}
          <div className="flex items-center gap-2 mb-4 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input value={logSearch} onChange={e => setLogSearch(e.target.value)}
              placeholder="Search by subject, email or context…"
              className="flex-1 text-sm outline-none text-slate-700 placeholder:text-slate-400" />
            {logSearch && <button onClick={() => setLogSearch('')}><X className="h-4 w-4 text-slate-400" /></button>}
          </div>

          {logsLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading history…
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
              <MailOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-base font-semibold text-slate-700">{logSearch ? 'No results' : 'No emails sent yet'}</p>
              <p className="text-sm text-slate-400 mt-1">{logSearch ? 'Try a different search term.' : 'Once you send emails from any page, the history appears here.'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map(log => (
                <LogCard key={log.id} log={log}
                  expanded={expandedLog === log.id}
                  onToggle={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  onDelete={log.status === 'failed' ? handleDeleteLog : undefined} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {editingTemplate !== null && (
        <TemplateModal
          template={editingTemplate === 'new' ? null : editingTemplate}
          userId={user?.id || ''}
          onSaved={() => { setEditingTemplate(null); load(); }}
          onCancel={() => setEditingTemplate(null)} />
      )}
      {composeTemplate && (
        <ComposeModal
          template={composeTemplate}
          context={{ type: 'general', data: {} }}
          onClose={() => setComposeTemplate(null)}
          onSent={() => { setComposeTemplate(null); loadLogs(); }} />
      )}
    </div>
  );
};

/* ──────────────────────────────────────────────────────── */
/*  Log card                                                */
/* ──────────────────────────────────────────────────────── */
const LogCard: React.FC<{ log: EmailLog; expanded: boolean; onToggle: () => void; onDelete?: (id: string) => void }> = ({ log, expanded, onToggle, onDelete }) => {
  const sent = new Date(log.sent_at);
  const dateStr = sent.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = sent.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden transition-shadow ${expanded ? 'border-blue-200 shadow-md' : 'border-slate-200 shadow-sm'}`}>
      <button type="button" onClick={onToggle} className="w-full text-left">
        <div className="px-4 py-3.5 flex items-start gap-3">
          {/* Status icon */}
          <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${log.status === 'sent' ? 'bg-emerald-50' : 'bg-red-50'}`}>
            {log.status === 'sent'
              ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              : <XCircle className="h-4 w-4 text-red-500" />}
          </div>
          {/* Main */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-900 truncate">{log.subject || '(no subject)'}</p>
              {log.context_type && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${CONTEXT_COLORS[log.context_type] || 'bg-slate-100 text-slate-600'}`}>
                  {CONTEXT_LABELS[log.context_type] || log.context_type}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              <span className="font-medium text-slate-600">To:</span> {log.to_email?.join(', ') || '—'}
              {log.cc_email?.length > 0 && <span className="ml-2"><span className="font-medium text-slate-600">CC:</span> {log.cc_email.join(', ')}</span>}
            </p>
            {log.attachment_name && (
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                <Paperclip className="h-3 w-3" /> {log.attachment_name}
              </p>
            )}
          </div>
          {/* Date + chevron */}
          <div className="shrink-0 flex flex-col items-end gap-1">
            <span className="text-xs font-medium text-slate-500">{dateStr}</span>
            <span className="text-xs text-slate-400">{timeStr}</span>
            {expanded ? <ChevronUp className="h-4 w-4 text-slate-400 mt-0.5" /> : <ChevronDown className="h-4 w-4 text-slate-400 mt-0.5" />}
          </div>
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3">
          {log.status === 'failed' && (
            <div className="mb-3 flex items-start justify-between gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
              <div className="text-xs text-red-700 font-medium flex-1">
                {log.error_message ? `Error: ${log.error_message}` : 'Send failed'}
              </div>
              {onDelete && (
                <button onClick={() => onDelete(log.id)}
                  className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              )}
            </div>
          )}
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Message body</p>
          <div
            className="text-sm text-slate-700 bg-slate-50 rounded-xl p-4 border border-slate-200 max-h-48 overflow-y-auto leading-relaxed"
            dangerouslySetInnerHTML={{ __html: log.body || '<em>No body</em>' }}
          />
        </div>
      )}
    </div>
  );
};

/* ──────────────────────────────────────────────────────── */
/*  Template card                                           */
/* ──────────────────────────────────────────────────────── */
const TemplateCard: React.FC<{
  template: EmailTemplate; onEdit: () => void; onDelete: () => void; onCompose: () => void;
}> = ({ template, onEdit, onDelete, onCompose }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied]     = useState(false);

  const copyBody = () => {
    navigator.clipboard.writeText(template.body).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
          <Mail className="h-5 w-5 text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-bold text-slate-900">{template.name}</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${CONTEXT_COLORS[template.context] || CONTEXT_COLORS.general}`}>
              {CONTEXT_LABELS[template.context] || template.context}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5 truncate">{template.subject}</p>
          {expanded && (
            <div className="mt-3 text-sm text-slate-700 bg-slate-50 rounded-xl p-4 border border-slate-200 max-h-56 overflow-y-auto leading-relaxed"
              dangerouslySetInnerHTML={{ __html: template.body }} />
          )}
        </div>
        <button onClick={() => setExpanded(p => !p)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition shrink-0 mt-0.5">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {/* Action bar */}
      <div className="border-t border-slate-100 px-3 py-2 flex items-center gap-1 bg-slate-50/60">
        <button onClick={onCompose}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl text-blue-700 hover:bg-blue-50 transition">
          <Send className="h-4 w-4" /> Send
        </button>
        <div className="w-px h-6 bg-slate-200" />
        <button onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl text-slate-600 hover:bg-slate-100 transition">
          <Pencil className="h-4 w-4" /> Edit
        </button>
        <div className="w-px h-6 bg-slate-200" />
        <button onClick={copyBody}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl text-slate-600 hover:bg-slate-100 transition">
          {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <div className="w-px h-6 bg-slate-200" />
        <button onClick={onDelete}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl text-red-500 hover:bg-red-50 transition">
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────── */
/*  Template modal                                          */
/* ──────────────────────────────────────────────────────── */
const TemplateModal: React.FC<{
  template: EmailTemplate | null; userId: string; onSaved: () => void; onCancel: () => void;
}> = ({ template, userId, onSaved, onCancel }) => {
  const [name, setName]       = useState(template?.name    || '');
  const [context, setContext] = useState<EmailTemplate['context']>(template?.context || 'general');
  const [subject, setSubject] = useState(template?.subject || '');
  const [body, setBody]       = useState(template?.body    || '');
  const [busy, setBusy]       = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !subject.trim()) {
      dialogService.alert({ title: 'Validation', message: 'Name and subject are required.' }); return;
    }
    setBusy(true);
    const row = { user_id: userId, name: name.trim(), context, subject: subject.trim(), body, updated_at: new Date().toISOString() };
    let err;
    if (template?.id) { ({ error: err } = await supabase.from('email_templates').update(row).eq('id', template.id)); }
    else { ({ error: err } = await supabase.from('email_templates').insert([row])); }
    setBusy(false);
    if (err) { dialogService.alert({ title: 'Save failed', message: err.message, tone: 'danger' }); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        style={{ fontFamily: FONT }} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          <div>
            <p className="text-[15px] font-bold text-slate-900">{template ? 'Edit template' : 'New template'}</p>
            <p className="text-xs text-slate-400 mt-0.5">Use {'{{variable}}'} placeholders for dynamic content</p>
          </div>
          <button onClick={onCancel} className="p-2 rounded-xl hover:bg-slate-100 transition"><X className="h-5 w-5 text-slate-400" /></button>
        </div>
        <div className="h-px bg-slate-100 mx-5" />
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Template name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Contract Confirmation"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Context</label>
              <select value={context} onChange={e => setContext(e.target.value as EmailTemplate['context'])}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none bg-white transition">
                <option value="general">General</option>
                <option value="contract">Contract page</option>
                <option value="letter">Letter page</option>
                <option value="payment">Payment / Invoice</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Subject *</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Contract {{contract_no}} — Confirmation"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Body</label>
            <RichTextEditor value={body} onChange={setBody} minHeight={260} placeholder="Dear {{contact_person}},&#10;&#10;Please find attached…" />
          </div>
        </div>
        <div className="h-px bg-slate-100 mx-5" />
        <div className="px-5 py-4 flex justify-end gap-2 shrink-0">
          <button onClick={onCancel} className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition">Cancel</button>
          <button onClick={handleSave} disabled={busy}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-sm">
            <Save className="h-4 w-4" />
            {busy ? 'Saving…' : template ? 'Save changes' : 'Create template'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────── */
/*  Variable reference                                      */
/* ──────────────────────────────────────────────────────── */
const VariableReference: React.FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6 border border-slate-200 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition">
        <span className="flex items-center gap-2"><Info className="h-4 w-4 text-slate-400" /> Template variable reference</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="p-4">
          <p className="text-sm text-slate-500 mb-3">Placeholders auto-replaced when sending from a contract, letter, or payment page.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase font-semibold border-b border-slate-200">
                  <th className="py-2 pr-4">Variable</th>
                  <th className="py-2 pr-4">Description</th>
                  <th className="py-2">Available in</th>
                </tr>
              </thead>
              <tbody>
                {VARIABLE_DOCS.map(v => (
                  <tr key={v.key} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4 font-mono text-blue-700 text-xs">{`{{${v.key}}}`}</td>
                    <td className="py-2 pr-4 text-slate-700">{v.description}</td>
                    <td className="py-2 text-slate-500 capitalize">{v.contexts.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailTemplatesPage;
