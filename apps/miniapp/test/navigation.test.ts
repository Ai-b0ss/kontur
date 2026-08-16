import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { availableTabs } from '../src/navigation.ts';
import { telegramShareUrl } from '../src/share.ts';

describe('доступные вкладки', () => {
  test('скрывает выключенные функции вместо вечной загрузки', () => {
    const tabs = availableTabs({ eggs: false, community: false, passive: true });
    assert.deepEqual(tabs.map((tab) => tab.key), ['profile']);
  });

  test('показывает полный набор при включённых функциях', () => {
    const tabs = availableTabs({ eggs: true, community: true, passive: true });
    assert.deepEqual(tabs.map((tab) => tab.key), ['profile', 'community', 'eggs']);
  });
});

describe('публичный шаринг', () => {
  test('использует обычную Telegram share-ссылку и кодирует текст', () => {
    const url = telegramShareUrl('Птица — Кодер & друг');
    assert.equal(
      url,
      'https://t.me/share/url?url=&text=%D0%9F%D1%82%D0%B8%D1%86%D0%B0%20%E2%80%94%20%D0%9A%D0%BE%D0%B4%D0%B5%D1%80%20%26%20%D0%B4%D1%80%D1%83%D0%B3',
    );
  });
});
