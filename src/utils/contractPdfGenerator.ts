import jsPDF from 'jspdf';
import type { Contract } from '../types';

export const generateContractPDF = async (
  contract: Contract,
  showCompanyInPdf: boolean = true,
  includeSignature: boolean = false,
  letterheadImages?: { headerBase64: string | null; footerBase64: string | null; headerExt?: string; footerExt?: string }
) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
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
    doc.text(contract.company_name.toUpperCase(), pageWidth / 2, yPosition, { align: 'center' });
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

  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 11, lineHeight = 1.2) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return lines.length * (fontSize / doc.internal.scaleFactor) * lineHeight;
  };

  const addLabelValue = (label: string, value: string, x: number, y: number, labelWidth: number = 35, spacing = 6) => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(label, x, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value || '', x + labelWidth, y);
    return spacing;
  };

  // Supplier and contract info block
  const labelOffset = 35;
  let xLeft = margin;
  let xRight = pageWidth - margin - 75;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Messrs:', xLeft, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(contract.supplier_name, xLeft + labelOffset, yPosition);
  yPosition += 5;
  contract.supplier_address.forEach(addr => {
    if (addr) {
      doc.text(addr, xLeft + labelOffset, yPosition);
      yPosition += 4.5;
    }
  });

  let contractY = yPosition - (contract.supplier_address.filter(Boolean).length * 4.5) - 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', xRight, contractY);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(contract.contract_date).toLocaleDateString('en-GB'), xRight + 30, contractY);
  contractY += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Contract No:', xRight, contractY);
  doc.setFont('helvetica', 'normal');
  doc.text(contract.contract_no, xRight + 30, contractY);
  if (contract.buyers_reference) {
    contractY += 6;
    doc.setFont('helvetica', 'bold');
    doc.text("Buyer's Ref:", xRight, contractY);
    doc.setFont('helvetica', 'normal');
    doc.text(contract.buyers_reference, xRight + 30, contractY);
  }
  yPosition = Math.max(yPosition, contractY) + 10;

  doc.text('Dear Sirs,', margin, yPosition);
  yPosition += 6;
  doc.text('We confirm having sold on your behalf the following goods, as per terms and conditions stated below.', margin, yPosition);
  yPosition += 10;

  // Buyer and product section
  let leftY = yPosition;
  doc.setFont('helvetica', 'bold');
  doc.text('Buyer:', margin, leftY);
  doc.setFont('helvetica', 'normal');
  doc.text(contract.buyer_name, margin + labelOffset, leftY);
  leftY += 5;
  contract.buyer_address.forEach(addr => {
    if (addr) {
      doc.text(addr, margin + labelOffset, leftY);
      leftY += 4.5;
    }
  });

  leftY += 8;
  leftY += addLabelValue('Description:', contract.description, margin, leftY);
  leftY += addLabelValue('Article:', contract.article, margin, leftY);
  
  let sizeText = contract.size || '';
  if (contract.average && contract.average.trim() !== '') {
    sizeText += `   Avg: ${contract.average}`;
  }
  leftY += addLabelValue('Size:', sizeText, margin, leftY);
  leftY += addLabelValue('Substance:', contract.substance, margin, leftY);
  leftY += addLabelValue('Measurement:', contract.measurement, margin, leftY);

  // VERY IMPORTANT section
  let rightY = yPosition;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('VERY IMPORTANT', pageWidth * 0.62, rightY);
  rightY += 6;
  doc.setFont('helvetica', 'normal');
  contract.important_notes.forEach(note => {
    if (note) {
      const noteLines = doc.splitTextToSize(note, contentWidth * 0.35);
      doc.text(noteLines, pageWidth * 0.62, rightY);
      rightY += noteLines.length * 4.5 + 1;
    }
  });

  yPosition = Math.max(leftY, rightY) + 10;

  // Table section
  if (contract.selection && contract.selection.some(s => s)) {
    const headers = ['Selection', 'Colour', 'Reference', 'Quantity', 'Price'];
    const colWidths = [contentWidth * 0.20, contentWidth * 0.15, contentWidth * 0.35, contentWidth * 0.15, contentWidth * 0.15];
    let x = margin, y = yPosition;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    headers.forEach((h, i) => {
      doc.text(h, x, y);
      x += colWidths[i];
    });
    y += 6;
    
    doc.setFont('helvetica', 'normal');
    contract.selection.forEach((_, i) => {
      if (contract.selection[i] || contract.color[i] || contract.swatch[i]) {
        let x = margin;
        const values = [contract.selection[i], contract.color[i], contract.swatch[i], contract.quantity[i], contract.price[i]];
        values.forEach((v, j) => {
          const cellWidth = j === 4 ? colWidths[j] : colWidths[j] - 2;
          const cellLines = doc.splitTextToSize(v || '', cellWidth);
          doc.text(cellLines, x, y);
          x += colWidths[j];
        });
        y += 6;
      }
    });
    yPosition = y + 10;
  }

  // Delivery info
  yPosition += addLabelValue('Delivery:', contract.delivery_schedule.filter(Boolean).join(', '), margin, yPosition);
  yPosition += addLabelValue('Destination:', contract.destination.filter(Boolean).join(', '), margin, yPosition);
  yPosition += addLabelValue('Payment:', contract.payment_terms, margin, yPosition);
  
  let commissionText = contract.local_commission || '';
  if (contract.foreign_commission && contract.foreign_commission.trim()) {
    commissionText += commissionText ? `, ${contract.foreign_commission}` : contract.foreign_commission;
  }
  yPosition += addLabelValue('Commission:', commissionText, margin, yPosition);
  yPosition += addLabelValue('Notify:', contract.notify_party, margin, yPosition);
  yPosition += addLabelValue('Bank Documents:', contract.bank_documents, margin, yPosition, 45);

  yPosition += 10;
  
  // Terms and Inspection
  const termsLabelWidth = 30;
  doc.setFont('helvetica', 'bold');
  doc.text('Terms:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  const termsText = 'This contract is subjected to all terms and conditions of the international finished leather contract No.7.';
  const termsLines = doc.splitTextToSize(termsText, contentWidth - termsLabelWidth - 5);
  doc.text(termsLines, margin + termsLabelWidth, yPosition);
  yPosition += termsLines.length * 5 + 2;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Inspection:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  const inspectionText = 'Notwithstanding anything to the contrary in contract No.7, the place of inspection of the goods shall be within 15 days after delivery of the goods in the warehouse of the buyer.';
  const inspectionLines = doc.splitTextToSize(inspectionText, contentWidth - termsLabelWidth - 5);
  doc.text(inspectionLines, margin + termsLabelWidth, yPosition);
  yPosition += 15;

  // Closing Section
  doc.text('We Confirm the above sale', margin, yPosition);
  doc.text('Yours Faithfully,', pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 6;

  doc.setFont('helvetica', 'bold');
  doc.text(`For ${contract.company_name.toUpperCase()}`, pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 15;

  if (includeSignature) {
    doc.setLineWidth(0.5);
    doc.line(pageWidth - margin - 50, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Seller', margin, yPosition);
  doc.text('Buyer', pageWidth / 2, yPosition, { align: 'center' });
  doc.text('Partner / Manager', pageWidth - margin, yPosition, { align: 'right' });

  doc.save(`contract-${contract.contract_no}.pdf`);
};