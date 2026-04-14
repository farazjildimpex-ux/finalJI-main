import PizZip from 'pizzip';
import type { DebitNote } from '../types';

function escXml(s: string | undefined | null): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function p(
  text: string,
  opts: {
    bold?: boolean;
    sz?: number;
    align?: 'left' | 'center' | 'right';
    spBefore?: number;
    spAfter?: number;
    underline?: boolean;
  } = {}
): string {
  const { bold = false, sz = 22, align, spBefore = 0, spAfter = 100, underline } = opts;
  const pPr = [
    align ? `<w:jc w:val="${align}"/>` : '',
    `<w:spacing w:before="${spBefore}" w:after="${spAfter}"/>`,
  ]
    .filter(Boolean)
    .join('');
  const rPr = [
    bold ? '<w:b/><w:bCs/>' : '',
    underline ? '<w:u w:val="single"/>' : '',
    `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`,
  ]
    .filter(Boolean)
    .join('');
  return `<w:p><w:pPr>${pPr}</w:pPr><w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${escXml(text)}</w:t></w:r></w:p>`;
}

function mp(
  runs: Array<{ text: string; bold?: boolean; sz?: number }>,
  opts: {
    align?: 'left' | 'center' | 'right';
    spBefore?: number;
    spAfter?: number;
  } = {}
): string {
  const { align, spBefore = 0, spAfter = 100 } = opts;
  const pPr = [
    align ? `<w:jc w:val="${align}"/>` : '',
    `<w:spacing w:before="${spBefore}" w:after="${spAfter}"/>`,
  ]
    .filter(Boolean)
    .join('');
  const runsXml = runs
    .map((r) => {
      const rPr = [
        r.bold ? '<w:b/><w:bCs/>' : '',
        `<w:sz w:val="${r.sz || 22}"/><w:szCs w:val="${r.sz || 22}"/>`,
      ]
        .filter(Boolean)
        .join('');
      return `<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${escXml(r.text)}</w:t></w:r>`;
    })
    .join('');
  return `<w:p><w:pPr>${pPr}</w:pPr>${runsXml}</w:p>`;
}

function blank(count = 1): string {
  return Array(count)
    .fill('<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>')
    .join('');
}

function noTbl(rows: string[]): string {
  return `<w:tbl>
  <w:tblPr>
    <w:tblW w:w="8500" w:type="dxa"/>
    <w:tblBorders>
      <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
    </w:tblBorders>
    <w:tblCellMar>
      <w:top w:w="0" w:type="dxa"/><w:left w:w="60" w:type="dxa"/>
      <w:bottom w:w="0" w:type="dxa"/><w:right w:w="60" w:type="dxa"/>
    </w:tblCellMar>
  </w:tblPr>
  ${rows.join('\n')}
</w:tbl>`;
}

function buildDebitNoteBody(dn: DebitNote): string {
  const dateStr = dn.debit_note_date
    ? new Date(dn.debit_note_date).toLocaleDateString('en-GB')
    : '';
  const contractDateStr = dn.contract_date
    ? new Date(dn.contract_date).toLocaleDateString('en-GB')
    : '';
  const invoiceDateStr = dn.invoice_date
    ? new Date(dn.invoice_date).toLocaleDateString('en-GB')
    : '';
  const commissionPercentage = dn.local_commission?.match(/.*?%/)?.[0] || dn.local_commission || '';

  const parts: string[] = [];

  const supplierCellInner = [
    dn.supplier_name,
    ...((dn.supplier_address || []).filter(Boolean)),
  ]
    .map((line, i) => {
      const bold = i === 0;
      return `<w:r><w:rPr>${bold ? '<w:b/><w:bCs/>' : ''}<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">${escXml(line)}</w:t></w:r><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:br/></w:r>`;
    })
    .join('');

  parts.push(
    noTbl([
      `<w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="5000" w:type="dxa"/></w:tcPr>
          <w:p><w:pPr><w:spacing w:after="40"/></w:pPr>
            <w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">Messrs:  </w:t></w:r>
            ${supplierCellInner}
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="3500" w:type="dxa"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="40"/></w:pPr>
            <w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/></w:rPr><w:t>Debit Note No: </w:t></w:r>
            <w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>${escXml(dn.debit_note_no)}</w:t></w:r>
            <w:r><w:br/></w:r>
            <w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/></w:rPr><w:t>Date: </w:t></w:r>
            <w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>${escXml(dateStr)}</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>`,
    ])
  );

  parts.push(blank(2));
  parts.push(p('DEBIT NOTE', { bold: true, sz: 28, align: 'center', spAfter: 40, underline: true }));
  parts.push(blank(2));

  parts.push(
    mp(
      [
        { text: 'For our Contract No : ' },
        { text: `${dn.contract_no} dated ${contractDateStr} `, bold: true },
        { text: ' towards Buyer ' },
        { text: dn.buyer_name, bold: true },
      ],
      { spAfter: 140 }
    )
  );

  parts.push(
    mp(
      [
        { text: 'Against Your Invoice No : ' },
        { text: `${dn.invoice_no} dated ${invoiceDateStr}`, bold: true },
        { text: ' with Quantity : ' },
        { text: dn.quantity, bold: true },
        { text: ' - Pieces : ' },
        { text: dn.pieces, bold: true },
      ],
      { spAfter: 140 }
    )
  );

  parts.push(
    mp(
      [
        { text: 'Shipment made from Chennai to ' },
        { text: dn.destination, bold: true },
      ],
      { spAfter: 200 }
    )
  );

  parts.push(
    p(
      'We wish to debit your account towards Pre - Shipment Inspection and Export Service Charges',
      { spAfter: 160 }
    )
  );

  parts.push(
    mp(
      [
        { text: `${commissionPercentage}`, bold: true },
        { text: ` on ${dn.currency} ` },
        { text: dn.invoice_value, bold: true },
        { text: ' = ' },
        { text: `${dn.currency} ${Number(dn.commissioning || 0).toFixed(2)}`, bold: true },
        { text: ' with Exchange Rate : ' },
        { text: String(dn.exchange_rate), bold: true },
      ],
      { spAfter: 120 }
    )
  );

  parts.push(
    mp(
      [
        { text: 'Commission In Rupees : Rs. ' },
        { text: Number(dn.commission_in_rupees || 0).toFixed(2), bold: true },
      ],
      { spAfter: 80 }
    )
  );

  parts.push(
    mp(
      [
        { text: '( ' },
        { text: dn.commission_in_words, bold: true },
        { text: ' )' },
      ],
      { spAfter: 320 }
    )
  );

  parts.push(
    noTbl([
      `<w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="4250" w:type="dxa"/></w:tcPr>
          <w:p><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t></w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4250" w:type="dxa"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="40"/></w:pPr>
            <w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>Yours Faithfully,</w:t></w:r></w:p>
          <w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="40"/></w:pPr>
            <w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/></w:rPr><w:t>For ${escXml(
              (dn.company || '').toUpperCase()
            )}</w:t></w:r></w:p>
        </w:tc>
      </w:tr>`,
    ])
  );

  parts.push(blank(3));
  parts.push(p('Partner / Manager', { bold: true, align: 'right', spAfter: 40 }));

  return parts.join('\n');
}

function createMinimalDocx(bodyContent: string): ArrayBuffer {
  const zip = new PizZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${bodyContent}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`
  );
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`
  );
  return zip.generate({ type: 'arraybuffer' });
}

export async function generateDebitNoteWord(
  debitNote: DebitNote,
  templateUrl: string | null | undefined
): Promise<void> {
  const bodyContent = buildDebitNoteBody(debitNote);
  let docBuffer: ArrayBuffer;

  if (templateUrl) {
    try {
      const resp = await fetch(templateUrl);
      const templateBuffer = await resp.arrayBuffer();
      const zip = new PizZip(templateBuffer);
      const origDocXml = zip.files['word/document.xml'].asText();

      const bodyStart = origDocXml.indexOf('<w:body>');
      const docHeader =
        bodyStart !== -1 ? origDocXml.substring(0, bodyStart + '<w:body>'.length) : '';
      const sectPrMatch = origDocXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
      const sectPr = sectPrMatch ? sectPrMatch[0] : '';

      const newDocXml = `${docHeader}${bodyContent}${sectPr}</w:body></w:document>`;
      zip.file('word/document.xml', newDocXml);
      docBuffer = zip.generate({ type: 'arraybuffer' });
    } catch (err) {
      console.warn('Template fetch failed, using minimal docx:', err);
      docBuffer = createMinimalDocx(bodyContent);
    }
  } else {
    docBuffer = createMinimalDocx(bodyContent);
  }

  const blob = new Blob([docBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `debit-note-${debitNote.debit_note_no}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
