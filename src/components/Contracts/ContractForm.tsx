import React, { useState, useEffect, useRef } from 'react';
import { Save, FileDown, Copy, ChevronDown, Trash2, X, Plus, ClipboardList, User, Building2, Package, LayoutGrid, Truck, StickyNote, PenLine, CheckCircle2, Paperclip, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Contact, Contract, Company, ContractFile } from '../../types';
import DatePicker from '../UI/DatePicker';
import FormRow, { CollapsibleFormSection, formInputClass, ModernRow, ModernSection, FGrid, FField, FSectionCard, roundedInputClass, roundedTextareaClass } from '../UI/FormRow';

import { generateContractPDF } from '../../utils/contractPdfGenerator';
import { generateContractWord, extractLetterheadImages } from '../../utils/contractWordGenerator';
import { loadCompanyLetterheadImages, urlToBase64 } from '../../utils/pdfLayoutConfig';
import { useNavigate } from 'react-router-dom';
import { dialogService } from '../../lib/dialogService';
import { useAuth } from '../../hooks/useAuth';
import SignaturePickerModal, { type PickedSignature } from '../UI/SignaturePickerModal';



const STATUS_OPTIONS = ['Issued', 'Inspected', 'Completed', 'Cancelled'] as const;
const STATUS_COLORS: Record<string, string> = {
  Issued:    'bg-blue-50 text-blue-900 border-blue-300',
  Inspected: 'bg-amber-50 text-amber-900 border-amber-300',
  Completed: 'bg-emerald-50 text-emerald-900 border-emerald-300',
  Cancelled: 'bg-red-50 text-red-900 border-red-300',
};
const CURRENCY_OPTIONS = ['Euro', 'USD', 'INR'] as const;
const ATTACHMENT_TYPES = ['Purchase Order', 'Letter of Credit', 'Packing List', 'Bill of Lading', 'Invoice', 'Other'] as const;
const FIELD_LABEL = 'block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1';

interface ContractFormProps {
  initialContract?: Contract | null;
}

export default function ContractForm({ initialContract }: ContractFormProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contractFiles, setContractFiles] = useState<ContractFile[]>([]);
  const [buyerSearch, setBuyerSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingWord, setGeneratingWord] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCompanyInPdf, setShowCompanyInPdf] = useState(true);
  const [companyLetterheadUrl, setCompanyLetterheadUrl] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [attachmentType, setAttachmentType] = useState<string>('Purchase Order');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [attachmentDeleting, setAttachmentDeleting] = useState<string | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<Partial<Contract>>({
    company_name: '',
    contract_no: '',
    contract_date: new Date().toISOString().split('T')[0],
    buyers_reference: '',
    buyer_name: '',
    buyer_address: [''],
    supplier_name: '',
    supplier_address: [''],
    description: '',
    article: '',
    size: '',
    average: '',
    substance: '',
    measurement: '',
    selection: [''],
    color: [''],
    swatch: [''],
    quantity: [''],
    price: [''],
    delivery_schedule: [''],
    destination: [''],
    local_commission: '',
    foreign_commission: '',
    payment_terms: '',
    notify_party: '',
    bank_documents: '',
    important_notes: [''],
    currency: 'USD',
    status: 'Issued' as typeof STATUS_OPTIONS[number]
  });

  useEffect(() => {
    fetchContacts();
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (initialContract) {
      setFormData(initialContract);
      setBuyerSearch(initialContract.buyer_name || '');
      setSupplierSearch(initialContract.supplier_name || '');
    }
  }, [initialContract]);

  useEffect(() => {
    if (initialContract?.company_name && companies.length > 0) {
      const co = companies.find(c => c.name === initialContract.company_name);
      setCompanyLetterheadUrl(co?.letterhead_url || null);
      setSelectedCompany(co || null);
    }
  }, [initialContract, companies]);

  useEffect(() => {
    const loadAttachments = async () => {
      if (!initialContract?.id) {
        setContractFiles([]);
        return;
      }
      const { data, error } = await supabase
        .from('contract_files')
        .select('*')
        .eq('contract_id', initialContract.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching contract attachments:', error);
        return;
      }
      setContractFiles((data || []) as ContractFile[]);
    };

    loadAttachments();
  }, [initialContract?.id]);


  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_book')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const handleContactSelect = (type: 'buyer' | 'supplier', contactName: string) => {
    const contact = contacts.find(c => c.name === contactName);
    if (contact) {
      if (type === 'buyer') {
        setFormData(prev => ({
          ...prev,
          buyer_name: contact.name,
          buyer_address: contact.address
        }));
        setBuyerSearch(contact.name);
        setShowBuyerDropdown(false);
      } else {
        setFormData(prev => ({
          ...prev,
          supplier_name: contact.name,
          supplier_address: contact.address
        }));
        setSupplierSearch(contact.name);
        setShowSupplierDropdown(false);
      }
    }
  };

  const openAttachment = async (file: ContractFile) => {
    const { data } = supabase.storage.from('contract-files').getPublicUrl(file.file_path);
    window.open(data.publicUrl, '_blank', 'noopener,noreferrer');
  };

  const handleAttachmentPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setAttachmentFile(file);
  };

  const handleAttachmentUpload = async () => {
    if (!initialContract?.id) {
      dialogService.alert({
        title: 'Save contract first',
        message: 'Please save the contract before adding attachments.',
        tone: 'warning',
      });
      return;
    }
    if (!attachmentFile || !user) {
      dialogService.alert({
        title: 'Choose a file',
        message: 'Select a document to upload.',
        tone: 'warning',
      });
      return;
    }

    setAttachmentUploading(true);
    try {
      const safeName = attachmentFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `contracts/${initialContract.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('contract-files')
        .upload(storagePath, attachmentFile, { upsert: false });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('contract_files').insert([{
        contract_id: initialContract.id,
        file_name: attachmentFile.name,
        file_path: storagePath,
        file_size: attachmentFile.size,
        mime_type: attachmentFile.type || 'application/octet-stream',
        document_type: attachmentType.trim() || 'Other',
        uploaded_by: user.id,
      }]);
      if (insertError) throw insertError;

      const { data, error } = await supabase
        .from('contract_files')
        .select('*')
        .eq('contract_id', initialContract.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setContractFiles((data || []) as ContractFile[]);
      setAttachmentFile(null);
      setAttachmentType('Purchase Order');
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
      dialogService.success('Attachment uploaded.');
    } catch (error: any) {
      console.error('Error uploading attachment:', error);
      dialogService.alert({
        title: 'Upload failed',
        message: error?.message || 'Please try again.',
        tone: 'danger',
      });
    } finally {
      setAttachmentUploading(false);
    }
  };

  const handleAttachmentDelete = async (file: ContractFile) => {
    const ok = await dialogService.confirm({
      title: 'Delete attachment?',
      message: 'This file will be removed from the contract.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;

    setAttachmentDeleting(file.id);
    try {
      await supabase.storage.from('contract-files').remove([file.file_path]);
      const { error } = await supabase.from('contract_files').delete().eq('id', file.id);
      if (error) throw error;
      setContractFiles(prev => prev.filter(item => item.id !== file.id));
      dialogService.success('Attachment deleted.');
    } catch (error: any) {
      console.error('Error deleting attachment:', error);
      dialogService.alert({
        title: 'Delete failed',
        message: error?.message || 'Please try again.',
        tone: 'danger',
      });
    } finally {
      setAttachmentDeleting(null);
    }
  };

  const handleArrayFieldChange = (
    field: keyof Contract,
    index: number,
    value: string
  ) => {
    setFormData(prev => {
      const newArray = [...(prev[field] as string[])];
      newArray[index] = value;
      return { ...prev, [field]: newArray };
    });
  };

  const addArrayField = (field: keyof Contract) => {
    setFormData(prev => ({
      ...prev,
      [field]: [...(prev[field] as string[]), '']
    }));
  };

  const removeArrayField = (field: keyof Contract, index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((_, i) => i !== index)
    }));
  };

  const checkContractNumberExists = async (contractNo: string) => {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('contract_no')
        .eq('contract_no', contractNo)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      return !!data;
    } catch (error) {
      console.error('Error checking contract number:', error);
      return false;
    }
  };

  const handleSaveAsNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contract_no) {
      dialogService.alert({
        title: 'Missing contract number',
        message: 'Contract number is required.',
        tone: 'warning',
      });
      return;
    }

    setSaving(true);

    try {
      const exists = await checkContractNumberExists(formData.contract_no);
      if (exists) {
        dialogService.alert({
          title: 'Duplicate contract number',
          message: 'This contract number already exists. Please use a different number.',
          tone: 'warning',
        });
        return;
      }

      // Remove the id to ensure a new record is created
      const { id, ...newContractData } = formData;

      const { error } = await supabase
        .from('contracts')
        .insert([newContractData]);

      if (error) {
        throw error;
      }

      dialogService.success('Contract saved.');
      navigate('/app/contracts');
    } catch (error: any) {
      console.error('Error saving contract:', error);
      dialogService.alert({
        title: 'Failed to save contract',
        message: error?.message || 'Please try again.',
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contract_no) {
      dialogService.alert({
        title: 'Missing contract number',
        message: 'Contract number is required.',
        tone: 'warning',
      });
      return;
    }

    setSaving(true);

    try {
      if (formData.id) {
        // Update existing contract
        const { error } = await supabase
          .from('contracts')
          .update(formData)
          .eq('id', formData.id);

        if (error) {
          throw error;
        }
        dialogService.success('Contract updated.');
        navigate('/app/home');
      } else {
        // Create new contract
        const exists = await checkContractNumberExists(formData.contract_no);
        if (exists) {
          dialogService.alert({
            title: 'Duplicate contract number',
            message: 'This contract number already exists. Please use a different number.',
            tone: 'warning',
          });
          return;
        }

        const { error } = await supabase
          .from('contracts')
          .insert([formData]);

        if (error) {
          throw error;
        }
        dialogService.success('Contract saved.');
      }

      navigate('/app/contracts');
    } catch (error: any) {
      console.error('Error saving contract:', error);
      dialogService.alert({
        title: 'Failed to save contract',
        message: error?.message || 'Please try again.',
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialContract?.id) return;

    const ok = await dialogService.confirm({
      title: 'Delete contract?',
      message: 'Are you sure you want to delete this contract? This action cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', initialContract.id);

      if (error) {
        throw error;
      }

      dialogService.success('Contract deleted.');
      navigate('/app/home');
    } catch (error: any) {
      console.error('Error deleting contract:', error);
      dialogService.alert({
        title: 'Failed to delete contract',
        message: error?.message || 'Please try again.',
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  const [signatureEnabled, setSignatureEnabled]       = useState(false);
  const [selectedSignature, setSelectedSignature]     = useState<PickedSignature | null>(null);
  const [showSignaturePicker, setShowSignaturePicker] = useState(false);

  const handleExportPDF = async () => {
    if (!formData.contract_no) {
      dialogService.alert({
        title: 'Save contract first',
        message: 'Please save the contract before generating a PDF.',
        tone: 'warning',
      });
      return;
    }
    setShowExportMenu(false);
    setGeneratingPdf(true);
    try {
      let letterheadImages: { headerBase64: string | null; footerBase64: string | null; headerExt?: string; footerExt?: string } | undefined;
      if (selectedCompany?.header_url || selectedCompany?.footer_url) {
        const imgs = await loadCompanyLetterheadImages(selectedCompany);
        if (imgs.headerBase64 || imgs.footerBase64) letterheadImages = imgs;
      } else if (companyLetterheadUrl) {
        const imgs = await extractLetterheadImages(companyLetterheadUrl);
        if (imgs.headerBase64) letterheadImages = imgs;
      }
      let sigBase64: string | undefined;
      if (signatureEnabled && selectedSignature) {
        const loaded = await urlToBase64(selectedSignature.imageUrl);
        if (loaded) sigBase64 = loaded.base64;
      }
      await generateContractPDF(formData as Contract, showCompanyInPdf, false, letterheadImages, true, undefined, sigBase64);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      dialogService.alert({
        title: 'PDF export failed',
        message: error?.message || 'Failed to generate PDF.',
        tone: 'danger',
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleExportWord = async () => {
    if (!formData.contract_no) {
      dialogService.alert({
        title: 'Save contract first',
        message: 'Please save the contract before exporting the Word document.',
        tone: 'warning',
      });
      return;
    }
    setShowExportMenu(false);
    setGeneratingWord(true);
    try {
      await generateContractWord(formData as Contract, companyLetterheadUrl);
    } catch (error: any) {
      console.error('Error generating Word document:', error);
      dialogService.alert({
        title: 'Word export failed',
        message: error?.message || 'Failed to generate Word document.',
        tone: 'danger',
      });
    } finally {
      setGeneratingWord(false);
    }
  };

  const filteredBuyerContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(buyerSearch.toLowerCase())
  );

  const filteredSupplierContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const inputClassName = roundedInputClass;
  const dropdownClassName = "absolute z-50 mt-1.5 w-full max-w-[520px] max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl";
  const dropdownItemClassName = "cursor-pointer px-3.5 py-2.5 text-[13.5px] text-gray-700 hover:bg-blue-50";

  const renderToggle = (checked: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-blue-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );

  const renderArrayList = (
    field: keyof Contract,
    items: string[] | undefined,
    placeholder: string,
    addLabel: string
  ) => (
    <div className="space-y-1.5">
      {(items || ['']).map((value, index) => (
        <div key={index} className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => handleArrayFieldChange(field, index, e.target.value)}
            className={inputClassName}
            placeholder={placeholder}
          />
          {index > 0 && (
            <button
              type="button"
              onClick={() => removeArrayField(field, index)}
              className="text-gray-400 hover:text-red-600 p-1"
              title="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => addArrayField(field)}
        className="inline-flex items-center gap-1 text-[12px] text-blue-600 hover:text-blue-800 font-medium mt-0.5"
      >
        <Plus className="h-3 w-3" /> {addLabel}
      </button>
    </div>
  );

  return (
    <form onSubmit={handleSave} className="space-y-3 text-gray-900">

      <FSectionCard title="Basic Information" icon={ClipboardList} accent="blue" right={
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500">Show Company in PDF</span>
          {renderToggle(showCompanyInPdf, () => setShowCompanyInPdf(!showCompanyInPdf))}
        </div>
      }>
        <FField label="Company Name" htmlFor="company_name">
          <select id="company_name" value={formData.company_name} onChange={(e) => { const selected = companies.find(c => c.name === e.target.value); setFormData({ ...formData, company_name: e.target.value }); setCompanyLetterheadUrl(selected?.letterhead_url || null); setSelectedCompany(selected || null); }} className={inputClassName}>
            <option value="">Select Company</option>
            {companies.map(company => (<option key={company.id} value={company.name}>{company.name}</option>))}
          </select>
        </FField>
        <FField label="Contract Number" htmlFor="contract_no" required>
          <input type="text" id="contract_no" value={formData.contract_no} onChange={(e) => setFormData({ ...formData, contract_no: e.target.value })} className={inputClassName} required />
        </FField>
        <FField label="Contract Date">
          <DatePicker value={formData.contract_date || ''} onChange={(val) => setFormData({ ...formData, contract_date: val })} />
        </FField>
        <FField label="Buyer's Reference" htmlFor="buyers_reference">
          <input type="text" id="buyers_reference" value={formData.buyers_reference} onChange={(e) => setFormData({ ...formData, buyers_reference: e.target.value })} className={inputClassName} />
        </FField>
        <FField label="Status" htmlFor="status">
          <select id="status" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as typeof STATUS_OPTIONS[number] })} className={`${inputClassName} font-semibold ${STATUS_COLORS[formData.status || 'Issued']}`}>
            {STATUS_OPTIONS.map(status => (<option key={status} value={status}>{status}</option>))}
          </select>
        </FField>
        <FField label="Currency" htmlFor="currency">
          <select id="currency" value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} className={inputClassName}>
            {CURRENCY_OPTIONS.map(currency => (<option key={currency} value={currency}>{currency}</option>))}
          </select>
        </FField>
      </FSectionCard>

      <FSectionCard title="Buyer Information" icon={User} accent="blue">
        <FField label="Buyer Name" htmlFor="buyer_name">
          <div className="relative">
            <input type="text" id="buyer_name" value={buyerSearch} onChange={(e) => setBuyerSearch(e.target.value)} onFocus={() => setShowBuyerDropdown(true)} onBlur={() => setTimeout(() => setShowBuyerDropdown(false), 150)} className={inputClassName} placeholder="Search buyer…" autoComplete="off" />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            {showBuyerDropdown && filteredBuyerContacts.length > 0 && (
              <div className={dropdownClassName}>
                {filteredBuyerContacts.map(contact => (<div key={contact.id} className={dropdownItemClassName} onMouseDown={() => handleContactSelect('buyer', contact.name)}>{contact.name}</div>))}
              </div>
            )}
          </div>
        </FField>
        <FField label="Buyer Address" span="full">
          {renderArrayList('buyer_address', formData.buyer_address, 'Address line', 'Add Address Line')}
        </FField>
      </FSectionCard>

      <FSectionCard title="Supplier Information" icon={Building2} accent="slate">
        <FField label="Supplier Name" htmlFor="supplier_name">
          <div className="relative">
            <input type="text" id="supplier_name" value={supplierSearch} onChange={(e) => setSupplierSearch(e.target.value)} onFocus={() => setShowSupplierDropdown(true)} onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 150)} className={inputClassName} placeholder="Search supplier…" autoComplete="off" />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            {showSupplierDropdown && filteredSupplierContacts.length > 0 && (
              <div className={dropdownClassName}>
                {filteredSupplierContacts.map(contact => (<div key={contact.id} className={dropdownItemClassName} onMouseDown={() => handleContactSelect('supplier', contact.name)}>{contact.name}</div>))}
              </div>
            )}
          </div>
        </FField>
        <FField label="Supplier Address" span="full">
          {renderArrayList('supplier_address', formData.supplier_address, 'Address line', 'Add Address Line')}
        </FField>
      </FSectionCard>

      <FSectionCard title="Product Details" icon={Package} accent="amber">
        <FField label="Article" htmlFor="article">
          <input type="text" id="article" value={formData.article} onChange={(e) => setFormData({ ...formData, article: e.target.value })} className={inputClassName} />
        </FField>
        <FField label="Size" htmlFor="size">
          <input type="text" id="size" value={formData.size} onChange={(e) => setFormData({ ...formData, size: e.target.value })} className={inputClassName} />
        </FField>
        <FField label="Average" htmlFor="average">
          <input type="text" id="average" value={formData.average} onChange={(e) => setFormData({ ...formData, average: e.target.value })} className={inputClassName} />
        </FField>
        <FField label="Substance" htmlFor="substance">
          <input type="text" id="substance" value={formData.substance} onChange={(e) => setFormData({ ...formData, substance: e.target.value })} className={inputClassName} />
        </FField>
        <FField label="Measurement" htmlFor="measurement">
          <input type="text" id="measurement" value={formData.measurement} onChange={(e) => setFormData({ ...formData, measurement: e.target.value })} className={inputClassName} />
        </FField>
        <FField label="Description" htmlFor="description" span="full">
          <textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className={roundedTextareaClass} rows={2} />
        </FField>
      </FSectionCard>

      <FSectionCard title="Product Specifications" icon={LayoutGrid} accent="indigo" noPadding>

      <div className="px-4 sm:px-5 py-3">
        <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_1fr_1fr_28px] gap-2 pb-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide">
          <div>Selection</div><div>Color</div><div>Swatch</div><div>Quantity</div><div>Price</div><div />
        </div>
        {formData.selection?.map((_, index) => (
          <div key={index} className="mb-1.5">
            <div className="md:hidden space-y-1.5 border border-gray-200 rounded-xl p-3 bg-gray-50/50 mb-1">
              <div className="grid grid-cols-2 gap-1.5">
                <input type="text" placeholder="Selection" value={formData.selection?.[index] || ''} onChange={(e) => handleArrayFieldChange('selection', index, e.target.value)} className={inputClassName} />
                <input type="text" placeholder="Color" value={formData.color?.[index] || ''} onChange={(e) => handleArrayFieldChange('color', index, e.target.value)} className={inputClassName} />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <input type="text" placeholder="Swatch" value={formData.swatch?.[index] || ''} onChange={(e) => handleArrayFieldChange('swatch', index, e.target.value)} className={inputClassName} />
                <input type="text" placeholder="Qty" value={formData.quantity?.[index] || ''} onChange={(e) => handleArrayFieldChange('quantity', index, e.target.value)} className={inputClassName} />
                <input type="text" placeholder="Price" value={formData.price?.[index] || ''} onChange={(e) => handleArrayFieldChange('price', index, e.target.value)} className={inputClassName} />
              </div>
              {index > 0 && (
                <button type="button" onClick={() => { removeArrayField('selection', index); removeArrayField('color', index); removeArrayField('swatch', index); removeArrayField('quantity', index); removeArrayField('price', index); }} className="inline-flex items-center text-[11px] font-medium text-red-600 hover:text-red-800">
                  <Trash2 className="h-3 w-3 mr-1" /> Remove Row
                </button>
              )}
            </div>
            <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_1fr_1fr_28px] gap-2 items-center">
              <input type="text" placeholder="Selection" value={formData.selection?.[index] || ''} onChange={(e) => handleArrayFieldChange('selection', index, e.target.value)} className={inputClassName} />
              <input type="text" placeholder="Color" value={formData.color?.[index] || ''} onChange={(e) => handleArrayFieldChange('color', index, e.target.value)} className={inputClassName} />
              <input type="text" placeholder="Swatch" value={formData.swatch?.[index] || ''} onChange={(e) => handleArrayFieldChange('swatch', index, e.target.value)} className={inputClassName} />
              <input type="text" placeholder="Quantity" value={formData.quantity?.[index] || ''} onChange={(e) => handleArrayFieldChange('quantity', index, e.target.value)} className={inputClassName} />
              <input type="text" placeholder="Price" value={formData.price?.[index] || ''} onChange={(e) => handleArrayFieldChange('price', index, e.target.value)} className={inputClassName} />
              {index > 0 ? (
                <button type="button" onClick={() => { removeArrayField('selection', index); removeArrayField('color', index); removeArrayField('swatch', index); removeArrayField('quantity', index); removeArrayField('price', index); }} className="text-gray-400 hover:text-red-600 p-1 justify-self-center" title="Remove row">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : <span />}
            </div>
          </div>
        ))}
        <button type="button" onClick={() => { addArrayField('selection'); addArrayField('color'); addArrayField('swatch'); addArrayField('quantity'); addArrayField('price'); }} className="inline-flex items-center gap-1 text-[12px] text-blue-600 hover:text-blue-800 font-medium mt-1">
          <Plus className="h-3 w-3" /> Add Row
        </button>
      </div>
      </FSectionCard>

      <FSectionCard title="Delivery & Payment" icon={Truck} accent="emerald">
        <FField label="Local Commission" htmlFor="local_commission">
          <input type="text" id="local_commission" value={formData.local_commission} onChange={(e) => setFormData({ ...formData, local_commission: e.target.value })} className={inputClassName} />
        </FField>
        <FField label="Foreign Commission" htmlFor="foreign_commission">
          <input type="text" id="foreign_commission" value={formData.foreign_commission} onChange={(e) => setFormData({ ...formData, foreign_commission: e.target.value })} className={inputClassName} />
        </FField>
        <FField label="Notify Party" htmlFor="notify_party">
          <input type="text" id="notify_party" value={formData.notify_party} onChange={(e) => setFormData({ ...formData, notify_party: e.target.value })} className={inputClassName} />
        </FField>
        <FField label="Bank to Present Documents" htmlFor="bank_documents">
          <input type="text" id="bank_documents" value={formData.bank_documents} onChange={(e) => setFormData({ ...formData, bank_documents: e.target.value })} className={inputClassName} />
        </FField>
        <FField label="Delivery Schedule" span="full">
          {renderArrayList('delivery_schedule', formData.delivery_schedule, 'Schedule line', 'Add Delivery Schedule')}
        </FField>
        <FField label="Destination" span="full">
          {renderArrayList('destination', formData.destination, 'Destination', 'Add Destination')}
        </FField>
        <FField label="Payment Terms" htmlFor="payment_terms" span="full">
          <textarea id="payment_terms" value={formData.payment_terms} onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })} className={roundedTextareaClass} rows={2} />
        </FField>
      </FSectionCard>

      <FSectionCard title="Important Notes" icon={StickyNote} accent="rose">
        <FField label="Notes" span="full">
          {renderArrayList('important_notes', formData.important_notes, 'Important note', 'Add Note')}
        </FField>
      </FSectionCard>

      <FSectionCard title="Attachments" icon={Paperclip} accent="blue">
        <div className="space-y-3">
          {!initialContract?.id ? (
            <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 px-4 py-3 text-sm text-blue-700">
              Save the contract first, then add supporting documents like Purchase Orders or Letters of Credit.
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
                <div>
                  <label className={FIELD_LABEL}>Document Type</label>
                  <select
                    value={attachmentType}
                    onChange={(e) => setAttachmentType(e.target.value)}
                    className={inputClassName}
                  >
                    {ATTACHMENT_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={FIELD_LABEL}>File</label>
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    onChange={handleAttachmentPick}
                    className={inputClassName}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAttachmentUpload}
                  disabled={attachmentUploading || !attachmentFile}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                >
                  <Upload className="h-4 w-4" />
                  {attachmentUploading ? 'Uploading…' : 'Upload'}
                </button>
              </div>

              {attachmentFile && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{attachmentFile.name}</p>
                    <p className="text-xs text-slate-500">
                      {attachmentType || 'Other'} · {(attachmentFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setAttachmentFile(null); if (attachmentInputRef.current) attachmentInputRef.current.value = ''; }}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {contractFiles.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-5 text-sm text-slate-400">
                    No attachments added yet.
                  </div>
                ) : contractFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
                    <button type="button" onClick={() => openAttachment(file)} className="min-w-0 text-left flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 shrink-0">
                          {file.document_type || 'Other'}
                        </span>
                        <p className="text-sm font-semibold text-slate-800 truncate">{file.file_name}</p>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {file.mime_type || 'File'}{file.file_size ? ` · ${(file.file_size / 1024 / 1024).toFixed(2)} MB` : ''}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAttachmentDelete(file)}
                      disabled={attachmentDeleting === file.id}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {attachmentDeleting === file.id ? <div className="h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </FSectionCard>

      <FSectionCard title="Signature" icon={PenLine} accent="indigo">
        <FField label="Signature Image" span="full">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">Stamp a signature image on the PDF export</p>
            <button type="button" onClick={() => { if (signatureEnabled) { setSignatureEnabled(false); setSelectedSignature(null); } else { setShowSignaturePicker(true); } }}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${signatureEnabled ? 'bg-indigo-500' : 'bg-gray-200'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${signatureEnabled ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
          {signatureEnabled && (
            <div className="mt-3">
              {selectedSignature ? (
                <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                  <img src={selectedSignature.imageUrl} alt={selectedSignature.name} className="h-10 object-contain" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{selectedSignature.name}</p>
                    <button type="button" onClick={() => setShowSignaturePicker(true)} className="text-xs text-indigo-600 hover:underline">Change</button>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                </div>
              ) : (
                <button type="button" onClick={() => setShowSignaturePicker(true)}
                  className="w-full py-2.5 text-sm font-semibold text-indigo-600 border border-dashed border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors">
                  Choose Signature →
                </button>
              )}
            </div>
          )}
        </FField>
      </FSectionCard>

      <SignaturePickerModal
        isOpen={showSignaturePicker}
        onClose={() => setShowSignaturePicker(false)}
        onSelect={(sig) => { setSelectedSignature(sig); setSignatureEnabled(true); setShowSignaturePicker(false); }}
      />

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-5 py-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <button type="submit" disabled={saving} className="inline-flex justify-center items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-sm">
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : (initialContract ? 'Update Contract' : 'Save Contract')}
        </button>
        <button type="button" onClick={handleSaveAsNew} disabled={saving} className="inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm disabled:opacity-50">
          <Copy className="h-4 w-4" /> Save as New
        </button>
        <div className="relative flex flex-col">
          {showExportMenu && (
            <div className="fixed inset-0 z-20" onClick={() => setShowExportMenu(false)} />
          )}
          <button
            type="button"
            disabled={saving || generatingPdf || generatingWord}
            onClick={() => setShowExportMenu(v => !v)}
            className="inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm disabled:opacity-50 w-full sm:w-auto"
          >
            <FileDown className="h-4 w-4" />
            {generatingPdf ? 'Generating PDF…' : generatingWord ? 'Generating Word…' : 'Export'}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {showExportMenu && (
            <div className="fixed left-4 right-4 bottom-[calc(84px+env(safe-area-inset-bottom,0px))] z-30 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:absolute sm:bottom-full sm:left-0 sm:right-auto sm:mb-1.5 sm:min-w-[170px] sm:rounded-xl sm:shadow-xl">
              <div className="px-4 py-3 border-b border-gray-100 sm:hidden">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Export Contract</p>
              </div>
              <button type="button" onClick={handleExportPDF} disabled={generatingPdf || generatingWord} className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-blue-50 disabled:opacity-50 sm:py-2.5 sm:font-normal">
                <FileDown className="h-4 w-4 shrink-0" /> Export PDF
              </button>
              <button type="button" onClick={handleExportWord} disabled={generatingPdf || generatingWord} className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-blue-50 disabled:opacity-50 border-t border-gray-100 sm:py-2.5 sm:font-normal">
                <FileDown className="h-4 w-4 shrink-0" /> Export Word
              </button>
            </div>
          )}
        </div>
        {initialContract && (
          <button type="button" onClick={handleDelete} disabled={saving} className="inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 bg-white border border-red-100 hover:bg-red-50 shadow-sm disabled:opacity-50">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        )}
        <button type="button" onClick={() => navigate('/app/contracts')} className="inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm sm:ml-auto">
          Cancel
        </button>
      </div>
    </form>
  );
}
