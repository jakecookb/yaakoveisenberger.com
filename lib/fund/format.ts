export function formatMoney(cents: number, currency = 'usd', opts: { cents?: boolean } = {}) {
  const value = (cents ?? 0) / 100;
  const showCents = opts.cents ?? !Number.isInteger(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(value);
}

/**
 * $1.2K / $4.5M — for stat tiles and dense lists. Hand-rolled instead of Intl's
 * compact notation, which differs between Node and browser ICU builds (hydration).
 */
export function formatMoneyCompact(cents: number, currency = 'usd') {
  const value = (cents ?? 0) / 100;
  const abs = Math.abs(value);
  if (abs < 10_000) return formatMoney(cents, currency, { cents: false });
  const [div, suffix] = abs >= 1e9 ? [1e9, 'B'] : abs >= 1e6 ? [1e6, 'M'] : [1e3, 'K'];
  const n = Math.round((value / div) * 10) / 10;
  const symbol = formatMoney(0, currency, { cents: false }).replace(/[\d.,\s]/g, '');
  return `${n < 0 ? '-' : ''}${symbol}${Math.abs(n).toString()}${suffix}`;
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat('en-US').format(n ?? 0);
}

export function formatPercent(ratio: number | null | undefined, digits = 1) {
  if (ratio == null || Number.isNaN(ratio)) return '—';
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** ratio 1 -> "$1 = $2", ratio 3 -> "$1 = $4". */
export function ratioLabel(ratio: number | null | undefined) {
  if (!ratio) return 'No active match';
  const total = 1 + Number(ratio);
  return `$1 = $${Number.isInteger(total) ? total : total.toFixed(2)}`;
}

export function multiplierLabel(ratio: number | null | undefined) {
  if (!ratio) return '1x';
  const total = 1 + Number(ratio);
  return `${Number.isInteger(total) ? total : total.toFixed(1)}x`;
}

export function dollarsToCents(input: string | number | null | undefined) {
  if (input == null || input === '') return 0;
  const n = typeof input === 'number' ? input : Number(String(input).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function centsToDollarsInput(cents: number | null | undefined) {
  if (cents == null) return '';
  const v = cents / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/** For <input type="datetime-local"> values in the viewer's timezone. */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((p) => /[A-Za-z0-9]/.test(p[0] ?? ''))
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('') || '♥';
}
