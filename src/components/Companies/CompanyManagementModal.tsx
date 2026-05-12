import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Minus, Save, Trash2, Building2, Upload, FileText, Copy, Loader2, ChevronDown, ChevronRight, Info, CheckCircle2, Image, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Company } from '../../types';
import { dialogService } from '../../lib/dialogService';

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
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const [uploadingFooter, setUploadingFooter] = useState(false);
  const [letterheadFile, setLetterheadFile] = useState<File | null>(null);
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [footerFile, setFooterFile] = useState<File | null>(null);
  const [showPlaceholders, setShowPlaceholders] = useState(true);
  const letterheadInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);
  const footerInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    address: [''],
    phone: '',
    email: '',
    letterhead_url: '',
    letterhead_name: '',
    header_url: '' as string | null,
    footer_url: '' as string | null,
    header_ext: 'png',
    footer_ext: 'png',
    header_height: 30,
    footer_height: 20,
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
      header_url: company.header_url || null,
      footer_url: company.footer_url || null,
      header_ext: company.header_ext || 'png',
      footer_ext: company.footer_ext || 'png',
      header_height: company.header_height ?? 30,
      footer_height: company.footer_height ?? 20,
    });
    setLetterheadFile(null);
    setHeaderFile(null);
    setFooterFile(null);
    setEditMode(false);
  };

  const handleNewCompany = () => {
    setSelectedCompany(null);
    setFormData({
      name: '', address: [''], phone: '', email: '',
      letterhead_url: '', letterhead_name: '',
      header_url: null, footer_url: null,
      header_ext: 'png', footer_ext: 'png',
      header_height: 30, footer_height: 20,
    });
    setLetterheadFile(null);
    setHeaderFile(null);
    setFooterFile(null);
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
      const { error: uploadError } = await supabase.storage.from('contract-files').upload(storagePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('contract-files').getPublicUrl(storagePath);
      return { url: publicUrl, name: file.name };
    } catch (err) {
      console.error('Upload error:', err);
      return null;
    }
  };

  const uploadImageFile = async (file: File, companyId: string, slot: 'header' | 'footer'): Promise<{ url: string; ext: string } | null> => {
    try {
      const ext = file.type === 'image/jpeg' ? 'jpg' : 'png';
      const storagePath = `letterhead-images/${companyId}/${slot}.${ext}`;
      // upsert: overwrite existing if any
      const { error } = await supabase.storage.from('contract-files').upload(storagePath, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('contract-files').getPublicUrl(storagePath);
      return { url: publicUrl, ext };
    } catch (err) {
      console.error(`Upload ${slot} error:`, err);
      return null;
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      dialogService.alert({
        title: 'Missing company name',
        message: 'Company name is required.',
        tone: 'warning',
      });
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

      const extraUpdates: Record<string, unknown> = {};

      if (letterheadFile && companyId) {
        setUploadingLetterhead(true);
        const result = await uploadLetterheadFile(letterheadFile, companyId);
        if (result) { extraUpdates.letterhead_url = result.url; extraUpdates.letterhead_name = result.name; }
        setUploadingLetterhead(false);
      }

      if (headerFile && companyId) {
        setUploadingHeader(true);
        const result = await uploadImageFile(headerFile, companyId, 'header');
        if (result) {
          extraUpdates.header_url = result.url;
          extraUpdates.header_ext = result.ext;
        }
        setUploadingHeader(false);
      }

      if (footerFile && companyId) {
        setUploadingFooter(true);
        const result = await uploadImageFile(footerFile, companyId, 'footer');
        if (result) {
          extraUpdates.footer_url = result.url;
          extraUpdates.footer_ext = result.ext;
        }
        setUploadingFooter(false);
      }

      // Always save height settings + any uploaded URLs
      extraUpdates.header_height = formData.header_height;
      extraUpdates.footer_height = formData.footer_height;

      if (Object.keys(extraUpdates).length > 0 && companyId) {
        await supabase.from('companies').update(extraUpdates).eq('id', companyId);
      }

      await fetchCompanies();
      setEditMode(false);
      onCompanyUpdated();
      dialogService.success('Company saved successfully.');
    } catch (error: any) {
      console.error('Error saving company:', error);
      dialogService.alert({
        title: 'Failed to save company',
        message: error?.message || 'Please try again.',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCompany) return;
    const ok = await dialogService.confirm({
      title: 'Delete company?',
      message: `Delete "${selectedCompany.name}"? This will also remove its template. This action cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      setLoading(true);
      const { error } = await supabase.from('companies').delete().eq('id', selectedCompany.id);
      if (error) throw error;
      setSelectedCompany(null);
      setEditMode(false);
      await fetchCompanies();
      onCompanyUpdated();
      dialogService.success('Company deleted.');
    } catch (error: any) {
      console.error('Error deleting company:', error);
      dialogService.alert({
        title: 'Failed to delete company',
        message: error?.message || 'Please try again.',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLetterheadFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
      dialogService.alert({
        title: 'Invalid file type',
        message: 'Please select a .docx Word document file.',
        tone: 'warning',
      });
      return;
    }
    setLetterheadFile(file);
  };

  const copyTagsToClipboard = (type: 'contract' | 'debit') => {
    const tags = type === 'contract' 
      ? `{{SupplierName}}\n{{SupplierAddress}}\n{{Date}}\n{{ContractNo}}\n{{BuyersRef}}\n{{BuyerName}}\n{{BuyerAddress}}\n{{Description}}\n{{Article}}\n{{Size}}\n{{Average}}\n{{Substance}}\n{{Measurement}}\n{{Delivery}}\n{{Destination}}\n{{Payment}}\n{{Commission}}\n{{Notify}}\n{{BankDocuments}}`
      : `{{SupplierName}}\n{{SupplierAddress}}\n{{DebitNoteNo}}\n{{Date}}\n{{ContractNo}}\n{{ContractDate}}\n{{BuyerName}}\n{{InvoiceNo}}\n{{InvoiceDate}}\n{{Quantity}}\n{{Pieces}}\n{{Destination}}\n{{CommissionPercent}}\n{{Currency}}\n{{InvoiceValue}}\n{{CommissionAmount}}\n{{ExchangeRate}}\n{{CommissionInRupees}}\n{{CommissionInWords}}`;
    
    navigator.clipboard.writeText(tags);
    dialogService.success('Tags copied! Paste them into your Word document.');
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
                        {company.letterhead_url && (
                          <span className="text-[10px] text-blue-600 font-black uppercase flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Word
                          </span>
                        )}
                        {(company.header_url || company.footer_url) && (
                          <span className="text-[10px] text-emerald-600 font-black uppercase flex items-center gap-1">
                            <Image className="h-3 w-3" /> PDF Images
                          </span>
                        )}
                        {!company.letterhead_url && !company.header_url && !company.footer_url && (
                          <span className="text-[10px] text-gray-400 font-bold uppercase">No Templates</span>
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
                      <div className="flex items-center gap-2 mb-4">
                        <FileText className="h-6 w-6 text-blue-600" />
                        <h4 className="font-black text-blue-900 uppercase tracking-tight">Word Export Template (.docx)</h4>
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
                            <div className="flex items-center justify-between mb-3">
                              <button
                                type="button"
                                onClick={() => setShowPlaceholders(!showPlaceholders)}
                                className="flex items-center gap-1 text-xs font-black text-blue-600 uppercase tracking-widest hover:underline"
                              >
                                {showPlaceholders ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                Placeholder Guide
                              </button>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => copyTagsToClipboard('contract')}
                                  className="px-2 py-1 bg-white border border-blue-200 rounded text-[10px] font-bold text-blue-600 hover:bg-blue-50"
                                >
                                  Copy Contract Tags
                                </button>
                                <button 
                                  onClick={() => copyTagsToClipboard('debit')}
                                  className="px-2 py-1 bg-white border border-blue-200 rounded text-[10px] font-bold text-blue-600 hover:bg-blue-50"
                                >
                                  Copy Debit Note Tags
                                </button>
                              </div>
                            </div>
                            
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

                    {/* PDF Header & Footer Images */}
                    <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
                      <div className="flex items-center gap-2 mb-1">
                        <Image className="h-6 w-6 text-emerald-600" />
                        <h4 className="font-black text-emerald-900 uppercase tracking-tight">PDF Header &amp; Footer Images</h4>
                      </div>
                      <p className="text-xs text-emerald-700 mb-4 font-medium">
                        These images are placed at the top and bottom of every exported PDF. PNG files work best.
                        Recommended: full-width letterhead (A4 = 210 mm wide). Header ≤ 35 mm tall, Footer ≤ 25 mm tall.
                      </p>

                      {editMode ? (
                        <div className="space-y-5">
                          {/* Header Image */}
                          <div className="bg-white rounded-xl p-4 border border-emerald-100">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-black text-gray-800 uppercase tracking-tight">Header Image</p>
                              {(formData.header_url || headerFile) && (
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Active
                                </span>
                              )}
                            </div>
                            {formData.header_url && !headerFile && (
                              <img src={formData.header_url} alt="Current header" className="w-full h-16 object-contain mb-3 rounded border border-gray-100 bg-gray-50" />
                            )}
                            {headerFile && (
                              <div className="text-xs font-bold text-emerald-600 mb-2 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> {headerFile.name} (pending save)
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => headerInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-50 border-2 border-emerald-200 rounded-xl text-sm font-bold text-emerald-700 hover:bg-emerald-100 transition-all"
                              >
                                <Upload className="h-4 w-4" />
                                {headerFile ? 'Change Header' : formData.header_url ? 'Replace Header' : 'Upload Header PNG'}
                              </button>
                              {formData.header_url && (
                                <button
                                  type="button"
                                  onClick={() => setFormData({ ...formData, header_url: null })}
                                  className="px-3 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold hover:bg-red-100"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                            <input ref={headerInputRef} type="file" accept="image/png,image/jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) setHeaderFile(f); }} className="hidden" />
                            <div className="mt-3 flex items-center gap-2">
                              <label className="text-xs font-bold text-gray-600">Height in PDF (mm):</label>
                              <input
                                type="number"
                                min={10} max={60} step={1}
                                value={formData.header_height}
                                onChange={(e) => setFormData({ ...formData, header_height: Number(e.target.value) })}
                                className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                              />
                              <span className="text-xs text-gray-400">(default 30 mm)</span>
                            </div>
                          </div>

                          {/* Footer Image */}
                          <div className="bg-white rounded-xl p-4 border border-emerald-100">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-black text-gray-800 uppercase tracking-tight">Footer Image</p>
                              {(formData.footer_url || footerFile) && (
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Active
                                </span>
                              )}
                            </div>
                            {formData.footer_url && !footerFile && (
                              <img src={formData.footer_url} alt="Current footer" className="w-full h-12 object-contain mb-3 rounded border border-gray-100 bg-gray-50" />
                            )}
                            {footerFile && (
                              <div className="text-xs font-bold text-emerald-600 mb-2 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> {footerFile.name} (pending save)
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => footerInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-50 border-2 border-emerald-200 rounded-xl text-sm font-bold text-emerald-700 hover:bg-emerald-100 transition-all"
                              >
                                <Upload className="h-4 w-4" />
                                {footerFile ? 'Change Footer' : formData.footer_url ? 'Replace Footer' : 'Upload Footer PNG'}
                              </button>
                              {formData.footer_url && (
                                <button
                                  type="button"
                                  onClick={() => setFormData({ ...formData, footer_url: null })}
                                  className="px-3 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold hover:bg-red-100"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                            <input ref={footerInputRef} type="file" accept="image/png,image/jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFooterFile(f); }} className="hidden" />
                            <div className="mt-3 flex items-center gap-2">
                              <label className="text-xs font-bold text-gray-600">Height in PDF (mm):</label>
                              <input
                                type="number"
                                min={5} max={40} step={1}
                                value={formData.footer_height}
                                onChange={(e) => setFormData({ ...formData, footer_height: Number(e.target.value) })}
                                className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                              />
                              <span className="text-xs text-gray-400">(default 20 mm)</span>
                            </div>
                          </div>

                          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-amber-700 font-medium">
                              Images are stretched to full A4 width. For best results use a PNG at least 2480 px wide. Keep file size under 2 MB.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          {/* Header preview */}
                          <div className="bg-white/60 rounded-xl p-3 border border-emerald-100">
                            <p className="text-xs font-black text-gray-500 uppercase mb-2">Header</p>
                            {formData.header_url ? (
                              <>
                                <img src={formData.header_url} alt="Header" className="w-full h-12 object-contain rounded border border-gray-100 bg-gray-50 mb-1" />
                                <p className="text-[10px] text-gray-400 font-medium">{formData.header_height} mm tall</p>
                              </>
                            ) : (
                              <p className="text-xs text-gray-400 font-medium">Not set</p>
                            )}
                          </div>
                          {/* Footer preview */}
                          <div className="bg-white/60 rounded-xl p-3 border border-emerald-100">
                            <p className="text-xs font-black text-gray-500 uppercase mb-2">Footer</p>
                            {formData.footer_url ? (
                              <>
                                <img src={formData.footer_url} alt="Footer" className="w-full h-10 object-contain rounded border border-gray-100 bg-gray-50 mb-1" />
                                <p className="text-[10px] text-gray-400 font-medium">{formData.footer_height} mm tall</p>
                              </>
                            ) : (
                              <p className="text-xs text-gray-400 font-medium">Not set</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                  {/* Footer Actions */}
                  <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                    {editMode ? (
                      <>
                        <button onClick={handleCancel} className="px-6 py-2.5 text-sm font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all">Cancel</button>
                        <button onClick={handleSave} disabled={loading || uploadingLetterhead || uploadingHeader || uploadingFooter} className="inline-flex items-center px-6 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-200 transition-all">
                          {(loading || uploadingLetterhead || uploadingHeader || uploadingFooter) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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