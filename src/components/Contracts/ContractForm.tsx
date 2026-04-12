import React, { useState, useEffect } from 'react';
import { Save, FileDown, Copy, ChevronDown, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Contact, Contract, Company } from '../../types';
import DatePicker from '../UI/DatePicker';

import { generateContractPDF } from '../../utils/contractPdfGenerator';
import { useNavigate } from 'react-router-dom';

const STATUS_OPTIONS = ['Issued', 'Inspected', 'Completed'] as const;
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
  const [showCompanyInPdf, setShowCompanyInPdf] = useState(true);
  const [includeSignature, setIncludeSignature] = useState(false);
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
      alert('Contract number is required');
      return;
    }

    setSaving(true);

    try {
      const exists = await checkContractNumberExists(formData.contract_no);
      if (exists) {
        alert('Contract number already exists. Please use a different number.');
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

      alert('Contract saved successfully!');
      navigate('/app/contracts');
    } catch (error) {
      console.error('Error saving contract:', error);
      alert('Failed to save contract. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contract_no) {
      alert('Contract number is required');
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
        alert('Contract updated successfully!');
        navigate('/app/home');
      } else {
        // Create new contract
        const exists = await checkContractNumberExists(formData.contract_no);
        if (exists) {
          alert('Contract number already exists. Please use a different number.');
          return;
        }

        const { error } = await supabase
          .from('contracts')
          .insert([formData]);

        if (error) {
          throw error;
        }
        alert('Contract saved successfully!');
      }
      
      navigate('/app/contracts');
    } catch (error) {
      console.error('Error saving contract:', error);
      alert('Failed to save contract. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialContract?.id) return;
    
    if (!confirm('Are you sure you want to delete this contract? This action cannot be undone.')) {
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', initialContract.id);

      if (error) {
        throw error;
      }

      alert('Contract deleted successfully!');
      navigate('/app/home');
    } catch (error) {
      console.error('Error deleting contract:', error);
      alert('Failed to delete contract. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = async () => {
    if (!formData.contract_no) {
      alert('Please save the contract first before generating PDF');
      return;
    }

    setGeneratingPdf(true);
    try {
      await generateContractPDF(formData as Contract, showCompanyInPdf, includeSignature);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const filteredBuyerContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(buyerSearch.toLowerCase())
  );

  const filteredSupplierContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const inputClassName = "mt-1 block w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
  const labelClassName = "block text-xs font-medium text-gray-700";
  const dropdownClassName = "absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-blue-200 bg-white shadow-lg shadow-blue-100";
  const dropdownItemClassName = "cursor-pointer px-3 py-2 text-sm text-gray-700 hover:bg-blue-50";

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="company_name" className={labelClassName}>Company Name</label>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-600 uppercase font-bold">Show in PDF</span>
              <button
                type="button"
                onClick={() => setShowCompanyInPdf(!showCompanyInPdf)}
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  showCompanyInPdf ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showCompanyInPdf ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
          <select
            id="company_name"
            value={formData.company_name}
            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
            className={inputClassName}
          >
            <option value="">Select Company</option>
            {companies.map(company => (
              <option key={company.id} value={company.name}>{company.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="status" className={labelClassName}>Status</label>
          <select
            id="status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as typeof STATUS_OPTIONS[number] })}
            className={inputClassName}
          >
            {STATUS_OPTIONS.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="contract_no" className={labelClassName}>Contract Number *</label>
          <input
            type="text"
            id="contract_no"
            value={formData.contract_no}
            onChange={(e) => setFormData({ ...formData, contract_no: e.target.value })}
            className={inputClassName}
            required
          />
        </div>

        <div>
          <DatePicker
            label="Contract Date"
            value={formData.contract_date || ''}
            onChange={(val) => setFormData({ ...formData, contract_date: val })}
          />
        </div>

        <div>
          <label htmlFor="buyers_reference" className={labelClassName}>Buyer's Reference</label>
          <input
            type="text"
            id="buyers_reference"
            value={formData.buyers_reference}
            onChange={(e) => setFormData({ ...formData, buyers_reference: e.target.value })}
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="currency" className={labelClassName}>Currency</label>
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
        </div>
      </div>

      {/* Buyer Information */}
      <div className="space-y-3">
        <div className="relative">
          <label htmlFor="buyer_name" className={labelClassName}>Buyer Name</label>
          <div className="relative">
            <input
              type="text"
              value={buyerSearch}
              onChange={(e) => setBuyerSearch(e.target.value)}
              onFocus={() => setShowBuyerDropdown(true)}
              className={inputClassName}
              placeholder="Search buyer..."
            />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>
          {showBuyerDropdown && (
            <div className={dropdownClassName}>
              {filteredBuyerContacts.map(contact => (
                <div
                  key={contact.id}
                  className={dropdownItemClassName}
                  onClick={() => handleContactSelect('buyer', contact.name)}
                >
                  {contact.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className={labelClassName}>Buyer Address</label>
          {formData.buyer_address?.map((address, index) => (
            <div key={index} className="flex gap-2 mt-1.5">
              <input
                type="text"
                value={address}
                onChange={(e) => handleArrayFieldChange('buyer_address', index, e.target.value)}
                className={inputClassName}
              />
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => removeArrayField('buyer_address', index)}
                  className="text-red-500 hover:text-red-700 p-2"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => addArrayField('buyer_address')}
            className="mt-1.5 text-blue-600 hover:text-blue-800 text-xs font-medium"
          >
            Add Address Line
          </button>
        </div>
      </div>

      {/* Supplier Information */}
      <div className="space-y-3">
        <div className="relative">
          <label htmlFor="supplier_name" className={labelClassName}>Supplier Name</label>
          <div className="relative">
            <input
              type="text"
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              onFocus={() => setShowSupplierDropdown(true)}
              className={inputClassName}
              placeholder="Search supplier..."
            />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>
          {showSupplierDropdown && (
            <div className={dropdownClassName}>
              {filteredSupplierContacts.map(contact => (
                <div
                  key={contact.id}
                  className={dropdownItemClassName}
                  onClick={() => handleContactSelect('supplier', contact.name)}
                >
                  {contact.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className={labelClassName}>Supplier Address</label>
          {formData.supplier_address?.map((address, index) => (
            <div key={index} className="flex gap-2 mt-1.5">
              <input
                type="text"
                value={address}
                onChange={(e) => handleArrayFieldChange('supplier_address', index, e.target.value)}
                className={inputClassName}
              />
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => removeArrayField('supplier_address', index)}
                  className="text-red-500 hover:text-red-700 p-2"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => addArrayField('supplier_address')}
            className="mt-1.5 text-blue-600 hover:text-blue-800 text-xs font-medium"
          >
            Add Address Line
          </button>
        </div>
      </div>

      {/* Product Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label htmlFor="description" className={labelClassName}>Description</label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className={`${inputClassName} h-16`}
            rows={2}
          />
        </div>

        <div>
          <label htmlFor="article" className={labelClassName}>Article</label>
          <input
            type="text"
            id="article"
            value={formData.article}
            onChange={(e) => setFormData({ ...formData, article: e.target.value })}
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="size" className={labelClassName}>Size</label>
          <input
            type="text"
            id="size"
            value={formData.size}
            onChange={(e) => setFormData({ ...formData, size: e.target.value })}
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="average" className={labelClassName}>Average</label>
          <input
            type="text"
            id="average"
            value={formData.average}
            onChange={(e) => setFormData({ ...formData, average: e.target.value })}
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="substance" className={labelClassName}>Substance</label>
          <input
            type="text"
            id="substance"
            value={formData.substance}
            onChange={(e) => setFormData({ ...formData, substance: e.target.value })}
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="measurement" className={labelClassName}>Measurement</label>
          <input
            type="text"
            id="measurement"
            value={formData.measurement}
            onChange={(e) => setFormData({ ...formData, measurement: e.target.value })}
            className={inputClassName}
          />
        </div>
      </div>

      {/* Selection, Color, Swatch, Quantity, Price Table */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-2">Product Specifications</h3>
        <div className="space-y-2">
          {formData.selection?.map((_, index) => (
            <div key={index} className="border border-blue-100 rounded-xl p-3 bg-blue-50/30 shadow-sm">
              {/* Mobile: Vertical layout */}
              <div className="md:hidden space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">Selection</label>
                    <input
                      type="text"
                      placeholder="Selection"
                      value={formData.selection?.[index] || ''}
                      onChange={(e) => handleArrayFieldChange('selection', index, e.target.value)}
                      className={`${inputClassName} w-full`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">Color</label>
                    <input
                      type="text"
                      placeholder="Color"
                      value={formData.color?.[index] || ''}
                      onChange={(e) => handleArrayFieldChange('color', index, e.target.value)}
                      className={`${inputClassName} w-full`}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">Swatch</label>
                    <input
                      type="text"
                      placeholder="Swatch"
                      value={formData.swatch?.[index] || ''}
                      onChange={(e) => handleArrayFieldChange('swatch', index, e.target.value)}
                      className={`${inputClassName} w-full`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">Qty</label>
                    <input
                      type="text"
                      placeholder="Qty"
                      value={formData.quantity?.[index] || ''}
                      onChange={(e) => handleArrayFieldChange('quantity', index, e.target.value)}
                      className={`${inputClassName} w-full`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">Price</label>
                    <input
                      type="text"
                      placeholder="Price"
                      value={formData.price?.[index] || ''}
                      onChange={(e) => handleArrayFieldChange('price', index, e.target.value)}
                      className={`${inputClassName} w-full`}
                    />
                  </div>
                </div>
                {index > 0 && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        removeArrayField('selection', index);
                        removeArrayField('color', index);
                        removeArrayField('swatch', index);
                        removeArrayField('quantity', index);
                        removeArrayField('price', index);
                      }}
                      className="inline-flex items-center px-2 py-1 border border-red-300 text-[10px] font-bold uppercase rounded-md text-red-700 bg-white hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Remove Row
                    </button>
                  </div>
                )}
              </div>

              {/* Desktop: Horizontal layout */}
              <div className="hidden md:flex gap-2">
                <div className="grid grid-cols-5 gap-2 flex-1">
                  <input
                    type="text"
                    placeholder="Selection"
                    value={formData.selection?.[index] || ''}
                    onChange={(e) => handleArrayFieldChange('selection', index, e.target.value)}
                    className={inputClassName}
                  />
                  <input
                    type="text"
                    placeholder="Color"
                    value={formData.color?.[index] || ''}
                    onChange={(e) => handleArrayFieldChange('color', index, e.target.value)}
                    className={inputClassName}
                  />
                  <input
                    type="text"
                    placeholder="Swatch"
                    value={formData.swatch?.[index] || ''}
                    onChange={(e) => handleArrayFieldChange('swatch', index, e.target.value)}
                    className={inputClassName}
                  />
                  <input
                    type="text"
                    placeholder="Quantity"
                    value={formData.quantity?.[index] || ''}
                    onChange={(e) => handleArrayFieldChange('quantity', index, e.target.value)}
                    className={inputClassName}
                  />
                  <input
                    type="text"
                    placeholder="Price"
                    value={formData.price?.[index] || ''}
                    onChange={(e) => handleArrayFieldChange('price', index, e.target.value)}
                    className={inputClassName}
                  />
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
                    className="text-red-500 hover:text-red-700 self-center"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
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
            className="text-blue-600 hover:text-blue-800 text-xs font-bold"
          >
            + Add Row
          </button>
        </div>
      </div>

      {/* Delivery and Payment */}
      <div className="space-y-3">
        <div>
          <label className={labelClassName}>Delivery Schedule</label>
          {formData.delivery_schedule?.map((schedule, index) => (
            <div key={index} className="flex gap-2 mt-1.5">
              <input
                type="text"
                value={schedule}
                onChange={(e) => handleArrayFieldChange('delivery_schedule', index, e.target.value)}
                className={inputClassName}
              />
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => removeArrayField('delivery_schedule', index)}
                  className="text-red-500 hover:text-red-700 p-2"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => addArrayField('delivery_schedule')}
            className="mt-1.5 text-blue-600 hover:text-blue-800 text-xs font-bold"
          >
            + Add Delivery Schedule
          </button>
        </div>

        <div>
          <label className={labelClassName}>Destination</label>
          {formData.destination?.map((dest, index) => (
            <div key={index} className="flex gap-2 mt-1.5">
              <input
                type="text"
                value={dest}
                onChange={(e) => handleArrayFieldChange('destination', index, e.target.value)}
                className={inputClassName}
              />
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => removeArrayField('destination', index)}
                  className="text-red-500 hover:text-red-700 p-2"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => addArrayField('destination')}
            className="mt-1.5 text-blue-600 hover:text-blue-800 text-xs font-bold"
          >
            + Add Destination
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="local_commission" className={labelClassName}>Local Commission</label>
            <input
              type="text"
              id="local_commission"
              value={formData.local_commission}
              onChange={(e) => setFormData({ ...formData, local_commission: e.target.value })}
              className={inputClassName}
            />
          </div>

          <div>
            <label htmlFor="foreign_commission" className={labelClassName}>Foreign Commission</label>
            <input
              type="text"
              id="foreign_commission"
              value={formData.foreign_commission}
              onChange={(e) => setFormData({ ...formData, foreign_commission: e.target.value })}
              className={inputClassName}
            />
          </div>
        </div>

        <div>
          <label htmlFor="payment_terms" className={labelClassName}>Payment Terms</label>
          <textarea
            id="payment_terms"
            value={formData.payment_terms}
            onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
            className={`${inputClassName} h-16`}
            rows={2}
          />
        </div>

        <div>
          <label htmlFor="notify_party" className={labelClassName}>Notify Party</label>
          <input
            type="text"
            id="notify_party"
            value={formData.notify_party}
            onChange={(e) => setFormData({ ...formData, notify_party: e.target.value })}
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="bank_documents" className={labelClassName}>Bank to Present Documents</label>
          <input
            type="text"
            id="bank_documents"
            value={formData.bank_documents}
            onChange={(e) => setFormData({ ...formData, bank_documents: e.target.value })}
            className={inputClassName}
          />
        </div>
      </div>

      {/* Important Notes */}
      <div>
        <label className={labelClassName}>Important Notes</label>
          {formData.important_notes?.map((note, index) => (
            <div key={index} className="flex gap-2 mt-1.5">
              <input
                type="text"
                value={note}
                onChange={(e) => handleArrayFieldChange('important_notes', index, e.target.value)}
                className={inputClassName}
              />
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => removeArrayField('important_notes', index)}
                  className="text-red-500 hover:text-red-700 p-2"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => addArrayField('important_notes')}
            className="mt-1.5 text-blue-600 hover:text-blue-800 text-xs font-bold"
          >
            + Add Note
          </button>
      </div>

      {/* Signature Toggle */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <label className={labelClassName}>Add Signature to PDF</label>
        <button
          type="button"
          onClick={() => setIncludeSignature(!includeSignature)}
          className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            includeSignature ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              includeSignature ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Form Actions */}
      <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-3 border-t border-gray-100">
        {initialContract && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="inline-flex items-center justify-center px-3 py-2 border border-red-300 shadow-sm text-xs font-bold uppercase rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 w-full sm:w-auto"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete
          </button>
        )}
        <button
          type="button"
          onClick={handleExportPDF}
          disabled={saving || generatingPdf}
          className="inline-flex items-center justify-center px-3 py-2 border border-blue-200 shadow-sm text-xs font-bold uppercase text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 w-full sm:w-auto"
        >
          <FileDown className="h-3.5 w-3.5 mr-1.5" />
          {generatingPdf ? 'Generating...' : 'Export PDF'}
        </button>
        <button
          type="button"
          onClick={handleSaveAsNew}
          disabled={saving}
          className="inline-flex items-center justify-center px-3 py-2 border border-blue-200 shadow-sm text-xs font-bold uppercase text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 w-full sm:w-auto"
        >
          <Copy className="h-3.5 w-3.5 mr-1.5" />
          Save as New
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center px-3 py-2 border border-transparent shadow-sm text-xs font-bold uppercase rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 w-full sm:w-auto"
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {saving ? 'Saving...' : (initialContract ? 'Update' : 'Save')}
        </button>
      </div>
    </form>
  );
}