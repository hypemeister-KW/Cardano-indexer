import { Pool } from 'pg';

export function createDatabasePool(): Pool {
  let databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  return new Pool({
    connectionString: databaseUrl
  });
}

