import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { mapClassicCore } from '../src/zero-season-api.ts';

describe('V4 state classic core snapshot', () => {
  test('без строк profiles/wallets отдаёт пустое ядро', () => {
    assert.deepEqual(mapClassicCore(null), {
      hatched: false,
      wallet: 0,
      reputation: 0,
      coloringTitle: null,
      birdName: null,
      roleTitle: null,
    });
  });

  test('читает кошелёк и роль из классического профиля', () => {
    assert.deepEqual(mapClassicCore({
      role: 'coder',
      hatched_at: '2026-08-01 10:00:00',
      bird_name: 'Клин',
      wallet: 12,
      reputation: 40,
      coloring_title: 'Изумруд',
    }), {
      hatched: true,
      wallet: 12,
      reputation: 40,
      coloringTitle: 'Изумруд',
      birdName: 'Клин',
      roleTitle: 'Кодер',
    });
  });

  test('без hatched_at не считает профиль вылупленным', () => {
    const core = mapClassicCore({
      role: 'designer',
      hatched_at: null,
      bird_name: null,
      wallet: 0,
      reputation: 0,
      coloring_title: 'Обычный',
    });
    assert.equal(core.hatched, false);
    assert.equal(core.roleTitle, 'Дизайнер');
    assert.equal(core.coloringTitle, 'Обычный');
  });
});
