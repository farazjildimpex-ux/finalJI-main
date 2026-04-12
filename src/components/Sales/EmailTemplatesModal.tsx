import React, { useState, useEffect } from 'react';
import { X, Plus, CreditCard as Edit2, Trash2, Save, Copy } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { EmailTemplate } from '../../types';

interface EmailTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EmailTemplatesModal: React.FC<EmailTemplatesModalProps> = ({ isOpen, onClose }) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: '',
    category: 'introduction' as EmailTemplate['category'],
    is_active: true
  });

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('category', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
      category: template.category,
      is_active: template.is_active
    });
    setEditMode(false);
  };

  const handleNewTemplate = () => {
    setSelectedTemplate(null);
    setFormData({
      name: '',
      subject: '',
      body: '',
      category: 'introduction',
      is_active: true
    });
    setEditMode(true);
  };

  const handleEdit = () => {
    setEditMode(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.subject || !formData.body) {
      alert('Name, subject, and body are required');
      return;
    }

    try {
      setLoading(true);

      if (selectedTemplate?.id) {
        // Update existing template
        const { error } = await supabase
          .from('email_templates')
          .update(formData)
          .eq('id', selectedTemplate.id);

        if (error) throw error;
      } else {
        // Create new template
        const { error } = await supabase
          .from('email_templates')
          .insert([formData]);

        if (error) throw error;
      }

      await fetchTemplates();
      setEditMode(false);
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate?.id || !confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', selectedTemplate.id);

      if (error) throw error;

      setSelectedTemplate(null);
      setFormData({
        name: '',
        subject: '',
        body: '',
        category: 'introduction',
        is_active: true
      });
      setEditMode(false);
      await fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = () => {
    if (!selectedTemplate) return;
    
    setSelectedTemplate(null);
    setFormData({
      name: `${selectedTemplate.name} (Copy)`,
      subject: selectedTemplate.subject,
      body: selectedTemplate.body,
      category: selectedTemplate.category,
      is_active: true
    });
    setEditMode(true);
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      introduction: 'bg-blue-100 text-blue-800',
      follow_up: 'bg-yellow-100 text-yellow-800',
      proposal: 'bg-purple-100 text-purple-800',
      thank_you: 'bg-green-100 text-green-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="flex h-full">
          {/* Left Panel - Templates List */}
          <div className="w-1/3 border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Email Templates</h3>
                <button
                  onClick={handleNewTemplate}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className={`p-4 cursor-pointer hover:bg-gray-50 ${
                        selectedTemplate?.id === template.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{template.name}</p>
                          <p className="text-sm text-gray-500 truncate">{template.subject}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(template.category)}`}>
                              {template.category.replace('_', ' ')}
                            </span>
                            {!template.is_active && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                Inactive
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Template Details */}
          <div className="w-2/3 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editMode ? (selectedTemplate ? 'Edit Template' : 'New Template') : 'Template Details'}
                </h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {selectedTemplate || editMode ? (
                <div className="space-y-6">
                  {editMode ? (
                    // Edit Form
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Template Name *
                          </label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Enter template name"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Category
                          </label>
                          <select
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value as EmailTemplate['category'] })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="introduction">Introduction</option>
                            <option value="follow_up">Follow Up</option>
                            <option value="proposal">Proposal</option>
                            <option value="thank_you">Thank You</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Subject Line *
                        </label>
                        <input
                          type="text"
                          value={formData.subject}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Enter email subject"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email Body *
                        </label>
                        <textarea
                          value={formData.body}
                          onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                          rows={12}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Enter email content. Use {{company_name}}, {{contact_person}}, etc. for personalization"
                        />
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="is_active"
                          checked={formData.is_active}
                          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                          Active template
                        </label>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-blue-800 mb-2">Available Variables:</h4>
                        <div className="text-sm text-blue-700 space-y-1">
                          <p><code>{'{{company_name}}'}</code> - Lead's company name</p>
                          <p><code>{'{{contact_person}}'}</code> - Contact person's name</p>
                          <p><code>{'{{email}}'}</code> - Lead's email address</p>
                          <p><code>{'{{country}}'}</code> - Lead's country</p>
                          <p><code>{'{{industry_focus}}'}</code> - Lead's industry focus</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Template Name</h3>
                        <p className="mt-1 text-lg font-semibold text-gray-900">{selectedTemplate?.name}</p>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Category</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${getCategoryColor(selectedTemplate?.category || '')}`}>
                          {selectedTemplate?.category.replace('_', ' ')}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Subject Line</h3>
                        <p className="mt-1 text-gray-900">{selectedTemplate?.subject}</p>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Email Body</h3>
                        <div className="mt-1 p-4 bg-gray-50 rounded-lg">
                          <pre className="whitespace-pre-wrap text-sm text-gray-900 font-sans">
                            {selectedTemplate?.body}
                          </pre>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Status</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${
                          selectedTemplate?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {selectedTemplate?.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                    {editMode ? (
                      <>
                        <button
                          onClick={() => setEditMode(false)}
                          disabled={loading}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={loading}
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Save className="h-4 w-4 inline mr-1" />
                          {loading ? 'Saving...' : 'Save Template'}
                        </button>
                      </>
                    ) : (
                      <>
                        {selectedTemplate && (
                          <>
                            <button
                              onClick={handleDelete}
                              disabled={loading}
                              className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4 inline mr-1" />
                              Delete
                            </button>
                            <button
                              onClick={handleDuplicate}
                              disabled={loading}
                              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                            >
                              <Copy className="h-4 w-4 inline mr-1" />
                              Duplicate
                            </button>
                          </>
                        )}
                        <button
                          onClick={handleEdit}
                          disabled={loading}
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Edit2 className="h-4 w-4 inline mr-1" />
                          Edit Template
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Plus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg mb-2">No template selected</p>
                    <p className="text-sm">Select a template from the list or create a new one</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailTemplatesModal;