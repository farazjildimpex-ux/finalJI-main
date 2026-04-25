export type JournalColorKey =
  | 'butter'
  | 'apricot'
  | 'rose'
  | 'blossom'
  | 'lilac'
  | 'sky'
  | 'sage'
  | 'mint'
  | 'pearl';

export interface JournalColorOption {
  key: JournalColorKey;
  name: string;
  swatch: string;
}

// Refined modern palette: soft tinted cards with crisp accent colors.
// Each color uses a near-white base with a thin coloured wash, a strong
// accent strip, and rich text tones for clear hierarchy.
export const JOURNAL_COLOR_OPTIONS: JournalColorOption[] = [
  { key: 'butter', name: 'Butter', swatch: '#fef9c3' },
  { key: 'apricot', name: 'Apricot', swatch: '#fed7aa' },
  { key: 'rose', name: 'Rose', swatch: '#fecdd3' },
  { key: 'blossom', name: 'Blossom', swatch: '#fbcfe8' },
  { key: 'lilac', name: 'Lilac', swatch: '#e9d5ff' },
  { key: 'sky', name: 'Sky', swatch: '#bae6fd' },
  { key: 'sage', name: 'Sage', swatch: '#bbf7d0' },
  { key: 'mint', name: 'Mint', swatch: '#a7f3d0' },
  { key: 'pearl', name: 'Pearl', swatch: '#f1f5f9' },
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
  butter: {
    gradient: 'bg-gradient-to-br from-white via-amber-50/70 to-amber-100/60',
    border: 'border-amber-200/70',
    hoverBorder: 'group-hover:border-amber-400/80',
    accent: 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500',
    shadow: 'shadow-[0_1px_3px_rgba(180,120,20,0.06),0_4px_14px_-6px_rgba(180,120,20,0.10)]',
    hoverShadow: 'group-hover:shadow-[0_8px_24px_-8px_rgba(180,120,20,0.30)]',
    title: 'text-amber-900',
    body: 'text-amber-950/75',
    meta: 'text-amber-700/80',
    badge: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
    iconButton: 'text-amber-700 hover:text-amber-900 hover:bg-amber-100/80',
    actionBar: 'bg-white/85 ring-1 ring-amber-200/70',
  },
  apricot: {
    gradient: 'bg-gradient-to-br from-white via-orange-50/70 to-orange-100/60',
    border: 'border-orange-200/70',
    hoverBorder: 'group-hover:border-orange-400/80',
    accent: 'bg-gradient-to-r from-orange-400 via-orange-500 to-rose-400',
    shadow: 'shadow-[0_1px_3px_rgba(194,80,20,0.06),0_4px_14px_-6px_rgba(194,80,20,0.10)]',
    hoverShadow: 'group-hover:shadow-[0_8px_24px_-8px_rgba(194,80,20,0.32)]',
    title: 'text-orange-900',
    body: 'text-orange-950/75',
    meta: 'text-orange-700/80',
    badge: 'bg-orange-100 text-orange-800 ring-1 ring-orange-200',
    iconButton: 'text-orange-700 hover:text-orange-900 hover:bg-orange-100/80',
    actionBar: 'bg-white/85 ring-1 ring-orange-200/70',
  },
  rose: {
    gradient: 'bg-gradient-to-br from-white via-rose-50/70 to-rose-100/60',
    border: 'border-rose-200/70',
    hoverBorder: 'group-hover:border-rose-400/80',
    accent: 'bg-gradient-to-r from-rose-400 via-rose-500 to-pink-500',
    shadow: 'shadow-[0_1px_3px_rgba(190,30,60,0.06),0_4px_14px_-6px_rgba(190,30,60,0.10)]',
    hoverShadow: 'group-hover:shadow-[0_8px_24px_-8px_rgba(190,30,60,0.32)]',
    title: 'text-rose-900',
    body: 'text-rose-950/75',
    meta: 'text-rose-700/80',
    badge: 'bg-rose-100 text-rose-800 ring-1 ring-rose-200',
    iconButton: 'text-rose-700 hover:text-rose-900 hover:bg-rose-100/80',
    actionBar: 'bg-white/85 ring-1 ring-rose-200/70',
  },
  blossom: {
    gradient: 'bg-gradient-to-br from-white via-pink-50/70 to-fuchsia-100/50',
    border: 'border-pink-200/70',
    hoverBorder: 'group-hover:border-pink-400/80',
    accent: 'bg-gradient-to-r from-pink-400 via-fuchsia-400 to-purple-400',
    shadow: 'shadow-[0_1px_3px_rgba(190,30,150,0.06),0_4px_14px_-6px_rgba(190,30,150,0.10)]',
    hoverShadow: 'group-hover:shadow-[0_8px_24px_-8px_rgba(190,30,150,0.32)]',
    title: 'text-pink-900',
    body: 'text-pink-950/75',
    meta: 'text-pink-700/80',
    badge: 'bg-pink-100 text-pink-800 ring-1 ring-pink-200',
    iconButton: 'text-pink-700 hover:text-pink-900 hover:bg-pink-100/80',
    actionBar: 'bg-white/85 ring-1 ring-pink-200/70',
  },
  lilac: {
    gradient: 'bg-gradient-to-br from-white via-purple-50/70 to-violet-100/60',
    border: 'border-violet-200/70',
    hoverBorder: 'group-hover:border-violet-400/80',
    accent: 'bg-gradient-to-r from-violet-400 via-purple-500 to-indigo-500',
    shadow: 'shadow-[0_1px_3px_rgba(120,40,200,0.06),0_4px_14px_-6px_rgba(120,40,200,0.10)]',
    hoverShadow: 'group-hover:shadow-[0_8px_24px_-8px_rgba(120,40,200,0.32)]',
    title: 'text-violet-900',
    body: 'text-violet-950/75',
    meta: 'text-violet-700/80',
    badge: 'bg-violet-100 text-violet-800 ring-1 ring-violet-200',
    iconButton: 'text-violet-700 hover:text-violet-900 hover:bg-violet-100/80',
    actionBar: 'bg-white/85 ring-1 ring-violet-200/70',
  },
  sky: {
    gradient: 'bg-gradient-to-br from-white via-sky-50/70 to-blue-100/60',
    border: 'border-sky-200/70',
    hoverBorder: 'group-hover:border-sky-400/80',
    accent: 'bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500',
    shadow: 'shadow-[0_1px_3px_rgba(20,100,200,0.06),0_4px_14px_-6px_rgba(20,100,200,0.10)]',
    hoverShadow: 'group-hover:shadow-[0_8px_24px_-8px_rgba(20,100,200,0.32)]',
    title: 'text-sky-900',
    body: 'text-sky-950/75',
    meta: 'text-sky-700/80',
    badge: 'bg-sky-100 text-sky-800 ring-1 ring-sky-200',
    iconButton: 'text-sky-700 hover:text-sky-900 hover:bg-sky-100/80',
    actionBar: 'bg-white/85 ring-1 ring-sky-200/70',
  },
  sage: {
    gradient: 'bg-gradient-to-br from-white via-emerald-50/70 to-green-100/60',
    border: 'border-emerald-200/70',
    hoverBorder: 'group-hover:border-emerald-400/80',
    accent: 'bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500',
    shadow: 'shadow-[0_1px_3px_rgba(20,140,80,0.06),0_4px_14px_-6px_rgba(20,140,80,0.10)]',
    hoverShadow: 'group-hover:shadow-[0_8px_24px_-8px_rgba(20,140,80,0.32)]',
    title: 'text-emerald-900',
    body: 'text-emerald-950/75',
    meta: 'text-emerald-700/80',
    badge: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
    iconButton: 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100/80',
    actionBar: 'bg-white/85 ring-1 ring-emerald-200/70',
  },
  mint: {
    gradient: 'bg-gradient-to-br from-white via-teal-50/70 to-cyan-100/50',
    border: 'border-teal-200/70',
    hoverBorder: 'group-hover:border-teal-400/80',
    accent: 'bg-gradient-to-r from-teal-400 via-cyan-500 to-sky-500',
    shadow: 'shadow-[0_1px_3px_rgba(20,140,140,0.06),0_4px_14px_-6px_rgba(20,140,140,0.10)]',
    hoverShadow: 'group-hover:shadow-[0_8px_24px_-8px_rgba(20,140,140,0.32)]',
    title: 'text-teal-900',
    body: 'text-teal-950/75',
    meta: 'text-teal-700/80',
    badge: 'bg-teal-100 text-teal-800 ring-1 ring-teal-200',
    iconButton: 'text-teal-700 hover:text-teal-900 hover:bg-teal-100/80',
    actionBar: 'bg-white/85 ring-1 ring-teal-200/70',
  },
  pearl: {
    gradient: 'bg-gradient-to-br from-white via-slate-50 to-slate-100/60',
    border: 'border-slate-200',
    hoverBorder: 'group-hover:border-blue-300',
    accent: 'bg-gradient-to-r from-slate-400 via-slate-500 to-blue-500',
    shadow: 'shadow-[0_1px_3px_rgba(15,23,42,0.05),0_4px_14px_-6px_rgba(15,23,42,0.08)]',
    hoverShadow: 'group-hover:shadow-[0_8px_24px_-8px_rgba(37,99,235,0.25)]',
    title: 'text-slate-900',
    body: 'text-slate-700',
    meta: 'text-slate-500',
    badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    iconButton: 'text-slate-600 hover:text-blue-700 hover:bg-white',
    actionBar: 'bg-white/90 ring-1 ring-slate-200',
  },
};

// Backwards compatibility for previously-stored color keys
const LEGACY_KEY_MAP: Record<string, JournalColorKey> = {
  yellow: 'butter',
  peach: 'apricot',
  pink: 'blossom',
  lavender: 'lilac',
  lime: 'sage',
  slate: 'pearl',
};

const PALETTE_KEYS = JOURNAL_COLOR_OPTIONS.map((o) => o.key).filter(
  (k) => k !== 'pearl'
);

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
  if (color) {
    if ((STYLES as Record<string, unknown>)[color]) {
      return color as JournalColorKey;
    }
    if (LEGACY_KEY_MAP[color]) {
      return LEGACY_KEY_MAP[color];
    }
  }
  // Auto-assign a stable color from id
  const idx = hashId(fallbackId) % PALETTE_KEYS.length;
  return PALETTE_KEYS[idx];
}

export function getJournalColorStyles(key: JournalColorKey): JournalColorStyles {
  return STYLES[key] || STYLES.pearl;
}
