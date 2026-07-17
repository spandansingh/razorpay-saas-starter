import { randomUUID } from 'node:crypto';
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSignedUploadUrl, isStorageConfigured, orgObjectKey } from '@/libs/storage';

// Hands the browser a short-lived presigned PUT so it uploads straight to the
// bucket — the file never passes through this server. That makes this route the
// only gate, so it validates here rather than trusting the client.

/** Images only by default. Widen deliberately: whatever is listed can be served back. */
const ALLOWED_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

const bodySchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_CONTENT_TYPES),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: 'no_active_organization' }, { status: 403 });
  }

  // A clear error rather than a silent no-op: an upload that did nothing would
  // look like success and lose the user's file.
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: 'storage_not_configured' }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  // The key is built from the session's orgId, never a client-supplied one, and
  // the filename is sanitised — see orgObjectKey.
  const key = orgObjectKey(orgId, parsed.data.filename, randomUUID());

  try {
    const url = await getSignedUploadUrl({ key, contentType: parsed.data.contentType });
    return NextResponse.json({ url, key });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
