import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Upload, X, Zap, Clock, ChevronDown, Mail, Phone, Calendar, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Lead } from '../../types';
import LeadModal from './LeadModal';
import LeadDetailsModal from './LeadDetailsModal';
import CallLogModal from './CallLogModal';
import EmailComposeModal from './EmailComposeModal';
import BulkEmailModal from './BulkEmailModal';
import LWGScraperModal from './LWGScraperModal';
import MobilePageHeader from '../Layout/MobilePageHeader';

// ── Helpers ───────────────────────────────────────────────────────────

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
function isFollowUpDue(d?: string | null) {
  return !!d && new Date(d) <= new Date();
}
function daysSince(d?: string | null) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

const STATUS_OPTS = [
  { key: 'all',        label: 'All stages' },
  { key: 'new',        label: 'New' },
  { key: 'approached', label: 'Approached' },
  { key: 'interested', label: 'Interested' },
  { key: 'lost',       label: 'Lost' },
];

const STATUS_DOT: Record<string, string> = {
  new:        'bg-blue-500',
  approached: 'bg-yellow-500',
  interested: 'bg-emerald-500',
  lost:       'bg-red-500',
  // legacy — keep for existing DB records
  contacted:     'bg-yellow-500',
  qualified:     'bg-purple-500',
  proposal_sent: 'bg-indigo-500',
  negotiating:   'bg-orange-500',
  won:           'bg-green-600',
};

const STATUS_LABEL: Record<string, string> = {
  new:        'New',
  approached: 'Approached',
  interested: 'Interested',
  lost:       'Lost',
  contacted:     'Approached',
  qualified:     'Qualified',
  proposal_sent: 'Proposal',
  negotiating:   'Negotiating',
  won:           'Won',
};

const STATUS_COLOR: Record<string, string> = {
  new:           'text-blue-700 bg-blue-50',
  approached:    'text-yellow-700 bg-yellow-50',
  interested:    'text-emerald-700 bg-emerald-50',
  lost:          'text-red-700 bg-red-50',
  contacted:     'text-yellow-700 bg-yellow-50',
  qualified:     'text-purple-700 bg-purple-50',
  proposal_sent: 'text-indigo-700 bg-indigo-50',
  negotiating:   'text-orange-700 bg-orange-50',
  won:           'text-green-700 bg-green-50',
};

type LeadTab = 'updates' | 'leads';
type LeadProfileTab = 'overview' | 'activity' | 'edit';
type LeadUpdateKind = 'call' | 'email' | 'follow_up' | 'note';

interface LeadUpdateItem {
  id: string;
  leadId: string;
  leadName: string;
  contactPerson?: string;
  kind: LeadUpdateKind;
  summary: string;
  detail?: string;
  date: string;
  badge: string;
  badgeColor: string;
  iconColor: string;
  focusId: string;
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function summarizeLeadNote(notes?: string) {
  if (!notes?.trim()) return null;
  const firstBlock = notes
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .find(Boolean);
  if (!firstBlock) return null;

  const cleaned = firstBlock.replace(/^\[[^\]]+\]\s*/, '').trim();
  return cleaned || firstBlock;
}

// ── Main page ─────────────────────────────────────────────────────────

const SalesPage: React.FC = () => {
  const [leads, setLeads]               = useState<Lead[]>([]);
  const [leadUpdates, setLeadUpdates]   = useState<LeadUpdateItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [updatesLoading, setUpdatesLoading] = useState(true);
  const [searchTerm, setSearchTerm]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showStatusDrop, setShowStatusDrop] = useState(false);
  const [activeTab, setActiveTab]       = useState<LeadTab>('updates');

  const [activeLead, setActiveLead]         = useState<Lead | null>(null);
  const [leadProfileTab, setLeadProfileTab] = useState<LeadProfileTab>('overview');
  const [leadProfileFocusId, setLeadProfileFocusId] = useState<string | null>(null);
  const [leadActivityRefreshToken, setLeadActivityRefreshToken] = useState(0);
  const [isAddOpen, setIsAddOpen]           = useState(false);
  const [isCallOpen, setIsCallOpen]         = useState(false);
  const [isEmailOpen, setIsEmailOpen]       = useState(false);
  const [isBulkEmailOpen, setIsBulkEmailOpen] = useState(false);
  const [isLWGOpen, setIsLWGOpen]           = useState(false);
  const [searchParams, setSearchParams]     = useSearchParams();

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('leads').select('*').order('created_at', { ascending: false });
    setLeads(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const fetchLeadUpdates = useCallback(async (leadRows: Lead[]) => {
    setUpdatesLoading(true);
    const [callRes, emailRes] = await Promise.all([
      supabase.from('call_logs').select('id, lead_id, call_date, call_type, outcome, duration_minutes, notes').order('call_date', { ascending: false }).limit(20),
      supabase.from('lead_email_logs').select('id, lead_id, sent_at, subject, body, status').order('sent_at', { ascending: false }).limit(20),
    ]);

    const leadById = new Map(
      leadRows
        .filter((lead): lead is Lead & { id: string } => !!lead.id)
        .map((lead) => [lead.id, lead]),
    );
    const next: LeadUpdateItem[] = [];

    (callRes.data || []).forEach((call: any) => {
      const lead = leadById.get(call.lead_id);
      if (!lead) return;
      next.push({
        id: `call-${call.id}`,
        leadId: lead.id!,
        leadName: lead.company_name,
        contactPerson: lead.contact_person,
        kind: 'call',
        summary: `${call.call_type === 'outbound' ? 'Outbound' : 'Inbound'} call · ${String(call.outcome || '').replace('_', ' ')}`,
        detail: call.notes,
        date: call.call_date,
        badge: call.duration_minutes ? `${call.duration_minutes} min` : 'Call',
        badgeColor: call.outcome === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600',
        iconColor: 'bg-emerald-100 text-emerald-600',
        focusId: `call-${call.id}`,
      });
    });

    (emailRes.data || []).forEach((email: any) => {
      const lead = leadById.get(email.lead_id);
      if (!lead) return;
      next.push({
        id: `email-${email.id}`,
        leadId: lead.id!,
        leadName: lead.company_name,
        contactPerson: lead.contact_person,
        kind: 'email',
        summary: `Email sent · ${email.subject || 'Untitled message'}`,
        detail: email.body?.slice(0, 120) + (email.body?.length > 120 ? '…' : ''),
        date: email.sent_at,
        badge: email.status || 'sent',
        badgeColor: 'bg-blue-100 text-blue-700',
        iconColor: 'bg-blue-100 text-blue-600',
        focusId: `email-${email.id}`,
      });
    });

    leadRows.forEach((lead) => {
      const noteSummary = summarizeLeadNote(lead.notes);
      if (!noteSummary) return;
      next.push({
        id: `note-${lead.id}`,
        leadId: lead.id!,
        leadName: lead.company_name,
        contactPerson: lead.contact_person,
        kind: 'note',
        summary: 'Note updated',
        detail: noteSummary.slice(0, 160) + (noteSummary.length > 160 ? '…' : ''),
        date: lead.updated_at || lead.created_at || new Date().toISOString(),
        badge: 'Note',
        badgeColor: 'bg-slate-100 text-slate-700',
        iconColor: 'bg-slate-100 text-slate-600',
        focusId: 'notes',
      });
    });

    leadRows
      .filter((lead): lead is Lead & { id: string; next_follow_up: string } => !!lead.id && !!lead.next_follow_up)
      .forEach((lead) => {
        next.push({
          id: `followup-${lead.id}`,
          leadId: lead.id,
          leadName: lead.company_name,
          contactPerson: lead.contact_person,
          kind: 'follow_up',
          summary: 'Follow-up scheduled',
          detail: `Due on ${formatShortDate(lead.next_follow_up)}`,
          date: lead.next_follow_up,
          badge: 'Due',
          badgeColor: 'bg-fuchsia-100 text-fuchsia-700',
          iconColor: 'bg-fuchsia-100 text-fuchsia-600',
          focusId: `followup-${lead.id}`,
        });
      });

    next.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setLeadUpdates(next.slice(0, 24));
    setUpdatesLoading(false);
  }, []);

  useEffect(() => { fetchLeadUpdates(leads); }, [leads, fetchLeadUpdates]);

  useEffect(() => {
    const leadId = searchParams.get('lead');
    if (!leadId || leads.length === 0) return;
    const found = leads.find((lead) => lead.id === leadId);
    if (!found) return;
    const focus = searchParams.get('focus');
    setActiveTab('leads');
    setActiveLead(found);
    setLeadProfileTab('activity');
    setLeadProfileFocusId(focus === 'followup' ? `followup-${found.id}` : null);
    setSearchParams({}, { replace: true });
  }, [searchParams, leads, setSearchParams]);

  const filteredLeads = leads.filter(l => {
    const q = searchTerm.toLowerCase();
    const matchSearch = !q || [l.company_name, l.contact_person, l.email, l.country || '']
      .some(v => v.toLowerCase().includes(q));
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleModalUpdate = (updated?: Lead) => {
    if (updated) {
      setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
      setActiveLead(updated);
      setLeadActivityRefreshToken(token => token + 1);
    } else {
      fetchLeads();
      setActiveLead(null);
    }
  };

  const openLeadProfile = (lead: Lead, options?: { initialTab?: LeadProfileTab; focusId?: string | null }) => {
    setActiveLead(lead);
    setLeadProfileTab(options?.initialTab || 'overview');
    setLeadProfileFocusId(options?.focusId ?? null);
    setActiveTab('leads');
  };

  const handleUpdateClick = (update: LeadUpdateItem) => {
    const lead = leads.find(item => item.id === update.leadId);
    if (!lead) return;
    openLeadProfile(lead, {
      initialTab: update.kind === 'note' ? 'overview' : 'activity',
      focusId: update.focusId,
    });
  };

  const currentStatusLabel = STATUS_OPTS.find(o => o.key === statusFilter)?.label ?? 'All stages';

  const renderStatusDropdown = () => (
    <div className="relative shrink-0">
      <button
        onClick={() => setShowStatusDrop(!showStatusDrop)}
        className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold bg-white border border-gray-200 rounded-2xl shadow-sm hover:border-gray-300 transition-colors whitespace-nowrap text-slate-700"
      >
        {statusFilter !== 'all' && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[statusFilter]}`} />}
        {currentStatusLabel}
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </button>
      {showStatusDrop && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowStatusDrop(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden w-44">
            {STATUS_OPTS.map(o => {
              const cnt = o.key === 'all' ? leads.length : leads.filter(l => l.status === o.key).length;
              return (
                <button key={o.key} onClick={() => { setStatusFilter(o.key); setShowStatusDrop(false); }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-left hover:bg-gray-50 transition-colors ${statusFilter === o.key ? 'text-blue-600 bg-blue-50/60' : 'text-slate-700'}`}>
                  <span className="flex items-center gap-2">
                    {o.key !== 'all' && <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[o.key]}`} />}
                    {o.label}
                  </span>
                  {cnt > 0 && <span className="text-[10px] text-gray-400 font-bold">{cnt}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  const renderUpdates = () => (
    <div className="space-y-3">
      {updatesLoading ? (
        <div className="flex items-center justify-center py-14">
          <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : leadUpdates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
          <MessageSquare className="h-8 w-8 text-gray-200 mb-3" />
          <p className="text-sm font-bold text-slate-400">
            {searchTerm ? 'No updates match your search' : 'No lead updates yet'}
          </p>
        </div>
      ) : (
        leadUpdates
          .filter((item) => {
            const q = searchTerm.toLowerCase();
            if (!q) return true;
            return [item.leadName, item.contactPerson || '', item.summary, item.detail || '', item.badge]
              .some((value) => value.toLowerCase().includes(q));
          })
          .map((update) => {
            const icon =
              update.kind === 'call' ? <Phone className="h-4 w-4" /> :
              update.kind === 'follow_up' ? <Calendar className="h-4 w-4" /> :
              update.kind === 'note' ? <MessageSquare className="h-4 w-4" /> :
              <Mail className="h-4 w-4" />;

            return (
              <button
                key={update.id}
                onClick={() => handleUpdateClick(update)}
                className="w-full bg-white rounded-3xl border border-gray-200 shadow-sm px-4 py-3.5 text-left hover:border-blue-200 hover:bg-blue-50/40 transition-colors active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${update.iconColor}`}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{update.leadName}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${update.badgeColor}`}>
                        {update.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{update.summary}</p>
                    {update.detail && <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{update.detail}</p>}
                    <p className="text-[10px] text-gray-300 mt-1">{formatShortDate(update.date)}</p>
                  </div>
                </div>
              </button>
            );
          })
      )}
    </div>
  );

  return (
    <div className="bg-gray-50/60">
      <div className="px-4 py-6 max-w-3xl mx-auto space-y-5 page-fade-in">

        {/* ── Page header ── */}
        <div className="space-y-3">
          <MobilePageHeader
            eyebrow="CRM Pipeline"
            title="Lead IQ"
            subtitle={loading ? 'Loadingâ€¦' : `${leads.length} prospect${leads.length !== 1 ? 's' : ''}`}
            action={(
              <button
                onClick={() => setIsAddOpen(true)}
                className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-3 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition md:hidden"
                aria-label="Add lead"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          />

          <div className="hidden items-start justify-between gap-3 md:flex">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-500 mb-1">CRM Pipeline</p>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Lead IQ</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {loading ? 'Loading…' : `${leads.length} prospect${leads.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            {/* Desktop buttons — shown only on sm+ */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsBulkEmailOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold rounded-2xl text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition shadow-sm"
              >
                <Mail className="h-3.5 w-3.5" /> Cold Email
              </button>
              <button
                onClick={() => setIsLWGOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold rounded-2xl text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 transition shadow-sm"
              >
                <Upload className="h-3.5 w-3.5" /> Import LWG
              </button>
              <button
                onClick={() => setIsAddOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-2xl text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm"
              >
                <Plus className="h-4 w-4" /> Add Lead
              </button>
            </div>
          </div>

          {/* Mobile buttons — stacked for better accessibility on narrow screens */}
          <div className="grid grid-cols-2 gap-2 md:hidden">
            <button
              onClick={() => setIsAddOpen(true)}
              className="col-span-2 flex items-center justify-center gap-1.5 py-3 text-sm font-bold rounded-2xl text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition shadow-md"
            >
              <Plus className="h-4 w-4" /> Add Lead
            </button>
            <button
              onClick={() => setIsBulkEmailOpen(true)}
              className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-2xl text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 active:scale-95 transition shadow-sm"
            >
              <Mail className="h-3.5 w-3.5" /> Cold Email
            </button>
            <button
              onClick={() => setIsLWGOpen(true)}
              className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-2xl text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 active:scale-95 transition shadow-sm"
            >
              <Upload className="h-3.5 w-3.5" /> Import LWG
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 bg-white rounded-2xl border border-gray-200 p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('updates')}
            className={`h-10 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'updates' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageSquare className="h-4 w-4" /> Updates
          </button>
          <button
            onClick={() => setActiveTab('leads')}
            className={`h-10 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'leads' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Zap className="h-4 w-4" /> Leads
          </button>
        </div>

        {activeTab === 'updates' ? renderUpdates() : (
          <>
        {/* ── Search + filter row ── */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search company, contact, country…"
              className="w-full pl-10 pr-9 py-2.5 bg-white text-slate-900 text-sm border border-gray-200 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder-slate-400 shadow-sm"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {renderStatusDropdown()}
        </div>

        {/* ── Lead list ── */}
        {loading ? (
          <div className="flex items-center justify-center h-44">
            <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 bg-white rounded-3xl border border-dashed border-gray-200">
            <Zap className="h-8 w-8 text-gray-200 mb-3" />
            <p className="text-sm font-bold text-slate-400">
              {searchTerm || statusFilter !== 'all' ? 'No leads match your search' : 'No leads yet'}
            </p>
            {!(searchTerm || statusFilter !== 'all') && (
              <div className="flex gap-2 mt-4">
                <button onClick={() => setIsAddOpen(true)} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700">
                  <Plus className="h-3.5 w-3.5" /> Add Manually
                </button>
                <button onClick={() => setIsLWGOpen(true)} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100">
                  <Upload className="h-3.5 w-3.5" /> Import LWG
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            {filteredLeads.map((lead, idx) => {
              const fupDue = isFollowUpDue(lead.next_follow_up);
              const days   = daysSince(lead.last_contact_date);
              const isLast = idx === filteredLeads.length - 1;

              return (
                <button
                  key={lead.id}
                  onClick={() => openLeadProfile(lead)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors active:bg-blue-50/50 group ${!isLast ? 'border-b border-gray-100' : ''}`}
                >
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${avatarColor(lead.company_name)}`}>
                    {getInitials(lead.company_name)}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                        {lead.company_name}
                      </p>
                      {fupDue && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-500 shrink-0">
                          <Clock className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {[lead.contact_person, lead.country].filter(Boolean).join(' · ')}
                    </p>
                  </div>

                  {/* Right side: status + last contact */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${STATUS_COLOR[lead.status] || 'bg-gray-100 text-gray-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[lead.status] || 'bg-gray-400'}`} />
                      {STATUS_LABEL[lead.status] || lead.status}
                    </span>
                    {days !== null && (
                      <span className={`text-[10px] font-medium ${days > 14 ? 'text-red-400' : days > 7 ? 'text-orange-400' : 'text-gray-300'}`}>
                        {days === 0 ? 'today' : `${days}d ago`}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
          </>
        )}

      </div>

      {/* ── Lead detail modal ── */}
      {activeLead && (
        <LeadModal
          lead={activeLead}
          onClose={() => setActiveLead(null)}
          onUpdate={handleModalUpdate}
          onLogCall={() => setIsCallOpen(true)}
          onSendEmail={() => setIsEmailOpen(true)}
          initialTab={leadProfileTab}
          highlightedActivityId={leadProfileFocusId}
          refreshToken={leadActivityRefreshToken}
        />
      )}

      {/* ── Add lead modal ── */}
      <LeadDetailsModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        lead={null}
        onLeadUpdated={() => { fetchLeads(); setIsAddOpen(false); }}
      />

      {/* ── Call log modal ── */}
      <CallLogModal
        isOpen={isCallOpen}
        onClose={() => setIsCallOpen(false)}
        lead={activeLead}
        onCallLogged={() => {
          setIsCallOpen(false);
          if (activeLead) {
            const updated = { ...activeLead, last_contact_date: new Date().toISOString().split('T')[0] };
            setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
            setActiveLead(updated);
            setLeadActivityRefreshToken(token => token + 1);
          }
          fetchLeads();
        }}
      />

      {/* ── Email compose modal ── */}
      <EmailComposeModal
        isOpen={isEmailOpen}
        onClose={() => setIsEmailOpen(false)}
        lead={activeLead}
        onEmailSent={() => {
          setIsEmailOpen(false);
          fetchLeads();
          setLeadActivityRefreshToken(token => token + 1);
        }}
      />

      {/* ── Bulk cold email modal ── */}
      <BulkEmailModal
        isOpen={isBulkEmailOpen}
        onClose={() => setIsBulkEmailOpen(false)}
        leads={filteredLeads}
      />

      {/* ── LWG import modal ── */}
      <LWGScraperModal
        isOpen={isLWGOpen}
        onClose={() => setIsLWGOpen(false)}
        onLeadsImported={fetchLeads}
      />
    </div>
  );
};

export default SalesPage;
