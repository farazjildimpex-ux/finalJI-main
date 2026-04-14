import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { DebitNote } from '../types';

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
  letterheadImages?: { headerBase64: string | null; footerBase64: string | null; headerExt?: string; footerExt?: string }
) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;

  const headerImageHeight = 30;
  const footerImageHeight = 22;

  // 1. Letterhead Header
  if (letterheadImages?.headerBase64) {
    const ext = (letterheadImages.headerExt || 'png').toUpperCase() as 'PNG' | 'JPEG';
    const dataUrl = `data:image/${ext.toLowerCase()};base64,${letterheadImages.headerBase64}`;
    doc.addImage(dataUrl, ext, 0, 0, pageWidth, headerImageHeight);
    yPosition = headerImageHeight + 5;

    if (letterheadImages.footerBase64) {
      const fExt = (letterheadImages.footerExt || 'png').toUpperCase() as 'PNG' | 'JPEG';
      const fDataUrl = `data:image/${fExt.toLowerCase()};base64,${letterheadImages.footerBase64}`;
      doc.addImage(fDataUrl, fExt, 0, pageHeight - footerImageHeight, pageWidth, footerImageHeight);
    }
  } else if (showCompanyInPdf) {
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
    
    // Horizontal Line
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 12;
  } else {
    yPosition += 45; // Space for pre-printed letterhead
  }

  // 2. Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const title = 'DEBIT NOTE';
  doc.text(title, pageWidth / 2, yPosition, { align: 'center' });
  const titleWidth = doc.getTextWidth(title);
  doc.line(pageWidth / 2 - titleWidth / 2, yPosition + 1, pageWidth / 2 + titleWidth / 2, yPosition + 1);
  yPosition += 15;

  // 3. Left side: Messrs, Supplier Name & Address
  const leftStartY = yPosition;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Messrs:', margin, leftStartY);
  doc.setFont('helvetica', 'bold');
  doc.text(debitNote.supplier_name, margin, leftStartY + 6);
  
  let addressY = leftStartY + 11;
  doc.setFont('helvetica', 'normal');
  if (Array.isArray(debitNote.supplier_address)) {
    debitNote.supplier_address.forEach(line => {
      if (line) {
        doc.text(line, margin, addressY);
        addressY += 5;
      }
    });
  }

  // 4. Right side: Debit Note No & Date
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

  // 5. Details
  const contractDate = debitNote.contract_date ? new Date(debitNote.contract_date).toLocaleDateString('en-GB') : '';
  const invoiceDate = debitNote.invoice_date ? new Date(debitNote.invoice_date).toLocaleDateString('en-GB') : '';

  drawStyledText(doc, [
    { text: 'For our Contract No : ' },
    { text: `${debitNote.contract_no} dated ${contractDate} `, bold: true },
    { text: ' towards Buyer ' },
    { text: debitNote.buyer_name, bold: true },
  ], margin, yPosition);

  yPosition += 7;
  drawStyledText(doc, [
    { text: 'Against Your Invoice No :  ' },
    { text: `${debitNote.invoice_no} dated ${invoiceDate}`, bold: true },
    { text: ' with Quantity : ' },
    { text: debitNote.quantity, bold: true },
    { text: ' - Pieces : ' },
    { text: debitNote.pieces, bold: true },
  ], margin, yPosition);

  yPosition += 7;
  drawStyledText(doc, [
      { text: 'Shipment made from Chennai to '},
      { text: debitNote.destination, bold: true }
  ], margin, yPosition);
  
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

  yPosition += 15;
  if (includeSignature) {
    doc.line(pageWidth - margin - 40, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Partner / Manager', pageWidth - margin, yPosition, { align: 'right' });

  doc.save(`debit-note-${debitNote.debit_note_no}.pdf`);
};