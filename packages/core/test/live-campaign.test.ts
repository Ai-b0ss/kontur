import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  LIVE_CAMPAIGN_BIRDS,
  addLiveCampaignInventoryItem,
  applyLiveCampaignSafetyRail,
  armLiveCampaignItem,
  canUnlockLiveCampaignFormII,
  canUseLiveCampaignSoloMove,
  consumeLiveCampaignItem,
  createLiveCampaignChallenge,
  createLiveCampaignMap,
  evaluateLiveCampaignChallenge,
  hasLiveCampaignDominantOption,
  joinLiveCampaignRaid,
  liveCampaignContribution,
  liveCampaignSchedule,
  liveCampaignThreshold,
  placeLiveCampaignForecast,
  resolveLiveCampaignAction,
  resolveLiveCampaignForecast,
  resolveLiveCampaignFormII,
  resolveLiveCampaignRaid,
  resolveLiveCampaignStorm,
  scheduleLiveCampaignStorm,
  selectLiveCampaignActiveBird,
  simulateLiveCampaign,
  toLiveCampaignChallengeClient,
} from '../src/index.ts';

describe('V5 challenge', () => {
  test('строит одну воспроизводимую серию из пяти карточек и не отдаёт seed или ответы клиенту', () => {
    const map = scheduleLiveCampaignStorm(createLiveCampaignMap(0), 0);
    const input = { seed: 7331, bird: 'owl' as const, action: 'claim' as const, sectorId: 0, map };
    const first = createLiveCampaignChallenge(input);
    const repeated = createLiveCampaignChallenge(input);
    const client = toLiveCampaignChallengeClient(first);

    assert.deepEqual(first, repeated);
    assert.equal(first.cards.length, 5);
    assert.deepEqual(first.cards.map((card) => card.kind), ['base', 'track', 'chain', 'tactical', 'risk']);
    assert.ok(first.cards.every((card) => card.options.length === 4 && card.answer >= 0 && card.answer < 4));
    assert.equal('seed' in client, false);
    assert.ok(client.cards.every((card) => !('answer' in card)));
    assert.equal(JSON.stringify(client).includes('answer'), false);
  });

  test('варьирует карточки по server seed, но не прячет seed в client id или payload', () => {
    const map = scheduleLiveCampaignStorm(createLiveCampaignMap(0), 4, false);
    const challenges = [1_000_019, 1_000_029, 1_000_041, 1_000_067, 1_000_083, 1_000_107, 1_000_131, 1_000_173].map((seed) => createLiveCampaignChallenge({
      seed, bird: 'woodpecker', action: 'claim', sectorId: 0, map,
    }));
    const signatures = new Set(challenges.map((challenge) => challenge.cards
      .map((card) => `${card.prompt}\u0000${card.options.join('\u0001')}`).join('\u0002')));
    const answerPositions = new Set(challenges.map((challenge) => challenge.cards[3]?.answer));

    assert.ok(signatures.size >= 6, 'разные server seed должны давать разные тексты/варианты, а не только другую сессию');
    assert.ok(answerPositions.size >= 2, 'тактический ответ не должен всегда лежать в одной позиции');
    for (const challenge of challenges) {
      const client = toLiveCampaignChallengeClient(challenge);
      assert.deepEqual(Object.keys(client).sort(), ['action', 'bird', 'cards', 'sectorId']);
      assert.deepEqual(client.cards.map((card) => card.id), ['base-1', 'track-2', 'chain-3', 'tactical-4', 'risk-5']);
      assert.ok(client.cards.every((card) =>
        JSON.stringify(Object.keys(card).sort()) === JSON.stringify(['id', 'kind', 'options', 'prompt'])));
      const serialized = JSON.stringify(client);
      assert.equal(serialized.includes(`"seed"`), false);
      assert.equal(serialized.includes(`"answer"`), false);
      assert.equal(serialized.includes(String(challenge.seed)), false);
    }
  });

  test('привязывает tactical/risk к фактической карте и не раскрывает скрытую цель шторма', () => {
    const exposedMap = createLiveCampaignMap(0);
    const hiddenMap = { ...exposedMap, sectors: exposedMap.sectors.map((sector) => ({ ...sector, state: 'hidden' as const })) };
    const validClaim = createLiveCampaignChallenge({ seed: 501, bird: 'magpie', action: 'claim', sectorId: 0, map: exposedMap });
    const invalidClaim = createLiveCampaignChallenge({ seed: 501, bird: 'magpie', action: 'claim', sectorId: 0, map: hiddenMap });
    const validTactical = validClaim.cards.find((card) => card.kind === 'tactical')!;
    const invalidTactical = invalidClaim.cards.find((card) => card.kind === 'tactical')!;
    assert.match(validTactical.options[validTactical.answer]!, /exposed в secured/);
    assert.match(invalidTactical.options[invalidTactical.answer]!, /только к exposed/);

    const secretStorm = scheduleLiveCampaignStorm(exposedMap, 4, false);
    const publicStorm = scheduleLiveCampaignStorm(exposedMap, 4, true);
    const secretRisk = createLiveCampaignChallenge({ seed: 502, bird: 'owl', action: 'scout', sectorId: 0, map: secretStorm })
      .cards.find((card) => card.kind === 'risk')!;
    const publicRisk = createLiveCampaignChallenge({ seed: 502, bird: 'owl', action: 'scout', sectorId: 0, map: publicStorm })
      .cards.find((card) => card.kind === 'risk')!;
    assert.equal(`${secretRisk.prompt} ${secretRisk.options.join(' ')}`.includes('сектор 5'), false);
    assert.match(publicRisk.prompt, /сектор 5/);

    const securedMap = {
      ...exposedMap,
      sectors: exposedMap.sectors.map((sector) => ({ ...sector, state: sector.id === 0 ? 'secured' as const : sector.state })),
    };
    const wardingHold = createLiveCampaignChallenge({
      seed: 503, bird: 'crane', action: 'hold', sectorId: 0, map: scheduleLiveCampaignStorm(securedMap, 0, true),
    }).cards.find((card) => card.kind === 'tactical')!;
    const rootingHold = createLiveCampaignChallenge({
      seed: 503, bird: 'crane', action: 'hold', sectorId: 0, map: scheduleLiveCampaignStorm(securedMap, 1, true),
    }).cards.find((card) => card.kind === 'tactical')!;
    assert.match(wardingHold.options[wardingHold.answer]!, /ward/);
    assert.match(rootingHold.options[rootingHold.answer]!, /secured в rooted/);
  });

  test('считает вклад только после пяти карточек и тактического gate', () => {
    const challenge = createLiveCampaignChallenge({
      seed: 11,
      bird: 'crane',
      action: 'scout',
      sectorId: 1,
      map: createLiveCampaignMap(0),
    });
    const allCorrect = challenge.cards.map((card) => card.answer);
    const five = evaluateLiveCampaignChallenge(challenge, allCorrect);
    const wrongTactical = [...allCorrect];
    wrongTactical[3] = (wrongTactical[3]! + 1) % 4;
    const fourWithoutTactical = evaluateLiveCampaignChallenge(challenge, wrongTactical);
    const two = evaluateLiveCampaignChallenge(challenge, [allCorrect[0], allCorrect[1], -1, -1, -1]);

    assert.deepEqual(five, { correct: 5, tacticalCorrect: true, contribution: 2 });
    assert.deepEqual(fourWithoutTactical, { correct: 4, tacticalCorrect: false, contribution: 1 });
    assert.deepEqual(two, { correct: 2, tacticalCorrect: false, contribution: 1 });
    assert.equal(liveCampaignContribution(0, false), 0);
    assert.equal(liveCampaignContribution(1, true), 0);
    assert.equal(liveCampaignContribution(3, false), 1);
    assert.equal(liveCampaignContribution(4, false), 1);
    assert.equal(liveCampaignContribution(4, true), 2);
  });
});

describe('V5 tree', () => {
  test('держит семь секторов и отдельно применяет scout, claim, hold, ward и шторм', () => {
    const threshold = liveCampaignThreshold(3, 1);
    let map = createLiveCampaignMap(0);
    const claimed = resolveLiveCampaignAction(map, { action: 'claim', sectorId: 0, contribution: threshold, threshold });
    assert.equal(claimed.note, 'secured');
    map = claimed.map;

    const rooted = resolveLiveCampaignAction(map, { action: 'hold', sectorId: 0, contribution: threshold, threshold });
    assert.equal(rooted.note, 'rooted');
    map = scheduleLiveCampaignStorm(rooted.map, 0, false);
    const warded = resolveLiveCampaignAction(map, { action: 'hold', sectorId: 0, contribution: threshold, threshold });
    assert.equal(warded.note, 'warded');
    assert.equal(warded.map.sectors[0]?.wards, 1);

    const afterStorm = resolveLiveCampaignStorm(warded.map);
    assert.equal(afterStorm.note, 'ward_absorbed');
    assert.equal(afterStorm.map.sectors[0]?.state, 'rooted');
    assert.equal(afterStorm.map.sectors[0]?.wards, 0);

    const scouted = resolveLiveCampaignAction(afterStorm.map, { action: 'scout', sectorId: 1, contribution: threshold, threshold });
    assert.equal(scouted.note, 'exposed');
    assert.equal(scouted.map.sectors[1]?.state, 'exposed');
    assert.equal(scouted.map.sectors.length, 7);
  });

  test('не даёт change без порога и safety rail раскрывает путь после двух пустых окон', () => {
    const map = createLiveCampaignMap(0);
    const denied = resolveLiveCampaignAction(map, { action: 'claim', sectorId: 0, contribution: 2, threshold: 3 });
    assert.equal(denied.note, 'insufficient');
    const noExposed = { ...map, sectors: map.sectors.map((sector) => ({ ...sector, state: 'hidden' as const })) };
    const rail = applyLiveCampaignSafetyRail(noExposed, 2);
    assert.equal(rail.applied, true);
    assert.equal(rail.map.sectors.filter((sector) => sector.state === 'exposed').length, 1);
  });

  test('использует точную формулу порога с двумя clamp-границами', () => {
    assert.equal(liveCampaignThreshold(0, 1), 3);
    assert.equal(liveCampaignThreshold(3, 1), 3);
    assert.equal(liveCampaignThreshold(20, 1), 9);
    assert.equal(liveCampaignThreshold(250, 4), 12);
  });
});

describe('кампания, птицы и предметы', () => {
  test('считает 28-дневную кампанию и три окна в неделю', () => {
    assert.deepEqual(liveCampaignSchedule(0), { number: 0, day: 1, daysLeft: 27, week: 1, isWindowDay: true });
    assert.equal(liveCampaignSchedule(1).isWindowDay, false);
    assert.equal(liveCampaignSchedule(2).isWindowDay, true);
    assert.deepEqual(liveCampaignSchedule(27), { number: 0, day: 28, daysLeft: 0, week: 4, isWindowDay: false });
    assert.equal(liveCampaignSchedule(28).number, 1);
  });

  test('даёт форму II на восьми перьях и фиксирует одну активную птицу на кампанию', () => {
    const roster = {
      birds: [{ bird: 'woodpecker' as const, form: 1 as const, pathFeathers: 8 }],
      activeBird: null,
      campaignStarted: false,
    };
    assert.equal(canUnlockLiveCampaignFormII(8), true);
    const active = selectLiveCampaignActiveBird(roster, 'woodpecker');
    assert.equal(active.accepted, true);
    if (!active.accepted) return;
    const locked = selectLiveCampaignActiveBird({ ...active.roster, campaignStarted: true }, 'crane');
    assert.equal(locked.accepted, false);
    const unlocked = resolveLiveCampaignFormII(active.roster, 'woodpecker', { kind: 'unlock', targetBird: 'owl' });
    assert.equal(unlocked.accepted, true);
    if (!unlocked.accepted) return;
    assert.deepEqual(unlocked.roster.birds.find((bird) => bird.bird === 'owl'), { bird: 'owl', form: 2, pathFeathers: 0 });
  });

  test('позволяет вооружить только один предмет до старта и расходует его один раз', () => {
    const one = addLiveCampaignInventoryItem([], { id: 'thread-1', kind: 'signal-thread', status: 'owned' });
    assert.equal(one.accepted, true);
    if (!one.accepted) return;
    const armed = armLiveCampaignItem(one.inventory, 'thread-1', 'scout', false);
    assert.equal(armed.accepted, true);
    if (!armed.accepted) return;
    const consumed = consumeLiveCampaignItem(armed.inventory, {
      itemId: 'thread-1', action: 'scout', evidenceScore: 4, actionResolved: true,
    });
    assert.deepEqual(consumed, {
      accepted: true,
      inventory: [{ id: 'thread-1', kind: 'signal-thread', status: 'consumed' }],
      effect: 'scout_bonus',
    });
    const sharpening = addLiveCampaignInventoryItem([], { id: 'sharp-1', kind: 'sharpening-feather', status: 'owned' });
    assert.equal(sharpening.accepted, true);
    if (!sharpening.accepted) return;
    const sharpened = armLiveCampaignItem(sharpening.inventory, 'sharp-1', 'claim', false);
    assert.equal(sharpened.accepted, true);
    if (!sharpened.accepted) return;
    assert.equal(consumeLiveCampaignItem(sharpened.inventory, {
      itemId: 'sharp-1', action: 'claim', evidenceScore: 3, actionResolved: false,
    }).accepted, true);
    const late = armLiveCampaignItem(one.inventory, 'thread-1', 'scout', true);
    assert.equal(late.accepted, false);
  });
});

describe('прогнозы и рейды', () => {
  test('прогноз тратит одно яйцо, закрывается первым влияющим ходом и idempotently решается', () => {
    const forecast = placeLiveCampaignForecast({
      existing: null, eggBalance: 1, forecastWindowClosed: false, influencingMoveStarted: false, prediction: 'sector_resolves',
    });
    assert.equal(forecast.accepted, true);
    const closed = placeLiveCampaignForecast({
      existing: null, eggBalance: 2, forecastWindowClosed: false, influencingMoveStarted: true, prediction: 'sector_misses',
    });
    assert.deepEqual(closed, { accepted: false, reason: 'forecast_closed' });
    if (!forecast.accepted) return;
    const won = resolveLiveCampaignForecast(forecast.forecast, 'resolved');
    assert.deepEqual(won, { forecast: { prediction: 'sector_resolves', status: 'won' }, eggPayout: 2, settled: true });
    assert.equal(resolveLiveCampaignForecast(won.forecast, 'resolved').settled, false);
  });

  test('рейд из трёх растворяется, а готовый рейд требует роли и 60% валидных вкладов', () => {
    const trio = { targetSector: 0, members: [
      { memberKey: 'a', role: 'scout' as const }, { memberKey: 'b', role: 'claim' as const }, { memberKey: 'c', role: 'hold' as const },
    ] };
    assert.equal(resolveLiveCampaignRaid(trio, []).status, 'dissolved');
    assert.equal(canUseLiveCampaignSoloMove(trio), true);

    const joined = joinLiveCampaignRaid(trio, { memberKey: 'd', role: 'scout' });
    assert.equal(joined.accepted, true);
    if (!joined.accepted) return;
    const resolved = resolveLiveCampaignRaid(joined.queue, [
      { memberKey: 'a', role: 'scout', valid: true },
      { memberKey: 'b', role: 'claim', valid: true },
      { memberKey: 'c', role: 'hold', valid: true },
      { memberKey: 'd', role: 'scout', valid: false },
    ]);
    assert.deepEqual(resolved, { status: 'success', validContributions: 3, requiredContributions: 3, missingRoles: [], reward: 'item_and_route' });
  });
});

describe('баланс smoke-simulation', () => {
  test('3, 20 и 250 активных игроков не запирают дерево и не создают dominant action/form', () => {
    for (const activePlayers of [3, 20, 250]) {
      const simulation = simulateLiveCampaign(activePlayers, { seed: activePlayers });
      assert.equal(simulation.deadlocked, false, `${activePlayers}: tree deadlocked`);
      assert.ok(simulation.resolvedEvents > 0, `${activePlayers}: no resolved events`);
      assert.ok(Object.values(simulation.actionAttempts).every((attempts) => attempts > 0));
      assert.equal(hasLiveCampaignDominantOption(simulation.actionUtilities), false);
      assert.equal(hasLiveCampaignDominantOption(simulation.formUtilities), false);
    }
  });

  test('симулятор замечает будущий скрытый бафф сильнее 10%', () => {
    const altered = simulateLiveCampaign(20, { formManeuverValues: { [LIVE_CAMPAIGN_BIRDS[0]]: 1.2 } });
    assert.equal(hasLiveCampaignDominantOption(altered.formUtilities), true);
  });
});
