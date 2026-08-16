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
const stateDir = await mkdtemp(join(tmpdir(), 'kontur-v5-api-'));
const port = 21_000 + Math.floor(Math.random() * 700);
const origin = `http://127.0.0.1:${port}`;
const chatId = -100876543210;
const secret = 'v5-api-check-webhook';
const admin = 971001;
const players = [971101, 971102, 971103, 971104, 971105];
let worker;

function mark(stage) {
  console.log(`V5 API check: ${stage}`);
}

function run(args, cwd = root) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let output = '';
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      fn(value);
    };
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      finish(reject, new Error(`Timed out after 90s: ${args.slice(1, 5).join(' ')}`));
    }, 90_000);
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.once('error', (error) => finish(reject, error));
    child.once('exit', (code) => code === 0 ? finish(resolveRun, output) : finish(reject, new Error(output.slice(-4_000))));
  });
}

async function d1(sql) {
  const text = await run([wrangler, 'd1', 'execute', 'kontur', '--local', '--persist-to', stateDir, '--command', sql, '--json'], workerDir);
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end < start) throw new Error(`D1 JSON missing: ${text.slice(-500)}`);
  return JSON.parse(text.slice(start, end + 1))[0]?.results ?? [];
}

async function http(path, { method = 'GET', body, token } = {}) {
  let response;
  try {
    response = await fetch(`${origin}${path}`, {
      method,
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new Error(`HTTP ${method} ${path} did not return within 30s: ${error instanceof Error ? error.message : String(error)}`);
  }
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : {} };
}

async function webhook(update) {
  let response;
  try {
    response = await fetch(`${origin}/telegram/webhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': secret }, body: JSON.stringify(update), signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new Error(`Telegram webhook did not return within 30s: ${error instanceof Error ? error.message : String(error)}`);
  }
  assert.equal(response.status, 200);
}

function groupCommand(id, text, targetChatId = chatId) {
  return { update_id: id, message: { message_id: id, from: { id: admin, username: 'v5_admin' }, chat: { id: targetChatId, type: 'supergroup' }, text } };
}

async function user(tgId, eventId) {
  await webhook({
    update_id: tgId + 20_000,
    message: { message_id: tgId + 20_000, from: { id: tgId, username: `v5_${tgId}` }, chat: { id: tgId, type: 'private' }, text: `/start v5_${eventId}` },
  });
  const auth = await http('/api/v1/auth/telegram', { method: 'POST', body: { initData: `dev:${tgId}`, source: 'campaign-v5' } });
  assert.equal(auth.status, 200, JSON.stringify(auth.body));
  const token = auth.body.token;
  const pretest = await http('/api/v5/pretest', {
    method: 'POST', token,
    body: { eventId, answers: ['woodpecker', 'magpie', 'owl', 'crane', 'woodpecker', 'crane'], clientRequestId: `v5-pretest-${tgId}` },
  });
  assert.equal(pretest.status, 200, JSON.stringify(pretest.body));
  const bird = pretest.body.state.profile.baseBird;
  const active = await http('/api/v5/birds/active', { method: 'POST', token, body: { eventId, bird, clientRequestId: `v5-active-${tgId}` } });
  assert.equal(active.status, 200, JSON.stringify(active.body));
  return { tgId, token, bird, state: active.body.state };
}

async function soloAnswers(sessionId) {
  const cards = await d1(`SELECT correct_option FROM v5_session_cards WHERE session_id=${Number(sessionId)} ORDER BY position`);
  assert.equal(cards.length, 5);
  return cards.map((card) => Number(card.correct_option));
}

async function raidAnswers(raidId, tgId) {
  const cards = await d1(`SELECT correct_option FROM v5_raid_cards WHERE raid_id=${Number(raidId)} AND user_id=(SELECT id FROM users WHERE tg_id=${Number(tgId)}) ORDER BY position`);
  assert.equal(cards.length, 2);
  return cards.map((card) => Number(card.correct_option));
}

try {
  if (!pnpm) throw new Error('Run through pnpm so npm_execpath is available.');
  await run([pnpm, '-F', '@kontur/miniapp', 'build']);
  await run([wrangler, 'd1', 'migrations', 'apply', 'kontur', '--local', '--persist-to', stateDir], workerDir);
  mark('local database migrated');
  worker = spawn(process.execPath, [
    wrangler, 'dev', '--local', '--port', String(port), '--persist-to', stateDir, '--show-interactive-dev-session', 'false',
    '--var', 'DEV_MODE:true', '--var', 'JWT_SECRET:v5-api-check-local', '--var', `MINIAPP_URL:${origin}/?season=zero`,
    '--var', `MAIN_CHAT_ID:${chatId - 1}`, '--var', `WEBHOOK_SECRET:${secret}`, '--var', 'ADMIN_SECRET:v5-api-check-admin',
    '--var', 'LIVE_CAMPAIGN_V5_ENABLED:true', '--var', 'LIVE_CAMPAIGN_V5_PUBLISH_ENABLED:false',
  ], { cwd: workerDir, env: process.env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let workerOutput = '';
  worker.stdout.on('data', (chunk) => { workerOutput += chunk; });
  worker.stderr.on('data', (chunk) => { workerOutput += chunk; });
  let ready = false;
  for (let i = 0; i < 200; i++) {
    try { if ((await fetch(`${origin}/api/v1/health`, { signal: AbortSignal.timeout(1_000) })).ok) { ready = true; break; } } catch { /* boot */ }
    await delay(150);
  }
  if (!ready) throw new Error(`Worker did not start:\n${workerOutput.slice(-3_000)}`);
  mark('worker ready');

  await webhook(groupCommand(20_001, '/kontur arm'));
  await webhook(groupCommand(20_002, '/kontur open'));
  const [event] = await d1("SELECT id FROM v5_events WHERE status='open'");
  const eventId = Number(event.id);
  const [objective] = await d1(`SELECT sector,action,threshold FROM v5_event_objectives WHERE event_id=${eventId}`);
  const [campaign] = await d1(`SELECT id FROM v5_campaigns WHERE id=(SELECT campaign_id FROM v5_events WHERE id=${eventId})`);
  const campaignId = Number(campaign.id);
  mark('campaign opened');

  // An expired campaign with a still-open final window must not roll over and
  // create a second live event in the same chat.
  await d1(`UPDATE v5_campaigns SET ends_at=datetime('now','-1 second') WHERE id=${campaignId}`);
  assert.equal((await http('/api/v1/dev/cron', { method: 'POST', body: { cron: '0 * * * *' } })).status, 200);
  const [rolloverHeld] = await d1(`SELECT
    (SELECT status FROM v5_campaigns WHERE id=${campaignId}) AS campaign_status,
    (SELECT count(*) FROM v5_campaigns WHERE chat_id=(SELECT chat_id FROM v5_campaigns WHERE id=${campaignId}) AND status='active') AS active_campaigns,
    (SELECT count(*) FROM v5_events WHERE campaign_id=${campaignId} AND status IN ('open','locked')) AS live_events`);
  assert.deepEqual([rolloverHeld.campaign_status, Number(rolloverHeld.active_campaigns), Number(rolloverHeld.live_events)], ['active', 1, 1]);

  const userRows = [];
  for (const tgId of players) userRows.push(await user(tgId, eventId));
  const first = userRows[0];
  mark('five player profiles prepared');

  // The same item cannot leave a second campaign session half-created. These
  // are separate campaigns, so their active-bird locks do not hide an item
  // race; only the session+item database transaction can resolve it safely.
  const atomicPlayer = await user(971106, eventId);
  const atomicChatA = chatId - 101;
  const atomicChatB = chatId - 102;
  await webhook(groupCommand(30_001, '/kontur arm', atomicChatA));
  await webhook(groupCommand(30_002, '/kontur open', atomicChatA));
  await webhook(groupCommand(30_003, '/kontur arm', atomicChatB));
  await webhook(groupCommand(30_004, '/kontur open', atomicChatB));
  const [atomicEventA] = await d1(`SELECT e.id FROM v5_events e
    JOIN v5_campaigns p ON p.id=e.campaign_id JOIN v5_campaign_chats c ON c.id=p.chat_id
    WHERE c.telegram_chat_id=${atomicChatA} AND e.status='open'`);
  const [atomicEventB] = await d1(`SELECT e.id FROM v5_events e
    JOIN v5_campaigns p ON p.id=e.campaign_id JOIN v5_campaign_chats c ON c.id=p.chat_id
    WHERE c.telegram_chat_id=${atomicChatB} AND e.status='open'`);
  const atomicEventIds = [Number(atomicEventA.id), Number(atomicEventB.id)];
  const atomicObjectives = await Promise.all(atomicEventIds.map(async (id) => (await d1(
    `SELECT sector,action FROM v5_event_objectives WHERE event_id=${id}`,
  ))[0]));
  for (const id of atomicEventIds) {
    assert.equal((await http('/api/v5/birds/active', {
      method: 'POST', token: atomicPlayer.token,
      body: { eventId: id, bird: atomicPlayer.bird, clientRequestId: `v5-atomic-active-${id}` },
    })).status, 200);
  }
  await d1(`INSERT INTO v5_inventory_items (user_id,item_kind,source_kind,source_key,created_request_id)
    VALUES ((SELECT id FROM users WHERE tg_id=${atomicPlayer.tgId}),'lens','campaign','check:atomic-lens','check:atomic-lens')`);
  const [atomicLens] = await d1("SELECT id FROM v5_inventory_items WHERE source_key='check:atomic-lens'");
  await d1(`UPDATE v5_events SET opens_at=datetime('now','-2 seconds'),forecast_deadline=datetime('now','-1 second')
    WHERE id IN (${atomicEventIds.join(',')})`);
  const atomicStarts = await Promise.all(atomicEventIds.map((id, index) => http(`/api/v5/events/${id}/session/start`, {
    method: 'POST', token: atomicPlayer.token,
    body: {
      sectorId: Number(atomicObjectives[index].sector), action: atomicObjectives[index].action,
      itemId: Number(atomicLens.id), clientRequestId: `v5-atomic-start-${index}`,
    },
  })));
  assert.deepEqual(atomicStarts.map((row) => row.status).sort(), [200, 409], JSON.stringify(atomicStarts));
  assert.equal(atomicStarts.find((row) => row.status === 409)?.body.error?.details?.reason, 'v5_item_not_owned');
  const [atomicSessionCheck] = await d1(`SELECT
    count(*) AS sessions,
    sum(CASE WHEN link.session_id IS NULL THEN 1 ELSE 0 END) AS unlinked
    FROM v5_sessions s LEFT JOIN v5_session_items link ON link.session_id=s.id
    WHERE s.event_id IN (${atomicEventIds.join(',')})
      AND s.user_id=(SELECT id FROM users WHERE tg_id=${atomicPlayer.tgId})`);
  assert.deepEqual([Number(atomicSessionCheck.sessions), Number(atomicSessionCheck.unlinked)], [1, 0], 'a contested item must never leave a partial session');
  mark('contested item start is atomic');
  assert.deepEqual(
    [first.state.event.objective.sectorId, first.state.event.objective.action],
    [Number(objective.sector), objective.action],
    'the Mini App receives the one legal event target',
  );
  const [identityBefore] = await d1(`SELECT username FROM users WHERE tg_id=${first.tgId}`);
  await webhook({
    update_id: 28_001,
    chat_member: { chat: { id: chatId, type: 'supergroup' }, new_chat_member: { user: { id: first.tgId }, status: 'member' } },
  });
  const [identity] = await d1(`SELECT username FROM users WHERE tg_id=${first.tgId}`);
  assert.equal(identity.username, identityBefore.username, 'a membership update without username must not erase identity');
  await d1(`UPDATE v5_birds SET path_feathers=8 WHERE user_id=(SELECT id FROM users WHERE tg_id=${first.tgId}) AND bird='${first.bird}'`);
  const molt = await http('/api/v5/molt', {
    method: 'POST', token: first.token,
    body: { eventId, sourceBird: first.bird, targetBird: first.bird, clientRequestId: 'v5-evolve-self' },
  });
  assert.equal(molt.status, 200, JSON.stringify(molt.body));
  const [evolved] = await d1(`SELECT b.form,m.decision FROM v5_birds b
    JOIN v5_bird_molts m ON m.user_id=b.user_id AND m.source_bird=b.bird
    WHERE b.user_id=(SELECT id FROM users WHERE tg_id=${first.tgId}) AND b.bird='${first.bird}'`);
  assert.deepEqual([Number(evolved.form), evolved.decision], [2, 'evolve'], 'self-molt creates a valid Form II evolution');
  const moltRacer = userRows[4];
  await d1(`UPDATE v5_birds SET path_feathers=8 WHERE user_id=(SELECT id FROM users WHERE tg_id=${moltRacer.tgId}) AND bird='${moltRacer.bird}'`);
  const moltRace = await Promise.all(['a', 'b'].map((suffix) => http('/api/v5/molt', {
    method: 'POST', token: moltRacer.token,
    body: { eventId, sourceBird: moltRacer.bird, targetBird: moltRacer.bird, clientRequestId: `v5-evolve-race-${suffix}` },
  })));
  assert.ok(moltRace.every((row) => row.status === 200), JSON.stringify(moltRace));
  const [singleMolt] = await d1(`SELECT b.form,b.path_feathers,count(m.id) AS molts FROM v5_birds b
    LEFT JOIN v5_bird_molts m ON m.user_id=b.user_id AND m.source_bird=b.bird
    WHERE b.user_id=(SELECT id FROM users WHERE tg_id=${moltRacer.tgId}) AND b.bird='${moltRacer.bird}'`);
  assert.deepEqual([Number(singleMolt.form), Number(singleMolt.path_feathers), Number(singleMolt.molts)], [2, 0, 1], 'a concurrent molt spends one source exactly once');
  await d1(`UPDATE v5_wallets SET eggs=1 WHERE user_id=(SELECT id FROM users WHERE tg_id=${first.tgId})`);

  const early = await http(`/api/v5/events/${eventId}/session/start`, {
    method: 'POST', token: first.token,
    body: { sectorId: Number(objective.sector), action: objective.action, clientRequestId: 'v5-before-forecast' },
  });
  assert.equal(early.status, 409);
  assert.equal(early.body.error?.details?.reason, 'v5_forecast_phase');
  const forecast = { sectorId: Number(objective.sector), action: objective.action, prediction: 'sector_resolves', clientRequestId: 'v5-forecast-1' };
  assert.equal((await http(`/api/v5/events/${eventId}/forecast`, { method: 'POST', token: first.token, body: forecast })).status, 200);
  assert.equal((await http(`/api/v5/events/${eventId}/forecast`, { method: 'POST', token: first.token, body: { ...forecast, clientRequestId: 'v5-forecast-2' } })).status, 200);
  const [stake] = await d1(`SELECT count(*) AS n FROM v5_wallet_ledger WHERE user_id=(SELECT id FROM users WHERE tg_id=${first.tgId}) AND source_kind='forecast_stake'`);
  assert.equal(Number(stake.n), 1, 'forecast replay must not debit twice');

  await d1(`UPDATE v5_events
    SET opens_at=datetime('now','-2 seconds'), forecast_deadline=datetime('now','-1 second')
    WHERE id=${eventId}`);
  const illegalAction = objective.action === 'scout' ? 'claim' : 'scout';
  const illegal = await http(`/api/v5/events/${eventId}/session/start`, {
    method: 'POST', token: first.token,
    body: { sectorId: Number(objective.sector), action: illegalAction, clientRequestId: 'v5-illegal-objective' },
  });
  assert.equal(illegal.status, 409, 'server rejects a forged sector/action outside the advertised objective');

  // A lens exposes information immediately, therefore a late series consumes
  // it; a normal series that becomes void must also leave the armed state.
  const latePlayer = userRows[2];
  await d1(`INSERT INTO v5_inventory_items (user_id,item_kind,source_kind,source_key,created_request_id)
    VALUES ((SELECT id FROM users WHERE tg_id=${latePlayer.tgId}),'lens','campaign','check:late-lens','check:late-lens')`);
  const [lateLens] = await d1(`SELECT id FROM v5_inventory_items WHERE source_key='check:late-lens'`);
  const lateStart = await http(`/api/v5/events/${eventId}/session/start`, {
    method: 'POST', token: latePlayer.token,
    body: { sectorId: Number(objective.sector), action: objective.action, itemId: Number(lateLens.id), clientRequestId: 'v5-late-start' },
  });
  assert.equal(lateStart.status, 200, JSON.stringify(lateStart.body));
  await d1(`UPDATE v5_sessions SET close_at=datetime('now','-1 second') WHERE id=${Number(lateStart.body.session.id)}`);
  assert.equal((await http(`/api/v5/events/${eventId}/session/submit`, {
    method: 'POST', token: latePlayer.token,
    body: { answers: await soloAnswers(lateStart.body.session.id), clientRequestId: 'v5-late-submit' },
  })).status, 200);
  const [lateItem] = await d1(`SELECT link.status AS link_status,item.status AS item_status FROM v5_session_items link
    JOIN v5_inventory_items item ON item.id=link.inventory_item_id WHERE link.session_id=${Number(lateStart.body.session.id)}`);
  assert.deepEqual([lateItem.link_status, lateItem.item_status], ['consumed', 'consumed'], 'late series cannot leave a lens armed');

  const voidPlayer = userRows[3];
  await d1(`INSERT INTO v5_inventory_items (user_id,item_kind,source_kind,source_key,created_request_id)
    VALUES ((SELECT id FROM users WHERE tg_id=${voidPlayer.tgId}),'lens','campaign','check:void-lens','check:void-lens')`);
  const [voidLens] = await d1(`SELECT id FROM v5_inventory_items WHERE source_key='check:void-lens'`);
  const voidStart = await http(`/api/v5/events/${eventId}/session/start`, {
    method: 'POST', token: voidPlayer.token,
    body: { sectorId: Number(objective.sector), action: objective.action, itemId: Number(voidLens.id), clientRequestId: 'v5-void-start' },
  });
  assert.equal(voidStart.status, 200, JSON.stringify(voidStart.body));
  mark('late and pending item sessions prepared');

  const starts = await Promise.all(['a', 'b'].map((suffix) => http(`/api/v5/events/${eventId}/session/start`, {
    method: 'POST', token: first.token,
    body: { sectorId: Number(objective.sector), action: objective.action, clientRequestId: `v5-parallel-start-${suffix}` },
  })));
  assert.ok(starts.every((row) => row.status === 200), JSON.stringify(starts));
  assert.equal(starts[0].body.session.id, starts[1].body.session.id, 'parallel starts create one session');
  const firstAnswers = await soloAnswers(starts[0].body.session.id);
  const submits = await Promise.all(['a', 'b'].map((suffix) => http(`/api/v5/events/${eventId}/session/submit`, {
    method: 'POST', token: first.token, body: { answers: firstAnswers, clientRequestId: `v5-parallel-submit-${suffix}` },
  })));
  assert.ok(submits.every((row) => row.status === 200), JSON.stringify(submits));
  const [single] = await d1(`SELECT
    (SELECT count(*) FROM v5_sessions WHERE event_id=${eventId} AND user_id=(SELECT id FROM users WHERE tg_id=${first.tgId})) AS sessions,
    (SELECT count(*) FROM v5_session_submissions WHERE session_id=${Number(starts[0].body.session.id)}) AS submissions,
    (SELECT count(*) FROM v5_event_actions WHERE event_id=${eventId} AND user_id=(SELECT id FROM users WHERE tg_id=${first.tgId})) AS actions`);
  assert.deepEqual([Number(single.sessions), Number(single.submissions), Number(single.actions)], [1, 1, 1]);

  const raidPlayers = userRows.slice(0, 4);
  const joins = await Promise.all(raidPlayers.map((player) => http(`/api/v5/events/${eventId}/raids/join`, {
    method: 'POST', token: player.token,
    body: { sectorId: Number(objective.sector), action: objective.action, clientRequestId: `v5-raid-join-${player.tgId}` },
  })));
  assert.ok(joins.every((row) => row.status === 200), JSON.stringify(joins));
  const [raid] = await d1(`SELECT id,status FROM v5_raids WHERE event_id=${eventId}`);
  assert.equal(raid.status, 'ready');
  const raidRoles = await d1(`SELECT DISTINCT assigned_role FROM v5_raid_members WHERE raid_id=${Number(raid.id)} ORDER BY assigned_role`);
  assert.deepEqual(raidRoles.map((row) => row.assigned_role), ['claim', 'hold', 'scout']);
  for (const player of raidPlayers) {
    const start = await http(`/api/v5/events/${eventId}/raids/start`, { method: 'POST', token: player.token, body: { clientRequestId: `v5-raid-start-${player.tgId}` } });
    assert.equal(start.status, 200, JSON.stringify(start.body));
    const submit = await http(`/api/v5/events/${eventId}/raids/submit`, { method: 'POST', token: player.token, body: { answers: await raidAnswers(raid.id, player.tgId), clientRequestId: `v5-raid-submit-${player.tgId}` } });
    assert.equal(submit.status, 200, JSON.stringify(submit.body));
  }
  const [raidResult] = await d1(`SELECT status FROM v5_raids WHERE id=${Number(raid.id)}`);
  const [raidItems] = await d1("SELECT count(*) AS n FROM v5_inventory_items WHERE source_kind='raid'");
  assert.equal(raidResult.status, 'resolved');
  assert.equal(Number(raidItems.n), 4, 'raid creates one bounded item per successful member');
  mark('raid resolved');

  // Two distinct last-hit submissions are deliberately concurrent. Only the
  // first one that advances the durable progress row may receive an applied
  // action; the other becomes void and cannot farm a closed objective.
  await d1(`UPDATE v5_event_objectives SET progress=MAX(0,threshold-2) WHERE event_id=${eventId}`);
  const second = userRows[1];
  const racePlayer = userRows[4];
  const secondStart = await http(`/api/v5/events/${eventId}/session/start`, {
    method: 'POST', token: second.token, body: { sectorId: Number(objective.sector), action: objective.action, clientRequestId: 'v5-second-start' },
  });
  assert.equal(secondStart.status, 200);
  const raceStart = await http(`/api/v5/events/${eventId}/session/start`, {
    method: 'POST', token: racePlayer.token, body: { sectorId: Number(objective.sector), action: objective.action, clientRequestId: 'v5-last-hit-start' },
  });
  assert.equal(raceStart.status, 200);
  const lastHits = await Promise.all([
    http(`/api/v5/events/${eventId}/session/submit`, {
      method: 'POST', token: second.token, body: { answers: await soloAnswers(secondStart.body.session.id), clientRequestId: 'v5-second-submit' },
    }),
    http(`/api/v5/events/${eventId}/session/submit`, {
      method: 'POST', token: racePlayer.token, body: { answers: await soloAnswers(raceStart.body.session.id), clientRequestId: 'v5-last-hit-submit' },
    }),
  ]);
  assert.ok(lastHits.every((row) => row.status === 200), JSON.stringify(lastHits));
  const lastHitActions = await d1(`SELECT status FROM v5_event_actions WHERE event_id=${eventId}
    AND user_id IN (SELECT id FROM users WHERE tg_id IN (${second.tgId},${racePlayer.tgId})) ORDER BY status`);
  assert.deepEqual(lastHitActions.map((row) => row.status), ['applied', 'void'], 'only one simultaneous last hit can apply');
  const [branch] = await d1(`SELECT state FROM v5_campaign_sectors WHERE campaign_id=(SELECT campaign_id FROM v5_events WHERE id=${eventId}) AND sector=${Number(objective.sector)}`);
  assert.equal(branch.state, 'secured', 'capped solo moves must resolve branch once');
  assert.equal((await http(`/api/v5/events/${eventId}/session/submit`, {
    method: 'POST', token: voidPlayer.token,
    body: { answers: await soloAnswers(voidStart.body.session.id), clientRequestId: 'v5-void-submit' },
  })).status, 200);
  const [voidItem] = await d1(`SELECT link.status AS link_status,item.status AS item_status FROM v5_session_items link
    JOIN v5_inventory_items item ON item.id=link.inventory_item_id WHERE link.session_id=${Number(voidStart.body.session.id)}`);
  assert.deepEqual([voidItem.link_status, voidItem.item_status], ['consumed', 'consumed'], 'a void series cannot leave its lens armed');
  mark('void session resolved');

  await d1(`UPDATE v5_events
    SET opens_at=datetime('now','-3 seconds'), forecast_deadline=datetime('now','-2 seconds'), locks_at=datetime('now','-1 second')
    WHERE id=${eventId}`);
  assert.equal((await http('/api/v1/dev/cron', { method: 'POST', body: { cron: '0 * * * *' } })).status, 200);
  const [settlement] = await d1(`SELECT p.status,p.payout,w.eggs,e.status AS event_status FROM v5_predictions p
    JOIN v5_wallets w ON w.user_id=p.user_id JOIN v5_events e ON e.id=p.event_id
    WHERE p.event_id=${eventId} AND p.user_id=(SELECT id FROM users WHERE tg_id=${first.tgId})`);
  assert.deepEqual([settlement.status, Number(settlement.payout), Number(settlement.eggs), settlement.event_status], ['won', 2, 3, 'resolved']);
  const [rolloverCompleted] = await d1(`SELECT
    (SELECT status FROM v5_campaigns WHERE id=${campaignId}) AS old_status,
    (SELECT count(*) FROM v5_campaigns WHERE chat_id=(SELECT chat_id FROM v5_campaigns WHERE id=${campaignId}) AND status='active') AS active_campaigns,
    (SELECT count(*) FROM v5_events WHERE campaign_id=${campaignId} AND status IN ('open','locked')) AS old_live_events`);
  assert.deepEqual([rolloverCompleted.old_status, Number(rolloverCompleted.active_campaigns), Number(rolloverCompleted.old_live_events)], ['resolved', 1, 0]);
  mark('rollover resolved');

  // Server-side macro loop: a scout exposes a real planned storm, the storm
  // lowers one persisted sector once, and two empty windows reopen a route.
  const [nextCampaign] = await d1(`SELECT id FROM v5_campaigns WHERE chat_id=(SELECT chat_id FROM v5_campaigns WHERE id=${campaignId}) AND status='active'`);
  const nextCampaignId = Number(nextCampaign.id);
  await d1(`UPDATE v5_campaign_sectors SET state=CASE WHEN sector=0 THEN 'rooted' ELSE 'hidden' END, ward_count=0 WHERE campaign_id=${nextCampaignId}`);
  await webhook(groupCommand(29_001, '/kontur open'));
  const [stormEvent] = await d1(`SELECT id,storm_sector FROM v5_events WHERE campaign_id=${nextCampaignId} AND status='open'`);
  const [stormObjective] = await d1(`SELECT sector,action FROM v5_event_objectives WHERE event_id=${Number(stormEvent.id)}`);
  assert.equal(Number(stormEvent.storm_sector), 0, 'a scout event receives a planned storm on a durable protected sector');
  assert.equal((await http('/api/v5/birds/active', {
    method: 'POST', token: first.token,
    body: { eventId: Number(stormEvent.id), bird: first.bird, clientRequestId: 'v5-next-campaign-bird' },
  })).status, 200);
  await d1(`INSERT INTO v5_inventory_items (user_id,item_kind,source_kind,source_key,created_request_id)
    VALUES ((SELECT id FROM users WHERE tg_id=${first.tgId}),'lens','campaign','check:cron-lens','check:cron-lens')`);
  const [cronLens] = await d1(`SELECT id FROM v5_inventory_items WHERE source_key='check:cron-lens'`);
  await d1(`UPDATE v5_events
    SET opens_at=datetime('now','-2 seconds'), forecast_deadline=datetime('now','-1 second')
    WHERE id=${Number(stormEvent.id)}`);
  const cronStart = await http(`/api/v5/events/${Number(stormEvent.id)}/session/start`, {
    method: 'POST', token: first.token,
    body: { sectorId: Number(stormObjective.sector), action: stormObjective.action, itemId: Number(cronLens.id), clientRequestId: 'v5-cron-start' },
  });
  assert.equal(cronStart.status, 200, JSON.stringify(cronStart.body));
  await d1(`UPDATE v5_events
    SET opens_at=datetime('now','-3 seconds'), forecast_deadline=datetime('now','-2 seconds'), locks_at=datetime('now','-1 second')
    WHERE id=${Number(stormEvent.id)}`);
  assert.equal((await http('/api/v1/dev/cron', { method: 'POST', body: { cron: '0 * * * *' } })).status, 200);
  const [cronItem] = await d1(`SELECT s.status AS session_status,link.status AS link_status,item.status AS item_status
    FROM v5_sessions s JOIN v5_session_items link ON link.session_id=s.id
      JOIN v5_inventory_items item ON item.id=link.inventory_item_id
    WHERE s.id=${Number(cronStart.body.session.id)}`);
  assert.deepEqual([cronItem.session_status, cronItem.link_status, cronItem.item_status], ['timed_out', 'consumed', 'consumed'], 'cron closes an abandoned item series cleanly');
  mark('abandoned session settled by cron');
  const [stormResult] = await d1(`SELECT state FROM v5_campaign_sectors WHERE campaign_id=${nextCampaignId} AND sector=0`);
  const [stormMutation] = await d1(`SELECT count(*) AS n FROM v5_map_mutations WHERE event_id=${Number(stormEvent.id)} AND mutation_kind='storm'`);
  assert.deepEqual([stormResult.state, Number(stormMutation.n)], ['secured', 1]);

  await webhook(groupCommand(29_002, '/kontur open'));
  const [emptyEvent] = await d1(`SELECT id FROM v5_events WHERE campaign_id=${nextCampaignId} AND status='open'`);
  await d1(`UPDATE v5_events
    SET opens_at=datetime('now','-3 seconds'), forecast_deadline=datetime('now','-2 seconds'), locks_at=datetime('now','-1 second')
    WHERE id=${Number(emptyEvent.id)}`);
  assert.equal((await http('/api/v1/dev/cron', { method: 'POST', body: { cron: '0 * * * *' } })).status, 200);
  const [safety] = await d1(`SELECT state FROM v5_campaign_sectors WHERE campaign_id=${nextCampaignId} AND sector=1`);
  const [safetyMutation] = await d1(`SELECT count(*) AS n FROM v5_map_mutations WHERE event_id=${Number(emptyEvent.id)} AND mutation_kind='safety_rail'`);
  assert.deepEqual([safety.state, Number(safetyMutation.n)], ['exposed', 1]);
  console.log('✔ V5 API: pretest, forecast, solo, branch, raid, idempotency and resolver pass');
} finally {
  if (worker && worker.exitCode === null) {
    worker.kill('SIGTERM');
    await Promise.race([new Promise((done) => worker.once('exit', done)), delay(5_000)]);
    if (worker.exitCode === null) worker.kill('SIGKILL');
  }
  await rm(stateDir, { recursive: true, force: true });
}
