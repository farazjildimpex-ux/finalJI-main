import jsPDF from 'jspdf';
import type { DebitNote } from '../types';
import { loadPdfLayoutConfig } from './pdfLayoutConfig';

const drawStyledText = (
  doc: jsPDF,
  segments: { text: string; bold?: boolean }[],
  x: number,
  y: number,
  options: { align?: 'right' | 'left' | 'center' } = {}
) => {
  let currentX = x;
  const totalWidth = segments.reduce((sum, s) => {
    doc.setFont('helvetica', s.bold ? 'bold' : 'normal');
    return sum + doc.getTextWidth(s.text);
  }, 0);

  if (options.align === 'right') currentX = x - totalWidth;
  else if (options.align === 'center') currentX = x - totalWidth / 2;

  segments.forEach(segment => {
    doc.setFont('helvetica', segment.bold ? 'bold' : 'normal');
    doc.text(segment.text, currentX, y);
    currentX += doc.getTextWidth(segment.text);
  });
};

export const generateDebitNotePDF = (
  debitNote: DebitNote,
  showCompanyInPdf: boolean = true,
  includeSignature: boolean = false,
  letterheadImages?: { headerBase64: string | null; footerBase64: string | null; headerExt?: string; footerExt?: string },
  download: boolean = true,
  signatureBase64?: string
): string => {
  const cfg = loadPdfLayoutConfig();

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: false });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin  = 15;
  let yPosition = margin;

  const headerH = cfg.header.height || 30;
  const footerH = cfg.footer.height || 22;

  // ── Letterhead: 4-branch system ──────────────────────────────────────────
  if (letterheadImages?.headerBase64) {
    // Branch 1: Company-specific letterhead images (passed from caller)
    const ext = (letterheadImages.headerExt || 'png').toUpperCase() as 'PNG' | 'JPEG';
    const hScale = (letterheadImages.headerScale ?? 100) / 100;
    const hW = pageWidth * hScale;
    const hX = (pageWidth - hW) / 2;
    doc.addImage(`data:image/${letterheadImages.headerExt || 'png'};base64,${letterheadImages.headerBase64}`, ext, hX, 0, hW, headerH, undefined, 'NONE');
    yPosition = headerH + 5;
    if (letterheadImages.footerBase64) {
      const fExt = (letterheadImages.footerExt || 'png').toUpperCase() as 'PNG' | 'JPEG';
      const fScale = (letterheadImages.footerScale ?? 100) / 100;
      const fW = pageWidth * fScale;
      const fX = (pageWidth - fW) / 2;
      doc.addImage(`data:image/${letterheadImages.footerExt || 'png'};base64,${letterheadImages.footerBase64}`, fExt, fX, pageHeight - footerH, fW, footerH, undefined, 'NONE');
    }
  } else if (cfg.header.type === 'image' && cfg.header.imageBase64) {
    // Branch 2: PDF layout config image (from Settings → PDF Layout)
    const ext = (cfg.header.imageExt === 'jpg' ? 'JPEG' : 'PNG') as 'PNG' | 'JPEG';
    doc.addImage(`data:image/${cfg.header.imageExt};base64,${cfg.header.imageBase64}`, ext, 0, 0, pageWidth, headerH, undefined, 'NONE');
    yPosition = headerH + (cfg.header.yOffset || 5);
    if (cfg.footer.type === 'image' && cfg.footer.imageBase64) {
      const fExt = (cfg.footer.imageExt === 'jpg' ? 'JPEG' : 'PNG') as 'PNG' | 'JPEG';
      doc.addImage(`data:image/${cfg.footer.imageExt};base64,${cfg.footer.imageBase64}`, fExt, 0, pageHeight - footerH, pageWidth, footerH, undefined, 'NONE');
    }
  } else if (cfg.header.type === 'text') {
    // Branch 3: Text header from PDF layout config
    const align = (cfg.header.align || 'center') as 'center' | 'left' | 'right';
    const xHead = align === 'center' ? pageWidth / 2 : align === 'right' ? pageWidth - margin : margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(cfg.header.fontSize || 18);
    doc.text((cfg.header.text || debitNote.company).toUpperCase(), xHead, yPosition, { align });
    yPosition += (cfg.header.fontSize || 18) * 0.35 + 2;
    if (cfg.header.subText) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(cfg.header.subFontSize || 10);
      const subLines = doc.splitTextToSize(cfg.header.subText, pageWidth - margin * 2);
      doc.text(subLines, xHead, yPosition, { align });
      yPosition += subLines.length * ((cfg.header.subFontSize || 10) * 0.35) + 2;
    }
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += (cfg.header.yOffset || 12);
    if (cfg.footer.type === 'text' && cfg.footer.text) {
      const fAlign = (cfg.footer.align || 'center') as 'center' | 'left' | 'right';
      const xFoot  = fAlign === 'center' ? pageWidth / 2 : fAlign === 'right' ? pageWidth - margin : margin;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(cfg.footer.fontSize || 9);
      doc.text(cfg.footer.text, xFoot, pageHeight - footerH + 5, { align: fAlign });
    }
  } else if (showCompanyInPdf) {
    // Branch 4: Hardcoded text fallback
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(debitNote.company.toUpperCase(), pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('New No:11, Old No:698, First Street, Anna Nagar West Extension,', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 4.5;
    doc.text('Chennai - 600101 — Mob: +91 98410 91189, Email: office@jildimpex.com', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 12;
  } else {
    yPosition += 45;
  }

  // ── Title ────────────────────────────────────────────────────────────────
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const title = 'DEBIT NOTE';
  doc.text(title, pageWidth / 2, yPosition, { align: 'center' });
  const titleWidth = doc.getTextWidth(title);
  doc.line(pageWidth / 2 - titleWidth / 2, yPosition + 1, pageWidth / 2 + titleWidth / 2, yPosition + 1);
  yPosition += 15;

  // ── Left: Messrs / Supplier ──────────────────────────────────────────────
  const leftStartY = yPosition;
  doc.setFontSize(11);
  if (debitNote.supplier_name?.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.text('Messrs:', margin, leftStartY);
    doc.setFont('helvetica', 'bold');
    doc.text(debitNote.supplier_name, margin, leftStartY + 6);
  }
  let addressY = leftStartY + 11;
  doc.setFont('helvetica', 'normal');
  if (Array.isArray(debitNote.supplier_address)) {
    debitNote.supplier_address.forEach(line => {
      if (line?.trim()) { doc.text(line, margin, addressY); addressY += 5; }
    });
  }

  // ── Right: Debit Note No & Date ──────────────────────────────────────────
  const rightAlign = pageWidth - margin;
  doc.setFont('helvetica', 'bold');
  doc.text('Debit Note No:', rightAlign - 50, leftStartY, { align: 'left' });
  doc.setFont('helvetica', 'normal');
  doc.text(debitNote.debit_note_no, rightAlign, leftStartY, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', rightAlign - 50, leftStartY + 6, { align: 'left' });
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(debitNote.debit_note_date).toLocaleDateString('en-GB'), rightAlign, leftStartY + 6, { align: 'right' });

  yPosition = Math.max(addressY, leftStartY + 20) + 10;

  // ── Details ──────────────────────────────────────────────────────────────
  const contractDate = debitNote.contract_date ? new Date(debitNote.contract_date).toLocaleDateString('en-GB') : '';
  const invoiceDate  = debitNote.invoice_date  ? new Date(debitNote.invoice_date).toLocaleDateString('en-GB')  : '';

  if (debitNote.contract_no?.trim() || debitNote.buyer_name?.trim()) {
    const contractLine: { text: string; bold?: boolean }[] = [];
    if (debitNote.contract_no?.trim()) {
      contractLine.push({ text: 'For our Contract No : ' });
      contractLine.push({ text: `${debitNote.contract_no}${contractDate ? ` dated ${contractDate}` : ''} `, bold: true });
    }
    if (debitNote.buyer_name?.trim()) {
      contractLine.push({ text: ' towards Buyer ' });
      contractLine.push({ text: debitNote.buyer_name, bold: true });
    }
    drawStyledText(doc, contractLine, margin, yPosition);
    yPosition += 7;
  }

  if (debitNote.invoice_no?.trim()) {
    const invoiceLine: { text: string; bold?: boolean }[] = [
      { text: 'Against Your Invoice No :  ' },
      { text: `${debitNote.invoice_no}${invoiceDate ? ` dated ${invoiceDate}` : ''}`, bold: true },
    ];
    if (debitNote.quantity?.trim()) {
      invoiceLine.push({ text: ' with Quantity : ' });
      invoiceLine.push({ text: debitNote.quantity, bold: true });
    }
    if (debitNote.pieces?.trim()) {
      invoiceLine.push({ text: ' - Pieces : ' });
      invoiceLine.push({ text: debitNote.pieces, bold: true });
    }
    drawStyledText(doc, invoiceLine, margin, yPosition);
    yPosition += 7;
  }

  if (debitNote.destination?.trim()) {
    drawStyledText(doc, [
      { text: 'Shipment made from Chennai to ' },
      { text: debitNote.destination, bold: true },
    ], margin, yPosition);
    yPosition += 7;
  }

  yPosition += 15;
  doc.setFont('helvetica', 'normal');
  doc.text('We wish to debit your account towards Pre - Shipment Inspection and Export Service Charges', margin, yPosition);

  yPosition += 10;
  const commissionPercentage = debitNote.local_commission?.match(/.*?%/)?.[0] || debitNote.local_commission || '';
  drawStyledText(doc, [
    { text: commissionPercentage, bold: true },
    { text: ` on ${debitNote.currency} ` },
    { text: debitNote.invoice_value, bold: true },
    { text: ' = ' },
    { text: `${debitNote.currency} ${debitNote.commissioning.toFixed(2)}`, bold: true },
    { text: ' with Exchange Rate : ' },
    { text: debitNote.exchange_rate.toString(), bold: true },
  ], margin, yPosition);

  yPosition += 12;
  drawStyledText(doc, [
    { text: 'Commission In Rupees : Rs. ' },
    { text: debitNote.commission_in_rupees.toFixed(2), bold: true },
  ], margin, yPosition);

  yPosition += 7;
  drawStyledText(doc, [
    { text: '( ' },
    { text: debitNote.commission_in_words, bold: true },
    { text: '  ) ' },
  ], margin, yPosition);

  yPosition += 25;
  doc.setFont('helvetica', 'normal');
  doc.text('Yours Faithfully,', pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 6;
  doc.setFont('helvetica', 'bold');
  doc.text(`For ${debitNote.company.toUpperCase()}`, pageWidth - margin, yPosition, { align: 'right' });

  yPosition += 5;
  if (signatureBase64) {
    const sigW = 48, sigH = 18;
    doc.addImage(`data:image/png;base64,${signatureBase64}`, 'PNG', pageWidth - margin - sigW, yPosition, sigW, sigH, undefined, 'NONE');
    yPosition += sigH + 3;
  } else {
    yPosition += 10;
    if (includeSignature) {
      doc.line(pageWidth - margin - 40, yPosition, pageWidth - margin, yPosition);
      yPosition += 6;
    }
  }
  doc.setFont('helvetica', 'bold');
  doc.text('Partner / Manager', pageWidth - margin, yPosition, { align: 'right' });

  const base64 = doc.output('datauristring').split(',')[1];
  if (download) doc.save(`debit-note-${debitNote.debit_note_no}.pdf`);
  return base64;
};
