import './env.js';
import { ConfigStore, connect } from '@kontur/db';
import { gameEpochFrom } from '@kontur/core';
import { startBot } from './bot.js';

/**
 * Отдельный процесс бота — так это работает на проде: падение крона
 * не должно ронять игру.
 *
 * Локально с PGlite так запускать нельзя одновременно с API: каталог БД
 * держит один процесс. Для локальной разработки есть BOT_IN_PROCESS=1,
 * тогда бот поднимается внутри API.
 */

const db = await connect(process.env.DATABASE_URL);
const config = await ConfigStore.create(db);
const epochMs = gameEpochFrom(
  new Date(process.env.SEASON_START ?? '2026-08-01'),
  config.balance,
);

const handle = startBot({ db, config, epochMs });
console.log(`Контур · бот и крон запущены [${db.driver}]`);

// Ручной прогон: pnpm -F @kontur/bot start run digest
const manual = process.argv.slice(2);
if (manual[0] === 'run' && manual[1]) {
  const ok = await handle.run(manual[1]);
  console.log(ok ? `задача ${manual[1]} выполнена` : `нет задачи ${manual[1]}`);
  handle.stop();
  await db.close();
  process.exitCode = ok ? 0 : 1;
}
