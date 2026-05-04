import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Save, FileDown, Trash2, ChevronDown, X, Search, Plus, Minus, AlertCircle, ClipboardList, Building2, FileText, Receipt, Calculator } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { DebitNote, Contact, Contract, Company } from '../../types';
import { generateDebitNotePDF } from '../../utils/debitNotePdfGenerator';
import { generateDebitNoteWord } from '../../utils/debitNoteWordGenerator';
import { extractLetterheadImages } from '../../utils/contractWordGenerator';
import { useAuth } from '../../hooks/useAuth';
import DatePicker from '../UI/DatePicker';
import FormRow, { CollapsibleFormSection, formInputClass, formInputReadOnlyClass, ZohoRow, ZohoSection, FGrid, FField, FSectionCard, zohoInputClass, zohoInputReadOnlyClass, zohoTextareaClass } from '../UI/FormRow';
import { dialogService } from '../../lib/dialogService';

/** Increment the trailing number in any document reference, preserving zero-padding and prefix. */
function getNextNumber(last: string): string {
  const match = last.match(/^(.*\D|)(\d+)(\D*)$/);
  if (!match) return last;
  const [, prefix, numStr, suffix] = match;
  return prefix + String(parseInt(numStr, 10) + 1).padStart(numStr.length, '0') + suffix;
}

const STATUS_OPTIONS = ['Issued', 'Completed', 'Cancelled'] as const;
const STATUS_COLORS: Record<string, string> = {
  Issued:    'bg-blue-50 text-blue-900 border-blue-300',
  Completed: 'bg-emerald-50 text-emerald-900 border-emerald-300',
  Cancelled: 'bg-red-50 text-red-900 border-red-300',
};

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
    if (initialData) return;
    supabase
      .from('debit_notes')
      .select('debit_note_no')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const last = data?.[0]?.debit_note_no;
        if (last) setFormData(prev => ({ ...prev, debit_note_no: getNextNumber(last) }));
      });
  }, []);

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
    const ok = await dialogService.confirm({
      title: 'Delete debit note?',
      message: 'Are you sure you want to delete this debit note? This action cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('debit_notes')
        .delete()
        .eq('id', initialData.id);

      if (error) throw error;

      dialogService.success('Debit note deleted.');
      navigate('/app/home');
    } catch (error: any) {
      console.error('Error deleting debit note:', error);
      dialogService.alert({
        title: 'Failed to delete debit note',
        message: error?.message || 'Please try again.',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
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
      generateDebitNotePDF(formData, showCompanyInPdf, false, letterheadImages);
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      dialogService.alert({
        title: 'PDF export failed',
        message: err?.message || 'Failed to generate PDF.',
        tone: 'danger',
      });
    }
  };

  const handleExportWord = async () => {
    setShowExportMenu(false);
    setGeneratingWord(true);
    try {
      await generateDebitNoteWord(formData, companyLetterheadUrl);
    } catch (err: any) {
      console.error('Error generating Word document:', err);
      dialogService.alert({
        title: 'Word export failed',
        message: err?.message || 'Failed to generate Word document.',
        tone: 'danger',
      });
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


  const inputClassName = zohoInputClass;
  const inputReadOnlyClass = zohoInputReadOnlyClass;

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

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-gray-900">
      {validationError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-medium text-red-800">Validation Error</p>
            <p className="text-[12px] text-red-700 mt-0.5">{validationError}</p>
          </div>
        </div>
      )}

      <FSectionCard title="Basic Information" icon={ClipboardList} accent="emerald">
        <FField label="Debit Note No" htmlFor="debit_note_no" required>
          <input type="text" id="debit_note_no" name="debit_note_no" value={formData.debit_note_no} onChange={handleChange} className={inputClassName} required />
        </FField>
        <FField label="Debit Note Date">
          <DatePicker value={formData.debit_note_date || ''} onChange={(val) => setFormData({ ...formData, debit_note_date: val })} />
        </FField>
        <FField label="Status" htmlFor="status">
          <select id="status" name="status" value={formData.status} onChange={handleChange} className={`${inputClassName} font-semibold ${STATUS_COLORS[formData.status || 'Issued']}`}>
            {STATUS_OPTIONS.map(status => (<option key={status} value={status}>{status}</option>))}
          </select>
        </FField>
        <FField label="Currency" htmlFor="currency">
          <input type="text" id="currency" name="currency" value={formData.currency} readOnly className={inputReadOnlyClass} />
        </FField>
      </FSectionCard>

      <FSectionCard title="Company" icon={Building2} accent="teal" right={
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500">Show in PDF</span>
          {renderToggle(showCompanyInPdf, () => setShowCompanyInPdf(!showCompanyInPdf))}
        </div>
      }>
        <FField label="Company" htmlFor="company" span="full">
          <select id="company" name="company" value={formData.company} onChange={(e) => { const selected = companies.find(c => c.name === e.target.value); handleChange(e); setCompanyLetterheadUrl(selected?.letterhead_url || null); }} className={inputClassName}>
            <option value="">Select a company</option>
            {companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </FField>
      </FSectionCard>

      <FSectionCard title="Supplier Information" icon={Building2} accent="slate">
        <FField label="Supplier" htmlFor="supplier_name">
          <div className="relative">
            <input type="text" id="supplier_name" name="supplier_name" value={supplierSearch} onChange={(e) => { setSupplierSearch(e.target.value); setShowSupplierDropdown(true); }} onFocus={() => setShowSupplierDropdown(true)} onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 150)} className={inputClassName} autoComplete="off" placeholder="Search supplier…" />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            {showSupplierDropdown && filteredContacts.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-xl">
                {filteredContacts.map(contact => (
                  <div key={contact.id} onMouseDown={() => handleSupplierSelect(contact)} className="cursor-pointer px-3 py-2 text-[13px] text-gray-700 hover:bg-blue-50">{contact.name}</div>
                ))}
              </div>
            )}
          </div>
        </FField>
        <FField label="Supplier Address" span="full">
          <div className="space-y-1.5">
            {(formData.supplier_address || ['']).map((address, index) => (
              <div key={index} className="flex gap-2">
                <input type="text" value={address} onChange={(e) => handleArrayFieldChange('supplier_address', index, e.target.value)} className={inputClassName} placeholder={`Address Line ${index + 1}`} />
                {index > 0 && (
                  <button type="button" onClick={() => removeArrayField('supplier_address', index)} className="text-gray-400 hover:text-red-600 p-1" title="Remove">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => addArrayField('supplier_address')} className="inline-flex items-center gap-1 text-[12px] text-blue-600 hover:text-blue-800 font-medium mt-0.5">
              <Plus className="h-3 w-3" /> Add Address Line
            </button>
          </div>
        </FField>
      </FSectionCard>

      <FSectionCard title="Contract Information" icon={FileText} accent="blue">
        <FField label="Contract(s)" span="full">
          <div className="space-y-1.5">
            {contractSearches.map((searchTerm, index) => (
              <div key={index} className="flex gap-2">
                <div className="relative flex-grow">
                  <input type="text" value={searchTerm} onChange={e => { const ns = [...contractSearches]; ns[index] = e.target.value; setContractSearches(ns); const nd = [...showContractDropdowns]; nd[index] = true; setShowContractDropdowns(nd); }} onFocus={() => { const nd = [...showContractDropdowns]; nd[index] = true; setShowContractDropdowns(nd); }} onBlur={() => setTimeout(() => { const nd = [...showContractDropdowns]; nd[index] = false; setShowContractDropdowns(nd); }, 150)} className={inputClassName} placeholder="Search by Contract No, Buyer, or Supplier" autoComplete="off" />
                  {showContractDropdowns[index] && (
                    <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-xl">
                      {getFilteredContracts(searchTerm).map(contract => (
                        <div key={contract.id} onMouseDown={() => handleContractSelect(contract, index)} className="cursor-pointer px-3 py-2 text-[13px] text-gray-700 hover:bg-blue-50">
                          <strong>{contract.contract_no}</strong> — {contract.buyer_name} / {contract.supplier_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {index > 0 && (
                  <button type="button" onClick={() => removeContractField(index)} className="text-gray-400 hover:text-red-600 p-1" title="Remove">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addContractField} className="inline-flex items-center gap-1 text-[12px] text-blue-600 hover:text-blue-800 font-medium mt-0.5">
              <Plus className="h-3 w-3" /> Add Contract
            </button>
          </div>
        </FField>
        <FField label="Contract Date" htmlFor="contract_date">
          <input type="text" id="contract_date" value={formData.contract_date ? new Date(formData.contract_date).toLocaleDateString('en-GB') : ''} readOnly className={inputReadOnlyClass} placeholder="Auto-filled" />
        </FField>
        <FField label="Buyer Name" htmlFor="buyer_name">
          <input type="text" id="buyer_name" value={formData.buyer_name} readOnly className={inputReadOnlyClass} />
        </FField>
        <FField label="Destination" htmlFor="destination">
          <input type="text" id="destination" value={formData.destination} readOnly className={inputReadOnlyClass} />
        </FField>
      </FSectionCard>

      <FSectionCard title="Invoice Information" icon={Receipt} accent="amber">
        <FField label="Invoice No" htmlFor="invoice_no">
          <input type="text" id="invoice_no" name="invoice_no" value={formData.invoice_no} onChange={handleChange} className={inputClassName} />
        </FField>
        <FField label="Invoice Date">
          <DatePicker value={formData.invoice_date || ''} onChange={(val) => setFormData({ ...formData, invoice_date: val })} />
        </FField>
        <FField label="Quantity" htmlFor="quantity">
          <input type="text" id="quantity" name="quantity" value={formData.quantity} onChange={handleChange} className={inputClassName} />
        </FField>
        <FField label="Pieces" htmlFor="pieces">
          <input type="text" id="pieces" name="pieces" value={formData.pieces} onChange={handleChange} className={inputClassName} />
        </FField>
      </FSectionCard>

      <FSectionCard title="Commission Calculation" icon={Calculator} accent="indigo">
        <FField label="Local Commission (%)" htmlFor="local_commission">
          <input type="text" id="local_commission" value={formData.local_commission} readOnly className={inputReadOnlyClass} />
        </FField>
        <FField label="Invoice Value" htmlFor="invoice_value">
          <input type="number" id="invoice_value" name="invoice_value" value={formData.invoice_value} onChange={handleChange} className={inputClassName} placeholder="0.00" />
        </FField>
        <FField label="Exchange Rate" htmlFor="exchange_rate">
          <input type="number" step="0.01" id="exchange_rate" name="exchange_rate" value={formData.exchange_rate} onChange={handleChange} className={inputClassName} />
        </FField>
        <FField label="Commissioning" htmlFor="commissioning" hint="Calculated automatically">
          <input type="number" id="commissioning" value={formData.commissioning.toFixed(2)} readOnly className={inputReadOnlyClass} />
        </FField>
        <FField label="Commission in Rupees" htmlFor="commission_in_rupees" hint="Calculated automatically">
          <input type="text" id="commission_in_rupees" value={formData.commission_in_rupees.toFixed(2)} readOnly className={inputReadOnlyClass} />
        </FField>
        <FField label="Commission in Words" htmlFor="commission_in_words" span="full" hint="Auto-generated">
          <textarea id="commission_in_words" value={formData.commission_in_words} readOnly className={`${inputReadOnlyClass} resize-y`} rows={2} />
        </FField>
      </FSectionCard>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-5 py-4 flex flex-wrap items-center gap-2.5">
        <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 shadow-sm">
          <Save className="h-4 w-4" />
          {loading ? 'Saving…' : (initialData?.id ? 'Update Debit Note' : 'Save Debit Note')}
        </button>
        <div className="relative" onMouseEnter={() => { if (exportMenuTimeoutRef.current) clearTimeout(exportMenuTimeoutRef.current); setShowExportMenu(true); }} onMouseLeave={() => { exportMenuTimeoutRef.current = setTimeout(() => setShowExportMenu(false), 200); }}>
          <button type="button" disabled={loading || generatingWord} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm disabled:opacity-50">
            <FileDown className="h-4 w-4" />
            {generatingWord ? 'Generating Word…' : 'Export'}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {showExportMenu && (
            <div className="absolute bottom-full mb-1.5 left-0 z-30 min-w-[150px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
              <button type="button" onClick={handleExportPDF} disabled={loading || generatingWord} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 disabled:opacity-50">
                <FileDown className="h-4 w-4 shrink-0" /> Export PDF
              </button>
              <button type="button" onClick={handleExportWord} disabled={loading || generatingWord} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 disabled:opacity-50 border-t border-gray-100">
                <FileDown className="h-4 w-4 shrink-0" /> Export Word
              </button>
            </div>
          )}
        </div>
        {initialData?.id && (
          <button type="button" onClick={handleDelete} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 bg-white border border-red-100 hover:bg-red-50 shadow-sm">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        )}
        <button type="button" onClick={() => navigate('/app/debit-notes')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm ml-auto">
          Cancel
        </button>
      </div>
    </form>
  );
};

export default DebitNoteForm;