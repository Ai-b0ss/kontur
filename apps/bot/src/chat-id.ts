import './env.js';

/**
 * Узнать ID основного чата и проверить настройки бота.
 *
 * Запуск: pnpm -F @kontur/bot chat-id
 *
 * Ничего не меняет — только читает. ID берётся из необработанных апдейтов,
 * поэтому бота надо добавить в чат и написать там что угодно.
 */

const TOKEN = process.env.BOT_TOKEN ?? '';
if (!TOKEN) {
  console.error('BOT_TOKEN не задан в .env');
  process.exit(1);
}

const call = async (method: string, params: Record<string, unknown> = {}) => {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(10_000),
  });
  return res.json() as Promise<{ ok: boolean; result?: unknown; description?: string }>;
};

const me = await call('getMe');
if (!me.ok) {
  console.error('Токен не принят:', me.description);
  process.exit(1);
}

const bot = me.result as {
  id: number;
  username: string;
  first_name: string;
  can_join_groups: boolean;
  can_read_all_group_messages: boolean;
  supports_inline_queries: boolean;
};

console.log(`Бот: @${bot.username} (${bot.first_name}), id ${bot.id}`);
console.log(`  может вступать в группы:      ${yes(bot.can_join_groups)}`);
console.log(
  `  privacy mode:                 ${yes(!bot.can_read_all_group_messages)}` +
    (bot.can_read_all_group_messages
      ? '  ← ВЫКЛЮЧЕН, бот читает всю переписку'
      : '  ← включён, бот видит только команды'),
);
console.log(`  inline-режим:                 ${yes(bot.supports_inline_queries)}`);

const hook = (await call('getWebhookInfo')).result as { url?: string };
console.log(
  `  webhook:                      ${hook?.url ? hook.url : 'не задан (long polling)'}`,
);

const commands = (await call('getMyCommands')).result as { command: string }[];
console.log(
  `  команды:                      ${commands?.length ? commands.map((c) => '/' + c.command).join(', ') : 'не заданы'}`,
);

/* ─── ищем чаты в свежих апдейтах ───────────────────────────── */

const updates = (await call('getUpdates', { limit: 100, timeout: 0 })).result as
  | { message?: { chat: { id: number; title?: string; type: string } } }[]
  | undefined;

const chats = new Map<number, { title: string; type: string }>();
for (const u of updates ?? []) {
  const chat = u.message?.chat;
  if (chat && chat.type !== 'private') {
    chats.set(chat.id, { title: chat.title ?? '—', type: chat.type });
  }
}

console.log('');
if (chats.size === 0) {
  console.log('Групповых чатов в апдейтах нет.');
  console.log('Добавь бота в чат, напиши там любое сообщение и запусти снова.');
} else {
  console.log('Найденные чаты — впиши нужный в MAIN_CHAT_ID:');
  for (const [id, c] of chats) {
    console.log(`  ${id}  ${c.title} (${c.type})`);
    const admin = await call('getChatMember', { chat_id: id, user_id: bot.id });
    const status = (admin.result as { status?: string } | undefined)?.status;
    const rights = admin.result as { can_delete_messages?: boolean } | undefined;
    console.log(`      статус бота: ${status ?? '—'}`);
    console.log(
      `      удаление сообщений: ${yes(Boolean(rights?.can_delete_messages))}` +
        (rights?.can_delete_messages ? '' : '  ← нужно для чистки команд'),
    );
  }
}

function yes(v: boolean): string {
  return v ? 'да' : 'нет';
}
