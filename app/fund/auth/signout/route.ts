import { NextResponse } from 'next/server';
import { createFundServerClient } from '@/lib/fund/supabase/server';
import { sameOrigin } from '@/lib/fund/security';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  const supabase = await createFundServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/fund/login', request.url), { status: 303 });
}
