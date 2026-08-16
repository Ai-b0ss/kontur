import type { Sql } from './driver.js';
import { asDate, logEvent, num } from './repo.js';

export const SIGNAL_KINDS = ['cu_event', 'agency_case', 'own_project'] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

export interface SignalCard {
  id: number;
  kind: SignalKind;
  title: string;
  issuedAt: string;
}

export function isSignalKind(value: string): value is SignalKind {
  return (SIGNAL_KINDS as readonly string[]).includes(value);
}

/**
 * Выдаёт одну подтверждённую сигнал-карту. referenceCode — внешний
 * идемпотентный ключ проверки: повторный запуск ничего не дублирует.
 */
export async function issueSignal(
  sql: Sql,
  input: {
    userId: number;
    kind: SignalKind;
    title: string;
    referenceCode: string;
  },
): Promise<{ created: boolean; actionId: number | null }> {
  const action = await sql.one<{ id: string | number }>(
    `insert into real_actions
       (user_id, season_id, kind, title, description, state,
        reviewed_at, reference_code)
     values ($1, null, $2, $3, '', 'approved', now(), $4)
     on conflict (reference_code) where reference_code is not null
       do nothing
     returning id`,
    [input.userId, input.kind, input.title, input.referenceCode],
  );
  if (!action) {
    const prior = await sql.one<{ id: string | number }>(
      'select id from real_actions where reference_code = $1',
      [input.referenceCode],
    );
    return { created: false, actionId: prior ? num(prior.id) : null };
  }
  const actionId = num(action.id);

  await sql.query(
    `insert into signal_cards
       (user_id, real_action_id, verifiable, attribution, reproducible)
     values ($1, $2, $3, $4, $5)`,
    [
      input.userId,
      actionId,
      JSON.stringify({ method: 'manual_review', reference: input.referenceCode }),
      JSON.stringify({ userId: input.userId }),
      JSON.stringify({ kind: input.kind }),
    ],
  );
  await logEvent(sql, input.userId, 'real_action', {
    actionId,
    kind: input.kind,
  });
  await logEvent(sql, input.userId, 'signal_created', { actionId });

  return { created: true, actionId };
}

export async function listSignals(sql: Sql, userId: number): Promise<SignalCard[]> {
  const rows = await sql.query<{
    id: string | number;
    kind: SignalKind;
    title: string;
    issued_at: Date | string;
  }>(
    `select s.id, a.kind, a.title, s.issued_at
       from signal_cards s
       join real_actions a on a.id = s.real_action_id
      where s.user_id = $1 and a.state = 'approved'
      order by s.issued_at desc, s.id desc`,
    [userId],
  );
  return rows.map((row) => ({
    id: num(row.id),
    kind: row.kind,
    title: row.title,
    issuedAt: asDate(row.issued_at).toISOString(),
  }));
}

export async function signalCount(sql: Sql, userId: number): Promise<number> {
  const row = await sql.one<{ n: string | number }>(
    `select count(1) as n
       from signal_cards s join real_actions a on a.id = s.real_action_id
      where s.user_id = $1 and a.state = 'approved'`,
    [userId],
  );
  return num(row?.n);
}
