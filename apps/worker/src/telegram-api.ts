import { GameError } from './errors.js';
import type { Env } from './types.js';

type TelegramResult<T> = { ok: boolean; result?: T; description?: string };

export async function telegramCall<T>(
  env: Pick<Env, 'BOT_TOKEN' | 'DEV_MODE'>,
  method: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  if (env.DEV_MODE === 'true' && !env.BOT_TOKEN) return null;
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new GameError('TELEGRAM_UNAVAILABLE');
  }
  const result = await response.json<TelegramResult<T>>();
  if (!response.ok || !result.ok) return null;
  return result.result ?? null;
}

export async function checkMembership(env: Env, tgId: number): Promise<boolean> {
  // Keep the legacy main-chat contract byte-for-byte in spirit: V1–V4 have
  // always accepted these three Telegram statuses only.
  if (env.DEV_MODE === 'true') return true;
  const member = await telegramCall<{ status: string }>(env, 'getChatMember', {
    chat_id: env.MAIN_CHAT_ID,
    user_id: tgId,
  });
  if (!member) throw new GameError('TELEGRAM_UNAVAILABLE');
  return new Set(['creator', 'administrator', 'member']).has(member.status);
}

/**
 * Проверяет состав конкретного чата. V5 вызывает его только после того, как
 * чат был явно зарегистрирован командой администратора; legacy-обёртка выше
 * остаётся привязанной к MAIN_CHAT_ID.
 */
export async function checkChatMembership(
  env: Env,
  telegramChatId: string | number,
  tgId: number,
): Promise<boolean> {
  if (env.DEV_MODE === 'true') return true;
  const member = await telegramCall<{ status: string; is_member?: boolean }>(env, 'getChatMember', {
    chat_id: telegramChatId,
    user_id: tgId,
  });
  if (!member) throw new GameError('TELEGRAM_UNAVAILABLE');
  return isActiveMember(member);
}

/** Групповые V5-команды регистрации и публикации доступны только админу чата. */
export async function checkChatAdmin(
  env: Env,
  telegramChatId: string | number,
  tgId: number,
): Promise<boolean> {
  if (env.DEV_MODE === 'true') return true;
  const member = await telegramCall<{ status: string }>(env, 'getChatMember', {
    chat_id: telegramChatId,
    user_id: tgId,
  });
  if (!member) throw new GameError('TELEGRAM_UNAVAILABLE');
  return member.status === 'creator' || member.status === 'administrator';
}

/**
 * Армирование V5 требует прав не только у человека, но и у самого бота.
 * Иначе Telegram не гарантирует проверку состава чата и команда не должна
 * оставлять частично настроенную кампанию.
 */
export async function checkBotChatAdmin(
  env: Env,
  telegramChatId: string | number,
): Promise<boolean> {
  if (env.DEV_MODE === 'true') return true;
  const bot = await telegramCall<{ id: number }>(env, 'getMe', {});
  if (!bot) throw new GameError('TELEGRAM_UNAVAILABLE');
  return checkChatAdmin(env, telegramChatId, bot.id);
}

function isActiveMember(member: { status: string; is_member?: boolean }): boolean {
  return member.status === 'creator'
    || member.status === 'administrator'
    || member.status === 'member'
    || (member.status === 'restricted' && member.is_member === true);
}

export async function sendMessage(
  env: Env,
  chatId: string | number,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  if (env.DEV_MODE === 'true' && !env.BOT_TOKEN) return true;
  const result = await telegramCall(env, 'sendMessage', { chat_id: chatId, text, ...extra });
  return result !== null;
}
