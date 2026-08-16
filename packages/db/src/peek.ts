import { connect } from './driver.js';

/** Быстрый осмотр схемы: `pnpm -F @kontur/db peek` */
const db = await connect(process.env.DATABASE_URL);

const applied = await db.query<{ name: string }>(
  'select name from schema_migrations order by name',
);
console.log('применённые миграции:', applied.map((r) => r.name).join(', ') || '—');

const tables = await db.query<{ table_name: string }>(
  `select table_name from information_schema.tables
    where table_schema = 'public' order by table_name`,
);
console.log('таблицы:', tables.map((t) => t.table_name).join(', '));

const cols = await db.query<{ column_name: string }>(
  `select column_name from information_schema.columns
    where table_name = 'profiles' order by ordinal_position`,
);
console.log('profiles:', cols.map((c) => c.column_name).join(', '));

await db.close();
