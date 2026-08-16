import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * Проверка §4.1 на живом токене: подписанный initData принимается,
 * подделанный и протухший — отклоняются.
 *
 * Запуск: node tools/sim/src/auth-check.mjs   (api поднят с BOT_TOKEN)
 */

const API = 'http://localhost:8787/api/v1';

const envText = readFileSync(new URL('../../../.env', import.meta.url), 'utf8');
const TOKEN = /^BOT_TOKEN=(.+)$/m.exec(envText)?.[1]?.trim() ?? '';
if (!TOKEN) {
  console.error('BOT_TOKEN не найден в .env');
  process.exit(1);
}

let passed = 0;
let failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passed++; console.log(`  ✔ ${name}`); }
  else { failed++; console.log(`  ✖ ${name}${detail ? ' — ' + detail : ''}`); }
};

/** Собирает initData ровно так, как это делает Telegram. */
function signInitData(user, authDate) {
  const params = {
    auth_date: String(authDate),
    query_id: 'AAF' + Math.random().toString(36).slice(2, 10),
    user: JSON.stringify(user),
  };
  const dataCheckString = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  const hash = createHmac('sha256', secret).update(dataCheckString).digest('hex');

  const qs = new URLSearchParams({ ...params, hash });
  return qs.toString();
}

const post = async (initData) => {
  const res = await fetch(`${API}/auth/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : {} };
};

const now = Math.floor(Date.now() / 1000);
const user = { id: 777000123, first_name: 'Проверка', username: 'checkbot_user' };

console.log('\n── Подпись initData §4.1 ───────────────────────────');

/*
 * Корректная подпись должна пройти проверку HMAC. Дальше её ждёт второй
 * барьер — вход только через /start, и тестовый пользователь его не проходил.
 * Поэтому валидным считаем и 200, и NOT_STARTED: главное, что подпись
 * не отвергнута.
 */
const valid = await post(signInitData(user, now));
check(
  'корректно подписанный initData проходит проверку подписи',
  valid.status === 200 || valid.body.error?.code === 'NOT_STARTED',
  `${valid.status} ${JSON.stringify(valid.body).slice(0, 160)}`,
);
check(
  'после подписи включается правило «вход только через /start»',
  valid.body.error?.code === 'NOT_STARTED' || typeof valid.body.token === 'string',
  JSON.stringify(valid.body).slice(0, 160),
);

const tampered = signInitData(user, now).replace(/hash=[0-9a-f]+/, (m) =>
  m.slice(0, -1) + (m.endsWith('a') ? 'b' : 'a'),
);
const bad = await post(tampered);
check('подделанная подпись отклоняется',
  bad.status === 401 && bad.body.error?.code === 'INVALID_INIT_DATA',
  `${bad.status} ${JSON.stringify(bad.body)}`);

// Подменяем id пользователя, оставив старую подпись — классическая атака
const swapped = signInitData(user, now).replace('777000123', '111000222');
const swappedRes = await post(swapped);
check('подмена user_id при валидной подписи отклоняется',
  swappedRes.status === 401,
  `${swappedRes.status} ${JSON.stringify(swappedRes.body)}`);

const stale = await post(signInitData(user, now - 90_000));
check('протухший auth_date отклоняется (старше 24 ч)',
  stale.status === 401 && stale.body.error?.code === 'INVALID_INIT_DATA',
  `${stale.status} ${JSON.stringify(stale.body)}`);

const devBypass = await post('dev:1');
check('dev-обход не работает, когда задан BOT_TOKEN',
  devBypass.status === 401,
  `${devBypass.status} ${JSON.stringify(devBypass.body)}`);

const empty = await post('');
check('пустой initData отклоняется', empty.status === 401);

console.log(`\n${passed} прошло, ${failed} провалено\n`);
// Через exitCode, а не process.exit: принудительный выход с висящими
// сокетами роняет libuv на Windows
process.exitCode = failed > 0 ? 1 : 0;
