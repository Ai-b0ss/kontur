import type { Sql } from './driver.js';
import { num } from './repo.js';

export interface PilotMetrics {
  generatedAt: string;
  funnel: {
    started: number;
    hatched: number;
    hatchRate: number | null;
  };
  activity: {
    lastDay: number;
    lastSevenDays: number;
    d1Eligible: number;
    d1Retained: number;
    d1Rate: number | null;
    d7Eligible: number;
    d7Retained: number;
    d7Rate: number | null;
  };
  worms: {
    grantsSevenDays: number;
    withReasonSevenDays: number;
    reasonRate: number | null;
  };
  signals: {
    total: number;
    players: number;
  };
}

const rate = (part: number, total: number): number | null =>
  total > 0 ? Math.round((part / total) * 10_000) / 100 : null;

/** Агрегаты пилота без Telegram ID, username и других персональных строк. */
export async function pilotMetrics(sql: Sql): Promise<PilotMetrics> {
  const row = await sql.one<Record<string, string | number | null>>(`
    with first_open as (
      select user_id, min(created_at) as first_at
        from events
       where type = 'auth_done'
       group by user_id
    )
    select
      (select count(1) from users where started_bot_at is not null) as started,
      (select count(1) from profiles where hatched_at is not null) as hatched,
      (select count(1) from users where last_seen_at > now() - interval '1 day') as active_1d,
      (select count(1) from users where last_seen_at > now() - interval '7 days') as active_7d,
      (select count(1) from first_open where first_at <= now() - interval '1 day') as d1_eligible,
      (select count(1) from first_open f
        where f.first_at <= now() - interval '1 day'
          and exists (
            select 1 from events e
             where e.user_id = f.user_id and e.type = 'auth_done'
               and e.created_at >= f.first_at + interval '1 day'
               and e.created_at <  f.first_at + interval '2 days'
          )) as d1_retained,
      (select count(1) from first_open where first_at <= now() - interval '7 days') as d7_eligible,
      (select count(1) from first_open f
        where f.first_at <= now() - interval '7 days'
          and exists (
            select 1 from events e
             where e.user_id = f.user_id and e.type = 'auth_done'
               and e.created_at >= f.first_at + interval '7 days'
               and e.created_at <  f.first_at + interval '8 days'
          )) as d7_retained,
      (select count(1) from worm_grants
        where created_at > now() - interval '7 days') as grants_7d,
      (select count(1) from worm_grants
        where created_at > now() - interval '7 days'
          and reason is not null and btrim(reason) <> '') as reasons_7d,
      (select count(1) from signal_cards s
        join real_actions a on a.id = s.real_action_id
       where a.state = 'approved') as signals_total,
      (select count(distinct s.user_id) from signal_cards s
        join real_actions a on a.id = s.real_action_id
       where a.state = 'approved') as signal_players
  `);

  const started = num(row?.started);
  const hatched = num(row?.hatched);
  const d1Eligible = num(row?.d1_eligible);
  const d1Retained = num(row?.d1_retained);
  const d7Eligible = num(row?.d7_eligible);
  const d7Retained = num(row?.d7_retained);
  const grantsSevenDays = num(row?.grants_7d);
  const withReasonSevenDays = num(row?.reasons_7d);

  return {
    generatedAt: new Date().toISOString(),
    funnel: { started, hatched, hatchRate: rate(hatched, started) },
    activity: {
      lastDay: num(row?.active_1d),
      lastSevenDays: num(row?.active_7d),
      d1Eligible,
      d1Retained,
      d1Rate: rate(d1Retained, d1Eligible),
      d7Eligible,
      d7Retained,
      d7Rate: rate(d7Retained, d7Eligible),
    },
    worms: {
      grantsSevenDays,
      withReasonSevenDays,
      reasonRate: rate(withReasonSevenDays, grantsSevenDays),
    },
    signals: {
      total: num(row?.signals_total),
      players: num(row?.signal_players),
    },
  };
}
