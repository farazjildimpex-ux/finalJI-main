import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import MobilePageHeader from '../Layout/MobilePageHeader';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../UI/Button';

const ContactHistoryPage: React.FC = () => {
  const { id } = useParams();
  const [contact, setContact] = useState<any | null>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'contracts'|'payments'>('contracts');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  useEffect(() => { if (id) fetchAll(); }, [id]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const { data: cData } = await supabase.from('contact_book').select('*').eq('id', id).single();
      setContact(cData || null);

      const name = cData?.name || '';
      const like = `%${name}%`;

      const { data: cRows } = await supabase
        .from('contracts')
        .select('*')
        .or(`buyer_name.ilike.${like},supplier_name.ilike.${like}`)
        .order('contract_date', { ascending: false });
      setContracts(cRows || []);

      const { data: pRows } = await supabase
        .from('debit_notes')
        .select('*')
        .or(`buyer_name.ilike.${like},supplier_name.ilike.${like}`)
        .order('debit_note_date', { ascending: false });
      setPayments(pRows || []);
    } catch (err) {
      console.error('Error fetching contact history', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredContracts = useMemo(() => {
    if (!fromDate && !toDate) return contracts;
    return contracts.filter(c => {
      const d = c.contract_date ? new Date(c.contract_date) : null;
      if (!d) return true;
      if (fromDate && d < new Date(fromDate)) return false;
      if (toDate && d > new Date(toDate)) return false;
      return true;
    });
  }, [contracts, fromDate, toDate]);

  const filteredPayments = useMemo(() => {
    if (!fromDate && !toDate) return payments;
    return payments.filter(p => {
      const d = p.debit_note_date ? new Date(p.debit_note_date) : null;
      if (!d) return true;
      if (fromDate && d < new Date(fromDate)) return false;
      if (toDate && d > new Date(toDate)) return false;
      return true;
    });
  }, [payments, fromDate, toDate]);

  const exportXlsx = async () => {
    const XLSX = await import('xlsx');
    const FileSaver = (await import('file-saver')).default;

    const rows = (tab === 'contracts' ? filteredContracts : filteredPayments).map(r => ({
      Date: r.contract_date || r.debit_note_date || '',
      Ref: r.contract_no || r.debit_note_no || r.id,
      Party: r.buyer_name || r.supplier_name || '',
      Value: r.invoice_value || r.total_amount || r.value || '',
      Notes: r.description || r.notes || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab === 'contracts' ? 'Contracts' : 'Payments');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    FileSaver(new Blob([wbout], { type: 'application/octet-stream' }), `${(contact?.name||'contact-history')}-${tab}.xlsx`);
  };

  const exportPdf = async () => {
    const { default: html2canvas } = await import('html2canvas');
    const jsPDF = (await import('jspdf')).default;

    const table = document.getElementById('history-export-table');
    if (!table) return;
    const canvas = await html2canvas(table as HTMLElement, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = (pdf as any).getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 10, 10, pdfWidth - 20, pdfHeight);
    pdf.save(`${(contact?.name||'contact-history')}-${tab}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-50/60 overflow-y-auto">
      <div className="px-4 py-6 max-w-5xl mx-auto space-y-4 page-fade-in pb-12">
        <MobilePageHeader
          eyebrow="History"
          title={contact ? contact.name : 'Contact History'}
          subtitle={contact ? `Contracts & Payments · ${contact.name}` : 'Contracts and payments for this contact'}
        />

        <div className="flex items-center gap-3">
          <button onClick={() => setTab('contracts')} className={`px-4 py-2 rounded-2xl ${tab==='contracts'? 'bg-blue-600 text-white':'bg-white border'}`}>Contracts</button>
          <button onClick={() => setTab('payments')} className={`px-4 py-2 rounded-2xl ${tab==='payments'? 'bg-blue-600 text-white':'bg-white border'}`}>Payments</button>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm text-slate-500">From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-2 py-1 border rounded-md" />
            <label className="text-sm text-slate-500">To</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-2 py-1 border rounded-md" />
            <button onClick={() => { setFromDate(''); setToDate(''); }} className="text-sm text-slate-500 hover:underline">Clear</button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={exportXlsx} className="px-4 py-2 rounded-2xl bg-emerald-600 text-white">Export XLSX</button>
          <button onClick={exportPdf} className="px-4 py-2 rounded-2xl bg-slate-700 text-white">Export PDF</button>
          <Link to="/app/contacts" className="ml-auto text-sm text-slate-500 hover:underline">Back to contacts</Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 overflow-auto">
          <div id="history-export-table" className="min-w-full">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ref</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Party</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {(tab === 'contracts' ? filteredContracts : filteredPayments).map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 align-top text-sm text-gray-700">{(r.contract_date || r.debit_note_date) ? new Date(r.contract_date || r.debit_note_date).toLocaleDateString('en-GB') : ''}</td>
                    <td className="px-6 py-4 align-top text-sm text-gray-700">{r.contract_no || r.debit_note_no || r.id}</td>
                    <td className="px-6 py-4 align-top text-sm text-gray-700">{r.buyer_name || r.supplier_name || ''}</td>
                    <td className="px-6 py-4 align-top text-sm text-gray-700 text-right">{r.invoice_value || r.total_amount || r.value || ''}</td>
                    <td className="px-6 py-4 align-top text-sm text-gray-600 max-w-xl break-words">{r.description || r.notes || ''}</td>
                  </tr>
                ))}
                {((tab === 'contracts' ? filteredContracts : filteredPayments).length === 0) && (
                  <tr><td colSpan={5} className="py-10 text-center text-slate-400">No records</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactHistoryPage;
