/**
 * packages/core — правила игры.
 *
 * Ни одна функция здесь не обращается к БД, не читает часы и не бросает
 * исключений на валидном входе: `now` и источник случайности всегда
 * передаются аргументом. Вся логика и все лимиты серверные — в чате
 * айтишники, открытый эндпоинт кто-нибудь автоматизирует за выходные.
 */
export * from './config.js';
export * from './time.js';
export * from './roles.js';
export * from './worms.js';
export * from './gacha.js';
export * from './journey.js';
export * from './zero-season.js';
export * from './live-campaign.js';
