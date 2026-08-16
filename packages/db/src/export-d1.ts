import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { connect } from './driver.js';

const outIndex = process.argv.indexOf('--out');
const outPath = outIndex >= 0 ? process.argv[outIndex + 1] : undefined;
if (!outPath) throw new Error('usage: pnpm -F @kontur/db export:d1 -- --out <temporary.sql>');

function sql(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (value instanceof Date) return `'${value.toISOString().replaceAll("'", "''")}'`;
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `'${text.replaceAll("'", "''")}'`;
}

function insert(table: string, columns: string[], values: unknown[], mode = 'OR IGNORE'): string {
  return `INSERT ${mode} INTO ${table} (${columns.join(',')}) VALUES (${values.map(sql).join(',')});`;
}

const db = await connect(process.env.DATABASE_URL || undefined);
try {
  const [users, profiles, answers, wallets, grants, owned, visits, pulls, signals, events, pushes, crons] = await Promise.all([
    db.query<Record<string, unknown>>(`SELECT id,tg_id,username,created_at,last_seen_at,started_bot_at,
      is_member,member_checked_at,banned_at,push_enabled,quiet_from_hour,quiet_to_hour,push_misses FROM users ORDER BY id`),
    db.query<Record<string, unknown>>('SELECT user_id,role,coloring,hatched_at,bird_name FROM profiles ORDER BY user_id'),
    db.query<Record<string, unknown>>(`SELECT a.user_id,a.answers,a.role,a.scores,a.created_at,p.bird_name
      FROM onboarding_answers a JOIN profiles p ON p.user_id=a.user_id ORDER BY a.user_id`),
    db.query<Record<string, unknown>>('SELECT user_id,wallet,reputation,passive_collected_day,updated_at FROM wallets ORDER BY user_id'),
    db.query<Record<string, unknown>>(`SELECT id,from_user_id,to_user_id,amount,reason,chat_message_id,game_day,created_at
      FROM worm_grants ORDER BY id`),
    db.query<Record<string, unknown>>('SELECT user_id,coloring_code,obtained_at FROM player_colorings ORDER BY user_id,coloring_code'),
    db.query<Record<string, unknown>>('SELECT id,visitor_id,host_id,game_day,created_at FROM nest_visits ORDER BY id'),
    db.query<Record<string, unknown>>('SELECT id,user_id,coloring_code,duplicate,announced,created_at FROM egg_pulls ORDER BY id'),
    db.query<Record<string, unknown>>(`SELECT s.id,s.user_id,a.kind,a.title,a.reference_code,s.issued_at
      FROM signal_cards s JOIN real_actions a ON a.id=s.real_action_id
      WHERE a.state='approved' ORDER BY s.id`),
    db.query<Record<string, unknown>>('SELECT id,user_id,type,payload,created_at FROM events ORDER BY id'),
    db.query<Record<string, unknown>>('SELECT id,user_id,game_day,kind,sent_at FROM push_log ORDER BY id'),
    db.query<Record<string, unknown>>('SELECT job,game_day,ran_at FROM cron_log ORDER BY job,game_day'),
  ]);

  // Wrangler D1 imports execute statements through a managed batch and reject
  // explicit BEGIN/COMMIT. Every insert is idempotent so an interrupted import
  // can be safely rerun.
  const lines = ['PRAGMA foreign_keys=ON;'];
  for (const row of users) lines.push(insert('users', Object.keys(row), Object.values(row)));
  for (const row of answers) {
    lines.push(insert('onboarding_answers',
      ['user_id','client_request_id','answers','role','scores','bird_name','created_at'],
      [row.user_id, `migrate-hatch-${row.user_id}`, row.answers, row.role, row.scores, row.bird_name, row.created_at]));
  }
  for (const row of profiles) {
    lines.push(`UPDATE profiles SET role=${sql(row.role)},coloring=${sql(row.coloring)},hatched_at=${sql(row.hatched_at)},bird_name=${sql(row.bird_name)} WHERE user_id=${sql(row.user_id)};`);
  }
  for (const row of grants) {
    lines.push(insert('worm_grants',
      ['id','from_user_id','to_user_id','amount','reason','chat_message_id','game_day','daily_budget','created_at'],
      [row.id,row.from_user_id,row.to_user_id,row.amount,row.reason,row.chat_message_id,row.game_day,100000,row.created_at]));
  }
  for (const row of pulls) {
    lines.push(insert('egg_pulls',
      ['id','user_id','coloring_code','duplicate','spend','announced','client_request_id','created_at'],
      [row.id,row.user_id,row.coloring_code,row.duplicate,0,row.announced,`migrate-egg-${row.id}`,row.created_at]));
  }
  for (const row of owned) lines.push(insert('player_colorings', Object.keys(row), Object.values(row)));
  for (const row of visits) lines.push(insert('nest_visits', Object.keys(row), Object.values(row)));
  for (const row of signals) {
    lines.push(insert('signal_cards', ['id','user_id','kind','title','reference_code','issued_at'], [
      row.id,row.user_id,row.kind,row.title,row.reference_code ?? `migrated-signal-${row.id}`,row.issued_at,
    ]));
  }
  for (const row of events) lines.push(insert('events', Object.keys(row), Object.values(row)));
  for (const row of pushes) lines.push(insert('push_log', Object.keys(row), Object.values(row)));
  for (const row of crons) lines.push(insert('cron_log', Object.keys(row), Object.values(row)));
  for (const row of wallets) {
    if (row.passive_collected_day !== null && row.passive_collected_day !== undefined) {
      lines.push(insert('passive_claims', ['user_id','game_day','amount','client_request_id'], [
        row.user_id,row.passive_collected_day,0,`migrate-passive-${row.user_id}-${row.passive_collected_day}`,
      ]));
    }
    lines.push(`UPDATE wallets SET wallet=${sql(row.wallet)},reputation=${sql(row.reputation)},passive_collected_day=${sql(row.passive_collected_day)},updated_at=${sql(row.updated_at)} WHERE user_id=${sql(row.user_id)};`);
  }
  await writeFile(resolve(outPath), lines.join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });
  process.stdout.write(JSON.stringify({ users: users.length, profiles: profiles.filter((r) => r.hatched_at).length }));
} finally {
  await db.close();
}
