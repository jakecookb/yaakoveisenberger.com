import type { AccessRequest } from './visitor';

/** One word for where someone stands overall. */
export function overallStatus(r: AccessRequest) {
  if (r.all) return 'Approved (everything)';
  if (r.granted.length && r.requested.length) return 'Approved (more pending)';
  if (r.granted.length) return 'Approved';
  if (r.requested.length) return 'Pending';
  if (r.denied.length) return 'Declined';
  return 'No access';
}

// Spreadsheet apps run cells that start with = + - @ (or tab/CR) as formulas; prefix those with ' so they stay text.
const cell = (v: string) => {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(rows: AccessRequest[], title: (id: string) => string) {
  const head = ['Name', 'Email', 'Phone', 'Email confirmed', 'Requested on', 'Last updated', 'Status', 'Approved for', 'Approved via code', 'Waiting for', 'Declined for'];
  const date = (iso?: string) => (iso ? new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '');
  const lines = rows.map((r) => [
    r.name,
    r.email ?? '',
    r.phone ?? '',
    r.emailVerifiedAt ? `Yes (${date(r.emailVerifiedAt)})` : 'No',
    date(r.createdAt),
    date(r.updatedAt),
    overallStatus(r),
    r.all ? 'Everything' : r.granted.map(title).join('; '),
    (r.codeGranted ?? []).map(title).join('; '),
    r.requested.map(title).join('; '),
    r.denied.map(title).join('; '),
  ]);
  // BOM so Excel opens names with accents/Hebrew correctly.
  return '﻿' + [head, ...lines].map((l) => l.map(cell).join(',')).join('\r\n') + '\r\n';
}
