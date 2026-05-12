export type FontStyle = 'normal' | 'bold' | 'italic';
export type TextAlign = 'left' | 'center' | 'right';
export type HeaderType = 'none' | 'text' | 'image';
export type FontFamily = 'helvetica' | 'times' | 'courier';

export interface PdfFieldConfig {
  id: string;
  label: string;
  fontSize: number;
  fontStyle: FontStyle;
  visible: boolean;
  customLabel: string;
  group: string;
  xOffset: number;
  yOffset: number;
  /** Font size for the data/value column (falls back to fontSize if absent) */
  dataFontSize: number;
  /** Font style for the data/value column */
  dataFontStyle: FontStyle;
  /** True when this field renders a separate data/value column next to the label */
  hasData: boolean;
}

export interface PdfHeaderFooterConfig {
  type: HeaderType;
  text: string;
  subText: string;
  imageBase64: string | null;
  imageExt: 'png' | 'jpg';
  height: number;
  fontSize: number;
  subFontSize: number;
  align: TextAlign;
  yOffset: number;
}

export interface PdfPageConfig {
  margin: number;
  labelWidth: number;
  lineSpacing: number;
  fontFamily: FontFamily;
}

export interface PdfLayoutConfig {
  page: PdfPageConfig;
  header: PdfHeaderFooterConfig;
  footer: PdfHeaderFooterConfig;
  fields: PdfFieldConfig[];
}

// Helper to build a field entry concisely
const f = (
  id: string, label: string, fontSize: number, fontStyle: FontStyle,
  visible: boolean, customLabel: string, group: string,
  hasData = false,
): PdfFieldConfig => ({
  id, label, fontSize, fontStyle, visible, customLabel, group,
  xOffset: 0, yOffset: 0,
  dataFontSize: fontSize,
  dataFontStyle: 'normal',
  hasData,
});

export const DEFAULT_FIELDS: PdfFieldConfig[] = [
  f('companyName',        'Company Name',           20, 'bold',   true, '',                                         'Header'),
  f('companyAddress',     'Company Address',         10, 'normal', true, '',                                         'Header'),

  f('messrsLabel',        'Messrs Label',            11, 'bold',   true, 'Messrs:',                                  'Supplier'),
  f('supplierName',       'Supplier Name',           11, 'normal', true, '',                                         'Supplier'),
  f('supplierAddress',    'Supplier Address',        11, 'normal', true, '',                                         'Supplier'),

  f('dateField',          'Date',                    11, 'bold',   true, 'Date:',                                    'Contract Info', true),
  f('contractNoField',    'Contract No',             11, 'bold',   true, 'Contract No:',                             'Contract Info', true),
  f('buyersRefField',     "Buyer's Ref",             11, 'bold',   true, "Buyer's Ref:",                             'Contract Info', true),

  f('dearSirs',           '"Dear Sirs,"',            11, 'normal', true, 'Dear Sirs,',                               'Introduction'),
  f('introLine',          'Intro Paragraph',         11, 'normal', true, 'We confirm having sold on your behalf the following goods, as per terms and conditions stated below.', 'Introduction'),

  f('buyerLabel',         'Buyer Label',             11, 'bold',   true, 'Buyer:',                                   'Buyer Info'),
  f('buyerName',          'Buyer Name',              11, 'normal', true, '',                                         'Buyer Info'),
  f('buyerAddress',       'Buyer Address',           11, 'normal', true, '',                                         'Buyer Info'),

  f('descriptionField',   'Description',             11, 'bold',   true, 'Description:',                             'Product Fields', true),
  f('articleField',       'Article',                 11, 'bold',   true, 'Article:',                                 'Product Fields', true),
  f('sizeField',          'Size / Avg',              11, 'bold',   true, 'Size:',                                    'Product Fields', true),
  f('substanceField',     'Substance',               11, 'bold',   true, 'Substance:',                               'Product Fields', true),
  f('measurementField',   'Measurement',             11, 'bold',   true, 'Measurement:',                             'Product Fields', true),

  f('veryImportantTitle', '"Very Important" Title',   9, 'bold',   true, 'VERY IMPORTANT',                           'Important Notes'),
  f('importantNoteLines', 'Note Lines',               9, 'normal', true, '',                                         'Important Notes'),

  f('specsTableHeader',   'Table Header Row',        11, 'bold',   true, '',                                         'Specs Table'),
  f('specsTableRows',     'Table Data Rows',         11, 'normal', true, '',                                         'Specs Table'),

  f('deliveryField',      'Delivery',                11, 'bold',   true, 'Delivery:',                                'Delivery & Payment', true),
  f('destinationField',   'Destination',             11, 'bold',   true, 'Destination:',                             'Delivery & Payment', true),
  f('paymentField',       'Payment',                 11, 'bold',   true, 'Payment:',                                 'Delivery & Payment', true),
  f('commissionField',    'Commission',              11, 'bold',   true, 'Commission:',                              'Delivery & Payment', true),
  f('notifyField',        'Notify',                  11, 'bold',   true, 'Notify:',                                  'Delivery & Payment', true),
  f('bankDocumentsField', 'Bank Documents',          11, 'bold',   true, 'Bank Documents:',                          'Delivery & Payment', true),

  f('termsText',          'Terms',                   10, 'bold',   true, 'Terms:',                                   'Terms & Inspection', true),
  f('inspectionText',     'Inspection',              10, 'bold',   true, 'Inspection:',                              'Terms & Inspection', true),

  f('closingLeftLine',    'Left Closing Text',       11, 'normal', true, 'We Confirm the above sale',                'Closing'),
  f('closingRightLine',   'Right Closing Text',      11, 'normal', true, 'Yours Faithfully,',                        'Closing'),
  f('closingCompanyName', 'Company Name (right)',    11, 'bold',   true, '',                                         'Closing'),

  f('sellerLabel',        '"Seller" Label',          11, 'bold',   true, 'Seller',                                   'Signature Line'),
  f('buyerSignLabel',     '"Buyer" Label',           11, 'bold',   true, 'Buyer',                                    'Signature Line'),
  f('partnerLabel',       '"Partner / Manager"',     11, 'bold',   true, 'Partner / Manager',                        'Signature Line'),
];

export const DEFAULT_PDF_LAYOUT: PdfLayoutConfig = {
  page: {
    margin: 15,
    labelWidth: 35,
    lineSpacing: 1.0,
    fontFamily: 'helvetica',
  },
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
  fields: DEFAULT_FIELDS,
};

const STORAGE_KEY = 'jild_pdf_layout_v2';

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
    const mergedFields = DEFAULT_FIELDS.map(def => {
      const saved = parsed.fields?.find(f => f.id === def.id);
      return saved ? { ...def, ...saved } : def;
    });
    return {
      ...DEFAULT_PDF_LAYOUT,
      ...parsed,
      page: { ...DEFAULT_PDF_LAYOUT.page, ...parsed.page },
      header: { ...DEFAULT_PDF_LAYOUT.header, ...parsed.header },
      footer: { ...DEFAULT_PDF_LAYOUT.footer, ...parsed.footer },
      fields: mergedFields,
    };
  } catch {
    return DEFAULT_PDF_LAYOUT;
  }
}

export function resetPdfLayoutConfig(): PdfLayoutConfig {
  localStorage.removeItem(STORAGE_KEY);
  return DEFAULT_PDF_LAYOUT;
}

export function getField(config: PdfLayoutConfig, id: string): PdfFieldConfig {
  return config.fields.find(f => f.id === id) ?? (DEFAULT_FIELDS.find(f => f.id === id) as PdfFieldConfig);
}

// ── Company letterhead loading ────────────────────────────────────────────────

async function urlToBase64(url: string): Promise<{ base64: string; ext: 'png' | 'jpg' } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const ext: 'png' | 'jpg' = blob.type === 'image/jpeg' ? 'jpg' : 'png';
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload  = () => resolve({ base64: (reader.result as string).split(',')[1], ext });
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export interface LetterheadImages {
  headerBase64: string | null;
  footerBase64: string | null;
  headerExt: string;
  footerExt: string;
  headerHeight: number;
  footerHeight: number;
}

export async function loadCompanyLetterheadImages(company: {
  header_url?: string | null;
  footer_url?: string | null;
  header_ext?: string;
  footer_ext?: string;
  header_height?: number;
  footer_height?: number;
}): Promise<LetterheadImages> {
  const result: LetterheadImages = {
    headerBase64: null, footerBase64: null,
    headerExt: 'png',  footerExt: 'png',
    headerHeight: company.header_height ?? 30,
    footerHeight: company.footer_height ?? 20,
  };

  if (company.header_url) {
    const img = await urlToBase64(company.header_url);
    if (img) { result.headerBase64 = img.base64; result.headerExt = company.header_ext || img.ext; }
  }

  if (company.footer_url) {
    const img = await urlToBase64(company.footer_url);
    if (img) { result.footerBase64 = img.base64; result.footerExt = company.footer_ext || img.ext; }
  }

  return result;
}
