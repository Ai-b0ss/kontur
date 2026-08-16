import { ERROR_CODES, ERROR_MESSAGES, type ErrorCode } from '@kontur/contracts';

export class GameError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, details?: Record<string, unknown>) {
    super(ERROR_MESSAGES[code]);
    this.code = code;
    this.status = ERROR_CODES[code];
    this.details = details;
  }

  body() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

export function sqliteError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('ALREADY_HATCHED')) throw new GameError('ALREADY_HATCHED');
  if (message.includes('DAILY_LIMIT')) throw new GameError('RATE_LIMITED', { reason: 'daily_limit' });
  if (message.includes('UNIQUE constraint failed: worm_grants.from_user_id')) {
    throw new GameError('RATE_LIMITED', { reason: 'same_person_today' });
  }
  throw error;
}
