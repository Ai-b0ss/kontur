import { fileURLToPath } from 'node:url';
import { join as joinPath } from 'node:path';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';

/**
 * Доступ к БД. ТЗ §2 фиксирует PostgreSQL 15+.
 *
 * Два драйвера за одним интерфейсом:
 *   - `pg` — managed Postgres (Supabase/Neon), боевой режим;
 *   - PGlite — тот же Postgres, скомпилированный в WASM, для локальной работы.
 *
 * SQL, миграции, check-констрейнты и `select … for update` одинаковы в обоих:
 * переключение — это смена DATABASE_URL, а не переписывание запросов.
 */

export interface Sql {
  query<T = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<T[]>;
  /** Одна строка или undefined — сахар над query */
  one<T = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<T | undefined>;
  /**
   * Многооператорный SQL без параметров — для миграций.
   * Отдельный метод нужен потому, что extended-протокол (через который идёт
   * `query` с параметрами) допускает ровно один оператор на запрос.
   */
  exec(sql: string): Promise<void>;
}

export interface Db extends Sql {
  /**
   * Транзакция. Изменения player_season выполняются только внутри неё
   * вместе с `select … for update` — иначе две вкладки дают гонку (§13).
   */
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  driver: 'pg' | 'pglite';
}

function wrap(
  raw: (text: string, params?: readonly unknown[]) => Promise<unknown[]>,
  exec: (sql: string) => Promise<void>,
): Sql {
  return {
    query: raw as Sql['query'],
    async one(text, params) {
      const rows = await raw(text, params);
      return rows[0] as never;
    },
    exec,
  };
}

export async function connect(databaseUrl: string | undefined): Promise<Db> {
  if (databaseUrl) return connectPg(databaseUrl);
  return connectPglite(process.env.PGLITE_DIR ?? defaultDataDir());
}

/**
 * Путь к локальной БД считаем от расположения этого файла, а не от cwd:
 * api, bot и migrate запускаются из разных каталогов и должны видеть
 * одну и ту же базу.
 */
function defaultDataDir(): string {
  const here = fileURLToPath(new URL('.', import.meta.url)); // packages/db/src/
  return joinPath(here, '..', '..', '..', 'data', 'pg');
}

async function connectPg(url: string): Promise<Db> {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: url, max: 10 });

  const run = async (text: string, params?: readonly unknown[]) =>
    (await pool.query(text, params as unknown[])).rows;

  return {
    ...wrap(run, async (sql) => {
      await pool.query(sql);
    }),
    driver: 'pg',
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const txRun = async (text: string, params?: readonly unknown[]) =>
          (await client.query(text, params as unknown[])).rows;
        const result = await fn(
          wrap(txRun, async (sql) => {
            await client.query(sql);
          }),
        );
        await client.query('commit');
        return result;
      } catch (e) {
        await client.query('rollback');
        throw e;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

/**
 * PGlite держит каталог БД эксклюзивно и оставляет `postmaster.pid` при
 * аварийном завершении. Записанный туда идентификатор фиктивный (WASM-сборка
 * пишет отрицательное число), поэтому по нему нельзя понять, жив ли владелец.
 *
 * Ведём свой файл владельца с настоящим PID процесса: если владелец мёртв,
 * блокировка залипла и её можно снять. Если жив — честно отказываемся
 * открывать, а не портим чужую базу.
 */
function claimDataDir(dir: string): void {
  // PGlite считает новый каталог с любым заранее созданным файлом
  // повреждённой БД. Поэтому наш lock лежит рядом, а не внутри.
  const ownerFile = `${dir}.owner.pid`;
  // Старые сборки могли оставить lock внутри каталога; учитываем его при миграции.
  const legacyOwnerFile = joinPath(dir, '.owner.pid');

  for (const candidate of [ownerFile, legacyOwnerFile]) {
    if (!existsSync(candidate)) continue;
    const pid = Number(readFileSync(candidate, 'utf8').trim());
    if (pid && pid !== process.pid && isProcessAlive(pid)) {
      throw new Error(
        `Каталог БД ${dir} занят процессом ${pid}. PGlite допускает только ` +
          'один процесс на каталог: остановите его или задайте DATABASE_URL, ' +
          'чтобы работать с настоящим Postgres.',
      );
    }
  }

  // Владельца нет или он мёртв — чистим залипшие следы.
  rmSync(ownerFile, { force: true });
  rmSync(legacyOwnerFile, { force: true });
  rmSync(joinPath(dir, 'postmaster.pid'), { force: true });
  rmSync(joinPath(dir, '.s.PGSQL.5432.lock.out'), { force: true });
  writeFileSync(ownerFile, String(process.pid));
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM означает, что процесс есть, но он не наш
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function releaseDataDir(dir: string): void {
  try {
    rmSync(`${dir}.owner.pid`, { force: true });
    rmSync(joinPath(dir, '.owner.pid'), { force: true });
  } catch {
    // на выходе из процесса падать уже незачем
  }
}

async function connectPglite(dir: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  // PGlite не создаёт вложенные каталоги сам
  mkdirSync(dir, { recursive: true });

  claimDataDir(dir);
  // Снимаем заявку и при штатном выходе, и при Ctrl+C: иначе следующий
  // запуск будет думать, что каталог занят
  const release = () => releaseDataDir(dir);
  process.once('exit', release);
  process.once('SIGINT', () => {
    release();
    process.exit(0);
  });
  process.once('SIGTERM', () => {
    release();
    process.exit(0);
  });

  const pglite = new PGlite(dir);
  await pglite.waitReady;

  const run = async (text: string, params?: readonly unknown[]) =>
    (await pglite.query(text, params as unknown[])).rows as unknown[];

  return {
    ...wrap(run, async (sql) => {
      await pglite.exec(sql);
    }),
    driver: 'pglite',
    async transaction(fn) {
      return pglite.transaction(async (tx) => {
        const txRun = async (text: string, params?: readonly unknown[]) =>
          (await tx.query(text, params as unknown[])).rows as unknown[];
        return fn(
          wrap(txRun, async (sql) => {
            await tx.exec(sql);
          }),
        );
      }) as Promise<never>;
    },
    async close() {
      await pglite.close();
      releaseDataDir(dir);
    },
  };
}
