import React, { useState, useEffect } from 'react';
import { X, Send, LayoutTemplate as Template, Save } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Lead, EmailTemplate } from '../../types';

interface EmailComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  onEmailSent: () => void;
}

const EmailComposeModal: React.FC<EmailComposeModalProps> = ({
  isOpen,
  onClose,
  lead,
  onEmailSent
}) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  const [emailData, setEmailData] = useState({
    to: '',
    subject: '',
    body: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      if (lead) {
        setEmailData({
          to: lead.email,
          subject: '',
          body: ''
        });
      }
    }
  }, [isOpen, lead]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template && lead) {
      // Replace variables in template
      let subject = template.subject;
      let body = template.body;

      const replacements = {
        '{{company_name}}': lead.company_name || '',
        '{{contact_person}}': lead.contact_person || '',
        '{{email}}': lead.email || '',
        '{{country}}': lead.country || '',
        '{{industry_focus}}': lead.industry_focus || '',
        '{{phone}}': lead.phone || '',
        '{{website}}': lead.website || ''
      };

      Object.entries(replacements).forEach(([placeholder, value]) => {
        subject = subject.replace(new RegExp(placeholder, 'g'), value);
        body = body.replace(new RegExp(placeholder, 'g'), value);
      });

      setEmailData({
        ...emailData,
        subject,
        body
      });
    }
    setSelectedTemplate(templateId);
  };

  const handleSendEmail = async () => {
    if (!emailData.to || !emailData.subject || !emailData.body) {
      alert('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);

      // In a real application, you would integrate with an email service like SendGrid, Mailgun, etc.
      // For now, we'll just log the email to the database
      const emailLog = {
        lead_id: lead?.id,
        template_id: selectedTemplate || null,
        to_email: emailData.to,
        subject: emailData.subject,
        body: emailData.body,
        sent_at: new Date().toISOString(),
        status: 'sent' as const
      };

      const { error } = await supabase
        .from('email_logs')
        .insert([emailLog]);

      if (error) throw error;

      // Update lead's last contact date
      if (lead?.id) {
        await supabase
          .from('leads')
          .update({ 
            last_contact_date: new Date().toISOString().split('T')[0],
            status: lead.status === 'new' ? 'contacted' : lead.status
          })
          .eq('id', lead.id);
      }

      alert('Email logged successfully! In a production environment, this would be sent via your email service.');
      onEmailSent();
    } catch (error) {
      console.error('Error logging email:', error);
      alert('Failed to log email');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    // In a real application, you might want to save drafts
    alert('Draft saved locally');
  };

  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Compose Email</h3>
            <p className="text-sm text-gray-500">To: {lead.company_name} ({lead.contact_person})</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Template Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Use Template (Optional)
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedTemplate}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select a template...</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.category.replace('_', ' ')})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleTemplateSelect(selectedTemplate)}
                  disabled={!selectedTemplate}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  <Template className="h-4 w-4 inline mr-1" />
                  Apply
                </button>
              </div>
            </div>

            {/* Email Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To
                </label>
                <input
                  type="email"
                  value={emailData.to}
                  onChange={(e) => setEmailData({ ...emailData, to: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject *
                </label>
                <input
                  type="text"
                  value={emailData.subject}
                  onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter email subject"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message *
                </label>
                <textarea
                  value={emailData.body}
                  onChange={(e) => setEmailData({ ...emailData, body: e.target.value })}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter your message here..."
                />
              </div>
            </div>

            {/* Email Preview */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Preview:</h4>
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">To:</span> {emailData.to}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Subject:</span> {emailData.subject}
                </div>
                <div className="text-sm border-t border-gray-200 pt-2">
                  <div className="whitespace-pre-wrap">{emailData.body}</div>
                </div>
              </div>
            </div>

            {/* Lead Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">Lead Information:</h4>
              <div className="grid grid-cols-2 gap-4 text-sm text-blue-700">
                <div>
                  <span className="font-medium">Company:</span> {lead.company_name}
                </div>
                <div>
                  <span className="font-medium">Contact:</span> {lead.contact_person}
                </div>
                <div>
                  <span className="font-medium">Country:</span> {lead.country}
                </div>
                <div>
                  <span className="font-medium">Status:</span> {lead.status.replace('_', ' ')}
                </div>
                {lead.industry_focus && (
                  <div>
                    <span className="font-medium">Industry:</span> {lead.industry_focus}
                  </div>
                )}
                {lead.phone && (
                  <div>
                    <span className="font-medium">Phone:</span> {lead.phone}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={handleSaveDraft}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <Save className="h-4 w-4 inline mr-1" />
            Save Draft
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSendEmail}
            disabled={loading || !emailData.subject || !emailData.body}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4 inline mr-1" />
            {loading ? 'Sending...' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailComposeModal;