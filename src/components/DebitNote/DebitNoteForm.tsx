import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Save, FileDown, Trash2, ChevronDown, X, Search, Plus, Minus, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { DebitNote, Contact, Contract, Company } from '../../types';
import { generateDebitNotePDF } from '../../utils/debitNotePdfGenerator';
import { generateDebitNoteWord } from '../../utils/debitNoteWordGenerator';
import { extractLetterheadImages } from '../../utils/contractWordGenerator';
import { useAuth } from '../../hooks/useAuth';
import DatePicker from '../UI/DatePicker';

const STATUS_OPTIONS = ['Issued', 'Completed'] as const;

interface DebitNoteFormProps {
  initialData?: DebitNote | null;
}

interface ContractSelection {
  id: string;
  contract_no: string;
  contract_date?: string;
  buyer_name: string;
  supplier_name: string;
  destination: string[];
  local_commission: string;
  currency: string;
  company_name: string;
}

// Function to convert number to words using Indian numbering system (thousands, lakhs, crores)
const numberToWords = (num: number): string => {
  if (num === 0) return 'Zero Rupees Only';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertHundreds = (n: number): string => {
    let result = '';
    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      result += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    } else if (n >= 10) {
      result += teens[n - 10] + ' ';
      return result;
    }
    if (n > 0) {
      result += ones[n] + ' ';
    }
    return result;
  };

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  let result = '';
  let tempRupees = rupees;
  
  if (tempRupees >= 10000000) {
    const crores = Math.floor(tempRupees / 10000000);
    result += convertHundreds(crores).trim() + ' Crore ';
    tempRupees %= 10000000;
  }
  if (tempRupees >= 100000) {
    const lakhs = Math.floor(tempRupees / 100000);
    result += convertHundreds(lakhs).trim() + ' Lakh ';
    tempRupees %= 100000;
  }
  if (tempRupees >= 1000) {
    const thousands = Math.floor(tempRupees / 1000);
    result += convertHundreds(thousands).trim() + ' Thousand ';
    tempRupees %= 1000;
  }
  if (tempRupees > 0) {
    result += convertHundreds(tempRupees);
  }
  let finalResult = '';
  if (rupees > 0) {
    finalResult = result.trim() + ' Rupees';
  }
  if (paise > 0) {
    if (rupees > 0) {
      finalResult += ' and ';
    }
    finalResult += convertHundreds(paise).trim() + ' Paise';
  }
  if (finalResult === '') {
    finalResult = 'Zero Rupees';
  }
  return finalResult + ' Only';
};

const DebitNoteForm: React.FC<DebitNoteFormProps> = ({ initialData }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [contractSearches, setContractSearches] = useState<string[]>(['']);
  const [selectedContracts, setSelectedContracts] = useState<ContractSelection[]>([]);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [showContractDropdowns, setShowContractDropdowns] = useState<boolean[]>([false]);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showCompanyInPdf, setShowCompanyInPdf] = useState(true);
  const [includeSignature, setIncludeSignature] = useState(false);
  const [generatingWord, setGeneratingWord] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [companyLetterheadUrl, setCompanyLetterheadUrl] = useState<string | null>(null);
  const exportMenuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [formData, setFormData] = useState<DebitNote>({
    debit_note_no: '',
    debit_note_date: new Date().toISOString().split('T')[0],
    status: 'Issued',
    supplier_name: '',
    supplier_address: [''],
    contract_no: '',
    contract_date: '',
    buyer_name: '',
    invoice_no: '',
    invoice_date: '',
    quantity: '',
    pieces: '',
    destination: '',
    local_commission: '',
    invoice_value: '',
    commissioning: 0,
    exchange_rate: 0,
    commission_in_rupees: 0,
    commission_in_words: '',
    currency: 'USD',
    company: '',
  });

  useEffect(() => {
    fetchContacts();
    fetchContracts();
    fetchCompanies();
    
    if (location.state?.prefilledContractNo) {
      setContractSearches([location.state.prefilledContractNo]);
      setFormData(prev => ({
        ...prev,
        contract_no: location.state.prefilledContractNo
      }));
    }
    
    if (initialData) {
      setFormData(initialData);
      setSupplierSearch(initialData.supplier_name);
      const contractNumbers = initialData.contract_no.split(',').map(c => c.trim());
      setContractSearches(contractNumbers);
      setShowContractDropdowns(new Array(contractNumbers.length).fill(false));
      
      const reconstructedContracts: ContractSelection[] = contractNumbers.map(contractNo => ({
        id: '',
        contract_no: contractNo,
        contract_date: initialData.contract_date,
        buyer_name: initialData.buyer_name,
        supplier_name: initialData.supplier_name,
        destination: [initialData.destination],
        local_commission: initialData.local_commission,
        currency: initialData.currency,
        company_name: initialData.company
      }));
      setSelectedContracts(reconstructedContracts);
    }
  }, [initialData, location.state]);

  useEffect(() => {
    if (initialData?.company && companies.length > 0) {
      const co = companies.find(c => c.name === initialData.company);
      setCompanyLetterheadUrl(co?.letterhead_url || null);
    }
  }, [initialData, companies]);

  useEffect(() => {
    const invoiceValue = parseFloat(formData.invoice_value) || 0;
    const localCommissionStr = formData.local_commission.replace('%', '').trim();
    const localCommission = parseFloat(localCommissionStr) || 0;
    const commissioning = (localCommission / 100) * invoiceValue;
    
    setFormData(prev => ({
      ...prev,
      commissioning
    }));
  }, [formData.invoice_value, formData.local_commission]);

  useEffect(() => {
    const commissionInRupees = parseFloat((formData.commissioning * formData.exchange_rate).toFixed(2));
    const commissionInWords = numberToWords(commissionInRupees);
    
    setFormData(prev => ({
      ...prev,
      commission_in_rupees: commissionInRupees,
      commission_in_words: commissionInWords
    }));
  }, [formData.commissioning, formData.exchange_rate]);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase.from('contact_book').select('*').order('name');
      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const fetchContracts = async () => {
    try {
      const { data, error } = await supabase.from('contracts').select('*').order('contract_no');
      if (error) throw error;
      setContracts(data || []);
    } catch (error) {
      console.error('Error fetching contracts:', error);
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase.from('companies').select('*').order('name');
      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const checkDebitNoteNumberExists = async (debitNoteNo: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.from('debit_notes').select('debit_note_no').eq('debit_note_no', debitNoteNo).maybeSingle();
      if (error) { throw error; }
      return !!data;
    } catch (error) {
      console.error('Error checking debit note number:', error);
      return false;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSupplierSelect = (contact: Contact) => {
    setFormData(prev => ({ ...prev, supplier_name: contact.name, supplier_address: contact.address }));
    setSupplierSearch(contact.name);
    setShowSupplierDropdown(false);
  };

  const handleContractSelect = (contract: Contract, index: number) => {
    const newSearches = [...contractSearches];
    newSearches[index] = contract.contract_no;
    setContractSearches(newSearches);

    const newSelectedContracts = [...selectedContracts];
    newSelectedContracts[index] = {
      id: contract.id,
      contract_no: contract.contract_no,
      contract_date: contract.contract_date,
      buyer_name: contract.buyer_name,
      supplier_name: contract.supplier_name,
      destination: contract.destination,
      local_commission: contract.local_commission,
      currency: contract.currency,
      company_name: contract.company_name
    };
    setSelectedContracts(newSelectedContracts);

    const allContractNos = newSelectedContracts.map(c => c.contract_no).join(', ');
    const allDestinations = newSelectedContracts.map(c => c.destination).flat().join(', ');
    
    const firstSelected = newSelectedContracts[0];
    if (firstSelected) {
      const fullContract = contracts.find(c => c.id === firstSelected.id);
      setFormData(prev => ({
        ...prev,
        contract_no: allContractNos,
        contract_date: firstSelected.contract_date,
        destination: allDestinations,
        buyer_name: firstSelected.buyer_name || '',
        local_commission: firstSelected.local_commission || '',
        currency: firstSelected.currency || 'USD',
        company: firstSelected.company_name || prev.company,
        supplier_name: firstSelected.supplier_name,
        supplier_address: fullContract?.supplier_address || [''],
      }));
      setSupplierSearch(firstSelected.supplier_name);
    }
    
    const newDropdownStates = [...showContractDropdowns];
    newDropdownStates[index] = false;
    setShowContractDropdowns(newDropdownStates);
  };
  
  const addContractField = () => {
    setContractSearches([...contractSearches, '']);
    setShowContractDropdowns([...showContractDropdowns, false]);
  };

  const removeContractField = (index: number) => {
    const newSearches = contractSearches.filter((_, i) => i !== index);
    setContractSearches(newSearches);

    const newSelected = selectedContracts.filter((_, i) => i !== index);
    setSelectedContracts(newSelected);
    
    const newDropdowns = showContractDropdowns.filter((_, i) => i !== index);
    setShowContractDropdowns(newDropdowns);
  };
  
  const handleArrayFieldChange = (field: keyof DebitNote, index: number, value: string) => {
    setFormData(prev => {
      const newArray = [...(prev[field] as string[])];
      newArray[index] = value;
      return { ...prev, [field]: newArray };
    });
  };

  const addArrayField = (field: keyof DebitNote) => {
    setFormData(prev => ({
      ...prev,
      [field]: [...(prev[field] as string[]), '']
    }));
  };
  
  const removeArrayField = (field: keyof DebitNote, index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setValidationError(null);

    // Check authentication
    if (!user) {
      setValidationError('You must be logged in to save a debit note.');
      setLoading(false);
      return;
    }

    // Basic validation
    if (!formData.debit_note_no || !formData.supplier_name) {
      setValidationError('Debit Note No. and Supplier Name are required.');
      setLoading(false);
      return;
    }

    // Check for duplicate debit note number if creating a new note
    if (!initialData) {
      const exists = await checkDebitNoteNumberExists(formData.debit_note_no);
      if (exists) {
        setValidationError(`Debit Note No. ${formData.debit_note_no} already exists.`);
        setLoading(false);
        return;
      }
    }

    try {
      // Prepare data for insertion/update - only include fields that exist in the database
      const dataToSave = {
        debit_note_no: formData.debit_note_no.trim(),
        debit_note_date: formData.debit_note_date,
        status: formData.status,
        supplier_name: formData.supplier_name.trim(),
        supplier_address: formData.supplier_address.filter(addr => addr.trim() !== ''),
        contract_no: formData.contract_no.trim(),
        buyer_name: formData.buyer_name.trim(),
        invoice_no: formData.invoice_no.trim(),
        quantity: formData.quantity.trim(),
        pieces: formData.pieces.trim(),
        destination: formData.destination.trim(),
        local_commission: formData.local_commission.trim(),
        invoice_value: formData.invoice_value.trim(),
        commissioning: parseFloat(formData.commissioning.toString()) || 0,
        exchange_rate: parseFloat(formData.exchange_rate.toString()) || 0,
        commission_in_rupees: parseFloat(formData.commission_in_rupees.toString()) || 0,
        commission_in_words: formData.commission_in_words.trim(),
        currency: formData.currency.trim(),
        company: formData.company.trim(),
      };

      const { error } = await supabase
        .from('debit_notes')
        .upsert(initialData ? { ...dataToSave, id: initialData.id } : dataToSave)
        .select()
        .single();
      
      if (error) {

        throw error;
      }
      
      navigate('/app/home');
    } catch (error: any) {
      console.error('Error saving debit note:', error);
      
      // Provide more specific error messages
      if (error.code === '23505') {
        setValidationError('A debit note with this number already exists.');
      } else if (error.code === '42501') {
        setValidationError('Permission denied. Please check your authentication.');
      } else if (error.message) {
        setValidationError(`Database error: ${error.message}`);
      } else {
        setValidationError('Failed to save debit note. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData?.id) return;
    if (window.confirm('Are you sure you want to delete this debit note?')) {
      setLoading(true);
      try {
        const { error } = await supabase
          .from('debit_notes')
          .delete()
          .eq('id', initialData.id);
        
        if (error) throw error;
        
        navigate('/app/home');
      } catch (error) {
        console.error('Error deleting debit note:', error);
        setValidationError('Failed to delete debit note.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleExportPDF = async () => {
    setShowExportMenu(false);
    try {
      let letterheadImages: { headerBase64: string | null; footerBase64: string | null; headerExt?: string; footerExt?: string } | undefined;
      if (companyLetterheadUrl) {
        const imgs = await extractLetterheadImages(companyLetterheadUrl);
        if (imgs.headerBase64) letterheadImages = imgs;
      }
      generateDebitNotePDF(formData, showCompanyInPdf, includeSignature, letterheadImages);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const handleExportWord = async () => {
    setShowExportMenu(false);
    setGeneratingWord(true);
    try {
      await generateDebitNoteWord(formData, companyLetterheadUrl);
    } catch (err) {
      console.error('Error generating Word document:', err);
      alert('Failed to generate Word document. Please try again.');
    } finally {
      setGeneratingWord(false);
    }
  };
  
  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const getFilteredContracts = (searchTerm: string) => {
    return contracts.filter(contract => {
      const searchLower = searchTerm.toLowerCase();
      return (
        contract.contract_no.toLowerCase().includes(searchLower) ||
        (contract.buyer_name && contract.buyer_name.toLowerCase().includes(searchLower)) ||
        (contract.supplier_name && contract.supplier_name.toLowerCase().includes(searchLower))
      );
    });
  };

  const inputClassName = "mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
  const labelClassName = "block text-sm font-medium text-gray-700";

  return (
    <div className="bg-white rounded-lg shadow-lg p-2 md:p-3">
      <form onSubmit={handleSubmit} className="space-y-4">
      {validationError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-start">
            <AlertCircle className="h-4 w-4 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Validation Error</h3>
              <p className="text-xs text-red-700 mt-1">{validationError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label htmlFor="debit_note_no" className={labelClassName}>Debit Note No *</label>
          <input type="text" id="debit_note_no" name="debit_note_no" value={formData.debit_note_no} onChange={handleChange} className={inputClassName} required />
        </div>
        <div>
          <DatePicker
            label="Debit Note Date"
            value={formData.debit_note_date || ''}
            onChange={(val) => setFormData({ ...formData, debit_note_date: val })}
          />
        </div>
        <div>
          <label htmlFor="status" className={labelClassName}>Status</label>
          <select id="status" name="status" value={formData.status} onChange={handleChange} className={inputClassName}>
            {STATUS_OPTIONS.map(status => (<option key={status} value={status}>{status}</option>))}
          </select>
        </div>
        <div>
          <label htmlFor="currency" className={labelClassName}>Currency</label>
          <input type="text" id="currency" name="currency" value={formData.currency} readOnly className={`${inputClassName} bg-gray-100`} />
        </div>
      </div>
      
      {/* Company Information */}
      <div className="space-y-3 border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-gray-900">Company Information</h3>
            <div className="flex items-center">
              <label htmlFor="showCompanyInPdfToggle" className="mr-2 text-xs font-medium text-gray-700">Show in PDF</label>
              <button
                type="button"
                className={`${
                  showCompanyInPdf ? 'bg-blue-600' : 'bg-gray-200'
                } relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                id="showCompanyInPdfToggle"
                role="switch"
                aria-checked={showCompanyInPdf}
                onClick={() => setShowCompanyInPdf(!showCompanyInPdf)}
              >
                <span
                  aria-hidden="true"
                  className={`${
                    showCompanyInPdf ? 'translate-x-5' : 'translate-x-0'
                  } pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                />
              </button>
            </div>
        </div>
        <select id="company" name="company" value={formData.company} onChange={(e) => {
            const selected = companies.find(c => c.name === e.target.value);
            handleChange(e);
            setCompanyLetterheadUrl(selected?.letterhead_url || null);
          }} className={inputClassName}>
            <option value="">Select a company</option>
            {companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      {/* Supplier Information */}
      <div className="space-y-3 border-t border-gray-100 pt-4">
        <h3 className="text-sm font-bold text-gray-900">Supplier Information</h3>
        <div>
          <label htmlFor="supplier_name" className={labelClassName}>Supplier</label>
          <div className="relative">
            <div className="flex">
              <span className="inline-flex items-center px-2 rounded-l-xl border border-r-0 border-blue-200 bg-blue-50 text-blue-500 text-xs shadow-sm"><Search className="h-3 w-3"/></span>
              <input
                type="text"
                id="supplier_name"
                name="supplier_name"
                value={supplierSearch}
                onChange={(e) => { setSupplierSearch(e.target.value); setShowSupplierDropdown(true); }}
                onFocus={() => setShowSupplierDropdown(true)}
                className="mt-0 block w-full rounded-none rounded-r-xl border border-blue-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                autoComplete="off"
              />
            </div>
            {showSupplierDropdown && filteredContacts.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-blue-200 bg-white shadow-lg shadow-blue-100">
                {filteredContacts.map(contact => (
                  <li key={contact.id} onClick={() => handleSupplierSelect(contact)} className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-700">
                    {contact.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div>
          <label className={labelClassName}>Supplier Address</label>
          {(formData.supplier_address || ['']).map((address, index) => (
            <div key={index} className="flex items-center mt-1.5">
              <input type="text" value={address} onChange={(e) => handleArrayFieldChange('supplier_address', index, e.target.value)} className={inputClassName} placeholder={`Address Line ${index + 1}`} />
              {index > 0 && ( <button type="button" onClick={() => removeArrayField('supplier_address', index)} className="ml-2 text-red-500 hover:text-red-700"><Minus className="h-4 w-4"/></button> )}
            </div>
          ))}
          <button type="button" onClick={() => addArrayField('supplier_address')} className="mt-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">+ Add Address Line</button>
        </div>
      </div>

      {/* Contract Information */}
      <div className="space-y-3 border-t border-gray-100 pt-4">
        <h3 className="text-sm font-bold text-gray-900">Contract Information</h3>
        <div>
        <label className={labelClassName}>Contract(s)</label>
        {contractSearches.map((searchTerm, index) => (
          <div key={index} className="relative flex items-center mt-1.5">
            <div className="flex-grow">
              <input
                type="text"
                value={searchTerm}
                onChange={e => {
                  const newSearches = [...contractSearches];
                  newSearches[index] = e.target.value;
                  setContractSearches(newSearches);
                  const newDropdowns = [...showContractDropdowns];
                  newDropdowns[index] = true;
                  setShowContractDropdowns(newDropdowns);
                }}
                onFocus={() => {
                  const newDropdowns = [...showContractDropdowns];
                  newDropdowns[index] = true;
                  setShowContractDropdowns(newDropdowns);
                }}
                className={inputClassName}
                placeholder="Search by Contract No, Buyer, or Supplier"
                autoComplete="off"
              />
              {showContractDropdowns[index] && (
                <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-blue-200 bg-white shadow-lg shadow-blue-100">
                  {getFilteredContracts(searchTerm).map(contract => (
                    <li key={contract.id} onClick={() => handleContractSelect(contract, index)} className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-700">
                      <strong>{contract.contract_no}</strong> - {contract.buyer_name} / {contract.supplier_name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {index > 0 && (<button type="button" onClick={() => removeContractField(index)} className="ml-2 text-red-500 hover:text-red-700"><Minus className="h-4 w-4"/></button>)}
          </div>
        ))}
        <button type="button" onClick={addContractField} className="mt-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">+ Add Contract</button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label htmlFor="contract_date" className={labelClassName}>Contract Date</label>
            <input 
              type="text" 
              id="contract_date" 
              value={formData.contract_date ? new Date(formData.contract_date).toLocaleDateString('en-GB') : ''} 
              readOnly 
              className={`${inputClassName} bg-gray-100`}
              placeholder="Auto-filled"
            />
          </div>
          <div>
            <label htmlFor="buyer_name" className={labelClassName}>Buyer Name</label>
            <input type="text" id="buyer_name" value={formData.buyer_name} readOnly className={`${inputClassName} bg-gray-100`}/>
          </div>
          <div>
            <label htmlFor="destination" className={labelClassName}>Destination</label>
            <input type="text" id="destination" value={formData.destination} readOnly className={`${inputClassName} bg-gray-100`}/>
          </div>
        </div>
      </div>
      
      {/* Invoice Information */}
      <div className="space-y-3 border-t border-gray-100 pt-4">
        <h3 className="text-sm font-bold text-gray-900">Invoice Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label htmlFor="invoice_no" className={labelClassName}>Invoice No</label>
          <input type="text" id="invoice_no" name="invoice_no" value={formData.invoice_no} onChange={handleChange} className={inputClassName} />
        </div>
        <div>
          <DatePicker
            label="Invoice Date"
            value={formData.invoice_date || ''}
            onChange={(val) => setFormData({ ...formData, invoice_date: val })}
          />
        </div>
        <div>
          <label htmlFor="quantity" className={labelClassName}>Quantity</label>
          <input type="text" id="quantity" name="quantity" value={formData.quantity} onChange={handleChange} className={inputClassName} />
        </div>
        <div>
          <label htmlFor="pieces" className={labelClassName}>Pieces</label>
          <input type="text" id="pieces" name="pieces" value={formData.pieces} onChange={handleChange} className={inputClassName} />
        </div>
        </div>
      </div>

      {/* Commission Calculation */}
      <div className="space-y-3 border-t border-gray-100 pt-4">
        <h3 className="text-sm font-bold text-gray-900">Commission Calculation</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
              <label htmlFor="local_commission" className={labelClassName}>Local Commission (%)</label>
              <input type="text" id="local_commission" value={formData.local_commission} readOnly className={`${inputClassName} bg-gray-100`}/>
          </div>
          <div>
              <label htmlFor="invoice_value" className={labelClassName}>Invoice Value</label>
              <input type="number" id="invoice_value" name="invoice_value" value={formData.invoice_value} onChange={handleChange} className={inputClassName} placeholder="0.00"/>
          </div>
          <div>
              <label htmlFor="exchange_rate" className={labelClassName}>Exchange Rate</label>
              <input type="number" step="0.01" id="exchange_rate" name="exchange_rate" value={formData.exchange_rate} onChange={handleChange} className={inputClassName}/>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
              <label htmlFor="commissioning" className={labelClassName}>Commissioning (Calculated)</label>
              <input type="number" id="commissioning" value={formData.commissioning.toFixed(2)} readOnly className={`${inputClassName} bg-gray-100`}/>
          </div>
          <div>
              <label htmlFor="commission_in_rupees" className={labelClassName}>Commission in Rupees (Calculated)</label>
              <input type="text" id="commission_in_rupees" value={formData.commission_in_rupees.toFixed(2)} readOnly className={`${inputClassName} bg-gray-100`}/>
          </div>
        </div>
        
        <div>
            <label htmlFor="commission_in_words" className={labelClassName}>Commission in Words (Auto-generated)</label>
            <textarea id="commission_in_words" value={formData.commission_in_words} readOnly className={`${inputClassName} bg-gray-100 h-16`} rows={2}/>
        </div>
      </div>

      {/* Signature Toggle */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <label className="block text-xs font-medium text-gray-700">Add Signature to PDF</label>
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
      <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-4 border-t border-gray-100">
        {initialData?.id && (
          <button type="button" onClick={handleDelete} className="px-3 py-2 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-xl hover:bg-red-50 shadow-sm">
            <Trash2 className="h-3.5 w-3.5 inline mr-1" />
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
            disabled={loading || generatingWord}
            className="inline-flex items-center justify-center w-full px-3 py-2 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-xl hover:bg-blue-50 shadow-sm disabled:opacity-50"
          >
            <FileDown className="h-3.5 w-3.5 mr-1.5" />
            {generatingWord ? 'Generating Word...' : 'Export'}
            <ChevronDown className="h-3 w-3 ml-1.5" />
          </button>
          {showExportMenu && (
            <div className="absolute bottom-full mb-1 right-0 z-30 min-w-[140px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
              <button
                type="button"
                onClick={handleExportPDF}
                disabled={loading || generatingWord}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
              >
                <FileDown className="h-4 w-4 shrink-0" />
                Export PDF
              </button>
              <button
                type="button"
                onClick={handleExportWord}
                disabled={loading || generatingWord}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 border-t border-gray-100"
              >
                <FileDown className="h-4 w-4 shrink-0" />
                Export Word
              </button>
            </div>
          )}
        </div>

        <button type="submit" disabled={loading} className="px-3 py-2 text-xs font-medium text-white bg-blue-600 border border-transparent rounded-xl hover:bg-blue-700 disabled:opacity-50 shadow-sm">
          <Save className="h-3.5 w-3.5 inline mr-1" />
          {loading ? 'Saving...' : initialData?.id ? 'Update' : 'Save'}
        </button>
      </div>
      </form>
    </div>
  );
};

export default DebitNoteForm;