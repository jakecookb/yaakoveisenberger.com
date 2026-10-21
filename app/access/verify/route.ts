import { NextResponse } from 'next/server';
import { redeemSignIn } from '@/lib/access/visitor';

export const dynamic = 'force-dynamic';

/** The link from the sign-in email: signs this browser in, then shows the box they asked for. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const res = await redeemSignIn(url.searchParams.get('t') ?? '');
  const dest = res.ok ? (res.next ? `/access/${res.next}?signedin=1` : '/?signedin=1') : '/?signin=expired';
  const out = NextResponse.redirect(new URL(dest, url), 303);
  out.headers.set('Cache-Control', 'private, no-store');
  out.headers.set('Referrer-Policy', 'no-referrer');
  return out;
}
