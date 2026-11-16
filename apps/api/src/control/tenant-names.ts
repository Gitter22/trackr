import { z } from 'zod';

const RESERVED = new Set([
  'admin',
  'www',
  'api',
  'app',
  'mail',
  'static',
  'assets',
  'cdn',
  'root',
  'support',
  'help',
  'status',
  'graphql',
]);

/** Lowercase letters, digits and dashes; starts with a letter; 3-32 chars; not reserved. */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z][a-z0-9-]{1,30}[a-z0-9]$/,
    'Use 3-32 lowercase letters, digits or dashes, starting with a letter',
  )
  .refine((s) => !s.includes('--'), 'No double dashes')
  .refine((s) => !RESERVED.has(s), 'This slug is reserved');

/** Safe SQL identifiers (slug already validated, so only [a-z0-9_]). */
export function tenantDbNames(slug: string): { dbName: string; dbUser: string } {
  const s = slug.replace(/-/g, '_');
  return { dbName: `tenant_${s}_db`, dbUser: `tenant_${s}_user` };
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
