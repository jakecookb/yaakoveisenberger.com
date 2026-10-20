type Cell = string | number | boolean | null | undefined;

function escapeCell(value: Cell) {
  if (value == null) return '';
  let s = String(value);
  // Neutralize spreadsheet formula injection (=, +, -, @ at the start of a cell).
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: Cell[][]) {
  return [headers, ...rows].map((r) => r.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}

export function csvResponse(filename: string, csv: string) {
  return new Response('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

export const cents = (v: number | null | undefined) => (v == null ? '' : (v / 100).toFixed(2));
