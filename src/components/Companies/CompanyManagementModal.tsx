import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Save, Trash2, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Company } from '../../types';

interface CompanyManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompanyUpdated: () => void;
}

const CompanyManagementModal: React.FC<CompanyManagementModalProps> = ({ 
  isOpen, 
  onClose, 
  onCompanyUpdated 
}) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: [''],
    phone: '',
    email: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchCompanies();
    }
  }, [isOpen]);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      alert('Failed to fetch companies');
    } finally {
      setLoading(false);
    }
  };

  const handleCompanySelect = (company: Company) => {
    setSelectedCompany(company);
    setFormData({
      name: company.name,
      address: company.address,
      phone: company.phone || '',
      email: company.email || ''
    });
    setEditMode(false);
  };

  const handleNewCompany = () => {
    setSelectedCompany(null);
    setFormData({
      name: '',
      address: [''],
      phone: '',
      email: ''
    });
    setEditMode(true);
  };

  const handleEdit = () => {
    setEditMode(true);
  };

  const handleCancel = () => {
    if (selectedCompany) {
      setFormData({
        name: selectedCompany.name,
        address: selectedCompany.address,
        phone: selectedCompany.phone || '',
        email: selectedCompany.email || ''
      });
    } else {
      setFormData({
        name: '',
        address: [''],
        phone: '',
        email: ''
      });
    }
    setEditMode(false);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Company name is required');
      return;
    }

    try {
      setLoading(true);

      const companyData = {
        name: formData.name.trim(),
        address: formData.address.filter(addr => addr.trim() !== ''),
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null
      };

      if (selectedCompany) {
        // Update existing company
        const { error } = await supabase
          .from('companies')
          .update(companyData)
          .eq('id', selectedCompany.id);

        if (error) throw error;
        alert('Company updated successfully!');
      } else {
        // Create new company
        const { error } = await supabase
          .from('companies')
          .insert([companyData]);

        if (error) throw error;
        alert('Company created successfully!');
      }

      await fetchCompanies();
      setEditMode(false);
      onCompanyUpdated();
    } catch (error) {
      console.error('Error saving company:', error);
      if (error instanceof Error && error.message.includes('duplicate key')) {
        alert('A company with this name already exists');
      } else {
        alert('Failed to save company');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCompany) return;

    if (!confirm(`Are you sure you want to delete "${selectedCompany.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', selectedCompany.id);

      if (error) throw error;

      alert('Company deleted successfully!');
      setSelectedCompany(null);
      setFormData({
        name: '',
        address: [''],
        phone: '',
        email: ''
      });
      setEditMode(false);
      await fetchCompanies();
      onCompanyUpdated();
      
      // Close modal and navigate to home
      setTimeout(() => {
        onClose();
        window.location.href = '/app/home';
      }, 1000);
    } catch (error) {
      console.error('Error deleting company:', error);
      alert('Failed to delete company');
    } finally {
      setLoading(false);
    }
  };

  const handleArrayFieldChange = (index: number, value: string) => {
    const newAddress = [...formData.address];
    newAddress[index] = value;
    setFormData({ ...formData, address: newAddress });
  };

  const addAddressField = () => {
    setFormData({ ...formData, address: [...formData.address, ''] });
  };

  const removeAddressField = (index: number) => {
    if (formData.address.length > 1) {
      const newAddress = formData.address.filter((_, i) => i !== index);
      setFormData({ ...formData, address: newAddress });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="flex h-full">
          {/* Left Panel - Company List */}
          <div className="w-1/3 border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Companies</h3>
                <button
                  onClick={handleNewCompany}
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
                <ul className="divide-y divide-gray-200">
                  {companies.map((company) => (
                    <li
                      key={company.id}
                      onClick={() => handleCompanySelect(company)}
                      className={`px-4 py-3 cursor-pointer hover:bg-gray-50 ${
                        selectedCompany?.id === company.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-center">
                        <Building2 className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <p className="font-medium text-gray-900">{company.name}</p>
                          {company.address[0] && (
                            <p className="text-sm text-gray-500">{company.address[0]}</p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right Panel - Company Details */}
          <div className="w-2/3 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editMode ? (selectedCompany ? 'Edit Company' : 'New Company') : 'Company Details'}
                </h2>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {selectedCompany || editMode ? (
                <div className="space-y-6">
                  {editMode ? (
                    // Edit Form
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Company Name *
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Enter company name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Address
                        </label>
                        {formData.address.map((addr, index) => (
                          <div key={index} className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={addr}
                              onChange={(e) => handleArrayFieldChange(index, e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder={`Address line ${index + 1}`}
                            />
                            {index > 0 && (
                              <button
                                type="button"
                                onClick={() => removeAddressField(index)}
                                className="text-gray-400 hover:text-red-600"
                              >
                                <Minus className="h-5 w-5" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addAddressField}
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Address Line
                        </button>
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
                          placeholder="Enter phone number"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Enter email address"
                        />
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Company Name</h3>
                        <p className="mt-1 text-lg font-semibold text-gray-900">{selectedCompany?.name}</p>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Address</h3>
                        <div className="mt-1 space-y-1">
                          {selectedCompany?.address.map((addr, index) => (
                            <p key={index} className="text-gray-900">{addr}</p>
                          ))}
                        </div>
                      </div>

                      {selectedCompany?.phone && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Phone</h3>
                          <p className="mt-1 text-gray-900">{selectedCompany.phone}</p>
                        </div>
                      )}

                      {selectedCompany?.email && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Email</h3>
                          <p className="mt-1 text-gray-900">{selectedCompany.email}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                    {editMode ? (
                      <>
                        <button
                          onClick={handleCancel}
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
                          {loading ? 'Saving...' : 'Save Company'}
                        </button>
                      </>
                    ) : (
                      <>
                        {selectedCompany && (
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
                          onClick={handleEdit}
                          disabled={loading}
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          Edit Company
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg mb-2">No company selected</p>
                    <p className="text-sm">Select a company from the list or create a new one</p>
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

export default CompanyManagementModal;