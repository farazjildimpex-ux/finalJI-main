import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import type { Contract } from '../types';

function buildTemplateData(contract: Contract): Record<string, unknown> {
  const dateStr = contract.contract_date
    ? new Date(contract.contract_date).toLocaleDateString('en-GB')
    : '';

  const supplierAddr = (contract.supplier_address || []).filter(Boolean);
  const buyerAddr = (contract.buyer_address || []).filter(Boolean);
  const importantNotes = (contract.important_notes || []).filter(Boolean);
  const commission = [contract.local_commission, contract.foreign_commission]
    .filter(Boolean)
    .join(', ');

  const selectionRows = (contract.selection || [])
    .map((_, i) => ({
      Selection: contract.selection?.[i] || '',
      Color: contract.color?.[i] || '',
      Swatch: contract.swatch?.[i] || '',
      Quantity: contract.quantity?.[i] || '',
      Price: contract.price?.[i] || '',
    }))
    .filter((r) => r.Selection || r.Color || r.Swatch || r.Quantity || r.Price);

  const data: Record<string, unknown> = {
    SupplierName: contract.supplier_name || '',
    SupplierAddress: supplierAddr.join('\n'),
    SupplierAddressLines: supplierAddr.map(line => ({ line })),
    
    Date: dateStr,
    ContractNo: contract.contract_no || '',
    BuyersRef: contract.buyers_reference || '',

    BuyerName: contract.buyer_name || '',
    BuyerAddress: buyerAddr.join('\n'),
    BuyerAddressLines: buyerAddr.map(line => ({ line })),

    Description: contract.description || '',
    Article: contract.article || '',
    Size: contract.size || '',
    Average: contract.average || '',
    Substance: contract.substance || '',
    Measurement: contract.measurement || '',

    ImportantNotes: importantNotes.join('\n'),
    ImportantNoteLines: importantNotes.map(line => ({ line })),

    Delivery: (contract.delivery_schedule || []).filter(Boolean).join(', '),
    Destination: (contract.destination || []).filter(Boolean).join(', '),
    Payment: contract.payment_terms || '',
    Commission: commission,
    Notify: contract.notify_party || '',
    BankDocuments: contract.bank_documents || '',

    CompanyName: (contract.company_name || '').toUpperCase(),

    Selections: selectionRows,
  };

  // Add indexed lines for fixed positioning (e.g. {{SupplierAddress1}})
  for (let i = 0; i < 10; i++) {
    data[`SupplierAddress${i + 1}`] = supplierAddr[i] || '';
    data[`BuyerAddress${i + 1}`] = buyerAddr[i] || '';
    data[`ImportantNote${i + 1}`] = importantNotes[i] || '';
    
    data[`Selection${i + 1}`] = contract.selection?.[idx] || '';
    data[`Color${i + 1}`] = contract.color?.[idx] || '';
    data[`Swatch${i + 1}`] = contract.swatch?.[idx] || '';
    data[`Quantity${i + 1}`] = contract.quantity?.[idx] || '';
    data[`Price${i + 1}`] = contract.price?.[idx] || '';
  }

  return data;
}

export async function generateContractWord(
  contract: Contract,
  templateUrl: string | null | undefined
): Promise<void> {
  if (!templateUrl) {
    alert(
      'No Word template found for this company.\n\nPlease upload a .docx template in Company Management → Edit Company → Letterhead Template.'
    );
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

    doc.render(buildTemplateData(contract));

    const output = doc.getZip().generate({ type: 'arraybuffer' });
    const blob = new Blob([output], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `contract-${contract.contract_no}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    alert(`Word export failed: ${msg}\n\nMake sure your template uses valid {{Placeholder}} syntax.`);
    console.error('Word export error:', err);
  }
}

export async function extractLetterheadImages(
  templateUrl: string
): Promise<{
  headerBase64: string | null;
  footerBase64: string | null;
  headerExt: string;
  footerExt: string;
}> {
  try {
    const resp = await fetch(templateUrl);
    const buf = await resp.arrayBuffer();
    const zip = new PizZip(buf);

    let headerBase64: string | null = null;
    let headerExt = 'png';
    let footerBase64: string | null = null;
    let footerExt = 'png';

    const headerRelsXml = zip.files['word/_rels/header1.xml.rels']?.asText();
    if (headerRelsXml) {
      const imgMatch = headerRelsXml.match(/Target="media\/(image\d+\.(\w+))"/);
      if (imgMatch) {
        const imgFile = zip.files[`word/media/${imgMatch[1]}`];
        if (imgFile) {
          const uint8 = imgFile.asUint8Array();
          let binary = '';
          for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
          headerBase64 = btoa(binary);
          headerExt = imgMatch[2].toLowerCase();
        }
      }
    }

    const footerRelsXml = zip.files['word/_rels/footer1.xml.rels']?.asText();
    if (footerRelsXml) {
      const imgMatches = [...footerRelsXml.matchAll(/Target="media\/(image\d+\.(\w+))"/g)];
      if (imgMatches.length > 0) {
        const imgFile = zip.files[`word/media/${imgMatches[0][1]}`];
        if (imgFile) {
          const uint8 = imgFile.asUint8Array();
          let binary = '';
          for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
          footerBase64 = btoa(binary);
          footerExt = imgMatches[0][2].toLowerCase();
        }
      }
    }

    return { headerBase64, footerBase64, headerExt, footerExt };
  } catch (err) {
    console.error('Error extracting letterhead images:', err);
    return { headerBase64: null, footerBase64: null, headerExt: 'png', footerExt: 'png' };
  }
}