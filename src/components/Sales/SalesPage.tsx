import React, { useState, useEffect } from 'react';
import {
  Zap, Plus, Search, Mail, Phone, Globe, MapPin,
  RefreshCw, Filter, Clock, X, Upload
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import LeadDetailsModal from './LeadDetailsModal';
import EmailTemplatesModal from './EmailTemplatesModal';
import EmailComposeModal from './EmailComposeModal';
import CallLogModal from './CallLogModal';
import LWGScraperModal from './LWGScraperModal';
import type { Lead } from '../../types';

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  new:           { label: 'New',           color: 'bg-blue-100 text-blue-700 border-blue-200',     dot: 'bg-blue-500' },
  contacted:     { label: 'Contacted',     color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  interested:    { label: 'Interested',    color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  qualified:     { label: 'Qualified',     color: 'bg-purple-100 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  proposal_sent: { label: 'Proposal Sent', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  negotiating:   { label: 'Negotiating',   color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  won:           { label: 'Won',           color: 'bg-green-100 text-green-700 border-green-200',   dot: 'bg-green-600' },
  lost:          { label: 'Lost',          color: 'bg-red-100 text-red-700 border-red-200',         dot: 'bg-red-500' },
};

const SOURCE_CONFIG: Record<string, { label: string; color: string }> = {
  leatherworkinggroup: { label: 'LWG',      color: 'bg-teal-100 text-teal-700' },
  lineapelle:          { label: 'Lineapelle', color: 'bg-purple-100 text-purple-700' },
  aplf:                { label: 'APLF',      color: 'bg-blue-100 text-blue-700' },
  manual:              { label: 'Manual',    color: 'bg-gray-100 text-gray-600' },
  other:               { label: 'Other',     color: 'bg-gray-100 text-gray-600' },
};

function daysSince(dateStr?: string) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / 86400000);
}

function isFollowUpDue(dateStr?: string) {
  if (!dateStr) return false;
  return new Date(dateStr) <= new Date();
}

const SalesPage: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filtered, setFiltered] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'leads' | 'templates'>('leads');
  const [showFilters, setShowFilters] = useState(false);

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isLWGModalOpen, setIsLWGModalOpen] = useState(false);

  useEffect(() => { fetchLeads(); }, []);

  useEffect(() => {
    let f = [...leads];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      f = f.filter(l =>
        l.company_name.toLowerCase().includes(q) ||
        l.contact_person.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.country || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') f = f.filter(l => l.status === statusFilter);
    if (sourceFilter !== 'all') f = f.filter(l => l.source === sourceFilter);
    setFiltered(f);
  }, [leads, searchTerm, statusFilter, sourceFilter]);

  const fetchLeads = async () => {
    setLoading(true);
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    setLeads(data || []);
    setLoading(false);
  };

  const handleNewLead = () => { setSelectedLead(null); setIsLeadModalOpen(true); };
  const handleEditLead = (lead: Lead) => { setSelectedLead(lead); setIsLeadModalOpen(true); };
  const handleEmailLead = (lead: Lead, e: React.MouseEvent) => { e.stopPropagation(); setSelectedLead(lead); setIsEmailModalOpen(true); };
  const handleCallLead = (lead: Lead, e: React.MouseEvent) => { e.stopPropagation(); setSelectedLead(lead); setIsCallModalOpen(true); };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">Lead IQ</h1>
                <p className="text-xs text-gray-500 hidden sm:block">Sales intelligence & follow-up hub</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsLWGModalOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
              >
                <Upload className="h-4 w-4" />
                Import LWG
              </button>
              <button
                onClick={handleNewLead}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Lead</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-5 space-y-5">
        {/* ── Mobile quick actions ── */}
        <div className="flex sm:hidden gap-2">
          <button
            onClick={() => setIsLWGModalOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg"
          >
            <Upload className="h-4 w-4" />
            Import LWG
          </button>
        </div>

        {/* ── Search & Filters ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search company, contact, email, country..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 w-full text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${
                (statusFilter !== 'all' || sourceFilter !== 'all') || showFilters
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {(statusFilter !== 'all' || sourceFilter !== 'all') && (
                <span className="bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {[statusFilter !== 'all', sourceFilter !== 'all'].filter(Boolean).length}
                </span>
              )}
            </button>
            <button onClick={fetchLeads} className="px-3 py-2 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {showFilters && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <select
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value)}
                className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Sources</option>
                {Object.entries(SOURCE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              {(statusFilter !== 'all' || sourceFilter !== 'all') && (
                <button
                  onClick={() => { setStatusFilter('all'); setSourceFilter('all'); }}
                  className="text-sm text-red-500 hover:text-red-700 px-2"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Results count ── */}
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-gray-500">
            {loading ? 'Loading...' : `${filtered.length} lead${filtered.length !== 1 ? 's' : ''}${searchTerm || statusFilter !== 'all' || sourceFilter !== 'all' ? ' found' : ''}`}
          </p>
        </div>

        {/* ── Leads List ── */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Loading leads...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="h-7 w-7 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              {searchTerm || statusFilter !== 'all' || sourceFilter !== 'all' ? 'No leads match your filters' : 'No leads yet'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all' || sourceFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Add leads manually or import from the Leather Working Group directory'}
            </p>
            {!(searchTerm || statusFilter !== 'all' || sourceFilter !== 'all') && (
              <div className="flex justify-center gap-2">
                <button onClick={handleNewLead} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                  <Plus className="h-4 w-4" /> Add Manually
                </button>
                <button onClick={() => setIsLWGModalOpen(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100">
                  <Upload className="h-4 w-4" /> Import LWG
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(lead => {
              const status = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
              const source = SOURCE_CONFIG[lead.source] || SOURCE_CONFIG.other;
              const days = daysSince(lead.last_contact_date);
              const followUpDue = isFollowUpDue(lead.next_follow_up);

              return (
                <div
                  key={lead.id}
                  onClick={() => handleEditLead(lead)}
                  className="bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">{lead.company_name}</h3>
                          {followUpDue && (
                            <span className="flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
                              <Clock className="h-3 w-3" /> Follow-up due
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500 mb-2">
                          <span className="font-medium text-gray-700">{lead.contact_person}</span>
                          {lead.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              <span className="truncate max-w-[160px]">{lead.email}</span>
                            </span>
                          )}
                          {lead.country && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {lead.country}
                            </span>
                          )}
                          {lead.website && (
                            <a
                              href={lead.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1 text-blue-500 hover:text-blue-700"
                            >
                              <Globe className="h-3 w-3" />
                              <span className="hidden sm:inline">Website</span>
                            </a>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${status.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${source.color}`}>
                            {source.label}
                          </span>
                          {lead.industry_focus && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                              {lead.industry_focus}
                            </span>
                          )}
                          {days !== null && (
                            <span className={`text-xs ${days > 14 ? 'text-red-500' : days > 7 ? 'text-orange-500' : 'text-gray-400'}`}>
                              {days === 0 ? 'Contacted today' : `Last contact ${days}d ago`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={e => handleEmailLead(lead, e)}
                          title="Send email"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Mail className="h-4 w-4" />
                        </button>
                        <button
                          onClick={e => handleCallLead(lead, e)}
                          title="Log call"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-green-600 hover:bg-green-50 transition-colors"
                        >
                          <Phone className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Floating Add button (mobile) ── */}
      <button
        onClick={handleNewLead}
        className="fixed bottom-20 right-4 sm:hidden w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center z-20 hover:bg-blue-700 active:scale-95 transition-all"
      >
        <Plus className="h-5 w-5" />
      </button>

      {/* ── Modals ── */}
      <LeadDetailsModal
        isOpen={isLeadModalOpen}
        onClose={() => setIsLeadModalOpen(false)}
        lead={selectedLead}
        onLeadUpdated={() => { fetchLeads(); setIsLeadModalOpen(false); }}
      />
      <EmailTemplatesModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
      />
      <EmailComposeModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        lead={selectedLead}
        onEmailSent={() => setIsEmailModalOpen(false)}
      />
      <CallLogModal
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        lead={selectedLead}
        onCallLogged={() => { setIsCallModalOpen(false); fetchLeads(); }}
      />
      <LWGScraperModal
        isOpen={isLWGModalOpen}
        onClose={() => setIsLWGModalOpen(false)}
        onLeadsImported={fetchLeads}
      />
    </div>
  );
};

export default SalesPage;
