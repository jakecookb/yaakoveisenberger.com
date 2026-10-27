// Turns whatever a feed sends (HTML, entities, "read more" trailers) into safe plain text. Nothing from a feed is ever
// rendered as HTML: only text and a few validated URLs reach the page.

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…', eacute: 'é', ouml: 'ö', uuml: 'ü', times: '×', deg: '°', trade: '™', reg: '®',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

// A tag, however its quoted attributes look (a '>' inside quotes does not end it).
export const TAG = /<[a-zA-Z/!][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/g;

export function stripHtml(html: string): string {
  const noBlocks = html.replace(/<(script|style|iframe|noscript)[\s\S]*?<\/\1>/gi, ' ');
  const text = decodeEntities(noBlocks.replace(TAG, ' '));
  // Decoding can reveal new angle brackets (&lt;script&gt;): that is fine, it is only ever shown as text.
  return text
    .replace(/The post .{0,160}? appeared first on .{0,80}?\.?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function excerpt(text: string, max = 190): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = cut.lastIndexOf(' ');
  return `${cut.slice(0, at > 90 ? at : max).replace(/[\s,;:–—-]+$/, '')}…`;
}

/** Only ordinary web addresses make it through. */
export function safeUrl(u: unknown): string | undefined {
  if (typeof u !== 'string') return undefined;
  try {
    const url = new URL(decodeEntities(u.trim()));
    if (url.protocol === 'http:') url.protocol = 'https:';
    return url.protocol === 'https:' && url.hostname.includes('.') && !url.username && !url.password ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
