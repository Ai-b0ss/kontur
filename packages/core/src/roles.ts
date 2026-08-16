/**
 * Тест онбординга и определение роли.
 *
 * Роль — это идентичность. Она выдаётся один раз при вылуплении и никогда
 * не меняется: меняется только внешность. Поэтому расчёт детерминированный
 * и живёт на сервере — по одним и тем же ответам всегда одна и та же птица.
 */

export type Role = 'designer' | 'coder' | 'creative' | 'manager' | 'vibe';

export const ROLES: Record<Role, { title: string; tagline: string; hidden: boolean }> = {
  designer: {
    title: 'Дизайнер',
    tagline: 'Делает сложное ясным и цельным',
    hidden: false,
  },
  coder: {
    title: 'Кодер',
    tagline: 'Находит систему и собирает рабочее решение',
    hidden: false,
  },
  creative: {
    title: 'Креативщик',
    tagline: 'Открывает неожиданные, но уместные ходы',
    hidden: false,
  },
  manager: {
    title: 'Менеджер',
    tagline: 'Соединяет людей, сроки и движение вперёд',
    hidden: false,
  },
  vibe: {
    title: 'Вайбодел',
    tagline: 'Чувствует атмосферу и помогает группе звучать вместе',
    hidden: true,
  },
};

/** Веса варианта по ролям. `vibe` копится отдельно и решает всё в конце. */
export interface Option {
  text: string;
  weights: Partial<Record<Exclude<Role, 'vibe'>, number>>;
  vibe?: number;
}

export interface Question {
  text: string;
  options: Option[];
}

/**
 * Восемь вопросов. Тон — сухой и без пафоса: аудитория отторгает
 * «пройди тест и узнай свою суперсилу».
 */
export const QUESTIONS: readonly Question[] = [
  {
    text: 'Новая задача описана одной строкой. С чего начнёшь?',
    options: [
      { text: 'Соберу контекст и уточню результат', weights: { manager: 3 } },
      { text: 'Сделаю небольшой рабочий прототип', weights: { coder: 3 } },
      { text: 'Покажу несколько направлений на выбор', weights: { designer: 2, creative: 2 } },
      { text: 'Сначала понаблюдаю за общей динамикой', weights: {}, vibe: 3 },
    ],
  },
  {
    text: 'Какой сигнал ты замечаешь раньше других?',
    options: [
      { text: 'Форма мешает понять главное', weights: { designer: 3 } },
      { text: 'Система ведёт себя непредсказуемо', weights: { coder: 3 } },
      { text: 'У задачи остался нераскрытый ход', weights: { creative: 3 } },
      { text: 'Люди не понимают общий следующий шаг', weights: { manager: 3 } },
    ],
  },
  {
    text: 'Появилось три свободных часа. Что выберешь?',
    options: [
      { text: 'Улучшу то, чем уже пользуются', weights: { designer: 2, coder: 2 } },
      { text: 'Проверю новую идею', weights: { creative: 3 } },
      { text: 'Закрою несколько незавершённых нитей', weights: { manager: 3 } },
      { text: 'Оставлю пространство и восстановлю внимание', weights: {}, vibe: 3 },
    ],
  },
  {
    text: 'В чате обсуждение ушло на сорок сообщений. Ты…',
    options: [
      { text: 'Собираю итог и предлагаю следующий шаг', weights: { manager: 3 } },
      { text: 'Приношу пример, на котором можно проверить спор', weights: { coder: 2, designer: 1 } },
      { text: 'Предлагаю другой угол, который ещё не обсуждали', weights: { creative: 3 } },
      { text: 'Слежу за тоном и подключаюсь, когда это полезно', weights: {}, vibe: 2 },
    ],
  },
  {
    text: 'Какой результат радует тебя сильнее?',
    options: [
      { text: 'Он точный и понятный', weights: { designer: 3 } },
      { text: 'Он заработал вовремя', weights: { coder: 2, manager: 1 } },
      { text: 'В нём появился новый взгляд', weights: { creative: 3 } },
      { text: 'Людям рядом стало легче взаимодействовать', weights: {}, vibe: 2, },
    ],
  },
  {
    text: 'Суть готова, но подача ещё сырая. Что дальше?',
    options: [
      { text: 'Доведу подачу до ясного состояния', weights: { designer: 3 } },
      { text: 'Зафиксирую рабочую версию и улучшу следующим шагом', weights: { coder: 2, manager: 2 } },
      { text: 'Проверю идею на людях, прежде чем полировать', weights: { creative: 2 }, vibe: 1 },
      { text: 'Дам работе немного отлежаться и вернусь свежим взглядом', weights: {}, vibe: 3 },
    ],
  },
  {
    text: 'Что ближе?',
    options: [
      { text: 'Понять, как это устроено', weights: { coder: 3 } },
      { text: 'Сделать взаимодействие ясным и приятным', weights: { designer: 3 } },
      { text: 'Найти сильный смысл и новый ход', weights: { creative: 3 } },
      { text: 'Собрать людей и довести до конца', weights: { manager: 3 } },
    ],
  },
  {
    text: 'Дедлайн завтра, а готова половина. Что выберешь?',
    options: [
      { text: 'Соберу устойчивую рабочую версию', weights: { coder: 3 } },
      { text: 'Уберу лишнее и доведу главное', weights: { manager: 3 } },
      { text: 'Честно пересогласую объём или срок', weights: { manager: 1 }, vibe: 2 },
      { text: 'Сохраню спокойствие и найду ритм команды', weights: {}, vibe: 3 },
    ],
  },
] as const;

/**
 * Порог скрытой роли. Вайбодел выпадает тем, кто последовательно выбирал
 * «а оно само» — это не проигрыш, а отдельная идентичность, и именно
 * поэтому она не объявлена в списке заранее.
 */
export const VIBE_THRESHOLD = 11;

export interface RoleResult {
  role: Role;
  scores: Record<Role, number>;
}

/**
 * `answers[i]` — индекс выбранного варианта для вопроса i.
 * Чистая функция: одни и те же ответы всегда дают одну и ту же птицу.
 */
export function resolveRole(answers: readonly number[]): RoleResult {
  const scores: Record<Role, number> = {
    designer: 0,
    coder: 0,
    creative: 0,
    manager: 0,
    vibe: 0,
  };

  QUESTIONS.forEach((question, i) => {
    const option = question.options[answers[i] ?? -1];
    if (!option) return;
    for (const [role, weight] of Object.entries(option.weights)) {
      scores[role as Role] += weight ?? 0;
    }
    scores.vibe += option.vibe ?? 0;
  });

  if (scores.vibe >= VIBE_THRESHOLD) return { role: 'vibe', scores };

  // При равенстве побеждает порядок ROLE_ORDER — иначе результат зависел бы
  // от порядка ключей объекта и перестал быть предсказуемым
  const ROLE_ORDER: Exclude<Role, 'vibe'>[] = [
    'coder',
    'designer',
    'creative',
    'manager',
  ];
  let best: Exclude<Role, 'vibe'> = ROLE_ORDER[0]!;
  for (const role of ROLE_ORDER) {
    if (scores[role] > scores[best]) best = role;
  }

  return { role: best, scores };
}

/** Ответы валидны, только если на каждый вопрос выбран существующий вариант. */
export function validateAnswers(answers: unknown): answers is number[] {
  if (!Array.isArray(answers) || answers.length !== QUESTIONS.length) return false;
  return answers.every(
    (a, i) =>
      Number.isInteger(a) && a >= 0 && a < (QUESTIONS[i]?.options.length ?? 0),
  );
}
