import React, { useState, useEffect } from 'react';
import { Receipt, Plus, Edit2, Trash2, FileDown, ChevronRight, Link2, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import type { DebitNote } from '../../types';
import { jsPDF } from 'jspdf';
import { dialogService } from '../../lib/dialogService';

interface DebitNotesSectionProps {
  contractNumber: string;
}

const DebitNotesSection: React.FC<DebitNotesSectionProps> = ({ contractNumber }) => {
  const navigate = useNavigate();
  const [debitNotes, setDebitNotes] = useState<DebitNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);

  useEffect(() => {
    fetchDebitNotes();
  }, [contractNumber]);

  const fetchDebitNotes = async () => {
    try {
      setLoading(true);
      
      // Split the contractNumber prop into individual contract numbers
      const contractNumbers = contractNumber.split(',').map(c => c.trim()).filter(c => c);
      
      // Build the query conditions dynamically
      const conditions: string[] = [];
      
      contractNumbers.forEach(contractNo => {
        // Add exact match condition
        conditions.push(`contract_no.eq.${JSON.stringify(contractNo)}`);
        // Add partial match condition for comma-separated values
        conditions.push(`contract_no.like.${JSON.stringify(`%${contractNo}%`)}`);
      });
      
      const orCondition = conditions.join(',');
      
      const { data, error } = await supabase
        .from('debit_notes')
        .select('*')
        .or(orCondition)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Filter results to ensure exact match (handles comma-separated values)
      const filteredData = (data || []).filter(note => {
        const noteContractNumbers = note.contract_no.split(',').map(c => c.trim());
        return contractNumbers.some(contractNo => noteContractNumbers.includes(contractNo));
      });
      
      setDebitNotes(filteredData);
    } catch (error) {
      console.error('Error fetching debit notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDebitNote = () => {
    navigate('/app/debit-notes', { 
      state: { 
        prefilledContractNo: contractNumber 
      } 
    });
  };

  const handleEditDebitNote = (debitNote: DebitNote) => {
    navigate(`/app/debit-notes/${debitNote.id}`, { 
      state: { 
        debitNote 
      } 
    });
  };

  const handleDeleteDebitNote = async (debitNoteId: string) => {
    const ok = await dialogService.confirm({
      title: 'Delete debit note?',
      message: 'Are you sure you want to delete this debit note? This action cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('debit_notes')
        .delete()
        .eq('id', debitNoteId);

      if (error) throw error;

      // Refresh the list
      await fetchDebitNotes();
      dialogService.success('Debit note deleted.');

      // Navigate to home after successful deletion
      setTimeout(() => {
        window.location.href = '/app/home';
      }, 800);
    } catch (error: any) {
      console.error('Error deleting debit note:', error);
      dialogService.alert({
        title: 'Failed to delete debit note',
        message: error?.message || 'Please try again.',
        tone: 'danger',
      });
    }
  };

  const handleExportPDF = (debitNote: DebitNote) => {
    const doc = new jsPDF();
    
    let y = 20;
    const leftMargin = 15;
    const rightMargin = doc.internal.pageSize.width - 15;
    
    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('DEBIT NOTE', doc.internal.pageSize.width / 2, y, { align: 'center' });
    y += 20;

    // Company name if available
    if (debitNote.company) {
      doc.setFontSize(14);
      doc.text(debitNote.company, doc.internal.pageSize.width / 2, y, { align: 'center' });
      y += 15;
    }

    // Debit Note Details
    doc.setFontSize(12);
    doc.text(`Debit Note No: ${debitNote.debit_note_no}`, rightMargin, y, { align: 'right' });
    y += 10;
    doc.text(`Date: ${debitNote.debit_note_date}`, rightMargin, y, { align: 'right' });
    y += 10;
    doc.text(`Status: ${debitNote.status}`, rightMargin, y, { align: 'right' });
    y += 10;
    if (debitNote.currency) {
      doc.text(`Currency: ${debitNote.currency}`, rightMargin, y, { align: 'right' });
    }
    y += 20;

    // Supplier Details
    doc.setFont('helvetica', 'bold');
    doc.text('SUPPLIER:', leftMargin, y);
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.text(debitNote.supplier_name, leftMargin, y);
    y += 10;
    debitNote.supplier_address.forEach(addr => {
      if (addr) {
        doc.text(addr, leftMargin, y);
        y += 8;
      }
    });
    y += 10;

    // Contract Numbers (handle multiple)
    doc.setFont('helvetica', 'bold');
    doc.text('Contract No(s):', leftMargin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(debitNote.contract_no, leftMargin + 50, y);
    y += 15;

    // Contract and Invoice Details
    const details = [
      ['Buyer Name:', debitNote.buyer_name],
      ['Invoice No:', debitNote.invoice_no],
      ['Quantity:', debitNote.quantity],
      ['Pieces:', debitNote.pieces],
      ['Destination:', debitNote.destination],
      ['Local Commission:', debitNote.local_commission + '%'],
      ['Invoice Value:', debitNote.invoice_value],
      ['Commissioning:', debitNote.commissioning.toFixed(2)],
      ['Exchange Rate:', debitNote.exchange_rate.toFixed(2)],
      ['Commission in Rupees:', debitNote.commission_in_rupees.toFixed(2)],
      ['Commission in Words:', debitNote.commission_in_words]
    ];

    details.forEach(([label, value]) => {
      if (value) {
        doc.setFont('helvetica', 'bold');
        doc.text(label, leftMargin, y);
        doc.setFont('helvetica', 'normal');
        doc.text(value, leftMargin + 50, y);
        y += 10;
      }
    });

    doc.save(`debit-note-${debitNote.debit_note_no}.pdf`);
  };

  const toggleExpanded = (debitNoteId: string) => {
    setExpandedNote(expandedNote === debitNoteId ? null : debitNoteId);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'issued':
        return 'bg-blue-50 text-blue-700 ring-blue-200';
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
      default:
        return 'bg-gray-100 text-gray-700 ring-gray-200';
    }
  };

  const getContractNumbers = (contractNo: string) => {
    return contractNo.split(',').map(c => c.trim()).filter(Boolean);
  };

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

  const renderDebitNoteCard = (debitNote: DebitNote) => {
    const id = debitNote.id || '';
    const isExpanded = expandedNote === id;
    const contracts = getContractNumbers(debitNote.contract_no);
    const otherContracts = contracts.filter((c) => c !== contractNumber);

    return (
      <div
        key={id}
        className="rounded-xl border border-gray-200 bg-white overflow-hidden hover:border-blue-200 transition-colors"
      >
        <button
          type="button"
          onClick={() => toggleExpanded(id)}
          className="w-full text-left px-3 sm:px-4 py-3 flex items-center gap-3 hover:bg-blue-50/40 transition-colors"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
            <Receipt className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-900 truncate">
                {debitNote.debit_note_no}
              </span>
              <span
                className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ring-1 ${getStatusColor(
                  debitNote.status
                )}`}
              >
                {debitNote.status}
              </span>
              <span className="text-[11px] text-gray-500">
                {formatDate(debitNote.debit_note_date)}
              </span>
              {otherContracts.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-purple-700 bg-purple-50 ring-1 ring-purple-200 rounded-full px-2 py-0.5">
                  <Link2 className="h-2.5 w-2.5" />
                  {otherContracts.length} more
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-[11px] text-gray-500">
              <span className="truncate">{debitNote.supplier_name}</span>
              <span className="font-semibold text-gray-900">
                ₹{debitNote.commission_in_rupees.toFixed(2)}
              </span>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                  Supplier
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {debitNote.supplier_name}
                </p>
                {debitNote.supplier_address?.filter(Boolean).map((addr, i) => (
                  <p key={i} className="text-xs text-gray-600 leading-relaxed">
                    {addr}
                  </p>
                ))}
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">
                  Invoice Details
                </p>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <dt className="text-gray-500">Invoice No</dt>
                  <dd className="text-gray-900 font-medium">{debitNote.invoice_no || '—'}</dd>
                  <dt className="text-gray-500">Quantity</dt>
                  <dd className="text-gray-900 font-medium">{debitNote.quantity || '—'}</dd>
                  <dt className="text-gray-500">Pieces</dt>
                  <dd className="text-gray-900 font-medium">{debitNote.pieces || '—'}</dd>
                  <dt className="text-gray-500">Destination</dt>
                  <dd className="text-gray-900 font-medium">{debitNote.destination || '—'}</dd>
                </dl>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-3 md:col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">
                  Commission
                </p>
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
                  <dt className="text-gray-500">Local %</dt>
                  <dd className="text-gray-900 font-medium">{debitNote.local_commission}%</dd>
                  <dt className="text-gray-500">Invoice Value</dt>
                  <dd className="text-gray-900 font-medium">{debitNote.invoice_value || '—'}</dd>
                  <dt className="text-gray-500">Commissioning</dt>
                  <dd className="text-gray-900 font-medium">{debitNote.commissioning.toFixed(2)}</dd>
                  <dt className="text-gray-500">Exchange Rate</dt>
                  <dd className="text-gray-900 font-medium">{debitNote.exchange_rate.toFixed(2)}</dd>
                  <dt className="text-gray-500">Rupees</dt>
                  <dd className="text-blue-700 font-bold">
                    ₹{debitNote.commission_in_rupees.toFixed(2)}
                  </dd>
                </dl>
                {debitNote.commission_in_words && (
                  <p className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-600 italic">
                    {debitNote.commission_in_words}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => handleDeleteDebitNote(id)}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-rose-200 px-3 py-1.5 text-xs font-bold uppercase text-rose-600 bg-white hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
              <button
                type="button"
                onClick={() => handleExportPDF(debitNote)}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-bold uppercase text-gray-700 bg-white hover:bg-gray-50"
              >
                <FileDown className="h-3.5 w-3.5" />
                PDF
              </button>
              <button
                type="button"
                onClick={() => handleEditDebitNote(debitNote)}
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
            Debit Notes
          </h3>
        </div>
        <button
          type="button"
          onClick={handleCreateDebitNote}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-md hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Debit Note
        </button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-gray-500 text-sm">
          Loading debit notes…
        </div>
      ) : debitNotes.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
          <Receipt className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 mb-3">
            No debit notes linked to this contract yet.
          </p>
          <button
            type="button"
            onClick={handleCreateDebitNote}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-md hover:bg-blue-100 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Create First Debit Note
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {debitNotes.map((debitNote) => renderDebitNoteCard(debitNote))}
        </div>
      )}
    </div>
  );
};

export default DebitNotesSection;