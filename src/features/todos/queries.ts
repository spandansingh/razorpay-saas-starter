import { desc, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { todoSchema } from '@/models/Schema';

export type Todo = typeof todoSchema.$inferSelect;

// Always filtered by org, so one org can never read another's rows. The caller
// passes the orgId it got from auth() — see actions.ts for the same rule.
export async function getTodos(orgId: string): Promise<Todo[]> {
  return db
    .select()
    .from(todoSchema)
    .where(eq(todoSchema.orgId, orgId))
    .orderBy(desc(todoSchema.createdAt))
    .limit(50);
}
