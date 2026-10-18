import { neon } from '@neondatabase/serverless';

/**
 * Server-only Neon SQL client.
 * Call this inside a request or job. Do not import it from client components.
 */
export function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined');
  }

  return neon(databaseUrl);
}

export function postgresErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const record = error as { code?: unknown; cause?: { code?: unknown } };
  if (typeof record.code === 'string') return record.code;
  if (record.cause && typeof record.cause.code === 'string') return record.cause.code;
  return undefined;
}
