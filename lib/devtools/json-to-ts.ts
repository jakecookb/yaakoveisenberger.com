// JSON → TypeScript. Objects become named interfaces (named after their key); arrays of objects are merged so a key
// missing from some items becomes optional; mixed values become unions.

export interface TsOptions { rootName: string; useType: boolean; exportAll: boolean; readonly: boolean; optionalNulls: boolean }

type Shape =
  | { kind: 'prim'; name: 'string' | 'number' | 'boolean' | 'null' | 'unknown' }
  | { kind: 'obj'; fields: Map<string, { shape: Shape; optional: boolean }> }
  | { kind: 'arr'; of: Shape }
  | { kind: 'union'; of: Shape[] };

const prim = (name: 'string' | 'number' | 'boolean' | 'null' | 'unknown'): Shape => ({ kind: 'prim', name });

function shapeOf(v: unknown): Shape {
  if (v === null) return prim('null');
  if (Array.isArray(v)) return { kind: 'arr', of: v.length ? v.map(shapeOf).reduce(merge) : prim('unknown') };
  if (typeof v === 'object') {
    const fields = new Map<string, { shape: Shape; optional: boolean }>();
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) fields.set(k, { shape: shapeOf(x), optional: false });
    return { kind: 'obj', fields };
  }
  if (typeof v === 'string') return prim('string');
  if (typeof v === 'number') return prim('number');
  if (typeof v === 'boolean') return prim('boolean');
  return prim('unknown');
}

const key = (s: Shape): string => (s.kind === 'prim' ? s.name : s.kind);

function merge(a: Shape, b: Shape): Shape {
  if (a.kind === 'prim' && b.kind === 'prim' && a.name === b.name) return a;
  if (a.kind === 'prim' && a.name === 'unknown') return b;
  if (b.kind === 'prim' && b.name === 'unknown') return a;
  if (a.kind === 'obj' && b.kind === 'obj') {
    const fields = new Map<string, { shape: Shape; optional: boolean }>();
    for (const k of new Set([...a.fields.keys(), ...b.fields.keys()])) {
      const x = a.fields.get(k);
      const y = b.fields.get(k);
      if (x && y) fields.set(k, { shape: merge(x.shape, y.shape), optional: x.optional || y.optional });
      else fields.set(k, { shape: (x ?? y)!.shape, optional: true });
    }
    return { kind: 'obj', fields };
  }
  if (a.kind === 'arr' && b.kind === 'arr') return { kind: 'arr', of: merge(a.of, b.of) };
  const parts = [...(a.kind === 'union' ? a.of : [a]), ...(b.kind === 'union' ? b.of : [b])];
  const out: Shape[] = [];
  for (const p of parts) {
    const same = out.findIndex((q) => key(q) === key(p));
    if (same < 0) out.push(p);
    else if (p.kind !== 'prim') out[same] = merge(out[same], p);
  }
  return out.length === 1 ? out[0] : { kind: 'union', of: out };
}

const pascal = (s: string) => {
  const p = s.replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : '')).replace(/^[a-z]/, (c) => c.toUpperCase()).replace(/^(\d)/, '_$1');
  return p || 'Item';
};
const singular = (s: string) => (/ies$/i.test(s) ? s.replace(/ies$/i, 'y') : /(ss|us)$/i.test(s) ? s : s.replace(/s$/i, ''));
const propName = (k: string) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k));

export function jsonToTs(json: string, o: TsOptions): string {
  const root = shapeOf(JSON.parse(json));
  const blocks: string[] = [];
  const used = new Set<string>();
  const unique = (n: string) => { let name = n; let i = 2; while (used.has(name)) name = `${n}${i++}`; used.add(name); return name; };
  const kw = o.exportAll ? 'export ' : '';

  const typeOf = (s: Shape, hint: string): string => {
    switch (s.kind) {
      case 'prim': return s.name;
      case 'arr': {
        const inner = typeOf(s.of, singular(hint));
        return /[|&]/.test(inner) ? `(${inner})[]` : `${inner}[]`;
      }
      case 'union': return s.of.map((x) => typeOf(x, hint)).join(' | ');
      case 'obj': {
        const name = unique(pascal(hint));
        const lines = [...s.fields.entries()].map(([k, f]) => {
          const t = typeOf(f.shape, k);
          const nullable = o.optionalNulls && f.shape.kind === 'prim' && f.shape.name === 'null';
          return `  ${o.readonly ? 'readonly ' : ''}${propName(k)}${f.optional || nullable ? '?' : ''}: ${nullable ? 'null' : t};`;
        });
        const body = lines.length ? `{\n${lines.join('\n')}\n}` : 'Record<string, unknown>';
        blocks.push(o.useType || !lines.length ? `${kw}type ${name} = ${body};` : `${kw}interface ${name} ${body}`);
        return name;
      }
    }
  };
  const top = typeOf(root, o.rootName || 'Root');
  if (root.kind !== 'obj') blocks.push(`${kw}type ${unique(pascal(o.rootName || 'Root'))} = ${top};`);
  return blocks.reverse().join('\n\n');
}
