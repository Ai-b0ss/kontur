import { createHmac, timingSafeEqual } from 'node:crypto';
import { canCheckMembership, env, isDev } from './env.js';
import { GameError } from './errors.js';

/** Проверка initData и членства в чате — ТЗ §4. */

export interface TelegramUser {
  tgId: number;
  username: string | null;
}

/**
 * Валидация подписи initData (§4.1).
 *
 * Ключ выводится как HMAC-SHA256 от строки 'WebAppData' на токене бота —
 * это описано в документации Telegram и отличается от прямого использования
 * токена как ключа.
 */
export function verifyInitData(initData: string): TelegramUser {
  if (isDev) return devUserFrom(initData);

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw new GameError('INVALID_INIT_DATA');

  params.delete('hash');
  const checkString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(env.botToken).digest();
  const computed = createHmac('sha256', secret).update(checkString).digest('hex');

  const a = Buffer.from(computed);
  const b = Buffer.from(hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new GameError('INVALID_INIT_DATA');
  }

  // auth_date старше 24 часов — протух (§4.1, шаг 3)
  const authDate = Number(params.get('auth_date') ?? 0);
  const ageSeconds = Date.now() / 1000 - authDate;
  if (!authDate || ageSeconds > 86_400 || ageSeconds < -300) {
    throw new GameError('INVALID_INIT_DATA', { reason: 'auth_date' });
  }

  const rawUser = params.get('user');
  if (!rawUser) throw new GameError('INVALID_INIT_DATA', { reason: 'no user' });

  try {
    const u = JSON.parse(rawUser) as { id: number; username?: string };
    if (!u.id) throw new Error('no id');
    return { tgId: u.id, username: u.username ?? null };
  } catch {
    throw new GameError('INVALID_INIT_DATA', { reason: 'bad user json' });
  }
}

/**
 * В dev допускается подставить конкретного игрока строкой вида `dev:42`,
 * чтобы гонять несколько аккаунтов локально. На проде эта ветка мертва.
 */
function devUserFrom(initData: string): TelegramUser {
  const m = /^dev:(\d+)$/.exec(initData.trim());
  const tgId = m ? Number(m[1]) : 1;
  return { tgId, username: `dev${tgId}` };
}

let warned = false;
function warnOnce(): void {
  if (warned) return;
  warned = true;
  console.warn(
    '[telegram] MAIN_CHAT_ID не задан — членство в чате НЕ проверяется. ' +
      'Задать до запуска на людях.',
  );
}

export type MemberStatus =
  | 'creator'
  | 'administrator'
  | 'member'
  | 'restricted'
  | 'left'
  | 'kicked';

const ALLOWED: ReadonlySet<string> = new Set(['creator', 'administrator', 'member']);

/**
 * Проверка членства в основном чате (§4.2).
 *
 * Это одновременно античит и бизнес-логика: игра существует для этого
 * сообщества и вне его не имеет смысла. Ослаблять нельзя даже ради теста —
 * для теста есть dev-чат.
 */
export async function checkMembership(tgId: number): Promise<boolean> {
  if (isDev) return true;

  // Токен есть, а чата ещё нет — проверять не у чего. Пропускаем, но громко:
  // это основная защита от мультиаккаунтов, и до запуска её надо включить
  if (!canCheckMembership) {
    warnOnce();
    return true;
  }

  const url =
    `https://api.telegram.org/bot${env.botToken}/getChatMember` +
    `?chat_id=${encodeURIComponent(env.mainChatId)}&user_id=${tgId}`;

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  } catch {
    throw new GameError('TELEGRAM_UNAVAILABLE');
  }
  if (!res.ok) {
    // Недоступность Telegram не должна выкидывать игроков из игры:
    // считаем проверку не пройденной и оставляем прежний кэш
    throw new GameError('TELEGRAM_UNAVAILABLE');
  }

  const body = (await res.json()) as {
    ok: boolean;
    result?: { status: MemberStatus };
  };
  return Boolean(body.ok && body.result && ALLOWED.has(body.result.status));
}

/** Отправка сообщения — используется ботом для пушей и поста в чат. */
export async function sendMessage(
  chatId: string | number,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  if (isDev) {
    console.log(`[telegram:dev] → ${chatId}: ${text}`);
    return true;
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${env.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, ...extra }),
        signal: AbortSignal.timeout(8_000),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
