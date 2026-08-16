import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from './driver.js';
import { isSignalKind, issueSignal } from './signals.js';
import { num, type UserRow } from './repo.js';

const ROOT_ENV = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.env');
const ENV_FILE = process.env.KONTUR_ENV_FILE
  ? resolve(process.env.KONTUR_ENV_FILE)
  : ROOT_ENV;
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const args = process.argv.slice(2);
const value = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const username = value('--username')?.replace(/^@/, '').trim();
const tgId = value('--tg-id')?.trim();
const kind = value('--kind')?.trim() ?? '';
const title = value('--title')?.trim() ?? '';
const referenceCode = value('--key')?.trim() ?? '';
const apply = args.includes('--apply');

if ((!username && !tgId) || (username && tgId)) {
  fail('Укажите ровно один идентификатор: --username или --tg-id');
}
if (!isSignalKind(kind)) {
  fail('kind: cu_event | agency_case | own_project');
}
if (!title || title.length > 120) fail('title: от 1 до 120 символов');
if (!referenceCode || referenceCode.length > 120) {
  fail('key: стабильный уникальный код проверки, от 1 до 120 символов');
}

const db = await connect(process.env.DATABASE_URL);
try {
  let user: UserRow | undefined;
  if (username) {
    const matches = await db.query<UserRow>(
      'select * from users where lower(username) = lower($1)',
      [username],
    );
    if (matches.length > 1) {
      fail('Username неоднозначен: используйте стабильный --tg-id');
    }
    user = matches[0];
  } else {
    user = await db.one<UserRow>('select * from users where tg_id = $1', [tgId]);
  }

  if (!user) fail('Игрок не найден: сначала он должен один раз открыть Mini App');

  const target = user.username ? `@${user.username}` : `user #${user.id}`;
  console.log(`режим: ${apply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`игрок: ${target}`);
  console.log(`тип: ${kind}`);
  console.log(`карта: ${title}`);
  console.log(`ключ: ${referenceCode}`);

  if (!apply) {
    console.log('изменений нет; для выдачи добавьте --apply');
  } else {
    const result = await db.transaction((tx) =>
      issueSignal(tx, {
        userId: num(user.id),
        kind,
        title,
        referenceCode,
      }),
    );
    console.log(result.created ? 'сигнал-карта выдана' : 'карта уже была выдана');
  }
} finally {
  await db.close();
}

function fail(message: string): never {
  console.error(message);
  console.error(
    'пример: pnpm signal:issue -- --username nick --kind own_project ' +
      '--title "Проект прошёл ревью" --key project-2026-001 [--apply]',
  );
  process.exit(1);
}
