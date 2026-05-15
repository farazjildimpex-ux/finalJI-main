import jsPDF from 'jspdf';
import { format } from 'date-fns';
import type { Company, Sample } from '../types';
import { loadPdfLayoutConfig, getField, urlToBase64, type PdfLayoutConfig } from './pdfLayoutConfig';

/** Parse rich-text HTML into lines, preserving intentional blank lines. */
function htmlToLines(html: string): string[] {
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  const raw = text.split('\n');
  // Trim leading/trailing empty lines only, not interior ones
  let start = 0, end = raw.length - 1;
  while (start < raw.length && !raw[start].trim()) start++;
  while (end > start && !raw[end].trim()) end--;
  return raw.slice(start, end + 1);
}

export const generateSamplePDF = async (
  sample: Sample,
  company?: Company | null,
  showCompanyInPdf = true,
  download = true,
  letterheadImages?: { headerBase64: string | null; footerBase64: string | null; headerExt?: string; footerExt?: string },
  layoutConfig?: PdfLayoutConfig,
  signatureBase64?: string
): Promise<string> => {
  const cfg = layoutConfig ?? loadPdfLayoutConfig();

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: false });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin       = cfg.page.margin;
  const contentWidth = pageWidth - margin * 2;
  const ff           = cfg.page.fontFamily as string;
  let y              = margin;

  const headerH = cfg.header.height;
  const footerH = cfg.footer.height;

  // ── Header / Letterhead (4-branch) ───────────────────────────────────────
  if (letterheadImages?.headerBase64) {
    const ext = (letterheadImages.headerExt || 'png').toUpperCase() as 'PNG' | 'JPEG';
    doc.addImage(`data:image/${letterheadImages.headerExt || 'png'};base64,${letterheadImages.headerBase64}`, ext, 0, 0, pageWidth, headerH, undefined, 'NONE');
    y = headerH + cfg.header.yOffset;
    if (letterheadImages.footerBase64) {
      const fExt = (letterheadImages.footerExt || 'png').toUpperCase() as 'PNG' | 'JPEG';
      doc.addImage(`data:image/${letterheadImages.footerExt || 'png'};base64,${letterheadImages.footerBase64}`, fExt, 0, pageHeight - footerH, pageWidth, footerH, undefined, 'NONE');
    }
  } else if (cfg.header.type === 'image' && cfg.header.imageBase64) {
    const ext = (cfg.header.imageExt === 'jpg' ? 'JPEG' : 'PNG') as 'PNG' | 'JPEG';
    doc.addImage(`data:image/${cfg.header.imageExt};base64,${cfg.header.imageBase64}`, ext, 0, 0, pageWidth, headerH, undefined, 'NONE');
    y = headerH + cfg.header.yOffset;
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
      doc.text((cfg.header.text || sample.company_name).toUpperCase(), xHead + fCN.xOffset, y + fCN.yOffset, { align });
      y += fCN.fontSize * 0.35 + 2;
    }
    if (fCA.visible && cfg.header.subText) {
      doc.setFont(ff, fCA.fontStyle); doc.setFontSize(fCA.fontSize);
      const subLines = doc.splitTextToSize(cfg.header.subText, contentWidth);
      doc.text(subLines, xHead + fCA.xOffset, y + fCA.yOffset, { align });
      y += subLines.length * (fCA.fontSize * 0.35) + 2;
    }
    doc.setLineWidth(0.5); doc.line(margin, y, pageWidth - margin, y);
    y += cfg.header.yOffset;
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
      doc.text(sample.company_name.toUpperCase(), pageWidth / 2 + fCN.xOffset, y + fCN.yOffset, { align: 'center' });
      y += 7;
    }
    if (fCA.visible) {
      doc.setFont(ff, fCA.fontStyle); doc.setFontSize(fCA.fontSize);
      doc.text('New No:11, Old No:698, First Street, Anna Nagar West Extension,', pageWidth / 2 + fCA.xOffset, y + fCA.yOffset, { align: 'center' });
      y += 4.5;
      doc.text('Chennai - 600101 — Mob: +91 98410 91189, Email: office@jildimpex.com', pageWidth / 2 + fCA.xOffset, y + fCA.yOffset, { align: 'center' });
      y += 6;
    }
    doc.setLineWidth(0.5); doc.line(margin, y, pageWidth - margin, y);
    y += 12;
  } else {
    y += 45;
  }

  // ── Supplier & date block ─────────────────────────────────────────────────
  const startY = y;
  doc.setFont(ff, 'bold'); doc.setFontSize(12);
  doc.text('Messrs:', margin, y); y += 5;
  doc.text(sample.supplier_name, margin, y); y += 5;
  doc.setFont(ff, 'normal'); doc.setFontSize(11);
  sample.supplier_address.forEach(line => { if (line) { doc.text(line, margin, y); y += 4.5; } });

  const rightX = pageWidth - margin;
  doc.setFont(ff, 'bold'); doc.text('Date:', rightX - 45, startY);
  doc.setFont(ff, 'normal'); doc.text(sample.date ? format(new Date(sample.date), 'dd/MM/yyyy') : '', rightX, startY, { align: 'right' });
  doc.setFont(ff, 'bold'); doc.text('Letter No:', rightX - 45, startY + 6);
  doc.setFont(ff, 'normal'); doc.text(sample.sample_number, rightX, startY + 6, { align: 'right' });

  y = Math.max(y, startY + 20) + 10;
  doc.text('Dear Sirs,', margin, y); y += 8;

  if (sample.description?.trim()) {
    doc.setFont(ff, 'bold'); doc.setFontSize(13);
    const descLines = doc.splitTextToSize(sample.description.trim().toUpperCase(), contentWidth);
    doc.text(descLines, pageWidth / 2, y, { align: 'center' });
    y += descLines.length * 6 + 8;
  }

  // ── Letter body — preserving blank lines ──────────────────────────────────
  doc.setFont(ff, 'normal'); doc.setFontSize(11);
  const lines = htmlToLines(sample.notes || '');
  lines.forEach(line => {
    if (y > pageHeight - 50) { doc.addPage(); y = margin + 10; }
    if (!line.trim()) {
      y += 5; // intentional blank line → vertical gap
      return;
    }
    const wrapped = doc.splitTextToSize(line.trim(), contentWidth);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 5.5;
  });

  // ── Closing ───────────────────────────────────────────────────────────────
  y += 12;
  if (y > pageHeight - 55) { doc.addPage(); y = margin + 10; }

  doc.setFont(ff, 'normal');
  doc.text('Yours Faithfully,', pageWidth - margin, y, { align: 'right' }); y += 6;
  doc.setFont(ff, 'bold');
  doc.text(`For ${sample.company_name.toUpperCase()}`, pageWidth - margin, y, { align: 'right' });

  y += 5;

  // ── Signature image ───────────────────────────────────────────────────────
  if (signatureBase64) {
    const sigW = 48, sigH = 20;
    doc.addImage(`data:image/png;base64,${signatureBase64}`, 'PNG', pageWidth - margin - sigW, y, sigW, sigH, undefined, 'NONE');
    y += sigH + 2;
  } else {
    y += 18;
  }

  if (sample.customer_comments) {
    doc.setFont(ff, 'bold'); doc.setFontSize(11);
    doc.text(sample.customer_comments, pageWidth - margin, y, { align: 'right' }); y += 5;
  }
  doc.setFont(ff, 'normal'); doc.setFontSize(11);
  doc.text('Partner / Manager', pageWidth - margin, y, { align: 'right' });

  const base64 = doc.output('datauristring').split(',')[1];
  if (download) doc.save(`letter-${sample.sample_number}.pdf`);
  return base64;
};
