import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Filter, Mail, Phone, Calendar, Tag, TrendingUp, Download, Upload, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import LeadsList from './LeadsList';
import LeadDetailsModal from './LeadDetailsModal';
import EmailTemplatesModal from './EmailTemplatesModal';
import EmailComposeModal from './EmailComposeModal';
import CallLogModal from './CallLogModal';
import LeadImportModal from './LeadImportModal';
import type { Lead, EmailTemplate, CallLog, EmailLog } from '../../types';

const SalesPage: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    totalLeads: 0,
    newLeads: 0,
    qualifiedLeads: 0,
    conversionRate: 0
  });

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    applyFilters();
    calculateStats();
  }, [leads, searchTerm, statusFilter, sourceFilter]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...leads];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(lead =>
        lead.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.contact_person.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.country.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(lead => lead.status === statusFilter);
    }

    // Source filter
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(lead => lead.source === sourceFilter);
    }

    setFilteredLeads(filtered);
  };

  const calculateStats = () => {
    const totalLeads = leads.length;
    const newLeads = leads.filter(lead => lead.status === 'new').length;
    const qualifiedLeads = leads.filter(lead => 
      ['qualified', 'proposal_sent', 'negotiating', 'won'].includes(lead.status)
    ).length;
    const wonLeads = leads.filter(lead => lead.status === 'won').length;
    const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

    setStats({
      totalLeads,
      newLeads,
      qualifiedLeads,
      conversionRate
    });
  };

  const handleLeadSelect = (lead: Lead) => {
    setSelectedLead(lead);
    setIsLeadModalOpen(true);
  };

  const handleNewLead = () => {
    setSelectedLead(null);
    setIsLeadModalOpen(true);
  };

  const handleEmailLead = (lead: Lead) => {
    setSelectedLead(lead);
    setIsEmailModalOpen(true);
  };

  const handleCallLead = (lead: Lead) => {
    setSelectedLead(lead);
    setIsCallModalOpen(true);
  };

  const handleLeadUpdated = () => {
    fetchLeads();
    setIsLeadModalOpen(false);
  };

  const handleEmailSent = () => {
    setIsEmailModalOpen(false);
    // Optionally refresh leads or show success message
  };

  const handleCallLogged = () => {
    setIsCallModalOpen(false);
    fetchLeads(); // Refresh to update last contact date
  };

  const getStatusColor = (status: string) => {
    const colors = {
      new: 'bg-blue-100 text-blue-800',
      contacted: 'bg-yellow-100 text-yellow-800',
      interested: 'bg-green-100 text-green-800',
      qualified: 'bg-purple-100 text-purple-800',
      proposal_sent: 'bg-indigo-100 text-indigo-800',
      negotiating: 'bg-orange-100 text-orange-800',
      won: 'bg-green-100 text-green-800',
      lost: 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getSourceColor = (source: string) => {
    const colors = {
      leatherworkinggroup: 'bg-blue-100 text-blue-800',
      lineapelle: 'bg-purple-100 text-purple-800',
      aplf: 'bg-green-100 text-green-800',
      manual: 'bg-gray-100 text-gray-800',
      other: 'bg-yellow-100 text-yellow-800'
    };
    return colors[source as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center">
          <Users className="h-8 w-8 text-blue-600 mr-2" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales Management</h1>
            <p className="text-gray-600">Manage leads, email campaigns, and sales activities</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Upload className="h-4 w-4 mr-1" />
            Import Leads
          </button>
          <button
            onClick={() => setIsTemplatesModalOpen(true)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Mail className="h-4 w-4 mr-1" />
            Templates
          </button>
          <button
            onClick={handleNewLead}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-1" />
            New Lead
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Leads</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalLeads}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">New Leads</p>
              <p className="text-2xl font-bold text-gray-900">{stats.newLeads}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Qualified</p>
              <p className="text-2xl font-bold text-gray-900">{stats.qualifiedLeads}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Tag className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
              <p className="text-2xl font-bold text-gray-900">{stats.conversionRate.toFixed(1)}%</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="interested">Interested</option>
            <option value="qualified">Qualified</option>
            <option value="proposal_sent">Proposal Sent</option>
            <option value="negotiating">Negotiating</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Sources</option>
            <option value="leatherworkinggroup">Leather Working Group</option>
            <option value="lineapelle">Lineapelle</option>
            <option value="aplf">APLF</option>
            <option value="manual">Manual Entry</option>
            <option value="other">Other</option>
          </select>

          <button
            onClick={fetchLeads}
            className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </button>
        </div>
      </div>

      {/* Leads List */}
      <LeadsList
        leads={filteredLeads}
        loading={loading}
        onLeadSelect={handleLeadSelect}
        onEmailLead={handleEmailLead}
        onCallLead={handleCallLead}
        getStatusColor={getStatusColor}
        getSourceColor={getSourceColor}
      />

      {/* Modals */}
      <LeadDetailsModal
        isOpen={isLeadModalOpen}
        onClose={() => setIsLeadModalOpen(false)}
        lead={selectedLead}
        onLeadUpdated={handleLeadUpdated}
      />

      <EmailTemplatesModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
      />

      <EmailComposeModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        lead={selectedLead}
        onEmailSent={handleEmailSent}
      />

      <CallLogModal
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        lead={selectedLead}
        onCallLogged={handleCallLogged}
      />

      <LeadImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onLeadsImported={fetchLeads}
      />
    </div>
  );
};

export default SalesPage;