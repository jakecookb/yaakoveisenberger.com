import { NextResponse } from 'next/server';
import { accessState } from '@/lib/access/visitor';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const cat = new URL(request.url).searchParams.get('cat') ?? '';
  const res = NextResponse.json(await accessState(cat));
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}
