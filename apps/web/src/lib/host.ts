/**
 * Which app to show, from the browser's hostname:
 *   <domain>          -> marketing
 *   admin.<domain>    -> control panel
 *   <slug>.<domain>   -> tenant app
 *   anything else     -> unknown (404)
 */
export type HostKind =
  { kind: 'marketing' } | { kind: 'admin' } | { kind: 'tenant'; slug: string } | { kind: 'unknown' };

const SLUG = /^[a-z0-9-]{1,32}$/;

export function parseHost(hostname: string, domain: string): HostKind {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (host === domain) return { kind: 'marketing' };
  if (!host.endsWith(`.${domain}`)) return { kind: 'unknown' };
  const sub = host.slice(0, -(domain.length + 1));
  if (sub === 'admin') return { kind: 'admin' };
  return SLUG.test(sub) ? { kind: 'tenant', slug: sub } : { kind: 'unknown' };
}

/** Absolute URL of another app on the same domain and port, e.g. hostUrl('admin'). */
export function hostUrl(
  target: 'marketing' | 'admin' | { slug: string },
  loc: Pick<Location, 'protocol' | 'port'>,
  domain: string,
  path = '/',
): string {
  const sub = target === 'marketing' ? '' : target === 'admin' ? 'admin.' : `${target.slug}.`;
  const port = loc.port ? `:${loc.port}` : '';
  return `${loc.protocol}//${sub}${domain}${port}${path}`;
}
