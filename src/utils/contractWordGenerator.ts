import PizZip from 'pizzip';
import type { Contract } from '../types';

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
    align?: 'left' | 'center' | 'right' | 'both';
    spBefore?: number;
    spAfter?: number;
    indent?: number;
    underline?: boolean;
  } = {}
): string {
  const { bold = false, sz = 22, align, spBefore = 0, spAfter = 100, indent, underline } = opts;
  const pPr = [
    align ? `<w:jc w:val="${align}"/>` : '',
    `<w:spacing w:before="${spBefore}" w:after="${spAfter}"/>`,
    indent ? `<w:ind w:left="${indent}"/>` : '',
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
  runs: Array<{ text: string; bold?: boolean; sz?: number; underline?: boolean }>,
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
        r.underline ? '<w:u w:val="single"/>' : '',
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

function tblRow(
  cells: Array<{ text: string; bold?: boolean; width: number; align?: string }>,
  rowOpts: { bold?: boolean; shade?: string } = {}
): string {
  const cellsXml = cells
    .map((c) => {
      const shadeXml = rowOpts.shade
        ? `<w:shd w:val="clear" w:color="auto" w:fill="${rowOpts.shade}"/>`
        : '';
      const align = c.align ? `<w:jc w:val="${c.align}"/>` : '';
      return `<w:tc>
        <w:tcPr><w:tcW w:w="${c.width}" w:type="dxa"/>${shadeXml}</w:tcPr>
        <w:p><w:pPr><w:spacing w:after="40"/>${align}</w:pPr>
          <w:r><w:rPr>${c.bold || rowOpts.bold ? '<w:b/><w:bCs/>' : ''}<w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>
            <w:t xml:space="preserve">${escXml(c.text)}</w:t></w:r>
        </w:p>
      </w:tc>`;
    })
    .join('');
  return `<w:tr>${cellsXml}</w:tr>`;
}

function tbl(rows: string[], fullWidth = 8500): string {
  return `<w:tbl>
  <w:tblPr>
    <w:tblW w:w="${fullWidth}" w:type="dxa"/>
    <w:tblBorders>
      <w:top w:val="single" w:sz="4" w:space="0" w:color="AAAAAA"/>
      <w:left w:val="single" w:sz="4" w:space="0" w:color="AAAAAA"/>
      <w:bottom w:val="single" w:sz="4" w:space="0" w:color="AAAAAA"/>
      <w:right w:val="single" w:sz="4" w:space="0" w:color="AAAAAA"/>
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="AAAAAA"/>
      <w:insideV w:val="single" w:sz="4" w:space="0" w:color="AAAAAA"/>
    </w:tblBorders>
    <w:tblCellMar>
      <w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/>
      <w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/>
    </w:tblCellMar>
  </w:tblPr>
  ${rows.join('\n')}
</w:tbl>`;
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

function buildContractBody(contract: Contract): string {
  const dateStr = contract.contract_date
    ? new Date(contract.contract_date).toLocaleDateString('en-GB')
    : '';
  const parts: string[] = [];

  const supplierCellInner = [
    contract.supplier_name,
    ...((contract.supplier_address || []).filter(Boolean)),
  ]
    .map((line, i) => {
      const bold = i === 0;
      return `<w:r><w:rPr>${bold ? '<w:b/><w:bCs/>' : ''}<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">${escXml(line)}</w:t></w:r><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:br/></w:r>`;
    })
    .join('');

  const rightLines = [
    `<w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/></w:rPr><w:t>Date: </w:t></w:r><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>${escXml(dateStr)}</w:t></w:r>`,
    `<w:r><w:br/></w:r><w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/></w:rPr><w:t>Contract No: </w:t></w:r><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>${escXml(contract.contract_no)}</w:t></w:r>`,
    contract.buyers_reference
      ? `<w:r><w:br/></w:r><w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/></w:rPr><w:t>Buyer's Ref: </w:t></w:r><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>${escXml(contract.buyers_reference)}</w:t></w:r>`
      : '',
  ]
    .filter(Boolean)
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
            ${rightLines}
          </w:p>
        </w:tc>
      </w:tr>`,
    ])
  );

  parts.push(blank());
  parts.push(p('Dear Sirs,', { spAfter: 100 }));
  parts.push(
    p(
      'We confirm having sold on your behalf the following goods, as per terms and conditions stated below.',
      { spAfter: 200 }
    )
  );

  const buyerAddr = (contract.buyer_address || []).filter(Boolean).join(', ');
  parts.push(
    mp(
      [
        { text: 'Buyer: ', bold: true },
        { text: [contract.buyer_name, buyerAddr].filter(Boolean).join(' — ') },
      ],
      { spAfter: 100 }
    )
  );

  if (contract.description)
    parts.push(mp([{ text: 'Description: ', bold: true }, { text: contract.description }], { spAfter: 60 }));
  if (contract.article)
    parts.push(mp([{ text: 'Article: ', bold: true }, { text: contract.article }], { spAfter: 60 }));
  if (contract.size || contract.average) {
    const sizeText = [contract.size, contract.average ? `Avg: ${contract.average}` : '']
      .filter(Boolean)
      .join('   ');
    parts.push(mp([{ text: 'Size: ', bold: true }, { text: sizeText }], { spAfter: 60 }));
  }
  if (contract.substance)
    parts.push(mp([{ text: 'Substance: ', bold: true }, { text: contract.substance }], { spAfter: 60 }));
  if (contract.measurement)
    parts.push(mp([{ text: 'Measurement: ', bold: true }, { text: contract.measurement }], { spAfter: 60 }));

  parts.push(blank());

  if (contract.selection && contract.selection.some((s) => s)) {
    const colWidths = [1500, 1500, 2600, 1400, 1500];
    const headerRow = tblRow(
      [
        { text: 'Selection', bold: true, width: colWidths[0] },
        { text: 'Colour', bold: true, width: colWidths[1] },
        { text: 'Reference / Swatch', bold: true, width: colWidths[2] },
        { text: 'Quantity', bold: true, width: colWidths[3] },
        { text: 'Price', bold: true, width: colWidths[4] },
      ],
      { shade: 'E0E0E0' }
    );
    const dataRows = contract.selection
      .map((_, i) => {
        if (!contract.selection[i] && !contract.color[i] && !contract.swatch[i]) return '';
        return tblRow([
          { text: contract.selection[i] || '', width: colWidths[0] },
          { text: contract.color[i] || '', width: colWidths[1] },
          { text: contract.swatch[i] || '', width: colWidths[2] },
          { text: contract.quantity[i] || '', width: colWidths[3] },
          { text: contract.price[i] || '', width: colWidths[4] },
        ]);
      })
      .filter(Boolean);
    parts.push(tbl([headerRow, ...dataRows]));
    parts.push(blank());
  }

  if (contract.delivery_schedule?.some(Boolean))
    parts.push(
      mp(
        [
          { text: 'Delivery: ', bold: true },
          { text: contract.delivery_schedule.filter(Boolean).join(', ') },
        ],
        { spAfter: 60 }
      )
    );
  if (contract.destination?.some(Boolean))
    parts.push(
      mp(
        [
          { text: 'Destination: ', bold: true },
          { text: contract.destination.filter(Boolean).join(', ') },
        ],
        { spAfter: 60 }
      )
    );
  if (contract.payment_terms)
    parts.push(mp([{ text: 'Payment: ', bold: true }, { text: contract.payment_terms }], { spAfter: 60 }));

  const commission = [contract.local_commission, contract.foreign_commission].filter(Boolean).join(', ');
  if (commission)
    parts.push(mp([{ text: 'Commission: ', bold: true }, { text: commission }], { spAfter: 60 }));
  if (contract.notify_party)
    parts.push(mp([{ text: 'Notify: ', bold: true }, { text: contract.notify_party }], { spAfter: 60 }));
  if (contract.bank_documents)
    parts.push(
      mp([{ text: 'Bank Documents: ', bold: true }, { text: contract.bank_documents }], { spAfter: 60 })
    );

  if (contract.important_notes?.some(Boolean)) {
    parts.push(blank());
    parts.push(p('VERY IMPORTANT', { bold: true, sz: 20, spAfter: 80 }));
    contract.important_notes.filter(Boolean).forEach((note) => {
      parts.push(p(`\u2022  ${note}`, { sz: 20, spAfter: 40 }));
    });
  }

  parts.push(blank());

  parts.push(
    mp(
      [
        { text: 'Terms: ', bold: true },
        {
          text: 'This contract is subjected to all terms and conditions of the international finished leather contract No.7.',
        },
      ],
      { spAfter: 80 }
    )
  );
  parts.push(
    mp(
      [
        { text: 'Inspection: ', bold: true },
        {
          text: 'Notwithstanding anything to the contrary in contract No.7, the place of inspection of the goods shall be within 15 days after delivery of the goods in the warehouse of the buyer.',
        },
      ],
      { spAfter: 240 }
    )
  );

  parts.push(
    noTbl([
      `<w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="4250" w:type="dxa"/></w:tcPr>
          <w:p><w:pPr><w:spacing w:after="40"/></w:pPr>
            <w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>We Confirm the above sale</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4250" w:type="dxa"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="40"/></w:pPr>
            <w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>Yours Faithfully,</w:t></w:r></w:p>
          <w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="40"/></w:pPr>
            <w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/></w:rPr><w:t>For ${escXml(
              contract.company_name?.toUpperCase()
            )}</w:t></w:r></w:p>
        </w:tc>
      </w:tr>`,
    ])
  );

  parts.push(blank(3));

  parts.push(
    noTbl([
      `<w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="2833" w:type="dxa"/></w:tcPr>
          <w:p><w:pPr><w:spacing w:after="40"/></w:pPr>
            <w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/></w:rPr><w:t>Seller</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2833" w:type="dxa"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr>
            <w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/></w:rPr><w:t>Buyer</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2834" w:type="dxa"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="40"/></w:pPr>
            <w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="22"/></w:rPr><w:t>Partner / Manager</w:t></w:r></w:p>
        </w:tc>
      </w:tr>`,
    ])
  );

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

export async function generateContractWord(
  contract: Contract,
  templateUrl: string | null | undefined
): Promise<void> {
  const bodyContent = buildContractBody(contract);
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
  link.download = `contract-${contract.contract_no}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export async function extractLetterheadImages(
  templateUrl: string
): Promise<{ headerBase64: string | null; footerBase64: string | null; headerExt: string; footerExt: string }> {
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
