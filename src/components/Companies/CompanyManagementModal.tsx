import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Minus, Save, Trash2, Building2, Upload, FileText, Download, Loader2, ChevronDown, ChevronRight, Info } from 'lucide-react';
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
  const [uploadingLetterhead, setUploadingLetterhead] = useState(false);
  const [letterheadFile, setLetterheadFile] = useState<File | null>(null);
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const letterheadInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: [''],
    phone: '',
    email: '',
    letterhead_url: '',
    letterhead_name: '',
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
      email: company.email || '',
      letterhead_url: company.letterhead_url || '',
      letterhead_name: company.letterhead_name || '',
    });
    setLetterheadFile(null);
    setEditMode(false);
  };

  const handleNewCompany = () => {
    setSelectedCompany(null);
    setFormData({ name: '', address: [''], phone: '', email: '', letterhead_url: '', letterhead_name: '' });
    setLetterheadFile(null);
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
        email: selectedCompany.email || '',
        letterhead_url: selectedCompany.letterhead_url || '',
        letterhead_name: selectedCompany.letterhead_name || '',
      });
    } else {
      setFormData({ name: '', address: [''], phone: '', email: '', letterhead_url: '', letterhead_name: '' });
    }
    setLetterheadFile(null);
    setEditMode(false);
  };

  const uploadLetterheadFile = async (file: File, companyId: string): Promise<{ url: string; name: string } | null> => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `letterheads/${companyId}/${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('contract-files')
      .upload(storagePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('contract-files')
      .getPublicUrl(storagePath);

    return { url: publicUrl, name: file.name };
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Company name is required');
      return;
    }

    setLoading(true);
    try {
      const baseData = {
        name: formData.name.trim(),
        address: formData.address.filter(addr => addr.trim() !== ''),
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
      };

      let companyId = selectedCompany?.id;

      if (selectedCompany) {
        const { error } = await supabase
          .from('companies')
          .update(baseData)
          .eq('id', selectedCompany.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('companies')
          .insert([baseData])
          .select()
          .single();
        if (error) throw error;
        companyId = data.id;
      }

      if (letterheadFile && companyId) {
        setUploadingLetterhead(true);
        const result = await uploadLetterheadFile(letterheadFile, companyId);
        if (result) {
          await supabase
            .from('companies')
            .update({ letterhead_url: result.url, letterhead_name: result.name })
            .eq('id', companyId);
        }
        setUploadingLetterhead(false);
      } else if (!formData.letterhead_url && selectedCompany?.letterhead_url) {
        await supabase
          .from('companies')
          .update({ letterhead_url: null, letterhead_name: null })
          .eq('id', selectedCompany.id);
      }

      await fetchCompanies();
      setEditMode(false);
      onCompanyUpdated();
      alert('Company saved successfully!');
    } catch (error) {
      console.error('Error saving company:', error);
      alert('Failed to save company');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCompany) return;
    if (!confirm(`Delete "${selectedCompany.name}"?`)) return;

    try {
      setLoading(true);
      const { error } = await supabase.from('companies').delete().eq('id', selectedCompany.id);
      if (error) throw error;
      setSelectedCompany(null);
      setEditMode(false);
      await fetchCompanies();
      onCompanyUpdated();
    } catch (error) {
      console.error('Error deleting company:', error);
      alert('Failed to delete company');
    } finally {
      setLoading(false);
    }
  };

  const handleLetterheadFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.docx')) {
      alert('Please select a .docx Word document file');
      return;
    }
    setLetterheadFile(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="flex h-full">
          {/* Left Panel */}
          <div className="w-1/3 border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Companies</h3>
              <button onClick={handleNewCompany} className="p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ul className="divide-y divide-gray-200">
                {companies.map((company) => (
                  <li
                    key={company.id}
                    onClick={() => handleCompanySelect(company)}
                    className={`px-4 py-3 cursor-pointer hover:bg-gray-50 ${selectedCompany?.id === company.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''}`}
                  >
                    <p className="font-medium text-gray-900 truncate">{company.name}</p>
                    {company.letterhead_url && <p className="text-[10px] text-green-600 font-bold uppercase">Template Active</p>}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Panel */}
          <div className="w-2/3 flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">{editMode ? 'Edit Company' : 'Company Details'}</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500"><X className="h-6 w-6" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {selectedCompany || editMode ? (
                <div className="space-y-6">
                  {editMode ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      {/* Template Upload Section */}
                      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="h-5 w-5 text-blue-600" />
                          <h4 className="font-bold text-blue-900 text-sm">Word Export Template (.docx)</h4>
                        </div>
                        <p className="text-xs text-blue-700 mb-4 leading-relaxed">
                          Upload a Word document with your letterhead. Place tags like <code className="bg-white px-1 rounded">{'{{SupplierName}}'}</code> where you want data to appear. The system will preserve your exact alignment and styling.
                        </p>
                        
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => letterheadInputRef.current?.click()}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-blue-200 rounded-lg text-sm font-bold text-blue-600 hover:bg-blue-100 transition-colors"
                          >
                            <Upload className="h-4 w-4" />
                            {letterheadFile ? 'Change File' : formData.letterhead_url ? 'Replace Template' : 'Upload Template'}
                          </button>
                          {letterheadFile && (
                            <div className="flex items-center gap-2 text-xs font-bold text-green-600">
                              <CheckCircle2 className="h-4 w-4" /> {letterheadFile.name}
                            </div>
                          )}
                        </div>
                        <input ref={letterheadInputRef} type="file" accept=".docx" onChange={handleLetterheadFileChange} className="hidden" />

                        {/* Placeholder Reference */}
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={() => setShowPlaceholders(!showPlaceholders)}
                            className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                          >
                            {showPlaceholders ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            View Placeholder Tags
                          </button>
                          {showPlaceholders && (
                            <div className="mt-2 grid grid-cols-2 gap-2 p-3 bg-white rounded-lg border border-blue-100 text-[10px] font-mono text-slate-600">
                              <div>
                                <p className="font-bold text-blue-800 mb-1">CONTRACTS</p>
                                <p>{'{{SupplierName}}'}</p>
                                <p>{'{{SupplierAddress}}'}</p>
                                <p>{'{{ContractNo}}'}</p>
                                <p>{'{{Date}}'}</p>
                                <p>{'{{BuyerName}}'}</p>
                                <p>{'{{Description}}'}</p>
                                <p>{'{{Article}}'}</p>
                                <p>{'{{Price1}}'} ... {'{{Price10}}'}</p>
                                <p className="mt-1 text-blue-500">Loop: {'{#Selections}'} ... {'{/Selections}'}</p>
                              </div>
                              <div>
                                <p className="font-bold text-blue-800 mb-1">DEBIT NOTES</p>
                                <p>{'{{DebitNoteNo}}'}</p>
                                <p>{'{{InvoiceNo}}'}</p>
                                <p>{'{{Quantity}}'}</p>
                                <p>{'{{CommissionAmount}}'}</p>
                                <p>{'{{ExchangeRate}}'}</p>
                                <p>{'{{CommissionInRupees}}'}</p>
                                <p>{'{{CommissionInWords}}'}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Company Name</h3>
                        <p className="text-lg font-bold text-gray-900">{selectedCompany?.name}</p>
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Template Status</h3>
                        {selectedCompany?.letterhead_url ? (
                          <div className="mt-1 flex items-center gap-2 text-green-600 font-bold text-sm">
                            <FileText className="h-4 w-4" /> Custom Word Template Active
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">No custom template uploaded. Using default layout.</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                    {editMode ? (
                      <>
                        <button onClick={handleCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                        <button onClick={handleSave} disabled={loading || uploadingLetterhead} className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                          {(loading || uploadingLetterhead) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Save Company
                        </button>
                      </>
                    ) : (
                      <>
                        {selectedCompany && <button onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50">Delete</button>}
                        <button onClick={handleEdit} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Edit Company</button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p>Select a company to manage its details and templates</p>
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