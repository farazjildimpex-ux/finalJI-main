"use client";

import React, { useEffect, useState } from 'react';
import {
  Mail, Plus, Pencil, Trash2, X, Save, ChevronDown, ChevronUp,
  Send, Info, Copy, CheckCircle2,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { dialogService } from '../../lib/dialogService';
import { VARIABLE_DOCS } from '../../lib/emailCompose';
import type { EmailTemplate } from '../../types';
import ComposeModal from '../Email/ComposeModal';

const CONTEXT_LABELS: Record<string, string> = {
  general:  'General',
  contract: 'Contract',
  letter:   'Letter',
  payment:  'Payment',
};

const CONTEXT_COLORS: Record<string, string> = {
  general:  'bg-slate-100 text-slate-700',
  contract: 'bg-blue-100 text-blue-700',
  letter:   'bg-violet-100 text-violet-700',
  payment:  'bg-emerald-100 text-emerald-700',
};

const EmailTemplatesPage: React.FC = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [composeTemplate, setComposeTemplate] = useState<EmailTemplate | null>(null);
  const [zohoConfigured, setZohoConfigured] = useState<boolean | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('email_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    setTemplates((data || []) as EmailTemplate[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  useEffect(() => {
    fetch('/api/zoho/status')
      .then((r) => r.json())
      .then((d) => setZohoConfigured(!!d.configured))
      .catch(() => setZohoConfigured(false));
  }, []);

  const handleDelete = async (t: EmailTemplate) => {
    const ok = await dialogService.confirm({
      title: 'Delete template?',
      message: `"${t.name}" will be permanently deleted.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    await supabase.from('email_templates').delete().eq('id', t.id);
    load();
  };

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Email Templates</h1>
          <p className="text-xs text-slate-500 mt-1">
            Create reusable templates with <code className="bg-slate-100 px-1 rounded">{'{{variable}}'}</code> placeholders
            that are filled automatically when sending from a contract, letter, or payment page.
          </p>
        </div>
        <button
          onClick={() => { setEditingId(null); setShowForm(true); }}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition shadow-sm"
        >
          <Plus className="h-4 w-4" /> New template
        </button>
      </div>

      {/* Zoho status banner */}
      {zohoConfigured === false && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Zoho Mail is not connected — emails can't be sent yet.
            Go to <strong>Settings → Email (Zoho)</strong> to complete the OAuth setup.
          </span>
        </div>
      )}

      {showForm && (
        <TemplateForm
          editingId={editingId}
          userId={user?.id || ''}
          onSaved={() => { setShowForm(false); setEditingId(null); load(); }}
          onCancel={() => { setShowForm(false); setEditingId(null); }}
          initialData={editingId ? templates.find((t) => t.id === editingId) : undefined}
        />
      )}

      {loading ? (
        <div className="text-center py-12 text-sm text-slate-400">Loading…</div>
      ) : templates.length === 0 && !showForm ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <Mail className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">No templates yet</p>
          <p className="text-xs text-slate-500 mt-1">Create your first template to start sending professional emails.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onEdit={() => { setEditingId(t.id); setShowForm(true); }}
              onDelete={() => handleDelete(t)}
              onCompose={() => setComposeTemplate(t)}
            />
          ))}
        </div>
      )}

      {/* Variable reference */}
      <VariableReference />

      {composeTemplate && (
        <ComposeModal
          template={composeTemplate}
          context={{ type: 'general', data: {} }}
          onClose={() => setComposeTemplate(null)}
          onSent={() => { setComposeTemplate(null); dialogService.success('Email sent!'); }}
        />
      )}
    </div>
  );
};

/* ---------------------------------------------------------------------- */
/*  Template form (create / edit)                                          */
/* ---------------------------------------------------------------------- */

interface TemplateFormProps {
  editingId: string | null;
  userId: string;
  initialData?: EmailTemplate;
  onSaved: () => void;
  onCancel: () => void;
}

const TemplateForm: React.FC<TemplateFormProps> = ({ editingId, userId, initialData, onSaved, onCancel }) => {
  const [name, setName]       = useState(initialData?.name    || '');
  const [context, setContext] = useState<EmailTemplate['context']>(initialData?.context || 'general');
  const [subject, setSubject] = useState(initialData?.subject || '');
  const [body, setBody]       = useState(initialData?.body    || '');
  const [busy, setBusy]       = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setContext(initialData.context);
      setSubject(initialData.subject);
      setBody(initialData.body);
    }
  }, [initialData?.id]);

  const handleSave = async () => {
    if (!name.trim() || !subject.trim()) {
      dialogService.alert({ title: 'Validation', message: 'Template name and subject are required.' });
      return;
    }
    setBusy(true);
    const row = { user_id: userId, name: name.trim(), context, subject: subject.trim(), body, updated_at: new Date().toISOString() };
    let err;
    if (editingId) {
      ({ error: err } = await supabase.from('email_templates').update(row).eq('id', editingId));
    } else {
      ({ error: err } = await supabase.from('email_templates').insert([row]));
    }
    setBusy(false);
    if (err) { dialogService.alert({ title: 'Save failed', message: err.message, tone: 'danger' }); return; }
    onSaved();
  };

  return (
    <div className="bg-white border border-blue-200 rounded-2xl p-5 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-black text-slate-900">{editingId ? 'Edit template' : 'New template'}</h2>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="h-4 w-4 text-slate-500" /></button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Template name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Contract Confirmation"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Context</label>
            <select value={context} onChange={(e) => setContext(e.target.value as EmailTemplate['context'])}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white font-semibold">
              <option value="general">General (manual send)</option>
              <option value="contract">Contract page</option>
              <option value="letter">Letter page</option>
              <option value="payment">Payment / Invoice</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1">Subject *</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Contract {{contract_no}} — Confirmation"
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1">Body (HTML or plain text)</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10}
            placeholder={"Dear {{contact_person}},\n\nPlease find attached the contract {{contract_no}}…"}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono resize-y" />
          <p className="text-[10px] text-slate-400 mt-1">
            Use <code>{'{{variable}}'}</code> placeholders. See the reference below for available variables.
            HTML tags are supported (e.g. <code>{'<b>{{contract_no}}</b>'}</code>).
          </p>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200">Cancel</button>
        <button onClick={handleSave} disabled={busy}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          <Save className="h-3.5 w-3.5" /> {busy ? 'Saving…' : editingId ? 'Save changes' : 'Create template'}
        </button>
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------------- */
/*  Template card                                                          */
/* ---------------------------------------------------------------------- */

const TemplateCard: React.FC<{
  template: EmailTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onCompose: () => void;
}> = ({ template, onEdit, onDelete, onCompose }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied]     = useState(false);

  const copyBody = () => {
    navigator.clipboard.writeText(template.body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-4 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black text-slate-900">{template.name}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${CONTEXT_COLORS[template.context] || CONTEXT_COLORS.general}`}>
              {CONTEXT_LABELS[template.context] || template.context}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 mt-1 truncate font-semibold">{template.subject}</p>
          {expanded && (
            <pre className="mt-2 text-[11px] text-slate-700 whitespace-pre-wrap font-mono bg-slate-50 rounded-lg p-3 border border-slate-200 max-h-48 overflow-y-auto">
              {template.body}
            </pre>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setExpanded((p) => !p)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title={expanded ? 'Collapse' : 'Expand'}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button onClick={copyBody} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Copy body">
            {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </button>
          <button onClick={onCompose}
            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600" title="Compose & send">
            <Send className="h-4 w-4" />
          </button>
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------------- */
/*  Variable reference panel                                               */
/* ---------------------------------------------------------------------- */

const VariableReference: React.FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6 border border-slate-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 transition"
      >
        <span className="inline-flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> Template variable reference</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="p-4">
          <p className="text-[11px] text-slate-500 mb-3">
            These <code className="bg-slate-100 px-1 rounded">{'{{variable}}'}</code> placeholders are automatically
            replaced with the right values when you compose from a contract, letter, or payment page.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <th className="py-2 pr-4">Variable</th>
                  <th className="py-2 pr-4">Description</th>
                  <th className="py-2">Available in</th>
                </tr>
              </thead>
              <tbody>
                {VARIABLE_DOCS.map((v) => (
                  <tr key={v.key} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 pr-4 font-mono text-blue-700">{`{{${v.key}}}`}</td>
                    <td className="py-1.5 pr-4 text-slate-700">{v.description}</td>
                    <td className="py-1.5 text-slate-500 capitalize">{v.contexts.join(', ')}</td>
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
