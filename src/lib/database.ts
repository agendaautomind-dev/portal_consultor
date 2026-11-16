import 'server-only';

import postgres, { type Sql } from 'postgres';

const globalDatabase = globalThis as typeof globalThis & {
  portalDatabase?: Sql;
};

export function getDatabase(): Sql {
  if (globalDatabase.portalDatabase) return globalDatabase.portalDatabase;

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL não foi configurada.');

  globalDatabase.portalDatabase = postgres(connectionString, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: process.env.DATABASE_SSL?.trim().toLowerCase() === 'true' ? 'require' : false
  });
  return globalDatabase.portalDatabase;
}
