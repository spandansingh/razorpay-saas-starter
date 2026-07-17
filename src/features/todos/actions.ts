'use server';

import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/libs/DB';
import { todoSchema } from '@/models/Schema';

// The reference pattern for org-scoped data in this starter.
//
// The rule these actions exist to demonstrate: `orgId` is read from the session
// and never accepted from the caller. Ids do arrive from the client, so every
// mutation matches on (id AND orgId) — passing another org's id then updates
// zero rows instead of somebody else's data.

const todoInput = z.object({
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(2000),
});

// A closed set: each value has a matching `error_*` message in the Todos
// namespace, so the UI can translate a failure without a fallback branch.
type TodoActionError = 'unauthorized' | 'invalid_input' | 'not_found';

export type TodoActionResult = { ok: true } | { ok: false; error: TodoActionError };

async function currentOrg(): Promise<{ userId: string; orgId: string } | null> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return null;
  }
  return { userId, orgId };
}

export async function createTodo(input: unknown): Promise<TodoActionResult> {
  const session = await currentOrg();
  if (!session) {
    return { ok: false, error: 'unauthorized' };
  }

  const parsed = todoInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'invalid_input' };
  }

  await db.insert(todoSchema).values({
    orgId: session.orgId, // from the session, never the caller
    ownerId: session.userId,
    title: parsed.data.title,
    message: parsed.data.message,
  });

  revalidatePath('/dashboard');
  return { ok: true };
}

export async function updateTodo(id: number, input: unknown): Promise<TodoActionResult> {
  const session = await currentOrg();
  if (!session) {
    return { ok: false, error: 'unauthorized' };
  }

  const parsed = todoInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'invalid_input' };
  }

  const updated = await db
    .update(todoSchema)
    .set({ title: parsed.data.title, message: parsed.data.message })
    .where(and(eq(todoSchema.id, id), eq(todoSchema.orgId, session.orgId)))
    .returning({ id: todoSchema.id });

  if (updated.length === 0) {
    return { ok: false, error: 'not_found' }; // absent, or another org's row
  }

  revalidatePath('/dashboard');
  return { ok: true };
}

export async function deleteTodo(id: number): Promise<TodoActionResult> {
  const session = await currentOrg();
  if (!session) {
    return { ok: false, error: 'unauthorized' };
  }

  const deleted = await db
    .delete(todoSchema)
    .where(and(eq(todoSchema.id, id), eq(todoSchema.orgId, session.orgId)))
    .returning({ id: todoSchema.id });

  if (deleted.length === 0) {
    return { ok: false, error: 'not_found' };
  }

  revalidatePath('/dashboard');
  return { ok: true };
}
