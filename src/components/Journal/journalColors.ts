export type JournalColorKey =
  | 'yellow'
  | 'peach'
  | 'pink'
  | 'rose'
  | 'lavender'
  | 'sky'
  | 'mint'
  | 'lime'
  | 'slate';

export interface JournalColorOption {
  key: JournalColorKey;
  name: string;
  swatch: string;
}

export const JOURNAL_COLOR_OPTIONS: JournalColorOption[] = [
  { key: 'yellow', name: 'Sunny', swatch: '#fef3c7' },
  { key: 'peach', name: 'Peach', swatch: '#fed7aa' },
  { key: 'pink', name: 'Blush', swatch: '#fbcfe8' },
  { key: 'rose', name: 'Rose', swatch: '#fecdd3' },
  { key: 'lavender', name: 'Lavender', swatch: '#ddd6fe' },
  { key: 'sky', name: 'Sky', swatch: '#bae6fd' },
  { key: 'mint', name: 'Mint', swatch: '#bbf7d0' },
  { key: 'lime', name: 'Lime', swatch: '#d9f99d' },
  { key: 'slate', name: 'Plain', swatch: '#f1f5f9' },
];

export interface JournalColorStyles {
  bg: string;
  border: string;
  hoverBorder: string;
  title: string;
  body: string;
  meta: string;
  badge: string;
  iconButton: string;
}

const STYLES: Record<JournalColorKey, JournalColorStyles> = {
  yellow: {
    bg: 'bg-amber-100',
    border: 'border-amber-200',
    hoverBorder: 'hover:border-amber-400',
    title: 'text-amber-950',
    body: 'text-amber-900/80',
    meta: 'text-amber-700/70',
    badge: 'bg-amber-200/70 text-amber-800',
    iconButton: 'text-amber-700 hover:text-amber-900 hover:bg-amber-200/60',
  },
  peach: {
    bg: 'bg-orange-100',
    border: 'border-orange-200',
    hoverBorder: 'hover:border-orange-400',
    title: 'text-orange-950',
    body: 'text-orange-900/80',
    meta: 'text-orange-700/70',
    badge: 'bg-orange-200/70 text-orange-800',
    iconButton: 'text-orange-700 hover:text-orange-900 hover:bg-orange-200/60',
  },
  pink: {
    bg: 'bg-pink-100',
    border: 'border-pink-200',
    hoverBorder: 'hover:border-pink-400',
    title: 'text-pink-950',
    body: 'text-pink-900/80',
    meta: 'text-pink-700/70',
    badge: 'bg-pink-200/70 text-pink-800',
    iconButton: 'text-pink-700 hover:text-pink-900 hover:bg-pink-200/60',
  },
  rose: {
    bg: 'bg-rose-100',
    border: 'border-rose-200',
    hoverBorder: 'hover:border-rose-400',
    title: 'text-rose-950',
    body: 'text-rose-900/80',
    meta: 'text-rose-700/70',
    badge: 'bg-rose-200/70 text-rose-800',
    iconButton: 'text-rose-700 hover:text-rose-900 hover:bg-rose-200/60',
  },
  lavender: {
    bg: 'bg-violet-100',
    border: 'border-violet-200',
    hoverBorder: 'hover:border-violet-400',
    title: 'text-violet-950',
    body: 'text-violet-900/80',
    meta: 'text-violet-700/70',
    badge: 'bg-violet-200/70 text-violet-800',
    iconButton: 'text-violet-700 hover:text-violet-900 hover:bg-violet-200/60',
  },
  sky: {
    bg: 'bg-sky-100',
    border: 'border-sky-200',
    hoverBorder: 'hover:border-sky-400',
    title: 'text-sky-950',
    body: 'text-sky-900/80',
    meta: 'text-sky-700/70',
    badge: 'bg-sky-200/70 text-sky-800',
    iconButton: 'text-sky-700 hover:text-sky-900 hover:bg-sky-200/60',
  },
  mint: {
    bg: 'bg-emerald-100',
    border: 'border-emerald-200',
    hoverBorder: 'hover:border-emerald-400',
    title: 'text-emerald-950',
    body: 'text-emerald-900/80',
    meta: 'text-emerald-700/70',
    badge: 'bg-emerald-200/70 text-emerald-800',
    iconButton: 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-200/60',
  },
  lime: {
    bg: 'bg-lime-100',
    border: 'border-lime-200',
    hoverBorder: 'hover:border-lime-400',
    title: 'text-lime-950',
    body: 'text-lime-900/80',
    meta: 'text-lime-700/70',
    badge: 'bg-lime-200/70 text-lime-800',
    iconButton: 'text-lime-700 hover:text-lime-900 hover:bg-lime-200/60',
  },
  slate: {
    bg: 'bg-white',
    border: 'border-gray-200',
    hoverBorder: 'hover:border-blue-300',
    title: 'text-gray-900',
    body: 'text-gray-700',
    meta: 'text-gray-400',
    badge: 'bg-blue-50 text-blue-600',
    iconButton: 'text-gray-500 hover:text-blue-600 hover:bg-gray-100',
  },
};

const PALETTE_KEYS = JOURNAL_COLOR_OPTIONS.map((o) => o.key).filter((k) => k !== 'slate');

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h) + id.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function resolveJournalColor(
  color: string | null | undefined,
  fallbackId: string
): JournalColorKey {
  if (color && (STYLES as Record<string, unknown>)[color]) {
    return color as JournalColorKey;
  }
  // Auto-assign a stable random color from id
  const idx = hashId(fallbackId) % PALETTE_KEYS.length;
  return PALETTE_KEYS[idx];
}

export function getJournalColorStyles(key: JournalColorKey): JournalColorStyles {
  return STYLES[key] || STYLES.slate;
}
