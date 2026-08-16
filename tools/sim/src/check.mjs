/**
 * Прогон нового флоу по живому API.
 * Запуск: node tools/sim/src/check.mjs   (api поднят в dev)
 */
const API = process.env.KONTUR_API_BASE ?? 'http://localhost:8787/api/v1';
const LOCAL_MODE = process.env.KONTUR_LOCAL_MODE === 'true';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passed++; console.log(`  ✔ ${name}`); }
  else { failed++; console.log(`  ✖ ${name}${detail ? ' — ' + detail : ''}`); }
};

async function call(path, { method = 'GET', body, token } = {}) {
  for (let i = 0; i < 5; i++) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API}${path}`, {
      method, headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const out = { status: res.status, body: text ? JSON.parse(text) : {} };
    if (out.status !== 429) return out;
    console.log('  · ждём окно rate limit');
    await sleep(61_000);
  }
  throw new Error('постоянный 429');
}

const login = async (id) => {
  const r = await call('/auth/telegram', { method: 'POST', body: { initData: `dev:${id}` } });
  if (r.status !== 200) throw new Error(JSON.stringify(r.body));
  return r.body;
};

const ID = 500 + Math.floor(Math.random() * 400);

console.log('\n── Вход и онбординг ────────────────────────────────');

const me = await login(ID);
const T = me.token;
check('вход без регистрации по initData', me.state.player.userId > 0);
check('птица ещё не вылупилась', me.state.hatched === false);
check('роли пока нет', me.state.player.role === null);
check('яйца закрыты до вылупления', me.state.egg === null);
check('сервер сообщает доступные функции',
  me.state.features?.eggs === true && me.state.features?.community === true);

const q = await call('/questions', { token: T });
check('вопросов ровно восемь', q.body.questions?.length === 8);
check('у каждого есть варианты',
  q.body.questions.every((x) => Array.isArray(x.options) && x.options.length >= 3));

const badAnswers = await call('/onboarding/hatch', {
  method: 'POST', token: T,
  body: { answers: [0, 1], clientRequestId: crypto.randomUUID() },
});
check('неполные ответы отклоняются', badAnswers.status === 400, JSON.stringify(badAnswers.body));

const answers = q.body.questions.map(() => 0);
const rid = crypto.randomUUID();
const hatch = await call('/onboarding/hatch', {
  method: 'POST', token: T, body: { answers, birdName: 'Клюв', clientRequestId: rid },
});
check('вылупление проходит', hatch.status === 200, JSON.stringify(hatch.body));
check('роль пришла с сервера', typeof hatch.body.role === 'string');
check('есть подпись роли', typeof hatch.body.roleTagline === 'string');
check('есть готовый текст для чата', typeof hatch.body.shareText === 'string');
check('имя птицы сохранилось', hatch.body.state.player.birdName === 'Клюв');
check('после вылупления открылись яйца', hatch.body.state.egg !== null);
check('до реального действия золотых перьев нет', hatch.body.state.player.signalCount === 0);

const again = await call('/onboarding/hatch', {
  method: 'POST', token: T, body: { answers, clientRequestId: rid },
});
check('повтор с тем же clientRequestId даёт тот же результат',
  again.status === 200 && again.body.role === hatch.body.role);

const secondHatch = await call('/onboarding/hatch', {
  method: 'POST', token: T,
  body: { answers, clientRequestId: crypto.randomUUID() },
});
check('второе вылупление запрещено — роль не меняется никогда',
  secondHatch.body.error?.code === 'ALREADY_HATCHED', JSON.stringify(secondHatch.body));

console.log('\n── Две валюты ──────────────────────────────────────');

let st = (await call('/state', { token: T })).body;
const wallet0 = st.player.wallet;
const rep0 = st.player.reputation;

const passive = await call('/passive/collect', {
  method: 'POST', token: T, body: { clientRequestId: crypto.randomUUID() },
});
if (LOCAL_MODE) {
  check('LOCAL MVP блокирует бесплатный ежедневный faucet',
    passive.status === 409 && passive.body.error?.details?.reason === 'local_passive_disabled',
    JSON.stringify(passive.body));
} else {
  check('пассив собирается', passive.status === 200, JSON.stringify(passive.body));
  check('пассив идёт в кошелёк', passive.body.state.player.wallet > wallet0);
  check('пассив НЕ растит репутацию — её дают только люди',
    passive.body.state.player.reputation === rep0,
    `${rep0} → ${passive.body.state.player.reputation}`);

  const passiveAgain = await call('/passive/collect', {
    method: 'POST', token: T, body: { clientRequestId: crypto.randomUUID() },
  });
  check('второй сбор за сутки отклоняется',
    passiveAgain.body.error?.code === 'NOTHING_TO_COLLECT');
}

const giver = await login(ID + 1);
const recv = await call('/dev/receive', {
  method: 'POST', token: T,
  body: { fromUserId: giver.state.player.userId, amount: 3, reason: 'разбор задачи' },
});
check('червяк от человека принят', recv.status === 200 && recv.body.created === true);

st = (await call('/state', { token: T })).body;
check('червяк от человека растит и репутацию', st.player.reputation === rep0 + 3,
  `${rep0} → ${st.player.reputation}`);

const duplicateReceive = await call('/dev/receive', {
  method: 'POST', token: T,
  body: { fromUserId: giver.state.player.userId, amount: 3, reason: 'дубликат' },
});
const afterDuplicate = (await call('/state', { token: T })).body;
check('повтор dev-grant не начисляет валюту второй раз',
  duplicateReceive.body.created === false && afterDuplicate.player.reputation === st.player.reputation);

console.log('\n── Яйца ────────────────────────────────────────────');

await call('/dev/grant-worms', { method: 'POST', token: T, body: { amount: 200 } });
st = (await call('/state', { token: T })).body;

const before = st.player.wallet;
const egg = await call('/egg/open', {
  method: 'POST', token: T, body: { clientRequestId: crypto.randomUUID() },
});
check('яйцо открывается', egg.status === 200, JSON.stringify(egg.body));
check('окрас пришёл', typeof egg.body.coloring === 'string');
check('кошелёк уменьшился', egg.body.state.player.wallet < before);
check('репутация от яйца не меняется',
  egg.body.state.player.reputation === st.player.reputation);

const colorings = await call('/colorings', { token: T });
check('каталог окрасов отдаётся', colorings.body.colorings?.length >= 10);
check('есть легендарные', colorings.body.colorings.some((c) => c.rarity === 'legendary'));

const locked = colorings.body.colorings.find((c) => !c.owned);
if (locked) {
  const eq = await call('/coloring/equip', { method: 'POST', token: T, body: { code: locked.code } });
  check('надеть невыпавший окрас нельзя', eq.body.error?.code === 'COLORING_LOCKED');
}

const ownedOne = colorings.body.colorings.find((c) => c.owned);
const eqOk = await call('/coloring/equip', { method: 'POST', token: T, body: { code: ownedOne.code } });
check('свой окрас надевается', eqOk.status === 200);

const poor = await login(ID + 2);
await call('/onboarding/hatch', {
  method: 'POST', token: poor.token,
  body: { answers, clientRequestId: crypto.randomUUID() },
});
const noMoney = await call('/egg/open', {
  method: 'POST', token: poor.token, body: { clientRequestId: crypto.randomUUID() },
});
check('без червяков яйцо не открыть',
  noMoney.body.error?.code === 'NOT_ENOUGH_WORMS', JSON.stringify(noMoney.body));

console.log('\n── Мост в реальность ───────────────────────────────');

const signals0 = await call('/signals', { token: T });
check('список сигнал-карт сначала пуст',
  signals0.status === 200 && signals0.body.feathers === 0 && signals0.body.cards.length === 0);

const signalKey = `sim-project-${ID}`;
const signal = await call('/dev/grant-signal', {
  method: 'POST', token: T,
  body: { kind: 'own_project', title: 'Проект прошёл ревью', referenceCode: signalKey },
});
check('подтверждённое действие выдаёт сигнал-карту',
  signal.status === 200 && signal.body.created === true, JSON.stringify(signal.body));

const signalAgain = await call('/dev/grant-signal', {
  method: 'POST', token: T,
  body: { kind: 'own_project', title: 'Дубликат', referenceCode: signalKey },
});
check('повторная выдача с тем же ключом идемпотентна',
  signalAgain.status === 200 && signalAgain.body.created === false);

const signals1 = await call('/signals', { token: T });
check('карта видна в портфолио игрока',
  signals1.body.feathers === 1 &&
  signals1.body.cards[0]?.title === 'Проект прошёл ревью' &&
  signals1.body.cards[0]?.kind === 'own_project');

st = (await call('/state', { token: T })).body;
check('золотое перо входит в состояние игрока', st.player.signalCount === 1);

console.log('\n── Сообщество и гнездо ─────────────────────────────');

const comm = await call('/community', { token: T });
check('рейтинг отдаётся', Array.isArray(comm.body.ranking));
check('окно недельное, а не за всё время', comm.body.windowDays === 7);
check('вылупившиеся попали в стаю', comm.body.totalInFlock >= 2);
check('своя позиция известна', comm.body.myPosition > 0);
check('стая показывает нефамящийся статус',
  comm.body.ranking.find((m) => m.isMe)?.signals === 1);

const nest = await call('/nest', { token: T });
check('лента гнезда отдаётся', Array.isArray(nest.body.entries));
check('в ленте виден червяк с причиной',
  nest.body.entries.some((e) => e.reason === 'разбор задачи'),
  JSON.stringify(nest.body.entries.slice(0, 2)));

const visitOk = await call(`/visit/${poor.state.player.userId}`, {
  method: 'POST', token: T, body: {},
});
check('в существующее гнездо можно зайти', visitOk.status === 200);

const visitMissing = await call('/visit/999999999', {
  method: 'POST', token: T, body: {},
});
check('несуществующее гнездо даёт штатный 404, а не 500',
  visitMissing.status === 404 && visitMissing.body.error?.code === 'PLAYER_NOT_FOUND');

let lastRankUser;
for (let i = 0; i < 22; i++) {
  const extra = await login(ID + 20 + i);
  await call('/onboarding/hatch', {
    method: 'POST', token: extra.token,
    body: { answers, clientRequestId: crypto.randomUUID() },
  });
  lastRankUser = extra;
}
const outsideTop = await call('/community', { token: lastRankUser.token });
check('своя строка остаётся видна за пределами топ-20',
  outsideTop.body.myPosition > 20 &&
  outsideTop.body.ranking.some((member) => member.isMe && member.position === outsideTop.body.myPosition));

console.log('\n── Защита ──────────────────────────────────────────');

const noAuth = await call('/state');
check('без токена — 401, а не 500', noAuth.status === 401);

const notHatched = await login(ID + 3);
const eggLocked = await call('/egg/open', {
  method: 'POST', token: notHatched.token, body: { clientRequestId: crypto.randomUUID() },
});
check('невылупившийся не может открыть яйцо',
  eggLocked.body.error?.code === 'NOT_HATCHED', JSON.stringify(eggLocked.body));

console.log(`\n${passed} прошло, ${failed} провалено\n`);
process.exit(failed > 0 ? 1 : 0);
