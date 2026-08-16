import {
  ROLES,
  dailyGiveBudget,
  isDoubleDay,
  passiveAvailable,
  type Role,
} from '@kontur/core';
import {
  asDate,
  ensureWallet,
  num,
  signalCount as countSignals,
  type ColoringRow,
  type ProfileRow,
  type Sql,
  type UserRow,
  type WalletRow,
} from '@kontur/db';
import type { GameState, Palette } from '@kontur/contracts';
import type { Ctx } from './ctx.js';

/** Загрузка игрока и сборка состояния. */

export interface LoadedPlayer {
  user: UserRow;
  profile: ProfileRow;
  wallet: WalletRow;
}

const FALLBACK_PALETTE: Palette = {
  body: '#edd9b6',
  belly: '#faeed6',
  wing: '#d3ae74',
  tail: '#c09a68',
  crest: '#c8a26c',
  beak: '#ef8a52',
};

export async function ensureUser(
  sql: Sql,
  tgId: number,
  username: string | null,
): Promise<{ user: UserRow; isNew: boolean }> {
  const existing = await sql.one<UserRow>('select * from users where tg_id = $1', [
    tgId,
  ]);
  if (existing) {
    await sql.query(
      'update users set username = $2, last_seen_at = now() where id = $1',
      [existing.id, username],
    );
    return { user: { ...existing, username }, isNew: false };
  }

  const created = (await sql.one<UserRow>(
    `insert into users (tg_id, username, last_seen_at)
     values ($1, $2, now()) returning *`,
    [tgId, username],
  ))!;
  await sql.query(
    'insert into profiles (user_id) values ($1) on conflict do nothing',
    [created.id],
  );
  await ensureWallet(sql, created.id);
  return { user: created, isNew: true };
}

export async function loadPlayer(sql: Sql, userId: number): Promise<LoadedPlayer> {
  const user = (await sql.one<UserRow>('select * from users where id = $1', [
    userId,
  ]))!;

  let profile = await sql.one<ProfileRow>(
    'select * from profiles where user_id = $1',
    [userId],
  );
  if (!profile) {
    profile = (await sql.one<ProfileRow>(
      'insert into profiles (user_id) values ($1) returning *',
      [userId],
    ))!;
  }

  const wallet = await ensureWallet(sql, userId);
  return { user, profile, wallet };
}

export async function coloringOf(
  sql: Sql,
  code: string,
): Promise<ColoringRow | undefined> {
  return sql.one<ColoringRow>('select * from colorings where code = $1', [code]);
}

/** Сколько раздач сделано отправителем в этот игровой день. */
export async function givenToday(
  sql: Sql,
  userId: number,
  day: number,
): Promise<number> {
  const row = await sql.one<{ n: string | number }>(
    'select count(1) as n from worm_grants where from_user_id = $1 and game_day = $2',
    [userId, day],
  );
  return num(row?.n);
}

/** Репутация за окно рейтинга — именно недельная, не за всё время. */
export async function weeklyReputation(
  sql: Sql,
  userId: number,
  windowDays: number,
): Promise<number> {
  const row = await sql.one<{ total: string | number | null }>(
    `select coalesce(sum(amount), 0) as total
       from worm_grants
      where to_user_id = $1
        and created_at > now() - ($2 || ' days')::interval`,
    [userId, String(windowDays)],
  );
  return num(row?.total);
}

export async function buildState(
  ctx: Ctx,
  sql: Sql,
  p: LoadedPlayer,
  now: Date,
): Promise<GameState> {
  const cfg = ctx.config.balance;
  const flags = ctx.config.features;
  const day = ctx.gameDay(now);
  const doubleDay = isDoubleDay(now, cfg.GAME_DAY_START_UTC);

  const hatched = Boolean(p.profile.role && p.profile.hatched_at);
  const role = (p.profile.role ?? null) as Role | null;

  const coloring = await coloringOf(sql, p.profile.coloring);
  const palette = (coloring?.palette as unknown as Palette) ?? FALLBACK_PALETTE;

  const given = await givenToday(sql, p.user.id, day);
  const budget = dailyGiveBudget(doubleDay, cfg);

  const walletAmount = num(p.wallet.wallet);

  const ownedRow = await sql.one<{ n: string | number }>(
    'select count(1) as n from player_colorings where user_id = $1',
    [p.user.id],
  );
  const totalRow = await sql.one<{ n: string | number }>(
    'select count(1) as n from colorings',
  );

  const passive = flags.FEATURE_PASSIVE
    ? {
        available: passiveAvailable(p.wallet.passive_collected_day, day, cfg),
        collectedToday: p.wallet.passive_collected_day === day,
      }
    : null;

  return {
    serverTime: now.toISOString(),
    gameDay: day,
    isDoubleDay: doubleDay,
    hatched,
    features: {
      eggs: flags.FEATURE_EGGS,
      community: flags.FEATURE_COMMUNITY,
      passive: flags.FEATURE_PASSIVE,
    },
    player: {
      userId: p.user.id,
      username: p.user.username,
      role,
      roleTitle: role ? ROLES[role].title : null,
      roleTagline: role ? ROLES[role].tagline : null,
      birdName: p.profile.bird_name,
      coloring: p.profile.coloring,
      coloringTitle: coloring?.title ?? 'Обычный',
      palette,
      hatchedAt: p.profile.hatched_at
        ? asDate(p.profile.hatched_at).toISOString()
        : null,
      wallet: walletAmount,
      reputation: num(p.wallet.reputation),
      signalCount: await countSignals(sql, p.user.id),
    },
    give: {
      budget,
      left: Math.max(0, budget - given),
      valueWithReason: doubleDay
        ? cfg.WORM_VALUE_WITH_REASON * cfg.WORM_DOUBLE_DAY_FACTOR
        : cfg.WORM_VALUE_WITH_REASON,
      valuePlain: doubleDay
        ? cfg.WORM_VALUE_PLAIN * cfg.WORM_DOUBLE_DAY_FACTOR
        : cfg.WORM_VALUE_PLAIN,
    },
    egg:
      hatched && flags.FEATURE_EGGS
        ? {
            cost: cfg.EGG_COST,
            affordable: walletAmount >= cfg.EGG_COST,
            owned: num(ownedRow?.n),
            total: num(totalRow?.n),
          }
        : null,
    passive: hatched ? passive : null,
  };
}
