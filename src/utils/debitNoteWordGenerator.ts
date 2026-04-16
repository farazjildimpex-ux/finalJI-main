import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import type { DebitNote } from '../types';

function buildTemplateData(dn: DebitNote): Record<string, unknown> {
  const dateStr = dn.debit_note_date
    ? new Date(dn.debit_note_date).toLocaleDateString('en-GB')
    : '';
  const contractDateStr = dn.contract_date
    ? new Date(dn.contract_date).toLocaleDateString('en-GB')
    : '';
  const invoiceDateStr = dn.invoice_date
    ? new Date(dn.invoice_date).toLocaleDateString('en-GB')
    : '';

  const commissionPercent =
    dn.local_commission?.match(/.*?%/)?.[0] || dn.local_commission || '';

  const supplierAddr = (dn.supplier_address || []).filter(Boolean);

  const data: Record<string, unknown> = {
    SupplierName: dn.supplier_name || '',
    SupplierAddress: supplierAddr.join('\n'),
    SupplierAddressLines: supplierAddr.map(line => ({ line })),

    DebitNoteNo: dn.debit_note_no || '',
    Date: dateStr,

    ContractNo: dn.contract_no || '',
    ContractDate: contractDateStr,
    BuyerName: dn.buyer_name || '',

    InvoiceNo: dn.invoice_no || '',
    InvoiceDate: invoiceDateStr,
    Quantity: dn.quantity || '',
    Pieces: dn.pieces || '',
    Destination: dn.destination || '',

    CommissionPercent: commissionPercent,
    Currency: dn.currency || '',
    InvoiceValue: dn.invoice_value || '',
    CommissionAmount: Number(dn.commissioning || 0).toFixed(2),
    ExchangeRate: String(dn.exchange_rate || ''),
    CommissionInRupees: Number(dn.commission_in_rupees || 0).toFixed(2),
    CommissionInWords: dn.commission_in_words || '',

    CompanyName: (dn.company || '').toUpperCase(),
  };

  // Add indexed lines for fixed positioning
  for (let i = 0; i < 15; i++) {
    data[`SupplierAddress${i + 1}`] = supplierAddr[i] || '';
  }

  return data;
}

export async function generateDebitNoteWord(
  debitNote: DebitNote,
  templateUrl: string | null | undefined
): Promise<void> {
  if (!templateUrl) {
    alert('No Word template found for this company. Please upload a .docx template in Company Management.');
    return;
  }

  try {
    const resp = await fetch(templateUrl);
    if (!resp.ok) throw new Error(`Failed to fetch template: ${resp.statusText}`);
    const templateBuffer = await resp.arrayBuffer();

    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    });

    try {
      doc.render(buildTemplateData(debitNote));
    } catch (error: any) {
      if (error.properties && error.properties.errors instanceof Array) {
        const errorMessages = error.properties.errors
          .map((e: any) => `• ${e.message} (Tag: ${e.properties.explanation || e.properties.id})`)
          .join('\n');
        throw new Error(`Template Error:\n${errorMessages}`);
      }
      throw error;
    }

    const output = doc.getZip().generate({ type: 'arraybuffer' });
    const blob = new Blob([output], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `debit-note-${debitNote.debit_note_no}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  } catch (err: any) {
    console.error('Word export error:', err);
    alert(err.message || 'Word export failed. Check your template for typos in tags like {{Tag}}.');
  }
}