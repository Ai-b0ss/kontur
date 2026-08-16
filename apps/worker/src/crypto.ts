import { GameError } from './errors.js';
import type { Env } from './types.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function b64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function hmac(key: string | Uint8Array, data: string): Promise<Uint8Array> {
  const raw = typeof key === 'string' ? encoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    raw as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data)));
}

function constantEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export interface TelegramIdentity {
  tgId: number;
  username: string | null;
}

export async function verifyInitData(env: Env, initData: string): Promise<TelegramIdentity> {
  if (env.DEV_MODE === 'true') {
    const match = /^dev:(\d+)$/.exec(initData.trim());
    const tgId = match ? Number(match[1]) : 1;
    return { tgId, username: `dev${tgId}` };
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw new GameError('INVALID_INIT_DATA');
  params.delete('hash');
  const checkString = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = await hmac('WebAppData', env.BOT_TOKEN);
  const computed = bytesToHex(await hmac(secret, checkString));
  if (!constantEqual(computed, hash)) throw new GameError('INVALID_INIT_DATA');

  const authDate = Number(params.get('auth_date') ?? 0);
  const age = Date.now() / 1000 - authDate;
  if (!authDate || age > 86_400 || age < -300) {
    throw new GameError('INVALID_INIT_DATA', { reason: 'auth_date' });
  }

  try {
    const user = JSON.parse(params.get('user') ?? '') as { id?: number; username?: string };
    if (!user.id) throw new Error('no id');
    return { tgId: user.id, username: user.username ?? null };
  } catch {
    throw new GameError('INVALID_INIT_DATA', { reason: 'bad user json' });
  }
}

export async function issueToken(secret: string, userId: number) {
  const exp = Math.floor(Date.now() / 1000) + 86_400;
  const header = b64url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = b64url(encoder.encode(JSON.stringify({ user_id: userId, exp })));
  const body = `${header}.${payload}`;
  const signature = b64url(await hmac(secret, body));
  return { token: `${body}.${signature}`, expiresAt: new Date(exp * 1000) };
}

export async function verifyToken(secret: string, token: string): Promise<number> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new GameError('SESSION_EXPIRED');
  const [header, payload, signature] = parts as [string, string, string];
  const expected = b64url(await hmac(secret, `${header}.${payload}`));
  if (!constantEqual(expected, signature)) throw new GameError('SESSION_EXPIRED');
  try {
    const claims = JSON.parse(decoder.decode(fromB64url(payload))) as { user_id?: number; exp?: number };
    if (!claims.user_id || !claims.exp || claims.exp * 1000 < Date.now()) throw new Error('expired');
    return claims.user_id;
  } catch {
    throw new GameError('SESSION_EXPIRED');
  }
}
