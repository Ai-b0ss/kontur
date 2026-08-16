import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Окружение. Секреты только отсюда, никаких значений в коде.
 *
 * `.env` лежит в корне репозитория и в git не попадает. Путь считаем от
 * расположения файла, а не от cwd: api, bot и migrate запускаются
 * из разных каталогов.
 */
const ROOT_ENV = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '..',
  '..',
  '..',
  '.env',
);
const ENV_FILE = process.env.KONTUR_ENV_FILE
  ? resolve(process.env.KONTUR_ENV_FILE)
  : ROOT_ENV;

if (existsSync(ENV_FILE)) {
  try {
    process.loadEnvFile(ENV_FILE);
  } catch (e) {
    console.warn('[env] не удалось прочитать выбранный env-файл:', e);
  }
}

export const env = {
  port: Number(process.env.PORT ?? 8787),
  databaseUrl: process.env.DATABASE_URL || undefined,
  botToken: process.env.BOT_TOKEN ?? '',
  mainChatId: process.env.MAIN_CHAT_ID ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  miniappUrl: process.env.MINIAPP_URL ?? '',
  seasonStart: process.env.SEASON_START,
};

/**
 * Dev-режим включается отсутствием токена бота: подпись initData
 * не проверяется и членство считается подтверждённым — иначе приложение
 * невозможно открыть вне Telegram.
 */
export const isDev = !env.botToken;

/**
 * Проверка членства требует ID чата. Пока он не задан, боевой режим работать
 * не может: проверять membership не у чего.
 */
export const canCheckMembership = Boolean(env.botToken && env.mainChatId);

export function requireProdSecrets(): void {
  if (isDev) {
    console.warn(
      '[env] BOT_TOKEN не задан — dev-режим: подпись initData и членство не проверяются',
    );
    return;
  }

  console.log('[env] BOT_TOKEN задан — подпись initData проверяется');

  if (!env.mainChatId) throw new Error('MAIN_CHAT_ID обязателен, когда задан BOT_TOKEN');
  if (env.jwtSecret === 'dev-secret-change-me') {
    throw new Error('JWT_SECRET обязателен, когда задан BOT_TOKEN');
  }
  if (!env.miniappUrl.startsWith('https://')) {
    throw new Error('MINIAPP_URL должен быть HTTPS, когда задан BOT_TOKEN');
  }
}
