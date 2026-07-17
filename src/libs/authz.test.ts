import { auth } from '@clerk/nextjs/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireOrgAdmin } from './authz';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));

// Stands in for Clerk's auth() result. `has` answers role checks the way Clerk
// does: true only for the role the session actually holds.
function session({ userId, orgId, role }: {
  userId: string | null;
  orgId?: string | null;
  role?: string;
}) {
  vi.mocked(auth).mockResolvedValue({
    userId,
    orgId: orgId ?? null,
    has: ({ role: wanted }: { role?: string }) => wanted === role,
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

describe('requireOrgAdmin', () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it('admits an org admin and hands back the resolved context', async () => {
    session({ userId: 'user_1', orgId: 'org_1', role: 'org:admin' });

    await expect(requireOrgAdmin()).resolves.toEqual({
      ok: true,
      userId: 'user_1',
      orgId: 'org_1',
    });
  });

  // The gate that matters: a plain member must not be able to touch billing.
  it('rejects a non-admin member with 403', async () => {
    session({ userId: 'user_2', orgId: 'org_1', role: 'org:member' });

    const result = await requireOrgAdmin();

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.response.status).toBe(403);
      await expect(result.response.json()).resolves.toEqual({ error: 'forbidden' });
    }
  });

  it('rejects a signed-out caller with 401', async () => {
    session({ userId: null });

    const result = await requireOrgAdmin();

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it('rejects an admin with no active organization with 403', async () => {
    session({ userId: 'user_3', orgId: null, role: 'org:admin' });

    const result = await requireOrgAdmin();

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.response.status).toBe(403);
      await expect(result.response.json()).resolves.toEqual({ error: 'no_active_organization' });
    }
  });
});
