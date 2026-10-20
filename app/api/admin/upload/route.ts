import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { isAdmin, sameOrigin } from '@/lib/admin/session';
import { isBlobConfigured } from '@/lib/admin/store';
import { HERO_PATH, PHOTO_PATH } from '@/lib/site/settings';

// Issues one-time upload tokens so the admin's browser can send photos straight to Blob
// (bypassing the 4.5 MB serverless body limit). Everything uploaded is private.
export async function POST(request: Request) {
  if (!(await sameOrigin()) || !(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isBlobConfigured) return NextResponse.json({ error: 'Storage is not connected.' }, { status: 503 });
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Which box a photo belongs to is validated when settings are saved (a new box may not exist yet).
        if (!PHOTO_PATH.test(pathname) && !HERO_PATH.test(pathname)) throw new Error('Invalid upload path');
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          maximumSizeInBytes: 15 * 1024 * 1024,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Upload failed' }, { status: 400 });
  }
}
