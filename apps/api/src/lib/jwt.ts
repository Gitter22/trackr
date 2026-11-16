import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

/** Audience ties a token to one scope: the control panel or a single tenant. */
export const ADMIN_AUDIENCE = 'admin';
export const tenantAudience = (slug: string) => `tenant:${slug}`;

export interface TokenClaims {
  sub: string;
  /** Tenant tokens only: bumped on deactivate / role change to end old sessions. */
  ver?: number;
}

export function signToken(claims: TokenClaims, audience: string): string {
  return jwt.sign(claims, env().JWT_SECRET, {
    audience,
    expiresIn: env().JWT_TTL as SignOptions['expiresIn'],
    issuer: 'trcker',
  });
}

/** Throws if the token is invalid, expired, or for a different audience. */
export function verifyToken(token: string, audience: string): TokenClaims {
  const payload = jwt.verify(token, env().JWT_SECRET, { audience, issuer: 'trcker' });
  if (typeof payload === 'string' || typeof payload.sub !== 'string') throw new Error('Bad token');
  return { sub: payload.sub, ver: typeof payload.ver === 'number' ? payload.ver : undefined };
}
