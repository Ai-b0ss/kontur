import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..', '..');
const workerDir = join(root, 'apps', 'worker');
const require = createRequire(join(workerDir, 'package.json'));
const wrangler = require.resolve('wrangler');
const pnpm = process.env.npm_execpath;
const temp = await mkdtemp(join(tmpdir(), 'kontur-worker-check-'));
const port = 19_000 + Math.floor(Math.random() * 800);
const origin = `http://127.0.0.1:${port}`;
const API = `${origin}/api/v1`;
const MAIN_CHAT_ID = -100123456789;
const WEBHOOK_SECRET = 'worker-check-webhook';
const V2_TG_ID = 940001;
const V3_TG_ID = 950001;
const V4_TG_ID = 960001;
const V4_PREDICTOR_TG_ID = 960002;
const V4_FLIGHT_TG_IDS = [960010, 960011, 960012, 960013];
const V4_FLIGHT_WAIT_TG_ID = 960014;
const V4_FLIGHT_ROUTE_TG_ID = 960015;
const output = [];

function runNode(args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: options.cwd ?? root,
      env: options.env ?? process.env,
      stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let text = '';
    child.stdout?.on('data', (chunk) => { text += chunk; });
    child.stderr?.on('data', (chunk) => { text += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => code === 0
      ? resolveRun(text)
      : reject(new Error(`Команда завершилась с кодом ${code}:\n${text.slice(-4_000)}`)));
  });
}

async function api(path, { method = 'GET', body, token, headers = {} } = {}) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = {};
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = text; }
  }
  return { status: response.status, body: parsed };
}

async function login(tgId) {
  const result = await api('/api/v1/auth/telegram', {
    method: 'POST', body: { initData: `dev:${tgId}` },
  });
  if (result.status !== 200) throw new Error(`Не удалось войти как ${tgId}: ${JSON.stringify(result.body)}`);
  return result.body;
}

async function hatch(session) {
  const questions = await api('/api/v1/questions', { token: session.token });
  const answers = questions.body.questions.map(() => 0);
  const result = await api('/api/v1/onboarding/hatch', {
    method: 'POST', token: session.token,
    body: { answers, clientRequestId: crypto.randomUUID() },
  });
  if (result.status !== 200) throw new Error(`Не удалось вылупить тестовую птицу: ${JSON.stringify(result.body)}`);
}

function solveZeroSeasonQuestions(questions) {
  return questions.map((question) => {
    if (question.id.startsWith('p-')) {
      const [, price, discount] = /Цена (\d+)\. Скидка (\d+)%/.exec(question.prompt) ?? [];
      const value = Number(price) * (100 - Number(discount)) / 100;
      return question.options.indexOf(String(value));
    }
    if (question.id.startsWith('c-')) {
      const [, people, each] = /(\d+) человека делают по (\d+)/.exec(question.prompt) ?? [];
      return question.options.indexOf(String(Number(people) * Number(each)));
    }
    if (question.id.startsWith('r-')) {
      const [, oldRate, newRate] = /с (\d+)% до (\d+)%/.exec(question.prompt) ?? [];
      return question.options.indexOf(`${Math.round((Number(newRate) / Number(oldRate) - 1) * 100)}%`);
    }
    if (question.id.startsWith('o-')) return question.options.indexOf('A → B → C');
    return question.options.findIndex((option) => /Проверить границу|Сделать одно основное|Сказать, что связь|Сначала снять блокировку/.test(option));
  });
}

function telegramUpdate(updateId, giverId, targetId) {
  return {
    update_id: updateId,
    message: {
      message_id: 20_000 + updateId,
      from: { id: giverId, username: `giver${giverId}` },
      chat: { id: MAIN_CHAT_ID, type: 'supergroup' },
      text: '/worm за полезный ответ',
      reply_to_message: {
        message_id: 10_000 + updateId,
        from: { id: targetId, username: `target${targetId}` },
      },
    },
  };
}

function v2HelpUpdate(updateId, requesterId, helperId) {
  return {
    update_id: updateId,
    message: {
      message_id: 30_000 + updateId,
      from: { id: requesterId, username: `requester${requesterId}` },
      chat: { id: MAIN_CHAT_ID, type: 'supergroup' },
      text: '/worm',
      reply_to_message: {
        message_id: 20_000 + updateId,
        from: { id: helperId, username: `helper${helperId}` },
        reply_to_message: {
          message_id: 10_000 + updateId,
          from: { id: requesterId, username: `requester${requesterId}` },
        },
      },
    },
  };
}

let worker;
let flow;
try {
  if (!pnpm) throw new Error('npm_execpath не задан: запускайте проверку через pnpm cf:test');
  await runNode([pnpm, '-F', '@kontur/miniapp', 'build']);
  await runNode([
    wrangler, 'd1', 'migrations', 'apply', 'kontur', '--local', '--persist-to', temp,
  ], { cwd: workerDir });
  await runNode([
    wrangler, 'd1', 'execute', 'kontur', '--local', '--persist-to', temp,
    '--command',
    `INSERT INTO pilot_chats
       (code,title,purpose,kind,telegram_chat_id,active,position)
     VALUES ('general','Общий чат','Первый вопрос и общая навигация','general',${MAIN_CHAT_ID},1,1)`,
  ], { cwd: workerDir });

  worker = spawn(process.execPath, [
    wrangler, 'dev', '--local', '--port', String(port), '--persist-to', temp,
    '--show-interactive-dev-session', 'false',
    '--var', 'DEV_MODE:true',
    '--var', 'JWT_SECRET:worker-check-local-only',
    '--var', `MINIAPP_URL:${origin}`,
    '--var', `MAIN_CHAT_ID:${MAIN_CHAT_ID}`,
    '--var', `WEBHOOK_SECRET:${WEBHOOK_SECRET}`,
    '--var', 'ADMIN_SECRET:worker-check-admin',
    '--var', 'EXPERIENCE_V2_ENABLED:true',
    '--var', `EXPERIENCE_V2_USER_IDS:${V2_TG_ID}`,
    '--var', 'EXPERIENCE_V3_ENABLED:true',
    '--var', `EXPERIENCE_V3_USER_IDS:${V3_TG_ID}`,
    '--var', 'ZERO_SEASON_ENABLED:true',
    '--var', 'ZERO_SEASON_USER_IDS:999999',
  ], {
    cwd: workerDir,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  worker.stdout.on('data', (chunk) => output.push(chunk.toString()));
  worker.stderr.on('data', (chunk) => output.push(chunk.toString()));

  const deadline = Date.now() + 30_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (worker.exitCode !== null) break;
    try {
      const response = await fetch(`${API}/health`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) { ready = true; break; }
    } catch { /* Worker ещё стартует. */ }
    await delay(150);
  }
  if (!ready) throw new Error('Cloudflare Worker не поднялся:\n' + output.join('').slice(-6_000));

  const staticPage = await fetch(origin);
  if (!staticPage.ok || !(await staticPage.text()).includes('<div id="root">')) {
    throw new Error('Worker не отдаёт собранную Mini App');
  }
  console.log('  ✔ Worker отдаёт Mini App с того же домена');

  flow = spawn(process.execPath, [join(here, 'check.mjs')], {
    cwd: root,
    env: { ...process.env, KONTUR_API_BASE: API, KONTUR_LOCAL_MODE: 'true' },
    stdio: 'inherit',
    windowsHide: true,
  });
  const flowCode = await new Promise((resolveCode, reject) => {
    flow.once('error', reject);
    flow.once('exit', (value) => resolveCode(value ?? 1));
  });
  if (flowCode !== 0) throw new Error(`Worker API flow завершился с кодом ${flowCode}`);

  const localSession = await login(970001);
  const localInitial = await api('/api/v4/local/state', { token: localSession.token });
  const localQuestions = await api('/api/v4/local/questions', { token: localSession.token });
  if (localInitial.status !== 200 || localInitial.body.state?.hatched !== false ||
      localInitial.body.state?.features?.passive !== false || localInitial.body.state?.features?.community !== false ||
      localQuestions.status !== 200 || localQuestions.body.questions?.length !== 8) {
    throw new Error(`LOCAL MVP initial state неверен: ${JSON.stringify({ localInitial, localQuestions })}`);
  }
  const localHatch = await api('/api/v4/local/hatch', {
    method: 'POST', token: localSession.token,
    body: { answers: localQuestions.body.questions.map(() => 0), clientRequestId: 'local-hatch-0001' },
  });
  if (localHatch.status !== 200 || !localHatch.body.state?.hatched || localHatch.body.state?.egg?.cost !== 5) {
    throw new Error(`LOCAL MVP hatch неверен: ${JSON.stringify(localHatch)}`);
  }
  await api('/api/v1/dev/grant-worms', { method: 'POST', token: localSession.token, body: { amount: 5 } });
  const localBeforeEgg = await api('/api/v4/local/state', { token: localSession.token });
  const localEgg = await api('/api/v4/local/egg/open', {
    method: 'POST', token: localSession.token, body: { clientRequestId: 'local-egg-0001' },
  });
  const localEggReplay = await api('/api/v4/local/egg/open', {
    method: 'POST', token: localSession.token, body: { clientRequestId: 'local-egg-0001' },
  });
  if (localEgg.status !== 200 || localEgg.body.duplicate !== false ||
      localEgg.body.state?.player?.wallet !== localBeforeEgg.body.state.player.wallet - 5 ||
      localEggReplay.status !== 200 || localEggReplay.body.coloring !== localEgg.body.coloring ||
      localEggReplay.body.state?.player?.wallet !== localEgg.body.state.player.wallet) {
    throw new Error(`LOCAL MVP egg/idempotency неверны: ${JSON.stringify({ localBeforeEgg, localEgg, localEggReplay })}`);
  }
  const localEquip = await api('/api/v4/local/coloring/equip', {
    method: 'POST', token: localSession.token, body: { code: localEgg.body.coloring },
  });
  const localReload = await api('/api/v4/local/state', { token: localSession.token });
  if (localEquip.status !== 200 || localReload.body.state?.player?.coloring !== localEgg.body.coloring ||
      !localReload.body.colorings?.find((item) => item.code === localEgg.body.coloring)?.equipped) {
    throw new Error(`LOCAL MVP equip/reload неверен: ${JSON.stringify({ localEquip, localReload })}`);
  }
  console.log('  ✔ LOCAL MVP: 8Q → птица → яйцо 5 → идемпотентность → окрас → reload');

  const v2Session = await login(V2_TG_ID);
  const initialV2 = await api('/api/v2/state', { token: v2Session.token });
  if (initialV2.status !== 200 || initialV2.body.version !== 'v2' ||
      initialV2.body.profile !== null || initialV2.body.chats?.length !== 1) {
    throw new Error(`Начальное состояние v2 неверно: ${JSON.stringify(initialV2)}`);
  }
  const archivedWrite = await api('/api/v1/passive/collect', {
    method: 'POST', token: v2Session.token,
    body: { clientRequestId: 'v2-legacy-write-0001' },
  });
  if (archivedWrite.status !== 409 || archivedWrite.body.error?.details?.reason !== 'legacy_archive_read_only') {
    throw new Error(`Архив прежней версии допускает запись: ${JSON.stringify(archivedWrite)}`);
  }

  const startWithoutChat = await api('/api/v2/journey/start', {
    method: 'POST', token: v2Session.token,
    body: { intent: 'ask', clientRequestId: 'v2-no-chat-start-0001' },
  });
  if (startWithoutChat.status !== 400 || startWithoutChat.body.error?.code !== 'VALIDATION') {
    throw new Error(`Вопрос без сообщества не отклонён: ${JSON.stringify(startWithoutChat)}`);
  }

  const startBody = {
    intent: 'ask', chatCode: 'general', client: 'desktop',
    clientRequestId: 'v2-journey-start-0001',
  };
  const started = await api('/api/v2/journey/start', {
    method: 'POST', token: v2Session.token, body: startBody,
  });
  if (started.status !== 200 || started.body.profile?.stage !== 'looking' ||
      started.body.activeJourney?.status !== 'started') {
    throw new Error(`Старт v2 не сработал: ${JSON.stringify(started)}`);
  }
  const repeatedStart = await api('/api/v2/journey/start', {
    method: 'POST', token: v2Session.token, body: startBody,
  });
  if (repeatedStart.status !== 200 ||
      repeatedStart.body.activeJourney?.id !== started.body.activeJourney?.id) {
    throw new Error(`Повтор старта создал новый путь: ${JSON.stringify(repeatedStart)}`);
  }

  const prepared = await api('/api/v2/journey/prepared', {
    method: 'POST', token: v2Session.token,
    body: { client: 'desktop', clientRequestId: 'v2-journey-prepared-0001' },
  });
  if (prepared.status !== 200 || prepared.body.activeJourney?.status !== 'prepared') {
    throw new Error(`Подготовка вопроса v2 не сработала: ${JSON.stringify(prepared)}`);
  }
  const published = await api('/api/v2/journey/published', {
    method: 'POST', token: v2Session.token,
    body: {
      chatCode: 'general', messageId: 501, client: 'desktop',
      clientRequestId: 'v2-journey-published-0001',
    },
  });
  if (published.status !== 200 || published.body.profile?.stage !== 'thread' ||
      published.body.activeJourney?.status !== 'published') {
    throw new Error(`Публикация v2 не сработала: ${JSON.stringify(published)}`);
  }
  const unprovenHelp = await api('/api/v2/journey/outcome', {
    method: 'POST', token: v2Session.token,
    body: { outcome: 'helped', clientRequestId: 'v2-unproven-help-0001' },
  });
  if (unprovenHelp.status !== 400 || unprovenHelp.body.error?.code !== 'VALIDATION') {
    throw new Error(`Неподтверждённая помощь принята: ${JSON.stringify(unprovenHelp)}`);
  }
  const helperSession = await login(V2_TG_ID + 100);
  const helpUpdate = v2HelpUpdate(7_001, V2_TG_ID, V2_TG_ID + 100);
  const helpWebhook = await api('/telegram/webhook', {
    method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET },
    body: helpUpdate,
  });
  const repeatedHelpWebhook = await api('/telegram/webhook', {
    method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET },
    body: helpUpdate,
  });
  const outcome = await api('/api/v2/state', { token: v2Session.token });
  const helperLegacyState = await api('/api/v1/state', { token: helperSession.token });
  if (helpWebhook.status !== 200 || repeatedHelpWebhook.status !== 200 ||
      outcome.body.activeJourney?.status !== 'helped' ||
      helperLegacyState.body.player?.wallet !== 0 || helperLegacyState.body.player?.reputation !== 0) {
    throw new Error(`Telegram-подтверждение v2 неверно: ${JSON.stringify({ helpWebhook, repeatedHelpWebhook, outcome, helperLegacyState })}`);
  }

  const journeyId = outcome.body.activeJourney.id;
  const saved = await api('/api/v2/nest/save', {
    method: 'POST', token: v2Session.token,
    body: {
      journeyId, label: 'Правила гранта', status: 'helped',
      nextStep: 'Проверить срок', clientRequestId: 'v2-nest-save-0001',
    },
  });
  if (saved.status !== 200 || saved.body.profile?.stage !== 'nest' || saved.body.nest?.length !== 1) {
    throw new Error(`Гнездо v2 не сохранилось: ${JSON.stringify(saved)}`);
  }
  const nestId = saved.body.nest[0].id;
  const reminded = await api(`/api/v2/nest/${nestId}/reminder`, {
    method: 'POST', token: v2Session.token,
    body: { enabled: true, clientRequestId: 'v2-reminder-enable-0001' },
  });
  const repeatedReminder = await api(`/api/v2/nest/${nestId}/reminder`, {
    method: 'POST', token: v2Session.token,
    body: { enabled: true, clientRequestId: 'v2-reminder-enable-0001' },
  });
  if (reminded.body.nest?.[0]?.reminderStatus !== 'pending' ||
      repeatedReminder.body.nest?.[0]?.reminderStatus !== 'pending') {
    throw new Error(`Явное согласие на одно напоминание не сохранилось: ${JSON.stringify({ reminded, repeatedReminder })}`);
  }
  const reminderCron = await api('/api/v1/dev/cron', {
    method: 'POST', body: { cron: '0 15 * * *', dueJourneyReminders: true },
  });
  const repeatedReminderCron = await api('/api/v1/dev/cron', {
    method: 'POST', body: { cron: '0 15 * * *' },
  });
  if (reminderCron.body.reminders?.[0]?.status !== 'sent' ||
      Number(reminderCron.body.reminders?.[0]?.count) !== 1 ||
      repeatedReminderCron.body.reminders?.[0]?.status !== 'sent' ||
      Number(repeatedReminderCron.body.reminders?.[0]?.count) !== 1) {
    throw new Error(`Одноразовое напоминание сработало неверно: ${JSON.stringify({ reminderCron, repeatedReminderCron })}`);
  }
  const nextStep = await api(`/api/v2/nest/${nestId}/next-step`, {
    method: 'POST', token: v2Session.token,
    body: { nextStep: 'Отправить документ', clientRequestId: 'v2-next-step-0001' },
  });
  if (nextStep.status !== 200 || nextStep.body.nest?.[0]?.nextStep !== 'Отправить документ') {
    throw new Error(`Следующий шаг v2 не обновился: ${JSON.stringify(nextStep)}`);
  }
  const repeatedNextStep = await api(`/api/v2/nest/${nestId}/next-step`, {
    method: 'POST', token: v2Session.token,
    body: { nextStep: 'Отправить документ', clientRequestId: 'v2-next-step-0001' },
  });
  if (repeatedNextStep.status !== 200 || repeatedNextStep.body.nest?.length !== 1) {
    throw new Error(`Повтор следующего шага v2 неидемпотентен: ${JSON.stringify(repeatedNextStep)}`);
  }
  const deleted = await api(`/api/v2/nest/${nestId}/delete`, {
    method: 'POST', token: v2Session.token,
    body: { clientRequestId: 'v2-nest-delete-0001' },
  });
  if (deleted.status !== 200 || deleted.body.nest?.length !== 0) {
    throw new Error(`Удаление из гнезда v2 не сработало: ${JSON.stringify(deleted)}`);
  }

  const legacyState = await api('/api/v1/state', { token: v2Session.token });
  if (legacyState.status !== 200 || legacyState.body.hatched !== false || legacyState.body.player?.wallet !== 0) {
    throw new Error(`Новый путь изменил старое состояние: ${JSON.stringify(legacyState)}`);
  }
  const outsideSession = await login(V2_TG_ID + 1);
  const outsideV2 = await api('/api/v2/state', { token: outsideSession.token });
  if (outsideV2.status !== 404 || outsideV2.body.error?.code !== 'EXPERIENCE_DISABLED') {
    throw new Error(`Список доступа v2 не закрыт: ${JSON.stringify(outsideV2)}`);
  }
  console.log('  ✔ новый API и записанный Telegram-путь проходят до гнезда без старой валюты');
  console.log('  ✔ архив закрыт для записи, доступ ограничен списком, напоминание одноразовое');

  const v3Session = await login(V3_TG_ID);
  const initialV3 = await api('/api/v3/state', { token: v3Session.token });
  if (initialV3.status !== 200 || initialV3.body.version !== 'v3' ||
      initialV3.body.game?.hatched !== false || initialV3.body.opportunities?.length !== 4) {
    throw new Error(`Начальное состояние v3 неверно: ${JSON.stringify(initialV3)}`);
  }
  const beforeHatch = await api('/api/v3/actions', {
    method: 'POST', token: v3Session.token,
    body: {
      kind: 'ask', status: 'planned', title: 'Задать вопрос',
      clientRequestId: 'v3-before-hatch-0001',
    },
  });
  if (beforeHatch.status !== 409 || beforeHatch.body.error?.code !== 'NOT_HATCHED') {
    throw new Error(`V3 допустил действие до теста: ${JSON.stringify(beforeHatch)}`);
  }
  await hatch(v3Session);
  const passiveV3 = await api('/api/v1/passive/collect', {
    method: 'POST', token: v3Session.token,
    body: { clientRequestId: 'v3-legacy-passive-0001' },
  });
  // LOCAL gate (ZERO_SEASON_ENABLED) intentionally disables the V1 passive faucet.
  if (passiveV3.status !== 409 || passiveV3.body.error?.details?.reason !== 'local_passive_disabled') {
    throw new Error(`V3 при LOCAL gate должен отклонять passive: ${JSON.stringify(passiveV3)}`);
  }
  const v3LegacyState = await api('/api/v1/state', { token: v3Session.token });
  if (v3LegacyState.status !== 200 || v3LegacyState.body.hatched !== true ||
      !v3LegacyState.body.player || v3LegacyState.body.features?.eggs !== true) {
    throw new Error(`V3 не сохранил игровую основу V1: ${JSON.stringify(v3LegacyState)}`);
  }
  const actionBody = {
    kind: 'connect', status: 'active', title: 'Ищу команду для прототипа',
    note: 'Могу помочь исследованием', visibility: 'flock',
    clientRequestId: 'v3-action-connect-0001',
  };
  const savedV3 = await api('/api/v3/actions', {
    method: 'POST', token: v3Session.token, body: actionBody,
  });
  const repeatedV3 = await api('/api/v3/actions', {
    method: 'POST', token: v3Session.token, body: actionBody,
  });
  if (savedV3.status !== 200 || repeatedV3.body.actions?.length !== 1 ||
      repeatedV3.body.connections?.[0]?.isMe !== true) {
    throw new Error(`V3 действие не сохранилось идемпотентно: ${JSON.stringify({ savedV3, repeatedV3 })}`);
  }
  const actionId = savedV3.body.actions[0].id;
  const doneV3 = await api(`/api/v3/actions/${actionId}/status`, {
    method: 'POST', token: v3Session.token,
    body: { status: 'done', clientRequestId: 'v3-action-done-0001' },
  });
  const repeatedDoneV3 = await api(`/api/v3/actions/${actionId}/status`, {
    method: 'POST', token: v3Session.token,
    body: { status: 'done', clientRequestId: 'v3-action-done-0001' },
  });
  if (doneV3.body.actions?.[0]?.status !== 'done' ||
      repeatedDoneV3.body.progress?.usefulKinds !== 1) {
    throw new Error(`V3 прогресс не следует полезному действию: ${JSON.stringify({ doneV3, repeatedDoneV3 })}`);
  }
  const regressedV3 = await api(`/api/v3/actions/${actionId}/status`, {
    method: 'POST', token: v3Session.token,
    body: { status: 'active', clientRequestId: 'v3-action-regress-0001' },
  });
  if (regressedV3.status !== 409 || regressedV3.body.error?.code !== 'INVALID_TRANSITION') {
    throw new Error(`V3 допустил откат завершённого действия: ${JSON.stringify(regressedV3)}`);
  }
  const invalidChatV3 = await api('/api/v3/actions', {
    method: 'POST', token: v3Session.token,
    body: {
      kind: 'ask', status: 'planned', title: 'Неверный чат', chatCode: 'missing-chat',
      clientRequestId: 'v3-invalid-chat-0001',
    },
  });
  if (invalidChatV3.status !== 400 || invalidChatV3.body.error?.code !== 'VALIDATION') {
    throw new Error(`V3 принял неизвестный чат: ${JSON.stringify(invalidChatV3)}`);
  }
  const nestV3 = await api('/api/v3/nest', {
    method: 'POST', token: v3Session.token,
    body: {
      sourceKind: 'action', sourceId: String(actionId), title: 'Контакт команды',
      nextStep: 'Написать завтра', clientRequestId: 'v3-nest-save-0001',
    },
  });
  const nestIdV3 = nestV3.body.nest?.[0]?.id;
  const duplicateSourceV3 = await api('/api/v3/nest', {
    method: 'POST', token: v3Session.token,
    body: {
      sourceKind: 'action', sourceId: String(actionId), title: 'Дубликат контакта',
      clientRequestId: 'v3-nest-source-repeat-0001',
    },
  });
  if (duplicateSourceV3.status !== 200 || duplicateSourceV3.body.nest?.length !== 1 ||
      duplicateSourceV3.body.nest[0]?.id !== nestIdV3) {
    throw new Error(`V3 продублировал один источник в гнезде: ${JSON.stringify(duplicateSourceV3)}`);
  }
  const nestDoneV3 = await api(`/api/v3/nest/${nestIdV3}/status`, {
    method: 'POST', token: v3Session.token,
    body: { status: 'done', clientRequestId: 'v3-nest-done-0001' },
  });
  if (nestDoneV3.body.nest?.[0]?.status !== 'done') {
    throw new Error(`V3 гнездо не завершилось: ${JSON.stringify(nestDoneV3)}`);
  }
  const nestRegressedV3 = await api(`/api/v3/nest/${nestIdV3}/status`, {
    method: 'POST', token: v3Session.token,
    body: { status: 'active', clientRequestId: 'v3-nest-regress-0001' },
  });
  if (nestRegressedV3.status !== 409 || nestRegressedV3.body.error?.code !== 'INVALID_TRANSITION') {
    throw new Error(`V3 допустил откат завершённого элемента гнезда: ${JSON.stringify(nestRegressedV3)}`);
  }
  const outsideV3 = await api('/api/v3/state', { token: outsideSession.token });
  if (outsideV3.status !== 404 || outsideV3.body.error?.code !== 'EXPERIENCE_DISABLED') {
    throw new Error(`Список доступа v3 не закрыт: ${JSON.stringify(outsideV3)}`);
  }
  console.log('  ✔ восстановленный V3 сохраняет V1, восемь путей, opt-in видимость и гнездо');
  console.log('  ✔ V3 действия, статусы и повторы идемпотентны; gate закрыт точным списком');

  const v4Session = await login(V4_TG_ID);
  const initialV4 = await api('/api/v4/state', { token: v4Session.token });
  if (initialV4.status !== 200 || initialV4.body.profile !== null || initialV4.body.lastRound !== null || 'leadingVotes' in initialV4.body) {
    throw new Error(`Начальное состояние V4 неверно: ${JSON.stringify(initialV4)}`);
  }
  const profileBody = {
    bird: 'owl', scores: { woodpecker: 4, magpie: 3, owl: 8, crane: 5 },
    clientRequestId: 'v4-profile-0001',
  };
  const savedV4Profile = await api('/api/v4/profile', {
    method: 'POST', token: v4Session.token, body: profileBody,
  });
  const repeatedV4Profile = await api('/api/v4/profile', {
    method: 'POST', token: v4Session.token, body: profileBody,
  });
  const v4AfterProfile = await api('/api/v4/state', { token: v4Session.token });
  const changedCurrentBird = await api('/api/v4/season/bird', {
    method: 'POST', token: v4Session.token,
    body: { bird: 'crane', clientRequestId: 'v4-change-bird-0001' },
  });
  if (
    savedV4Profile.status !== 200 || repeatedV4Profile.body.profile?.bird !== 'owl' ||
    v4AfterProfile.body.activeBird !== 'owl' || changedCurrentBird.status !== 409 ||
    changedCurrentBird.body.error?.code !== 'INVALID_TRANSITION'
  ) {
    throw new Error(`Профиль V4 не сохранился идемпотентно: ${JSON.stringify({ savedV4Profile, repeatedV4Profile, v4AfterProfile, changedCurrentBird })}`);
  }
  const v4Predictor = await login(V4_PREDICTOR_TG_ID);
  const savedPredictorProfile = await api('/api/v4/profile', {
    method: 'POST', token: v4Predictor.token,
    body: {
      bird: 'magpie', scores: { woodpecker: 5, magpie: 8, owl: 3, crane: 4 },
      clientRequestId: 'v4-predictor-profile-0001',
    },
  });
  const grantedEgg = await api('/api/v4/dev/eggs', {
    method: 'POST', token: v4Predictor.token, body: { amount: 1 },
  });
  const savedForecast = await api('/api/v4/forecast', {
    method: 'POST', token: v4Predictor.token,
    body: { bird: 'owl', clientRequestId: 'v4-forecast-0001' },
  });
  const repeatedForecast = await api('/api/v4/forecast', {
    method: 'POST', token: v4Predictor.token,
    body: { bird: 'owl', clientRequestId: 'v4-forecast-0001' },
  });
  if (
    savedPredictorProfile.status !== 200 || grantedEgg.body.eggs !== 1 ||
    savedForecast.status !== 200 || savedForecast.body.eggs !== 0 ||
    repeatedForecast.status !== 200 || repeatedForecast.body.forecast?.status !== 'pending'
  ) {
    throw new Error(`Прогноз V4 не поставлен идемпотентно: ${JSON.stringify({ savedPredictorProfile, grantedEgg, savedForecast, repeatedForecast })}`);
  }
  const waitingFlightSession = await login(V4_FLIGHT_WAIT_TG_ID);
  const savedWaitingFlightProfile = await api('/api/v4/profile', {
    method: 'POST', token: waitingFlightSession.token,
    body: {
      bird: 'crane', scores: { woodpecker: 4, magpie: 4, owl: 4, crane: 8 },
      clientRequestId: 'v4-waiting-flight-profile-0001',
    },
  });
  const joinedWaitingFlight = await api('/api/v4/flight/join', {
    method: 'POST', token: waitingFlightSession.token,
    body: { intent: 'scout', nest: 0, clientRequestId: 'v4-waiting-flight-join-0001' },
  });
  const blockedWaitingFlight = await api('/api/v4/series/start', {
    method: 'POST', token: waitingFlightSession.token,
    body: { intent: 'scout', nest: 0, clientRequestId: 'v4-waiting-flight-start-0001' },
  });
  const leftWaitingFlight = await api('/api/v4/flight/leave', {
    method: 'POST', token: waitingFlightSession.token,
    body: { clientRequestId: 'v4-waiting-flight-leave-0001' },
  });
  const retriedWaitingFlight = await api('/api/v4/flight/join', {
    method: 'POST', token: waitingFlightSession.token,
    body: { intent: 'attack', nest: 1, clientRequestId: 'v4-waiting-flight-join-0002' },
  });
  if (
    savedWaitingFlightProfile.status !== 200 || joinedWaitingFlight.body.flight?.members !== 1 ||
    blockedWaitingFlight.status !== 409 || blockedWaitingFlight.body.error?.details?.reason !== 'zero_season_flight_waiting' ||
    leftWaitingFlight.status !== 200 || retriedWaitingFlight.status !== 409 ||
    retriedWaitingFlight.body.error?.details?.reason !== 'zero_season_flight_choice_locked'
  ) {
    throw new Error(`Ожидание полёта V4 допускает лишний ход или перебор групп: ${JSON.stringify({ joinedWaitingFlight, blockedWaitingFlight, leftWaitingFlight, retriedWaitingFlight })}`);
  }
  const flightSessions = [];
  const joinedFlights = [];
  for (const [index, tgId] of V4_FLIGHT_TG_IDS.entries()) {
    const session = await login(tgId);
    flightSessions.push(session);
    const savedFlightProfile = await api('/api/v4/profile', {
      method: 'POST', token: session.token,
      body: {
        bird: ['woodpecker', 'magpie', 'owl', 'crane'][index],
        scores: { woodpecker: 5, magpie: 5, owl: 5, crane: 5 },
        clientRequestId: `v4-flight-profile-${index}-0001`,
      },
    });
    if (savedFlightProfile.status !== 200) throw new Error(`Профиль участника полёта не сохранён: ${JSON.stringify(savedFlightProfile)}`);
    joinedFlights.push(await api('/api/v4/flight/join', {
      method: 'POST', token: session.token,
      body: { intent: 'attack', nest: 5, clientRequestId: `v4-flight-join-${index}-0001` },
    }));
  }
  const forcedFlightStart = await api('/api/v4/series/start', {
    method: 'POST', token: flightSessions[0].token,
    body: { intent: 'scout', nest: 0, clientRequestId: 'v4-flight-forced-start-0001' },
  });
  const leftReadyFlight = await api('/api/v4/flight/leave', {
    method: 'POST', token: flightSessions[0].token,
    body: { clientRequestId: 'v4-ready-flight-leave-0001' },
  });
  const differentRouteSession = await login(V4_FLIGHT_ROUTE_TG_ID);
  const savedDifferentRouteProfile = await api('/api/v4/profile', {
    method: 'POST', token: differentRouteSession.token,
    body: {
      bird: 'owl', scores: { woodpecker: 4, magpie: 4, owl: 8, crane: 4 },
      clientRequestId: 'v4-route-flight-profile-0001',
    },
  });
  const joinedDifferentRoute = await api('/api/v4/flight/join', {
    method: 'POST', token: differentRouteSession.token,
    body: { intent: 'scout', nest: 0, clientRequestId: 'v4-route-flight-join-0001' },
  });
  if (
    joinedFlights.some((result) => result.status !== 200) ||
    joinedFlights.at(-1)?.body.flight?.status !== 'ready' || joinedFlights.at(-1)?.body.flight?.members !== 4 ||
    leftReadyFlight.status !== 409 || leftReadyFlight.body.error?.details?.reason !== 'zero_season_flight_ready_locked' ||
    forcedFlightStart.status !== 200 || forcedFlightStart.body.intent !== 'attack' || forcedFlightStart.body.nest !== 5 ||
    forcedFlightStart.body.flight?.members !== 4 || savedDifferentRouteProfile.status !== 200 ||
    joinedDifferentRoute.status !== 200 || joinedDifferentRoute.body.flight?.members !== 1 ||
    joinedDifferentRoute.body.flight?.intent !== 'scout' || joinedDifferentRoute.body.flight?.nest !== 0
  ) {
    throw new Error(`Общий полёт V4 не синхронизирует обычный ход: ${JSON.stringify({ joinedFlights, forcedFlightStart })}`);
  }
  const v4Questions = await api('/api/v4/series/start', {
    method: 'POST', token: v4Session.token,
    body: { intent: 'attack', nest: 2, clientRequestId: 'v4-start-0001' },
  });
  const seriesAnswers = solveZeroSeasonQuestions(v4Questions.body.questions);
  const forgedV4Series = await api('/api/v4/series', {
    method: 'POST', token: v4Session.token,
    body: { intent: 'attack', nest: 2, correct: 5, clientRequestId: 'v4-forged-0001' },
  });
  const seriesBody = { answers: seriesAnswers, clientRequestId: 'v4-series-0001' };
  const savedV4Series = await api('/api/v4/series', {
    method: 'POST', token: v4Session.token, body: seriesBody,
  });
  const repeatedV4Series = await api('/api/v4/series', {
    method: 'POST', token: v4Session.token, body: seriesBody,
  });
  const secondV4Series = await api('/api/v4/series', {
    method: 'POST', token: v4Session.token,
    body: { answers: seriesAnswers, clientRequestId: 'v4-series-0002' },
  });
  const v4BeforeClose = await api('/api/v4/state', { token: v4Session.token });
  if (
    v4Questions.status !== 200 || v4Questions.body.questions?.some((question) => 'answer' in question) ||
    forgedV4Series.status !== 400 || forgedV4Series.body.error?.code !== 'VALIDATION' ||
    savedV4Series.status !== 200 || savedV4Series.body.correct !== 5 || savedV4Series.body.effect !== 'attack' ||
    savedV4Series.body.paths?.find((path) => path.bird === 'owl')?.mastery !== 1 ||
    'leadingVotes' in savedV4Series.body || v4BeforeClose.body.lastRound !== null || 'leadingVotes' in v4BeforeClose.body ||
    repeatedV4Series.status !== 200 || secondV4Series.status !== 429 ||
    secondV4Series.body.error?.code !== 'RATE_LIMITED'
  ) {
    throw new Error(`Суточный ход V4 нарушен: ${JSON.stringify({ v4Questions, forgedV4Series, savedV4Series, repeatedV4Series, secondV4Series })}`);
  }
  const outsideV4 = await api('/api/v4/state', { token: outsideSession.token });
  if (outsideV4.status !== 200 || outsideV4.body.profile !== null || 'leadingVotes' in outsideV4.body) {
    throw new Error(`Открытый доступ V4 нарушен: ${JSON.stringify(outsideV4)}`);
  }
  const closedV4 = await api('/api/v4/dev/close', {
    method: 'POST', token: v4Session.token, body: {},
  });
  const repeatedClosedV4 = await api('/api/v4/dev/close', {
    method: 'POST', token: v4Session.token, body: {},
  });
  if (
    closedV4.status !== 200 || closedV4.body.closure?.board?.nests?.[2] !== 'owl' ||
    JSON.stringify(closedV4.body.closure) !== JSON.stringify(repeatedClosedV4.body.closure)
  ) {
    throw new Error(`Коллективное закрытие V4 нарушено: ${JSON.stringify({ closedV4, repeatedClosedV4 })}`);
  }
  const settledForecast = await api('/api/v4/state', { token: v4Predictor.token });
  if (
    settledForecast.body.eggs !== 2 || settledForecast.body.forecast?.status !== 'won' ||
    settledForecast.body.lastRound?.actions?.owl?.intent !== 'attack' ||
    settledForecast.body.lastRound?.actions?.owl?.nest !== 2 ||
    settledForecast.body.lastRound?.actions?.owl?.votes !== 1 ||
    settledForecast.body.board?.nests?.[2] !== 'owl' ||
    'leadingVotes' in settledForecast.body
  ) {
    throw new Error(`Прогноз V4 не рассчитан: ${JSON.stringify(settledForecast)}`);
  }
  console.log('  ✔ V4 хранит один голос в сутки, нормализует выбор птицы и открыт всем Telegram-участникам при отдельном gate');
  console.log('  ✔ V4 закрывает день одним идемпотентным коллективным ходом');
  console.log('  ✔ V4 выдаёт яйца только за серию и анонимно рассчитывает прогноз после закрытия');
  console.log('  ✔ V4 показывает только сохранённую сводку закрытой ночи, без незакрытых голосов');
  console.log('  ✔ V4 синхронизирует полёт 4–6 без бонусных ходов, яиц или раскрытия состава');

  const badWebhook = await api('/telegram/webhook', { method: 'POST', body: { update_id: 1 } });
  if (badWebhook.status !== 403) throw new Error(`Webhook без секрета вернул ${badWebhook.status}, ожидался 403`);
  console.log('  ✔ Telegram webhook закрыт секретом');

  const seed = 800_000 + Math.floor(Math.random() * 10_000);
  const giverId = seed;
  const giverSession = await login(giverId);
  await hatch(giverSession);
  const giverState = await api('/api/v1/state', { token: giverSession.token });
  const wormBudget = 3;
  if (!giverState.body.hatched) {
    throw new Error(`Не удалось подготовить LOCAL /worm sender: ${JSON.stringify(giverState.body)}`);
  }
  // LOCAL MVP intentionally uses one stable social budget: no Friday multiplier.
  const targetIds = Array.from({ length: wormBudget + 1 }, (_, index) => seed + index + 1);
  const targetSessions = [];
  for (const id of targetIds) {
    const session = await login(id);
    await hatch(session);
    targetSessions.push(session);
  }
  const webhookResults = await Promise.all(targetIds.map((targetId, index) => api('/telegram/webhook', {
    method: 'POST',
    headers: { 'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET },
    body: telegramUpdate(index + 10, giverId, targetId),
  })));
  if (webhookResults.some((result) => result.status !== 200)) {
    throw new Error(`Один из webhook-запросов провалился: ${JSON.stringify(webhookResults)}`);
  }
  const states = await Promise.all(targetSessions.map((session) =>
    api('/api/v1/state', { token: session.token })));
  const credited = states.filter((state) => state.body.player?.reputation > 0);
  if (credited.length !== wormBudget) {
    throw new Error(`Атомарный лимит /worm нарушен: начислено ${credited.length} из ${targetIds.length}, ожидалось ${wormBudget}`);
  }
  console.log(`  ✔ конкурентные /worm соблюдают атомарный лимит ${wormBudget}/день`);

  const tgId = targetIds[0];
  const adminSignal = await api('/api/v1/admin/signal', {
    method: 'POST',
    headers: { 'X-Kontur-Admin': 'worker-check-admin' },
    body: { tgId, kind: 'own_project', title: 'Автопроверка', referenceCode: `worker-${seed}` },
  });
  if (adminSignal.status !== 200 || adminSignal.body.created !== true) {
    throw new Error(`Админская выдача сигнала не сработала: ${JSON.stringify(adminSignal.body)}`);
  }
  console.log('  ✔ подтверждённое действие выдаётся без пользовательской сессии');

  let cronRows = [];
  for (const cron of ['30 4 * * *', '0 6-10 * * *', '0 15 * * *']) {
    const result = await api('/api/v1/dev/cron', { method: 'POST', body: { cron } });
    if (result.status !== 200 || result.body.ok !== true) {
      throw new Error(`Тестовый cron ${cron} вернул ${result.status}: ${JSON.stringify(result.body)}`);
    }
    cronRows = result.body.rows;
  }
  const expectedCronJobs = 1;
  if (cronRows.length !== expectedCronJobs || cronRows.some((row) => row.status !== 'done' || Number(row.attempts) !== 1)) {
    throw new Error(`Cron state не подтверждён: ${JSON.stringify(cronRows)}`);
  }
  console.log('  ✔ LOCAL MVP cron оставляет cleanup, но не запускает старый V4 close/leaderboard и passive faucet');
} finally {
  if (flow && flow.exitCode === null) flow.kill('SIGTERM');
  if (worker && worker.exitCode === null) {
    worker.kill('SIGTERM');
    await Promise.race([
      new Promise((resolveExit) => worker.once('exit', resolveExit)),
      delay(5_000),
    ]);
    if (worker.exitCode === null) worker.kill('SIGKILL');
  }
  await rm(temp, { recursive: true, force: true });
}
