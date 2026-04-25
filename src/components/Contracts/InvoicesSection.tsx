import { useEffect, useState } from 'react';
import {
  Receipt,
  Plus,
  Trash2,
  Edit2,
  X,
  Save,
  ChevronDown,
  ChevronRight,
  FileText,
  Link2,
  Truck,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Invoice, InvoiceLineItem } from '../../types';
import { dialogService } from '../../lib/dialogService';
import DatePicker from '../UI/DatePicker';
import { formInputClass } from '../UI/FormRow';

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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isEditing = editingInvoice !== null;
  const isCreatingNew = isEditing && !editingInvoice?.id;

  useEffect(() => {
    if (contractNumber) fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractNumber]);

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
  };

  const startEdit = (invoice: Invoice) => {
    setEditingInvoice({
      ...invoice,
      contract_numbers: invoice.contract_numbers?.length
        ? invoice.contract_numbers
        : [contractNumber],
      line_items: invoice.line_items?.length
        ? invoice.line_items
        : [{ color: '', selection: '', quantity: '' }],
    });
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

    const cleanedContracts = (editingInvoice.contract_numbers || [])
      .map((c) => c.trim())
      .filter(Boolean);
    const finalContracts = cleanedContracts.includes(contractNumber)
      ? cleanedContracts
      : [contractNumber, ...cleanedContracts];

    const cleanedLineItems = (editingInvoice.line_items || []).filter(
      (item) =>
        (item.color || '').trim() ||
        (item.selection || '').trim() ||
        (item.quantity || '').trim()
    );

    setSaving(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('You must be signed in to save invoices.');

      const payload = {
        invoice_number: editingInvoice.invoice_number.trim(),
        invoice_date: editingInvoice.invoice_date || null,
        contract_numbers: finalContracts,
        line_items: cleanedLineItems,
        price_adjustment: editingInvoice.price_adjustment || '',
        invoice_value: editingInvoice.invoice_value || '',
        notes: editingInvoice.notes || '',
        bill_type: editingInvoice.bill_type || null,
        bill_number: editingInvoice.bill_number || '',
        shipping_date: editingInvoice.shipping_date || null,
        user_id: user.id,
      };

      if (editingInvoice.id) {
        const { error: updateError } = await supabase
          .from('invoices')
          .update(payload)
          .eq('id', editingInvoice.id);
        if (updateError) throw updateError;
        dialogService.success('Invoice updated.');
      } else {
        const { error: insertError } = await supabase
          .from('invoices')
          .insert([payload]);
        if (insertError) throw insertError;
        dialogService.success('Invoice created.');
      }

      setEditingInvoice(null);
      await fetchInvoices();
    } catch (err: any) {
      console.error('Error saving invoice:', err);
      dialogService.alert({
        title: 'Could not save invoice',
        message: err?.message || 'Something went wrong. Please try again.',
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (invoice: Invoice) => {
    if (!invoice.id) return;
    const ok = await dialogService.confirm({
      title: 'Delete invoice?',
      message: `Are you sure you want to delete invoice ${invoice.invoice_number}? This action cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const { error: deleteError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id);
      if (deleteError) throw deleteError;
      dialogService.success('Invoice deleted.');
      await fetchInvoices();
    } catch (err: any) {
      console.error('Error deleting invoice:', err);
      dialogService.alert({
        title: 'Could not delete invoice',
        message: err?.message || 'Something went wrong. Please try again.',
        tone: 'danger',
      });
    }
  };

  const updateField = <K extends keyof Invoice>(field: K, value: Invoice[K]) => {
    setEditingInvoice((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updateContractNumber = (index: number, value: string) => {
    setEditingInvoice((prev) => {
      if (!prev) return prev;
      const list = [...prev.contract_numbers];
      list[index] = value;
      return { ...prev, contract_numbers: list };
    });
  };

  const addContractNumber = () => {
    setEditingInvoice((prev) =>
      prev
        ? { ...prev, contract_numbers: [...prev.contract_numbers, ''] }
        : prev
    );
  };

  const removeContractNumber = (index: number) => {
    setEditingInvoice((prev) => {
      if (!prev) return prev;
      const list = prev.contract_numbers.filter((_, i) => i !== index);
      return {
        ...prev,
        contract_numbers: list.length ? list : [contractNumber],
      };
    });
  };

  const updateLineItem = (
    index: number,
    field: keyof InvoiceLineItem,
    value: string
  ) => {
    setEditingInvoice((prev) => {
      if (!prev) return prev;
      const list = [...prev.line_items];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, line_items: list };
    });
  };

  const addLineItem = () => {
    setEditingInvoice((prev) =>
      prev
        ? {
            ...prev,
            line_items: [
              ...prev.line_items,
              { color: '', selection: '', quantity: '' },
            ],
          }
        : prev
    );
  };

  const removeLineItem = (index: number) => {
    setEditingInvoice((prev) => {
      if (!prev) return prev;
      const list = prev.line_items.filter((_, i) => i !== index);
      return {
        ...prev,
        line_items: list.length ? list : [{ color: '', selection: '', quantity: '' }],
      };
    });
  };

  const computeColorTotals = (items: InvoiceLineItem[]) => {
    const map: Record<string, { display: string; total: number }> = {};
    items.forEach((item) => {
      const raw = (item.color || '').trim();
      if (!raw) return;
      const key = raw.toLowerCase();
      const qty = parseFloat((item.quantity || '').toString());
      if (Number.isNaN(qty)) return;
      if (!map[key]) map[key] = { display: raw, total: 0 };
      map[key].total += qty;
    });
    return map;
  };

  const formatNumber = (n: number) => {
    if (!Number.isFinite(n)) return '';
    return Number.isInteger(n)
      ? n.toString()
      : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const getLineShare = (
    item: InvoiceLineItem,
    totals: Record<string, { display: string; total: number }>
  ) => {
    const raw = (item.color || '').trim();
    if (!raw) return null;
    const qty = parseFloat((item.quantity || '').toString());
    if (Number.isNaN(qty)) return null;
    const total = totals[raw.toLowerCase()]?.total;
    if (!total) return null;
    return (qty / total) * 100;
  };

  const renderEditor = () => {
    if (!editingInvoice) return null;
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-bold text-blue-900 flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {isCreatingNew ? 'New Invoice' : `Edit Invoice ${editingInvoice.invoice_number || ''}`}
          </h4>
          <button
            type="button"
            onClick={cancelEdit}
            className="text-gray-400 hover:text-gray-600 p-1"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Invoice Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={editingInvoice.invoice_number}
              onChange={(e) => updateField('invoice_number', e.target.value)}
              className={formInputClass}
              placeholder="e.g. INV-2026-001"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Invoice Date
            </label>
            <DatePicker
              value={editingInvoice.invoice_date || ''}
              onChange={(val) => updateField('invoice_date', val || null)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
            Linked Contracts
          </label>
          <div className="space-y-2">
            {editingInvoice.contract_numbers.map((num, idx) => {
              const isAnchor = num.trim() === contractNumber;
              return (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={num}
                    onChange={(e) => updateContractNumber(idx, e.target.value)}
                    className={formInputClass}
                    placeholder="Contract number"
                  />
                  <button
                    type="button"
                    onClick={() => removeContractNumber(idx)}
                    disabled={isAnchor}
                    className="text-gray-400 hover:text-rose-600 p-1.5 disabled:opacity-30"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={addContractNumber}
            className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
          >
            <Plus className="h-3 w-3" /> Add Contract Link
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
            Line Items
          </label>
          {(() => {
            const editorTotals = computeColorTotals(editingInvoice.line_items);
            return (
              <>
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <div className="min-w-[600px]">
                      <div className="grid grid-cols-[1.2fr_1.2fr_1.5fr_48px] gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 text-[11px] font-black uppercase tracking-widest text-gray-400">
                        <div>Color</div>
                        <div>Selection</div>
                        <div>Quantity (sqft)</div>
                        <div></div>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {editingInvoice.line_items.map((item, idx) => {
                          const share = getLineShare(item, editorTotals);
                          return (
                            <div
                              key={idx}
                              className="px-4 py-3 grid grid-cols-[1.2fr_1.2fr_1.5fr_48px] gap-3 items-start"
                            >
                              <input
                                type="text"
                                placeholder="Color"
                                value={item.color}
                                onChange={(e) => updateLineItem(idx, 'color', e.target.value)}
                                className={`${formInputClass} py-2.5 text-base`}
                              />
                              <input
                                type="text"
                                placeholder="Selection"
                                value={item.selection}
                                onChange={(e) => updateLineItem(idx, 'selection', e.target.value)}
                                className={`${formInputClass} py-2.5 text-base`}
                              />
                              <div>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="Quantity"
                                  value={item.quantity}
                                  onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                                  className={`${formInputClass} py-2.5 text-base font-bold`}
                                />
                                {item.quantity && (
                                  <div className="mt-1.5 ml-1 text-[11px] font-bold text-gray-400 flex items-center gap-2">
                                    <span className="uppercase tracking-tighter">SQFT</span>
                                    {share !== null && (
                                      <>
                                        <span className="h-1 w-1 bg-gray-200 rounded-full" />
                                        <span className="text-blue-600">
                                          {share.toFixed(2)}%
                                        </span>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeLineItem(idx)}
                                className="text-gray-300 hover:text-rose-600 p-2 mt-1 transition-colors"
                                title="Remove line"
                              >
                                <Trash2 className="h-5 w-5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                {Object.keys(editorTotals).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.values(editorTotals).map((entry) => (
                      <span
                        key={entry.display}
                        className="inline-flex items-center gap-2 text-xs font-bold text-gray-700 bg-blue-50 ring-1 ring-blue-100 rounded-lg px-3 py-1.5"
                      >
                        <span className="text-blue-700">{entry.display}</span>
                        <span className="text-gray-300">|</span>
                        <span>{formatNumber(entry.total)} sqft</span>
                      </span>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={addLineItem}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:underline"
                >
                  <Plus className="h-4 w-4" /> Add Line Item
                </button>
              </>
            );
          })()}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Price Adjustment
            </label>
            <input
              type="text"
              value={editingInvoice.price_adjustment}
              onChange={(e) => updateField('price_adjustment', e.target.value)}
              className={formInputClass}
              placeholder="e.g. -50.00 or +120.00"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Invoice Value
            </label>
            <input
              type="text"
              value={editingInvoice.invoice_value}
              onChange={(e) => updateField('invoice_value', e.target.value)}
              className={`${formInputClass} font-bold text-blue-700`}
              placeholder="e.g. 1234.50"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
            Notes
          </label>
          <textarea
            value={editingInvoice.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            className={`${formInputClass} resize-y`}
            rows={3}
            placeholder="Packing notes, special remarks…"
          />
        </div>

        {/* Shipping Details Section - Moved to bottom */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <h5 className="text-xs font-black uppercase tracking-widest text-blue-600 flex items-center gap-2">
            <Truck className="h-3.5 w-3.5" /> Shipping Details
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                Bill Type
              </label>
              <select
                value={editingInvoice.bill_type || ''}
                onChange={(e) => updateField('bill_type', e.target.value as any)}
                className={formInputClass}
              >
                <option value="">Select Type</option>
                <option value="Airway Bill">Airway Bill</option>
                <option value="Bill of Lading">Bill of Lading</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                Bill Number
              </label>
              <input
                type="text"
                value={editingInvoice.bill_number || ''}
                onChange={(e) => updateField('bill_number', e.target.value)}
                className={formInputClass}
                placeholder="Enter number"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                Shipping Date
              </label>
              <DatePicker
                value={editingInvoice.shipping_date || ''}
                onChange={(val) => updateField('shipping_date', val || null)}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-4 border-t border-blue-100">
          <button
            type="button"
            onClick={cancelEdit}
            disabled={saving}
            className="inline-flex items-center justify-center px-6 py-2.5 border border-gray-200 text-xs font-black uppercase tracking-widest rounded-xl text-gray-500 bg-white hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center px-8 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving…' : isCreatingNew ? 'Save Invoice' : 'Update Invoice'}
          </button>
        </div>
      </div>
    );
  };

  const renderInvoiceCard = (invoice: Invoice) => {
    const id = invoice.id || '';
    const isExpanded = expandedId === id;
    const otherContracts = (invoice.contract_numbers || []).filter(
      (c) => c !== contractNumber
    );

    return (
      <div
        key={id}
        className="rounded-2xl border border-gray-200 bg-white overflow-hidden hover:border-blue-200 transition-all duration-200 shadow-sm"
      >
        <button
          type="button"
          onClick={() => setExpandedId(isExpanded ? null : id)}
          className="w-full text-left px-4 py-4 flex items-center gap-4 hover:bg-blue-50/30 transition-colors"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
            <Receipt className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-gray-900 truncate">
                {invoice.invoice_number}
              </span>
              <span className="text-xs font-medium text-gray-400">
                {formatDate(invoice.invoice_date)}
              </span>
              {otherContracts.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter text-purple-600 bg-purple-50 ring-1 ring-purple-100 rounded-full px-2 py-0.5">
                  <Link2 className="h-2.5 w-2.5" />
                  +{otherContracts.length}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-4 text-xs font-medium text-gray-500">
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {invoice.line_items?.length || 0} items
              </span>
              {invoice.invoice_value && (
                <span className="font-bold text-gray-900">
                  {invoice.invoice_value}
                </span>
              )}
              {invoice.bill_number && (
                <span className="flex items-center gap-1 text-blue-600">
                  <Truck className="h-3 w-3" />
                  {invoice.bill_number}
                </span>
              )}
            </div>
          </div>
          <ChevronRight
            className={`h-5 w-5 text-gray-300 shrink-0 transition-transform duration-300 ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
        </button>

        {isExpanded && (
          <div className="px-4 pb-5 pt-0 border-t border-gray-100 bg-gray-50/30 space-y-4">
            {otherContracts.length > 0 && (
              <div className="pt-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                  Linked Contracts
                </p>
                <div className="flex flex-wrap gap-2">
                  {otherContracts.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 bg-white ring-1 ring-purple-100 rounded-lg px-2.5 py-1"
                    >
                      <Link2 className="h-3 w-3" />
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Shipping Info Display */}
            {(invoice.bill_type || invoice.bill_number || invoice.shipping_date) && (
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border border-gray-100 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Bill Type</p>
                  <p className="text-sm font-bold text-gray-900">{invoice.bill_type || '—'}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Bill Number</p>
                  <p className="text-sm font-bold text-gray-900">{invoice.bill_number || '—'}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Shipping Date</p>
                  <p className="text-sm font-bold text-gray-900">{formatDate(invoice.shipping_date)}</p>
                </div>
              </div>
            )}

            {(invoice.line_items?.length || 0) > 0 && (() => {
              const viewTotals = computeColorTotals(invoice.line_items);
              return (
                <div className="pt-2">
                  <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
                    <div className="overflow-x-auto">
                      <div className="min-w-[500px]">
                        <div className="grid grid-cols-[1.2fr_1.2fr_1.5fr] gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-[10px] font-black uppercase tracking-widest text-gray-400">
                          <div>Color</div>
                          <div>Selection</div>
                          <div>Quantity</div>
                        </div>
                        <div className="divide-y divide-gray-100 text-sm text-gray-700">
                          {invoice.line_items.map((item, idx) => {
                            const share = getLineShare(item, viewTotals);
                            return (
                              <div key={idx} className="grid grid-cols-[1.2fr_1.2fr_1.5fr] gap-3 px-4 py-3">
                                <div className="font-medium">{item.color || '—'}</div>
                                <div className="font-medium">{item.selection || '—'}</div>
                                <div className="font-bold text-gray-900">
                                  {item.quantity ? (
                                    <span className="inline-flex items-center gap-2">
                                      <span>{item.quantity}</span>
                                      <span className="text-[10px] uppercase tracking-tighter text-gray-400">sqft</span>
                                      {share !== null && (
                                        <span className="text-[11px] font-black text-blue-600 ml-1">
                                          {share.toFixed(2)}%
                                        </span>
                                      )}
                                    </span>
                                  ) : (
                                    '—'
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                  {Object.keys(viewTotals).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.values(viewTotals).map((entry) => (
                        <span
                          key={entry.display}
                          className="inline-flex items-center gap-2 text-[11px] font-bold text-gray-600 bg-white ring-1 ring-gray-200 rounded-lg px-2.5 py-1"
                        >
                          <span className="text-blue-600">{entry.display}</span>
                          <span className="text-gray-300">·</span>
                          <span>{formatNumber(entry.total)} sqft</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {invoice.price_adjustment && (
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                  <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">
                    Price Adjustment
                  </span>
                  <p className="text-base font-bold text-gray-800 mt-0.5">
                    {invoice.price_adjustment}
                  </p>
                </div>
              )}
              {invoice.invoice_value && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
                  <span className="text-[10px] uppercase font-black tracking-widest text-blue-400">
                    Invoice Value
                  </span>
                  <p className="text-lg font-black text-blue-700 mt-0.5">
                    {invoice.invoice_value}
                  </p>
                </div>
              )}
            </div>

            {invoice.notes && (
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                  Notes & Remarks
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {invoice.notes}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => handleDelete(invoice)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-100 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-rose-600 bg-white hover:bg-rose-50 transition-all"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
              <button
                type="button"
                onClick={() => startEdit(invoice)}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-100 transition-all active:scale-95"
              >
                <Edit2 className="h-4 w-4" />
                Edit
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-200">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-gray-900 tracking-tight">
              Invoices & Shipping
            </h3>
            <p className="text-xs font-medium text-gray-400">Track shipments and billing details</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isEditing && (
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Add Invoice
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 flex items-center gap-3">
          <X className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {isEditing && <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-300">{renderEditor()}</div>}

      {loading ? (
        <div className="text-center py-12 text-gray-400">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm font-bold uppercase tracking-widest">Loading invoices…</p>
        </div>
      ) : invoices.length === 0 && !isEditing ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-3xl bg-gray-50/30">
          <div className="h-16 w-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 ring-1 ring-gray-100">
            <Receipt className="h-8 w-8 text-gray-200" />
          </div>
          <p className="text-base font-bold text-gray-400 mb-4">
            No invoices linked to this contract yet.
          </p>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-600 text-xs font-black uppercase tracking-widest rounded-xl border border-blue-100 hover:bg-blue-50 transition-all shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Create First Invoice
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => renderInvoiceCard(invoice))}
        </div>
      )}
    </div>
  );
};

export default InvoicesSection;