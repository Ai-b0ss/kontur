/**
 * Чистые правила V5 «Живая кампания».
 *
 * Этот модуль намеренно не знает о Telegram, D1, времени сервера или user id.
 * Он описывает только воспроизводимые переходы, которые Worker применяет
 * атомарно. Секретный seed и правильные ответы остаются в server shape;
 * отдельный client shape никогда их не содержит.
 */

export const LIVE_CAMPAIGN_LENGTH_DAYS = 28;
export const LIVE_CAMPAIGN_SECTOR_COUNT = 7;
export const LIVE_CAMPAIGN_MAX_PERSONAL_CONTRIBUTION = 2;
export const LIVE_CAMPAIGN_FORM_II_FEATHERS = 8;
export const LIVE_CAMPAIGN_INVENTORY_LIMIT = 3;

export const LIVE_CAMPAIGN_BIRDS = ['woodpecker', 'magpie', 'owl', 'crane'] as const;
export type LiveCampaignBird = typeof LIVE_CAMPAIGN_BIRDS[number];

export const LIVE_CAMPAIGN_ACTIONS = ['scout', 'claim', 'hold'] as const;
export type LiveCampaignAction = typeof LIVE_CAMPAIGN_ACTIONS[number];

export const LIVE_CAMPAIGN_SECTOR_STATES = ['hidden', 'exposed', 'secured', 'rooted'] as const;
export type LiveCampaignSectorState = typeof LIVE_CAMPAIGN_SECTOR_STATES[number];

export interface LiveCampaignSector {
  id: number;
  state: LiveCampaignSectorState;
  /** Один ward съедает ровно один плановый шторм. */
  wards: number;
}

export interface LiveCampaignStorm {
  targetSector: number;
  /** До успешной разведки Mini App не показывает цель следующего шторма. */
  revealed: boolean;
}

export interface LiveCampaignMap {
  sectors: readonly LiveCampaignSector[];
  storm: LiveCampaignStorm | null;
}

export interface LiveCampaignSchedule {
  number: number;
  day: number;
  daysLeft: number;
  week: number;
  /** Три окна в неделю: дни 1, 3 и 5. */
  isWindowDay: boolean;
}

export function liveCampaignSchedule(gameDay: number): LiveCampaignSchedule {
  assertNonNegativeInteger(gameDay, 'gameDay');
  const number = Math.floor(gameDay / LIVE_CAMPAIGN_LENGTH_DAYS);
  const offset = gameDay % LIVE_CAMPAIGN_LENGTH_DAYS;
  const day = offset + 1;
  const weekdayOffset = offset % 7;
  return {
    number,
    day,
    daysLeft: LIVE_CAMPAIGN_LENGTH_DAYS - day,
    week: Math.floor(offset / 7) + 1,
    isWindowDay: weekdayOffset === 0 || weekdayOffset === 2 || weekdayOffset === 4,
  };
}

/** Порог из продуктовой спецификации; маленький чат никогда не получает порог ниже трёх. */
export function liveCampaignThreshold(activePlayers7d: number, eventTier: number): number {
  assertNonNegativeInteger(activePlayers7d, 'activePlayers7d');
  if (!Number.isInteger(eventTier) || eventTier < 1) throw new RangeError('eventTier must be a positive integer');
  const raw = 2 + Math.ceil(activePlayers7d / 3) + eventTier - 1;
  return Math.min(12, Math.max(3, raw));
}

export function createLiveCampaignMap(firstExposedSector = 0): LiveCampaignMap {
  assertSectorId(firstExposedSector);
  return {
    sectors: Array.from({ length: LIVE_CAMPAIGN_SECTOR_COUNT }, (_, id) => ({
      id,
      state: id === firstExposedSector ? 'exposed' as const : 'hidden' as const,
      wards: 0,
    })),
    storm: null,
  };
}

export function scheduleLiveCampaignStorm(
  map: LiveCampaignMap,
  targetSector: number,
  revealed = false,
): LiveCampaignMap {
  assertLiveCampaignMap(map);
  assertSectorId(targetSector);
  return { sectors: cloneSectors(map.sectors), storm: { targetSector, revealed } };
}

export interface LiveCampaignActionInput {
  action: LiveCampaignAction;
  sectorId: number;
  /** Агрегированный серверный вклад события, а не неограниченный клиентский счётчик. */
  contribution: number;
  threshold: number;
}

export type LiveCampaignActionNote =
  | 'insufficient'
  | 'invalid_state'
  | 'exposed'
  | 'secured'
  | 'rooted'
  | 'warded';

export interface LiveCampaignActionResolution {
  map: LiveCampaignMap;
  applied: boolean;
  note: LiveCampaignActionNote;
  /** Возвращается только после успешного scout. */
  revealedStormTarget: number | null;
}

/**
 * Разные действия меняют разные поля карты:
 * scout: hidden → exposed и открывает риск;
 * claim: exposed → secured;
 * hold: ward против шторма либо secured → rooted.
 */
export function resolveLiveCampaignAction(
  map: LiveCampaignMap,
  input: LiveCampaignActionInput,
): LiveCampaignActionResolution {
  assertLiveCampaignMap(map);
  assertSectorId(input.sectorId);
  assertNonNegativeInteger(input.contribution, 'contribution');
  if (!Number.isInteger(input.threshold) || input.threshold < 1) throw new RangeError('threshold must be a positive integer');

  if (input.contribution < input.threshold) {
    return { map: copyMap(map), applied: false, note: 'insufficient', revealedStormTarget: null };
  }

  const sector = map.sectors[input.sectorId]!;
  if (input.action === 'scout') {
    if (sector.state !== 'hidden') return noMapAction(map);
    const storm = map.storm ? { ...map.storm, revealed: true } : null;
    return {
      map: replaceSector(map, { ...sector, state: 'exposed' }, storm),
      applied: true,
      note: 'exposed',
      revealedStormTarget: storm?.targetSector ?? null,
    };
  }

  if (input.action === 'claim') {
    if (sector.state !== 'exposed') return noMapAction(map);
    return {
      map: replaceSector(map, { ...sector, state: 'secured' }),
      applied: true,
      note: 'secured',
      revealedStormTarget: null,
    };
  }

  if (sector.state !== 'secured' && sector.state !== 'rooted') return noMapAction(map);
  if (map.storm?.targetSector === input.sectorId) {
    return {
      map: replaceSector(map, { ...sector, wards: sector.wards + 1 }),
      applied: true,
      note: 'warded',
      revealedStormTarget: null,
    };
  }
  if (sector.state !== 'secured') return noMapAction(map);
  return {
    map: replaceSector(map, { ...sector, state: 'rooted' }),
    applied: true,
    note: 'rooted',
    revealedStormTarget: null,
  };
}

export type LiveCampaignStormNote = 'no_storm' | 'ward_absorbed' | 'lowered' | 'no_effect';

export interface LiveCampaignStormResolution {
  map: LiveCampaignMap;
  note: LiveCampaignStormNote;
}

/** Плановый шторм всегда снимает максимум одну ступень или один ward. */
export function resolveLiveCampaignStorm(map: LiveCampaignMap): LiveCampaignStormResolution {
  assertLiveCampaignMap(map);
  const storm = map.storm;
  if (!storm) return { map: copyMap(map), note: 'no_storm' };
  const sector = map.sectors[storm.targetSector]!;
  if (sector.wards > 0) {
    return {
      map: replaceSector(map, { ...sector, wards: sector.wards - 1 }, null),
      note: 'ward_absorbed',
    };
  }
  const lowered = lowerSectorState(sector.state);
  return {
    map: replaceSector(map, { ...sector, state: lowered }, null),
    note: lowered === sector.state ? 'no_effect' : 'lowered',
  };
}

export interface LiveCampaignSafetyRailResolution {
  map: LiveCampaignMap;
  applied: boolean;
}

/** После двух пустых окон оставляет один путь доступным даже маленькой стае. */
export function applyLiveCampaignSafetyRail(
  map: LiveCampaignMap,
  unresolvedWindows: number,
): LiveCampaignSafetyRailResolution {
  assertLiveCampaignMap(map);
  assertNonNegativeInteger(unresolvedWindows, 'unresolvedWindows');
  if (unresolvedWindows < 2 || map.sectors.some((sector) => sector.state === 'exposed')) {
    return { map: copyMap(map), applied: false };
  }
  const hidden = map.sectors.find((sector) => sector.state === 'hidden');
  if (!hidden) return { map: copyMap(map), applied: false };
  return { map: replaceSector(map, { ...hidden, state: 'exposed' }), applied: true };
}

export type LiveCampaignCardKind = 'base' | 'track' | 'chain' | 'tactical' | 'risk';

export interface LiveCampaignServerCard {
  id: string;
  kind: LiveCampaignCardKind;
  prompt: string;
  options: readonly string[];
  /** Только server shape. Не передавать в Mini App. */
  answer: number;
}

export interface LiveCampaignClientCard {
  id: string;
  kind: LiveCampaignCardKind;
  prompt: string;
  options: readonly string[];
}

export interface LiveCampaignChallengeInput {
  seed: number;
  bird: LiveCampaignBird;
  action: LiveCampaignAction;
  sectorId: number;
  map: LiveCampaignMap;
}

export interface LiveCampaignChallenge {
  seed: number;
  bird: LiveCampaignBird;
  action: LiveCampaignAction;
  sectorId: number;
  cards: readonly LiveCampaignServerCard[];
}

/** Договор API для Mini App: нет ни seed, ни answer. */
export interface LiveCampaignChallengeClient {
  bird: LiveCampaignBird;
  action: LiveCampaignAction;
  sectorId: number;
  cards: readonly LiveCampaignClientCard[];
}

/**
 * Ровно пять воспроизводимых карточек. Вариант задаётся один раз серверным
 * seed. Seed намеренно не попадает ни в id карточки, ни в client shape:
 * клиенту недостаточно заранее выучить маленький статический каталог.
 */
export function createLiveCampaignChallenge(input: LiveCampaignChallengeInput): LiveCampaignChallenge {
  assertLiveCampaignMap(input.map);
  assertSectorId(input.sectorId);
  if (!Number.isInteger(input.seed)) throw new RangeError('seed must be an integer');
  const random = seededRandom(mixChallengeSeed(input.seed, input.bird, input.action, input.sectorId));
  const sector = input.map.sectors[input.sectorId]!;
  // Id описывает только позицию в серии. Число seed остаётся исключительно
  // в server shape/хранилище и не может стать подсказкой для client-side replay.
  const base = baseCard('base-1', random);
  const track = trackCard(input.bird, 'track-2', random);
  const chain = chainCard(input.map, input.action, sector.state, input.sectorId, 'chain-3', random);
  const tactical = tacticalCard(input.map, input.action, input.sectorId, 'tactical-4', random);
  const risk = riskCard(input.map, input.sectorId, 'risk-5', random);
  return { seed: input.seed, bird: input.bird, action: input.action, sectorId: input.sectorId, cards: [base, track, chain, tactical, risk] };
}

export function toLiveCampaignChallengeClient(challenge: LiveCampaignChallenge): LiveCampaignChallengeClient {
  return {
    bird: challenge.bird,
    action: challenge.action,
    sectorId: challenge.sectorId,
    cards: challenge.cards.map(({ id, kind, prompt, options }) => ({ id, kind, prompt, options: [...options] })),
  };
}

export interface LiveCampaignEvidence {
  correct: number;
  tacticalCorrect: boolean;
  contribution: 0 | 1 | 2;
}

/**
 * Вклад не зависит от скорости. 4–5 верных требуют именно правильную
 * тактическую карточку для значения 2; один пользователь никогда не даёт 3.
 */
export function liveCampaignContribution(correct: number, tacticalCorrect: boolean): 0 | 1 | 2 {
  if (!Number.isInteger(correct) || correct < 0 || correct > 5) throw new RangeError('correct must be 0..5');
  if (correct <= 1) return 0;
  if (correct <= 3) return 1;
  return tacticalCorrect ? 2 : 1;
}

export function evaluateLiveCampaignChallenge(
  challenge: LiveCampaignChallenge,
  answers: readonly unknown[],
): LiveCampaignEvidence {
  let correct = 0;
  let tacticalCorrect = false;
  challenge.cards.forEach((card, index) => {
    const isCorrect = answers[index] === card.answer;
    if (isCorrect) correct += 1;
    if (card.kind === 'tactical') tacticalCorrect = isCorrect;
  });
  return { correct, tacticalCorrect, contribution: liveCampaignContribution(correct, tacticalCorrect) };
}

export type LiveCampaignBirdForm = 1 | 2;

export interface LiveCampaignBirdState {
  bird: LiveCampaignBird;
  form: LiveCampaignBirdForm;
  pathFeathers: number;
}

export interface LiveCampaignBirdRoster {
  birds: readonly LiveCampaignBirdState[];
  /** Один скаляр гарантирует не более одной активной птицы. */
  activeBird: LiveCampaignBird | null;
  campaignStarted: boolean;
}

export type LiveCampaignRosterIssue =
  | 'duplicate_bird'
  | 'invalid_feathers'
  | 'active_not_owned'
  | 'active_required_after_start';

export function validateLiveCampaignBirdRoster(roster: LiveCampaignBirdRoster): readonly LiveCampaignRosterIssue[] {
  const issues: LiveCampaignRosterIssue[] = [];
  const seen = new Set<LiveCampaignBird>();
  for (const bird of roster.birds) {
    if (seen.has(bird.bird)) issues.push('duplicate_bird');
    seen.add(bird.bird);
    if (!Number.isInteger(bird.pathFeathers) || bird.pathFeathers < 0) issues.push('invalid_feathers');
  }
  if (roster.activeBird !== null && !seen.has(roster.activeBird)) issues.push('active_not_owned');
  if (roster.campaignStarted && roster.activeBird === null) issues.push('active_required_after_start');
  return [...new Set(issues)];
}

export type LiveCampaignActiveBirdRejection = 'bird_not_owned' | 'campaign_locked' | 'invalid_roster';
export type LiveCampaignActiveBirdDecision =
  | { accepted: true; roster: LiveCampaignBirdRoster }
  | { accepted: false; reason: LiveCampaignActiveBirdRejection; roster: LiveCampaignBirdRoster };

/** До первого хода птицу можно выбрать; после него менять нельзя. */
export function selectLiveCampaignActiveBird(
  roster: LiveCampaignBirdRoster,
  bird: LiveCampaignBird,
): LiveCampaignActiveBirdDecision {
  if (validateLiveCampaignBirdRoster(roster).length > 0) return { accepted: false, reason: 'invalid_roster', roster: copyRoster(roster) };
  if (!roster.birds.some((entry) => entry.bird === bird)) return { accepted: false, reason: 'bird_not_owned', roster: copyRoster(roster) };
  if (roster.campaignStarted && roster.activeBird !== null && roster.activeBird !== bird) {
    return { accepted: false, reason: 'campaign_locked', roster: copyRoster(roster) };
  }
  return { accepted: true, roster: { ...copyRoster(roster), activeBird: bird } };
}

export function canUnlockLiveCampaignFormII(pathFeathers: number): boolean {
  return Number.isInteger(pathFeathers) && pathFeathers >= LIVE_CAMPAIGN_FORM_II_FEATHERS;
}

export type LiveCampaignFormIIChoice =
  | { kind: 'evolve'; targetBird: LiveCampaignBird }
  | { kind: 'unlock'; targetBird: LiveCampaignBird };

export type LiveCampaignFormIIRejection = 'invalid_roster' | 'source_unavailable' | 'not_enough_feathers' | 'invalid_choice' | 'already_owned';
export type LiveCampaignFormIIDecision =
  | { accepted: true; roster: LiveCampaignBirdRoster }
  | { accepted: false; reason: LiveCampaignFormIIRejection; roster: LiveCampaignBirdRoster };

/** Восемь перьев дают либо форму II исходной птицы, либо новую птицу формы II. */
export function resolveLiveCampaignFormII(
  roster: LiveCampaignBirdRoster,
  sourceBird: LiveCampaignBird,
  choice: LiveCampaignFormIIChoice,
): LiveCampaignFormIIDecision {
  if (validateLiveCampaignBirdRoster(roster).length > 0) return { accepted: false, reason: 'invalid_roster', roster: copyRoster(roster) };
  const source = roster.birds.find((entry) => entry.bird === sourceBird);
  if (!source || source.form !== 1) return { accepted: false, reason: 'source_unavailable', roster: copyRoster(roster) };
  if (!canUnlockLiveCampaignFormII(source.pathFeathers)) return { accepted: false, reason: 'not_enough_feathers', roster: copyRoster(roster) };
  if (choice.kind === 'evolve') {
    if (choice.targetBird !== sourceBird) return { accepted: false, reason: 'invalid_choice', roster: copyRoster(roster) };
    return {
      accepted: true,
      roster: {
        ...copyRoster(roster),
        birds: roster.birds.map((entry) => entry.bird === sourceBird ? { ...entry, form: 2 } : { ...entry }),
      },
    };
  }
  if (choice.targetBird === sourceBird) return { accepted: false, reason: 'invalid_choice', roster: copyRoster(roster) };
  if (roster.birds.some((entry) => entry.bird === choice.targetBird)) {
    return { accepted: false, reason: 'already_owned', roster: copyRoster(roster) };
  }
  return {
    accepted: true,
    roster: {
      ...copyRoster(roster),
      birds: [...roster.birds.map((entry) => ({ ...entry })), { bird: choice.targetBird, form: 2, pathFeathers: 0 }],
    },
  };
}

export const LIVE_CAMPAIGN_ITEM_KINDS = ['sharpening-feather', 'nest-resin', 'lens', 'signal-thread'] as const;
export type LiveCampaignItemKind = typeof LIVE_CAMPAIGN_ITEM_KINDS[number];
export type LiveCampaignItemStatus = 'owned' | 'armed' | 'consumed';

export interface LiveCampaignInventoryItem {
  id: string;
  kind: LiveCampaignItemKind;
  status: LiveCampaignItemStatus;
}

export type LiveCampaignItemEffect = 'claim_bonus' | 'extra_ward' | 'reveal_chain_rule' | 'scout_bonus';

export const LIVE_CAMPAIGN_ITEM_DEFINITIONS: Readonly<Record<LiveCampaignItemKind, {
  allowedActions: readonly LiveCampaignAction[];
  effect: LiveCampaignItemEffect;
  requiresPerfectScore: boolean;
  requiresResolvedAction: boolean;
}>> = {
  // The Worker applies this only to an evidence-one claim and clamps the
  // result at two. Requiring 5/5 here would make a +1 effect impossible.
  'sharpening-feather': { allowedActions: ['claim'], effect: 'claim_bonus', requiresPerfectScore: false, requiresResolvedAction: false },
  'nest-resin': { allowedActions: ['hold'], effect: 'extra_ward', requiresPerfectScore: false, requiresResolvedAction: true },
  lens: { allowedActions: LIVE_CAMPAIGN_ACTIONS, effect: 'reveal_chain_rule', requiresPerfectScore: false, requiresResolvedAction: false },
  'signal-thread': { allowedActions: ['scout'], effect: 'scout_bonus', requiresPerfectScore: false, requiresResolvedAction: true },
};

export type LiveCampaignInventoryRejection = 'inventory_full' | 'duplicate_item_id' | 'invalid_inventory';
export type LiveCampaignInventoryAddDecision =
  | { accepted: true; inventory: readonly LiveCampaignInventoryItem[] }
  | { accepted: false; reason: LiveCampaignInventoryRejection; inventory: readonly LiveCampaignInventoryItem[] };

export function addLiveCampaignInventoryItem(
  inventory: readonly LiveCampaignInventoryItem[],
  item: LiveCampaignInventoryItem,
): LiveCampaignInventoryAddDecision {
  if (!isValidLiveCampaignInventory(inventory) || !isValidInventoryItem(item)) {
    return { accepted: false, reason: 'invalid_inventory', inventory: copyInventory(inventory) };
  }
  if (inventory.some((entry) => entry.id === item.id)) return { accepted: false, reason: 'duplicate_item_id', inventory: copyInventory(inventory) };
  if (inventory.length >= LIVE_CAMPAIGN_INVENTORY_LIMIT) return { accepted: false, reason: 'inventory_full', inventory: copyInventory(inventory) };
  return { accepted: true, inventory: [...copyInventory(inventory), { ...item }] };
}

export type LiveCampaignArmRejection = 'invalid_inventory' | 'event_started' | 'item_not_owned' | 'another_item_armed' | 'action_mismatch';
export type LiveCampaignArmDecision =
  | { accepted: true; inventory: readonly LiveCampaignInventoryItem[] }
  | { accepted: false; reason: LiveCampaignArmRejection; inventory: readonly LiveCampaignInventoryItem[] };

/** Предмет фиксируется до сессии; одновременно вооружить два нельзя. */
export function armLiveCampaignItem(
  inventory: readonly LiveCampaignInventoryItem[],
  itemId: string,
  action: LiveCampaignAction,
  eventStarted: boolean,
): LiveCampaignArmDecision {
  if (!isValidLiveCampaignInventory(inventory)) return { accepted: false, reason: 'invalid_inventory', inventory: copyInventory(inventory) };
  if (eventStarted) return { accepted: false, reason: 'event_started', inventory: copyInventory(inventory) };
  const item = inventory.find((entry) => entry.id === itemId);
  if (!item || item.status !== 'owned') return { accepted: false, reason: 'item_not_owned', inventory: copyInventory(inventory) };
  if (inventory.some((entry) => entry.status === 'armed')) return { accepted: false, reason: 'another_item_armed', inventory: copyInventory(inventory) };
  if (!LIVE_CAMPAIGN_ITEM_DEFINITIONS[item.kind].allowedActions.includes(action)) {
    return { accepted: false, reason: 'action_mismatch', inventory: copyInventory(inventory) };
  }
  return {
    accepted: true,
    inventory: inventory.map((entry) => entry.id === itemId ? { ...entry, status: 'armed' } : { ...entry }),
  };
}

export interface LiveCampaignConsumeItemInput {
  itemId: string;
  action: LiveCampaignAction;
  evidenceScore: number;
  actionResolved: boolean;
}

export type LiveCampaignConsumeRejection = 'invalid_inventory' | 'item_not_armed' | 'action_mismatch' | 'requires_perfect_score' | 'requires_resolved_action';
export type LiveCampaignConsumeDecision =
  | { accepted: true; inventory: readonly LiveCampaignInventoryItem[]; effect: LiveCampaignItemEffect }
  | { accepted: false; reason: LiveCampaignConsumeRejection; inventory: readonly LiveCampaignInventoryItem[] };

/** Consumption only emits a bounded directive; the Worker still clamps the final personal contribution to 2. */
export function consumeLiveCampaignItem(
  inventory: readonly LiveCampaignInventoryItem[],
  input: LiveCampaignConsumeItemInput,
): LiveCampaignConsumeDecision {
  if (!isValidLiveCampaignInventory(inventory)) return { accepted: false, reason: 'invalid_inventory', inventory: copyInventory(inventory) };
  if (!Number.isInteger(input.evidenceScore) || input.evidenceScore < 0 || input.evidenceScore > 5) {
    throw new RangeError('evidenceScore must be 0..5');
  }
  const item = inventory.find((entry) => entry.id === input.itemId);
  if (!item || item.status !== 'armed') return { accepted: false, reason: 'item_not_armed', inventory: copyInventory(inventory) };
  const definition = LIVE_CAMPAIGN_ITEM_DEFINITIONS[item.kind];
  if (!definition.allowedActions.includes(input.action)) return { accepted: false, reason: 'action_mismatch', inventory: copyInventory(inventory) };
  if (definition.requiresPerfectScore && input.evidenceScore !== 5) {
    return { accepted: false, reason: 'requires_perfect_score', inventory: copyInventory(inventory) };
  }
  if (definition.requiresResolvedAction && !input.actionResolved) {
    return { accepted: false, reason: 'requires_resolved_action', inventory: copyInventory(inventory) };
  }
  return {
    accepted: true,
    inventory: inventory.map((entry) => entry.id === item.id ? { ...entry, status: 'consumed' } : { ...entry }),
    effect: definition.effect,
  };
}

export type LiveCampaignForecastPrediction = 'sector_resolves' | 'sector_misses';
export type LiveCampaignForecastStatus = 'pending' | 'won' | 'lost' | 'void';

export interface LiveCampaignForecast {
  prediction: LiveCampaignForecastPrediction;
  status: LiveCampaignForecastStatus;
}

export interface LiveCampaignPlaceForecastInput {
  existing: LiveCampaignForecast | null;
  eggBalance: number;
  forecastWindowClosed: boolean;
  influencingMoveStarted: boolean;
  prediction: LiveCampaignForecastPrediction;
}

export type LiveCampaignForecastRejection = 'already_forecast' | 'not_enough_eggs' | 'forecast_closed';
export type LiveCampaignPlaceForecastDecision =
  | { accepted: true; forecast: LiveCampaignForecast; eggsSpent: 1 }
  | { accepted: false; reason: LiveCampaignForecastRejection };

/** Ровно одно яйцо, и первый потенциально влияющий ход закрывает всё окно. */
export function placeLiveCampaignForecast(input: LiveCampaignPlaceForecastInput): LiveCampaignPlaceForecastDecision {
  assertNonNegativeInteger(input.eggBalance, 'eggBalance');
  if (input.existing !== null) return { accepted: false, reason: 'already_forecast' };
  if (input.eggBalance < 1) return { accepted: false, reason: 'not_enough_eggs' };
  if (input.forecastWindowClosed || input.influencingMoveStarted) return { accepted: false, reason: 'forecast_closed' };
  return { accepted: true, forecast: { prediction: input.prediction, status: 'pending' }, eggsSpent: 1 };
}

export interface LiveCampaignForecastResolution {
  forecast: LiveCampaignForecast;
  /** Выплата после уже списанного яйца: win = 2, loss = 0, void = 1. */
  eggPayout: 0 | 1 | 2;
  settled: boolean;
}

export function resolveLiveCampaignForecast(
  forecast: LiveCampaignForecast,
  outcome: 'resolved' | 'missed' | 'void',
): LiveCampaignForecastResolution {
  if (forecast.status !== 'pending') return { forecast: { ...forecast }, eggPayout: 0, settled: false };
  if (outcome === 'void') return { forecast: { ...forecast, status: 'void' }, eggPayout: 1, settled: true };
  const won = (outcome === 'resolved' && forecast.prediction === 'sector_resolves')
    || (outcome === 'missed' && forecast.prediction === 'sector_misses');
  return { forecast: { ...forecast, status: won ? 'won' : 'lost' }, eggPayout: won ? 2 : 0, settled: true };
}

export const LIVE_CAMPAIGN_RAID_ROLES = ['scout', 'claim', 'hold'] as const;
export type LiveCampaignRaidRole = typeof LIVE_CAMPAIGN_RAID_ROLES[number];

export interface LiveCampaignRaidMember {
  memberKey: string;
  role: LiveCampaignRaidRole;
}

export interface LiveCampaignRaidQueue {
  targetSector: number;
  members: readonly LiveCampaignRaidMember[];
}

export type LiveCampaignRaidQueueStatus = 'queued' | 'ready' | 'dissolved';

export function liveCampaignRaidQueueStatus(queue: LiveCampaignRaidQueue): LiveCampaignRaidQueueStatus {
  if (queue.members.length < 4) return 'queued';
  return queue.members.length <= 6 ? 'ready' : 'dissolved';
}

export type LiveCampaignJoinRaidRejection = 'already_joined' | 'raid_full' | 'invalid_member';
export type LiveCampaignJoinRaidDecision =
  | { accepted: true; queue: LiveCampaignRaidQueue }
  | { accepted: false; reason: LiveCampaignJoinRaidRejection; queue: LiveCampaignRaidQueue };

export function joinLiveCampaignRaid(
  queue: LiveCampaignRaidQueue,
  member: LiveCampaignRaidMember,
): LiveCampaignJoinRaidDecision {
  assertSectorId(queue.targetSector);
  if (!member.memberKey.trim()) return { accepted: false, reason: 'invalid_member', queue: copyRaidQueue(queue) };
  if (queue.members.some((entry) => entry.memberKey === member.memberKey)) {
    return { accepted: false, reason: 'already_joined', queue: copyRaidQueue(queue) };
  }
  if (queue.members.length >= 6) return { accepted: false, reason: 'raid_full', queue: copyRaidQueue(queue) };
  return { accepted: true, queue: { targetSector: queue.targetSector, members: [...queue.members.map((entry) => ({ ...entry })), { ...member }] } };
}

export interface LiveCampaignRaidContribution {
  memberKey: string;
  role: LiveCampaignRaidRole;
  valid: boolean;
}

export interface LiveCampaignRaidResolution {
  status: 'success' | 'failure' | 'dissolved';
  validContributions: number;
  requiredContributions: number;
  missingRoles: readonly LiveCampaignRaidRole[];
  /** Награда никогда не содержит второй личный ход или второе перо. */
  reward: 'item_and_route' | null;
}

/** Соло-ход всегда независим от статуса очереди рейда. */
export function canUseLiveCampaignSoloMove(_queue: LiveCampaignRaidQueue | null): true {
  return true;
}

export function resolveLiveCampaignRaid(
  queue: LiveCampaignRaidQueue,
  contributions: readonly LiveCampaignRaidContribution[],
): LiveCampaignRaidResolution {
  const status = liveCampaignRaidQueueStatus(queue);
  if (status !== 'ready') {
    return { status: 'dissolved', validContributions: 0, requiredContributions: 0, missingRoles: LIVE_CAMPAIGN_RAID_ROLES, reward: null };
  }
  const memberByKey = new Map(queue.members.map((member) => [member.memberKey, member]));
  const seen = new Set<string>();
  const valid = contributions.filter((contribution) => {
    const member = memberByKey.get(contribution.memberKey);
    if (!member || seen.has(contribution.memberKey) || member.role !== contribution.role || !contribution.valid) return false;
    seen.add(contribution.memberKey);
    return true;
  });
  const roles = new Set(valid.map((contribution) => contribution.role));
  const missingRoles = LIVE_CAMPAIGN_RAID_ROLES.filter((role) => !roles.has(role));
  const requiredContributions = Math.ceil(queue.members.length * 0.6);
  const success = valid.length >= requiredContributions && missingRoles.length === 0;
  return {
    status: success ? 'success' : 'failure',
    validContributions: valid.length,
    requiredContributions,
    missingRoles,
    reward: success ? 'item_and_route' : null,
  };
}

export interface LiveCampaignSimulationOptions {
  seed?: number;
  /** Позволяет тесту поймать будущий скрытый бафф формы. */
  formManeuverValues?: Partial<Record<LiveCampaignBird, number>>;
}

export interface LiveCampaignSimulation {
  activePlayers: number;
  events: number;
  resolvedEvents: number;
  safetyRails: number;
  deadlocked: boolean;
  finalMap: LiveCampaignMap;
  actionAttempts: Readonly<Record<LiveCampaignAction, number>>;
  actionUtilities: Readonly<Record<LiveCampaignAction, number>>;
  formUtilities: Readonly<Record<LiveCampaignBird, number>>;
}

/**
 * Маленькая детерминированная smoke-simulation, не модель поведения людей.
 * Она проверяет, что при координированной игре 3/20/250 участников кампания
 * имеет доступный путь, а базовые три действия и четыре формы симметричны.
 */
export function simulateLiveCampaign(
  activePlayers: number,
  options: LiveCampaignSimulationOptions = {},
): LiveCampaignSimulation {
  assertNonNegativeInteger(activePlayers, 'activePlayers');
  if (activePlayers < 3) throw new RangeError('simulation requires at least three active players');
  const random = seededRandom(options.seed ?? 1);
  let map = createLiveCampaignMap(0);
  let unresolvedWindows = 0;
  let safetyRails = 0;
  let events = 0;
  let resolvedEvents = 0;
  const actionAttempts: Record<LiveCampaignAction, number> = { scout: 0, claim: 0, hold: 0 };
  const actionSuccesses: Record<LiveCampaignAction, number> = { scout: 0, claim: 0, hold: 0 };

  for (let day = 0; day < LIVE_CAMPAIGN_LENGTH_DAYS; day += 1) {
    const schedule = liveCampaignSchedule(day);
    if (!schedule.isWindowDay) continue;
    events += 1;
    if (events === 5) {
      const rooted = map.sectors.find((sector) => sector.state === 'rooted');
      if (rooted) map = scheduleLiveCampaignStorm(map, rooted.id, false);
    }
    const objective = simulationObjective(map, random);
    const threshold = liveCampaignThreshold(activePlayers, schedule.week);
    const contribution = simulationContribution(activePlayers, threshold);
    actionAttempts[objective.action] += 1;
    const resolution = resolveLiveCampaignAction(map, { ...objective, contribution, threshold });
    map = resolution.map;
    if (resolution.applied) {
      actionSuccesses[objective.action] += 1;
      resolvedEvents += 1;
      unresolvedWindows = 0;
    } else {
      unresolvedWindows += 1;
      const rail = applyLiveCampaignSafetyRail(map, unresolvedWindows);
      map = rail.map;
      if (rail.applied) safetyRails += 1;
    }
    if (events === 5 && map.storm) map = resolveLiveCampaignStorm(map).map;
  }

  const actionUtilities = {
    scout: actionSuccesses.scout / actionAttempts.scout,
    claim: actionSuccesses.claim / actionAttempts.claim,
    hold: actionSuccesses.hold / actionAttempts.hold,
  };
  const formUtilities = Object.fromEntries(LIVE_CAMPAIGN_BIRDS.map((bird) => [bird, options.formManeuverValues?.[bird] ?? 1])) as Record<LiveCampaignBird, number>;
  const deadlocked = resolvedEvents === 0 || (unresolvedWindows >= 2 && map.sectors.every((sector) => sector.state === 'hidden'));
  return { activePlayers, events, resolvedEvents, safetyRails, deadlocked, finalMap: map, actionAttempts, actionUtilities, formUtilities };
}

/** True means some option exceeds the weakest non-zero option by more than allowed. */
export function hasLiveCampaignDominantOption(
  values: Readonly<Record<string, number>>,
  maximumAdvantage = 0.1,
): boolean {
  if (!Number.isFinite(maximumAdvantage) || maximumAdvantage < 0) throw new RangeError('maximumAdvantage must be non-negative');
  const options = Object.values(values);
  if (!options.length || options.some((value) => !Number.isFinite(value) || value < 0)) throw new RangeError('values must be finite non-negative numbers');
  const strongest = Math.max(...options);
  const weakest = Math.min(...options);
  if (strongest === 0) return false;
  if (weakest === 0) return true;
  return strongest / weakest - 1 > maximumAdvantage;
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) throw new RangeError(`${name} must be a non-negative integer`);
}

function assertSectorId(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value >= LIVE_CAMPAIGN_SECTOR_COUNT) throw new RangeError('sectorId is outside map');
}

function assertLiveCampaignMap(map: LiveCampaignMap): void {
  if (map.sectors.length !== LIVE_CAMPAIGN_SECTOR_COUNT) throw new RangeError('map must have exactly seven sectors');
  map.sectors.forEach((sector, index) => {
    if (sector.id !== index || !LIVE_CAMPAIGN_SECTOR_STATES.includes(sector.state) || !Number.isInteger(sector.wards) || sector.wards < 0) {
      throw new RangeError('map has an invalid sector');
    }
  });
  if (map.storm) assertSectorId(map.storm.targetSector);
}

function cloneSectors(sectors: readonly LiveCampaignSector[]): LiveCampaignSector[] {
  return sectors.map((sector) => ({ ...sector }));
}

function copyMap(map: LiveCampaignMap): LiveCampaignMap {
  return { sectors: cloneSectors(map.sectors), storm: map.storm ? { ...map.storm } : null };
}

function replaceSector(map: LiveCampaignMap, replacement: LiveCampaignSector, storm = map.storm): LiveCampaignMap {
  return {
    sectors: map.sectors.map((sector) => sector.id === replacement.id ? { ...replacement } : { ...sector }),
    storm: storm ? { ...storm } : null,
  };
}

function noMapAction(map: LiveCampaignMap): LiveCampaignActionResolution {
  return { map: copyMap(map), applied: false, note: 'invalid_state', revealedStormTarget: null };
}

function lowerSectorState(state: LiveCampaignSectorState): LiveCampaignSectorState {
  if (state === 'rooted') return 'secured';
  if (state === 'secured') return 'exposed';
  if (state === 'exposed') return 'hidden';
  return 'hidden';
}

function seededRandom(seed: number): () => number {
  let value = (seed >>> 0) || 1;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function mixChallengeSeed(seed: number, bird: LiveCampaignBird, action: LiveCampaignAction, sectorId: number): number {
  let mixed = seed >>> 0;
  for (const part of [bird, action, String(sectorId)]) {
    for (const character of part) mixed = Math.imul(mixed ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  return mixed || 1;
}

function choiceCard(
  id: string,
  kind: LiveCampaignCardKind,
  prompt: string,
  correct: string,
  distractors: readonly string[],
  random: () => number,
): LiveCampaignServerCard {
  const options = [correct, ...distractors];
  for (let index = options.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(random() * (index + 1));
    const current = options[index]!;
    options[index] = options[pick]!;
    options[pick] = current;
  }
  return { id, kind, prompt, options, answer: options.indexOf(correct) };
}

interface LiveCampaignChoiceDefinition {
  prompt: string;
  correct: string;
  distractors: readonly string[];
}

/**
 * Базовая карточка остаётся короткой, но числа и сценарий меняются вместе с
 * серверным seed. Это исключает ответ по одному сохранённому тексту вопроса.
 */
function baseCard(id: string, random: () => number): LiveCampaignServerCard {
  const variant = Math.floor(random() * 4);
  let definition: LiveCampaignChoiceDefinition;
  if (variant === 0) {
    const closed = 4 + Math.floor(random() * 9);
    const remaining = 3 + Math.floor(random() * 8);
    definition = {
      prompt: `В рабочем наборе ${closed + remaining} карточек. ${closed} уже получили статус «готово». Сколько ещё требуют решения?`,
      correct: String(remaining),
      distractors: numericDistractors(remaining, [closed, closed + remaining, remaining - 1]),
    };
  } else if (variant === 1) {
    const first = 5 + Math.floor(random() * 8);
    const second = 4 + Math.floor(random() * 8);
    const duplicates = 1 + Math.floor(random() * Math.min(4, first));
    const unique = first + second - duplicates;
    definition = {
      prompt: `За два окна нашли ${first} и ${second} сигнала. ${duplicates} сигнала оказались дублями. Сколько уникальных сигналов осталось на карте?`,
      correct: String(unique),
      distractors: numericDistractors(unique, [first + second, first, second, unique - duplicates]),
    };
  } else if (variant === 2) {
    const total = 16 + Math.floor(random() * 10);
    const reading = 3 + Math.floor(random() * 5);
    const verification = 2 + Math.floor(random() * 4);
    const remaining = total - reading - verification;
    definition = {
      prompt: `На проверку есть ${total} минут. ${reading} ушло на условия и ${verification} — на сверку. Сколько минут остаётся на решение?`,
      correct: String(remaining),
      distractors: numericDistractors(remaining, [total - reading, total - verification, reading + verification]),
    };
  } else {
    const perBatch = 3 + Math.floor(random() * 5);
    const batches = 3 + Math.floor(random() * 3);
    const rejected = 1 + Math.floor(random() * Math.min(4, perBatch));
    const accepted = perBatch * batches - rejected;
    definition = {
      prompt: `В ${batches} пакетах по ${perBatch} проверок. ${rejected} проверок отклонили до запуска. Сколько проверок осталось принять?`,
      correct: String(accepted),
      distractors: numericDistractors(accepted, [perBatch * batches, perBatch, rejected, accepted + rejected]),
    };
  }
  return choiceCard(id, 'base', definition.prompt, definition.correct, definition.distractors, random);
}

function numericDistractors(correct: number, candidates: readonly number[]): readonly string[] {
  const values: number[] = [];
  for (const candidate of candidates) {
    if (candidate >= 0 && candidate !== correct && !values.includes(candidate)) values.push(candidate);
    if (values.length === 3) return values.map(String);
  }
  let offset = 1;
  while (values.length < 3) {
    const candidate = offset % 2 === 0 ? correct - offset : correct + offset;
    if (candidate >= 0 && candidate !== correct && !values.includes(candidate)) values.push(candidate);
    offset += 1;
  }
  return values.map(String);
}

function trackCard(bird: LiveCampaignBird, id: string, random: () => number): LiveCampaignServerCard {
  const variant = Math.floor(random() * 3);
  let definition: LiveCampaignChoiceDefinition;
  if (bird === 'woodpecker') {
    if (variant === 0) {
      const length = 5 + Math.floor(random() * 8);
      definition = {
        prompt: `Цикл должен обработать индексы 0…${length - 1}, но в журнал иногда попадает ${length}. Что проверить первым?`,
        correct: `Условие: индекс должен быть меньше ${length}`,
        distractors: [`Начинать цикл с ${length}`, `Увеличить массив до ${length + 1}`, 'Добавить случайную задержку'],
      };
    } else if (variant === 1) {
      const rows = 6 + Math.floor(random() * 10);
      definition = {
        prompt: `Из ${rows} строк в отчёте исчезает только последняя. Какую границу надо проверить до переписывания кода?`,
        correct: `Срез и условие, которые должны доходить до строки ${rows}`,
        distractors: ['Название файла отчёта', 'Цвет последней строки', 'Размер шрифта в таблице'],
      };
    } else {
      const retries = 2 + Math.floor(random() * 4);
      definition = {
        prompt: `После ${retries} повторных запросов одна и та же запись появляется несколько раз. Что защищает от такого эффекта?`,
        correct: 'Идемпотентный ключ: одинаковый запрос не создаёт новую запись',
        distractors: ['Случайный порядок полей', 'Более длинная задержка ответа', 'Новый цвет кнопки отправки'],
      };
    }
  } else if (bird === 'magpie') {
    if (variant === 0) {
      const controls = 4 + Math.floor(random() * 4);
      definition = {
        prompt: `В форме ${controls} одинаковых кнопок, но только «Отправить» меняет состояние. Какой первый UX-шаг проверяем?`,
        correct: 'Сделать «Отправить» визуально главным и назвать действием',
        distractors: ['Добавить ещё одну декоративную иконку', 'Спрятать кнопку в меню', 'Сделать все кнопки ещё похожее'],
      };
    } else if (variant === 1) {
      const seconds = 3 + Math.floor(random() * 5);
      definition = {
        prompt: `После нажатия «Сохранить» ${seconds} секунды ничего не меняется. Какой минимальный сигнал нужен пользователю сразу?`,
        correct: 'Явное состояние «сохраняем» и итог успеха или ошибки',
        distractors: ['Автоматически закрыть приложение', 'Показать только декоративную анимацию', 'Спрятать кнопку навсегда'],
      };
    } else {
      const fields = 3 + Math.floor(random() * 4);
      definition = {
        prompt: `В форме ${fields} полей ошибка появляется только после отправки. Что сделать прежде всего?`,
        correct: 'Показать ошибку у конкретного поля и объяснить, что исправить',
        distractors: ['Очистить все поля без объяснения', 'Выделить ошибку только красным фоном', 'Перенести форму на другой экран'],
      };
    }
  } else if (bird === 'owl') {
    if (variant === 0) {
      const before = 32 + Math.floor(random() * 12);
      const after = before + 4 + Math.floor(random() * 8);
      definition = {
        prompt: `После изменения метрика выросла с ${before}% до ${after}%, но одновременно сменился источник аудитории. Какой вывод корректен?`,
        correct: 'Связь видна, но причинность без сравнения ещё не доказана',
        distractors: ['Изменение точно вызвало рост', 'Источник аудитории больше не важен', 'Можно сложить проценты групп без весов'],
      };
    } else if (variant === 1) {
      const low = 10 + Math.floor(random() * 4);
      const high = 70 + Math.floor(random() * 15);
      definition = {
        prompt: `В ответах: ${low}, ${low}, ${low + 1}, ${low + 1}, ${high}. Какое число лучше описывает типичный ответ без влияния выброса?`,
        correct: String(low + 1),
        distractors: [String(high), String(Math.round((low * 3 + (low + 1) * 2 + high) / 6)), String(low)],
      };
    } else {
      const visits = 80 + Math.floor(random() * 41);
      const clicks = 12 + Math.floor(random() * 18);
      definition = {
        prompt: `Из ${visits} визитов ${clicks} нажали основное действие. Какой показатель корректно сравнивать с другим экраном того же размера?`,
        correct: 'Долю нажатий от числа визитов',
        distractors: ['Только число нажатий без числа визитов', 'Порядок карточек в ленте', 'Цвет аватара участника'],
      };
    }
  } else if (variant === 0) {
    const dependents = 2 + Math.floor(random() * 4);
    definition = {
      prompt: `${dependents} задачи ждут один неготовый вход. Что координатор делает первым?`,
      correct: 'Снимает блокировку задачи, от которой зависят остальные',
      distractors: ['Берёт самую приятную задачу', 'Передаёт всё одному человеку', 'Переносит все сроки без проверки'],
    };
  } else if (variant === 1) {
    const people = 3 + Math.floor(random() * 4);
    definition = {
      prompt: `В команде ${people} человек, но у критичной задачи нет владельца. Что надо зафиксировать до начала работы?`,
      correct: 'Одного ответственного и ближайший проверяемый результат',
      distractors: ['Только общий чат без владельца', 'Максимум параллельных задач каждому', 'Новое название команды'],
    };
  } else {
    const days = 2 + Math.floor(random() * 4);
    definition = {
      prompt: `До дедлайна ${days} дня, а задача зависит от ответа партнёра. Что снижает риск ожидания?`,
      correct: 'Сразу обозначить зависимость, срок ответа и запасной маршрут',
      distractors: ['Молчать до последнего дня', 'Начать несвязанную задачу без владельца', 'Сделать срок невидимым для команды'],
    };
  }
  return choiceCard(id, 'track', definition.prompt, definition.correct, definition.distractors, random);
}

function chainCard(
  map: LiveCampaignMap,
  action: LiveCampaignAction,
  state: LiveCampaignSectorState,
  sectorId: number,
  id: string,
  random: () => number,
): LiveCampaignServerCard {
  const label = `сектор ${sectorId + 1}`;
  const actionLabel = action === 'scout' ? 'scout' : action === 'claim' ? 'claim' : 'hold';
  let definition: LiveCampaignChoiceDefinition;
  if (state === 'hidden') {
    definition = {
      prompt: `${label} сейчас hidden, а в этом окне выбран ${actionLabel}. Какой порядок нужен, чтобы без шторма довести маршрут до rooted?`,
      correct: 'scout → claim → hold',
      distractors: ['claim → scout → hold', 'hold → scout → claim', 'scout → hold → claim'],
    };
  } else if (state === 'exposed') {
    definition = {
      prompt: `${label} уже exposed. Какой короткий порядок без шторма продолжает именно этот маршрут до rooted?`,
      correct: 'claim → hold',
      distractors: ['hold → claim', 'scout → claim', 'claim → scout'],
    };
  } else if (state === 'secured') {
    const hasVisibleStorm = map.storm?.revealed === true && map.storm.targetSector === sectorId;
    definition = hasVisibleStorm
      ? {
        prompt: `${label} secured и является видимой целью шторма. Что даёт hold до удара?`,
        correct: 'Добавляет один ward и оставляет сектор secured',
        distractors: ['Сразу делает сектор rooted', 'Открывает соседний hidden-сектор', 'Сбрасывает шторм без ward'],
      }
      : {
        prompt: `${label} secured. Какой следующий переход без учёта планового шторма доводит его до rooted?`,
        correct: 'hold → rooted',
        distractors: ['claim → rooted', 'scout → rooted', 'hold → exposed'],
      };
  } else {
    definition = {
      prompt: `${label} уже rooted. Что верно для последовательности без планового шторма?`,
      correct: 'Ни scout, ни claim не повышают rooted ещё на одну ступень',
      distractors: ['scout сразу создаёт второй rooted', 'claim превращает rooted в hidden', 'hold открывает новую серию вопросов'],
    };
  }
  return choiceCard(id, 'chain', definition.prompt, definition.correct, definition.distractors, random);
}

function tacticalCard(
  map: LiveCampaignMap,
  action: LiveCampaignAction,
  sectorId: number,
  id: string,
  random: () => number,
): LiveCampaignServerCard {
  const sector = map.sectors[sectorId]!;
  const label = `сектор ${sectorId + 1}`;
  let definition: LiveCampaignChoiceDefinition;
  if (action === 'scout') {
    definition = sector.state === 'hidden'
      ? {
        prompt: `${label} сейчас hidden. Что именно сделает scout при выполненном пороге?`,
        correct: `Переведёт ${label} из hidden в exposed`,
        distractors: ['Сразу сделает сектор rooted', 'Добавит ward на любой сектор', 'Создаст второй личный ход'],
      }
      : {
        prompt: `${label} сейчас ${sector.state}. Что произойдёт от scout при выполненном пороге?`,
        correct: 'Ничего: scout применяется только к hidden-сектору',
        distractors: ['Сектор станет rooted', 'Сектор получит дополнительное перо', 'Шторм исчезнет автоматически'],
      };
  } else if (action === 'claim') {
    definition = sector.state === 'exposed'
      ? {
        prompt: `${label} сейчас exposed. Что именно закрепит claim при выполненном пороге?`,
        correct: `Переведёт ${label} из exposed в secured`,
        distractors: ['Сразу сделает сектор rooted', 'Откроет любой hidden-сектор', 'Поставит ward без шторма'],
      }
      : {
        prompt: `${label} сейчас ${sector.state}. Что произойдёт от claim при выполненном пороге?`,
        correct: 'Ничего: claim применяется только к exposed-сектору',
        distractors: ['Сектор станет rooted', 'Активная птица сменится', 'Откроется вторая серия'],
      };
  } else if (sector.state !== 'secured' && sector.state !== 'rooted') {
    definition = {
      prompt: `${label} сейчас ${sector.state}. Что произойдёт от hold при выполненном пороге?`,
      correct: 'Ничего: hold требует secured или rooted-сектор',
      distractors: ['Сектор станет secured', 'Откроется любой hidden-сектор', 'Другой игрок потеряет вклад'],
    };
  } else if (map.storm?.revealed === true && map.storm.targetSector === sectorId) {
    definition = {
      prompt: `${label} сейчас ${sector.state} и является видимой целью шторма. Что даст hold при выполненном пороге?`,
      correct: `Добавит один ward на ${label}; состояние останется ${sector.state}`,
      distractors: ['Сразу сделает сектор rooted', 'Перенесёт шторм на соседний сектор', 'Откроет дополнительный ход'],
    };
  } else if (map.storm && !map.storm.revealed) {
    definition = sector.state === 'secured'
      ? {
        prompt: `${label} secured, но цель назначенного шторма ещё скрыта. Что корректно ждать от hold?`,
        correct: 'Если это цель шторма — +1 ward; иначе secured → rooted',
        distractors: ['Всегда открывает hidden-сектор', 'Всегда снимает шторм без ward', 'Даёт вторую серию вопросов'],
      }
      : {
        prompt: `${label} rooted, но цель назначенного шторма ещё скрыта. Что корректно ждать от hold?`,
        correct: 'Если это цель шторма — +1 ward; иначе карта не изменится',
        distractors: ['Всегда создаёт следующий rooted-уровень', 'Переводит rooted в hidden', 'Даёт яйцо без результата'],
      };
  } else if (sector.state === 'secured') {
    definition = {
      prompt: `${label} secured и не является видимой целью шторма. Что даст hold при выполненном пороге?`,
      correct: `Переведёт ${label} из secured в rooted`,
      distractors: ['Сразу откроет другой сектор', 'Снимет вклад у соседей', 'Создаст второй ход'],
    };
  } else {
    definition = {
      prompt: `${label} уже rooted и не является видимой целью шторма. Что даст hold при выполненном пороге?`,
      correct: 'Ничего: rooted нельзя повысить ещё одним hold',
      distractors: ['Сделает второй rooted-уровень', 'Переведёт сектор в secured', 'Откроет дополнительную серию'],
    };
  }
  return choiceCard(id, 'tactical', definition.prompt, definition.correct, definition.distractors, random);
}

function riskCard(map: LiveCampaignMap, sectorId: number, id: string, random: () => number): LiveCampaignServerCard {
  const storm = map.storm;
  const selected = map.sectors[sectorId]!;
  if (!storm) {
    const exposed = map.sectors.filter((sector) => sector.state === 'exposed').length;
    const rooted = map.sectors.filter((sector) => sector.state === 'rooted').length;
    return choiceCard(
      id,
      'risk',
      `На карте ${exposed} exposed и ${rooted} rooted-секторов; плановый шторм ещё не назначен. Какое ограничение остаётся верным?`,
      'Предмет или яйцо не открывают вторую серию в этом окне',
      ['Можно купить второй ход за яйцо', 'Можно сменить активную птицу после старта', 'Можно снять вклад другого игрока'],
      random,
    );
  }
  if (!storm.revealed) {
    return choiceCard(
      id,
      'risk',
      `Шторм уже назначен, но его цель не раскрыта. Что может показать успешный scout?`,
      'Номер сектора, на который нацелен шторм',
      ['Правильный ответ другого игрока', 'Новую активную птицу', 'Вторую попытку в серии'],
      random,
    );
  }
  const target = map.sectors[storm.targetSector]!;
  const targetLabel = `сектор ${target.id + 1}`;
  const selectedLabel = `сектор ${selected.id + 1}`;
  if (target.wards > 0) {
    return choiceCard(
      id,
      'risk',
      `Цель раскрыта: ${targetLabel} в состоянии ${target.state} защищён ward. Что произойдёт от одного удара?`,
      `Один ward на ${targetLabel} исчезнет, а состояние сектора сохранится`,
      [`Сектор сразу станет hidden`, `${selectedLabel} получит второй ход`, 'Прогноз автоматически поменяется'],
      random,
    );
  }
  const lowered = lowerSectorState(target.state);
  return choiceCard(
    id,
    'risk',
    `Цель раскрыта: ${targetLabel} сейчас ${target.state} и ward нет. Как изменит его один удар?`,
    lowered === target.state
      ? `${targetLabel} останется ${target.state}: ниже опускать уже некуда`
      : `${targetLabel} опустится из ${target.state} в ${lowered}`,
    [`${selectedLabel} получит дополнительное перо`, 'Смена птицы отменит удар', 'Скоростной ответ поглотит шторм'],
    random,
  );
}

function copyRoster(roster: LiveCampaignBirdRoster): LiveCampaignBirdRoster {
  return { birds: roster.birds.map((entry) => ({ ...entry })), activeBird: roster.activeBird, campaignStarted: roster.campaignStarted };
}

function isValidInventoryItem(item: LiveCampaignInventoryItem): boolean {
  return item.id.trim().length > 0 && LIVE_CAMPAIGN_ITEM_KINDS.includes(item.kind) && ['owned', 'armed', 'consumed'].includes(item.status);
}

function isValidLiveCampaignInventory(inventory: readonly LiveCampaignInventoryItem[]): boolean {
  if (inventory.length > LIVE_CAMPAIGN_INVENTORY_LIMIT) return false;
  const ids = new Set<string>();
  for (const item of inventory) {
    if (!isValidInventoryItem(item) || ids.has(item.id)) return false;
    ids.add(item.id);
  }
  return inventory.filter((item) => item.status === 'armed').length <= 1;
}

function copyInventory(inventory: readonly LiveCampaignInventoryItem[]): LiveCampaignInventoryItem[] {
  return inventory.map((item) => ({ ...item }));
}

function copyRaidQueue(queue: LiveCampaignRaidQueue): LiveCampaignRaidQueue {
  return { targetSector: queue.targetSector, members: queue.members.map((member) => ({ ...member })) };
}

function simulationObjective(map: LiveCampaignMap, random: () => number): { action: LiveCampaignAction; sectorId: number } {
  const stormTarget = map.storm ? map.sectors[map.storm.targetSector]! : null;
  if (stormTarget && (stormTarget.state === 'secured' || stormTarget.state === 'rooted')) {
    return { action: 'hold', sectorId: stormTarget.id };
  }
  const exposed = map.sectors.find((sector) => sector.state === 'exposed');
  if (exposed) return { action: 'claim', sectorId: exposed.id };
  const secured = map.sectors.find((sector) => sector.state === 'secured');
  if (secured) return { action: 'hold', sectorId: secured.id };
  const hidden = map.sectors.filter((sector) => sector.state === 'hidden');
  const next = hidden[Math.floor(random() * hidden.length)] ?? map.sectors[0]!;
  return { action: 'scout', sectorId: next.id };
}

function simulationContribution(activePlayers: number, threshold: number): number {
  const baseline = activePlayers;
  const spare = activePlayers;
  return Math.min(threshold, baseline + Math.min(spare, Math.max(0, threshold - baseline)));
}
