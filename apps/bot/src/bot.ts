import { Bot } from 'grammy';
import {
  ConfigStore,
  claimCronRun,
  cleanIdempotency,
  ensureWallet,
  lockWallet,
  logEvent,
  num,
  type Db,
  type Sql,
} from '@kontur/db';
import {
  decideGrant,
  gameDay,
  isDoubleDay,
  type BalanceConfig,
  type GrantDecision,
  type GrantRejection,
} from '@kontur/core';
import { isMainChat } from './scope.js';

/**
 * Бот в чате.
 *
 * Privacy mode оставляем включённым: бот видит только команды и не читает
 * переписку. Команда приходит реплаем, и вместе с ней Telegram отдаёт
 * `reply_to_message` — цель мы знаем, а переписку не видим.
 *
 * Реакция ставится бананом: червяка в наборе разрешённых боту эмодзи нет,
 * а кастомные требуют, чтобы эмодзи уже стояла на сообщении или была
 * разрешена админами. Картинка вторична, важен факт публичной реакции.
 *
 * Вынесено в функцию, чтобы бота можно было поднять и отдельным процессом
 * (как на проде), и внутри процесса API — локально PGlite держит каталог БД
 * эксклюзивно, и двумя процессами к одной базе не подключиться.
 */

export interface BotDeps {
  db: Db;
  config: ConfigStore;
  epochMs: number;
}

export interface BotHandle {
  /** Ручной прогон крон-задачи по имени */
  run(job: string): Promise<boolean>;
  stop(): void;
}

export function isQuietHour(hour: number, from: number, to: number): boolean {
  if (from === to) return false;
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

const REJECTION_TEXT: Record<GrantRejection, string> = {
  self: 'Себе нельзя.',
  daily_limit: 'На сегодня червяки кончились. Завтра будут новые.',
  same_person_today: 'Этому человеку сегодня уже кидал.',
  exhausted: 'Этому человеку на этой неделе уже достаточно от тебя.',
};

export interface WormGrantInput {
  giver: number;
  receiver: number;
  reason: string | null;
  targetMessageId: number;
  day: number;
  now: Date;
  config: BalanceConfig;
}

/**
 * Проверка лимитов и начисление — одна транзакция.
 *
 * Блокировка кошелька отправителя сериализует даже одновременные команды
 * разным людям. Без неё обе команды могли прочитать один и тот же счётчик и
 * вместе превысить дневной бюджет.
 */
export async function applyWormGrant(
  db: Pick<Db, 'transaction'>,
  input: WormGrantInput,
): Promise<GrantDecision> {
  return db.transaction(async (tx: Sql) => {
    await lockWallet(tx, input.giver);

    const givenTodayRow = await tx.one<{ n: string | number }>(
      'select count(1) as n from worm_grants where from_user_id = $1 and game_day = $2',
      [input.giver, input.day],
    );
    const sameTodayRow = await tx.one<{ n: string | number }>(
      `select count(1) as n from worm_grants
        where from_user_id = $1 and to_user_id = $2 and game_day = $3`,
      [input.giver, input.receiver, input.day],
    );
    const priorRow = await tx.one<{ n: string | number }>(
      `select count(1) as n from worm_grants
        where from_user_id = $1 and to_user_id = $2
          and created_at > now() - ($3 || ' days')::interval`,
      [input.giver, input.receiver, String(input.config.WORM_REPEAT_WINDOW_DAYS)],
    );

    const decision = decideGrant(
      {
        givenToday: num(givenTodayRow?.n),
        gaveToThisPersonToday: num(sameTodayRow?.n) > 0,
        priorGrantsToPerson: num(priorRow?.n),
        withReason: Boolean(input.reason),
        isDoubleDay: isDoubleDay(input.now, input.config.GAME_DAY_START_UTC),
      },
      input.config,
    );

    if (!decision.ok) return decision;

    await tx.query(
      `insert into worm_grants
         (from_user_id, to_user_id, amount, reason, chat_message_id, game_day)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        input.giver,
        input.receiver,
        decision.value,
        input.reason,
        input.targetMessageId,
        input.day,
      ],
    );
    await tx.query(
      `update wallets
          set wallet = wallet + $2, reputation = reputation + $2, updated_at = now()
        where user_id = $1`,
      [input.receiver, decision.value],
    );
    await logEvent(tx, input.receiver, 'worm_received', {
      from: input.giver,
      amount: decision.value,
      withReason: Boolean(input.reason),
    });

    return decision;
  });
}

export function startBot({ db, config, epochMs }: BotDeps): BotHandle {
  const BOT_TOKEN = process.env.BOT_TOKEN ?? '';
  const MAIN_CHAT_ID = process.env.MAIN_CHAT_ID ?? '';
  const MINIAPP_URL = process.env.MINIAPP_URL ?? 'http://localhost:5173';
  const REACTION = process.env.WORM_REACTION ?? '🍌';
  const noBot = !BOT_TOKEN;

  const today = () => gameDay(new Date(), epochMs);
  const bot = BOT_TOKEN ? new Bot(BOT_TOKEN) : null;

  /* ─── вспомогательное ─────────────────────────────────────── */

  async function ensurePlayer(tgId: number, username: string | null): Promise<number> {
    const created = (await db.one<{ id: number }>(
      `insert into users (tg_id, username) values ($1, $2)
       on conflict (tg_id) do update
         set username = coalesce(excluded.username, users.username)
       returning id`,
      [tgId, username],
    ))!;
    await db.query(
      'insert into profiles (user_id) values ($1) on conflict do nothing',
      [created.id],
    );
    await ensureWallet(db, created.id);
    return created.id;
  }

  /** Пуш в личку. Доходит только до тех, кто нажимал /start. */
  async function notify(tgId: number, text: string): Promise<boolean> {
    if (!bot) {
      console.log(`[личка → ${tgId}] ${text}`);
      return true;
    }
    try {
      await bot.api.sendMessage(tgId, text);
      return true;
    } catch {
      // Диалога с ботом нет — писать некуда
      return false;
    }
  }

  async function post(text: string, tag: string): Promise<boolean> {
    if (!bot) {
      console.log(`[${tag}]\n${text}`);
      return true;
    }
    if (!MAIN_CHAT_ID) {
      console.warn(`[${tag}] MAIN_CHAT_ID не задан, сообщение не отправлено`);
      return false;
    }
    try {
      await bot.api.sendMessage(MAIN_CHAT_ID, text);
      return true;
    } catch (e) {
      console.warn(`[${tag}] не отправилось:`, e);
      return false;
    }
  }

  /* ─── команды ─────────────────────────────────────────────── */

  if (bot) {
    bot.command('start', async (c) => {
      const tgId = c.from?.id;
      if (!tgId) return;

      // Отметка о старте — это и есть разрешение слать пуши в личку.
      // Без неё мини-апп не пускает: иначе не будет канала для уведомлений
      await db.query(
        `insert into users (tg_id, username, started_bot_at, last_seen_at)
         values ($1, $2, now(), now())
         on conflict (tg_id) do update
           set started_bot_at = coalesce(users.started_bot_at, now()),
               username = excluded.username,
               last_seen_at = now()`,
        [tgId, c.from?.username ?? null],
      );
      const row = await db.one<{ id: number }>(
        'select id from users where tg_id = $1',
        [tgId],
      );
      if (row) {
        await db.query(
          'insert into profiles (user_id) values ($1) on conflict do nothing',
          [row.id],
        );
        await ensureWallet(db, row.id);
        await logEvent(db, row.id, 'bot_start', {});
      }

      const intro =
        'Тут вылупляется твоя птица.\n\n' +
        'Отвечаешь на восемь вопросов — получаешь роль. Дальше червяков тебе ' +
        'кидают люди из чата за полезные сообщения, а ты тратишь их на яйца ' +
        'с окрасами.\n\n' +
        'Переписку бот не читает: он видит только команды.';

      // Telegram принимает в web_app только HTTPS. С локальным адресом
      // сообщение с кнопкой не отправится вовсе, поэтому шлём без неё —
      // лучше ответ без кнопки, чем молчание
      if (MINIAPP_URL.startsWith('https://')) {
        await c.reply(intro, {
          reply_markup: {
            inline_keyboard: [[{ text: 'Открыть', web_app: { url: MINIAPP_URL } }]],
          },
        });
      } else {
        await c.reply(
          intro +
            '\n\nПриложение пока крутится локально, кнопки нет: ' +
            'Telegram открывает мини-аппы только по HTTPS.',
        );
      }
    });

    bot.command('mute', async (c) => {
      if (c.chat.type !== 'private' || !c.from?.id) return;
      const userId = await ensurePlayer(c.from.id, c.from.username ?? null);
      await db.query(
        'update users set push_enabled = false, push_misses = 0 where id = $1',
        [userId],
      );
      await c.reply('Ежедневные напоминания выключены. Награды за червяков останутся.');
    });

    bot.command('unmute', async (c) => {
      if (c.chat.type !== 'private' || !c.from?.id) return;
      const userId = await ensurePlayer(c.from.id, c.from.username ?? null);
      await db.query(
        'update users set push_enabled = true, push_misses = 0 where id = $1',
        [userId],
      );
      await c.reply('Ежедневные напоминания включены. Не больше одного в сутки.');
    });

    /**
     * Команда только латиницей.
     *
     * Telegram не принимает кириллические имена команд, и при включённом
     * privacy mode сообщение, не распознанное как bot_command, до бота
     * не доходит вовсе. Кириллический вариант оставлен на случай, если
     * privacy когда-нибудь выключат.
     */
    bot.hears(/^\/(worm|w|червяк)(@\w+)?(\s+([\s\S]+))?$/i, async (c) => {
      const chatId = c.chat?.id;
      const msg = c.message;
      if (!msg || !chatId) return;

      if (c.chat.type === 'private') {
        await c.reply(
          'Червяка кидают в группе: ответь командой /worm на сообщение другого человека.',
        );
        return;
      }
      if (!isMainChat(chatId, MAIN_CHAT_ID)) return;

      const target = msg.reply_to_message;
      const giverTg = c.from?.id;
      if (!giverTg) return;

      // Сообщение с командой убираем сразу, чтобы не засорять чат
      const cleanupMsg = async () => {
        try {
          await c.api.deleteMessage(chatId, msg.message_id);
        } catch {
          // нет прав на удаление — не критично, но админку лучше выдать
        }
      };

      if (!target || !target.from) {
        await cleanupMsg();
        await notify(giverTg, 'В группе ответь /worm на сообщение другого человека.');
        return;
      }

      const receiverTg = target.from.id;
      if (target.from.is_bot || receiverTg === giverTg) {
        await cleanupMsg();
        await notify(
          giverTg,
          receiverTg === giverTg
            ? 'Себе червяка кинуть нельзя.'
            : 'Боту червяка кинуть нельзя.',
        );
        return;
      }

      const reason = (c.match?.[4] ?? '').trim().slice(0, 140) || null;
      const now = new Date();
      const day = today();
      const cfg = config.balance;

      const giver = await ensurePlayer(giverTg, c.from?.username ?? null);
      const receiver = await ensurePlayer(receiverTg, target.from.username ?? null);

      let decision: GrantDecision;
      try {
        decision = await applyWormGrant(db, {
          giver,
          receiver,
          reason,
          targetMessageId: target.message_id,
          day,
          now,
          config: cfg,
        });
      } catch (e) {
        await cleanupMsg();
        console.error('[worm] начисление не удалось:', e);
        await notify(giverTg, 'Не получилось начислить червяка. Попробуй ещё раз позже.');
        return;
      }

      await cleanupMsg();

      if (!decision.ok) {
        await notify(giverTg, REJECTION_TEXT[decision.rejection!]);
        return;
      }

      // Публичная реакция на исходное сообщение — видимая часть механики
      try {
        await c.api.setMessageReaction(chatId, target.message_id, [
          { type: 'emoji', emoji: REACTION as never },
        ]);
      } catch (e) {
        console.warn('[реакция] не удалось поставить:', e);
      }

      await notify(
        receiverTg,
        reason
          ? `Тебе кинули ${decision.value} — «${reason}»`
          : `Тебе кинули ${decision.value}`,
      );
    });

    bot.on('chat_member', async (c) => {
      if (!isMainChat(c.chat.id, MAIN_CHAT_ID)) return;
      const status = c.chatMember.new_chat_member.status;
      const tgId = c.chatMember.new_chat_member.user.id;
      if (['left', 'kicked'].includes(status)) {
        await db.query(
          'update users set is_member = false, member_checked_at = now() where tg_id = $1',
          [tgId],
        );
      }
    });

    bot.catch((error) => {
      console.error('[bot:update] необработанная ошибка:', error.error);
    });
    void bot
      .start({ allowed_updates: ['message', 'chat_member'] })
      .catch((error) => console.error('[bot:polling] остановлен с ошибкой:', error));
    console.log('бот слушает Telegram');
  }

  /* ─── утренняя сводка ─────────────────────────────────────── */

  /**
   * Причины — самое ценное в сводке. Без них там просто цифры,
   * и читать её никто не будет.
   */
  async function postDigest(): Promise<void> {
    const day = today();
    const claimed = await db.query(
      `insert into chat_post_log (game_day) values ($1)
       on conflict (game_day) do nothing returning game_day`,
      [day],
    );
    if (claimed.length === 0) return;

    const top = await db.query<{
      username: string | null;
      total: string | number;
      reasons: string[] | null;
    }>(
      `select u.username,
              sum(g.amount) as total,
              array_remove(array_agg(g.reason order by g.amount desc), null) as reasons
         from worm_grants g join users u on u.id = g.to_user_id
        where g.game_day = $1
        group by u.username
        order by sum(g.amount) desc
        limit 3`,
      [day - 1],
    );

    if (top.length === 0) {
      console.log('[сводка] вчера червяков не кидали, пропускаем');
      return;
    }

    const lines = ['Вчера в стае', ''];
    top.forEach((r, i) => {
      const who = r.username ? `@${r.username}` : 'кто-то';
      lines.push(`${i + 1}. ${who} — ${num(r.total)}`);
      for (const reason of (r.reasons ?? []).slice(0, 2)) {
        lines.push(`   за ${reason}`);
      }
    });

    await post(lines.join('\n'), 'сводка');
  }

  /* ─── анонс редких окрасов ────────────────────────────────── */

  /** Бесплатный контент в чат и главный двигатель гачи. */
  async function announcePulls(): Promise<void> {
    const rows = await db.query<{
      id: number;
      username: string | null;
      title: string;
      rarity: string;
    }>(
      `select p.id, u.username, c.title, c.rarity
         from egg_pulls p
         join users u on u.id = p.user_id
         join colorings c on c.code = p.coloring_code
        where p.announced = false
        order by p.created_at asc limit 5`,
    );

    for (const r of rows) {
      const who = r.username ? `@${r.username}` : 'кто-то';
      const sent = await post(
        r.rarity === 'legendary'
          ? `${who} выбил легендарный окрас «${r.title}»`
          : `${who} выбил редкий окрас «${r.title}»`,
        'анонс',
      );
      if (sent) {
        await db.query('update egg_pulls set announced = true where id = $1', [r.id]);
      }
    }
  }

  async function cleanup(): Promise<void> {
    if (!(await claimCronRun(db, 'cleanup', today()))) return;
    const n = await cleanIdempotency(db);
    console.log(`[уборка] удалено записей идемпотентности: ${n}`);
  }

  async function remindPassive(): Promise<void> {
    const day = today();
    if (!(await claimCronRun(db, 'passive_reminder', day))) return;

    const rows = await db.query<{
      id: number;
      tg_id: string | number;
      quiet_from_hour: number;
      quiet_to_hour: number;
    }>(
      `select u.id, u.tg_id, u.quiet_from_hour, u.quiet_to_hour
         from users u
         join profiles p on p.user_id = u.id
         join wallets w on w.user_id = u.id
        where u.started_bot_at is not null
          and u.is_member = true
          and u.banned_at is null
          and u.push_enabled = true
          and p.hatched_at is not null
          and (w.passive_collected_day is null or w.passive_collected_day <> $1)`,
      [day],
    );

    const hour = new Date().getUTCHours();
    for (const user of rows) {
      if (isQuietHour(hour, user.quiet_from_hour, user.quiet_to_hour)) continue;
      const claimed = await db.query(
        `insert into push_log (user_id, game_day, kind)
         values ($1, $2, 'passive_reminder')
         on conflict (user_id, game_day) do nothing returning id`,
        [user.id, day],
      );
      if (claimed.length === 0) continue;

      const sent = await notify(
        Number(user.tg_id),
        `В гнезде лежат ${config.balance.PASSIVE_WORMS_PER_DAY} червяков. Забери, когда будет удобно.\n\nОтключить напоминания: /mute`,
      );
      if (sent) {
        await db.query('update users set push_misses = 0 where id = $1', [user.id]);
      } else {
        await db.query(
          `update users
              set push_misses = push_misses + 1,
                  push_enabled = case when push_misses + 1 >= 3 then false else push_enabled end
            where id = $1`,
          [user.id],
        );
      }
    }
  }

  /* ─── планировщик ─────────────────────────────────────────── */

  const jobs = [
    { name: 'digest', utcHour: 6 as number | null, everyMin: null as number | null, run: postDigest },
    { name: 'cleanup', utcHour: 2 as number | null, everyMin: null as number | null, run: cleanup },
    { name: 'reminder', utcHour: 15 as number | null, everyMin: null as number | null, run: remindPassive },
    { name: 'announce', utcHour: null as number | null, everyMin: 2 as number | null, run: announcePulls },
  ];

  let lastMinute = -1;

  async function tick(): Promise<void> {
    const now = new Date();
    const minute = now.getUTCMinutes();
    if (minute === lastMinute) return;
    lastMinute = minute;

    for (const job of jobs) {
      try {
        if (job.everyMin !== null) {
          if (minute % job.everyMin === 0) await job.run();
        } else if (now.getUTCHours() === job.utcHour && minute >= 5 && minute < 15) {
          await job.run();
        }
      } catch (e) {
        // Падение одной задачи не должно останавливать остальные
        console.error(`[крон:${job.name}]`, e);
      }
    }
  }

  const timer = setInterval(() => void tick(), 20_000);
  timer.unref?.();

  if (noBot) console.log('крон запущен без бота');

  return {
    async run(name: string) {
      const job = jobs.find((j) => j.name === name);
      if (!job) return false;
      await job.run();
      return true;
    },
    stop() {
      clearInterval(timer);
      void bot?.stop();
    },
  };
}
