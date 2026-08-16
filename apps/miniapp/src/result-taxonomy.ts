import type { Role, RoleResult } from '@kontur/core';

export type BirdResultId = 'magpie' | 'woodpecker' | 'jay' | 'crane' | 'owl' | 'kotosov';

export type BirdResult = {
  resolvedRole: Role;
  resultId: BirdResultId;
  bird: string;
  variant: 'default' | 'generic-vibe' | 'vibe-coder';
  reason: 'direct-role-map' | 'coder-is-unique-secondary' | 'coder-is-not-unique-secondary' | 'incomplete-secondary-profile';
};

export const ROLE_TO_RESULT: Readonly<Record<Exclude<Role, 'vibe'>, Omit<BirdResult, 'resolvedRole' | 'reason'>>> = Object.freeze({
  designer: Object.freeze({ resultId: 'magpie', bird: 'сорока', variant: 'default' }),
  coder: Object.freeze({ resultId: 'woodpecker', bird: 'дятел', variant: 'default' }),
  creative: Object.freeze({ resultId: 'jay', bird: 'сойка', variant: 'default' }),
  manager: Object.freeze({ resultId: 'crane', bird: 'журавль', variant: 'default' }),
});

const NON_VIBE_ROLES: readonly Exclude<Role, 'vibe'>[] = ['designer', 'coder', 'creative', 'manager'];

function completeScores(scores: RoleResult['scores'] | null | undefined): scores is RoleResult['scores'] {
  return Boolean(scores && NON_VIBE_ROLES.every((role) => Number.isFinite(scores[role])));
}

export function selectBirdResult({
  resolvedRole,
  scores,
}: {
  resolvedRole: Role;
  scores?: RoleResult['scores'] | null;
}): BirdResult {
  if (resolvedRole !== 'vibe') {
    return Object.freeze({
      resolvedRole,
      ...ROLE_TO_RESULT[resolvedRole],
      reason: 'direct-role-map',
    });
  }

  if (!completeScores(scores)) {
    return Object.freeze({
      resolvedRole,
      resultId: 'owl',
      bird: 'сова',
      variant: 'generic-vibe',
      reason: 'incomplete-secondary-profile',
    });
  }

  const coderIsUniqueSecondary = NON_VIBE_ROLES
    .filter((role) => role !== 'coder')
    .every((role) => scores.coder > scores[role]);

  return coderIsUniqueSecondary
    ? Object.freeze({
        resolvedRole,
        resultId: 'kotosov',
        bird: 'котосов',
        variant: 'vibe-coder',
        reason: 'coder-is-unique-secondary',
      })
    : Object.freeze({
        resolvedRole,
        resultId: 'owl',
        bird: 'сова',
        variant: 'generic-vibe',
        reason: 'coder-is-not-unique-secondary',
      });
}

const RESULT_NOTES: Readonly<Record<BirdResultId, readonly string[]>> = Object.freeze({
  magpie: Object.freeze([
    'замечаешь, что можно сделать понятнее, раньше остальных',
    'быстро собираешь разрозненные детали в цельную картину',
    'видишь форму даже там, где пока лежит только черновик',
  ]),
  woodpecker: Object.freeze([
    'докапываешься до причины, пока система не начинает отвечать честно',
    'любишь маленький рабочий прототип больше длинного обещания',
    'держишь ритм и не отпускаешь задачу на половине',
  ]),
  jay: Object.freeze([
    'видишь ход, который остальные ещё не успели обсудить',
    'умеешь повернуть знакомую идею неожиданной стороной',
    'оставляешь в решении место для сильной новой мысли',
  ]),
  crane: Object.freeze([
    'собираешь людей и следующий шаг в одну понятную линию',
    'умеешь убрать лишнее, когда дедлайн уже близко',
    'держишь высоту взгляда и всё равно доводишь до земли',
  ]),
  owl: Object.freeze([
    'сначала считываешь атмосферу, потом замечаешь то, что пропустили другие',
    'не спешишь шуметь и подключаешься ровно в нужный момент',
    'бережёшь внимание команды и видишь больше, чем показываешь',
  ]),
  kotosov: Object.freeze([
    'ловишь вайб задачи и уже пишешь код, пока остальные выбирают стек',
    'умеешь собрать рабочее из идеи, пары сообщений и правильного настроения',
    'держишь атмосферу легко, но к прототипу относишься вполне серьёзно',
  ]),
});

export function personalizedBirdNote(resultId: BirdResultId, answers: readonly number[]): string {
  const fingerprint = answers.reduce((total, answer, index) => total + (answer + 1) * (index + 3), 0);
  const notes = RESULT_NOTES[resultId];
  return notes[fingerprint % notes.length]!;
}

export type StoredVibeVariant = 'owl' | 'kotosov';

export function parseStoredVibeVariant(value: string | null | undefined): StoredVibeVariant | null {
  return value === 'owl' || value === 'kotosov' ? value : null;
}

export function vibeVariantStorageKey(userId: number): string {
  return `kontur:bird-result:${userId}`;
}
