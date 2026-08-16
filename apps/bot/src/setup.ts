import './env.js';

/**
 * Настройка бота через API: команды, описание, кнопка меню с мини-аппом.
 *
 * Запуск: pnpm -F @kontur/bot setup
 *
 * Идемпотентно — можно гонять сколько угодно раз.
 * Privacy mode через Bot API не переключается: это делается у @BotFather
 * (/setprivacy). Скрипт только сообщает текущее состояние.
 */

const TOKEN = process.env.BOT_TOKEN ?? '';
const MINIAPP_URL = process.env.MINIAPP_URL ?? '';

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
  const body = (await res.json()) as {
    ok: boolean;
    result?: unknown;
    description?: string;
  };
  if (!body.ok) console.warn(`  ${method}: ${body.description}`);
  return body;
};

const me = await call('getMe');
if (!me.ok) {
  console.error('Токен не принят');
  process.exit(1);
}
const bot = me.result as { username: string; can_read_all_group_messages: boolean };
console.log(`Настраиваю @${bot.username}\n`);

/* ─── команды ───────────────────────────────────────────────── */

// Только латиница: Telegram отклоняет кириллические имена команд
// (BOT_COMMAND_INVALID), и, что важнее, при включённом privacy mode
// не распознанное как команда сообщение до бота вообще не доходит
await call('setMyCommands', {
  commands: [
    { command: 'worm', description: 'кинуть червяка — ответь на сообщение' },
    { command: 'w', description: 'то же, но короче' },
  ],
  scope: { type: 'all_group_chats' },
  language_code: 'ru',
});
console.log('  команды в группах: /worm, /w');

await call('setMyCommands', {
  commands: [
    { command: 'start', description: 'открыть приложение' },
    { command: 'mute', description: 'выключить ежедневные напоминания' },
    { command: 'unmute', description: 'включить ежедневные напоминания' },
  ],
  scope: { type: 'all_private_chats' },
  language_code: 'ru',
});
console.log('  команды в личке:   /start, /mute, /unmute');

/* ─── тексты ────────────────────────────────────────────────── */

await call('setMyDescription', {
  description:
    'Тут вылупляется твоя птица. Отвечаешь на восемь вопросов — получаешь роль. ' +
    'Дальше червяков тебе кидают люди из чата за полезные сообщения, ' +
    'а ты тратишь их на яйца с окрасами. Переписку бот не читает.',
  language_code: 'ru',
});
await call('setMyShortDescription', {
  short_description: 'Птица, червяки от своих и яйца с окрасами',
  language_code: 'ru',
});
console.log('  описание задано');

/* ─── кнопка меню с мини-аппом ──────────────────────────────── */

if (MINIAPP_URL.startsWith('https://')) {
  await call('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: 'Гнездо',
      web_app: { url: MINIAPP_URL },
    },
  });
  console.log(`  кнопка меню → ${MINIAPP_URL}`);
} else {
  console.log(
    `  кнопка меню пропущена: Telegram принимает только https, а сейчас ${MINIAPP_URL || 'пусто'}`,
  );
}

/* ─── что осталось руками ───────────────────────────────────── */

console.log('\nОсталось сделать у @BotFather и в чате:');
if (bot.can_read_all_group_messages) {
  console.log('  ! privacy mode ВЫКЛЮЧЕН — включить: /setprivacy → Enable');
  console.log('    иначе бот читает всю переписку, а это лишнее и людям тревожно');
} else {
  console.log('  privacy mode включён — бот видит только команды');
}
console.log('  добавить бота в основной чат и выдать админку');
console.log('    нужны права: удаление сообщений (чистка команд) и реакции');
console.log('  узнать ID чата: pnpm -F @kontur/bot chat-id → вписать в MAIN_CHAT_ID');
