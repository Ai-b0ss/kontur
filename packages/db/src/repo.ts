import type { Db, Sql } from './driver.js';

/** Типы строк и общие запросы. */

export interface UserRow {
  id: number;
  tg_id: string | number;
  username: string | null;
  created_at: Date;
  last_seen_at: Date | null;
  is_member: boolean;
  member_checked_at: Date | null;
  banned_at: Date | null;
  push_enabled: boolean;
  quiet_from_hour: number;
  quiet_to_hour: number;
  push_misses: number;
}

export interface ProfileRow {
  user_id: number;
  role: string | null;
  coloring: string;
  hatched_at: Date | null;
  bird_name: string | null;
}

export interface WalletRow {
  user_id: number;
  /** Что на руках — это тратится */
  wallet: string | number;
  /** Сколько накидали всего — только растёт, по нему рейтинг */
  reputation: string | number;
  passive_collected_day: number | null;
}

export interface ColoringRow {
  code: string;
  title: string;
  rarity: 'common' | 'rare' | 'legendary';
  weight: number;
  palette: Record<string, string>;
}

export interface WormGrantRow {
  id: number;
  from_user_id: number;
  to_user_id: number;
  amount: number;
  reason: string | null;
  game_day: number;
  created_at: Date | string;
}

/** bigint приходит из pg строкой, из PGlite — числом. Приводим в одном месте. */
export function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : Number(v);
}

export function asDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

/**
 * Блокирует кошелёк на запись. Любое изменение баланса идёт только через
 * это — иначе две вкладки или два одновременных червяка дают гонку.
 */
export async function lockWallet(
  tx: Sql,
  userId: number,
): Promise<WalletRow | undefined> {
  return tx.one<WalletRow>(
    'select * from wallets where user_id = $1 for update',
    [userId],
  );
}

export async function ensureWallet(sql: Sql, userId: number): Promise<WalletRow> {
  const created = await sql.one<WalletRow>(
    `insert into wallets (user_id) values ($1)
     on conflict (user_id) do nothing
     returning *`,
    [userId],
  );
  if (created) return created;
  return (await sql.one<WalletRow>('select * from wallets where user_id = $1', [
    userId,
  ]))!;
}

export async function logEvent(
  sql: Sql,
  userId: number | null,
  type: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await sql.query(
    'insert into events (user_id, type, payload) values ($1, $2, $3)',
    [userId, type, JSON.stringify(payload)],
  );
}

/* ─── идемпотентность ───────────────────────────────────────── */

export function idempotencyKey(userId: number, clientRequestId: string): string {
  return `${userId}:${clientRequestId}`;
}

export async function findIdempotent<T>(
  sql: Sql,
  key: string,
): Promise<T | undefined> {
  const row = await sql.one<{ response: T }>(
    'select response from idempotency where key = $1',
    [key],
  );
  return row?.response;
}

export async function saveIdempotent(
  sql: Sql,
  key: string,
  endpoint: string,
  response: unknown,
): Promise<void> {
  await sql.query(
    `insert into idempotency (key, endpoint, response) values ($1, $2, $3)
     on conflict (key) do nothing`,
    [key, endpoint, JSON.stringify(response)],
  );
}

export async function cleanIdempotency(db: Db): Promise<number> {
  const rows = await db.query(
    `delete from idempotency
      where created_at < now() - interval '48 hours'
      returning key`,
  );
  return rows.length;
}

/** Идемпотентность крон-задач по (тип, game_day). */
export async function claimCronRun(
  db: Db,
  job: string,
  gameDay: number,
): Promise<boolean> {
  const rows = await db.query(
    `insert into cron_log (job, game_day) values ($1, $2)
     on conflict (job, game_day) do nothing
     returning job`,
    [job, gameDay],
  );
  return rows.length > 0;
}
