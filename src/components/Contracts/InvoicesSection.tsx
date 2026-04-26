import { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  X,
  Save,
  ChevronRight,
  FileText,
  Truck,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Invoice, InvoiceLineItem, Contract } from '../../types';
import { dialogService } from '../../lib/dialogService';
import DatePicker from '../UI/DatePicker';
import FormRow, { FormSection, formInputClass } from '../UI/FormRow';

interface InvoicesSectionProps {
  contractNumber: string;
}

const createEmptyInvoice = (contractNumber: string): Invoice => ({
  invoice_number: '',
  invoice_date: new Date().toISOString().split('T')[0],
  contract_numbers: [contractNumber],
  line_items: [{ color: '', selection: '', quantity: '' }],
  price_adjustment: '',
  invoice_value: '',
  notes: '',
  bill_type: '',
  bill_number: '',
  shipping_date: null,
});

const formatDate = (value: string | null | undefined) => {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
};

const InvoicesSection: React.FC<InvoicesSectionProps> = ({ contractNumber }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isEditing = editingInvoice !== null;
  const isCreatingNew = isEditing && !editingInvoice?.id;

  useEffect(() => {
    if (contractNumber) {
      fetchInvoices();
      fetchContract();
    }
  }, [contractNumber]);

  const fetchContract = async () => {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('contract_no', contractNumber)
        .maybeSingle();
      if (error) throw error;
      setContract(data);
    } catch (err) {
      console.error('Error fetching contract:', err);
    }
  };

  const fetchInvoices = async () => {
    if (!contractNumber) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('invoices')
        .select('*')
        .contains('contract_numbers', [contractNumber])
        .order('invoice_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setInvoices((data || []) as Invoice[]);
    } catch (err: any) {
      console.error('Error fetching invoices:', err);
      setError(err?.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const startCreate = () => {
    setEditingInvoice(createEmptyInvoice(contractNumber));
    window.scrollTo({ top: document.getElementById('invoice-section-top')?.offsetTop || 0, behavior: 'smooth' });
  };

  const startEdit = (invoice: Invoice) => {
    setEditingInvoice({
      ...invoice,
      contract_numbers: invoice.contract_numbers?.length ? invoice.contract_numbers : [contractNumber],
      line_items: invoice.line_items?.length ? invoice.line_items : [{ color: '', selection: '', quantity: '' }],
    });
    window.scrollTo({ top: document.getElementById('invoice-section-top')?.offsetTop || 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingInvoice(null);
  };

  const handleSave = async () => {
    if (!editingInvoice) return;

    if (!editingInvoice.invoice_number.trim()) {
      dialogService.alert({
        title: 'Missing invoice number',
        message: 'Please enter an invoice number before saving.',
        tone: 'warning',
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in to save invoices.');

      const payload = {
        invoice_number: editingInvoice.invoice_number.trim(),
        invoice_date: editingInvoice.invoice_date || null,
        contract_numbers: editingInvoice.contract_numbers.filter(c => c.trim()),
        line_items: editingInvoice.line_items.filter(i => i.color || i.selection || i.quantity),
        price_adjustment: editingInvoice.price_adjustment || '',
        invoice_value: editingInvoice.invoice_value || '',
        notes: editingInvoice.notes || '',
        bill_type: editingInvoice.bill_type || null,
        bill_number: editingInvoice.bill_number || '',
        shipping_date: editingInvoice.shipping_date || null,
        user_id: user.id,
      };

      if (editingInvoice.id) {
        const { error: updateError } = await supabase.from('invoices').update(payload).eq('id', editingInvoice.id);
        if (updateError) throw updateError;
        dialogService.success('Invoice updated.');
      } else {
        const { error: insertError } = await supabase.from('invoices').insert([payload]);
        if (insertError) throw insertError;
        dialogService.success('Invoice created.');
      }

      setEditingInvoice(null);
      await fetchInvoices();
    } catch (err: any) {
      console.error('Error saving invoice:', err);
      dialogService.alert({ title: 'Could not save invoice', message: err?.message, tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (invoice: Invoice) => {
    if (!invoice.id) return;
    const ok = await dialogService.confirm({
      title: 'Delete invoice?',
      message: `Are you sure you want to delete invoice ${invoice.invoice_number}?`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const { error: deleteError } = await supabase.from('invoices').delete().eq('id', invoice.id);
      if (deleteError) throw deleteError;
      dialogService.success('Invoice deleted.');
      await fetchInvoices();
    } catch (err: any) {
      console.error('Error deleting invoice:', err);
      dialogService.alert({ title: 'Could not delete invoice', message: err?.message, tone: 'danger' });
    }
  };

  const updateField = <K extends keyof Invoice>(field: K, value: Invoice[K]) => {
    setEditingInvoice((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updateLineItem = (index: number, field: keyof InvoiceLineItem, value: string) => {
    setEditingInvoice((prev) => {
      if (!prev) return prev;
      const list = [...prev.line_items];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, line_items: list };
    });
  };

  const addLineItem = () => {
    setEditingInvoice((prev) => prev ? { ...prev, line_items: [...prev.line_items, { color: '', selection: '', quantity: '' }] } : prev);
  };

  const removeLineItem = (index: number) => {
    setEditingInvoice((prev) => {
      if (!prev) return prev;
      const list = prev.line_items.filter((_, i) => i !== index);
      return { ...prev, line_items: list.length ? list : [{ color: '', selection: '', quantity: '' }] };
    });
  };

  const parseQuantity = (raw: string | number | null | undefined) => {
    if (raw === null || raw === undefined) return NaN;
    const cleaned = raw.toString().replace(/,/g, '').trim();
    if (!cleaned) return NaN;
    return parseFloat(cleaned);
  };

  const computeColorTotals = (items: InvoiceLineItem[]) => {
    const map: Record<string, { display: string; total: number }> = {};
    items.forEach((item) => {
      const raw = (item.color || '').trim();
      if (!raw) return;
      const key = raw.toLowerCase();
      const qty = parseQuantity(item.quantity);
      if (Number.isNaN(qty)) return;
      if (!map[key]) map[key] = { display: raw, total: 0 };
      map[key].total += qty;
    });
    return map;
  };

  const getLineShare = (
    item: InvoiceLineItem,
    totals: Record<string, { display: string; total: number }>
  ) => {
    const raw = (item.color || '').trim();
    if (!raw) return null;
    const qty = parseQuantity(item.quantity);
    if (Number.isNaN(qty)) return null;
    const total = totals[raw.toLowerCase()]?.total;
    if (!total) return null;
    return (qty / total) * 100;
  };

  const renderEditor = () => {
    if (!editingInvoice) return null;
    const editorTotals = computeColorTotals(editingInvoice.line_items);

    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
        <FormSection title="Invoice Details" right={<button onClick={cancelEdit} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>}>
          <FormRow label="Invoice Number" required>
            <input
              type="text"
              value={editingInvoice.invoice_number}
              onChange={(e) => updateField('invoice_number', e.target.value)}
              className={formInputClass}
              placeholder="INV-001"
            />
          </FormRow>
          <FormRow label="Invoice Date">
            <DatePicker
              value={editingInvoice.invoice_date || ''}
              onChange={(val) => updateField('invoice_date', val || null)}
            />
          </FormRow>
        </FormSection>

        <FormSection title="Line Items">
          <div className="px-4 sm:px-6 py-4 space-y-3">
            <div className="overflow-x-auto no-scrollbar">
              <div className="min-w-[600px] space-y-2">
                <div className="grid grid-cols-[1fr_1fr_1fr_40px] gap-3 px-1 text-xs font-bold text-gray-500 uppercase tracking-wide">
                  <div>Color</div>
                  <div>Selection</div>
                  <div>Quantity (sqft)</div>
                  <div></div>
                </div>
                {editingInvoice.line_items.map((item, idx) => {
                  const share = getLineShare(item, editorTotals);
                  return (
                    <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_40px] gap-3 items-start">
                      <input type="text" placeholder="Color" value={item.color} onChange={(e) => updateLineItem(idx, 'color', e.target.value)} className={formInputClass} />
                      <input type="text" placeholder="Selection" value={item.selection} onChange={(e) => updateLineItem(idx, 'selection', e.target.value)} className={formInputClass} />
                      <div>
                        <div className="relative">
                          <input type="text" placeholder="Qty" value={item.quantity} onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)} className={`${formInputClass} pr-12`} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 uppercase">sqft</span>
                        </div>
                        {share !== null && (
                          <div className="mt-1 ml-1 text-[10px] font-bold text-blue-600 uppercase">
                            {share.toFixed(2)}% of {item.color}
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => removeLineItem(idx)} className="text-gray-400 hover:text-red-600 p-1 mt-1"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {Object.keys(editorTotals).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {Object.values(editorTotals).map(total => (
                  <div key={total.display} className="px-2 py-1 bg-blue-50 border border-blue-100 rounded text-[10px] font-bold text-blue-700 uppercase">
                    Total {total.display}: {total.total.toLocaleString()} sqft
                  </div>
                ))}
              </div>
            )}

            <button type="button" onClick={addLineItem} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-bold">
              <Plus className="h-3.5 w-3.5" /> Add Row
            </button>
          </div>
        </FormSection>

        <FormSection title="Financials">
          <FormRow label="Price Adjustment">
            <input type="text" value={editingInvoice.price_adjustment} onChange={(e) => updateField('price_adjustment', e.target.value)} className={formInputClass} placeholder="+/- 0.00" />
          </FormRow>
          <FormRow label={`Invoice Value (${contract?.currency || ''})`}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">{contract?.currency}</span>
              <input type="text" value={editingInvoice.invoice_value} onChange={(e) => updateField('invoice_value', e.target.value)} className={`${formInputClass} pl-12 font-bold text-blue-700`} placeholder="0.00" />
            </div>
          </FormRow>
          <FormRow label="Notes">
            <textarea value={editingInvoice.notes} onChange={(e) => updateField('notes', e.target.value)} className={`${formInputClass} resize-none`} rows={2} placeholder="Remarks..." />
          </FormRow>
        </FormSection>

        <FormSection title="Shipping Details">
          <FormRow label="Bill Type">
            <select value={editingInvoice.bill_type || ''} onChange={(e) => updateField('bill_type', e.target.value as any)} className={formInputClass}>
              <option value="">Select Type</option>
              <option value="Airway Bill">Airway Bill</option>
              <option value="Bill of Lading">Bill of Lading</option>
            </select>
          </FormRow>
          <FormRow label="Bill Number">
            <input type="text" value={editingInvoice.bill_number || ''} onChange={(e) => updateField('bill_number', e.target.value)} className={formInputClass} placeholder="Number" />
          </FormRow>
          <FormRow label="Shipping Date">
            <DatePicker value={editingInvoice.shipping_date || ''} onChange={(val) => updateField('shipping_date', val || null)} />
          </FormRow>
        </FormSection>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={cancelEdit} disabled={saving} className="px-4 py-2 border border-gray-300 text-xs font-bold uppercase rounded-md text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-xs font-bold uppercase rounded-md hover:bg-blue-700 shadow-sm">
            <Save className="h-3.5 w-3.5 mr-1.5" /> {saving ? 'Saving...' : isCreatingNew ? 'Save' : 'Update'}
          </button>
        </div>
      </div>
    );
  };

  const renderInvoiceCard = (invoice: Invoice) => {
    const id = invoice.id || '';
    const isExpanded = expandedId === id;
    const viewTotals = computeColorTotals(invoice.line_items);

    return (
      <div key={id} className="rounded-xl border border-gray-200 bg-white overflow-hidden hover:border-blue-200 transition-colors">
        <button type="button" onClick={() => setExpandedId(isExpanded ? null : id)} className="w-full text-left px-4 py-4 flex items-center gap-3 hover:bg-blue-50/40 transition-colors">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-400 ring-1 ring-gray-200"><FileText className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-gray-900">{invoice.invoice_number}</span>
              <span className="text-xs text-gray-500">{formatDate(invoice.invoice_date)}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-4 text-xs text-gray-500">
              <span>{invoice.line_items?.length || 0} items</span>
              <span className="font-bold text-gray-900 text-sm">{contract?.currency} {invoice.invoice_value}</span>
              {invoice.bill_number && <span className="text-blue-600 flex items-center gap-1 font-medium"><Truck className="h-3 w-3" /> {invoice.bill_number}</span>}
            </div>
          </div>
          <ChevronRight className={`h-5 w-5 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </button>

        {isExpanded && (
          <div className="px-4 pb-5 pt-0 border-t border-gray-100 bg-gray-50/40 space-y-4">
            <div className="pt-3 overflow-x-auto no-scrollbar">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-gray-500 uppercase font-bold border-b border-gray-200 text-xs">
                    <th className="text-left py-2">Color</th>
                    <th className="text-left py-2">Selection</th>
                    <th className="text-right py-2">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoice.line_items.map((item, i) => {
                    const share = getLineShare(item, viewTotals);
                    return (
                      <tr key={i}>
                        <td className="py-3 font-medium">{item.color || '—'}</td>
                        <td className="py-3">{item.selection || '—'}</td>
                        <td className="py-3 text-right">
                          <div className="font-bold text-gray-900">{item.quantity ? `${item.quantity} sqft` : '—'}</div>
                          {share !== null && (
                            <div className="text-[10px] font-bold text-blue-600 uppercase">{share.toFixed(2)}% of {item.color}</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {Object.keys(viewTotals).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.values(viewTotals).map(total => (
                  <div key={total.display} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 shadow-sm">
                    <span className="text-blue-600 uppercase mr-1">{total.display}:</span>
                    {total.total.toLocaleString()} sqft
                  </div>
                ))}
              </div>
            )}
            
            {(invoice.bill_type || invoice.bill_number || invoice.shipping_date) && (
              <div className="grid grid-cols-3 gap-3 text-xs bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                <div><p className="text-gray-400 uppercase font-bold text-[10px] mb-0.5">Type</p><p className="font-bold text-gray-900">{invoice.bill_type || '—'}</p></div>
                <div><p className="text-gray-400 uppercase font-bold text-[10px] mb-0.5">Bill #</p><p className="font-bold text-gray-900">{invoice.bill_number || '—'}</p></div>
                <div><p className="text-gray-400 uppercase font-bold text-[10px] mb-0.5">Date</p><p className="font-bold text-gray-900">{formatDate(invoice.shipping_date)}</p></div>
              </div>
            )}

            {invoice.notes && (
              <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                <p className="text-gray-400 uppercase font-bold text-[10px] mb-1">Notes</p>
                <p className="text-sm text-gray-700">{invoice.notes}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
              <button type="button" onClick={() => handleDelete(invoice)} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-rose-200 px-4 py-2 text-xs font-bold uppercase text-rose-600 bg-white hover:bg-rose-50 transition-colors"><Trash2 className="h-4 w-4" /> Delete</button>
              <button type="button" onClick={() => startEdit(invoice)} className="inline-flex items-center justify-center gap-1.5 rounded-md px-5 py-2 text-xs font-bold uppercase text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors"><Edit2 className="h-4 w-4" /> Edit</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div id="invoice-section-top" className="bg-white rounded-lg shadow-lg p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <h3 className="text-base font-bold text-gray-900">Invoices & Shipping</h3>
        </div>
        {!isEditing && (
          <button type="button" onClick={startCreate} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-md hover:bg-blue-700 transition-colors shadow-sm">
            <Plus className="h-3.5 w-3.5" /> Add Invoice
          </button>
        )}
      </div>

      {isEditing ? renderEditor() : (
        <div className="space-y-2">
          {invoices.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
              <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 mb-3">No invoices linked to this contract yet.</p>
              <button type="button" onClick={startCreate} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-md hover:bg-blue-100 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Create First Invoice
              </button>
            </div>
          ) : invoices.map(renderInvoiceCard)}
        </div>
      )}
    </div>
  );
};

export default InvoicesSection;