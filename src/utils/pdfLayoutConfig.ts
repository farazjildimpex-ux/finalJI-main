export type FontStyle = 'normal' | 'bold' | 'italic';
export type TextAlign = 'left' | 'center' | 'right';
export type HeaderType = 'none' | 'text' | 'image';
export type FontFamily = 'helvetica' | 'times' | 'courier';

export interface PdfSectionConfig {
  id: string;
  label: string;
  yOffset: number;    // mm, positive = down, negative = up
  xOffset: number;    // mm, positive = right, negative = left
  fontSize: number;   // pt
  fontStyle: FontStyle;
  align: TextAlign;
  visible: boolean;
  // preview meta — not user-editable
  _defaultY: number;  // mm from top of content area (after header)
  _defaultH: number;  // approximate height in mm
  _side: 'left' | 'right' | 'full';
  _color: string;     // preview band color (tailwind bg)
}

export interface PdfHeaderFooterConfig {
  type: HeaderType;
  text: string;
  subText: string;
  imageBase64: string | null;
  imageExt: 'png' | 'jpg';
  height: number;   // mm
  fontSize: number; // pt, main text
  subFontSize: number; // pt, sub text
  align: TextAlign;
  yOffset: number;  // mm extra gap between header and content start
}

export interface PdfLayoutConfig {
  margin: number;       // mm, left & right
  labelWidth: number;   // mm, label column for key-value pairs
  lineSpacing: number;  // multiplier (1.0 = default)
  fontFamily: FontFamily;
  header: PdfHeaderFooterConfig;
  footer: PdfHeaderFooterConfig;
  sections: PdfSectionConfig[];
}

export const DEFAULT_PDF_LAYOUT: PdfLayoutConfig = {
  margin: 15,
  labelWidth: 35,
  lineSpacing: 1.0,
  fontFamily: 'helvetica',
  header: {
    type: 'none',
    text: 'JILD IMPEX',
    subText: 'New No:11, Old No:698, First Street, Anna Nagar West Extension, Chennai - 600101',
    imageBase64: null,
    imageExt: 'png',
    height: 30,
    fontSize: 20,
    subFontSize: 9,
    align: 'center',
    yOffset: 5,
  },
  footer: {
    type: 'none',
    text: '',
    subText: '',
    imageBase64: null,
    imageExt: 'png',
    height: 20,
    fontSize: 9,
    subFontSize: 8,
    align: 'center',
    yOffset: 0,
  },
  sections: [
    { id: 'supplierBlock',    label: 'Supplier Block',           yOffset: 0, xOffset: 0, fontSize: 11, fontStyle: 'normal', align: 'left',   visible: true,  _defaultY: 37,  _defaultH: 20, _side: 'left',  _color: 'bg-blue-200' },
    { id: 'contractInfoBlock',label: 'Contract Info (Date/No)',  yOffset: 0, xOffset: 0, fontSize: 11, fontStyle: 'normal', align: 'left',   visible: true,  _defaultY: 37,  _defaultH: 18, _side: 'right', _color: 'bg-indigo-200' },
    { id: 'introText',        label: 'Introduction Text',        yOffset: 0, xOffset: 0, fontSize: 11, fontStyle: 'normal', align: 'left',   visible: true,  _defaultY: 62,  _defaultH: 10, _side: 'full',  _color: 'bg-slate-200' },
    { id: 'buyerBlock',       label: 'Buyer Block',              yOffset: 0, xOffset: 0, fontSize: 11, fontStyle: 'normal', align: 'left',   visible: true,  _defaultY: 76,  _defaultH: 20, _side: 'left',  _color: 'bg-teal-200' },
    { id: 'productFields',    label: 'Product Fields',           yOffset: 0, xOffset: 0, fontSize: 11, fontStyle: 'normal', align: 'left',   visible: true,  _defaultY: 80,  _defaultH: 30, _side: 'left',  _color: 'bg-cyan-200' },
    { id: 'importantNotes',   label: 'Very Important Notes',     yOffset: 0, xOffset: 0, fontSize: 9,  fontStyle: 'bold',   align: 'left',   visible: true,  _defaultY: 76,  _defaultH: 30, _side: 'right', _color: 'bg-amber-200' },
    { id: 'specsTable',       label: 'Specifications Table',     yOffset: 0, xOffset: 0, fontSize: 11, fontStyle: 'normal', align: 'left',   visible: true,  _defaultY: 113, _defaultH: 25, _side: 'full',  _color: 'bg-violet-200' },
    { id: 'deliveryInfo',     label: 'Delivery & Payment',       yOffset: 0, xOffset: 0, fontSize: 11, fontStyle: 'normal', align: 'left',   visible: true,  _defaultY: 142, _defaultH: 38, _side: 'full',  _color: 'bg-orange-200' },
    { id: 'termsText',        label: 'Terms & Inspection',       yOffset: 0, xOffset: 0, fontSize: 10, fontStyle: 'normal', align: 'left',   visible: true,  _defaultY: 184, _defaultH: 22, _side: 'full',  _color: 'bg-rose-200' },
    { id: 'closingBlock',     label: 'Closing & Signature',      yOffset: 0, xOffset: 0, fontSize: 11, fontStyle: 'normal', align: 'left',   visible: true,  _defaultY: 210, _defaultH: 20, _side: 'full',  _color: 'bg-pink-200' },
    { id: 'sellerBuyerLine',  label: 'Seller / Buyer Line',      yOffset: 0, xOffset: 0, fontSize: 11, fontStyle: 'bold',   align: 'left',   visible: true,  _defaultY: 232, _defaultH: 8,  _side: 'full',  _color: 'bg-slate-300' },
  ],
};

const STORAGE_KEY = 'jild_pdf_layout_config';

export function savePdfLayoutConfig(config: PdfLayoutConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save PDF layout config', e);
  }
}

export function loadPdfLayoutConfig(): PdfLayoutConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PDF_LAYOUT;
    const parsed = JSON.parse(raw) as PdfLayoutConfig;
    // Merge with defaults to pick up new sections added in updates
    const mergedSections = DEFAULT_PDF_LAYOUT.sections.map(def => {
      const saved = parsed.sections?.find(s => s.id === def.id);
      return saved ? { ...def, ...saved } : def;
    });
    return { ...DEFAULT_PDF_LAYOUT, ...parsed, sections: mergedSections };
  } catch (e) {
    return DEFAULT_PDF_LAYOUT;
  }
}

export function resetPdfLayoutConfig(): PdfLayoutConfig {
  localStorage.removeItem(STORAGE_KEY);
  return DEFAULT_PDF_LAYOUT;
}

export function getSection(config: PdfLayoutConfig, id: string): PdfSectionConfig {
  return config.sections.find(s => s.id === id) ?? (DEFAULT_PDF_LAYOUT.sections.find(s => s.id === id) as PdfSectionConfig);
}
