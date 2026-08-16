import { currentGameDay, ensureUser, loadPlayer } from './db.js';
import { grantLocalWorm, grantWorm } from './api.js';
import { sendMessage, telegramCall } from './telegram-api.js';
import {
  experienceV2Allowed,
  experienceV2GloballyEnabled,
  parseExperienceV2Allowlist,
  zeroSeasonGloballyEnabled,
} from './experience-access.js';
import { closeZeroSeasonDay } from './zero-season-api.js';
import { resolveLiveCampaignDueEvents } from './live-campaign-api.js';
import { confirmJourneyHelp } from './journey-telegram.js';
import {
  LIVE_CAMPAIGN_CRON,
  handleLiveCampaignCron,
  handleLiveCampaignGroupCommand,
  handleLiveCampaignMembershipUpdate,
  handleLiveCampaignPrivateStart,
} from './live-campaign-telegram.js';
import type { Env } from './types.js';

interface TgUser { id: number; username?: string; is_bot?: boolean }
interface TgChat { id: number; type: string }
interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: TgChat;
  text?: string;
  reply_to_message?: {
    message_id: number;
    from?: TgUser;
    reply_to_message?: { message_id: number; from?: TgUser };
  };
}
interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  chat_member?: { chat: TgChat; from: TgUser; new_chat_member: { user: TgUser; status: string; is_member?: boolean } };
}

function command(text: string): { name: string; target: string | null; tail: string } | null {
  const match = /^\/(start|worm|w|mute|unmute|kontur)(?:@([A-Za-z0-9_]+))?(?:\s+([\s\S]*))?$/i.exec(text.trim());
  return match ? {
    name: match[1]!.toLowerCase(),
    target: match[2]?.toLowerCase() ?? null,
    tail: (match[3] ?? '').trim().slice(0, 240),
  } : null;
}

function isV5CommandTarget(env: Env, target: string | null): boolean {
  if (!target) return true;
  const expected = env.V5_BOT_USERNAME?.trim().replace(/^@/, '').toLowerCase();
  return Boolean(expected && expected === target);
}

function rejectionText(reason: string | undefined): string {
  return ({
    self: 'Себе нельзя.',
    daily_limit: 'На сегодня раздачи закончились.',
    same_person_today: 'Этому человеку сегодня уже кидал.',
    exhausted: 'Этой паре пора сделать паузу до следующей недели.',
  } as Record<string, string>)[reason ?? ''] ?? 'Не получилось начислить червяка.';
}

async function start(env: Env, user: TgUser): Promise<void> {
  const { user: saved } = await ensureUser(env.DB, user.id, user.username ?? null);
  await env.DB.prepare(
    `UPDATE users SET started_bot_at=datetime('now'), push_misses=0 WHERE id=?`,
  ).bind(saved.id).run();
  await sendMessage(
    env,
    user.id,
    'Контур живёт поверх чата. Ответь на восемь коротких вопросов — получишь свою птицу. За особый респект участники могут отвечать /worm: червяки открывают новые окрасы. Бот не читает обычную переписку — только команды.',
    env.MINIAPP_URL ? {
      reply_markup: { inline_keyboard: [[{ text: 'Открыть', web_app: { url: env.MINIAPP_URL } }]] },
    } : {},
  );
}

async function preference(env: Env, user: TgUser, enabled: boolean): Promise<void> {
  const { user: saved } = await ensureUser(env.DB, user.id, user.username ?? null);
  await env.DB.prepare('UPDATE users SET push_enabled=?, push_misses=0 WHERE id=?')
    .bind(enabled ? 1 : 0, saved.id).run();
  await sendMessage(env, user.id, enabled ? 'Напоминания включены.' : 'Напоминания выключены. Вернуть: /unmute');
}

async function worm(env: Env, message: TgMessage, tail: string): Promise<void> {
  const giver = message.from;
  const reply = message.reply_to_message;
  const target = reply?.from;
  if (!giver || !reply || !target || target.is_bot) {
    if (giver) await sendMessage(env, giver.id, 'Ответь командой /worm на сообщение человека.');
    return;
  }
  if (giver.id === target.id) {
    await sendMessage(env, giver.id, 'Себе нельзя.');
    return;
  }
  const [{ user: from }, { user: to }] = await Promise.all([
    ensureUser(env.DB, giver.id, giver.username ?? null),
    ensureUser(env.DB, target.id, target.username ?? null),
  ]);
  // Keep the older V2 journey confirmation compatible when a real journey
  // is active. During the Local pilot, an allowlisted V2 user with no active
  // journey must still be able to use the ordinary social /worm ritual.
  if (await experienceV2Allowed(env, from.id)) {
    const source = reply.reply_to_message;
    const result = await confirmJourneyHelp(env, {
      requesterUserId: from.id,
      requesterTgId: giver.id,
      helperTgId: target.id,
      helperUsername: target.username ?? null,
      chatId: message.chat.id,
      sourceMessageId: source?.message_id ?? null,
      sourceAuthorTgId: source?.from?.id ?? null,
      replyMessageId: reply.message_id,
      clientRequestId: `tg:${message.chat.id}:${message.message_id}`,
    });
    const localFallback = zeroSeasonGloballyEnabled(env) && !result.ok && result.reason === 'no_active_question';
    if (!localFallback) {
      await telegramCall(env, 'deleteMessage', { chat_id: message.chat.id, message_id: message.message_id });
      if (!result.ok) {
        const text = result.reason === 'no_active_question'
          ? 'Сначала открой вопрос в «Контуре» и отметь, что отправил его.'
          : result.reason === 'self'
            ? 'Свой ответ нельзя отметить как помощь.'
            : result.reason === 'duplicate'
              ? 'Этот ответ уже отмечен.'
              : 'Ответь /worm именно на ответ, который был дан на твой вопрос.';
        await sendMessage(env, giver.id, text);
        return;
      }
      if (result.repeated) return;
      if (result.status === 'review') {
        await sendMessage(env, giver.id, 'Связь сохранена для спокойной проверки. Никакой публичной оценки не появилось.');
        return;
      }
      await telegramCall(env, 'setMessageReaction', {
        chat_id: message.chat.id,
        message_id: reply.message_id,
        reaction: [{ type: 'emoji', emoji: '❤️' }],
      });
      await sendMessage(env, giver.id, 'Ответ отмечен как полезный. Теперь можно сохранить результат в «Контуре».', env.MINIAPP_URL ? {
        reply_markup: { inline_keyboard: [[{ text: 'Открыть «Контур»', web_app: { url: env.MINIAPP_URL } }]] },
      } : {});
      if (result.helperStartedBot) {
        await sendMessage(env, target.id, 'Твой конкретный ответ помог участнику. Без очков и публичного рейтинга.');
      }
      return;
    }
  }
  const decision = zeroSeasonGloballyEnabled(env)
    ? await grantLocalWorm(env, from.id, to.id, tail || null, reply.message_id)
    : await grantWorm(env, from.id, to.id, tail || null, reply.message_id);
  await telegramCall(env, 'deleteMessage', { chat_id: message.chat.id, message_id: message.message_id });
  if (!decision.ok) {
    await sendMessage(env, giver.id, rejectionText(decision.rejection));
    return;
  }
  await telegramCall(env, 'setMessageReaction', {
    chat_id: message.chat.id,
    message_id: reply.message_id,
    reaction: [{ type: 'emoji', emoji: env.WORM_REACTION || '🍌' }],
  });
  const targetPlayer = await loadPlayer(env.DB, to.id);
  if (targetPlayer.started_bot_at) {
    await sendMessage(env, target.id, `Тебе кинули ${decision.value} черв. ${tail ? `Причина: ${tail}` : 'Без причины.'}`);
  }
  await sendMessage(env, giver.id, `Готово. Осталось раздать: ${decision.leftToday}.`);
}

export async function handleTelegramWebhook(env: Env, request: Request): Promise<Response> {
  if (!env.WEBHOOK_SECRET || request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) {
    return new Response('forbidden', { status: 403 });
  }
  const update = await request.json<TgUpdate>();
  if (update.chat_member) {
    // Preserve the legacy membership cache even if optional V5 state is not
    // migrated yet or a V5-only cache update fails.
    if (String(update.chat_member.chat.id) === String(env.MAIN_CHAT_ID)) {
      const member = update.chat_member.new_chat_member;
      const active = new Set(['creator', 'administrator', 'member']).has(member.status);
      const { user } = await ensureUser(env.DB, member.user.id, member.user.username ?? null);
      await env.DB.prepare(`UPDATE users SET is_member=?, member_checked_at=datetime('now') WHERE id=?`)
        .bind(active ? 1 : 0, user.id).run();
    }
    try {
      // V5 only caches membership for an already explicitly armed chat. It
      // never infers a campaign from ordinary group traffic.
      await handleLiveCampaignMembershipUpdate(env, update.chat_member);
    } catch (error) {
      console.warn('[telegram:v5-membership] cache skipped', error instanceof Error ? error.name : 'UnknownError');
    }
    return Response.json({ ok: true });
  }

  const message = update.message;
  const parsed = message?.text ? command(message.text) : null;
  if (!message || !parsed || !message.from) return Response.json({ ok: true });
  if (parsed.name === 'start' && message.chat.type === 'private') {
    if (!(isV5CommandTarget(env, parsed.target) && await handleLiveCampaignPrivateStart(env, message, parsed.tail))) {
      await start(env, message.from);
    }
  }
  else if (parsed.name === 'mute' && message.chat.type === 'private') await preference(env, message.from, false);
  else if (parsed.name === 'unmute' && message.chat.type === 'private') await preference(env, message.from, true);
  else if (parsed.name === 'kontur' && isV5CommandTarget(env, parsed.target)) {
    await handleLiveCampaignGroupCommand(env, message, parsed.tail);
  }
  else if ((parsed.name === 'worm' || parsed.name === 'w') && String(message.chat.id) === String(env.MAIN_CHAT_ID)) {
    await worm(env, message, parsed.tail);
  }
  return Response.json({ ok: true });
}

function quiet(hour: number, from: number, to: number): boolean {
  if (from === to) return false;
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

async function claimCron(env: Env, job: string, day: number): Promise<boolean> {
  const row = await env.DB.prepare(
    `INSERT INTO cron_log (job,game_day,status,attempts,last_error)
     VALUES (?,?,'running',1,NULL)
     ON CONFLICT(job,game_day) DO UPDATE SET
       status='running', attempts=cron_log.attempts+1,
       ran_at=datetime('now'), last_error=NULL
     WHERE cron_log.status='failed'
        OR (cron_log.status='running' AND cron_log.ran_at < datetime('now','-20 minutes'))
     RETURNING job`,
  ).bind(job, day).first<{ job: string }>();
  return Boolean(row);
}

async function finishCron(env: Env, job: string, day: number): Promise<void> {
  await env.DB.prepare(
    `UPDATE cron_log SET status='done', last_error=NULL, ran_at=datetime('now')
      WHERE job=? AND game_day=?`,
  ).bind(job, day).run();
}

async function failCron(env: Env, job: string, day: number, error: unknown): Promise<void> {
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  await env.DB.prepare(
    `UPDATE cron_log SET status='failed', last_error=?, ran_at=datetime('now')
      WHERE job=? AND game_day=?`,
  ).bind(errorName.slice(0, 80), job, day).run();
}

async function dailySummary(env: Env): Promise<void> {
  if (!env.MAIN_CHAT_ID) return;
  const day = currentGameDay(env) - 1;
  if (!(await claimCron(env, 'daily_summary', day))) return;
  try {
    const candidates = (await env.DB.prepare(
      `SELECT u.tg_id,u.username, sum(g.amount) AS total,
              group_concat(CASE WHEN g.reason IS NOT NULL AND g.reason <> '' THEN g.reason END, ' · ') AS reasons
         FROM worm_grants g JOIN users u ON u.id=g.to_user_id
        WHERE g.game_day=? GROUP BY g.to_user_id,u.username
        ORDER BY total DESC LIMIT 100`,
    ).bind(day).all<{ tg_id: number | string; username: string | null; total: number; reasons: string | null }>()).results;
    const v2Ids = experienceV2GloballyEnabled(env)
      ? parseExperienceV2Allowlist(env.EXPERIENCE_V2_USER_IDS)
      : new Set<string>();
    const rows = candidates.filter((row) => !v2Ids.has(String(row.tg_id))).slice(0, 3);
    if (rows.length) {
      const lines = rows.map((r, i) => `${i + 1}. @${r.username ?? 'участник'} — ${r.total}${r.reasons ? `: ${r.reasons}` : ''}`);
      const sent = await sendMessage(env, env.MAIN_CHAT_ID, `За вчера отметили:\n${lines.join('\n')}`);
      if (!sent) throw new Error('TelegramDeliveryError');
    }
    await finishCron(env, 'daily_summary', day);
  } catch (error) {
    await failCron(env, 'daily_summary', day, error);
    throw error;
  }
}

async function cleanup(env: Env): Promise<void> {
  const day = currentGameDay(env);
  if (!(await claimCron(env, 'cleanup', day))) return;
  try {
    const results = await env.DB.batch([
      env.DB.prepare(`DELETE FROM rate_limits
        WHERE window < CAST(strftime('%s','now') AS INTEGER) / 60 - 2880`),
      env.DB.prepare(`DELETE FROM events WHERE created_at < datetime('now','-90 days')`),
      env.DB.prepare(`DELETE FROM journey_events WHERE created_at < datetime('now','-90 days')`),
      env.DB.prepare(`DELETE FROM journey_action_requests WHERE created_at < datetime('now','-90 days')`),
      env.DB.prepare(`DELETE FROM push_log WHERE sent_at < datetime('now','-90 days')`),
      env.DB.prepare(`DELETE FROM cron_log
        WHERE ran_at < datetime('now','-180 days') AND NOT (job='cleanup' AND game_day=?)`).bind(day),
    ]);
    await finishCron(env, 'cleanup', day);
    console.log(`[cron:cleanup] deleted=${results.reduce((sum, result) => sum + Number(result.meta.changes ?? 0), 0)}`);
  } catch (error) {
    await failCron(env, 'cleanup', day, error);
    throw error;
  }
}

async function passiveReminders(env: Env): Promise<void> {
  const day = currentGameDay(env);
  const users = (await env.DB.prepare(
    `SELECT u.*, w.passive_collected_day FROM users u JOIN wallets w ON w.user_id=u.id
      JOIN profiles p ON p.user_id=u.id
     WHERE u.started_bot_at IS NOT NULL AND u.push_enabled=1 AND p.hatched_at IS NOT NULL
       AND u.is_member=1 AND u.banned_at IS NULL
       AND (w.passive_collected_day IS NULL OR w.passive_collected_day<>?)`,
  ).bind(day).all<Record<string, string | number | null>>()).results;
  const hour = new Date().getUTCHours();
  for (const user of users) {
    if (await experienceV2Allowed(env, Number(user.id))) continue;
    if (quiet(hour, Number(user.quiet_from_hour), Number(user.quiet_to_hour))) continue;
    const claim = await env.DB.prepare(
      `INSERT OR IGNORE INTO push_log (user_id,game_day,kind) VALUES (?,?,'passive')`,
    ).bind(user.id, day).run();
    if (!claim.meta.changes) continue;
    let ok = false;
    try {
      ok = await sendMessage(env, Number(user.tg_id), 'В кошельке ждут 8 червяков. Забрать можно в приложении.');
    } catch (error) {
      console.warn('[cron:passive] Telegram delivery failed', error instanceof Error ? error.name : 'UnknownError');
    }
    await env.DB.prepare(
      `UPDATE users SET push_misses=CASE WHEN ? THEN 0 ELSE push_misses+1 END,
                        push_enabled=CASE WHEN NOT ? AND push_misses+1>=3 THEN 0 ELSE push_enabled END
        WHERE id=?`,
    ).bind(ok ? 1 : 0, ok ? 1 : 0, user.id).run();
  }
}

async function journeyReminders(env: Env): Promise<void> {
  const reminders = (await env.DB.prepare(
    `SELECT r.id,u.tg_id
       FROM journey_reminders r
       JOIN users u ON u.id=r.user_id
       JOIN nest_items n ON n.id=r.nest_item_id
      WHERE r.status='pending' AND r.due_at<=datetime('now')
        AND n.deleted_at IS NULL AND u.banned_at IS NULL
      ORDER BY r.due_at,r.id LIMIT 100`,
  ).all<{ id: number; tg_id: number | string }>()).results;
  for (const reminder of reminders) {
    const claim = await env.DB.prepare(
      `UPDATE journey_reminders SET status='sent',sent_at=datetime('now'),updated_at=datetime('now')
        WHERE id=? AND status='pending'`,
    ).bind(reminder.id).run();
    if (!claim.meta.changes) continue;
    try {
      await sendMessage(env, Number(reminder.tg_id), 'Ты просил один раз напомнить о сохранённом следующем шаге.', env.MINIAPP_URL ? {
        reply_markup: { inline_keyboard: [[{ text: 'Открыть «Контур»', web_app: { url: env.MINIAPP_URL } }]] },
      } : {});
    } catch (error) {
      console.warn('[cron:journey-reminder] Telegram delivery failed', error instanceof Error ? error.name : 'UnknownError');
    }
  }
}

export async function handleCron(env: Env, cron: string): Promise<void> {
  if (cron === '0 6-10 * * *') {
    const gameDay = currentGameDay(env);
    // Until the first full game day has ended there is no prior round to close
    // or to summarize. In particular, do not pass game day -1 to V4 at launch.
    if (gameDay > 0 && !zeroSeasonGloballyEnabled(env)) {
      await closeZeroSeasonDay(env, gameDay - 1);
      await dailySummary(env);
    }
  }
  if (cron === '30 4 * * *') await cleanup(env);
  if (cron === '0 15 * * *') {
    await journeyReminders(env);
    // Daily free worms destroy the Local MVP meaning: every visible worm
    // should originate in another participant's deliberate /worm gesture.
    if (!zeroSeasonGloballyEnabled(env)) await passiveReminders(env);
  }
  if (cron === LIVE_CAMPAIGN_CRON) await resolveLiveCampaignDueEvents(env);
  await handleLiveCampaignCron(env, cron);
}
