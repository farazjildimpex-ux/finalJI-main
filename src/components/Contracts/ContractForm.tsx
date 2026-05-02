import React, { useState, useEffect, useRef } from 'react';
import { Save, FileDown, Copy, ChevronDown, Trash2, X, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Contact, Contract, Company } from '../../types';
import DatePicker from '../UI/DatePicker';
import FormRow, { FormSection, formInputClass } from '../UI/FormRow';

import { generateContractPDF } from '../../utils/contractPdfGenerator';
import { generateContractWord, extractLetterheadImages } from '../../utils/contractWordGenerator';
import { useNavigate } from 'react-router-dom';
import { dialogService } from '../../lib/dialogService';

const STATUS_OPTIONS = ['Issued', 'Inspected', 'Completed', 'Cancelled'] as const;
const STATUS_COLORS: Record<string, string> = {
  Issued:    'bg-blue-50 text-blue-900 border-blue-300',
  Inspected: 'bg-amber-50 text-amber-900 border-amber-300',
  Completed: 'bg-emerald-50 text-emerald-900 border-emerald-300',
  Cancelled: 'bg-red-50 text-red-900 border-red-300',
};
const CURRENCY_OPTIONS = ['Euro', 'USD', 'INR'] as const;

interface ContractFormProps {
  initialContract?: Contract | null;
}

export default function ContractForm({ initialContract }: ContractFormProps) {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
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
  const exportMenuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    }
  }, [initialContract, companies]);

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
      if (companyLetterheadUrl) {
        const imgs = await extractLetterheadImages(companyLetterheadUrl);
        if (imgs.headerBase64) letterheadImages = imgs;
      }
      await generateContractPDF(formData as Contract, showCompanyInPdf, false, letterheadImages);
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

  const inputClassName = formInputClass;
  const dropdownClassName = "absolute z-50 mt-1 w-full max-w-xl max-h-60 overflow-y-auto rounded-md border border-gray-300 bg-white shadow-lg";
  const dropdownItemClassName = "cursor-pointer px-3 py-2 text-sm text-gray-700 hover:bg-blue-50";

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
    <div className="space-y-2">
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
              className="text-gray-400 hover:text-red-600 p-1.5"
              title="Remove"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => addArrayField(field)}
        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
      >
        <Plus className="h-3 w-3" /> {addLabel}
      </button>
    </div>
  );

  return (
    <form onSubmit={handleSave} className="space-y-4 text-gray-900">
      {/* Basic Information */}
      <FormSection
        title="Basic Information"
        right={
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">Show Company in PDF</span>
            {renderToggle(showCompanyInPdf, () => setShowCompanyInPdf(!showCompanyInPdf))}
          </div>
        }
      >
        <FormRow label="Company Name" htmlFor="company_name" alt>
          <select
            id="company_name"
            value={formData.company_name}
            onChange={(e) => {
              const selected = companies.find(c => c.name === e.target.value);
              setFormData({ ...formData, company_name: e.target.value });
              setCompanyLetterheadUrl(selected?.letterhead_url || null);
            }}
            className={inputClassName}
          >
            <option value="">Select Company</option>
            {companies.map(company => (
              <option key={company.id} value={company.name}>{company.name}</option>
            ))}
          </select>
        </FormRow>

        <FormRow label="Contract Number" htmlFor="contract_no" required>
          <input
            type="text"
            id="contract_no"
            value={formData.contract_no}
            onChange={(e) => setFormData({ ...formData, contract_no: e.target.value })}
            className={inputClassName}
            required
          />
        </FormRow>

        <FormRow label="Contract Date">
          <DatePicker
            value={formData.contract_date || ''}
            onChange={(val) => setFormData({ ...formData, contract_date: val })}
          />
        </FormRow>

        <FormRow label="Buyer's Reference" htmlFor="buyers_reference">
          <input
            type="text"
            id="buyers_reference"
            value={formData.buyers_reference}
            onChange={(e) => setFormData({ ...formData, buyers_reference: e.target.value })}
            className={inputClassName}
          />
        </FormRow>

        <FormRow label="Status" htmlFor="status">
          <select
            id="status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as typeof STATUS_OPTIONS[number] })}
            className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors font-semibold ${STATUS_COLORS[formData.status || 'Issued'] || inputClassName}`}
          >
            {STATUS_OPTIONS.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </FormRow>

        <FormRow label="Currency" htmlFor="currency">
          <select
            id="currency"
            value={formData.currency}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
            className={inputClassName}
          >
            {CURRENCY_OPTIONS.map(currency => (
              <option key={currency} value={currency}>{currency}</option>
            ))}
          </select>
        </FormRow>
      </FormSection>

      {/* Buyer Information */}
      <FormSection title="Buyer Information">
        <FormRow label="Buyer Name" htmlFor="buyer_name">
          <div className="relative">
            <input
              type="text"
              id="buyer_name"
              value={buyerSearch}
              onChange={(e) => setBuyerSearch(e.target.value)}
              onFocus={() => setShowBuyerDropdown(true)}
              onBlur={() => setTimeout(() => setShowBuyerDropdown(false), 150)}
              className={inputClassName}
              placeholder="Search buyer..."
              autoComplete="off"
            />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            {showBuyerDropdown && filteredBuyerContacts.length > 0 && (
              <div className={dropdownClassName}>
                {filteredBuyerContacts.map(contact => (
                  <div
                    key={contact.id}
                    className={dropdownItemClassName}
                    onMouseDown={() => handleContactSelect('buyer', contact.name)}
                  >
                    {contact.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </FormRow>

        <FormRow label="Buyer Address">
          {renderArrayList('buyer_address', formData.buyer_address, 'Address line', 'Add Address Line')}
        </FormRow>
      </FormSection>

      {/* Supplier Information */}
      <FormSection title="Supplier Information">
        <FormRow label="Supplier Name" htmlFor="supplier_name">
          <div className="relative">
            <input
              type="text"
              id="supplier_name"
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              onFocus={() => setShowSupplierDropdown(true)}
              onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 150)}
              className={inputClassName}
              placeholder="Search supplier..."
              autoComplete="off"
            />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            {showSupplierDropdown && filteredSupplierContacts.length > 0 && (
              <div className={dropdownClassName}>
                {filteredSupplierContacts.map(contact => (
                  <div
                    key={contact.id}
                    className={dropdownItemClassName}
                    onMouseDown={() => handleContactSelect('supplier', contact.name)}
                  >
                    {contact.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </FormRow>

        <FormRow label="Supplier Address">
          {renderArrayList('supplier_address', formData.supplier_address, 'Address line', 'Add Address Line')}
        </FormRow>
      </FormSection>

      {/* Product Details */}
      <FormSection title="Product Details">
        <FormRow label="Description" htmlFor="description">
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className={`${inputClassName} resize-y`}
            rows={2}
          />
        </FormRow>
        <FormRow label="Article" htmlFor="article">
          <input
            type="text"
            id="article"
            value={formData.article}
            onChange={(e) => setFormData({ ...formData, article: e.target.value })}
            className={inputClassName}
          />
        </FormRow>
        <FormRow label="Size" htmlFor="size">
          <input
            type="text"
            id="size"
            value={formData.size}
            onChange={(e) => setFormData({ ...formData, size: e.target.value })}
            className={inputClassName}
          />
        </FormRow>
        <FormRow label="Average" htmlFor="average">
          <input
            type="text"
            id="average"
            value={formData.average}
            onChange={(e) => setFormData({ ...formData, average: e.target.value })}
            className={inputClassName}
          />
        </FormRow>
        <FormRow label="Substance" htmlFor="substance">
          <input
            type="text"
            id="substance"
            value={formData.substance}
            onChange={(e) => setFormData({ ...formData, substance: e.target.value })}
            className={inputClassName}
          />
        </FormRow>
        <FormRow label="Measurement" htmlFor="measurement">
          <input
            type="text"
            id="measurement"
            value={formData.measurement}
            onChange={(e) => setFormData({ ...formData, measurement: e.target.value })}
            className={inputClassName}
          />
        </FormRow>
      </FormSection>

      {/* Product Specifications Table */}
      <FormSection title="Product Specifications">
        <div className="px-4 sm:px-6 py-4 space-y-2">
          {/* Header row (desktop only) */}
          <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_1fr_1fr_32px] gap-2 px-1 pb-1 text-[10px] font-bold text-gray-500 uppercase tracking-wide">
            <div>Selection</div>
            <div>Color</div>
            <div>Swatch</div>
            <div>Quantity</div>
            <div>Price</div>
            <div></div>
          </div>
          {formData.selection?.map((_, index) => (
            <div key={index} className="border border-gray-200 rounded-md p-2 bg-gray-50/40 md:bg-transparent md:border-0 md:p-0">
              {/* Mobile */}
              <div className="md:hidden space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Selection" value={formData.selection?.[index] || ''} onChange={(e) => handleArrayFieldChange('selection', index, e.target.value)} className={inputClassName} />
                  <input type="text" placeholder="Color" value={formData.color?.[index] || ''} onChange={(e) => handleArrayFieldChange('color', index, e.target.value)} className={inputClassName} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input type="text" placeholder="Swatch" value={formData.swatch?.[index] || ''} onChange={(e) => handleArrayFieldChange('swatch', index, e.target.value)} className={inputClassName} />
                  <input type="text" placeholder="Qty" value={formData.quantity?.[index] || ''} onChange={(e) => handleArrayFieldChange('quantity', index, e.target.value)} className={inputClassName} />
                  <input type="text" placeholder="Price" value={formData.price?.[index] || ''} onChange={(e) => handleArrayFieldChange('price', index, e.target.value)} className={inputClassName} />
                </div>
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      removeArrayField('selection', index);
                      removeArrayField('color', index);
                      removeArrayField('swatch', index);
                      removeArrayField('quantity', index);
                      removeArrayField('price', index);
                    }}
                    className="inline-flex items-center px-2 py-1 text-[10px] font-bold uppercase rounded text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Remove Row
                  </button>
                )}
              </div>
              {/* Desktop */}
              <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_1fr_1fr_32px] gap-2 items-center">
                <input type="text" placeholder="Selection" value={formData.selection?.[index] || ''} onChange={(e) => handleArrayFieldChange('selection', index, e.target.value)} className={inputClassName} />
                <input type="text" placeholder="Color" value={formData.color?.[index] || ''} onChange={(e) => handleArrayFieldChange('color', index, e.target.value)} className={inputClassName} />
                <input type="text" placeholder="Swatch" value={formData.swatch?.[index] || ''} onChange={(e) => handleArrayFieldChange('swatch', index, e.target.value)} className={inputClassName} />
                <input type="text" placeholder="Quantity" value={formData.quantity?.[index] || ''} onChange={(e) => handleArrayFieldChange('quantity', index, e.target.value)} className={inputClassName} />
                <input type="text" placeholder="Price" value={formData.price?.[index] || ''} onChange={(e) => handleArrayFieldChange('price', index, e.target.value)} className={inputClassName} />
                {index > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      removeArrayField('selection', index);
                      removeArrayField('color', index);
                      removeArrayField('swatch', index);
                      removeArrayField('quantity', index);
                      removeArrayField('price', index);
                    }}
                    className="text-gray-400 hover:text-red-600 p-1 justify-self-center"
                    title="Remove row"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : <span />}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              addArrayField('selection');
              addArrayField('color');
              addArrayField('swatch');
              addArrayField('quantity');
              addArrayField('price');
            }}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium mt-1"
          >
            <Plus className="h-3 w-3" /> Add Row
          </button>
        </div>
      </FormSection>

      {/* Delivery & Payment */}
      <FormSection title="Delivery & Payment">
        <FormRow label="Delivery Schedule">
          {renderArrayList('delivery_schedule', formData.delivery_schedule, 'Schedule line', 'Add Delivery Schedule')}
        </FormRow>
        <FormRow label="Destination">
          {renderArrayList('destination', formData.destination, 'Destination', 'Add Destination')}
        </FormRow>
        <FormRow label="Local Commission" htmlFor="local_commission">
          <input
            type="text"
            id="local_commission"
            value={formData.local_commission}
            onChange={(e) => setFormData({ ...formData, local_commission: e.target.value })}
            className={inputClassName}
          />
        </FormRow>
        <FormRow label="Foreign Commission" htmlFor="foreign_commission">
          <input
            type="text"
            id="foreign_commission"
            value={formData.foreign_commission}
            onChange={(e) => setFormData({ ...formData, foreign_commission: e.target.value })}
            className={inputClassName}
          />
        </FormRow>
        <FormRow label="Payment Terms" htmlFor="payment_terms">
          <textarea
            id="payment_terms"
            value={formData.payment_terms}
            onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
            className={`${inputClassName} resize-y`}
            rows={2}
          />
        </FormRow>
        <FormRow label="Notify Party" htmlFor="notify_party">
          <input
            type="text"
            id="notify_party"
            value={formData.notify_party}
            onChange={(e) => setFormData({ ...formData, notify_party: e.target.value })}
            className={inputClassName}
          />
        </FormRow>
        <FormRow label="Bank to Present Documents" htmlFor="bank_documents">
          <input
            type="text"
            id="bank_documents"
            value={formData.bank_documents}
            onChange={(e) => setFormData({ ...formData, bank_documents: e.target.value })}
            className={inputClassName}
          />
        </FormRow>
      </FormSection>

      {/* Important Notes */}
      <FormSection title="Important Notes">
        <div className="px-4 sm:px-6 py-3">
          {renderArrayList('important_notes', formData.important_notes, 'Important note', 'Add Note')}
        </div>
      </FormSection>

      {/* Form Actions */}
      <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-2">
        {initialContract && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="inline-flex items-center justify-center px-4 py-2 border border-red-300 text-xs font-bold uppercase rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50 w-full sm:w-auto"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete
          </button>
        )}
        <div
          className="relative w-full sm:w-auto"
          onMouseEnter={() => {
            if (exportMenuTimeoutRef.current) clearTimeout(exportMenuTimeoutRef.current);
            setShowExportMenu(true);
          }}
          onMouseLeave={() => {
            exportMenuTimeoutRef.current = setTimeout(() => setShowExportMenu(false), 200);
          }}
        >
          <button
            type="button"
            disabled={saving || generatingPdf || generatingWord}
            className="inline-flex items-center justify-center w-full px-4 py-2 border border-blue-200 text-xs font-bold uppercase text-blue-700 bg-white hover:bg-blue-50 disabled:opacity-50 rounded-md"
          >
            <FileDown className="h-3.5 w-3.5 mr-1.5" />
            {generatingPdf ? 'Generating PDF...' : generatingWord ? 'Generating Word...' : 'Export'}
            <ChevronDown className="h-3 w-3 ml-1.5" />
          </button>
          {showExportMenu && (
            <div className="absolute bottom-full mb-1 right-0 z-30 min-w-[140px] overflow-hidden rounded-md border border-gray-200 bg-white shadow-xl">
              <button
                type="button"
                onClick={handleExportPDF}
                disabled={generatingPdf || generatingWord}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
              >
                <FileDown className="h-4 w-4 shrink-0" />
                Export PDF
              </button>
              <button
                type="button"
                onClick={handleExportWord}
                disabled={generatingPdf || generatingWord}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 border-t border-gray-100"
              >
                <FileDown className="h-4 w-4 shrink-0" />
                Export Word
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleSaveAsNew}
          disabled={saving}
          className="inline-flex items-center justify-center px-4 py-2 border border-blue-200 text-xs font-bold uppercase text-blue-700 bg-white hover:bg-blue-50 disabled:opacity-50 rounded-md w-full sm:w-auto"
        >
          <Copy className="h-3.5 w-3.5 mr-1.5" />
          Save as New
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-xs font-bold uppercase rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 w-full sm:w-auto"
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {saving ? 'Saving...' : (initialContract ? 'Update' : 'Save')}
        </button>
      </div>
    </form>
  );
}