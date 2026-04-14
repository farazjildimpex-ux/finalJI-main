import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bold, ChevronDown, FileDown, Save, Trash2, Underline, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Company, Contact, Sample } from '../../types';
import { generateSamplePDF } from '../../utils/samplePdfGenerator';
import DatePicker from '../UI/DatePicker';

const STATUS_OPTIONS = ['Issued', 'Completed'] as const;
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
});

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
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
      if (element.style.textDecoration.includes('underline')) cleanElement.style.textDecoration = 'underline';
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
  const [selectedFontSize, setSelectedFontSize] = useState<(typeof FONT_SIZES)[number]>('14px');
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
      const { data, error } = await supabase.from('contact_book').select('*').order('name');
      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
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
    setFormData(prev => {
      const newArray = [...(prev[field] as string[])];
      newArray[index] = value;
      return { ...prev, [field]: newArray };
    });
  };

  const addArrayField = (field: keyof Sample) => {
    setFormData(prev => ({
      ...prev,
      [field]: [...(prev[field] as string[]), '']
    }));
  };

  const removeArrayField = (field: keyof Sample, index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((_, i) => i !== index)
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
      alert('Company name, letter number, and supplier name are required');
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
        const { error } = await supabase.from('samples').update(dataToSave).eq('id', initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('samples').insert([dataToSave]);
        if (error) throw error;
      }

      navigate('/app/home');
    } catch (error) {
      console.error('Error saving letter:', error);
      alert('Failed to save letter');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData?.id || !confirm('Are you sure you want to delete this letter?')) {
      return;
    }

    try {
      const { error } = await supabase.from('samples').delete().eq('id', initialData.id);
      if (error) throw error;
      navigate('/app/home');
    } catch (error) {
      console.error('Error deleting letter:', error);
      alert('Failed to delete letter');
    }
  };

  const handleExportPDF = async () => {
    if (!formData.company_name || !formData.sample_number || !formData.supplier_name) {
      alert('Please enter the company name, letter number, and supplier before exporting the PDF');
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
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const inputClassName =
    'mt-1 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';
  const labelClassName = 'block text-sm font-medium text-gray-700';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <div className="mb-1 flex items-center justify-between gap-3">
            <label htmlFor="company_name" className={labelClassName}>Company Name</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Show in PDF</span>
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
            onChange={(e) => setField('company_name', e.target.value)}
            className={inputClassName}
            required
          >
            <option value="">Select Company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.name}>{company.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="status" className={labelClassName}>Status</label>
          <select
            id="status"
            value={formData.status}
            onChange={(e) => setField('status', e.target.value as Sample['status'])}
            className={inputClassName}
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="sample_number" className={labelClassName}>Letter Number</label>
          <input
            id="sample_number"
            type="text"
            value={formData.sample_number}
            onChange={(e) => setField('sample_number', e.target.value)}
            className={inputClassName}
            required
          />
        </div>

        <div>
          <DatePicker
            label="Date"
            value={formData.date || ''}
            onChange={(val) => setField('date', val)}
          />
        </div>

        <div className="hidden md:block"></div>

        <div className="relative">
          <label htmlFor="supplier_name" className={labelClassName}>Supplier Name</label>
          <div className="relative">
            <input
              id="supplier_name"
              type="text"
              value={supplierSearch}
              onChange={(e) => {
                setSupplierSearch(e.target.value);
                setField('supplier_name', e.target.value);
                setShowSupplierDropdown(true);
              }}
              onFocus={() => setShowSupplierDropdown(true)}
              className={inputClassName}
              placeholder="Search supplier..."
              required
            />
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />
          </div>
          {showSupplierDropdown && filteredContacts.length > 0 && (
            <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-blue-200 bg-white shadow-lg shadow-blue-100">
              {filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => handleSupplierSelect(contact)}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-blue-50"
                >
                  {contact.name}
                </button>
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
            className="mt-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            + Add Address Line
          </button>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="description" className={labelClassName}>Description</label>
          <input
            id="description"
            type="text"
            value={formData.description}
            onChange={(e) => setField('description', e.target.value)}
            className={inputClassName}
            placeholder="Short bold heading for the letter"
          />
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-3">
          <label className={labelClassName}>Letter Details</label>
          <div className="text-[10px] text-gray-500 uppercase font-bold">Basic formatting supported</div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-blue-100 bg-blue-50/70 px-2 py-1.5">
            <button
              type="button"
              onClick={() => applyCommand('bold')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-white text-blue-700 hover:bg-blue-100"
              title="Bold"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyCommand('underline')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-white text-blue-700 hover:bg-blue-100"
              title="Underline"
            >
              <Underline className="h-3.5 w-3.5" />
            </button>

            <select
              value={selectedFontSize}
              onChange={(e) => {
                const next = e.target.value as (typeof FONT_SIZES)[number];
                setSelectedFontSize(next);
                applyInlineStyle({ fontSize: next });
              }}
              className="h-8 rounded-lg border border-blue-200 bg-white px-2 text-xs text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              title="Font size"
            >
              {FONT_SIZES.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>

            <label className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2 text-xs text-blue-700">
              Color
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => {
                  setSelectedColor(e.target.value);
                  applyInlineStyle({ color: e.target.value });
                }}
                className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0"
                title="Text color"
              />
            </label>
          </div>

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onPaste={(event) => {
              event.preventDefault();
              const text = event.clipboardData.getData('text/plain');
              document.execCommand('insertText', false, text);
            }}
            className="min-h-[200px] px-3 py-2 text-sm leading-6 text-gray-800 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="signee_name" className={labelClassName}>Signee Name</label>
          <input
            id="signee_name"
            type="text"
            value={formData.customer_comments || ''}
            onChange={(e) => setField('customer_comments', e.target.value)}
            className={inputClassName}
            placeholder="Name to show under the signature"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {initialData?.id && (
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={generatingPdf}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          >
            <FileDown className="h-3.5 w-3.5" />
            {generatingPdf ? 'Generating...' : 'Export PDF'}
          </button>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  );
};

export default SampleForm;