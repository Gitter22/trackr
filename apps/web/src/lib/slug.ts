/** Suggests a subdomain slug from an org title: "Kiksasa Labs!" -> "kiksasa-labs". */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, 32)
    .replace(/-+$/, '');
}

/** Same rule as the API: 3-32 chars, lowercase letters/digits/dashes, starts with a letter. */
export const SLUG_RE = /^[a-z][a-z0-9-]{1,30}[a-z0-9]$/;
export const RESERVED_SLUGS = [
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
];
