// The Fish Board builder's design model: what can be chosen, the price, and a strict clean-up used by both the browser and
// the server (the server never trusts a price or option the browser sends — it rebuilds both from this file).

export const SIZES = {
  standard: { label: 'Standard', price: 125, blurb: 'Serves about 12–15' },
  large: { label: 'Large', price: 250, blurb: 'About double — serves 25–30' },
} as const;
export type Size = keyof typeof SIZES;

/** More fish = wider fish rows next to the same toppings, and a higher price (per size). */
export const AMOUNTS = {
  classic: { label: 'Classic', blurb: 'The normal fish-to-onion ratio', add: { standard: 0, large: 0 }, fish: 1 },
  extra: { label: 'Extra fish', blurb: 'About a third more fish', add: { standard: 35, large: 70 }, fish: 1.35 },
  loaded: { label: 'Loaded', blurb: 'About two-thirds more fish', add: { standard: 70, large: 140 }, fish: 1.7 },
} as const;
export type Amount = keyof typeof AMOUNTS;

// Fish and toppings are drawn from strips cut out of photos of Yaakov's own boards (public/fishboard/*.jpg, made seamless so
// they repeat along a row). `w` is each strip's width at its 160px (fish) / 110px (toppings) height; `photo` is the picture
// shown in the picker (fish: a close-up of the slices; toppings: the whole raw ingredient, before it's diced).
// `extra` is what a board made entirely of that fish adds to the price; a mix adds its share (2 of 4 rows tuna = half).
export const FISH = {
  plain: { label: 'Plain Cured', tex: 'fish-nova', w: 1300, photo: 'w-plain', extra: { standard: 0, large: 0 } },
  pepper: { label: 'Pepper Crusted', tex: 'fish-peppered', w: 827, photo: 'w-pepper', extra: { standard: 0, large: 0 } },
  beet: { label: 'Beet Cured', tex: 'fish-beet', w: 1300, photo: 'w-beet', extra: { standard: 0, large: 0 } },
  pastrami: { label: 'Pastrami', tex: 'fish-pastrami', w: 1204, photo: 'w-pastrami', extra: { standard: 20, large: 40 } },
  tuna: { label: 'Tuna', tex: 'fish-tuna', w: 587, photo: 'w-tuna', extra: { standard: 60, large: 120 } },
} as const;
export type Fish = keyof typeof FISH;

export const TOPPINGS = {
  onion: { label: 'White onion', tex: 'top-onion', w: 764, photo: 'w-onion' },
  redonion: { label: 'Red onion', tex: 'top-redonion', w: 775, photo: 'w-redonion' },
  yellow: { label: 'Yellow pepper', tex: 'top-yellow', w: 1136, photo: 'w-yellow' },
  red: { label: 'Red pepper', tex: 'top-red', w: 1136, photo: 'w-red' },
  jalapeno: { label: 'Jalapeño', tex: 'top-jalapeno', w: 716, photo: 'w-jalapeno' },
  mango: { label: 'Mango', tex: 'top-mango', w: 1136, photo: 'w-mango' },
  pomegranate: { label: 'Pomegranate', tex: 'top-pomegranate', w: 265, photo: 'w-pomegranate' },
  herbs: { label: 'Fresh herbs', tex: 'top-herbs', w: 277, photo: 'w-herbs' },
} as const;
export type Topping = keyof typeof TOPPINGS;

export const LAYOUTS = { rows: 'Rows', strips: 'Strips', diagonal: 'Diagonal' } as const;
export type Layout = keyof typeof LAYOUTS;

export const PLACEMENTS = { bands: 'Bands between the fish', lines: 'A line on top of each row' } as const;
export type Placement = keyof typeof PLACEMENTS;

export const BOARDS = {
  pine: { label: 'Pine', a: '#ead2a6', b: '#dcbb86', grain: '#b88c55' },
  walnut: { label: 'Walnut', a: '#7a4a2a', b: '#5b341c', grain: '#3f2312' },
  maple: { label: 'Maple', a: '#d9b07a', b: '#c0925a', grain: '#9c6e3d' },
  slate: { label: 'Slate', a: '#3a3d42', b: '#24262a', grain: '#4b4f55' },
  marble: { label: 'Marble', a: '#f2f0ec', b: '#dcd8d1', grain: '#b9b3a8' },
} as const;
export type BoardKind = keyof typeof BOARDS;

/** Things a customer can drop anywhere on the board, just for fun. */
/** Real photo cut-outs (public/fishboard/g-*.png) a customer can drop anywhere on the board. */
export const GARNISHES = {
  jalapeno: 'Jalapeño ring',
  heart: 'Pomegranate heart',
} as const;
export type Garnish = keyof typeof GARNISHES;

export const MESSAGE_STYLES = { pomegranate: 'Pomegranate seeds', herbs: 'Fresh herbs', onion: 'White onion' } as const;
export type MessageStyle = keyof typeof MESSAGE_STYLES;

export interface Placed { g: Garnish; x: number; y: number; r: number; s: number }

export interface Design {
  size: Size;
  amount: Amount;
  board: BoardKind;
  layout: Layout;
  placement: Placement;
  /** Fish rows repeat this lineup in order (1–4 picks). */
  fish: Fish[];
  /** Topping bands repeat this lineup in order (1–4 picks). */
  toppings: Topping[];
  border: Topping | 'none';
  saltPepper: boolean;
  message: string;
  messageStyle: MessageStyle;
  garnishes: Placed[];
}

export const DEFAULT_DESIGN: Design = {
  size: 'standard', amount: 'classic', board: 'pine', layout: 'rows', placement: 'bands',
  fish: ['plain'], toppings: ['onion'], border: 'none', saltPepper: true, message: '', messageStyle: 'pomegranate', garnishes: [],
};

/** Quick starting points. */
export const PRESETS: { name: string; emoji: string; design: Partial<Design> }[] = [
  { name: 'The Classic', emoji: '🧅', design: { fish: ['plain'], toppings: ['onion'], layout: 'rows', placement: 'bands', border: 'none', board: 'pine' } },
  { name: 'Rainbow', emoji: '🌈', design: { fish: ['pepper', 'plain'], toppings: ['jalapeno', 'redonion', 'onion', 'yellow'], layout: 'strips', placement: 'bands', border: 'none', board: 'pine' } },
  { name: 'Peppered', emoji: '🌶️', design: { fish: ['pepper', 'plain'], toppings: ['onion', 'jalapeno'], layout: 'rows', placement: 'bands', border: 'none', board: 'pine' } },
  { name: 'Tuna & Lox', emoji: '🐟', design: { fish: ['tuna', 'pastrami', 'plain'], toppings: ['onion', 'jalapeno'], layout: 'strips', placement: 'bands', border: 'none', board: 'walnut' } },
  { name: 'Beet & Mango', emoji: '🥭', design: { fish: ['beet', 'plain'], toppings: ['mango', 'onion', 'pomegranate'], layout: 'rows', placement: 'bands', border: 'none', board: 'marble' } },
];

/** What the chosen fish add: each fish's full-board extra, weighted by its share of the rows. */
export const fishExtra = (d: Pick<Design, 'size' | 'fish'>) => Math.round(d.fish.reduce((sum, f) => sum + FISH[f].extra[d.size], 0) / d.fish.length);

export function price(d: Pick<Design, 'size' | 'amount' | 'fish'>) {
  return SIZES[d.size].price + AMOUNTS[d.amount].add[d.size] + fishExtra(d);
}

const pick = <T extends string>(v: unknown, opts: Record<T, unknown>, fallback: T): T => (typeof v === 'string' && Object.hasOwn(opts, v) ? (v as T) : fallback);
const list = <T extends string>(v: unknown, opts: Record<T, unknown>, fallback: T[]): T[] => {
  const out = (Array.isArray(v) ? v : []).filter((x): x is T => typeof x === 'string' && Object.hasOwn(opts, x)).slice(0, 4);
  return out.length ? out : fallback;
};
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

/** Anything in → a valid design out (unknown values fall back to the defaults). */
export function cleanDesign(raw: unknown): Design {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const D = DEFAULT_DESIGN;
  return {
    size: pick(r.size, SIZES, D.size),
    amount: pick(r.amount, AMOUNTS, D.amount),
    board: pick(r.board, BOARDS, D.board),
    layout: pick(r.layout, LAYOUTS, D.layout),
    placement: pick(r.placement, PLACEMENTS, D.placement),
    fish: list(r.fish, FISH, D.fish),
    toppings: list(r.toppings, TOPPINGS, D.toppings),
    border: r.border === 'none' ? 'none' : pick(r.border, TOPPINGS, 'none' as Topping),
    saltPepper: typeof r.saltPepper === 'boolean' ? r.saltPepper : D.saltPepper,
    message: typeof r.message === 'string' ? r.message.replace(/[^\p{L}\p{N} &!♥'.-]/gu, '').slice(0, 14) : '',
    messageStyle: pick(r.messageStyle, MESSAGE_STYLES, D.messageStyle),
    garnishes: (Array.isArray(r.garnishes) ? r.garnishes : []).slice(0, 24).flatMap((g) => {
      const o = (g && typeof g === 'object' ? g : {}) as Record<string, unknown>;
      if (typeof o.g !== 'string' || !Object.hasOwn(GARNISHES, o.g)) return [];
      return [{ g: o.g as Garnish, x: num(o.x, 0, 1, 0.5), y: num(o.y, 0, 1, 0.5), r: num(o.r, -180, 180, 0), s: num(o.s, 0.6, 1.6, 1) }];
    }),
  };
}

/** A plain-English summary (for the email and the order sheet). */
export function describe(d: Design): [string, string][] {
  return [
    ['Size', `${SIZES[d.size].label} — $${SIZES[d.size].price}`],
    ['Fish amount', `${AMOUNTS[d.amount].label}${AMOUNTS[d.amount].add[d.size] ? ` (+$${AMOUNTS[d.amount].add[d.size]})` : ''}`],
    ['Fish', d.fish.map((f) => FISH[f].label).join(' → ') + (fishExtra(d) ? ` (+$${fishExtra(d)})` : '')],
    ['Toppings', d.toppings.map((t) => TOPPINGS[t].label).join(' → ')],
    ['Layout', `${LAYOUTS[d.layout]}, ${PLACEMENTS[d.placement].toLowerCase()}`],
    ['Border', d.border === 'none' ? 'None' : TOPPINGS[d.border].label],
    ['Salt & cracked pepper', d.saltPepper ? 'Yes' : 'No'],
    ['Board', BOARDS[d.board].label],
    ...(d.message ? [['Message on the board', `“${d.message}” in ${MESSAGE_STYLES[d.messageStyle].toLowerCase()}`] as [string, string]] : []),
    ...(d.garnishes.length ? [['Fun garnishes', summarizeGarnishes(d.garnishes)] as [string, string]] : []),
    ['Estimated price', `$${price(d)}`],
  ];
}

function summarizeGarnishes(gs: Placed[]) {
  const n = new Map<Garnish, number>();
  for (const g of gs) n.set(g.g, (n.get(g.g) ?? 0) + 1);
  return [...n].map(([g, c]) => `${c}× ${GARNISHES[g].toLowerCase()}`).join(', ');
}
