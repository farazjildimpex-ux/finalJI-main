import jsPDF from 'jspdf';
import type { Contract } from '../types';
import { loadPdfLayoutConfig, type PdfLayoutConfig } from './pdfLayoutConfig';

type LetterheadImages = {
  headerBase64: string | null;
  footerBase64: string | null;
  headerExt?: string;
  footerExt?: string;
  headerHeight?: number;
  footerHeight?: number;
  headerScale?: number;
  footerScale?: number;
};

type Align = 'left' | 'center' | 'right';

export const generateContractPDF = async (
  contract: Contract,
  showCompanyInPdf: boolean = true,
  includeSignature: boolean = false,
  letterheadImages?: LetterheadImages,
  download: boolean = true,
  layoutConfig?: PdfLayoutConfig,
  signatureBase64?: string
): Promise<string> => {
  const cfg = layoutConfig ?? loadPdfLayoutConfig();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: false });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = Math.max(12, cfg.page.margin || 15);
  const contentWidth = pageWidth - margin * 2;
  const ff = cfg.page.fontFamily as string;
  const black: [number, number, number] = [18, 18, 18];
  const muted: [number, number, number] = [92, 92, 92];
  const softBorder: [number, number, number] = [214, 214, 214];
  const softFill: [number, number, number] = [249, 250, 251];
  const headerHeight = letterheadImages?.headerBase64
    ? letterheadImages.headerHeight ?? cfg.header.height ?? 30
    : cfg.header.type === 'image' && cfg.header.imageBase64
      ? cfg.header.height
      : 34;
  const footerHeight = letterheadImages?.footerBase64
    ? letterheadImages.footerHeight ?? cfg.footer.height ?? 20
    : cfg.footer.type === 'image' && cfg.footer.imageBase64
      ? cfg.footer.height
      : 18;
  let yPosition = margin;

  const text = (
    value: string,
    x: number,
    y: number,
    size = 9,
    style: 'normal' | 'bold' | 'italic' = 'normal',
    color: [number, number, number] = black,
    options?: { align?: Align; maxWidth?: number }
  ) => {
    if (!value?.trim()) return;
    doc.setFont(ff, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(value, x, y, options);
  };

  const lines = (value: string | string[] | undefined | null, width: number) => {
    const joined = Array.isArray(value) ? value.filter(Boolean).join('\n') : value || '';
    return doc.splitTextToSize(joined, width).filter((line: string) => line.trim());
  };

  const drawLine = (y: number) => {
    doc.setDrawColor(22, 22, 22);
    doc.setLineWidth(0.45);
    doc.line(margin, y, pageWidth - margin, y);
  };

  const drawLetterheadImage = (
    base64: string,
    ext: string | undefined,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    const imageExt = (ext || 'png').toLowerCase() === 'jpg' ? 'JPEG' : 'PNG';
    const mime = imageExt === 'JPEG' ? 'jpeg' : 'png';
    doc.addImage(`data:image/${mime};base64,${base64}`, imageExt, x, y, width, height, undefined, 'NONE');
  };

  const drawHeader = () => {
    if (letterheadImages?.headerBase64) {
      const scale = (letterheadImages.headerScale ?? 100) / 100;
      const width = pageWidth * scale;
      drawLetterheadImage(
        letterheadImages.headerBase64,
        letterheadImages.headerExt,
        (pageWidth - width) / 2,
        0,
        width,
        headerHeight
      );
      yPosition = headerHeight + 10;
      drawLine(yPosition - 4);
      return;
    }

    if (cfg.header.type === 'image' && cfg.header.imageBase64) {
      drawLetterheadImage(cfg.header.imageBase64, cfg.header.imageExt, 0, 0, pageWidth, headerHeight);
      yPosition = headerHeight + 10;
      drawLine(yPosition - 4);
      return;
    }

    if (!showCompanyInPdf) {
      yPosition = margin + 28;
      drawLine(yPosition - 4);
      return;
    }

    const companyName = cfg.header.text || contract.company_name || 'JILD IMPEX';
    const subText = cfg.header.subText || 'New No:11, Old No:698, First Street, Anna Nagar West Extension, Chennai - 600101';
    text(companyName.toUpperCase(), pageWidth / 2, 18, 20, 'bold', black, { align: 'center' });
    text(subText, pageWidth / 2, 25, 9, 'normal', muted, { align: 'center', maxWidth: contentWidth });
    text('Leather Import-Export Agency', pageWidth / 2, 31, 9, 'normal', muted, { align: 'center' });
    drawLine(38);
    yPosition = 48;
  };

  const drawFooter = (pageNumber: number, totalPages: number) => {
    if (letterheadImages?.footerBase64) {
      const scale = (letterheadImages.footerScale ?? 100) / 100;
      const width = pageWidth * scale;
      drawLetterheadImage(
        letterheadImages.footerBase64,
        letterheadImages.footerExt,
        (pageWidth - width) / 2,
        pageHeight - footerHeight,
        width,
        footerHeight
      );
      return;
    }

    if (cfg.footer.type === 'image' && cfg.footer.imageBase64) {
      drawLetterheadImage(cfg.footer.imageBase64, cfg.footer.imageExt, 0, pageHeight - footerHeight, pageWidth, footerHeight);
      return;
    }

    drawLine(pageHeight - 20);
    text(`Page ${pageNumber} / ${totalPages}`, pageWidth / 2, pageHeight - 11, 8, 'normal', muted, { align: 'center' });
    text(cfg.footer.text || 'office@jildimpex.com', pageWidth - margin, pageHeight - 8, 8, 'normal', muted, { align: 'right' });
    text('Chennai, India', margin, pageHeight - 8, 8, 'normal', muted);
  };

  const ensureSpace = (height: number) => {
    if (yPosition + height <= pageHeight - footerHeight - 18) return;
    doc.addPage();
    yPosition = margin + 8;
  };

  const card = (
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    body: string[],
    icon: 'building' | 'document' | 'user' | 'alert' | 'box',
    options: { titleSize?: number; bodySize?: number; bullet?: boolean; titleVisible?: boolean } = {}
  ) => {
    doc.setFillColor(...softFill);
    doc.setDrawColor(...softBorder);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, width, height, 1.6, 1.6, 'FD');

    const iconX = x + 6;
    const iconY = y + 8;
    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.55);
    if (icon === 'building') {
      doc.rect(iconX, iconY - 2, 5, 8);
      doc.rect(iconX + 6, iconY + 1, 5, 5);
      doc.line(iconX + 2, iconY, iconX + 2, iconY + 1);
      doc.line(iconX + 2, iconY + 3, iconX + 2, iconY + 4);
      doc.line(iconX + 8, iconY + 3, iconX + 8, iconY + 4);
    } else if (icon === 'document') {
      doc.rect(iconX, iconY - 3, 8, 10);
      doc.line(iconX + 2, iconY, iconX + 6, iconY);
      doc.line(iconX + 2, iconY + 3, iconX + 6, iconY + 3);
    } else if (icon === 'user') {
      doc.circle(iconX + 4, iconY - 1, 2.4);
      doc.line(iconX - 1, iconY + 7, iconX + 9, iconY + 7);
      doc.line(iconX - 1, iconY + 7, iconX + 1.5, iconY + 3.5);
      doc.line(iconX + 9, iconY + 7, iconX + 6.5, iconY + 3.5);
    } else if (icon === 'alert') {
      doc.circle(iconX + 4, iconY + 1, 3.4);
      text('!', iconX + 4, iconY + 3.2, 8, 'bold', black, { align: 'center' });
    } else {
      doc.rect(iconX, iconY - 2, 8, 8);
      doc.line(iconX, iconY - 2, iconX + 4, iconY - 5);
      doc.line(iconX + 8, iconY - 2, iconX + 4, iconY - 5);
    }

    let cursorY = y + 10;
    if (options.titleVisible !== false) {
      text(title.toUpperCase(), x + 21, cursorY, options.titleSize ?? 10, 'bold');
      cursorY += 10;
    }

    const bodyX = options.titleVisible === false ? x + 14 : x + 21;
    body.forEach((line) => {
      const wrapped = lines(line, width - (bodyX - x) - 8);
      wrapped.forEach((wrappedLine: string, index: number) => {
        if (options.bullet && index === 0) {
          text('•', bodyX, cursorY, options.bodySize ?? 8.8, 'normal');
          text(wrappedLine, bodyX + 5, cursorY, options.bodySize ?? 8.8);
        } else {
          text(wrappedLine, options.bullet ? bodyX + 5 : bodyX, cursorY, options.bodySize ?? 8.8);
        }
        cursorY += 5;
      });
    });
  };

  const labelRows = (rows: Array<[string, string]>, x: number, y: number, labelWidth = 44) => {
    let cursorY = y;
    rows.forEach(([label, value]) => {
      if (!value?.trim()) return;
      text(label.toUpperCase(), x, cursorY, 8.8, 'bold');
      text(value, x + labelWidth, cursorY, 8.8, 'normal');
      cursorY += 7;
    });
    return cursorY;
  };

  const formatDate = (date: string) => {
    if (!date) return '';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString('en-GB');
  };

  drawHeader();

  const halfGap = 8;
  const halfWidth = (contentWidth - halfGap) / 2;
  const leftX = margin;
  const rightX = margin + halfWidth + halfGap;
  const supplierLines = [contract.supplier_name, ...contract.supplier_address].filter(Boolean);
  const contractInfoLines = [
    `Date           : ${formatDate(contract.contract_date)}`,
    `Contract No.   : ${contract.contract_no}`,
    contract.buyers_reference ? `Buyer's Ref.  : ${contract.buyers_reference}` : '',
  ].filter(Boolean);

  ensureSpace(36);
  card(leftX, yPosition, halfWidth, 35, 'Messrs', supplierLines, 'building');
  card(rightX, yPosition, halfWidth, 35, 'Contract Info', contractInfoLines, 'document');
  yPosition += 44;

  text('Dear Sir,', margin, yPosition, 9.5);
  yPosition += 9;
  const intro = 'We confirm having sold on your behalf the following goods, as per terms and conditions stated below.';
  lines(intro, contentWidth).forEach((line: string) => {
    text(line, margin, yPosition, 9.5);
    yPosition += 5;
  });
  yPosition += 6;

  const buyerLines = [contract.buyer_name, ...contract.buyer_address].filter(Boolean);
  const noteLines = contract.important_notes?.filter((note) => note?.trim()) ?? [];
  ensureSpace(48);
  card(leftX, yPosition, halfWidth, 49, 'Buyer', buyerLines, 'user');
  card(rightX, yPosition, halfWidth, 49, 'Very Important', noteLines, 'alert', { bodySize: 8.2, bullet: true });
  yPosition += 57;

  const productRows: Array<[string, string]> = [
    ['Description:', contract.description],
    ['Article:', contract.article],
    ['Size:', [contract.size, contract.average ? `Avg: ${contract.average}` : ''].filter(Boolean).join('   ')],
    ['Substance:', contract.substance],
    ['Measurement:', contract.measurement],
  ];
  ensureSpace(42);
  card(leftX, yPosition, contentWidth, 40, '', [], 'box', { titleVisible: false });
  labelRows(productRows, margin + 20, yPosition + 11, 38);
  yPosition += 48;

  const rows = contract.selection
    .map((selection, index) => ({
      selection,
      color: contract.color[index],
      swatch: contract.swatch[index],
      quantity: contract.quantity[index],
      price: contract.price[index],
    }))
    .filter((row) => row.selection || row.color || row.swatch || row.quantity || row.price);

  if (rows.length) {
    const colWidths = [37, 32, 49, 36, contentWidth - 154];
    const headerH = 10;
    const rowH = 9;
    ensureSpace(headerH + rows.length * rowH + 6);
    doc.setFillColor(14, 14, 14);
    doc.rect(margin, yPosition, contentWidth, headerH, 'F');
    text('SELECTION', margin + 8, yPosition + 6.7, 8, 'bold', [255, 255, 255]);
    text('COLOUR', margin + colWidths[0] + 6, yPosition + 6.7, 8, 'bold', [255, 255, 255]);
    text('REFERENCE', margin + colWidths[0] + colWidths[1] + 6, yPosition + 6.7, 8, 'bold', [255, 255, 255]);
    text('QUANTITY', margin + colWidths[0] + colWidths[1] + colWidths[2] + 6, yPosition + 6.7, 8, 'bold', [255, 255, 255]);
    text('PRICE', margin + contentWidth - 8, yPosition + 6.7, 8, 'bold', [255, 255, 255], { align: 'right' });
    yPosition += headerH;

    rows.forEach((row) => {
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, yPosition + rowH, pageWidth - margin, yPosition + rowH);
      text(row.selection || '', margin + 8, yPosition + 6, 8.7);
      text(row.color || '', margin + colWidths[0] + 6, yPosition + 6, 8.7);
      text(row.swatch || '', margin + colWidths[0] + colWidths[1] + 6, yPosition + 6, 8.7);
      text(row.quantity || '', margin + colWidths[0] + colWidths[1] + colWidths[2] + 6, yPosition + 6, 8.7);
      text(row.price || '', margin + contentWidth - 8, yPosition + 6, 8.7, 'normal', black, { align: 'right' });
      yPosition += rowH;
    });
    yPosition += 7;
  }

  ensureSpace(45);
  const deliveryRows: Array<[string, string]> = [
    ['Delivery:', contract.delivery_schedule?.filter(Boolean).join(', ') || ''],
    ['Destination:', contract.destination?.filter(Boolean).join(', ') || ''],
    ['Payment:', contract.payment_terms],
    ['Commission:', [contract.local_commission, contract.foreign_commission].filter(Boolean).join(', ')],
    ['Notify:', contract.notify_party],
    ['Bank Docs:', contract.bank_documents],
  ];
  yPosition = labelRows(deliveryRows, margin + 12, yPosition + 2, 42) + 4;

  ensureSpace(34);
  doc.setFillColor(...softFill);
  doc.setDrawColor(...softBorder);
  doc.roundedRect(margin, yPosition, contentWidth, 28, 1.6, 1.6, 'FD');
  text('TERMS:', margin + 7, yPosition + 8, 8.5, 'bold');
  lines('This contract is subjected to all terms and conditions of the international finished leather contract No.7.', contentWidth - 28).forEach((line: string, index: number) => {
    text(line, margin + 22, yPosition + 8 + index * 5, 8.5);
  });
  text('INSPECTION:', margin + 7, yPosition + 19, 8.5, 'bold');
  lines('Notwithstanding anything to the contrary, inspection shall be within 15 days after delivery of the goods at buyer warehouse.', contentWidth - 36).forEach((line: string, index: number) => {
    text(line, margin + 29, yPosition + 19 + index * 5, 8.5);
  });
  yPosition += 38;

  ensureSpace(38);
  text('We Confirm the above sale', margin, yPosition, 9);
  text('Yours Faithfully,', pageWidth - margin, yPosition, 9, 'normal', black, { align: 'right' });
  yPosition += 8;
  text(`For ${contract.company_name.toUpperCase()}`, pageWidth - margin, yPosition, 9, 'bold', black, { align: 'right' });
  yPosition += 5;

  if (signatureBase64) {
    doc.addImage(`data:image/png;base64,${signatureBase64}`, 'PNG', pageWidth - margin - 50, yPosition, 50, 20, undefined, 'NONE');
    yPosition += 24;
  } else if (includeSignature) {
    yPosition += 18;
    doc.line(pageWidth - margin - 50, yPosition, pageWidth - margin, yPosition);
    yPosition += 4;
  } else {
    yPosition += 18;
  }

  text('Seller', margin, yPosition, 8.8, 'bold');
  text('Buyer', pageWidth / 2, yPosition, 8.8, 'bold', black, { align: 'center' });
  text('Partner / Manager', pageWidth - margin, yPosition, 8.8, 'bold', black, { align: 'right' });

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawFooter(page, totalPages);
  }

  const base64 = doc.output('datauristring').split(',')[1];
  if (download) doc.save(`contract-${contract.contract_no}.pdf`);
  return base64;
};
