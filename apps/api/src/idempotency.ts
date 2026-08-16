import {
  findIdempotent,
  idempotencyKey,
  saveIdempotent,
  type Sql,
} from '@kontur/db';
import { GameError } from './errors.js';

/**
 * Идемпотентность мутирующих вызовов (I5).
 *
 * Повтор запроса с тем же clientRequestId возвращает сохранённый ответ,
 * а не применяет операцию дважды. Проверка и сохранение идут внутри той же
 * транзакции, что и сама операция, иначе при обрыве между ними двойное
 * списание всё-таки случится.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireRequestId(body: unknown): string {
  const id = (body as { clientRequestId?: unknown } | null)?.clientRequestId;
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    throw new GameError('VALIDATION', { field: 'clientRequestId' });
  }
  return id;
}

/** Уже сохранённый ответ на этот запрос, если он был. */
export async function replayed<T>(
  tx: Sql,
  userId: number,
  clientRequestId: string,
): Promise<T | undefined> {
  return findIdempotent<T>(tx, idempotencyKey(userId, clientRequestId));
}

export async function remember(
  tx: Sql,
  userId: number,
  clientRequestId: string,
  endpoint: string,
  response: unknown,
): Promise<void> {
  await saveIdempotent(
    tx,
    idempotencyKey(userId, clientRequestId),
    endpoint,
    response,
  );
}
