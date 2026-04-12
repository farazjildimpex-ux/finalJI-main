import React, { useState, useEffect } from 'react';
import { Receipt, Plus, Edit, Trash2, FileDown, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import type { DebitNote } from '../../types';
import { jsPDF } from 'jspdf';

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
    if (!confirm('Are you sure you want to delete this debit note?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('debit_notes')
        .delete()
        .eq('id', debitNoteId);

      if (error) throw error;
      
      // Refresh the list
      await fetchDebitNotes();
      alert('Debit note deleted successfully!');
      
      // Navigate to home after successful deletion
      setTimeout(() => {
        window.location.href = '/app/home';
      }, 1000);
    } catch (error) {
      console.error('Error deleting debit note:', error);
      alert('Failed to delete debit note');
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
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getContractNumbers = (contractNo: string) => {
    return contractNo.split(',').map(c => c.trim());
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Receipt className="h-6 w-6 text-green-600 mr-2" />
          <h2 className="text-xl font-bold text-gray-900">
            Debit Notes for Contract {contractNumber}
          </h2>
        </div>
        <button
          onClick={handleCreateDebitNote}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Debit Note
        </button>
      </div>

      {debitNotes.length === 0 ? (
        <div className="text-center py-8">
          <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-4">No debit notes found for this contract</p>
          <button
            onClick={handleCreateDebitNote}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create First Debit Note
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {debitNotes.map((debitNote) => (
            <div key={debitNote.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Debit Note Header */}
              <div className="bg-gray-50 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {debitNote.debit_note_no}
                    </h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(debitNote.status)}`}>
                      {debitNote.status}
                    </span>
                    <span className="text-sm text-gray-500">
                      Date: {new Date(debitNote.debit_note_date).toLocaleDateString()}
                    </span>
                    {getContractNumbers(debitNote.contract_no).length > 1 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Multiple Contracts
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => toggleExpanded(debitNote.id!)}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {expandedNote === debitNote.id ? 'Hide' : 'View'} Details
                    </button>
                    <button
                      onClick={() => handleExportPDF(debitNote)}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <FileDown className="h-4 w-4 mr-1" />
                      PDF
                    </button>
                    <button
                      onClick={() => handleEditDebitNote(debitNote)}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteDebitNote(debitNote.id!)}
                      className="inline-flex items-center px-3 py-1 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              {/* Debit Note Summary */}
              <div className="px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Supplier</p>
                    <p className="text-sm text-gray-900">{debitNote.supplier_name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Contract No(s)</p>
                    <div className="text-sm text-gray-900">
                      {getContractNumbers(debitNote.contract_no).map((contractNo, index) => (
                        <span key={index} className="inline-block mr-2 mb-1">
                          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                            {contractNo}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Commission (Rupees)</p>
                    <p className="text-sm text-gray-900 font-semibold">₹{debitNote.commission_in_rupees.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedNote === debitNote.id && (
                <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Supplier Details</h4>
                        <p className="text-sm text-gray-700">{debitNote.supplier_name}</p>
                        {debitNote.supplier_address.map((addr, index) => (
                          addr && <p key={index} className="text-sm text-gray-600">{addr}</p>
                        ))}
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Invoice Details</h4>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-700">Invoice No: {debitNote.invoice_no}</p>
                          <p className="text-sm text-gray-700">Quantity: {debitNote.quantity}</p>
                          <p className="text-sm text-gray-700">Pieces: {debitNote.pieces}</p>
                          <p className="text-sm text-gray-700">Destination: {debitNote.destination}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Commission Details</h4>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-700">Local Commission: {debitNote.local_commission}%</p>
                          <p className="text-sm text-gray-700">Invoice Value: {debitNote.invoice_value}</p>
                          <p className="text-sm text-gray-700">Commissioning: {debitNote.commissioning.toFixed(2)}</p>
                          <p className="text-sm text-gray-700">Exchange Rate: {debitNote.exchange_rate.toFixed(2)}</p>
                          <p className="text-sm text-gray-700 font-semibold">Commission in Rupees: ₹{debitNote.commission_in_rupees.toFixed(2)}</p>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Commission in Words</h4>
                        <p className="text-sm text-gray-700 italic">{debitNote.commission_in_words}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DebitNotesSection;