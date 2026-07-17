import { auth } from '@clerk/nextjs/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { todoSchema } from '@/models/Schema';
import { createTodo, deleteTodo, updateTodo } from './actions';
import { getTodos } from './queries';

// Real Postgres (in-memory PGlite) on the real migrations, so the org-scoping
// guard is proven against actual SQL rather than a mocked query builder.
vi.mock('@/libs/DB', () => import('../../../tests/helpers/testDb'));
vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const ORG_A = { userId: 'user_a', orgId: 'org_a' };
const ORG_B = { userId: 'user_b', orgId: 'org_b' };

function signedInAs(session: { userId: string; orgId: string } | null) {
  vi.mocked(auth).mockResolvedValue({
    userId: session?.userId ?? null,
    orgId: session?.orgId ?? null,
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

const validTodo = { title: 'Ship it', message: 'Before Friday' };

describe('todo actions', () => {
  beforeEach(async () => {
    await db.delete(todoSchema);
    vi.mocked(auth).mockReset();
  });

  it('creates a todo scoped to the session org', async () => {
    signedInAs(ORG_A);

    await expect(createTodo(validTodo)).resolves.toEqual({ ok: true });

    const todos = await getTodos(ORG_A.orgId);

    expect(todos).toHaveLength(1);
    expect(todos[0]).toMatchObject({ orgId: 'org_a', ownerId: 'user_a', title: 'Ship it' });
  });

  it('rejects invalid input instead of throwing', async () => {
    signedInAs(ORG_A);

    await expect(createTodo({ title: '', message: '' })).resolves.toEqual({
      ok: false,
      error: 'invalid_input',
    });
    await expect(createTodo({ title: '   ', message: 'x' })).resolves.toEqual({
      ok: false,
      error: 'invalid_input',
    });
    await expect(getTodos(ORG_A.orgId)).resolves.toHaveLength(0);
  });

  it('rejects a signed-out caller and one with no active org', async () => {
    signedInAs(null);

    await expect(createTodo(validTodo)).resolves.toEqual({ ok: false, error: 'unauthorized' });

    signedInAs({ userId: 'user_a', orgId: null as unknown as string });

    await expect(createTodo(validTodo)).resolves.toEqual({ ok: false, error: 'unauthorized' });
  });

  it('never leaks one org’s todos to another', async () => {
    signedInAs(ORG_A);
    await createTodo({ title: 'Org A secret', message: 'a' });
    signedInAs(ORG_B);
    await createTodo({ title: 'Org B item', message: 'b' });

    await expect(getTodos(ORG_A.orgId)).resolves.toMatchObject([{ title: 'Org A secret' }]);
    await expect(getTodos(ORG_B.orgId)).resolves.toMatchObject([{ title: 'Org B item' }]);
  });

  // The guard that matters: ids come from the client, so org B naming org A's
  // row id must change nothing rather than mutate it.
  it('refuses to update or delete another org’s todo by id', async () => {
    signedInAs(ORG_A);
    await createTodo({ title: 'Org A secret', message: 'a' });
    const [orgATodo] = await getTodos(ORG_A.orgId);
    const victimId = orgATodo!.id;

    signedInAs(ORG_B);

    await expect(updateTodo(victimId, { title: 'pwned', message: 'pwned' })).resolves.toEqual({
      ok: false,
      error: 'not_found',
    });
    await expect(deleteTodo(victimId)).resolves.toEqual({ ok: false, error: 'not_found' });

    // Org A's row is untouched and still there.
    signedInAs(ORG_A);

    await expect(getTodos(ORG_A.orgId)).resolves.toMatchObject([
      { id: victimId, title: 'Org A secret', message: 'a' },
    ]);
  });

  it('updates and deletes the session org’s own todo', async () => {
    signedInAs(ORG_A);
    await createTodo(validTodo);
    const [todo] = await getTodos(ORG_A.orgId);

    await expect(updateTodo(todo!.id, { title: 'Shipped', message: 'Done' })).resolves.toEqual({ ok: true });
    await expect(getTodos(ORG_A.orgId)).resolves.toMatchObject([{ title: 'Shipped', message: 'Done' }]);

    await expect(deleteTodo(todo!.id)).resolves.toEqual({ ok: true });
    await expect(getTodos(ORG_A.orgId)).resolves.toHaveLength(0);
  });
});
