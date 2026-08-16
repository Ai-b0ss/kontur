/** Коды ошибок. Ошибочные пути отдают их, а не 500. */
export const ERROR_CODES = {
  INVALID_INIT_DATA: 401,
  SESSION_EXPIRED: 401,
  NOT_MEMBER: 403,
  BANNED: 403,
  NOT_STARTED: 403,
  FEATURE_LOCKED: 409,
  ALREADY_HATCHED: 409,
  NOT_HATCHED: 409,
  NOT_ENOUGH_WORMS: 409,
  NOTHING_TO_COLLECT: 409,
  COLORING_LOCKED: 409,
  PLAYER_NOT_FOUND: 404,
  JOURNEY_NOT_FOUND: 404,
  NEST_ITEM_NOT_FOUND: 404,
  RESTORED_ACTION_NOT_FOUND: 404,
  RESTORED_NEST_ITEM_NOT_FOUND: 404,
  EXPERIENCE_DISABLED: 404,
  INVALID_TRANSITION: 409,
  HELP_CONFIRMATION_REJECTED: 409,
  TELEGRAM_UNAVAILABLE: 503,
  RATE_LIMITED: 429,
  VALIDATION: 400,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** Тон: сухо, без восклицательных знаков. */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  INVALID_INIT_DATA: 'Подпись Telegram не прошла проверку',
  SESSION_EXPIRED: 'Сессия истекла',
  NOT_MEMBER: 'Игра работает только для участников чата',
  BANNED: 'Доступ закрыт',
  NOT_STARTED: 'Сначала напиши боту /start',
  FEATURE_LOCKED: 'Ещё не открыто',
  ALREADY_HATCHED: 'Птица уже вылупилась',
  NOT_HATCHED: 'Сначала пройди тест',
  NOT_ENOUGH_WORMS: 'Не хватает червяков',
  NOTHING_TO_COLLECT: 'Сегодня уже собрано',
  COLORING_LOCKED: 'Этот окрас ещё не выпал',
  PLAYER_NOT_FOUND: 'Игрок не найден',
  JOURNEY_NOT_FOUND: 'Путь не найден',
  NEST_ITEM_NOT_FOUND: 'Запись гнезда не найдена',
  RESTORED_ACTION_NOT_FOUND: 'Действие не найдено',
  RESTORED_NEST_ITEM_NOT_FOUND: 'Сохранённый результат не найден',
  EXPERIENCE_DISABLED: 'Новая версия пока недоступна',
  INVALID_TRANSITION: 'Это действие сейчас недоступно',
  HELP_CONFIRMATION_REJECTED: 'Не удалось связать благодарность с ответом',
  TELEGRAM_UNAVAILABLE: 'Telegram временно не отвечает',
  RATE_LIMITED: 'Слишком часто',
  VALIDATION: 'Некорректный запрос',
};
