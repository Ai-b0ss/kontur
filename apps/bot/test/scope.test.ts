import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { isMainChat } from '../src/scope.js';
import { isQuietHour } from '../src/bot.js';

describe('граница основного чата', () => {
  test('принимает числовой Telegram ID', () => {
    assert.equal(isMainChat(-100123, '-100123'), true);
  });

  test('отклоняет чужой чат', () => {
    assert.equal(isMainChat(-100999, '-100123'), false);
  });

  test('закрыта, если MAIN_CHAT_ID не задан', () => {
    assert.equal(isMainChat(-100123, ''), false);
  });
});

describe('тихие часы', () => {
  test('поддерживает окно через полночь', () => {
    assert.equal(isQuietHour(22, 20, 6), true);
    assert.equal(isQuietHour(2, 20, 6), true);
    assert.equal(isQuietHour(15, 20, 6), false);
  });

  test('одинаковые границы означают отсутствие тихого окна', () => {
    assert.equal(isQuietHour(12, 0, 0), false);
  });
});
