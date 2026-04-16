import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Minus, Save, Trash2, Building2, Upload, FileText, Download, Loader2, ChevronDown, ChevronRight, Info, CheckCircle2 } from 'lucide-react';
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
      name: company.name || '',
      address: Array.isArray(company.address) && company.address.length > 0 ? company.address : [''],
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
      handleCompanySelect(selectedCompany);
    } else {
      setEditMode(false);
    }
  };

  const handleArrayFieldChange = (index: number, value: string) => {
    const newAddress = [...formData.address];
    newAddress[index] = value;
    setFormData({ ...formData, address: newAddress });
  };

  const addAddressLine = () => {
    setFormData({ ...formData, address: [...formData.address, ''] });
  };

  const removeAddressLine = (index: number) => {
    if (formData.address.length > 1) {
      const newAddress = formData.address.filter((_, i) => i !== index);
      setFormData({ ...formData, address: newAddress });
    }
  };

  const uploadLetterheadFile = async (file: File, companyId: string): Promise<{ url: string; name: string } | null> => {
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `letterheads/${companyId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('contract-files')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('contract-files')
        .getPublicUrl(storagePath);

      return { url: publicUrl, name: file.name };
    } catch (err) {
      console.error('Upload error:', err);
      return null;
    }
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
      }

      await fetchCompanies();
      setEditMode(false);
      onCompanyUpdated();
      alert('Company saved successfully!');
    } catch (error) {
      console.error('Error saving company:', error);
      alert('Failed to save company. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCompany) return;
    if (!confirm(`Delete "${selectedCompany.name}"? This will also remove its template.`)) return;

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
    if (!file.name.toLowerCase().endsWith('.docx')) {
      alert('Please select a .docx Word document file');
      return;
    }
    setLetterheadFile(file);
  };

  if (!isOpen) return null;

  const inputClassName = "w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all";
  const labelClassName = "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Company Management</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500 p-1"><X className="h-6 w-6" /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - List */}
          <div className="w-1/3 border-r border-gray-200 flex flex-col bg-gray-50/50">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white">
              <h3 className="text-sm font-bold text-gray-500 uppercase">Your Companies</h3>
              <button onClick={handleNewCompany} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading && companies.length === 0 ? (
                <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" /></div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {companies.map((company) => (
                    <li
                      key={company.id}
                      onClick={() => handleCompanySelect(company)}
                      className={`px-4 py-4 cursor-pointer transition-all ${selectedCompany?.id === company.id ? 'bg-blue-50 border-r-4 border-blue-600' : 'hover:bg-gray-50'}`}
                    >
                      <p className="font-bold text-gray-900 truncate">{company.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {company.letterhead_url ? (
                          <span className="text-[10px] text-green-600 font-black uppercase flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Template Active
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-bold uppercase">No Template</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right Panel - Details/Edit */}
          <div className="w-2/3 flex flex-col bg-white">
            <div className="flex-1 overflow-y-auto p-6">
              {selectedCompany || editMode ? (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 gap-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                      <div>
                        <label className={labelClassName}>Company Name *</label>
                        {editMode ? (
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className={inputClassName}
                            placeholder="e.g. JILD IMPEX"
                          />
                        ) : (
                          <p className="text-lg font-bold text-gray-900">{formData.name}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelClassName}>Phone</label>
                          {editMode ? (
                            <input
                              type="text"
                              value={formData.phone}
                              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                              className={inputClassName}
                            />
                          ) : (
                            <p className="text-sm text-gray-700">{formData.phone || 'Not set'}</p>
                          )}
                        </div>
                        <div>
                          <label className={labelClassName}>Email</label>
                          {editMode ? (
                            <input
                              type="email"
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              className={inputClassName}
                            />
                          ) : (
                            <p className="text-sm text-gray-700">{formData.email || 'Not set'}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className={labelClassName}>Address Lines</label>
                        {editMode ? (
                          <div className="space-y-2">
                            {formData.address.map((line, idx) => (
                              <div key={idx} className="flex gap-2">
                                <input
                                  type="text"
                                  value={line}
                                  onChange={(e) => handleArrayFieldChange(idx, e.target.value)}
                                  className={inputClassName}
                                />
                                <button onClick={() => removeAddressLine(idx)} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            ))}
                            <button onClick={addAddressLine} className="text-xs font-bold text-blue-600 hover:underline">+ Add Line</button>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {formData.address.map((line, idx) => (
                              <p key={idx} className="text-sm text-gray-700">{line}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Template Section */}
                    <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <FileText className="h-6 w-6 text-blue-600" />
                          <h4 className="font-black text-blue-900 uppercase tracking-tight">Word Export Template (.docx)</h4>
                        </div>
                        <a 
                          href="https://docs.google.com/document/d/1-X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X_X/export?format=docx" 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-[10px] font-black text-blue-600 uppercase tracking-tighter hover:bg-blue-50 transition-all"
                        >
                          <Download className="h-3 w-3" /> Download Sample
                        </a>
                      </div>
                      
                      {editMode ? (
                        <div className="space-y-4">
                          <p className="text-xs text-blue-700 leading-relaxed font-medium">
                            Upload a Word document with your letterhead. Place tags like <code className="bg-white px-1 rounded">{'{{SupplierName}}'}</code> where you want data to appear.
                          </p>
                          
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => letterheadInputRef.current?.click()}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-blue-200 rounded-xl text-sm font-bold text-blue-600 hover:bg-blue-100 transition-all"
                            >
                              <Upload className="h-5 w-5" />
                              {letterheadFile ? 'Change File' : formData.letterhead_url ? 'Replace Template' : 'Upload .docx Template'}
                            </button>
                            {letterheadFile && (
                              <div className="flex items-center gap-2 text-xs font-bold text-green-600 bg-white px-3 py-2 rounded-lg border border-green-100">
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
                              className="flex items-center gap-1 text-xs font-black text-blue-600 uppercase tracking-widest hover:underline"
                            >
                              {showPlaceholders ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              Placeholder Guide
                            </button>
                            {showPlaceholders && (
                              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-white rounded-xl border border-blue-100 text-[11px] font-medium text-slate-600 shadow-inner">
                                <div>
                                  <p className="font-black text-blue-800 mb-2 uppercase tracking-tighter">Common Fields</p>
                                  <p className="mb-1"><code className="text-blue-600">{'{{SupplierName}}'}</code></p>
                                  <p className="mb-1"><code className="text-blue-600">{'{{SupplierAddress}}'}</code> (All lines)</p>
                                  <p className="mb-1"><code className="text-blue-600">{'{{SupplierAddress1}}'}</code> (Line 1 only)</p>
                                  <p className="mb-1"><code className="text-blue-600">{'{{Date}}'}</code></p>
                                  <p className="mb-1"><code className="text-blue-600">{'{{BuyerName}}'}</code></p>
                                </div>
                                <div>
                                  <p className="font-black text-blue-800 mb-2 uppercase tracking-tighter">Contract Specific</p>
                                  <p className="mb-1"><code className="text-blue-600">{'{{ContractNo}}'}</code></p>
                                  <p className="mb-1"><code className="text-blue-600">{'{{Article}}'}</code></p>
                                  <p className="mb-1"><code className="text-blue-600">{'{{Price1}}'}</code> to <code className="text-blue-600">{'{{Price10}}'}</code></p>
                                  <p className="mt-2 text-slate-400 italic">Use loops for tables:</p>
                                  <p><code className="text-purple-600">{'{#Selections}'} ... {'{/Selections}'}</code></p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-white/50 p-4 rounded-xl border border-blue-100">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${formData.letterhead_url ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                              <FileText className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">
                                {formData.letterhead_url ? 'Custom Template Active' : 'No Template Uploaded'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formData.letterhead_name || 'Using default system layout'}
                              </p>
                            </div>
                          </div>
                          {formData.letterhead_url && (
                            <a href={formData.letterhead_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 hover:underline">Download Current</a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                    {editMode ? (
                      <>
                        <button onClick={handleCancel} className="px-6 py-2.5 text-sm font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all">Cancel</button>
                        <button onClick={handleSave} disabled={loading || uploadingLetterhead} className="inline-flex items-center px-6 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-200 transition-all">
                          {(loading || uploadingLetterhead) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Save Company
                        </button>
                      </>
                    ) : (
                      <>
                        {selectedCompany && (
                          <button onClick={handleDelete} className="px-6 py-2.5 text-sm font-bold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-all">Delete</button>
                        )}
                        <button onClick={handleEdit} className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all">Edit Details</button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
                      <Building2 className="h-10 w-10 text-gray-300" />
                    </div>
                    <p className="font-bold text-gray-400">Select a company to manage its details</p>
                    <p className="text-xs text-gray-400 mt-1">Add your business entities and upload letterhead templates</p>
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