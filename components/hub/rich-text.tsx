import type { ReactNode } from 'react';

// Simple, safe formatting for the text you write inside a tile. It builds React elements (never raw HTML), and only
// web (http/https) and email links are allowed.
//   blank line = new paragraph · ## Heading (own line) · ### Smaller heading · - bullet · **bold** · *italic* · [link text](https://…)

const INLINE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\((?:https?:\/\/|mailto:)[^)\s]+\))/g;

function inline(text: string, key: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const k = `${key}-${i}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={k} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={k}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)\s]+)\)$/);
    if (link) {
      const web = link[2].startsWith('http');
      return <a key={k} href={link[2]} {...(web ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="text-[#c8a96a] underline underline-offset-4 hover:text-[#d8bc82]">{link[1]}</a>;
    }
    return part;
  });
}

function lines(text: string, key: string): ReactNode[] {
  return text.split('\n').flatMap((l, i, a) => (i < a.length - 1 ? [...inline(l, `${key}-${i}`), <br key={`${key}-br${i}`} />] : inline(l, `${key}-${i}`)));
}

type Block = { type: 'p'; rows: string[] } | { type: 'ul'; rows: string[] } | { type: 'h'; level: 2 | 3; text: string };

/** Reads the text line by line, so a heading or bullet list works with or without a blank line around it. */
function parse(text: string): Block[] {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (!line.trim()) { cur = null; continue; }
    const h = line.match(/^\s*(#{1,3})\s+(.+?)\s*$/);
    if (h) { blocks.push({ type: 'h', level: h[1].length === 3 ? 3 : 2, text: h[2] }); cur = null; continue; }
    const li = line.match(/^\s*(?:[-•]|\*(?!\*))\s+(.+)$/);
    if (li) {
      if (cur?.type !== 'ul') { cur = { type: 'ul', rows: [] }; blocks.push(cur); }
      cur.rows.push(li[1]);
      continue;
    }
    if (cur?.type !== 'p') { cur = { type: 'p', rows: [] }; blocks.push(cur); }
    cur.rows.push(line);
  }
  return blocks;
}

export function RichText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`space-y-4 text-left leading-relaxed text-neutral-300 ${className}`}>
      {parse(text.trim()).map((b, i) => {
        const k = `b${i}`;
        if (b.type === 'h') {
          return b.level === 3
            ? <h3 key={k} className="pt-2 text-lg font-semibold text-white">{inline(b.text, k)}</h3>
            : <h2 key={k} className="pt-2 text-2xl font-semibold tracking-tight text-white">{inline(b.text, k)}</h2>;
        }
        if (b.type === 'ul') return <ul key={k} className="list-disc space-y-1 pl-6">{b.rows.map((r, j) => <li key={j}>{inline(r, `${k}-${j}`)}</li>)}</ul>;
        return <p key={k}>{lines(b.rows.join('\n'), k)}</p>;
      })}
    </div>
  );
}
