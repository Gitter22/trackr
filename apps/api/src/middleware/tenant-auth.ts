import type { Request, RequestHandler } from 'express';
import type { User } from '../generated/tenant';
import { HttpError } from '../lib/http';
import { tenantAudience, verifyToken } from '../lib/jwt';

declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
  }
}

/**
 * Tenant sessions use a Bearer token. The web app keeps it in localStorage under
 * a slug-prefixed key, so one browser can be signed in to several orgs.
 */
export function bearerToken(req: Request): string | null {
  const header = req.get('authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

/**
 * Loads the signed-in user for this tenant. Rejects a token issued for another
 * tenant (audience mismatch), an inactive user, or a token older than the
 * user's tokenVersion (role change / deactivation ends old sessions).
 * Returns null when there is no valid session.
 */
export async function authenticate(req: Request): Promise<User | null> {
  const token = bearerToken(req);
  if (!token) return null;
  let claims;
  try {
    claims = verifyToken(token, tenantAudience(req.tenant!.slug));
  } catch {
    return null;
  }
  const user = await req.prisma!.user.findUnique({ where: { id: claims.sub } });
  if (!user || !user.isActive || user.tokenVersion !== claims.ver) return null;
  return user;
}

export const requireTenantUser: RequestHandler = async (req, _res, next) => {
  const user = await authenticate(req);
  if (!user) throw new HttpError(401, 'Not signed in', 'UNAUTHENTICATED');
  req.user = user;
  next();
};
