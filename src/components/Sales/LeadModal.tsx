import React, { useState, useEffect, useRef } from 'react';
import {
  X, Phone, Mail, Globe, MapPin, Calendar, ChevronDown,
  Plus, Save, Clock, Edit3, Minus, ExternalLink, AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Lead } from '../../types';
import DatePicker from '../UI/DatePicker';
import { dialogService } from '../../lib/dialogService';

// ── Helpers ────────────────────────────────────────────────────────────

interface ActivityItem {
  id: string;
  type: 'call' | 'email';
  date: string;
  summary: string;
  detail?: string;
  badge?: string;
  badgeColor?: string;
}

interface LeadModalProps {
  lead: Lead;
  onClose: () => void;
  onUpdate: (updated?: Lead) => void;
  onLogCall: () => void;
  onSendEmail: () => void;
}

const PIPELINE_STAGES: { key: Lead['status']; label: string }[] = [
  { key: 'new',           label: 'New' },
  { key: 'contacted',     label: 'Contacted' },
  { key: 'interested',    label: 'Interested' },
  { key: 'qualified',     label: 'Qualified' },
  { key: 'proposal_sent', label: 'Proposal' },
  { key: 'negotiating',   label: 'Negotiating' },
  { key: 'won',           label: 'Won' },
];

const STATUS_META: Record<string, { color: string; dot: string; bg: string }> = {
  new:           { color: 'text-blue-700',    dot: 'bg-blue-500',    bg: 'bg-blue-50 border-blue-200' },
  contacted:     { color: 'text-yellow-700',  dot: 'bg-yellow-500',  bg: 'bg-yellow-50 border-yellow-200' },
  interested:    { color: 'text-emerald-700', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200' },
  qualified:     { color: 'text-purple-700',  dot: 'bg-purple-500',  bg: 'bg-purple-50 border-purple-200' },
  proposal_sent: { color: 'text-indigo-700',  dot: 'bg-indigo-500',  bg: 'bg-indigo-50 border-indigo-200' },
  negotiating:   { color: 'text-orange-700',  dot: 'bg-orange-500',  bg: 'bg-orange-50 border-orange-200' },
  won:           { color: 'text-green-700',   dot: 'bg-green-600',   bg: 'bg-green-50 border-green-200' },
  lost:          { color: 'text-red-700',     dot: 'bg-red-500',     bg: 'bg-red-50 border-red-200' },
};

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700', 'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700',
  'bg-indigo-100 text-indigo-700', 'bg-teal-100 text-teal-700',
];

function avatarColor(name: string) {
  let n = 0; for (let i = 0; i < name.length; i++) n += name.charCodeAt(i);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}
function getInitials(name: string) {
  return name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
function daysSince(dateStr?: string | null) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}
function fmtDate(dateStr?: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white transition-colors';
const lbl = 'block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1';

// ── Component ──────────────────────────────────────────────────────────

const LeadModal: React.FC<LeadModalProps> = ({ lead, onClose, onUpdate, onLogCall, onSendEmail }) => {
  const [tab, setTab]                   = useState<'overview' | 'activity' | 'edit'>('overview');
  const [saving, setSaving]             = useState(false);
  const [status, setStatus]             = useState<Lead['status']>(lead.status);
  const [showStatusDrop, setShowStatusDrop] = useState(false);
  const [activity, setActivity]         = useState<ActivityItem[]>([]);
  const [actLoading, setActLoading]     = useState(false);
  const [noteText, setNoteText]         = useState('');
  const [savingNote, setSavingNote]     = useState(false);
  const [followUpDate, setFollowUpDate] = useState(lead.next_follow_up || '');
  const [editForm, setEditForm]         = useState<Partial<Lead>>({ ...lead });
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStatus(lead.status);
    setFollowUpDate(lead.next_follow_up || '');
    setEditForm({ ...lead });
    setNoteText('');
    setTab('overview');
  }, [lead.id]);

  useEffect(() => {
    if (tab === 'activity') loadActivity();
  }, [tab, lead.id]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowStatusDrop(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const loadActivity = async () => {
    if (!lead.id) return;
    setActLoading(true);
    const [callRes, emailRes] = await Promise.all([
      supabase.from('call_logs').select('*').eq('lead_id', lead.id).order('call_date', { ascending: false }),
      supabase.from('lead_email_logs').select('*').eq('lead_id', lead.id).order('sent_at', { ascending: false }),
    ]);
    const items: ActivityItem[] = [];
    (callRes.data || []).forEach((c: any) => items.push({
      id: `call-${c.id}`, type: 'call', date: c.call_date,
      summary: `${c.call_type === 'outbound' ? 'Outbound' : 'Inbound'} call · ${c.outcome.replace('_', ' ')}`,
      detail: c.notes, badge: c.duration_minutes ? `${c.duration_minutes} min` : undefined,
      badgeColor: c.outcome === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500',
    }));
    (emailRes.data || []).forEach((e: any) => items.push({
      id: `email-${e.id}`, type: 'email', date: e.sent_at,
      summary: `Email sent · "${e.subject}"`,
      detail: e.body?.slice(0, 120) + (e.body?.length > 120 ? '…' : ''),
      badgeColor: 'bg-blue-100 text-blue-700',
    }));
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setActivity(items);
    setActLoading(false);
  };

  const changeStatus = async (newStatus: Lead['status']) => {
    setShowStatusDrop(false);
    if (newStatus === status) return;
    setStatus(newStatus);
    try {
      const { error } = await supabase.from('leads').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', lead.id!);
      if (error) throw error;
      onUpdate({ ...lead, status: newStatus });
    } catch {
      setStatus(lead.status);
      dialogService.alert({ title: 'Failed to update status', message: 'Please try again.', tone: 'danger' });
    }
  };

  const saveFollowUp = async () => {
    setSaving(true);
    try {
      await supabase.from('leads').update({ next_follow_up: followUpDate || null, updated_at: new Date().toISOString() }).eq('id', lead.id!);
      onUpdate({ ...lead, next_follow_up: followUpDate });
      dialogService.success('Follow-up saved.');
    } catch { dialogService.alert({ title: 'Failed', message: 'Please try again.', tone: 'danger' }); }
    finally { setSaving(false); }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const stamp = `[${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}] ${noteText.trim()}`;
      const merged = lead.notes?.trim() ? `${stamp}\n\n${lead.notes.trim()}` : stamp;
      await supabase.from('leads').update({ notes: merged, updated_at: new Date().toISOString() }).eq('id', lead.id!);
      setNoteText('');
      onUpdate({ ...lead, notes: merged });
      dialogService.success('Note added.');
    } catch { dialogService.alert({ title: 'Failed', message: 'Please try again.', tone: 'danger' }); }
    finally { setSavingNote(false); }
  };

  const saveEdit = async () => {
    if (!editForm.company_name || !editForm.contact_person) {
      dialogService.alert({ title: 'Missing fields', message: 'Company and contact name are required.', tone: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...editForm, address: editForm.address?.filter(a => a.trim()) || [], tags: editForm.tags || [], updated_at: new Date().toISOString() };
      await supabase.from('leads').update(payload).eq('id', lead.id!);
      dialogService.success('Saved.');
      onUpdate({ ...lead, ...payload } as Lead);
    } catch (err: any) { dialogService.alert({ title: 'Save failed', message: err?.message, tone: 'danger' }); }
    finally { setSaving(false); }
  };

  const deleteLead = async () => {
    const ok = await dialogService.confirm({ title: 'Delete lead?', message: 'This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' });
    if (!ok) return;
    await supabase.from('leads').delete().eq('id', lead.id!);
    onUpdate(); onClose();
  };

  const meta      = STATUS_META[status] || STATUS_META.new;
  const stageIdx  = PIPELINE_STAGES.findIndex(s => s.key === status);
  const isLost    = status === 'lost';
  const days      = daysSince(lead.last_contact_date);
  const fupDue    = followUpDate && new Date(followUpDate) <= new Date();
  const fupChanged = followUpDate !== (lead.next_follow_up || '');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col z-10" style={{ maxHeight: '93dvh' }}>

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* ── Header ── */}
        <div className="px-6 pt-4 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black shrink-0 ${avatarColor(lead.company_name)}`}>
              {getInitials(lead.company_name)}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0 pt-0.5">
              <h2 className="text-lg font-black text-slate-900 leading-tight">{lead.company_name}</h2>
              <p className="text-sm text-slate-500 mt-0.5">{lead.contact_person}{lead.country ? ` · ${lead.country}` : ''}</p>
            </div>
            {/* Close */}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0 mt-0.5">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Status + last contact */}
          <div className="flex items-center gap-3 mt-3" ref={dropRef}>
            <div className="relative">
              <button
                onClick={() => setShowStatusDrop(!showStatusDrop)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border ${meta.bg} ${meta.color}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                {PIPELINE_STAGES.find(s => s.key === status)?.label ?? status.replace('_', ' ')}
                {isLost ? ' (Lost)' : ''}
                <ChevronDown className="h-3 w-3 ml-0.5 opacity-60" />
              </button>
              {showStatusDrop && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden w-44">
                  {([...PIPELINE_STAGES, { key: 'lost' as Lead['status'], label: 'Lost' }]).map(s => (
                    <button key={s.key} onClick={() => changeStatus(s.key)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-left hover:bg-gray-50 ${status === s.key ? 'text-blue-600 bg-blue-50/60' : 'text-slate-700'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[s.key]?.dot}`} />
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {days !== null && (
              <span className={`text-xs font-medium ${days > 14 ? 'text-red-400' : days > 7 ? 'text-orange-400' : 'text-gray-400'}`}>
                {days === 0 ? 'Contacted today' : `Last contact ${days}d ago`}
              </span>
            )}
          </div>

          {/* Pipeline progress */}
          {!isLost && (
            <div className="flex items-center gap-0 mt-4 overflow-x-auto no-scrollbar">
              {PIPELINE_STAGES.map((s, i) => {
                const done = i < stageIdx, cur = i === stageIdx, last = i === PIPELINE_STAGES.length - 1;
                return (
                  <React.Fragment key={s.key}>
                    <button onClick={() => changeStatus(s.key)} title={s.label}
                      className={`flex flex-col items-center gap-1 flex-shrink-0 group transition-opacity ${i > stageIdx + 1 ? 'opacity-25 hover:opacity-60' : ''}`}>
                      <div className={`w-2.5 h-2.5 rounded-full border-2 transition-all ${done ? 'bg-blue-600 border-blue-600' : cur ? 'bg-white border-blue-600 scale-[1.4] shadow shadow-blue-200' : 'bg-white border-gray-200 group-hover:border-gray-400'}`} />
                      <span className={`text-[9px] font-semibold whitespace-nowrap leading-none ${cur ? 'text-blue-600' : done ? 'text-blue-400' : 'text-gray-300 group-hover:text-gray-500'}`}>{s.label}</span>
                    </button>
                    {!last && <div className={`flex-1 h-px min-w-[8px] mb-3.5 ${i < stageIdx ? 'bg-blue-400' : 'bg-gray-200'}`} />}
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* Quick actions */}
          <div className="flex gap-2 mt-4">
            <button onClick={onLogCall} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors">
              <Phone className="h-3.5 w-3.5" /> Log Call
            </button>
            <button onClick={onSendEmail} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors">
              <Mail className="h-3.5 w-3.5" /> Send Email
            </button>
            <button onClick={() => setTab('edit')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl border transition-colors ${tab === 'edit' ? 'bg-slate-900 text-white border-slate-900' : 'text-slate-600 bg-white border-gray-200 hover:bg-gray-50'}`}>
              <Edit3 className="h-3.5 w-3.5" /> Edit
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-100 flex-shrink-0">
          {(['overview', 'activity', 'edit'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs font-bold capitalize transition-colors border-b-2 -mb-px ${tab === t ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="p-6 space-y-5">
              {/* Contact info */}
              <div className="space-y-2.5">
                {lead.email && (
                  <a href={`mailto:${lead.email}`} className="flex items-center gap-3 text-sm text-slate-700 hover:text-blue-600 group transition-colors">
                    <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center group-hover:bg-blue-50 transition-colors shrink-0">
                      <Mail className="h-3.5 w-3.5 text-gray-400 group-hover:text-blue-500" />
                    </div>
                    <span className="truncate">{lead.email}</span>
                  </a>
                )}
                {lead.phone && (
                  <a href={`tel:${lead.phone}`} className="flex items-center gap-3 text-sm text-slate-700 hover:text-emerald-600 group transition-colors">
                    <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center group-hover:bg-emerald-50 transition-colors shrink-0">
                      <Phone className="h-3.5 w-3.5 text-gray-400 group-hover:text-emerald-500" />
                    </div>
                    {lead.phone}
                  </a>
                )}
                {lead.website && (
                  <a href={lead.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-slate-700 hover:text-blue-600 group transition-colors">
                    <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center group-hover:bg-blue-50 transition-colors shrink-0">
                      <Globe className="h-3.5 w-3.5 text-gray-400 group-hover:text-blue-500" />
                    </div>
                    <span className="flex items-center gap-1 truncate">{lead.website.replace(/^https?:\/\//, '')} <ExternalLink className="h-3 w-3 shrink-0" /></span>
                  </a>
                )}
                {lead.country && (
                  <div className="flex items-center gap-3 text-sm text-slate-500">
                    <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                      <MapPin className="h-3.5 w-3.5 text-gray-400" />
                    </div>
                    {lead.country}
                  </div>
                )}
              </div>

              {/* Tags */}
              {(lead.industry_focus || lead.company_size || (lead.tags || []).length > 0) && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {lead.industry_focus && <span className="px-2.5 py-1 text-xs rounded-xl bg-gray-100 text-gray-600 font-medium">{lead.industry_focus}</span>}
                  {lead.company_size && <span className="px-2.5 py-1 text-xs rounded-xl bg-gray-100 text-gray-600 font-medium">{lead.company_size} employees</span>}
                  {(lead.tags || []).map(t => <span key={t} className="px-2.5 py-1 text-xs rounded-xl bg-blue-50 text-blue-600 font-medium">{t}</span>)}
                </div>
              )}

              {/* Follow-up */}
              <div className={`rounded-2xl p-4 border ${fupDue ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  {fupDue ? <AlertCircle className="h-4 w-4 text-orange-500" /> : <Calendar className="h-4 w-4 text-gray-400" />}
                  <p className={`text-xs font-bold uppercase tracking-widest ${fupDue ? 'text-orange-600' : 'text-gray-400'}`}>{fupDue ? 'Follow-up overdue' : 'Next follow-up'}</p>
                </div>
                <DatePicker label="" value={followUpDate} onChange={setFollowUpDate} />
                {fupChanged && (
                  <button onClick={saveFollowUp} disabled={saving}
                    className="mt-2.5 w-full py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
                    <Save className="h-3.5 w-3.5" />{saving ? 'Saving…' : 'Save date'}
                  </button>
                )}
              </div>

              {/* Notes */}
              <div>
                <p className={lbl}>Notes</p>
                {lead.notes && (
                  <div className="mb-3 p-3 bg-gray-50 rounded-2xl text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">{lead.notes}</div>
                )}
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={3}
                  placeholder="Add a note… (e.g. discussed pricing, requested samples)"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white resize-none" />
                {noteText.trim() && (
                  <button onClick={addNote} disabled={savingNote}
                    className="mt-2 w-full py-2 text-xs font-bold text-white bg-slate-800 rounded-xl hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" />{savingNote ? 'Saving…' : 'Add note'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ACTIVITY */}
          {tab === 'activity' && (
            <div className="p-6">
              {actLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : activity.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Clock className="h-6 w-6 text-gray-300" />
                  </div>
                  <p className="text-sm font-semibold text-gray-400">No activity yet</p>
                  <p className="text-xs text-gray-300 mt-1">Log a call or send an email to start tracking</p>
                  <div className="flex justify-center gap-2 mt-5">
                    <button onClick={onLogCall} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100">
                      <Phone className="h-3.5 w-3.5" /> Log Call
                    </button>
                    <button onClick={onSendEmail} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100">
                      <Mail className="h-3.5 w-3.5" /> Send Email
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-4 bottom-0 w-px bg-gray-100" />
                  <div className="space-y-6">
                    {activity.map(item => (
                      <div key={item.id} className="flex gap-4">
                        <div className={`relative z-10 w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${item.type === 'call' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                          {item.type === 'call' ? <Phone className="h-3.5 w-3.5 text-emerald-600" /> : <Mail className="h-3.5 w-3.5 text-blue-600" />}
                        </div>
                        <div className="flex-1 min-w-0 pb-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-800">{item.summary}</p>
                            {item.badge && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg flex-shrink-0 ${item.badgeColor}`}>{item.badge}</span>}
                          </div>
                          {item.detail && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.detail}</p>}
                          <p className="text-[10px] text-gray-300 mt-1">{fmtDate(item.date)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EDIT */}
          {tab === 'edit' && (
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={lbl}>Company Name *</label>
                  <input value={editForm.company_name || ''} onChange={e => setEditForm({ ...editForm, company_name: e.target.value })} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Contact Person *</label>
                  <input value={editForm.contact_person || ''} onChange={e => setEditForm({ ...editForm, contact_person: e.target.value })} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Email</label>
                  <input type="email" value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Phone</label>
                  <input type="tel" value={editForm.phone || ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} placeholder="+1 234 567 8900" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Country</label>
                  <input value={editForm.country || ''} onChange={e => setEditForm({ ...editForm, country: e.target.value })} placeholder="Italy" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Website</label>
                  <input type="url" value={editForm.website || ''} onChange={e => setEditForm({ ...editForm, website: e.target.value })} placeholder="https://…" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Industry Focus</label>
                  <input value={editForm.industry_focus || ''} onChange={e => setEditForm({ ...editForm, industry_focus: e.target.value })} placeholder="Footwear, Automotive…" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Company Size</label>
                  <select value={editForm.company_size || ''} onChange={e => setEditForm({ ...editForm, company_size: e.target.value })} className={inp}>
                    <option value="">Select…</option>
                    {['1-10','11-50','51-200','201-1000','1000+'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Source</label>
                  <select value={editForm.source || 'manual'} onChange={e => setEditForm({ ...editForm, source: e.target.value as Lead['source'] })} className={inp}>
                    <option value="manual">Manual</option>
                    <option value="leatherworkinggroup">Leather Working Group</option>
                    <option value="lineapelle">Lineapelle</option>
                    <option value="aplf">APLF</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={lbl}>Address</label>
                  {(editForm.address?.length ? editForm.address : ['']).map((a, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input value={a} onChange={e => { const arr = [...(editForm.address || [])]; arr[i] = e.target.value; setEditForm({ ...editForm, address: arr }); }} className={inp} placeholder={`Line ${i + 1}`} />
                      {i > 0 && <button onClick={() => setEditForm({ ...editForm, address: (editForm.address || []).filter((_, j) => j !== i) })} className="w-9 flex items-center justify-center rounded-xl text-gray-300 hover:text-red-400"><Minus className="h-4 w-4" /></button>}
                    </div>
                  ))}
                  <button onClick={() => setEditForm({ ...editForm, address: [...(editForm.address || []), ''] })} className="text-xs font-semibold text-blue-600 flex items-center gap-1 hover:text-blue-700 mt-1">
                    <Plus className="h-3.5 w-3.5" /> Add line
                  </button>
                </div>
                <div className="sm:col-span-2">
                  <label className={lbl}>Notes</label>
                  <textarea value={editForm.notes || ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} rows={4} className={`${inp} resize-none`} />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <button onClick={deleteLead} className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors">Delete lead</button>
                <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  <Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeadModal;
