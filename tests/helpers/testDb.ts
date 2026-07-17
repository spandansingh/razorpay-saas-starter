import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '@/models/Schema';

// An in-memory Postgres for unit tests, migrated with the real migrations/ SQL —
// the same statements production runs, so a migration that would fail there
// fails here too. No server, no Docker, nothing to clean up.
//
// Swap it in for the real connection with:
//   vi.mock('@/libs/DB', () => import('<path>/tests/helpers/testDb'));
// The mock factory and the test then share this one instance.
const client = new PGlite();

export const db = drizzle(client, { schema });

await migrate(db, { migrationsFolder: 'migrations' });
