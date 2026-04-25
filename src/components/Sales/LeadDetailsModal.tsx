import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Plus, Minus, Calendar, Mail, Phone, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Lead, CallLog, EmailLog } from '../../types';
import DatePicker from '../UI/DatePicker';
import { dialogService } from '../../lib/dialogService';

interface LeadDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  onLeadUpdated: () => void;
}

const LeadDetailsModal: React.FC<LeadDetailsModalProps> = ({
  isOpen,
  onClose,
  lead,
  onLeadUpdated
}) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  
  const [formData, setFormData] = useState<Partial<Lead>>({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    website: '',
    address: [''],
    country: '',
    source: 'manual',
    status: 'new',
    industry_focus: '',
    company_size: '',
    notes: '',
    next_follow_up: '',
    tags: []
  });

  useEffect(() => {
    if (isOpen && lead) {
      setFormData(lead);
      fetchActivityLogs();
    } else if (isOpen && !lead) {
      // Reset form for new lead
      setFormData({
        company_name: '',
        contact_person: '',
        email: '',
        phone: '',
        website: '',
        address: [''],
        country: '',
        source: 'manual',
        status: 'new',
        industry_focus: '',
        company_size: '',
        notes: '',
        next_follow_up: '',
        tags: []
      });
    }
  }, [isOpen, lead]);

  const fetchActivityLogs = async () => {
    if (!lead?.id) return;

    try {
      // Fetch call logs
      const { data: calls, error: callsError } = await supabase
        .from('call_logs')
        .select('*')
        .eq('lead_id', lead.id)
        .order('call_date', { ascending: false });

      if (callsError) throw callsError;
      setCallLogs(calls || []);

      // Fetch email logs
      const { data: emails, error: emailsError } = await supabase
        .from('email_logs')
        .select('*')
        .eq('lead_id', lead.id)
        .order('sent_at', { ascending: false });

      if (emailsError) throw emailsError;
      setEmailLogs(emails || []);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    }
  };

  const handleSave = async () => {
    if (!formData.company_name || !formData.contact_person || !formData.email) {
      dialogService.alert({
        title: 'Missing required fields',
        message: 'Company name, contact person, and email are required.',
        tone: 'warning',
      });
      return;
    }

    try {
      setLoading(true);

      const leadData = {
        ...formData,
        address: formData.address?.filter(addr => addr.trim() !== '') || [],
        tags: formData.tags || [],
        last_contact_date: new Date().toISOString().split('T')[0]
      };

      if (lead?.id) {
        // Update existing lead
        const { error } = await supabase
          .from('leads')
          .update(leadData)
          .eq('id', lead.id);

        if (error) throw error;
      } else {
        // Create new lead
        const { error } = await supabase
          .from('leads')
          .insert([leadData]);

        if (error) throw error;
      }

      onLeadUpdated();
    } catch (error: any) {
      console.error('Error saving lead:', error);
      dialogService.alert({
        title: 'Failed to save lead',
        message: error?.message || 'Please try again.',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!lead?.id) return;
    const ok = await dialogService.confirm({
      title: 'Delete lead?',
      message: 'Are you sure you want to delete this lead? This action cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', lead.id);

      if (error) throw error;
      dialogService.success('Lead deleted.');
      onLeadUpdated();
    } catch (error: any) {
      console.error('Error deleting lead:', error);
      dialogService.alert({
        title: 'Failed to delete lead',
        message: error?.message || 'Please try again.',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleArrayFieldChange = (field: 'address' | 'tags', index: number, value: string) => {
    const newArray = [...(formData[field] || [])];
    newArray[index] = value;
    setFormData({ ...formData, [field]: newArray });
  };

  const addArrayField = (field: 'address' | 'tags') => {
    setFormData({
      ...formData,
      [field]: [...(formData[field] || []), '']
    });
  };

  const removeArrayField = (field: 'address' | 'tags', index: number) => {
    const newArray = (formData[field] || []).filter((_, i) => i !== index);
    setFormData({ ...formData, [field]: newArray });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            {lead ? 'Edit Lead' : 'New Lead'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Details
            </button>
            {lead && (
              <>
                <button
                  onClick={() => setActiveTab('calls')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'calls'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Call History ({callLogs.length})
                </button>
                <button
                  onClick={() => setActiveTab('emails')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'emails'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Email History ({emailLogs.length})
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Person *
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Website
                  </label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source
                  </label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value as Lead['source'] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="manual">Manual Entry</option>
                    <option value="leatherworkinggroup">Leather Working Group</option>
                    <option value="lineapelle">Lineapelle</option>
                    <option value="aplf">APLF</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as Lead['status'] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="interested">Interested</option>
                    <option value="qualified">Qualified</option>
                    <option value="proposal_sent">Proposal Sent</option>
                    <option value="negotiating">Negotiating</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                {(formData.address || ['']).map((addr, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={addr}
                      onChange={(e) => handleArrayFieldChange('address', index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder={`Address line ${index + 1}`}
                    />
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => removeArrayField('address', index)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Minus className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addArrayField('address')}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Address Line
                </button>
              </div>

              {/* Additional Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Industry Focus
                  </label>
                  <input
                    type="text"
                    value={formData.industry_focus}
                    onChange={(e) => setFormData({ ...formData, industry_focus: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g., Footwear, Automotive, Fashion"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Size
                  </label>
                  <select
                    value={formData.company_size}
                    onChange={(e) => setFormData({ ...formData, company_size: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select size</option>
                    <option value="1-10">1-10 employees</option>
                    <option value="11-50">11-50 employees</option>
                    <option value="51-200">51-200 employees</option>
                    <option value="201-1000">201-1000 employees</option>
                    <option value="1000+">1000+ employees</option>
                  </select>
                </div>
              </div>

              {/* Next Follow-up */}
              <DatePicker
                label="Next Follow-up Date"
                value={formData.next_follow_up || ''}
                onChange={(val) => setFormData({ ...formData, next_follow_up: val })}
              />

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {activeTab === 'calls' && (
            <div className="space-y-4">
              {callLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Phone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p>No call history yet</p>
                </div>
              ) : (
                callLogs.map((call) => (
                  <div key={call.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Phone className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">
                            {call.call_type === 'outbound' ? 'Outbound Call' : 'Inbound Call'}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            call.outcome === 'connected' ? 'bg-green-100 text-green-800' :
                            call.outcome === 'voicemail' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {call.outcome.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{call.notes}</p>
                        <div className="text-xs text-gray-500">
                          {new Date(call.call_date).toLocaleString()}
                          {call.duration_minutes && ` • ${call.duration_minutes} minutes`}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'emails' && (
            <div className="space-y-4">
              {emailLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p>No email history yet</p>
                </div>
              ) : (
                emailLogs.map((email) => (
                  <div key={email.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Mail className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">{email.subject}</span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            email.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                            email.status === 'delivered' ? 'bg-green-100 text-green-800' :
                            email.status === 'opened' ? 'bg-purple-100 text-purple-800' :
                            email.status === 'replied' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {email.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2 line-clamp-3">{email.body}</p>
                        <div className="text-xs text-gray-500">
                          Sent: {new Date(email.sent_at).toLocaleString()}
                        </div>
                        {email.reply_received && (
                          <div className="mt-2 p-2 bg-green-50 rounded">
                            <p className="text-xs text-green-800 font-medium">Reply received:</p>
                            <p className="text-sm text-green-700">{email.reply_content}</p>
                            <p className="text-xs text-green-600 mt-1">
                              {email.reply_date && new Date(email.reply_date).toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          {lead && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4 inline mr-1" />
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4 inline mr-1" />
            {loading ? 'Saving...' : 'Save Lead'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeadDetailsModal;