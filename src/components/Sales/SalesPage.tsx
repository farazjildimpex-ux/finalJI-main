import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Upload, X, Zap, Clock, ChevronDown, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Lead } from '../../types';
import LeadModal from './LeadModal';
import LeadDetailsModal from './LeadDetailsModal';
import CallLogModal from './CallLogModal';
import EmailComposeModal from './EmailComposeModal';
import BulkEmailModal from './BulkEmailModal';
import LWGScraperModal from './LWGScraperModal';

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
  { key: 'all',           label: 'All stages' },
  { key: 'new',           label: 'New' },
  { key: 'contacted',     label: 'Contacted' },
  { key: 'interested',    label: 'Interested' },
  { key: 'qualified',     label: 'Qualified' },
  { key: 'proposal_sent', label: 'Proposal sent' },
  { key: 'negotiating',   label: 'Negotiating' },
  { key: 'won',           label: 'Won' },
  { key: 'lost',          label: 'Lost' },
];

const STATUS_DOT: Record<string, string> = {
  new: 'bg-blue-500', contacted: 'bg-yellow-500', interested: 'bg-emerald-500',
  qualified: 'bg-purple-500', proposal_sent: 'bg-indigo-500', negotiating: 'bg-orange-500',
  won: 'bg-green-600', lost: 'bg-red-500',
};

const STATUS_LABEL: Record<string, string> = {
  new: 'New', contacted: 'Contacted', interested: 'Interested',
  qualified: 'Qualified', proposal_sent: 'Proposal', negotiating: 'Negotiating',
  won: 'Won', lost: 'Lost',
};

const STATUS_COLOR: Record<string, string> = {
  new:           'text-blue-700 bg-blue-50',
  contacted:     'text-yellow-700 bg-yellow-50',
  interested:    'text-emerald-700 bg-emerald-50',
  qualified:     'text-purple-700 bg-purple-50',
  proposal_sent: 'text-indigo-700 bg-indigo-50',
  negotiating:   'text-orange-700 bg-orange-50',
  won:           'text-green-700 bg-green-50',
  lost:          'text-red-700 bg-red-50',
};

// ── Main page ─────────────────────────────────────────────────────────

const SalesPage: React.FC = () => {
  const [leads, setLeads]               = useState<Lead[]>([]);
  const [loading, setLoading]           = useState(true);
  const [searchTerm, setSearchTerm]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showStatusDrop, setShowStatusDrop] = useState(false);

  const [activeLead, setActiveLead]         = useState<Lead | null>(null);
  const [isAddOpen, setIsAddOpen]           = useState(false);
  const [isCallOpen, setIsCallOpen]         = useState(false);
  const [isEmailOpen, setIsEmailOpen]       = useState(false);
  const [isBulkEmailOpen, setIsBulkEmailOpen] = useState(false);
  const [isLWGOpen, setIsLWGOpen]           = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('leads').select('*').order('created_at', { ascending: false });
    setLeads(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const filtered = leads.filter(l => {
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
    } else {
      fetchLeads();
      setActiveLead(null);
    }
  };

  const currentStatusLabel = STATUS_OPTS.find(o => o.key === statusFilter)?.label ?? 'All stages';

  return (
    <div className="min-h-full bg-gray-50/60">
      <div className="px-4 py-6 max-w-3xl mx-auto space-y-5 page-fade-in">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-500 mb-1">CRM Pipeline</p>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Lead IQ</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {loading ? 'Loading…' : `${leads.length} prospect${leads.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsBulkEmailOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold rounded-2xl text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition shadow-sm"
              title="Bulk Cold Email"
            >
              <Mail className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cold Email</span>
            </button>
            <button
              onClick={() => setIsLWGOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold rounded-2xl text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 transition shadow-sm"
              title="Import from Leather Working Group"
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Import LWG</span>
            </button>
            <button
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-bold rounded-2xl text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Lead</span>
            </button>
          </div>
        </div>

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

          {/* Status dropdown */}
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
        </div>

        {/* ── Lead list ── */}
        {loading ? (
          <div className="flex items-center justify-center h-44">
            <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
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
            {filtered.map((lead, idx) => {
              const fupDue = isFollowUpDue(lead.next_follow_up);
              const days   = daysSince(lead.last_contact_date);
              const isLast = idx === filtered.length - 1;

              return (
                <button
                  key={lead.id}
                  onClick={() => setActiveLead(lead)}
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


      </div>

      {/* ── Lead detail modal ── */}
      {activeLead && (
        <LeadModal
          lead={activeLead}
          onClose={() => setActiveLead(null)}
          onUpdate={handleModalUpdate}
          onLogCall={() => setIsCallOpen(true)}
          onSendEmail={() => setIsEmailOpen(true)}
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
          }
        }}
      />

      {/* ── Email compose modal ── */}
      <EmailComposeModal
        isOpen={isEmailOpen}
        onClose={() => setIsEmailOpen(false)}
        lead={activeLead}
        onEmailSent={() => setIsEmailOpen(false)}
      />

      {/* ── Bulk cold email modal ── */}
      <BulkEmailModal
        isOpen={isBulkEmailOpen}
        onClose={() => setIsBulkEmailOpen(false)}
        leads={filtered}
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
