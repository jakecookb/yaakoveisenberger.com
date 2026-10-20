import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

/** Lets the (static, cached) site header show "Admin" instead of "Log in" for the signed-in owner. */
export async function GET() {
  const res = NextResponse.json({ admin: await isAdmin() });
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}
