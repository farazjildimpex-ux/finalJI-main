import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bold,
  ChevronDown,
  FileDown,
  Plus,
  Save,
  Trash2,
  Underline,
  X,
  ClipboardList,
  Building2,
  Mail,
  Package,
  PenLine,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Company, Contact, Sample } from '../../types';
import { generateSamplePDF } from '../../utils/samplePdfGenerator';
import DatePicker from '../UI/DatePicker';
import FormRow, { CollapsibleFormSection, formInputClass, ZohoRow, ZohoSection, FGrid, FField, FSectionCard, zohoInputClass, zohoTextareaClass } from '../UI/FormRow';
import { COURIERS, buildTrackingUrl } from '../../lib/courierTracking';
import { dialogService } from '../../lib/dialogService';

const STATUS_OPTIONS = ['Issued', 'Completed', 'Cancelled'] as const;
const STATUS_COLORS: Record<string, string> = {
  Issued:    'bg-blue-50 text-blue-900 border-blue-300',
  Completed: 'bg-emerald-50 text-emerald-900 border-emerald-300',
  Cancelled: 'bg-red-50 text-red-900 border-red-300',
};
const FONT_SIZES = ['12px', '14px', '16px', '18px'] as const;
const DEFAULT_TEXT_COLOR = '#1f2937';

interface SampleFormProps {
  initialData?: Sample | null;
}

const createEmptySample = (): Sample => ({
  sample_number: '',
  date: new Date().toISOString().split('T')[0],
  status: 'Issued',
  company_name: '',
  supplier_name: '',
  supplier_address: [''],
  description: '',
  article: '',
  size: '',
  substance: '',
  selection: [],
  color: [],
  swatch: [],
  quantity: [],
  delivery: [],
  notes: '',
  shipment_reference: [],
  customer_comments: '',
  courier_provider: null,
  courier_reference: null,
  courier_status: null,
  delivered_at: null,
});

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const plainTextToHtml = (value: string) =>
  value
    .split('\n')
    .map((line) => (line ? `<div>${escapeHtml(line)}</div>` : '<div><br></div>'))
    .join('');

const sanitizeRichTextHtml = (html: string) => {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = documentNode.body.firstElementChild as HTMLDivElement | null;

  if (!root) {
    return '<div><br></div>';
  }

  const cleanNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent || '');
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();

    if (!['div', 'p', 'br', 'span', 'b', 'strong', 'u'].includes(tagName)) {
      const fragment = document.createDocumentFragment();
      Array.from(element.childNodes).forEach((child) => {
        const cleanedChild = cleanNode(child);
        if (cleanedChild) {
          fragment.appendChild(cleanedChild);
        }
      });
      return fragment;
    }

    if (tagName === 'br') {
      return document.createElement('br');
    }

    const cleanElement = document.createElement(tagName);

    if (tagName === 'span') {
      const fontSize = element.style.fontSize;
      const color = element.style.color;
      if (fontSize) cleanElement.style.fontSize = fontSize;
      if (color) cleanElement.style.color = color;
      if (element.style.fontWeight === 'bold') cleanElement.style.fontWeight = 'bold';
      if (element.style.textDecoration.includes('underline'))
        cleanElement.style.textDecoration = 'underline';
    }

    Array.from(element.childNodes).forEach((child) => {
      const cleanedChild = cleanNode(child);
      if (cleanedChild) {
        cleanElement.appendChild(cleanedChild);
      }
    });

    return cleanElement;
  };

  const cleanedRoot = document.createElement('div');
  Array.from(root.childNodes).forEach((child) => {
    const cleanedChild = cleanNode(child);
    if (cleanedChild) {
      cleanedRoot.appendChild(cleanedChild);
    }
  });

  return cleanedRoot.innerHTML || '<div><br></div>';
};

const normalizeStoredNotes = (value: string) => {
  if (!value.trim()) {
    return '<div><br></div>';
  }

  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(value);
  return hasHtml ? sanitizeRichTextHtml(value) : plainTextToHtml(value);
};

const SampleForm: React.FC<SampleFormProps> = ({ initialData }) => {
  const navigate = useNavigate();
  const editorRef = useRef<HTMLDivElement>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showCompanyInPdf, setShowCompanyInPdf] = useState(true);
  const [selectedColor, setSelectedColor] = useState(DEFAULT_TEXT_COLOR);
  const [selectedFontSize, setSelectedFontSize] =
    useState<(typeof FONT_SIZES)[number]>('14px');
  const [formData, setFormData] = useState<Sample>(createEmptySample());

  const isEditorInitialized = useRef(false);

  useEffect(() => {
    fetchContacts();
    fetchCompanies();

    if (initialData) {
      setFormData({ ...createEmptySample(), ...initialData });
      setSupplierSearch(initialData.supplier_name);
      if (editorRef.current && !isEditorInitialized.current) {
        editorRef.current.innerHTML = normalizeStoredNotes(initialData.notes || '');
        isEditorInitialized.current = true;
      }
    } else {
      if (editorRef.current && !isEditorInitialized.current) {
        editorRef.current.innerHTML = '<div><br></div>';
        isEditorInitialized.current = true;
      }
    }
  }, [initialData]);

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

  const selectedCompany = useMemo(
    () => companies.find((company) => company.name === formData.company_name) ?? null,
    [companies, formData.company_name]
  );

  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const setField = <K extends keyof Sample>(field: K, value: Sample[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleArrayFieldChange = (
    field: keyof Sample,
    index: number,
    value: string
  ) => {
    setFormData((prev) => {
      const newArray = [...((prev[field] as string[]) || [])];
      newArray[index] = value;
      return { ...prev, [field]: newArray };
    });
  };

  const addArrayField = (field: keyof Sample) => {
    setFormData((prev) => ({
      ...prev,
      [field]: [...((prev[field] as string[]) || []), ''],
    }));
  };

  const removeArrayField = (field: keyof Sample, index: number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: ((prev[field] as string[]) || []).filter((_, i) => i !== index),
    }));
  };

  const getEditorHtml = () => {
    return sanitizeRichTextHtml(editorRef.current?.innerHTML || '<div><br></div>');
  };

  const focusEditor = () => {
    editorRef.current?.focus();
  };

  const applyCommand = (command: 'bold' | 'underline') => {
    focusEditor();
    document.execCommand(command);
  };

  const applyInlineStyle = (style: Partial<CSSStyleDeclaration>) => {
    focusEditor();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }

    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    Object.assign(span.style, style);

    try {
      range.surroundContents(span);
    } catch {
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
    }

    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    selection.addRange(newRange);
  };

  const handleSupplierSelect = (contact: Contact) => {
    setField('supplier_name', contact.name);
    setField('supplier_address', contact.address.filter(Boolean));
    setSupplierSearch(contact.name);
    setShowSupplierDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.company_name || !formData.sample_number || !formData.supplier_name) {
      dialogService.alert({
        title: 'Missing required fields',
        message: 'Company name, letter number, and supplier name are required.',
        tone: 'warning',
      });
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error('No authenticated user found');

      const dataToSave = {
        ...formData,
        supplier_address: formData.supplier_address.filter((line) => line.trim() !== ''),
        notes: getEditorHtml(),
        customer_comments: formData.customer_comments?.trim() || '',
        user_id: user.id,
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from('samples')
          .update(dataToSave)
          .eq('id', initialData.id);
        if (error) throw error;
        dialogService.success('Letter updated.');
      } else {
        const { error } = await supabase.from('samples').insert([dataToSave]);
        if (error) throw error;
        dialogService.success('Letter saved.');
      }

      navigate('/app/home');
    } catch (error: any) {
      console.error('Error saving letter:', error);
      dialogService.alert({
        title: 'Failed to save letter',
        message: error?.message || 'Please try again.',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData?.id) return;

    const confirmed = await dialogService.confirm({
      title: 'Delete letter?',
      message: 'Are you sure you want to delete this letter? This action cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('samples')
        .delete()
        .eq('id', initialData.id);
      if (error) throw error;
      dialogService.success('Letter deleted.');
      navigate('/app/home');
    } catch (error: any) {
      console.error('Error deleting letter:', error);
      dialogService.alert({
        title: 'Failed to delete letter',
        message: error?.message || 'Please try again.',
        tone: 'danger',
      });
    }
  };

  const handleExportPDF = async () => {
    if (!formData.company_name || !formData.sample_number || !formData.supplier_name) {
      dialogService.alert({
        title: 'Missing details',
        message:
          'Please enter the company name, letter number, and supplier before exporting the PDF.',
        tone: 'warning',
      });
      return;
    }

    setGeneratingPdf(true);
    try {
      await generateSamplePDF(
        {
          ...formData,
          notes: getEditorHtml(),
        },
        selectedCompany,
        showCompanyInPdf
      );
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
    field: keyof Sample,
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
            className={zohoInputClass}
            placeholder={placeholder}
          />
          {index > 0 && (
            <button
              type="button"
              onClick={() => removeArrayField(field, index)}
              className="text-gray-400 hover:text-rose-600 p-1"
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
    <form onSubmit={handleSubmit} className="space-y-3 text-gray-900">

      <FSectionCard title="Basic Information" icon={ClipboardList} accent="violet" right={
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500">Show Company in PDF</span>
          {renderToggle(showCompanyInPdf, () => setShowCompanyInPdf(!showCompanyInPdf))}
        </div>
      }>
        <FField label="Company Name" htmlFor="company_name" required>
          <select id="company_name" value={formData.company_name} onChange={(e) => setField('company_name', e.target.value)} className={zohoInputClass} required>
            <option value="">Select Company</option>
            {companies.map((company) => (<option key={company.id} value={company.name}>{company.name}</option>))}
          </select>
        </FField>
        <FField label="Letter Number" htmlFor="sample_number" required>
          <input id="sample_number" type="text" value={formData.sample_number} onChange={(e) => setField('sample_number', e.target.value)} className={zohoInputClass} required />
        </FField>
        <FField label="Date">
          <DatePicker value={formData.date || ''} onChange={(val) => setField('date', val)} />
        </FField>
        <FField label="Status" htmlFor="status">
          <select id="status" value={formData.status} onChange={(e) => setField('status', e.target.value as Sample['status'])} className={`${zohoInputClass} font-semibold ${STATUS_COLORS[formData.status || 'Issued']}`}>
            {STATUS_OPTIONS.map((status) => (<option key={status} value={status}>{status}</option>))}
          </select>
        </FField>
      </FSectionCard>

      <FSectionCard title="Supplier Information" icon={Building2} accent="slate">
        <FField label="Supplier Name" htmlFor="supplier_name" required>
          <div className="relative">
            <input id="supplier_name" type="text" value={supplierSearch} onChange={(e) => { setSupplierSearch(e.target.value); setField('supplier_name', e.target.value); setShowSupplierDropdown(true); }} onFocus={() => setShowSupplierDropdown(true)} onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 150)} className={zohoInputClass} placeholder="Search supplier…" autoComplete="off" required />
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            {showSupplierDropdown && filteredContacts.length > 0 && (
              <div className="absolute z-50 mt-1.5 w-full max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
                {filteredContacts.map((contact) => (
                  <div key={contact.id} className="cursor-pointer px-3 py-2 text-[13px] text-gray-700 hover:bg-blue-50" onMouseDown={() => handleSupplierSelect(contact)}>{contact.name}</div>
                ))}
              </div>
            )}
          </div>
        </FField>
        <FField label="Supplier Address" span="full">
          {renderArrayList('supplier_address', formData.supplier_address, 'Address line', 'Add Address Line')}
        </FField>
      </FSectionCard>

      <FSectionCard title="Letter Content" icon={Mail} accent="violet">
        <FField label="Description" htmlFor="description" span="full">
          <input id="description" type="text" value={formData.description} onChange={(e) => setField('description', e.target.value)} className={zohoInputClass} placeholder="Short bold heading for the letter" />
        </FField>
        <FField label="Letter Details" span="full" hint="Basic formatting: bold, underline, font size and color.">
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-200 bg-gray-50/70 px-3 py-2">
              <button type="button" onClick={() => applyCommand('bold')} className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-700" title="Bold">
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => applyCommand('underline')} className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-700" title="Underline">
                <Underline className="h-3.5 w-3.5" />
              </button>
              <select value={selectedFontSize} onChange={(e) => { const next = e.target.value as (typeof FONT_SIZES)[number]; setSelectedFontSize(next); applyInlineStyle({ fontSize: next }); }} className="h-7 rounded-lg border border-gray-200 bg-white px-2 text-[12px] text-gray-700 focus:outline-none" title="Font size">
                {FONT_SIZES.map((size) => (<option key={size} value={size}>{size}</option>))}
              </select>
              <label className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 text-[12px] text-gray-700">
                Color
                <input type="color" value={selectedColor} onChange={(e) => { setSelectedColor(e.target.value); applyInlineStyle({ color: e.target.value }); }} className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0" title="Text color" />
              </label>
            </div>
            <div ref={editorRef} contentEditable suppressContentEditableWarning onPaste={(event) => { event.preventDefault(); const text = event.clipboardData.getData('text/plain'); document.execCommand('insertText', false, text); }} className="min-h-[200px] px-4 py-3 text-[13.5px] leading-6 text-gray-800 focus:outline-none" />
          </div>
        </FField>
      </FSectionCard>

      <FSectionCard title="Courier & Tracking" icon={Package} accent="teal">
        <FField label="Courier Provider" htmlFor="courier_provider">
          <select id="courier_provider" value={formData.courier_provider || ''} onChange={(e) => setField('courier_provider', e.target.value || null)} className={zohoInputClass}>
            <option value="">— Select courier —</option>
            {COURIERS.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
          </select>
        </FField>
        <FField label="Tracking / AWB Number" htmlFor="courier_reference">
          <div className="flex gap-2">
            <input id="courier_reference" type="text" value={formData.courier_reference || ''} onChange={(e) => setField('courier_reference', e.target.value || null)} className={zohoInputClass} placeholder="e.g. 1234567890" />
            {(() => {
              const url = buildTrackingUrl(formData.courier_provider, formData.courier_reference);
              return url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-200 text-[12px] font-medium text-blue-600 hover:bg-blue-50 whitespace-nowrap">Track</a>
              ) : null;
            })()}
          </div>
        </FField>
        <FField label="Courier Status" htmlFor="courier_status">
          <select id="courier_status" value={formData.courier_status || ''} onChange={(e) => setField('courier_status', e.target.value || null)} className={zohoInputClass}>
            <option value="">— Select status —</option>
            <option value="Pending">Pending</option>
            <option value="In Transit">In Transit</option>
            <option value="Delivered">Delivered</option>
            <option value="Returned">Returned</option>
          </select>
        </FField>
        <FField label="Delivered At" htmlFor="delivered_at">
          <DatePicker value={formData.delivered_at || ''} onChange={(val) => setField('delivered_at', val || null)} />
        </FField>
      </FSectionCard>

      <FSectionCard title="Signature" icon={PenLine} accent="rose">
        <FField label="Signee Name" htmlFor="signee_name">
          <input id="signee_name" type="text" value={formData.customer_comments || ''} onChange={(e) => setField('customer_comments', e.target.value)} className={zohoInputClass} placeholder="Name that appears at the bottom" />
        </FField>
      </FSectionCard>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-5 py-4 flex flex-wrap items-center gap-2.5">
        <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 shadow-sm">
          <Save className="h-4 w-4" />
          {loading ? 'Saving…' : (initialData ? 'Update Letter' : 'Save Letter')}
        </button>
        <button type="button" onClick={handleExportPDF} disabled={generatingPdf || loading} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm disabled:opacity-50">
          <FileDown className="h-4 w-4" />
          {generatingPdf ? 'Generating…' : 'Export PDF'}
        </button>
        {initialData && (
          <button type="button" onClick={handleDelete} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 bg-white border border-red-100 hover:bg-red-50 shadow-sm">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        )}
        <button type="button" onClick={() => navigate('/app/home')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm ml-auto">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default SampleForm;
