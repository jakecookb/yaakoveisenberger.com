import { NextResponse } from 'next/server';
import { isAdmin, sameOrigin } from '@/lib/admin/session';
import { isBlobConfigured, putFile } from '@/lib/admin/store';
import { HERO_PATH, PHOTO_PATH } from '@/lib/site/settings';

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX = 15 * 1024 * 1024;

// The admin's browser sends each (already resized) photo here; it is stored privately and only ever served through /media.
export async function PUT(request: Request) {
  if (!(await sameOrigin()) || !(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isBlobConfigured) return NextResponse.json({ error: 'Storage is not connected.' }, { status: 503 });
  const pathname = new URL(request.url).searchParams.get('path') ?? '';
  // Which box a photo belongs to is validated when settings are saved (a new box may not exist yet).
  if (!PHOTO_PATH.test(pathname) && !HERO_PATH.test(pathname)) return NextResponse.json({ error: 'Invalid upload path' }, { status: 400 });
  const type = request.headers.get('content-type') ?? '';
  if (!TYPES.includes(type)) return NextResponse.json({ error: 'Use JPEG, PNG, WebP or GIF.' }, { status: 415 });
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX) return NextResponse.json({ error: 'That image is over 15 MB.' }, { status: 413 });
  try {
    await putFile(pathname, body, type);
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
  return NextResponse.json({ pathname });
}
