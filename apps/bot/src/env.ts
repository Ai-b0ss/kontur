import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Загрузка `.env` из корня репозитория. Путь считаем от расположения файла,
 * а не от cwd: бот запускается из своего каталога.
 *
 * Импортируется первой строкой — до того, как кто-либо прочитает process.env.
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

export {};
