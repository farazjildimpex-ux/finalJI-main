import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Plus, Minus, Phone, Mail } from 'lucide-react';
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

const inputCls = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white transition-colors';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5';
const tabCls   = (active: boolean) =>
  `px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors ${
    active ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
  }`;

const EMPTY_FORM: Partial<Lead> = {
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
  tags: [],
};

const LeadDetailsModal: React.FC<LeadDetailsModalProps> = ({
  isOpen, onClose, lead, onLeadUpdated
}) => {
  const [loading, setLoading]     = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [callLogs, setCallLogs]   = useState<CallLog[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [formData, setFormData]   = useState<Partial<Lead>>(EMPTY_FORM);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('details');
    if (lead) {
      setFormData({ ...lead });
      fetchActivityLogs();
    } else {
      setFormData({ ...EMPTY_FORM, address: [''] });
      setCallLogs([]);
      setEmailLogs([]);
    }
  }, [isOpen, lead]);

  const fetchActivityLogs = async () => {
    if (!lead?.id) return;
    const [callRes, emailRes] = await Promise.all([
      supabase.from('call_logs').select('*').eq('lead_id', lead.id).order('call_date', { ascending: false }),
      supabase.from('lead_email_logs').select('*').eq('lead_id', lead.id).order('sent_at', { ascending: false }),
    ]);
    setCallLogs(callRes.data || []);
    setEmailLogs(emailRes.data || []);
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

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const leadData = {
        ...formData,
        user_id: user.id,
        address: formData.address?.filter(a => a.trim() !== '') || [],
        tags: formData.tags || [],
        next_follow_up: formData.next_follow_up || null,
        updated_at: new Date().toISOString(),
      };

      if (lead?.id) {
        const { error } = await supabase.from('leads').update(leadData).eq('id', lead.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('leads').insert([leadData]);
        if (error) throw error;
      }

      dialogService.success(lead?.id ? 'Lead updated.' : 'Lead added.');
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
      message: 'This action cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      setLoading(true);
      const { error } = await supabase.from('leads').delete().eq('id', lead.id);
      if (error) throw error;
      dialogService.success('Lead deleted.');
      onLeadUpdated();
    } catch (error: any) {
      dialogService.alert({ title: 'Delete failed', message: error?.message || 'Please try again.', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const handleArrayChange = (field: 'address' | 'tags', index: number, value: string) => {
    const arr = [...(formData[field] || [])];
    arr[index] = value;
    setFormData({ ...formData, [field]: arr });
  };

  const addArrayField  = (field: 'address' | 'tags') =>
    setFormData({ ...formData, [field]: [...(formData[field] || []), ''] });

  const removeArrayField = (field: 'address' | 'tags', index: number) =>
    setFormData({ ...formData, [field]: (formData[field] || []).filter((_, i) => i !== index) });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {lead ? 'Edit Lead' : 'New Lead'}
            </h2>
            {lead && (
              <p className="text-xs text-gray-500 mt-0.5">{lead.company_name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        {lead && (
          <div className="flex items-center gap-1 px-5 py-2 border-b border-gray-100 flex-shrink-0">
            <button onClick={() => setActiveTab('details')} className={tabCls(activeTab === 'details')}>Details</button>
            <button onClick={() => setActiveTab('calls')}   className={tabCls(activeTab === 'calls')}>
              Calls {callLogs.length > 0 && <span className="ml-1 text-xs bg-gray-200 text-gray-600 rounded-full px-1.5">{callLogs.length}</span>}
            </button>
            <button onClick={() => setActiveTab('emails')}  className={tabCls(activeTab === 'emails')}>
              Emails {emailLogs.length > 0 && <span className="ml-1 text-xs bg-gray-200 text-gray-600 rounded-full px-1.5">{emailLogs.length}</span>}
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Details tab ── */}
          {activeTab === 'details' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Company Name *</label>
                  <input type="text" value={formData.company_name || ''} onChange={e => setFormData({ ...formData, company_name: e.target.value })} className={inputCls} placeholder="Acme Leather Co." />
                </div>
                <div>
                  <label className={labelCls}>Contact Person *</label>
                  <input type="text" value={formData.contact_person || ''} onChange={e => setFormData({ ...formData, contact_person: e.target.value })} className={inputCls} placeholder="John Smith" />
                </div>
                <div>
                  <label className={labelCls}>Email *</label>
                  <input type="email" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} className={inputCls} placeholder="john@example.com" />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input type="tel" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} className={inputCls} placeholder="+1 234 567 8900" />
                </div>
                <div>
                  <label className={labelCls}>Website</label>
                  <input type="url" value={formData.website || ''} onChange={e => setFormData({ ...formData, website: e.target.value })} className={inputCls} placeholder="https://example.com" />
                </div>
                <div>
                  <label className={labelCls}>Country</label>
                  <input type="text" value={formData.country || ''} onChange={e => setFormData({ ...formData, country: e.target.value })} className={inputCls} placeholder="Italy" />
                </div>
                <div>
                  <label className={labelCls}>Source</label>
                  <select value={formData.source || 'manual'} onChange={e => setFormData({ ...formData, source: e.target.value as Lead['source'] })} className={inputCls}>
                    <option value="manual">Manual Entry</option>
                    <option value="leatherworkinggroup">Leather Working Group</option>
                    <option value="lineapelle">Lineapelle</option>
                    <option value="aplf">APLF</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select value={formData.status || 'new'} onChange={e => setFormData({ ...formData, status: e.target.value as Lead['status'] })} className={inputCls}>
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
                <div>
                  <label className={labelCls}>Industry Focus</label>
                  <input type="text" value={formData.industry_focus || ''} onChange={e => setFormData({ ...formData, industry_focus: e.target.value })} className={inputCls} placeholder="Footwear, Automotive, Fashion…" />
                </div>
                <div>
                  <label className={labelCls}>Company Size</label>
                  <select value={formData.company_size || ''} onChange={e => setFormData({ ...formData, company_size: e.target.value })} className={inputCls}>
                    <option value="">Select size</option>
                    <option value="1-10">1–10 employees</option>
                    <option value="11-50">11–50 employees</option>
                    <option value="51-200">51–200 employees</option>
                    <option value="201-1000">201–1000 employees</option>
                    <option value="1000+">1000+ employees</option>
                  </select>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className={labelCls}>Address</label>
                <div className="space-y-2">
                  {(formData.address?.length ? formData.address : ['']).map((addr, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={addr}
                        onChange={e => handleArrayChange('address', i, e.target.value)}
                        className={inputCls}
                        placeholder={`Line ${i + 1}`}
                      />
                      {i > 0 && (
                        <button onClick={() => removeArrayField('address', i)} className="w-9 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                          <Minus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => addArrayField('address')} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Add line
                  </button>
                </div>
              </div>

              {/* Follow-up */}
              <DatePicker
                label="Next Follow-up Date"
                value={formData.next_follow_up || ''}
                onChange={val => setFormData({ ...formData, next_follow_up: val })}
              />

              {/* Notes */}
              <div>
                <label className={labelCls}>Notes</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  className={`${inputCls} resize-none`}
                  placeholder="Additional context, meeting notes, opportunities…"
                />
              </div>
            </div>
          )}

          {/* ── Calls tab ── */}
          {activeTab === 'calls' && (
            <div className="space-y-3">
              {callLogs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Phone className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">No call history yet</p>
                  <p className="text-xs text-gray-400 mt-1">Use the phone button on the lead card to log a call</p>
                </div>
              ) : callLogs.map(call => (
                <div key={call.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-sm font-semibold text-slate-800">
                      {call.call_type === 'outbound' ? 'Outbound' : 'Inbound'} Call
                    </span>
                    <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${
                      call.outcome === 'connected' ? 'bg-emerald-100 text-emerald-700' :
                      call.outcome === 'voicemail' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {call.outcome.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{call.notes}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(call.call_date).toLocaleDateString()}
                    {call.duration_minutes ? ` · ${call.duration_minutes} min` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* ── Emails tab ── */}
          {activeTab === 'emails' && (
            <div className="space-y-3">
              {emailLogs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Mail className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">No email history yet</p>
                  <p className="text-xs text-gray-400 mt-1">Use the mail button on the lead card to compose an email</p>
                </div>
              ) : emailLogs.map(email => (
                <div key={email.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Mail className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-sm font-semibold text-slate-800 truncate flex-1">{email.subject}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{email.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2 mt-1">{email.body}</p>
                  <p className="text-xs text-gray-400 mt-2">{new Date(email.sent_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-3xl flex-shrink-0">
          <div>
            {lead && (
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            {activeTab === 'details' && (
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Save className="h-4 w-4" />
                {loading ? 'Saving…' : lead ? 'Save Changes' : 'Add Lead'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadDetailsModal;
