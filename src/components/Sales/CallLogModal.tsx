import React, { useState } from 'react';
import { X, Save, Phone } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Lead, CallLog } from '../../types';
import DatePicker from '../UI/DatePicker';

interface CallLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  onCallLogged: () => void;
}

const CallLogModal: React.FC<CallLogModalProps> = ({
  isOpen,
  onClose,
  lead,
  onCallLogged
}) => {
  const [loading, setLoading] = useState(false);
  const [callData, setCallData] = useState({
    call_date: new Date().toISOString().split('T')[0],
    duration_minutes: '',
    call_type: 'outbound' as CallLog['call_type'],
    outcome: 'connected' as CallLog['outcome'],
    notes: '',
    follow_up_required: false,
    follow_up_date: ''
  });

  const handleSave = async () => {
    if (!callData.notes.trim()) {
      alert('Please enter call notes');
      return;
    }

    try {
      setLoading(true);

      const callLog = {
        lead_id: lead?.id,
        call_date: callData.call_date,
        duration_minutes: callData.duration_minutes ? parseInt(callData.duration_minutes) : null,
        call_type: callData.call_type,
        outcome: callData.outcome,
        notes: callData.notes,
        follow_up_required: callData.follow_up_required,
        follow_up_date: callData.follow_up_date || null
      };

      const { error } = await supabase
        .from('call_logs')
        .insert([callLog]);

      if (error) throw error;

      // Update lead's last contact date and status if needed
      if (lead?.id) {
        const updateData: any = {
          last_contact_date: new Date(callData.call_date).toISOString().split('T')[0]
        };

        // Update status based on call outcome
        if (lead.status === 'new' && callData.outcome === 'connected') {
          updateData.status = 'contacted';
        }

        // Set next follow-up date if required
        if (callData.follow_up_required && callData.follow_up_date) {
          updateData.next_follow_up = callData.follow_up_date;
        }

        await supabase
          .from('leads')
          .update(updateData)
          .eq('id', lead.id);
      }

      onCallLogged();
    } catch (error) {
      console.error('Error logging call:', error);
      alert('Failed to log call');
    } finally {
      setLoading(false);
    }
  };

  const getOutcomeColor = (outcome: string) => {
    const colorsthink
The previous response was cut off in the middle of `src/components/Sales/CallLogModal.tsx`. I need to complete that file and then finish the remaining tasks if any were left.

Looking at the previous turn:
- `src/components/UI/DatePicker.tsx` was created.
- `src/components/Journal/JournalEntryPopup.tsx` was updated.
- `src/components/Home/JournalWidget.tsx` was updated.
- `src/components/Contracts/ContractForm.tsx` was updated.
- `src/components/DebitNote/DebitNoteForm.tsx` was updated.
- `src/components/SampleBook/SampleForm.tsx` was updated.
- `src/components/Journal/JournalEntryForm.tsx` was updated.
- `src/components/Sales/CallLogModal.tsx` was in progress.

I need to:
1. Complete `src/components/Sales/CallLogModal.tsx`.
2. Check if `src/components/Sales/LeadDetailsModal.tsx` needs date picker updates (it has `next_follow_up`).
3. Check if `src/components/Home/TodoList.tsx` needs updates (it doesn't seem to have date pickers in the form, just timestamps).
4. Provide the final summary.

Let's finish `CallLogModal.tsx`.

```tsx
    const colors = {
      connected: 'bg-green-100 text-green-800',
      voicemail: 'bg-yellow-100 text-yellow-800',
      no_answer: 'bg-red-100 text-red-800',
      busy: 'bg-orange-100 text-orange-800',
      disconnected: 'bg-gray-100 text-gray-800'
    };
    return colors[outcome as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Log Phone Call</h3>
            <p className="text-sm text-gray-500">
              {lead.company_name} - {lead.contact_person}
              {lead.phone && ` (${lead.phone})`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Call Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DatePicker
                label="Call Date *"
                value={callData.call_date}
                onChange={(val) => setCallData({ ...callData, call_date: val })}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  value={callData.duration_minutes}
                  onChange={(e) => setCallData({ ...callData, duration_minutes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g., 15"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Call Type
                </label>
                <select
                  value={callData.call_type}
                  onChange={(e) => setCallData({ ...callData, call_type: e.target.value as CallLog['call_type'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="outbound">Outbound Call</option>
                  <option value="inbound">Inbound Call</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Call Outcome
                </label>
                <select
                  value={callData.outcome}
                  onChange={(e) => setCallData({ ...callData, outcome: e.target.value as CallLog['outcome'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="connected">Connected</option>
                  <option value="voicemail">Voicemail</option>
                  <option value="no_answer">No Answer</option>
                  <option value="busy">Busy</option>
                  <option value="disconnected">Disconnected</option>
                </select>
              </div>
            </div>

            {/* Call Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Call Notes *
              </label>
              <textarea
                value={callData.notes}
                onChange={(e) => setCallData({ ...callData, notes: e.target.value })}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Enter details about the call, what was discussed, next steps, etc."
              />
            </div>

            {/* Follow-up */}
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="follow_up_required"
                  checked={callData.follow_up_required}
                  onChange={(e) => setCallData({ ...callData, follow_up_required: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="follow_up_required" className="ml-2 text-sm text-gray-700">
                  Follow-up required
                </label>
              </div>

              {callData.follow_up_required && (
                <DatePicker
                  label="Follow-up Date"
                  value={callData.follow_up_date}
                  onChange={(val) => setCallData({ ...callData, follow_up_date: val })}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !callData.notes.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4 inline mr-1" />
            {loading ? 'Saving...' : 'Log Call'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallLogModal;
```

Wait, I also need to update `LeadDetailsModal.tsx` for the `next_follow_up` field.

And `LeadImportModal.tsx` doesn't have date pickers.

Let's check `LeadDetailsModal.tsx`.

```tsx
              {/* Next Follow-up */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Next Follow-up Date
                </label>
                <input
                  type="date"
                  value={formData.next_follow_up}
                  onChange={(e) => setFormData({ ...formData, next_follow_up: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
```

Yes, this needs to be replaced.

Let's proceed.<dyad-write path="src/components/Sales/CallLogModal.tsx" description="Completing the CallLogModal with the new custom DatePicker.">
import React, { useState } from 'react';
import { X, Save, Phone } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Lead, CallLog } from '../../types';
import DatePicker from '../UI/DatePicker';

interface CallLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  onCallLogged: () => void;
}

const CallLogModal: React.FC<CallLogModalProps> = ({
  isOpen,
  onClose,
  lead,
  onCallLogged
}) => {
  const [loading, setLoading] = useState(false);
  const [callData, setCallData] = useState({
    call_date: new Date().toISOString().split('T')[0],
    duration_minutes: '',
    call_type: 'outbound' as CallLog['call_type'],
    outcome: 'connected' as CallLog['outcome'],
    notes: '',
    follow_up_required: false,
    follow_up_date: ''
  });

  const handleSave = async () => {
    if (!callData.notes.trim()) {
      alert('Please enter call notes');
      return;
    }

    try {
      setLoading(true);

      const callLog = {
        lead_id: lead?.id,
        call_date: callData.call_date,
        duration_minutes: callData.duration_minutes ? parseInt(callData.duration_minutes) : null,
        call_type: callData.call_type,
        outcome: callData.outcome,
        notes: callData.notes,
        follow_up_required: callData.follow_up_required,
        follow_up_date: callData.follow_up_date || null
      };

      const { error } = await supabase
        .from('call_logs')
        .insert([callLog]);

      if (error) throw error;

      // Update lead's last contact date and status if needed
      if (lead?.id) {
        const updateData: any = {
          last_contact_date: new Date(callData.call_date).toISOString().split('T')[0]
        };

        // Update status based on call outcome
        if (lead.status === 'new' && callData.outcome === 'connected') {
          updateData.status = 'contacted';
        }

        // Set next follow-up date if required
        if (callData.follow_up_required && callData.follow_up_date) {
          updateData.next_follow_up = callData.follow_up_date;
        }

        await supabase
          .from('leads')
          .update(updateData)
          .eq('id', lead.id);
      }

      onCallLogged();
    } catch (error) {
      console.error('Error logging call:', error);
      alert('Failed to log call');
    } finally {
      setLoading(false);
    }
  };

  const getOutcomeColor = (outcome: string) => {
    const colors = {
      connected: 'bg-green-100 text-green-800',
      voicemail: 'bg-yellow-100 text-yellow-800',
      no_answer: 'bg-red-100 text-red-800',
      busy: 'bg-orange-100 text-orange-800',
      disconnected: 'bg-gray-100 text-gray-800'
    };
    return colors[outcome as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Log Phone Call</h3>
            <p className="text-sm text-gray-500">
              {lead.company_name} - {lead.contact_person}
              {lead.phone && ` (${lead.phone})`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Call Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DatePicker
                label="Call Date *"
                value={callData.call_date}
                onChange={(val) => setCallData({ ...callData, call_date: val })}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  value={callData.duration_minutes}
                  onChange={(e) => setCallData({ ...callData, duration_minutes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g., 15"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Call Type
                </label>
                <select
                  value={callData.call_type}
                  onChange={(e) => setCallData({ ...callData, call_type: e.target.value as CallLog['call_type'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="outbound">Outbound Call</option>
                  <option value="inbound">Inbound Call</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Call Outcome
                </label>
                <select
                  value={callData.outcome}
                  onChange={(e) => setCallData({ ...callData, outcome: e.target.value as CallLog['outcome'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="connected">Connected</option>
                  <option value="voicemail">Voicemail</option>
                  <option value="no_answer">No Answer</option>
                  <option value="busy">Busy</option>
                  <option value="disconnected">Disconnected</option>
                </select>
              </div>
            </div>

            {/* Call Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Call Notes *
              </label>
              <textarea
                value={callData.notes}
                onChange={(e) => setCallData({ ...callData, notes: e.target.value })}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Enter details about the call, what was discussed, next steps, etc."
              />
            </div>

            {/* Follow-up */}
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="follow_up_required"
                  checked={callData.follow_up_required}
                  onChange={(e) => setCallData({ ...callData, follow_up_required: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="follow_up_required" className="ml-2 text-sm text-gray-700">
                  Follow-up required
                </label>
              </div>

              {callData.follow_up_required && (
                <DatePicker
                  label="Follow-up Date"
                  value={callData.follow_up_date}
                  onChange={(val) => setCallData({ ...callData, follow_up_date: val })}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !callData.notes.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4 inline mr-1" />
            {loading ? 'Saving...' : 'Log Call'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallLogModal;