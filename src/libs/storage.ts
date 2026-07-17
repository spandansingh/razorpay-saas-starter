import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Env } from '@/libs/Env';

// S3-compatible object storage. One adapter serves AWS S3 and Cloudflare R2 (and
// friends) because the endpoint is configurable — R2 is the lazy default: same
// API, no egress fees. Point STORAGE_ENDPOINT at
// https://<account>.r2.cloudflarestorage.com and set STORAGE_REGION=auto.
//
// Plug-and-play, with one deliberate difference from email/analytics/ratelimit:
// this does NOT silently no-op when unconfigured. The app still boots without
// storage env — nothing runs at import — but calling an upload that quietly did
// nothing would look like success to the user and lose their file. So the
// unconfigured path throws, and callers check isStorageConfigured() first to
// return a clear error instead.

const DEFAULT_REGION = 'auto'; // what R2 expects; AWS S3 needs a real region

export function isStorageConfigured(): boolean {
  return Boolean(
    Env.STORAGE_BUCKET
    && Env.STORAGE_ACCESS_KEY_ID
    && Env.STORAGE_SECRET_ACCESS_KEY,
  );
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!isStorageConfigured()) {
    throw new Error(
      'Object storage is not configured — set STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY',
    );
  }
  if (!client) {
    client = new S3Client({
      region: Env.STORAGE_REGION || DEFAULT_REGION,
      // Unset for AWS S3, which derives its own endpoint from the region.
      ...(Env.STORAGE_ENDPOINT ? { endpoint: Env.STORAGE_ENDPOINT } : {}),
      credentials: {
        accessKeyId: Env.STORAGE_ACCESS_KEY_ID!,
        secretAccessKey: Env.STORAGE_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

/**
 * Build the object key for a file owned by an org.
 *
 * Namespaced by org, and the caller's filename is sanitised rather than trusted:
 * a name like `../../other-org/logo.png` must not escape the prefix and collide
 * with — or overwrite — another tenant's object.
 *
 * Stripping the separators is what actually contains it (an S3 key is a flat
 * string, so `..` alone cannot traverse). Dot runs go too, so the key stays safe
 * for anything that later maps it onto a real filesystem path, where they would.
 */
export function orgObjectKey(orgId: string, filename: string, uniqueId: string): string {
  const safeName = filename
    .replace(/[^\w.-]/g, '_') // separators and anything exotic
    .replace(/\.{2,}/g, '_') // no `..` anywhere
    .replace(/^[.\-_]+/, '') // no leading dot/dash/underscore
    .slice(-100) || 'file';

  return `orgs/${orgId}/${uniqueId}-${safeName}`;
}

/** A presigned PUT URL, so the browser uploads straight to the bucket. */
export async function getSignedUploadUrl(input: {
  key: string;
  contentType: string;
  expiresIn?: number;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: Env.STORAGE_BUCKET,
    Key: input.key,
    ContentType: input.contentType,
  });

  return getSignedUrl(getClient(), command, { expiresIn: input.expiresIn ?? 300 });
}

// Spec 09 also lists putObject() (server-side upload) and getPublicUrl() (build a
// display URL from STORAGE_PUBLIC_URL). Both are omitted until something calls
// them: the presigned-upload flow above needs neither, and each is a few lines to
// add against the client and env already wired up here.
