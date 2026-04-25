import { useEffect, useMemo, useState } from 'react';
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
});

const formatDate = (value: string | null) => {
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
        message: err?.message || 'Please try again.',
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

  const totalInvoiceValue = useMemo(() => {
    if (!invoices.length) return null;
    let sum = 0;
    let hasAny = false;
    for (const inv of invoices) {
      const num = parseFloat((inv.invoice_value || '').replace(/[^0-9.\-]/g, ''));
      if (!Number.isNaN(num)) {
        sum += num;
        hasAny = true;
      }
    }
    return hasAny ? sum : null;
  }, [invoices]);

  const renderEditor = () => {
    if (!editingInvoice) return null;
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-3 sm:p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-blue-900 flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            {isCreatingNew ? 'New Invoice' : `Edit Invoice ${editingInvoice.invoice_number || ''}`}
          </h4>
          <button
            type="button"
            onClick={cancelEdit}
            className="text-gray-400 hover:text-gray-600 p-1"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
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
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Invoice Date
            </label>
            <DatePicker
              value={editingInvoice.invoice_date || ''}
              onChange={(val) => updateField('invoice_date', val || null)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Linked Contracts
          </label>
          <p className="text-[11px] text-gray-500 mb-2">
            This invoice will appear under every contract listed here.
          </p>
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
                    className="text-gray-400 hover:text-rose-600 p-1.5 disabled:opacity-30 disabled:hover:text-gray-400"
                    title={isAnchor ? 'This is the current contract' : 'Remove'}
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
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            <Plus className="h-3 w-3" /> Add Contract Link
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Line Items
          </label>
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_36px] gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              <div>Color</div>
              <div>Selection</div>
              <div>Quantity</div>
              <div></div>
            </div>
            <div className="divide-y divide-gray-100">
              {editingInvoice.line_items.map((item, idx) => (
                <div
                  key={idx}
                  className="px-3 py-2 grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_36px] gap-2 items-center"
                >
                  <input
                    type="text"
                    placeholder="Color"
                    value={item.color}
                    onChange={(e) => updateLineItem(idx, 'color', e.target.value)}
                    className={formInputClass}
                  />
                  <input
                    type="text"
                    placeholder="Selection"
                    value={item.selection}
                    onChange={(e) => updateLineItem(idx, 'selection', e.target.value)}
                    className={formInputClass}
                  />
                  <input
                    type="text"
                    placeholder="Quantity"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                    className={formInputClass}
                  />
                  <button
                    type="button"
                    onClick={() => removeLineItem(idx)}
                    className="text-gray-400 hover:text-rose-600 p-1.5 justify-self-center"
                    title="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={addLineItem}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            <Plus className="h-3 w-3" /> Add Line Item
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
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
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Invoice Value
            </label>
            <input
              type="text"
              value={editingInvoice.invoice_value}
              onChange={(e) => updateField('invoice_value', e.target.value)}
              className={formInputClass}
              placeholder="e.g. 1234.50"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={editingInvoice.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            className={`${formInputClass} resize-y`}
            rows={3}
            placeholder="Shipping details, packing notes, special remarks…"
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-2 border-t border-blue-100">
          <button
            type="button"
            onClick={cancelEdit}
            disabled={saving}
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-200 text-xs font-bold uppercase rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold uppercase rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
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
        className="rounded-xl border border-gray-200 bg-white overflow-hidden hover:border-blue-200 transition-colors"
      >
        <button
          type="button"
          onClick={() => setExpandedId(isExpanded ? null : id)}
          className="w-full text-left px-3 sm:px-4 py-3 flex items-center gap-3 hover:bg-blue-50/40 transition-colors"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
            <Receipt className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-900 truncate">
                {invoice.invoice_number}
              </span>
              <span className="text-[11px] text-gray-500">
                {formatDate(invoice.invoice_date)}
              </span>
              {otherContracts.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-purple-700 bg-purple-50 ring-1 ring-purple-200 rounded-full px-2 py-0.5">
                  <Link2 className="h-2.5 w-2.5" />
                  {otherContracts.length} more
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-[11px] text-gray-500">
              <span>
                {invoice.line_items?.length || 0} line item
                {(invoice.line_items?.length || 0) === 1 ? '' : 's'}
              </span>
              {invoice.invoice_value && (
                <span className="font-semibold text-gray-900">
                  {invoice.invoice_value}
                </span>
              )}
            </div>
          </div>
          <ChevronRight
            className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
        </button>

        {isExpanded && (
          <div className="px-3 sm:px-4 pb-4 pt-0 border-t border-gray-100 bg-gray-50/40 space-y-3">
            {otherContracts.length > 0 && (
              <div className="pt-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">
                  Also linked to
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {otherContracts.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 bg-white ring-1 ring-purple-200 rounded-full px-2 py-0.5"
                    >
                      <Link2 className="h-2.5 w-2.5" />
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(invoice.line_items?.length || 0) > 0 && (
              <div className="pt-1">
                <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
                  <div className="grid grid-cols-3 gap-2 px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                    <div>Color</div>
                    <div>Selection</div>
                    <div>Quantity</div>
                  </div>
                  <div className="divide-y divide-gray-100 text-xs text-gray-700">
                    {invoice.line_items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-3 gap-2 px-3 py-1.5">
                        <div className="truncate">{item.color || '—'}</div>
                        <div className="truncate">{item.selection || '—'}</div>
                        <div className="truncate">{item.quantity || '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {invoice.price_adjustment && (
                <div className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Price Adjustment
                  </span>
                  <p className="text-sm font-semibold text-gray-800">
                    {invoice.price_adjustment}
                  </p>
                </div>
              )}
              {invoice.invoice_value && (
                <div className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5">
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    Invoice Value
                  </span>
                  <p className="text-sm font-semibold text-gray-800">
                    {invoice.invoice_value}
                  </p>
                </div>
              )}
            </div>

            {invoice.notes && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">
                  Notes
                </p>
                <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {invoice.notes}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => handleDelete(invoice)}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-rose-200 px-3 py-1.5 text-xs font-bold uppercase text-rose-600 bg-white hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
              <button
                type="button"
                onClick={() => startEdit(invoice)}
                className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold uppercase text-white bg-blue-600 hover:bg-blue-700"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <h3 className="text-base font-bold text-gray-900">
            Invoices &amp; Shipping Details
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {totalInvoiceValue !== null && (
            <span className="text-xs text-gray-500">
              Total:{' '}
              <span className="font-semibold text-gray-900">
                {totalInvoiceValue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </span>
          )}
          {!isEditing && (
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-md hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Invoice
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      {isEditing && <div className="mb-3">{renderEditor()}</div>}

      {loading ? (
        <div className="text-center py-6 text-gray-500 text-sm">
          Loading invoices…
        </div>
      ) : invoices.length === 0 && !isEditing ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
          <Receipt className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 mb-3">
            No invoices linked to this contract yet.
          </p>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-md hover:bg-blue-100 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Create First Invoice
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((invoice) => renderInvoiceCard(invoice))}
        </div>
      )}
    </div>
  );
};

export default InvoicesSection;
