import { ERROR_CODES, ERROR_MESSAGES, type ErrorCode } from '@kontur/contracts';

/**
 * Ошибка с кодом из §8.2. Всё, что не GameError, — это 500 и баг:
 * ошибочные пути обязаны отдавать коды, а не 500 (§14.2).
 */
export class GameError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly details?: Record<string, unknown>,
    message?: string,
  ) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = 'GameError';
  }

  get status(): number {
    return ERROR_CODES[this.code];
  }

  toBody() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}
