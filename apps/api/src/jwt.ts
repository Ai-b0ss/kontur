import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from './env.js';
import { GameError } from './errors.js';

/**
 * JWT HS256, TTL 24 часа. В payload только user_id и exp (§4.1) —
 * ничего лишнего туда не кладём.
 */

const TTL_SECONDS = 24 * 3600;

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function sign(data: string): string {
  return b64url(createHmac('sha256', env.jwtSecret).update(data).digest());
}

export function issueToken(userId: number): { token: string; expiresAt: Date } {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ user_id: userId, exp }));
  const body = `${header}.${payload}`;
  return {
    token: `${body}.${sign(body)}`,
    expiresAt: new Date(exp * 1000),
  };
}

export function verifyToken(token: string): number {
  const parts = token.split('.');
  if (parts.length !== 3) throw new GameError('SESSION_EXPIRED');

  const [header, payload, signature] = parts as [string, string, string];
  const expected = sign(`${header}.${payload}`);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new GameError('SESSION_EXPIRED');
  }

  let claims: { user_id?: number; exp?: number };
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    throw new GameError('SESSION_EXPIRED');
  }

  if (!claims.user_id || !claims.exp) throw new GameError('SESSION_EXPIRED');
  if (claims.exp * 1000 < Date.now()) throw new GameError('SESSION_EXPIRED');

  return claims.user_id;
}
