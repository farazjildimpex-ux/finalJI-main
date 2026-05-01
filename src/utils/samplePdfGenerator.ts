import jsPDF from 'jspdf';
import { format } from 'date-fns';
import type { Company, Sample } from '../types';

const DEFAULT_TEXT_COLOR = '#1f2937';
const DEFAULT_FONT_SIZE = 11;

const normalizeRichText = (value: string) => {
  if (!value.trim()) return '<div><br></div>';
  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(value);
  if (hasHtml) return value;
  return value.split('\n').map((line) => (line ? `<div>${line}</div>` : '<div><br></div>')).join('');
};

export const generateSamplePDF = async (
  sample: Sample,
  company?: Company | null,
  showCompanyInPdf = true,
  download = true
): Promise<string> => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;
  let xCursor = margin;

  // 1. Professional Letterhead Header
  if (showCompanyInPdf) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(sample.company_name.toUpperCase(), pageWidth / 2, y, { align: 'center' });
    y += 7;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('New No:11, Old No:698, First Street, Anna Nagar West Extension,', pageWidth / 2, y, { align: 'center' });
    y += 4.5;
    doc.text('Chennai - 600101 — Mob: +91 98410 91189, Email: office@jildimpex.com', pageWidth / 2, y, { align: 'center' });
    y += 6;
    
    // Horizontal Line
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 12;
  } else {
    y += 45; // Space for pre-printed letterhead
  }

  // Supplier Details (Left) and Date/Ref (Right)
  const startY = y;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Messrs:', margin, y);
  y += 5;
  doc.text(sample.supplier_name, margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  sample.supplier_address.forEach((line) => {
    if (line) {
      doc.text(line, margin, y);
      y += 4.5;
    }
  });

  // Right side info
  const rightX = pageWidth - margin;
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', rightX - 45, startY);
  doc.setFont('helvetica', 'normal');
  doc.text(sample.date ? format(new Date(sample.date), 'dd/MM/yyyy') : '', rightX, startY, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.text('Letter No:', rightX - 45, startY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(sample.sample_number, rightX, startY + 6, { align: 'right' });

  y = Math.max(y, startY + 20) + 10;

  doc.text('Dear Sirs,', margin, y);
  y += 8;

  if (sample.description?.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    const descriptionLines = doc.splitTextToSize(sample.description.trim().toUpperCase(), contentWidth);
    doc.text(descriptionLines, pageWidth / 2, y, { align: 'center' });
    y += descriptionLines.length * 6 + 8;
  }

  // Content Rendering (Simplified for reliability)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const cleanNotes = sample.notes.replace(/<[^>]*>/g, '\n').split('\n').filter(Boolean);
  cleanNotes.forEach(line => {
    if (y > pageHeight - 30) {
      doc.addPage();
      y = margin + 10;
    }
    const lines = doc.splitTextToSize(line, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 5.5;
  });

  y += 15;
  if (y > pageHeight - 40) {
    doc.addPage();
    y = margin + 10;
  }

  doc.setFont('helvetica', 'normal');
  doc.text('Yours Faithfully,', pageWidth - margin, y, { align: 'right' });
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text(`For ${sample.company_name.toUpperCase()}`, pageWidth - margin, y, { align: 'right' });
  
  y += 20;
  if (sample.customer_comments) {
    doc.text(sample.customer_comments, pageWidth - margin, y, { align: 'right' });
    y += 6;
  }
  doc.setFont('helvetica', 'normal');
  doc.text('Partner / Manager', pageWidth - margin, y, { align: 'right' });

  const base64 = doc.output('datauristring').split(',')[1];
  if (download) doc.save(`letter-${sample.sample_number}.pdf`);
  return base64;
};