import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..', '..');
const workerDir = join(root, 'apps', 'worker');
const require = createRequire(join(workerDir, 'package.json'));
const wrangler = require.resolve('wrangler');
const pnpm = process.env.npm_execpath;
const temp = await mkdtemp(join(tmpdir(), 'kontur-v5-telegram-'));
const port = 20_000 + Math.floor(Math.random() * 800);
const origin = `http://127.0.0.1:${port}`;
const secret = 'v5-telegram-check-webhook';
const campaignChatId = -100987654321;
const adminTgId = 970001;
const playerTgId = 970002;
let worker;

function runNode(args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: options.cwd ?? root,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let output = '';
    child.stdout?.on('data', (chunk) => { output += chunk; });
    child.stderr?.on('data', (chunk) => { output += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolveRun(output) : reject(new Error(output.slice(-4_000))));
  });
}

async function query(sql) {
  const text = await runNode([
    wrangler, 'd1', 'execute', 'kontur', '--local', '--persist-to', temp, '--command', sql, '--json',
  ], { cwd: workerDir });
  const begin = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (begin < 0 || end < begin) throw new Error(`D1 не вернул JSON: ${text.slice(-500)}`);
  const parsed = JSON.parse(text.slice(begin, end + 1));
  return parsed[0]?.results ?? [];
}

async function webhook(update) {
  const response = await fetch(`${origin}/telegram/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret },
    body: JSON.stringify(update),
  });
  if (!response.ok) throw new Error(`Webhook V5 ответил ${response.status}: ${await response.text()}`);
}

async function devCron(cron) {
  const response = await fetch(`${origin}/api/v1/dev/cron`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cron }),
  });
  if (!response.ok) throw new Error(`DEV cron V5 ответил ${response.status}: ${await response.text()}`);
}

function groupCommand(updateId, text, replyToMessageId) {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      from: { id: adminTgId, username: 'v5_admin' },
      chat: { id: campaignChatId, type: 'supergroup' },
      text,
      ...(replyToMessageId ? { reply_to_message: { message_id: replyToMessageId } } : {}),
    },
  };
}

try {
  if (!pnpm) throw new Error('Запускайте через pnpm: npm_execpath не задан.');
  await runNode([pnpm, '-F', '@kontur/miniapp', 'build']);
  await runNode([wrangler, 'd1', 'migrations', 'apply', 'kontur', '--local', '--persist-to', temp], { cwd: workerDir });
  worker = spawn(process.execPath, [
    wrangler, 'dev', '--local', '--port', String(port), '--persist-to', temp,
    '--show-interactive-dev-session', 'false',
    '--var', 'DEV_MODE:true',
    '--var', 'JWT_SECRET:v5-telegram-check-local-only',
    '--var', `MINIAPP_URL:${origin}/?season=zero`,
    '--var', `MAIN_CHAT_ID:${campaignChatId - 1}`,
    '--var', `WEBHOOK_SECRET:${secret}`,
    '--var', 'ADMIN_SECRET:v5-telegram-check-admin',
    '--var', 'LIVE_CAMPAIGN_V5_ENABLED:true',
    '--var', 'LIVE_CAMPAIGN_V5_PUBLISH_ENABLED:true',
    '--var', 'V5_BOT_USERNAME:kontur_igor_test_bot',
  ], { cwd: workerDir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let output = '';
  worker.stdout?.on('data', (chunk) => { output += chunk; });
  worker.stderr?.on('data', (chunk) => { output += chunk; });
  const deadline = Date.now() + 30_000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${origin}/api/v1/health`, { signal: AbortSignal.timeout(1_000) })).ok) {
        ready = true;
        break;
      }
    } catch { /* Worker starts asynchronously. */ }
    await delay(150);
  }
  if (!ready) throw new Error(`Worker V5 не поднялся:\n${output.slice(-3_000)}`);

  await webhook(groupCommand(10_001, '/kontur arm'));
  const armed = await query(`SELECT c.status,s.game_enabled,s.publish_enabled,p.status AS campaign_status,
    (SELECT count(*) FROM v5_campaign_sectors x WHERE x.campaign_id=p.id) AS sectors
    FROM v5_campaign_chats c JOIN v5_chat_settings s ON s.chat_id=c.id
    JOIN v5_campaigns p ON p.chat_id=c.id AND p.status='active'
    WHERE c.telegram_chat_id=${campaignChatId}`);
  assert.equal(armed.length, 1, 'arm must register exactly one chat and campaign');
  assert.deepEqual(
    [armed[0].status, Number(armed[0].game_enabled), Number(armed[0].publish_enabled), armed[0].campaign_status, Number(armed[0].sectors)],
    ['armed', 1, 0, 'active', 7],
  );

  await query(`UPDATE v5_campaign_chats SET next_event_at=datetime('now','-1 minute') WHERE telegram_chat_id=${campaignChatId}`);
  await devCron('0 * * * *');
  await webhook(groupCommand(10_002, '/kontur open'));
  await webhook(groupCommand(10_003, '/kontur open'));
  const events = await query(`SELECT id,status,(SELECT count(*) FROM v5_event_objectives o WHERE o.event_id=e.id) AS objectives
    FROM v5_events e ORDER BY id`);
  assert.equal(events.length, 1, 'repeated open must not create a second event');
  assert.deepEqual([events[0].status, Number(events[0].objectives)], ['open', 1]);
  const eventId = Number(events[0].id);

  await webhook({
    update_id: 10_004,
    message: {
      message_id: 10_004,
      from: { id: playerTgId, username: 'v5_player' },
      chat: { id: playerTgId, type: 'private' },
      text: `/start v5_${eventId}`,
    },
  });
  const started = await query(`SELECT started_bot_at FROM users WHERE tg_id=${playerTgId}`);
  assert.equal(started.length, 1, 'private V5 start must create the player record');
  assert.notEqual(started[0].started_bot_at, null, 'private V5 start must mark the bot as started');

  await webhook(groupCommand(10_005, '/kontur scout', 40_001));
  await webhook(groupCommand(10_006, '/kontur scout', 40_001));
  const contracts = await query(`SELECT source_message_id,requested_action FROM v5_chat_contracts`);
  assert.deepEqual(contracts, [{ source_message_id: 40_001, requested_action: 'scout' }], 'reply contract must be idempotent');

  await webhook(groupCommand(10_007, '/kontur publish'));
  await devCron('0 * * * *');
  const outbox = await query(`SELECT status,payload_json FROM v5_telegram_outbox`);
  assert.equal(outbox.length, 1, 'publish must enqueue at most one opening post');
  assert.equal(outbox[0].status, 'suppressed', 'unknown delivery is suppressed instead of retried');
  assert.equal(String(outbox[0].payload_json).includes('web_app'), false, 'group payload must never contain a Web App button');

  await webhook(groupCommand(10_008, '/kontur pause'));
  const paused = await query(`SELECT c.status,s.game_enabled,s.publish_enabled FROM v5_campaign_chats c
    JOIN v5_chat_settings s ON s.chat_id=c.id WHERE c.telegram_chat_id=${campaignChatId}`);
  assert.deepEqual([paused[0].status, Number(paused[0].game_enabled), Number(paused[0].publish_enabled)], ['paused', 0, 0]);
  console.log('✔ V5 Telegram: arm/open/start/reply-contract/publish/pause pass idempotently');
} finally {
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
