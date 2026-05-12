import jsPDF from 'jspdf';
import type { Contract } from '../types';
import { loadPdfLayoutConfig, getField, type PdfLayoutConfig } from './pdfLayoutConfig';

export const generateContractPDF = async (
  contract: Contract,
  showCompanyInPdf: boolean = true,
  includeSignature: boolean = false,
  letterheadImages?: { headerBase64: string | null; footerBase64: string | null; headerExt?: string; footerExt?: string },
  download: boolean = true,
  layoutConfig?: PdfLayoutConfig
): Promise<string> => {
  const cfg = layoutConfig ?? loadPdfLayoutConfig();

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: false });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin       = cfg.page.margin;
  const contentWidth = pageWidth - 2 * margin;
  const labelOffset  = cfg.page.labelWidth;
  const ff           = cfg.page.fontFamily as string;
  const ls           = cfg.page.lineSpacing;
  let yPosition      = margin;

  const headerH = cfg.header.height;
  const footerH = cfg.footer.height;

  // ── Header / Letterhead ──────────────────────────────────────────────────────
  if (letterheadImages?.headerBase64) {
    const ext = (letterheadImages.headerExt || 'png').toUpperCase() as 'PNG' | 'JPEG';
    doc.addImage(`data:image/${ext.toLowerCase()};base64,${letterheadImages.headerBase64}`, ext, 0, 0, pageWidth, headerH, undefined, 'NONE');
    yPosition = headerH + cfg.header.yOffset;
    if (letterheadImages.footerBase64) {
      const fExt = (letterheadImages.footerExt || 'png').toUpperCase() as 'PNG' | 'JPEG';
      doc.addImage(`data:image/${fExt.toLowerCase()};base64,${letterheadImages.footerBase64}`, fExt, 0, pageHeight - footerH, pageWidth, footerH, undefined, 'NONE');
    }
  } else if (cfg.header.type === 'image' && cfg.header.imageBase64) {
    const ext = (cfg.header.imageExt === 'jpg' ? 'JPEG' : 'PNG') as 'PNG' | 'JPEG';
    doc.addImage(`data:image/${cfg.header.imageExt};base64,${cfg.header.imageBase64}`, ext, 0, 0, pageWidth, headerH, undefined, 'NONE');
    yPosition = headerH + cfg.header.yOffset;
    if (cfg.footer.type === 'image' && cfg.footer.imageBase64) {
      const fExt = (cfg.footer.imageExt === 'jpg' ? 'JPEG' : 'PNG') as 'PNG' | 'JPEG';
      doc.addImage(`data:image/${cfg.footer.imageExt};base64,${cfg.footer.imageBase64}`, fExt, 0, pageHeight - footerH, pageWidth, footerH, undefined, 'NONE');
    }
  } else if (cfg.header.type === 'text') {
    const align = cfg.header.align as 'center' | 'left' | 'right';
    const xHead = align === 'center' ? pageWidth / 2 : align === 'right' ? pageWidth - margin : margin;
    const fCN = getField(cfg, 'companyName');
    const fCA = getField(cfg, 'companyAddress');
    if (fCN.visible) {
      doc.setFont(ff, fCN.fontStyle); doc.setFontSize(fCN.fontSize);
      doc.text((cfg.header.text || contract.company_name).toUpperCase(), xHead + fCN.xOffset, yPosition + fCN.yOffset, { align });
      yPosition += fCN.fontSize * 0.35 + 2;
    }
    if (fCA.visible && cfg.header.subText) {
      doc.setFont(ff, fCA.fontStyle); doc.setFontSize(fCA.fontSize);
      const subLines = doc.splitTextToSize(cfg.header.subText, contentWidth);
      doc.text(subLines, xHead + fCA.xOffset, yPosition + fCA.yOffset, { align });
      yPosition += subLines.length * (fCA.fontSize * 0.35) + 2;
    }
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += cfg.header.yOffset;
    if (cfg.footer.type === 'text' && cfg.footer.text) {
      const fAlign = cfg.footer.align as 'center' | 'left' | 'right';
      const xFoot = fAlign === 'center' ? pageWidth / 2 : fAlign === 'right' ? pageWidth - margin : margin;
      doc.setFont(ff, 'normal'); doc.setFontSize(cfg.footer.fontSize);
      doc.text(cfg.footer.text, xFoot, pageHeight - footerH + 5, { align: fAlign });
    }
  } else if (showCompanyInPdf) {
    const fCN = getField(cfg, 'companyName');
    const fCA = getField(cfg, 'companyAddress');
    if (fCN.visible) {
      doc.setFont(ff, fCN.fontStyle); doc.setFontSize(fCN.fontSize);
      doc.text(contract.company_name.toUpperCase(), pageWidth / 2 + fCN.xOffset, yPosition + fCN.yOffset, { align: 'center' });
      yPosition += 7;
    }
    if (fCA.visible) {
      doc.setFont(ff, fCA.fontStyle); doc.setFontSize(fCA.fontSize);
      doc.text('New No:11, Old No:698, First Street, Anna Nagar West Extension,', pageWidth / 2 + fCA.xOffset, yPosition + fCA.yOffset, { align: 'center' });
      yPosition += 4.5;
      doc.text('Chennai - 600101 — Mob: +91 98410 91189, Email: office@jildimpex.com', pageWidth / 2 + fCA.xOffset, yPosition + fCA.yOffset, { align: 'center' });
      yPosition += 6;
    }
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 12;
  } else {
    yPosition += 45;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const addLabelValue = (
    labelText: string, value: string, x: number, y: number,
    lw: number = labelOffset, spacing = 6,
    labelStyle: string = 'bold', dataStyle: string = 'normal',
    dataSize?: number,
  ) => {
    doc.setFont(ff, labelStyle); doc.text(labelText, x, y);
    doc.setFont(ff, dataStyle);
    if (dataSize) doc.setFontSize(dataSize);
    doc.text(value || '', x + lw, y);
    return spacing * ls;
  };

  // ── Supplier Block ────────────────────────────────────────────────────────────
  const fMessrs        = getField(cfg, 'messrsLabel');
  const fSupplierName  = getField(cfg, 'supplierName');
  const fSupplierAddr  = getField(cfg, 'supplierAddress');
  const fDate          = getField(cfg, 'dateField');
  const fContractNo    = getField(cfg, 'contractNoField');
  const fBuyersRef     = getField(cfg, 'buyersRefField');

  const xLeft  = margin;
  const xRight = pageWidth - margin - 75;
  const suppY  = yPosition;
  let addrY    = suppY;

  if (fMessrs.visible) {
    doc.setFont(ff, fMessrs.fontStyle); doc.setFontSize(fMessrs.fontSize);
    doc.text(fMessrs.customLabel || 'Messrs:', xLeft + fMessrs.xOffset, suppY + fMessrs.yOffset);
  }
  if (fSupplierName.visible) {
    doc.setFont(ff, fSupplierName.fontStyle); doc.setFontSize(fSupplierName.fontSize);
    doc.text(contract.supplier_name, xLeft + labelOffset + fSupplierName.xOffset, suppY + fSupplierName.yOffset);
  }
  if (fMessrs.visible || fSupplierName.visible) addrY = suppY + 5;

  if (fSupplierAddr.visible) {
    doc.setFont(ff, fSupplierAddr.fontStyle); doc.setFontSize(fSupplierAddr.fontSize);
    let ay = addrY + fSupplierAddr.yOffset;
    contract.supplier_address.forEach(addr => {
      if (addr) { doc.text(addr, xLeft + labelOffset + fSupplierAddr.xOffset, ay); ay += 4.5 * ls; }
    });
    addrY = ay;
  }

  let contractInfoY = suppY;
  if (fDate.visible) {
    const dx = xRight + fDate.xOffset, dy = contractInfoY + fDate.yOffset;
    doc.setFont(ff, fDate.fontStyle); doc.setFontSize(fDate.fontSize);
    doc.text(fDate.customLabel || 'Date:', dx, dy);
    doc.setFont(ff, fDate.dataFontStyle ?? 'normal'); doc.setFontSize(fDate.dataFontSize ?? fDate.fontSize);
    doc.text(new Date(contract.contract_date).toLocaleDateString('en-GB'), dx + 30, dy);
    contractInfoY += 6 * ls;
  }
  if (fContractNo.visible) {
    const dx = xRight + fContractNo.xOffset, dy = contractInfoY + fContractNo.yOffset;
    doc.setFont(ff, fContractNo.fontStyle); doc.setFontSize(fContractNo.fontSize);
    doc.text(fContractNo.customLabel || 'Contract No:', dx, dy);
    doc.setFont(ff, fContractNo.dataFontStyle ?? 'normal'); doc.setFontSize(fContractNo.dataFontSize ?? fContractNo.fontSize);
    doc.text(contract.contract_no, dx + 30, dy);
    contractInfoY += 6 * ls;
  }
  if (fBuyersRef.visible && contract.buyers_reference) {
    const dx = xRight + fBuyersRef.xOffset, dy = contractInfoY + fBuyersRef.yOffset;
    doc.setFont(ff, fBuyersRef.fontStyle); doc.setFontSize(fBuyersRef.fontSize);
    doc.text(fBuyersRef.customLabel || "Buyer's Ref:", dx, dy);
    doc.setFont(ff, fBuyersRef.dataFontStyle ?? 'normal'); doc.setFontSize(fBuyersRef.dataFontSize ?? fBuyersRef.fontSize);
    doc.text(contract.buyers_reference, dx + 30, dy);
    contractInfoY += 6 * ls;
  }

  yPosition = Math.max(addrY, contractInfoY) + 8;

  // ── Intro Text ─────────────────────────────────────────────────────────────
  const fDearSirs  = getField(cfg, 'dearSirs');
  const fIntroLine = getField(cfg, 'introLine');

  if (fDearSirs.visible) {
    doc.setFont(ff, fDearSirs.fontStyle); doc.setFontSize(fDearSirs.fontSize);
    doc.text(fDearSirs.customLabel || 'Dear Sirs,', margin + fDearSirs.xOffset, yPosition + fDearSirs.yOffset);
    yPosition += 6 * ls;
  }
  if (fIntroLine.visible) {
    doc.setFont(ff, fIntroLine.fontStyle); doc.setFontSize(fIntroLine.fontSize);
    const introText = fIntroLine.customLabel || 'We confirm having sold on your behalf the following goods, as per terms and conditions stated below.';
    const introLines = doc.splitTextToSize(introText, contentWidth);
    doc.text(introLines, margin + fIntroLine.xOffset, yPosition + fIntroLine.yOffset);
    yPosition += introLines.length * 5 * ls + 8;
  } else if (fDearSirs.visible) {
    yPosition += 8;
  }

  // ── Buyer Block + Product Fields (left) + Important Notes (right) ──────────
  const fBuyerLabel  = getField(cfg, 'buyerLabel');
  const fBuyerName   = getField(cfg, 'buyerName');
  const fBuyerAddr   = getField(cfg, 'buyerAddress');
  const fDesc        = getField(cfg, 'descriptionField');
  const fArticle     = getField(cfg, 'articleField');
  const fSize        = getField(cfg, 'sizeField');
  const fSubstance   = getField(cfg, 'substanceField');
  const fMeasurement = getField(cfg, 'measurementField');
  const fVITitle     = getField(cfg, 'veryImportantTitle');
  const fVINotes     = getField(cfg, 'importantNoteLines');

  let leftY = yPosition;

  if (fBuyerLabel.visible) {
    doc.setFont(ff, fBuyerLabel.fontStyle); doc.setFontSize(fBuyerLabel.fontSize);
    doc.text(fBuyerLabel.customLabel || 'Buyer:', margin + fBuyerLabel.xOffset, leftY + fBuyerLabel.yOffset);
  }
  if (fBuyerName.visible) {
    doc.setFont(ff, fBuyerName.fontStyle); doc.setFontSize(fBuyerName.fontSize);
    doc.text(contract.buyer_name, margin + labelOffset + fBuyerName.xOffset, leftY + fBuyerName.yOffset);
  }
  if (fBuyerLabel.visible || fBuyerName.visible) leftY += 5 * ls;

  if (fBuyerAddr.visible) {
    doc.setFont(ff, fBuyerAddr.fontStyle); doc.setFontSize(fBuyerAddr.fontSize);
    let by = leftY + fBuyerAddr.yOffset;
    contract.buyer_address.forEach(addr => {
      if (addr) { doc.text(addr, margin + labelOffset + fBuyerAddr.xOffset, by); by += 4.5 * ls; }
    });
    leftY = by;
  }
  leftY += 6 * ls;

  if (fDesc.visible) {
    doc.setFontSize(fDesc.fontSize);
    leftY += addLabelValue(fDesc.customLabel || 'Description:', contract.description, margin + fDesc.xOffset, leftY + fDesc.yOffset, labelOffset, 6, fDesc.fontStyle, fDesc.dataFontStyle ?? 'normal', fDesc.dataFontSize);
  }
  if (fArticle.visible) {
    doc.setFontSize(fArticle.fontSize);
    leftY += addLabelValue(fArticle.customLabel || 'Article:', contract.article, margin + fArticle.xOffset, leftY + fArticle.yOffset, labelOffset, 6, fArticle.fontStyle, fArticle.dataFontStyle ?? 'normal', fArticle.dataFontSize);
  }
  if (fSize.visible) {
    doc.setFontSize(fSize.fontSize);
    let sizeText = contract.size || '';
    if (contract.average?.trim()) sizeText += `   Avg: ${contract.average}`;
    leftY += addLabelValue(fSize.customLabel || 'Size:', sizeText, margin + fSize.xOffset, leftY + fSize.yOffset, labelOffset, 6, fSize.fontStyle, fSize.dataFontStyle ?? 'normal', fSize.dataFontSize);
  }
  if (fSubstance.visible) {
    doc.setFontSize(fSubstance.fontSize);
    leftY += addLabelValue(fSubstance.customLabel || 'Substance:', contract.substance, margin + fSubstance.xOffset, leftY + fSubstance.yOffset, labelOffset, 6, fSubstance.fontStyle, fSubstance.dataFontStyle ?? 'normal', fSubstance.dataFontSize);
  }
  if (fMeasurement.visible) {
    doc.setFontSize(fMeasurement.fontSize);
    leftY += addLabelValue(fMeasurement.customLabel || 'Measurement:', contract.measurement, margin + fMeasurement.xOffset, leftY + fMeasurement.yOffset, labelOffset, 6, fMeasurement.fontStyle, fMeasurement.dataFontStyle ?? 'normal', fMeasurement.dataFontSize);
  }

  let rightY = yPosition;
  const nx = pageWidth * 0.62;

  if (fVITitle.visible) {
    doc.setFont(ff, fVITitle.fontStyle); doc.setFontSize(fVITitle.fontSize);
    doc.text(fVITitle.customLabel || 'VERY IMPORTANT', nx + fVITitle.xOffset, rightY + fVITitle.yOffset);
    rightY += 6 * ls;
  }
  if (fVINotes.visible) {
    doc.setFont(ff, fVINotes.fontStyle); doc.setFontSize(fVINotes.fontSize);
    let ny = rightY + fVINotes.yOffset;
    contract.important_notes.forEach(note => {
      if (note) {
        const noteLines = doc.splitTextToSize(note, contentWidth * 0.35);
        doc.text(noteLines, nx + fVINotes.xOffset, ny);
        ny += noteLines.length * 4.5 * ls + 1;
      }
    });
    rightY = ny;
  }

  yPosition = Math.max(leftY, rightY) + 8;

  // ── Specifications Table ───────────────────────────────────────────────────
  const fTableHeader = getField(cfg, 'specsTableHeader');
  const fTableRows   = getField(cfg, 'specsTableRows');

  if ((fTableHeader.visible || fTableRows.visible) && contract.selection?.some(s => s)) {
    const colWidths = [contentWidth * 0.20, contentWidth * 0.15, contentWidth * 0.35, contentWidth * 0.15, contentWidth * 0.15];
    let x = margin, y = yPosition;

    if (fTableHeader.visible) {
      doc.setFont(ff, fTableHeader.fontStyle); doc.setFontSize(fTableHeader.fontSize);
      x = margin + fTableHeader.xOffset;
      y = yPosition + fTableHeader.yOffset;
      ['Selection', 'Colour', 'Reference', 'Quantity', 'Price'].forEach((h, i) => { doc.text(h, x, y); x += colWidths[i]; });
      y += 6 * ls;
    }
    if (fTableRows.visible) {
      doc.setFont(ff, fTableRows.fontStyle); doc.setFontSize(fTableRows.fontSize);
      y += fTableRows.yOffset;
      contract.selection.forEach((_, i) => {
        if (contract.selection[i] || contract.color[i] || contract.swatch[i]) {
          let cx = margin + fTableRows.xOffset;
          [contract.selection[i], contract.color[i], contract.swatch[i], contract.quantity[i], contract.price[i]].forEach((v, j) => {
            const cellLines = doc.splitTextToSize(v || '', j === 4 ? colWidths[j] : colWidths[j] - 2);
            doc.text(cellLines, cx, y); cx += colWidths[j];
          });
          y += 6 * ls;
        }
      });
    }
    yPosition = y + 8;
  }

  // ── Delivery & Payment ─────────────────────────────────────────────────────
  const fDelivery    = getField(cfg, 'deliveryField');
  const fDestination = getField(cfg, 'destinationField');
  const fPayment     = getField(cfg, 'paymentField');
  const fCommission  = getField(cfg, 'commissionField');
  const fNotify      = getField(cfg, 'notifyField');
  const fBankDocs    = getField(cfg, 'bankDocumentsField');

  if (fDelivery.visible) {
    doc.setFontSize(fDelivery.fontSize);
    yPosition += addLabelValue(fDelivery.customLabel || 'Delivery:', contract.delivery_schedule.filter(Boolean).join(', '), margin + fDelivery.xOffset, yPosition + fDelivery.yOffset, labelOffset, 6, fDelivery.fontStyle, fDelivery.dataFontStyle ?? 'normal', fDelivery.dataFontSize);
  }
  if (fDestination.visible) {
    doc.setFontSize(fDestination.fontSize);
    yPosition += addLabelValue(fDestination.customLabel || 'Destination:', contract.destination.filter(Boolean).join(', '), margin + fDestination.xOffset, yPosition + fDestination.yOffset, labelOffset, 6, fDestination.fontStyle, fDestination.dataFontStyle ?? 'normal', fDestination.dataFontSize);
  }
  if (fPayment.visible) {
    doc.setFontSize(fPayment.fontSize);
    yPosition += addLabelValue(fPayment.customLabel || 'Payment:', contract.payment_terms, margin + fPayment.xOffset, yPosition + fPayment.yOffset, labelOffset, 6, fPayment.fontStyle, fPayment.dataFontStyle ?? 'normal', fPayment.dataFontSize);
  }
  if (fCommission.visible) {
    doc.setFontSize(fCommission.fontSize);
    let commissionText = contract.local_commission || '';
    if (contract.foreign_commission?.trim()) commissionText += commissionText ? `, ${contract.foreign_commission}` : contract.foreign_commission;
    yPosition += addLabelValue(fCommission.customLabel || 'Commission:', commissionText, margin + fCommission.xOffset, yPosition + fCommission.yOffset, labelOffset, 6, fCommission.fontStyle, fCommission.dataFontStyle ?? 'normal', fCommission.dataFontSize);
  }
  if (fNotify.visible) {
    doc.setFontSize(fNotify.fontSize);
    yPosition += addLabelValue(fNotify.customLabel || 'Notify:', contract.notify_party, margin + fNotify.xOffset, yPosition + fNotify.yOffset, labelOffset, 6, fNotify.fontStyle, fNotify.dataFontStyle ?? 'normal', fNotify.dataFontSize);
  }
  if (fBankDocs.visible) {
    doc.setFontSize(fBankDocs.fontSize);
    yPosition += addLabelValue(fBankDocs.customLabel || 'Bank Documents:', contract.bank_documents, margin + fBankDocs.xOffset, yPosition + fBankDocs.yOffset, 45, 6, fBankDocs.fontStyle, fBankDocs.dataFontStyle ?? 'normal', fBankDocs.dataFontSize);
  }
  yPosition += 8;

  // ── Terms & Inspection ─────────────────────────────────────────────────────
  const fTerms      = getField(cfg, 'termsText');
  const fInspection = getField(cfg, 'inspectionText');
  const tlw         = 30;

  if (fTerms.visible) {
    doc.setFont(ff, fTerms.fontStyle); doc.setFontSize(fTerms.fontSize);
    doc.text(fTerms.customLabel || 'Terms:', margin + fTerms.xOffset, yPosition + fTerms.yOffset);
    doc.setFont(ff, fTerms.dataFontStyle ?? 'normal'); doc.setFontSize(fTerms.dataFontSize ?? fTerms.fontSize);
    const tLines = doc.splitTextToSize('This contract is subjected to all terms and conditions of the international finished leather contract No.7.', contentWidth - tlw - 5);
    doc.text(tLines, margin + tlw + fTerms.xOffset, yPosition + fTerms.yOffset);
    yPosition += tLines.length * 5 * ls + 2;
  }
  if (fInspection.visible) {
    doc.setFont(ff, fInspection.fontStyle); doc.setFontSize(fInspection.fontSize);
    doc.text(fInspection.customLabel || 'Inspection:', margin + fInspection.xOffset, yPosition + fInspection.yOffset);
    doc.setFont(ff, fInspection.dataFontStyle ?? 'normal'); doc.setFontSize(fInspection.dataFontSize ?? fInspection.fontSize);
    const iLines = doc.splitTextToSize('Notwithstanding anything to the contrary in contract No.7, the place of inspection of the goods shall be within 15 days after delivery of the goods in the warehouse of the buyer.', contentWidth - tlw - 5);
    doc.text(iLines, margin + tlw + fInspection.xOffset, yPosition + fInspection.yOffset);
    yPosition += 14 * ls;
  }

  // ── Closing Block ──────────────────────────────────────────────────────────
  const fClosingLeft    = getField(cfg, 'closingLeftLine');
  const fClosingRight   = getField(cfg, 'closingRightLine');
  const fClosingCompany = getField(cfg, 'closingCompanyName');

  if (fClosingLeft.visible) {
    doc.setFont(ff, fClosingLeft.fontStyle); doc.setFontSize(fClosingLeft.fontSize);
    doc.text(fClosingLeft.customLabel || 'We Confirm the above sale', margin + fClosingLeft.xOffset, yPosition + fClosingLeft.yOffset);
  }
  if (fClosingRight.visible) {
    doc.setFont(ff, fClosingRight.fontStyle); doc.setFontSize(fClosingRight.fontSize);
    doc.text(fClosingRight.customLabel || 'Yours Faithfully,', pageWidth - margin + fClosingRight.xOffset, yPosition + fClosingRight.yOffset, { align: 'right' });
  }
  yPosition += 6 * ls;

  if (fClosingCompany.visible) {
    doc.setFont(ff, fClosingCompany.fontStyle); doc.setFontSize(fClosingCompany.fontSize);
    doc.text(`For ${contract.company_name.toUpperCase()}`, pageWidth - margin + fClosingCompany.xOffset, yPosition + fClosingCompany.yOffset, { align: 'right' });
  }
  yPosition += 14 * ls;

  if (includeSignature) {
    doc.setLineWidth(0.5);
    doc.line(pageWidth - margin - 50, yPosition, pageWidth - margin, yPosition);
    yPosition += 5 * ls;
  }

  // ── Seller / Buyer Line ──────────────────────────────────────────────────
  const fSeller    = getField(cfg, 'sellerLabel');
  const fBuyerSign = getField(cfg, 'buyerSignLabel');
  const fPartner   = getField(cfg, 'partnerLabel');

  if (fSeller.visible) {
    doc.setFont(ff, fSeller.fontStyle); doc.setFontSize(fSeller.fontSize);
    doc.text(fSeller.customLabel || 'Seller', margin + fSeller.xOffset, yPosition + fSeller.yOffset);
  }
  if (fBuyerSign.visible) {
    doc.setFont(ff, fBuyerSign.fontStyle); doc.setFontSize(fBuyerSign.fontSize);
    doc.text(fBuyerSign.customLabel || 'Buyer', pageWidth / 2 + fBuyerSign.xOffset, yPosition + fBuyerSign.yOffset, { align: 'center' });
  }
  if (fPartner.visible) {
    doc.setFont(ff, fPartner.fontStyle); doc.setFontSize(fPartner.fontSize);
    doc.text(fPartner.customLabel || 'Partner / Manager', pageWidth - margin + fPartner.xOffset, yPosition + fPartner.yOffset, { align: 'right' });
  }

  const base64 = doc.output('datauristring').split(',')[1];
  if (download) doc.save(`contract-${contract.contract_no}.pdf`);
  return base64;
};
