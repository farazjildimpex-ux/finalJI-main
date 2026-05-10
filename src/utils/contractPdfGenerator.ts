import jsPDF from 'jspdf';
import type { Contract } from '../types';
import { loadPdfLayoutConfig, getSection, type PdfLayoutConfig } from './pdfLayoutConfig';

export const generateContractPDF = async (
  contract: Contract,
  showCompanyInPdf: boolean = true,
  includeSignature: boolean = false,
  letterheadImages?: { headerBase64: string | null; footerBase64: string | null; headerExt?: string; footerExt?: string },
  download: boolean = true,
  layoutConfig?: PdfLayoutConfig
): Promise<string> => {
  const cfg = layoutConfig ?? loadPdfLayoutConfig();

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = cfg.margin;
  const contentWidth = pageWidth - 2 * margin;
  const labelOffset = cfg.labelWidth;
  const ff = cfg.fontFamily as string;
  let yPosition = margin;

  // ── Header / Letterhead ─────────────────────────────────────────────────────
  const headerH = cfg.header.height;
  const footerH = cfg.footer.height;

  if (letterheadImages?.headerBase64) {
    // Company letterhead takes priority
    const ext = (letterheadImages.headerExt || 'png').toUpperCase() as 'PNG' | 'JPEG';
    const dataUrl = `data:image/${ext.toLowerCase()};base64,${letterheadImages.headerBase64}`;
    doc.addImage(dataUrl, ext, 0, 0, pageWidth, headerH);
    yPosition = headerH + cfg.header.yOffset;

    if (letterheadImages.footerBase64) {
      const fExt = (letterheadImages.footerExt || 'png').toUpperCase() as 'PNG' | 'JPEG';
      const fDataUrl = `data:image/${fExt.toLowerCase()};base64,${letterheadImages.footerBase64}`;
      doc.addImage(fDataUrl, fExt, 0, pageHeight - footerH, pageWidth, footerH);
    }
  } else if (cfg.header.type === 'image' && cfg.header.imageBase64) {
    const ext = (cfg.header.imageExt === 'jpg' ? 'JPEG' : 'PNG') as 'PNG' | 'JPEG';
    const dataUrl = `data:image/${cfg.header.imageExt};base64,${cfg.header.imageBase64}`;
    doc.addImage(dataUrl, ext, 0, 0, pageWidth, headerH);
    yPosition = headerH + cfg.header.yOffset;

    if (cfg.footer.type === 'image' && cfg.footer.imageBase64) {
      const fExt = (cfg.footer.imageExt === 'jpg' ? 'JPEG' : 'PNG') as 'PNG' | 'JPEG';
      const fUrl = `data:image/${cfg.footer.imageExt};base64,${cfg.footer.imageBase64}`;
      doc.addImage(fUrl, fExt, 0, pageHeight - footerH, pageWidth, footerH);
    }
  } else if (cfg.header.type === 'text') {
    const align = cfg.header.align as 'center' | 'left' | 'right';
    const xHead = align === 'center' ? pageWidth / 2 : align === 'right' ? pageWidth - margin : margin;
    doc.setFont(ff, 'bold');
    doc.setFontSize(cfg.header.fontSize);
    doc.text(cfg.header.text.toUpperCase() || contract.company_name.toUpperCase(), xHead, yPosition, { align });
    yPosition += cfg.header.fontSize * 0.35 + 2;
    if (cfg.header.subText) {
      doc.setFont(ff, 'normal');
      doc.setFontSize(cfg.header.subFontSize);
      const subLines = doc.splitTextToSize(cfg.header.subText, contentWidth);
      doc.text(subLines, xHead, yPosition, { align });
      yPosition += subLines.length * (cfg.header.subFontSize * 0.35) + 2;
    }
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += cfg.header.yOffset;

    if (cfg.footer.type === 'text' && cfg.footer.text) {
      const fAlign = cfg.footer.align as 'center' | 'left' | 'right';
      const xFoot = fAlign === 'center' ? pageWidth / 2 : fAlign === 'right' ? pageWidth - margin : margin;
      const footY = pageHeight - footerH + 5;
      doc.setFont(ff, 'normal');
      doc.setFontSize(cfg.footer.fontSize);
      doc.text(cfg.footer.text, xFoot, footY, { align: fAlign });
    }
  } else if (showCompanyInPdf) {
    doc.setFont(ff, 'bold');
    doc.setFontSize(20);
    doc.text(contract.company_name.toUpperCase(), pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 7;
    doc.setFont(ff, 'normal');
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

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 11, lineHeight = 1.2) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return lines.length * (fontSize / doc.internal.scaleFactor) * lineHeight * cfg.lineSpacing;
  };

  const addLabelValue = (label: string, value: string, x: number, y: number, lw: number = labelOffset, spacing = 6) => {
    doc.setFontSize(11);
    doc.setFont(ff, 'bold');
    doc.text(label, x, y);
    doc.setFont(ff, 'normal');
    doc.text(value || '', x + lw, y);
    return spacing * cfg.lineSpacing;
  };

  // ── Supplier Block ────────────────────────────────────────────────────────────
  const sc_supplier = getSection(cfg, 'supplierBlock');
  if (sc_supplier.visible) {
    const xLeft = margin + sc_supplier.xOffset;
    const xRight = pageWidth - margin - 75;
    const suppY = yPosition + sc_supplier.yOffset;

    doc.setFontSize(sc_supplier.fontSize);
    doc.setFont(ff, 'bold');
    doc.text('Messrs:', xLeft, suppY);
    doc.setFont(ff, sc_supplier.fontStyle);
    doc.text(contract.supplier_name, xLeft + labelOffset, suppY);
    let addrY = suppY + 5;
    contract.supplier_address.forEach(addr => {
      if (addr) { doc.text(addr, xLeft + labelOffset, addrY); addrY += 4.5 * cfg.lineSpacing; }
    });

    // Contract info block (right side, same starting y)
    const sc_info = getSection(cfg, 'contractInfoBlock');
    if (sc_info.visible) {
      const infoX = xRight + sc_info.xOffset;
      let contractY = suppY + sc_info.yOffset;
      doc.setFont(ff, 'bold');
      doc.text('Date:', infoX, contractY);
      doc.setFont(ff, 'normal');
      doc.text(new Date(contract.contract_date).toLocaleDateString('en-GB'), infoX + 30, contractY);
      contractY += 6 * cfg.lineSpacing;
      doc.setFont(ff, 'bold');
      doc.text('Contract No:', infoX, contractY);
      doc.setFont(ff, 'normal');
      doc.text(contract.contract_no, infoX + 30, contractY);
      if (contract.buyers_reference) {
        contractY += 6 * cfg.lineSpacing;
        doc.setFont(ff, 'bold');
        doc.text("Buyer's Ref:", infoX, contractY);
        doc.setFont(ff, 'normal');
        doc.text(contract.buyers_reference, infoX + 30, contractY);
      }
      yPosition = Math.max(addrY, contractY) + 8;
    } else {
      yPosition = addrY + 8;
    }
  }

  // ── Intro Text ─────────────────────────────────────────────────────────────
  const sc_intro = getSection(cfg, 'introText');
  if (sc_intro.visible) {
    const iy = yPosition + sc_intro.yOffset;
    doc.setFont(ff, 'normal');
    doc.setFontSize(sc_intro.fontSize);
    doc.text('Dear Sirs,', margin + sc_intro.xOffset, iy);
    doc.text('We confirm having sold on your behalf the following goods, as per terms and conditions stated below.', margin + sc_intro.xOffset, iy + 6 * cfg.lineSpacing);
    yPosition = iy + 14 * cfg.lineSpacing;
  }

  // ── Buyer Block + Product Fields (left) + Important Notes (right) ─────────
  const sc_buyer = getSection(cfg, 'buyerBlock');
  const sc_prod = getSection(cfg, 'productFields');
  const sc_notes = getSection(cfg, 'importantNotes');

  let leftY = yPosition;
  if (sc_buyer.visible) {
    const bx = margin + sc_buyer.xOffset;
    let by = leftY + sc_buyer.yOffset;
    doc.setFont(ff, 'bold');
    doc.setFontSize(sc_buyer.fontSize);
    doc.text('Buyer:', bx, by);
    doc.setFont(ff, 'normal');
    doc.text(contract.buyer_name, bx + labelOffset, by);
    by += 5 * cfg.lineSpacing;
    contract.buyer_address.forEach(addr => {
      if (addr) { doc.text(addr, bx + labelOffset, by); by += 4.5 * cfg.lineSpacing; }
    });
    by += 6 * cfg.lineSpacing;

    if (sc_prod.visible) {
      const px = margin + sc_prod.xOffset;
      let py = by + sc_prod.yOffset;
      doc.setFontSize(sc_prod.fontSize);
      py += addLabelValue('Description:', contract.description, px, py);
      py += addLabelValue('Article:', contract.article, px, py);
      let sizeText = contract.size || '';
      if (contract.average?.trim()) sizeText += `   Avg: ${contract.average}`;
      py += addLabelValue('Size:', sizeText, px, py);
      py += addLabelValue('Substance:', contract.substance, px, py);
      py += addLabelValue('Measurement:', contract.measurement, px, py);
      leftY = py;
    } else {
      leftY = by;
    }
  }

  let rightY = yPosition;
  if (sc_notes.visible) {
    const nx = pageWidth * 0.62 + sc_notes.xOffset;
    let ny = rightY + sc_notes.yOffset;
    doc.setFontSize(sc_notes.fontSize);
    doc.setFont(ff, 'bold');
    doc.text('VERY IMPORTANT', nx, ny);
    ny += 6 * cfg.lineSpacing;
    doc.setFont(ff, 'normal');
    contract.important_notes.forEach(note => {
      if (note) {
        const noteLines = doc.splitTextToSize(note, contentWidth * 0.35);
        doc.text(noteLines, nx, ny);
        ny += noteLines.length * 4.5 * cfg.lineSpacing + 1;
      }
    });
    rightY = ny;
  }

  yPosition = Math.max(leftY, rightY) + 8;

  // ── Specifications Table ──────────────────────────────────────────────────
  const sc_table = getSection(cfg, 'specsTable');
  if (sc_table.visible && contract.selection?.some(s => s)) {
    yPosition += sc_table.yOffset;
    const tx = margin + sc_table.xOffset;
    const headers = ['Selection', 'Colour', 'Reference', 'Quantity', 'Price'];
    const colWidths = [contentWidth * 0.20, contentWidth * 0.15, contentWidth * 0.35, contentWidth * 0.15, contentWidth * 0.15];
    let x = tx, y = yPosition;
    doc.setFont(ff, 'bold');
    doc.setFontSize(sc_table.fontSize);
    headers.forEach((h, i) => { doc.text(h, x, y); x += colWidths[i]; });
    y += 6 * cfg.lineSpacing;
    doc.setFont(ff, 'normal');
    contract.selection.forEach((_, i) => {
      if (contract.selection[i] || contract.color[i] || contract.swatch[i]) {
        let cx = tx;
        const values = [contract.selection[i], contract.color[i], contract.swatch[i], contract.quantity[i], contract.price[i]];
        values.forEach((v, j) => {
          const cellWidth = j === 4 ? colWidths[j] : colWidths[j] - 2;
          const cellLines = doc.splitTextToSize(v || '', cellWidth);
          doc.text(cellLines, cx, y);
          cx += colWidths[j];
        });
        y += 6 * cfg.lineSpacing;
      }
    });
    yPosition = y + 8;
  }

  // ── Delivery & Payment ────────────────────────────────────────────────────
  const sc_delivery = getSection(cfg, 'deliveryInfo');
  if (sc_delivery.visible) {
    yPosition += sc_delivery.yOffset;
    const dx = margin + sc_delivery.xOffset;
    doc.setFontSize(sc_delivery.fontSize);
    yPosition += addLabelValue('Delivery:', contract.delivery_schedule.filter(Boolean).join(', '), dx, yPosition);
    yPosition += addLabelValue('Destination:', contract.destination.filter(Boolean).join(', '), dx, yPosition);
    yPosition += addLabelValue('Payment:', contract.payment_terms, dx, yPosition);
    let commissionText = contract.local_commission || '';
    if (contract.foreign_commission?.trim()) commissionText += commissionText ? `, ${contract.foreign_commission}` : contract.foreign_commission;
    yPosition += addLabelValue('Commission:', commissionText, dx, yPosition);
    yPosition += addLabelValue('Notify:', contract.notify_party, dx, yPosition);
    yPosition += addLabelValue('Bank Documents:', contract.bank_documents, dx, yPosition, 45);
    yPosition += 8;
  }

  // ── Terms & Inspection ────────────────────────────────────────────────────
  const sc_terms = getSection(cfg, 'termsText');
  if (sc_terms.visible) {
    yPosition += sc_terms.yOffset;
    const tx = margin + sc_terms.xOffset;
    const termsLabelWidth = 30;
    doc.setFont(ff, 'bold');
    doc.setFontSize(sc_terms.fontSize);
    doc.text('Terms:', tx, yPosition);
    doc.setFont(ff, 'normal');
    const termsText = 'This contract is subjected to all terms and conditions of the international finished leather contract No.7.';
    const termsLines = doc.splitTextToSize(termsText, contentWidth - termsLabelWidth - 5);
    doc.text(termsLines, tx + termsLabelWidth, yPosition);
    yPosition += termsLines.length * 5 * cfg.lineSpacing + 2;

    doc.setFont(ff, 'bold');
    doc.text('Inspection:', tx, yPosition);
    doc.setFont(ff, 'normal');
    const inspectionText = 'Notwithstanding anything to the contrary in contract No.7, the place of inspection of the goods shall be within 15 days after delivery of the goods in the warehouse of the buyer.';
    const inspLines = doc.splitTextToSize(inspectionText, contentWidth - termsLabelWidth - 5);
    doc.text(inspLines, tx + termsLabelWidth, yPosition);
    yPosition += 14 * cfg.lineSpacing;
  }

  // ── Closing Block ────────────────────────────────────────────────────────
  const sc_closing = getSection(cfg, 'closingBlock');
  if (sc_closing.visible) {
    yPosition += sc_closing.yOffset;
    const cx = margin + sc_closing.xOffset;
    doc.setFont(ff, 'normal');
    doc.setFontSize(sc_closing.fontSize);
    doc.text('We Confirm the above sale', cx, yPosition);
    doc.text('Yours Faithfully,', pageWidth - margin + sc_closing.xOffset, yPosition, { align: 'right' });
    yPosition += 6 * cfg.lineSpacing;
    doc.setFont(ff, 'bold');
    doc.text(`For ${contract.company_name.toUpperCase()}`, pageWidth - margin + sc_closing.xOffset, yPosition, { align: 'right' });
    yPosition += 14 * cfg.lineSpacing;

    if (includeSignature) {
      doc.setLineWidth(0.5);
      doc.line(pageWidth - margin - 50, yPosition, pageWidth - margin, yPosition);
      yPosition += 5 * cfg.lineSpacing;
    }
  }

  // ── Seller / Buyer Line ──────────────────────────────────────────────────
  const sc_sbline = getSection(cfg, 'sellerBuyerLine');
  if (sc_sbline.visible) {
    yPosition += sc_sbline.yOffset;
    const lx = margin + sc_sbline.xOffset;
    doc.setFont(ff, sc_sbline.fontStyle);
    doc.setFontSize(sc_sbline.fontSize);
    doc.text('Seller', lx, yPosition);
    doc.text('Buyer', pageWidth / 2 + sc_sbline.xOffset, yPosition, { align: 'center' });
    doc.text('Partner / Manager', pageWidth - margin + sc_sbline.xOffset, yPosition, { align: 'right' });
  }

  const base64 = doc.output('datauristring').split(',')[1];
  if (download) doc.save(`contract-${contract.contract_no}.pdf`);
  return base64;
};
