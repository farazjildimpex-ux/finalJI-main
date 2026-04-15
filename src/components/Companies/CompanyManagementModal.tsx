import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Minus, Save, Trash2, Building2, Upload, FileText, Download, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
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

  const errMsg = (err: unknown): string => {
    if (!err) return 'Unknown error';
    if (err instanceof Error) return err.message;
    if (typeof err === 'object') {
      const o = err as Record<string, unknown>;
      if (typeof o.message === 'string' && o.message) return o.message;
      if (typeof o.error_description === 'string') return o.error_description;
      try { return JSON.stringify(o); } catch { /* fall through */ }
    }
    return String(err);
  };

  const uploadLetterheadFile = async (file: File, companyId: string): Promise<{ url: string; name: string } | null> => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `letterheads/${companyId}/${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('contract-files')
      .upload(storagePath, file, { upsert: true });

    if (uploadError) {
      const msg = errMsg(uploadError);
      throw new Error(`Storage upload failed: ${msg}`);
    }

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
    let savedOk = false;

    try {
      const baseData = {
        name: formData.name.trim(),
        address: formData.address.filter(addr => addr.trim() !== ''),
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
      };

      if (selectedCompany) {
        // Step 1: Save core company data
        const { error } = await supabase
          .from('companies')
          .update(baseData)
          .eq('id', selectedCompany.id);

        if (error) throw new Error(errMsg(error));

        // Step 2: Upload letterhead (non-blocking — company is already saved above)
        let finalLetterheadUrl = selectedCompany.letterhead_url || '';
        let finalLetterheadName = selectedCompany.letterhead_name || '';

        if (letterheadFile) {
          setUploadingLetterhead(true);
          try {
            const result = await uploadLetterheadFile(letterheadFile, selectedCompany.id);
            if (result) {
              const { error: lhError } = await supabase
                .from('companies')
                .update({ letterhead_url: result.url, letterhead_name: result.name })
                .eq('id', selectedCompany.id);
              if (!lhError) {
                finalLetterheadUrl = result.url;
                finalLetterheadName = result.name;
              } else {
                alert(`Company saved. However, letterhead link failed: ${errMsg(lhError)}`);
              }
            }
          } catch (lhErr) {
            alert(`Company saved. However, letterhead upload failed: ${errMsg(lhErr)}`);
          } finally {
            setUploadingLetterhead(false);
          }
        } else if (!formData.letterhead_url && selectedCompany.letterhead_url) {
          const { error: clrErr } = await supabase
            .from('companies')
            .update({ letterhead_url: null, letterhead_name: null })
            .eq('id', selectedCompany.id);
          if (!clrErr) { finalLetterheadUrl = ''; finalLetterheadName = ''; }
        }

        const updated = { ...selectedCompany, ...baseData, letterhead_url: finalLetterheadUrl, letterhead_name: finalLetterheadName };
        setSelectedCompany(updated as Company);
        setFormData(prev => ({ ...prev, letterhead_url: finalLetterheadUrl, letterhead_name: finalLetterheadName }));
        setLetterheadFile(null);
        savedOk = true;
        alert('Company updated successfully!');
      } else {
        // New company — insert first, then upload letterhead
        const { data: newData, error } = await supabase
          .from('companies')
          .insert([baseData])
          .select()
          .single();

        if (error) throw new Error(errMsg(error));

        if (letterheadFile && newData) {
          setUploadingLetterhead(true);
          try {
            const result = await uploadLetterheadFile(letterheadFile, newData.id);
            if (result) {
              const { error: lhError } = await supabase
                .from('companies')
                .update({ letterhead_url: result.url, letterhead_name: result.name })
                .eq('id', newData.id);
              if (lhError) {
                alert(`Company created. However, letterhead upload failed: ${errMsg(lhError)}`);
              }
            }
          } catch (lhErr) {
            alert(`Company created. However, letterhead upload failed: ${errMsg(lhErr)}`);
          } finally {
            setUploadingLetterhead(false);
          }
        }

        setLetterheadFile(null);
        savedOk = true;
        alert('Company created successfully!');
      }
    } catch (error) {
      console.error('Company save error (full object):', JSON.stringify(error));
      const msg = errMsg(error);
      if (msg.includes('duplicate key') || msg.includes('unique')) {
        alert('A company with this name already exists.');
      } else {
        alert(`Failed to save company: ${msg}`);
      }
    } finally {
      setLoading(false);
    }

    if (savedOk) {
      await fetchCompanies();
      setEditMode(false);
      onCompanyUpdated();
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
      setFormData({ name: '', address: [''], phone: '', email: '', letterhead_url: '', letterhead_name: '' });
      setEditMode(false);
      await fetchCompanies();
      onCompanyUpdated();
      
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

  const handleRemoveLetterhead = () => {
    setFormData(prev => ({ ...prev, letterhead_url: '', letterhead_name: '' }));
    setLetterheadFile(null);
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

  const currentLetterheadName = letterheadFile ? letterheadFile.name : formData.letterhead_name;
  const hasLetterhead = !!(letterheadFile || formData.letterhead_url);

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
                        <Building2 className="h-5 w-5 text-gray-400 mr-3 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{company.name}</p>
                          {company.address[0] && (
                            <p className="text-sm text-gray-500 truncate">{company.address[0]}</p>
                          )}
                          {company.letterhead_url && (
                            <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              Letterhead set
                            </p>
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
                <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                  <X className="h-6 w-6" />
                </button>
              </div>
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Enter company name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Enter phone number"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Enter email address"
                        />
                      </div>

                      {/* Letterhead Template Upload */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Letterhead Template (.docx)
                        </label>
                        {hasLetterhead ? (
                          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <FileText className="h-5 w-5 text-green-600 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-green-800 truncate">
                                {currentLetterheadName || 'Template uploaded'}
                              </p>
                              <p className="text-xs text-green-600">
                                {letterheadFile ? 'Ready to upload on save' : 'Template active'}
                              </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => letterheadInputRef.current?.click()}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Replace
                              </button>
                              <button
                                type="button"
                                onClick={handleRemoveLetterhead}
                                className="text-xs text-red-600 hover:text-red-800 font-medium"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => letterheadInputRef.current?.click()}
                            className="flex items-center justify-center w-full gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Upload className="h-4 w-4" />
                            Click to upload a .docx letterhead template
                          </button>
                        )}
                        <input
                          ref={letterheadInputRef}
                          type="file"
                          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          onChange={handleLetterheadFileChange}
                          className="hidden"
                        />
                        <p className="mt-1.5 text-xs text-gray-500">
                          Design your .docx template in Word exactly as you want the final document. Place <span className="font-mono bg-gray-100 px-1 rounded">{'{{Placeholder}}'}</span> tags where data should appear.
                        </p>

                        {/* Placeholder Reference */}
                        <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setShowPlaceholders(!showPlaceholders)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700"
                          >
                            <span>View available template placeholders</span>
                            {showPlaceholders ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                          {showPlaceholders && (
                            <div className="p-3 text-xs space-y-3 bg-white">
                              <div>
                                <p className="font-semibold text-gray-700 mb-1">Contract Template</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-gray-600">
                                  {[
                                    ['{{SupplierName}}', 'Supplier / seller name'],
                                    ['{{SupplierAddress}}', 'Full address (multi-line)'],
                                    ['{{SupplierAddress1}}–{{SupplierAddress5}}', 'Individual address lines'],
                                    ['{{Date}}', 'Contract date (DD/MM/YYYY)'],
                                    ['{{ContractNo}}', 'Contract number'],
                                    ['{{BuyersRef}}', "Buyer's reference"],
                                    ['{{BuyerName}}', 'Buyer name'],
                                    ['{{BuyerAddress}}', 'Buyer address (multi-line)'],
                                    ['{{BuyerAddress1}}–{{BuyerAddress5}}', 'Individual buyer addr lines'],
                                    ['{{Description}}', 'Goods description'],
                                    ['{{Article}}', 'Article'],
                                    ['{{Size}}', 'Size'],
                                    ['{{Average}}', 'Average'],
                                    ['{{Substance}}', 'Substance'],
                                    ['{{Measurement}}', 'Measurement'],
                                    ['{{ImportantNotes}}', 'All VERY IMPORTANT notes'],
                                    ['{{ImportantNote1}}–{{ImportantNote5}}', 'Individual notes'],
                                    ['{{Delivery}}', 'Delivery schedule'],
                                    ['{{Destination}}', 'Destination'],
                                    ['{{Payment}}', 'Payment terms'],
                                    ['{{Commission}}', 'Commission (local + foreign)'],
                                    ['{{Notify}}', 'Notify party'],
                                    ['{{BankDocuments}}', 'Bank documents'],
                                    ['{{CompanyName}}', 'Your company name (CAPS)'],
                                    ['{{Selection1}}–{{Selection10}}', 'Selection rows'],
                                    ['{{Color1}}–{{Color10}}', 'Color rows'],
                                    ['{{Swatch1}}–{{Swatch10}}', 'Swatch/Reference rows'],
                                    ['{{Quantity1}}–{{Quantity10}}', 'Quantity rows'],
                                    ['{{Price1}}–{{Price10}}', 'Price rows'],
                                  ].map(([tag, desc]) => (
                                    <React.Fragment key={tag}>
                                      <span className="font-mono text-blue-700 truncate">{tag}</span>
                                      <span className="text-gray-500">{desc}</span>
                                    </React.Fragment>
                                  ))}
                                </div>
                                <p className="mt-2 text-gray-500">
                                  <span className="font-medium">Selection table loop:</span> In a table row, use <span className="font-mono bg-gray-100 px-0.5 rounded">{'"{#Selections}"'}</span> and <span className="font-mono bg-gray-100 px-0.5 rounded">{'"{/Selections}"'}</span> with <span className="font-mono bg-gray-100 px-0.5 rounded">{'"{Selection}"'}</span>, <span className="font-mono bg-gray-100 px-0.5 rounded">{'"{Color}"'}</span>, <span className="font-mono bg-gray-100 px-0.5 rounded">{'"{Swatch}"'}</span>, <span className="font-mono bg-gray-100 px-0.5 rounded">{'"{Quantity}"'}</span>, <span className="font-mono bg-gray-100 px-0.5 rounded">{'"{Price}"'}</span> — docxtemplater will repeat the row for each item.
                                </p>
                              </div>
                              <hr />
                              <div>
                                <p className="font-semibold text-gray-700 mb-1">Debit Note Template</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-gray-600">
                                  {[
                                    ['{{SupplierName}}', 'Supplier name'],
                                    ['{{SupplierAddress}}', 'Full address (multi-line)'],
                                    ['{{SupplierAddress1}}–{{SupplierAddress5}}', 'Individual address lines'],
                                    ['{{DebitNoteNo}}', 'Debit note number'],
                                    ['{{Date}}', 'Debit note date'],
                                    ['{{ContractNo}}', 'Contract number'],
                                    ['{{ContractDate}}', 'Contract date'],
                                    ['{{BuyerName}}', 'Buyer name'],
                                    ['{{InvoiceNo}}', 'Invoice number'],
                                    ['{{InvoiceDate}}', 'Invoice date'],
                                    ['{{Quantity}}', 'Quantity'],
                                    ['{{Pieces}}', 'Number of pieces'],
                                    ['{{Destination}}', 'Destination'],
                                    ['{{CommissionPercent}}', 'Commission %'],
                                    ['{{Currency}}', 'Currency (USD/EUR etc)'],
                                    ['{{InvoiceValue}}', 'Invoice value'],
                                    ['{{CommissionAmount}}', 'Commission amount'],
                                    ['{{ExchangeRate}}', 'Exchange rate'],
                                    ['{{CommissionInRupees}}', 'Commission in ₹'],
                                    ['{{CommissionInWords}}', 'Amount in words'],
                                    ['{{CompanyName}}', 'Your company name (CAPS)'],
                                  ].map(([tag, desc]) => (
                                    <React.Fragment key={tag}>
                                      <span className="font-mono text-blue-700 truncate">{tag}</span>
                                      <span className="text-gray-500">{desc}</span>
                                    </React.Fragment>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
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

                      {/* Letterhead Template - View Mode */}
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Letterhead Template</h3>
                        {selectedCompany?.letterhead_url ? (
                          <div className="mt-2 flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <FileText className="h-5 w-5 text-green-600 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-green-800 truncate">
                                {selectedCompany.letterhead_name || 'Letterhead template'}
                              </p>
                              <p className="text-xs text-green-600">Active — used for PDF and Word exports</p>
                            </div>
                            <a
                              href={selectedCompany.letterhead_url}
                              download={selectedCompany.letterhead_name || 'letterhead.docx'}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium shrink-0"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </a>
                          </div>
                        ) : (
                          <p className="mt-1 text-sm text-gray-400 italic">
                            No letterhead template — click Edit to upload one
                          </p>
                        )}
                      </div>
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
                          disabled={loading || uploadingLetterhead}
                          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          {(loading || uploadingLetterhead) ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 mr-1" />
                          )}
                          {uploadingLetterhead ? 'Uploading...' : loading ? 'Saving...' : 'Save Company'}
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
