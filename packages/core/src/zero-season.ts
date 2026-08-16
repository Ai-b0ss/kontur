/**
 * Минимальные, детерминированные правила нулевого сезона.
 * Здесь нет часов, сети или пользовательских идентификаторов: сервер сможет
 * применять те же правила к агрегированному действию птицы.
 */
export const ZERO_SEASON_BIRDS = ['woodpecker', 'magpie', 'owl', 'crane'] as const;
export type ZeroSeasonBird = typeof ZERO_SEASON_BIRDS[number];
export const ZERO_SEASON_INTENTS = ['attack', 'shield', 'scout'] as const;
export type ZeroSeasonIntent = typeof ZERO_SEASON_INTENTS[number];
export type ZeroSeasonEffect = ZeroSeasonIntent | 'none';

export interface ZeroSeasonVote {
  bird: ZeroSeasonBird;
  intent: ZeroSeasonIntent;
  nest: number;
}

export interface ZeroSeasonBoard {
  nests: readonly (ZeroSeasonBird | null)[];
  shields: readonly number[];
  marks: readonly number[];
}

export interface ZeroSeasonResolution {
  effect: ZeroSeasonEffect;
  board: ZeroSeasonBoard;
  note: 'claimed' | 'neutralized' | 'shielded' | 'shield_broken' | 'marked' | 'no_change';
}

/** Внутренний ответ остаётся на Worker; в Mini App передаются только первые три поля. */
export interface ZeroSeasonQuestion {
  id: string;
  prompt: string;
  options: readonly string[];
  answer: number;
}

export type ZeroSeasonRank = 'rookie' | 'field' | 'crown';
export type ZeroSeasonDifficulty = 'base' | 'applied' | 'advanced';
export const ZERO_SEASON_LENGTH_DAYS = 35;

export function zeroSeasonSchedule(gameDay: number): { number: number; day: number; daysLeft: number } {
  if (!Number.isInteger(gameDay) || gameDay < 0) throw new RangeError('gameDay must be a non-negative integer');
  const number = Math.floor(gameDay / ZERO_SEASON_LENGTH_DAYS);
  const day = gameDay % ZERO_SEASON_LENGTH_DAYS + 1;
  return { number, day, daysLeft: ZERO_SEASON_LENGTH_DAYS - day };
}

/** Ранги — только статус и следующий открываемый образ птицы, не боевой бонус. */
export function zeroSeasonRank(mastery: number): ZeroSeasonRank {
  if (!Number.isInteger(mastery) || mastery < 0) throw new RangeError('mastery must be a non-negative integer');
  if (mastery >= 7) return 'crown';
  if (mastery >= 3) return 'field';
  return 'rookie';
}

export function zeroSeasonDifficulty(mastery: number): ZeroSeasonDifficulty {
  if (!Number.isInteger(mastery) || mastery < 0) throw new RangeError('mastery must be a non-negative integer');
  if (mastery >= 7) return 'advanced';
  if (mastery >= 3) return 'applied';
  return 'base';
}

const INTENT_ORDER: readonly ZeroSeasonIntent[] = ['scout', 'shield', 'attack'];

function questionRandom(seed: number): () => number {
  let value = (seed >>> 0) || 1;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function shuffledOptions(correct: string, distractors: readonly string[], random: () => number): { options: string[]; answer: number } {
  const options = [correct, ...distractors].sort(() => random() - 0.5);
  return { options, answer: options.indexOf(correct) };
}

function trackQuestion(bird: ZeroSeasonBird, gameDay: number, random: () => number): ZeroSeasonQuestion {
  if (bird === 'woodpecker') {
    const limit = 2 + Math.floor(random() * 3);
    const choice = shuffledOptions(
      'Проверить границу цикла и значение после последней итерации',
      ['Переписать всё на другой язык', 'Добавить случайную задержку', 'Сразу увеличить лимит вдвое'], random,
    );
    return { id: `t-${gameDay}`, prompt: `Цикл должен обработать ровно ${limit} элемента, но иногда обрабатывает ${limit + 1}. Что проверяешь первым?`, ...choice };
  }
  if (bird === 'magpie') {
    const choice = shuffledOptions(
      'Сделать одно основное действие заметным текстом и формой',
      ['Добавить ещё одну декоративную иконку', 'Спрятать действие в меню', 'Сделать все кнопки одинакового цвета'], random,
    );
    return { id: `t-${gameDay}`, prompt: 'Пользователь на экране с оплатой не видит, куда нажать дальше. Какой первый UX-эксперимент?', ...choice };
  }
  if (bird === 'owl') {
    const choice = shuffledOptions(
      'Сказать, что связь видна, но причинность ещё не доказана',
      ['Объявить, что один фактор точно вызвал другой', 'Игнорировать размер выборки', 'Сложить проценты разных групп без весов'], random,
    );
    return { id: `t-${gameDay}`, prompt: 'После новой рассылки выросла конверсия, но одновременно начался набор новой группы. Какой вывод корректен?', ...choice };
  }
  const choice = shuffledOptions(
    'Сначала снять блокировку задачи, от которой зависят остальные',
    ['Начать с самой приятной задачи', 'Поручить всё одному человеку', 'Перенести все сроки на потом'], random,
  );
  return { id: `t-${gameDay}`, prompt: 'В плане три задачи ждут один неготовый вход. Какой первый шаг координатора?', ...choice };
}

/**
 * Пять коротких задач строятся заново на Worker из суток, игрока и птицы.
 * Вопросы не являются ежедневной ручной контент-фабрикой, а их ответы никогда
 * не отдаются клиенту до фиксации серии.
 */
export function zeroSeasonQuestionSeries(gameDay: number, userId: number, bird: ZeroSeasonBird, mastery = 0): readonly ZeroSeasonQuestion[] {
  if (!Number.isInteger(gameDay) || !Number.isInteger(userId)) throw new RangeError('gameDay and userId must be integers');
  const difficulty = zeroSeasonDifficulty(mastery);
  const birdSalt = ZERO_SEASON_BIRDS.indexOf(bird) + 1;
  const random = questionRandom(gameDay * 1_009_931 + userId * 97_003 + birdSalt * 7_919);
  const price = (12 + Math.floor(random() * 13)) * 100;
  const discount = [10, 20, 25][Math.floor(random() * 3)]!;
  const discounted = price * (100 - discount) / 100;
  const people = 3 + Math.floor(random() * 5);
  const perPerson = 2 + Math.floor(random() * 4);
  const total = people * perPerson;
  const oldRate = 8 + Math.floor(random() * 5);
  const newRate = oldRate + 3 + Math.floor(random() * 4);
  const growth = Math.round((newRate / oldRate - 1) * 100);
  const fee = (1 + Math.floor(random() * 3)) * 50;
  const commission = [5, 10][Math.floor(random() * 2)]!;
  const advancedPrice = discounted * (100 + commission) / 100;
  const percent = difficulty === 'base'
    ? shuffledOptions(String(discounted), [String(discounted + 100), String(price - discount), String(price + discount)], random)
    : difficulty === 'applied'
      ? shuffledOptions(String(discounted + fee), [String(discounted), String(discounted + fee + 100), String(price - fee)], random)
      : shuffledOptions(String(advancedPrice), [String(discounted), String(advancedPrice + 100), String(price)], random);
  const capacity = shuffledOptions(String(total), [String(people + perPerson), String(people * (perPerson - 1)), String(total + people)], random);
  const conversion = shuffledOptions(`${growth}%`, [`${newRate - oldRate}%`, `${newRate - oldRate} п.п.`, `${growth + 10}%`], random);
  const ordering = shuffledOptions('A → B → C', ['B → A → C', 'C → B → A', 'A → C → B'], random);
  return [
    { id: `p-${gameDay}`, prompt: difficulty === 'base'
      ? `Цена ${price}. Скидка ${discount}% применяется один раз. Какая цена после скидки?`
      : difficulty === 'applied'
        ? `Цена ${price}. Скидка ${discount}% применяется один раз, затем добавляется фиксированный сбор ${fee}. Какой итог?`
        : `Цена ${price}. Скидка ${discount}% применяется один раз, затем сервис удерживает ${commission}% от новой цены. Какой итог?`, ...percent },
    { id: `c-${gameDay}`, prompt: `${people} человека делают по ${perPerson} проверочных шага. Сколько шагов получится всего?`, ...capacity },
    { id: `r-${gameDay}`, prompt: `Конверсия выросла с ${oldRate}% до ${newRate}%. На сколько процентов она выросла относительно исходной?`, ...conversion },
    { id: `o-${gameDay}`, prompt: 'B можно начать только после A, а C — только после B. Какой порядок допустим?', ...ordering },
    trackQuestion(bird, gameDay, random),
  ];
}

export function zeroSeasonEffect(correct: number, intent: ZeroSeasonIntent): ZeroSeasonEffect {
  if (!Number.isInteger(correct) || correct < 0 || correct > 5) throw new RangeError('correct must be 0..5');
  if (correct >= 4) return intent;
  if (correct >= 2) return 'scout';
  return 'none';
}

/** Один публичный выбор птицы на день. Все голоса остаются видимым вкладом в него. */
export function selectZeroSeasonVote(votes: readonly ZeroSeasonVote[], bird: ZeroSeasonBird): ZeroSeasonVote | null {
  const own = votes.filter((vote) => vote.bird === bird);
  if (!own.length) return null;
  const counts = new Map<string, { vote: ZeroSeasonVote; count: number }>();
  for (const vote of own) {
    const key = `${vote.intent}:${vote.nest}`;
    const current = counts.get(key);
    counts.set(key, current ? { vote, count: current.count + 1 } : { vote, count: 1 });
  }
  return [...counts.values()].sort((a, b) =>
    b.count - a.count
    || INTENT_ORDER.indexOf(a.vote.intent) - INTENT_ORDER.indexOf(b.vote.intent)
    || a.vote.nest - b.vote.nest,
  )[0]!.vote;
}

export function resolveZeroSeasonAction(
  board: ZeroSeasonBoard,
  bird: ZeroSeasonBird,
  intent: ZeroSeasonIntent,
  nest: number,
): ZeroSeasonResolution {
  if (!Number.isInteger(nest) || nest < 0 || nest >= board.nests.length) throw new RangeError('nest is outside board');
  const nests = [...board.nests];
  const shields = new Set(board.shields);
  const marks = new Set(board.marks);

  if (intent === 'scout') {
    marks.add(nest);
    return { effect: intent, board: { nests, shields: [...shields], marks: [...marks] }, note: 'marked' };
  }
  if (intent === 'shield') {
    if (nests[nest] !== bird) return { effect: intent, board, note: 'no_change' };
    shields.add(nest);
    return { effect: intent, board: { nests, shields: [...shields], marks: [...marks] }, note: 'shielded' };
  }

  if (shields.has(nest) && !marks.has(nest)) {
    shields.delete(nest);
    return { effect: intent, board: { nests, shields: [...shields], marks: [...marks] }, note: 'shield_broken' };
  }
  if (nests[nest] === null) {
    nests[nest] = bird;
    return { effect: intent, board: { nests, shields: [...shields], marks: [...marks] }, note: 'claimed' };
  }
  if (nests[nest] !== bird) {
    nests[nest] = null;
    return { effect: intent, board: { nests, shields: [...shields], marks: [...marks] }, note: 'neutralized' };
  }
  return { effect: intent, board, note: 'no_change' };
}

export function zeroSeasonLeader(board: ZeroSeasonBoard): ZeroSeasonBird | null {
  const counts = new Map<ZeroSeasonBird, number>(ZERO_SEASON_BIRDS.map((bird) => [bird, 0]));
  board.nests.forEach((bird) => { if (bird) counts.set(bird, (counts.get(bird) ?? 0) + 1); });
  const leaders = ZERO_SEASON_BIRDS.filter((bird) => (counts.get(bird) ?? 0) >= 4);
  return leaders.length === 1 ? leaders[0]! : null;
}
