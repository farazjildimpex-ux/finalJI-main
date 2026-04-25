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
  gradient: string;
  border: string;
  hoverBorder: string;
  accent: string;
  shadow: string;
  hoverShadow: string;
  title: string;
  body: string;
  meta: string;
  badge: string;
  iconButton: string;
  actionBar: string;
}

const STYLES: Record<JournalColorKey, JournalColorStyles> = {
  yellow: {
    gradient: 'bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200/80',
    border: 'border-amber-200/60',
    hoverBorder: 'group-hover:border-amber-300',
    accent: 'bg-gradient-to-r from-amber-400 to-amber-500',
    shadow: 'shadow-[0_2px_8px_-2px_rgba(217,119,6,0.15)]',
    hoverShadow: 'group-hover:shadow-[0_12px_28px_-8px_rgba(217,119,6,0.35)]',
    title: 'text-amber-950',
    body: 'text-amber-900/85',
    meta: 'text-amber-800/70',
    badge: 'bg-amber-200/80 text-amber-900 ring-1 ring-amber-300/50',
    iconButton: 'text-amber-800 hover:text-amber-950 hover:bg-amber-100',
    actionBar: 'bg-white/70 ring-1 ring-amber-200/60',
  },
  peach: {
    gradient: 'bg-gradient-to-br from-orange-50 via-orange-100 to-orange-200/80',
    border: 'border-orange-200/60',
    hoverBorder: 'group-hover:border-orange-300',
    accent: 'bg-gradient-to-r from-orange-400 to-orange-500',
    shadow: 'shadow-[0_2px_8px_-2px_rgba(234,88,12,0.15)]',
    hoverShadow: 'group-hover:shadow-[0_12px_28px_-8px_rgba(234,88,12,0.35)]',
    title: 'text-orange-950',
    body: 'text-orange-900/85',
    meta: 'text-orange-800/70',
    badge: 'bg-orange-200/80 text-orange-900 ring-1 ring-orange-300/50',
    iconButton: 'text-orange-800 hover:text-orange-950 hover:bg-orange-100',
    actionBar: 'bg-white/70 ring-1 ring-orange-200/60',
  },
  pink: {
    gradient: 'bg-gradient-to-br from-pink-50 via-pink-100 to-pink-200/80',
    border: 'border-pink-200/60',
    hoverBorder: 'group-hover:border-pink-300',
    accent: 'bg-gradient-to-r from-pink-400 to-pink-500',
    shadow: 'shadow-[0_2px_8px_-2px_rgba(219,39,119,0.15)]',
    hoverShadow: 'group-hover:shadow-[0_12px_28px_-8px_rgba(219,39,119,0.35)]',
    title: 'text-pink-950',
    body: 'text-pink-900/85',
    meta: 'text-pink-800/70',
    badge: 'bg-pink-200/80 text-pink-900 ring-1 ring-pink-300/50',
    iconButton: 'text-pink-800 hover:text-pink-950 hover:bg-pink-100',
    actionBar: 'bg-white/70 ring-1 ring-pink-200/60',
  },
  rose: {
    gradient: 'bg-gradient-to-br from-rose-50 via-rose-100 to-rose-200/80',
    border: 'border-rose-200/60',
    hoverBorder: 'group-hover:border-rose-300',
    accent: 'bg-gradient-to-r from-rose-400 to-rose-500',
    shadow: 'shadow-[0_2px_8px_-2px_rgba(225,29,72,0.15)]',
    hoverShadow: 'group-hover:shadow-[0_12px_28px_-8px_rgba(225,29,72,0.35)]',
    title: 'text-rose-950',
    body: 'text-rose-900/85',
    meta: 'text-rose-800/70',
    badge: 'bg-rose-200/80 text-rose-900 ring-1 ring-rose-300/50',
    iconButton: 'text-rose-800 hover:text-rose-950 hover:bg-rose-100',
    actionBar: 'bg-white/70 ring-1 ring-rose-200/60',
  },
  lavender: {
    gradient: 'bg-gradient-to-br from-violet-50 via-violet-100 to-violet-200/80',
    border: 'border-violet-200/60',
    hoverBorder: 'group-hover:border-violet-300',
    accent: 'bg-gradient-to-r from-violet-400 to-violet-500',
    shadow: 'shadow-[0_2px_8px_-2px_rgba(124,58,237,0.15)]',
    hoverShadow: 'group-hover:shadow-[0_12px_28px_-8px_rgba(124,58,237,0.35)]',
    title: 'text-violet-950',
    body: 'text-violet-900/85',
    meta: 'text-violet-800/70',
    badge: 'bg-violet-200/80 text-violet-900 ring-1 ring-violet-300/50',
    iconButton: 'text-violet-800 hover:text-violet-950 hover:bg-violet-100',
    actionBar: 'bg-white/70 ring-1 ring-violet-200/60',
  },
  sky: {
    gradient: 'bg-gradient-to-br from-sky-50 via-sky-100 to-sky-200/80',
    border: 'border-sky-200/60',
    hoverBorder: 'group-hover:border-sky-300',
    accent: 'bg-gradient-to-r from-sky-400 to-sky-500',
    shadow: 'shadow-[0_2px_8px_-2px_rgba(2,132,199,0.15)]',
    hoverShadow: 'group-hover:shadow-[0_12px_28px_-8px_rgba(2,132,199,0.35)]',
    title: 'text-sky-950',
    body: 'text-sky-900/85',
    meta: 'text-sky-800/70',
    badge: 'bg-sky-200/80 text-sky-900 ring-1 ring-sky-300/50',
    iconButton: 'text-sky-800 hover:text-sky-950 hover:bg-sky-100',
    actionBar: 'bg-white/70 ring-1 ring-sky-200/60',
  },
  mint: {
    gradient: 'bg-gradient-to-br from-emerald-50 via-emerald-100 to-emerald-200/80',
    border: 'border-emerald-200/60',
    hoverBorder: 'group-hover:border-emerald-300',
    accent: 'bg-gradient-to-r from-emerald-400 to-emerald-500',
    shadow: 'shadow-[0_2px_8px_-2px_rgba(5,150,105,0.15)]',
    hoverShadow: 'group-hover:shadow-[0_12px_28px_-8px_rgba(5,150,105,0.35)]',
    title: 'text-emerald-950',
    body: 'text-emerald-900/85',
    meta: 'text-emerald-800/70',
    badge: 'bg-emerald-200/80 text-emerald-900 ring-1 ring-emerald-300/50',
    iconButton: 'text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100',
    actionBar: 'bg-white/70 ring-1 ring-emerald-200/60',
  },
  lime: {
    gradient: 'bg-gradient-to-br from-lime-50 via-lime-100 to-lime-200/80',
    border: 'border-lime-200/60',
    hoverBorder: 'group-hover:border-lime-300',
    accent: 'bg-gradient-to-r from-lime-400 to-lime-500',
    shadow: 'shadow-[0_2px_8px_-2px_rgba(101,163,13,0.15)]',
    hoverShadow: 'group-hover:shadow-[0_12px_28px_-8px_rgba(101,163,13,0.35)]',
    title: 'text-lime-950',
    body: 'text-lime-900/85',
    meta: 'text-lime-800/70',
    badge: 'bg-lime-200/80 text-lime-900 ring-1 ring-lime-300/50',
    iconButton: 'text-lime-800 hover:text-lime-950 hover:bg-lime-100',
    actionBar: 'bg-white/70 ring-1 ring-lime-200/60',
  },
  slate: {
    gradient: 'bg-gradient-to-br from-white via-slate-50 to-slate-100',
    border: 'border-slate-200/80',
    hoverBorder: 'group-hover:border-blue-300',
    accent: 'bg-gradient-to-r from-slate-400 to-blue-500',
    shadow: 'shadow-[0_2px_8px_-2px_rgba(15,23,42,0.10)]',
    hoverShadow: 'group-hover:shadow-[0_12px_28px_-8px_rgba(37,99,235,0.25)]',
    title: 'text-slate-900',
    body: 'text-slate-700',
    meta: 'text-slate-500',
    badge: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
    iconButton: 'text-slate-600 hover:text-blue-700 hover:bg-white',
    actionBar: 'bg-white/80 ring-1 ring-slate-200/60',
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
