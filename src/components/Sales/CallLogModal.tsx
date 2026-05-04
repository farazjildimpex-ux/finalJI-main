import React, { useState } from 'react';
import { X, Save, Phone } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Lead, CallLog } from '../../types';
import DatePicker from '../UI/DatePicker';
import { dialogService } from '../../lib/dialogService';

interface CallLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  onCallLogged: () => void;
}

const inputCls = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white transition-colors';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5';

const CallLogModal: React.FC<CallLogModalProps> = ({
  isOpen, onClose, lead, onCallLogged
}) => {
  const [loading, setLoading] = useState(false);
  const [callData, setCallData] = useState({
    call_date: new Date().toISOString().split('T')[0],
    duration_minutes: '',
    call_type: 'outbound' as CallLog['call_type'],
    outcome: 'connected' as CallLog['outcome'],
    notes: '',
    follow_up_required: false,
    follow_up_date: '',
  });

  const handleSave = async () => {
    if (!callData.notes.trim()) {
      dialogService.alert({ title: 'Missing notes', message: 'Please enter call notes before saving.', tone: 'warning' });
      return;
    }

    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const callLog = {
        user_id: user.id,
        lead_id: lead?.id,
        call_date: callData.call_date,
        duration_minutes: callData.duration_minutes ? parseInt(callData.duration_minutes) : null,
        call_type: callData.call_type,
        outcome: callData.outcome,
        notes: callData.notes,
        follow_up_required: callData.follow_up_required,
        follow_up_date: callData.follow_up_date || null,
      };

      const { error } = await supabase.from('call_logs').insert([callLog]);
      if (error) throw error;

      if (lead?.id) {
        const updateData: any = { last_contact_date: callData.call_date };
        if (lead.status === 'new' && callData.outcome === 'connected') updateData.status = 'contacted';
        if (callData.follow_up_required && callData.follow_up_date) updateData.next_follow_up = callData.follow_up_date;
        await supabase.from('leads').update(updateData).eq('id', lead.id);
      }

      dialogService.success('Call logged.');
      setCallData({
        call_date: new Date().toISOString().split('T')[0],
        duration_minutes: '',
        call_type: 'outbound',
        outcome: 'connected',
        notes: '',
        follow_up_required: false,
        follow_up_date: '',
      });
      onCallLogged();
    } catch (error: any) {
      console.error('Error logging call:', error);
      dialogService.alert({ title: 'Failed to log call', message: error?.message || 'Please try again.', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[95vh] sm:max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Phone className="h-4 w-4 text-green-600" /> Log Call
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{lead.company_name} — {lead.contact_person}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DatePicker
              label="Call Date *"
              value={callData.call_date}
              onChange={val => setCallData({ ...callData, call_date: val })}
            />
            <div>
              <label className={labelCls}>Duration (min)</label>
              <input
                type="number"
                value={callData.duration_minutes}
                onChange={e => setCallData({ ...callData, duration_minutes: e.target.value })}
                className={inputCls}
                placeholder="e.g. 15"
                min="0"
              />
            </div>
            <div>
              <label className={labelCls}>Call Type</label>
              <select value={callData.call_type} onChange={e => setCallData({ ...callData, call_type: e.target.value as CallLog['call_type'] })} className={inputCls}>
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Outcome</label>
              <select value={callData.outcome} onChange={e => setCallData({ ...callData, outcome: e.target.value as CallLog['outcome'] })} className={inputCls}>
                <option value="connected">Connected</option>
                <option value="voicemail">Voicemail</option>
                <option value="no_answer">No Answer</option>
                <option value="busy">Busy</option>
                <option value="disconnected">Disconnected</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes *</label>
            <textarea
              value={callData.notes}
              onChange={e => setCallData({ ...callData, notes: e.target.value })}
              rows={4}
              className={`${inputCls} resize-none`}
              placeholder="What was discussed? Any next steps?"
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={callData.follow_up_required}
                onChange={e => setCallData({ ...callData, follow_up_required: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-slate-700 font-medium">Schedule a follow-up</span>
            </label>
            {callData.follow_up_required && (
              <DatePicker
                label="Follow-up Date"
                value={callData.follow_up_date}
                onChange={val => setCallData({ ...callData, follow_up_date: val })}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-3xl flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !callData.notes.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <Save className="h-4 w-4" />
            {loading ? 'Saving…' : 'Log Call'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallLogModal;
