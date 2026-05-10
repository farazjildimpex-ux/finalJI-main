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

export const DEFAULT_FIELDS: PdfFieldConfig[] = [
  { id: 'companyName',        label: 'Company Name',            fontSize: 20, fontStyle: 'bold',   visible: true, customLabel: '',                          group: 'Header' },
  { id: 'companyAddress',     label: 'Company Address',         fontSize: 10, fontStyle: 'normal', visible: true, customLabel: '',                          group: 'Header' },

  { id: 'messrsLabel',        label: 'Messrs Label',            fontSize: 11, fontStyle: 'bold',   visible: true, customLabel: 'Messrs:',                   group: 'Supplier' },
  { id: 'supplierName',       label: 'Supplier Name',           fontSize: 11, fontStyle: 'normal', visible: true, customLabel: '',                          group: 'Supplier' },
  { id: 'supplierAddress',    label: 'Supplier Address',        fontSize: 11, fontStyle: 'normal', visible: true, customLabel: '',                          group: 'Supplier' },

  { id: 'dateField',          label: 'Date',                    fontSize: 11, fontStyle: 'normal', visible: true, customLabel: 'Date:',                     group: 'Contract Info' },
  { id: 'contractNoField',    label: 'Contract No',             fontSize: 11, fontStyle: 'normal', visible: true, customLabel: 'Contract No:',              group: 'Contract Info' },
  { id: 'buyersRefField',     label: "Buyer's Ref",             fontSize: 11, fontStyle: 'normal', visible: true, customLabel: "Buyer's Ref:",              group: 'Contract Info' },

  { id: 'dearSirs',           label: '"Dear Sirs,"',            fontSize: 11, fontStyle: 'normal', visible: true, customLabel: 'Dear Sirs,',                group: 'Introduction' },
  { id: 'introLine',          label: 'Intro Paragraph',         fontSize: 11, fontStyle: 'normal', visible: true, customLabel: 'We confirm having sold on your behalf the following goods, as per terms and conditions stated below.', group: 'Introduction' },

  { id: 'buyerLabel',         label: 'Buyer Label',             fontSize: 11, fontStyle: 'bold',   visible: true, customLabel: 'Buyer:',                    group: 'Buyer Info' },
  { id: 'buyerName',          label: 'Buyer Name',              fontSize: 11, fontStyle: 'normal', visible: true, customLabel: '',                          group: 'Buyer Info' },
  { id: 'buyerAddress',       label: 'Buyer Address',           fontSize: 11, fontStyle: 'normal', visible: true, customLabel: '',                          group: 'Buyer Info' },

  { id: 'descriptionField',   label: 'Description',             fontSize: 11, fontStyle: 'normal', visible: true, customLabel: 'Description:',              group: 'Product Fields' },
  { id: 'articleField',       label: 'Article',                 fontSize: 11, fontStyle: 'normal', visible: true, customLabel: 'Article:',                  group: 'Product Fields' },
  { id: 'sizeField',          label: 'Size / Avg',              fontSize: 11, fontStyle: 'normal', visible: true, customLabel: 'Size:',                     group: 'Product Fields' },
  { id: 'substanceField',     label: 'Substance',               fontSize: 11, fontStyle: 'normal', visible: true, customLabel: 'Substance:',                group: 'Product Fields' },
  { id: 'measurementField',   label: 'Measurement',             fontSize: 11, fontStyle: 'normal', visible: true, customLabel: 'Measurement:',              group: 'Product Fields' },

  { id: 'veryImportantTitle', label: '"Very Important" Title',  fontSize: 9,  fontStyle: 'bold',   visible: true, customLabel: 'VERY IMPORTANT',            group: 'Important Notes' },
  { id: 'importantNoteLines', label: 'Note Lines',              fontSize: 9,  fontStyle: 'normal', visible: true, customLabel: '',                          group: 'Important Notes' },

  { id: 'specsTableHeader',   label: 'Table Header Row',        fontSize: 11, fontStyle: 'bold',   visible: true, customLabel: '',                          group: 'Specs Table' },
  { id: 'specsTableRows',     label: 'Table Data Rows',         fontSize: 11, fontStyle: 'normal', visible: true, customLabel: '',                          group: 'Specs Table' },

  { id: 'deliveryField',      label: 'Delivery',                fontSize: 11, fontStyle: 'normal', visible: true, customLabel: 'Delivery:',                 group: 'Delivery & Payment' },
  { id: 'destinationField',   label: 'Destination',             fontSize: 11, fontStyle: 'normal', visible: true, customLabel: 'Destination:',              group: 'Delivery & Payment' },
  { id: 'paymentField',       label: 'Payment',                 fontSize: 11, fontStyle: 'normal', visible: true, customLabel: 'Payment:',                  group: 'Delivery & Payment' },
  { id: 'commissionField',    label: 'Commission',              fontSize: 11, fontStyle: 'normal', visible: true, customLabel: 'Commission:',               group: 'Delivery & Payment' },
  { id: 'notifyField',        label: 'Notify',                  fontSize: 11, fontStyle: 'normal', visible: true, customLabel: 'Notify:',                   group: 'Delivery & Payment' },
  { id: 'bankDocumentsField', label: 'Bank Documents',          fontSize: 11, fontStyle: 'normal', visible: true, customLabel: 'Bank Documents:',           group: 'Delivery & Payment' },

  { id: 'termsText',          label: 'Terms',                   fontSize: 10, fontStyle: 'normal', visible: true, customLabel: 'Terms:',                    group: 'Terms & Inspection' },
  { id: 'inspectionText',     label: 'Inspection',              fontSize: 10, fontStyle: 'normal', visible: true, customLabel: 'Inspection:',               group: 'Terms & Inspection' },

  { id: 'closingLeftLine',    label: 'Left Closing Text',       fontSize: 11, fontStyle: 'normal', visible: true, customLabel: 'We Confirm the above sale', group: 'Closing' },
  { id: 'closingRightLine',   label: 'Right Closing Text',      fontSize: 11, fontStyle: 'normal', visible: true, customLabel: 'Yours Faithfully,',         group: 'Closing' },
  { id: 'closingCompanyName', label: 'Company Name (right)',    fontSize: 11, fontStyle: 'bold',   visible: true, customLabel: '',                          group: 'Closing' },

  { id: 'sellerLabel',        label: '"Seller" Label',          fontSize: 11, fontStyle: 'bold',   visible: true, customLabel: 'Seller',                    group: 'Signature Line' },
  { id: 'buyerSignLabel',     label: '"Buyer" Label',           fontSize: 11, fontStyle: 'bold',   visible: true, customLabel: 'Buyer',                     group: 'Signature Line' },
  { id: 'partnerLabel',       label: '"Partner / Manager"',     fontSize: 11, fontStyle: 'bold',   visible: true, customLabel: 'Partner / Manager',         group: 'Signature Line' },
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
