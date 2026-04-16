import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import type { Contract } from '../types';

/**
 * Fixes a well-known issue with Google Docs .docx exports where template tags
 * like {{SupplierName}} are split across multiple internal XML runs, causing
 * docxtemplater to fail with "tag not found" errors.
 *
 * Google Docs splits a tag like {{Date}} into separate <w:r> runs with
 * structure like: <w:t>{{</w:t></w:r><w:r><w:rPr>…</w:rPr><w:t>Date}}</w:t>
 * Between the two text halves sit 3–4 consecutive XML elements, not just one,
 * so the fix must remove ALL of them at once.
 *
 * Strategy:
 *  1. Process each <w:p> paragraph independently — this prevents the regex
 *     from accidentally collapsing paragraph boundaries.
 *  2. Within each paragraph use (?:<[^>]+>)+ to strip a whole sequence of
 *     consecutive XML elements that sits between a { and a } in one pass.
 *  3. Iterate until the paragraph XML is stable (handles exotic multi-fragment splits).
 */
function fixGoogleDocsSplitTags(zip: PizZip): void {
  const filesToFix = Object.keys(zip.files).filter((name) =>
    /^word\/(document|header\d*|footer\d*)\.xml$/.test(name)
  );

  for (const fileName of filesToFix) {
    const file = zip.files[fileName];
    if (!file) continue;
    let xml = file.asText();

    // Process each paragraph block in isolation so we never touch paragraph markers.
    xml = xml.replace(/(<w:p[ >][\s\S]*?<\/w:p>)/g, (para) => {
      let fixed = para;
      let prev = '';
      while (prev !== fixed) {
        prev = fixed;
        // Remove ONE OR MORE consecutive XML elements sitting between { … }
        fixed = fixed.replace(/(\{[^<>]*)(?:<[^>]+>)+([^<>]*\})/g, '$1$2');
      }
      return fixed;
    });

    zip.file(fileName, xml);
  }
}

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
    SupplierAddressLines: supplierAddr.map((line) => ({ line })),

    Date: dateStr,
    ContractNo: contract.contract_no || '',
    BuyersRef: contract.buyers_reference || '',

    BuyerName: contract.buyer_name || '',
    BuyerAddress: buyerAddr.join('\n'),
    BuyerAddressLines: buyerAddr.map((line) => ({ line })),

    Description: contract.description || '',
    Article: contract.article || '',
    Size: contract.size || '',
    Average: contract.average || '',
    Substance: contract.substance || '',
    Measurement: contract.measurement || '',

    ImportantNotes: importantNotes.join('\n'),
    ImportantNoteLines: importantNotes.map((line) => ({ line })),

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
  for (let i = 0; i < 15; i++) {
    data[`SupplierAddress${i + 1}`] = supplierAddr[i] || '';
    data[`BuyerAddress${i + 1}`] = buyerAddr[i] || '';
    data[`ImportantNote${i + 1}`] = importantNotes[i] || '';

    data[`Selection${i + 1}`] = contract.selection?.[i] || '';
    data[`Color${i + 1}`] = contract.color?.[i] || '';
    data[`Swatch${i + 1}`] = contract.swatch?.[i] || '';
    data[`Quantity${i + 1}`] = contract.quantity?.[i] || '';
    data[`Price${i + 1}`] = contract.price?.[i] || '';
  }

  return data;
}

export async function generateContractWord(
  contract: Contract,
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

    // Repair Google Docs split-tag fragments before handing off to docxtemplater
    fixGoogleDocsSplitTags(zip);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
      // Templates use {{Tag}} double-brace syntax (matches the "Copy Tags" UI)
      delimiters: { start: '{{', end: '}}' },
    });

    const templateData = buildTemplateData(contract);
    console.log('[Word Export] Template data:', JSON.stringify(templateData, null, 2));

    try {
      doc.render(templateData);
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
    link.download = `contract-${contract.contract_no}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  } catch (err: any) {
    console.error('Word export error:', err);
    alert(err.message || 'Word export failed. Check your template for typos in tags like {{Tag}}.');
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
