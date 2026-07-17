import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Roles live in Clerk, not our DB. We use Clerk's default org roles; switching to
// custom permissions means swapping `{ role: 'org:admin' }` for
// `{ permission: 'org:billing:manage' }` here and nowhere else.
const ORG_ADMIN_ROLE = 'org:admin';

/** UI-side check. Never the only guard — pair it with a server check. */
export async function isOrgAdmin(): Promise<boolean> {
  const { has } = await auth();
  return has({ role: ORG_ADMIN_ROLE });
}

/**
 * Server gate for org-admin-only routes. Returns a response to send back when
 * the caller is not allowed, or the resolved auth context when they are.
 */
export async function requireOrgAdmin(): Promise<
  | { ok: true; userId: string; orgId: string }
  | { ok: false; response: NextResponse }
> {
  const { userId, orgId, has } = await auth();

  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  }
  if (!orgId) {
    return { ok: false, response: NextResponse.json({ error: 'no_active_organization' }, { status: 403 }) };
  }
  if (!has({ role: ORG_ADMIN_ROLE })) {
    return { ok: false, response: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }

  return { ok: true, userId, orgId };
}
