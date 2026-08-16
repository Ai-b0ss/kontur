import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  RESTORED_PATHS,
  RESTORED_TABS,
  restoredDefaultStatus,
  restoredDraftKey,
} from '../src/restored-model.ts';

describe('модель восстановленного интерфейса', () => {
  it('держит ровно пять основных вкладок без скрытого архива', () => {
    assert.deepEqual(
      RESTORED_TABS.map((tab) => tab.key),
      ['bird', 'community', 'actions', 'nest', 'collection'],
    );
  });

  it('даёт восемь разных и стабильных путей участия', () => {
    const kinds = RESTORED_PATHS.map((path) => path.kind);
    assert.equal(kinds.length, 8);
    assert.equal(new Set(kinds).size, 8);
    assert.deepEqual(kinds, [
      'ask', 'help', 'connect', 'orient',
      'opportunity', 'contribution', 'save', 'progress',
    ]);
  });

  it('считает вклад и сохранённый результат завершёнными, не подменяя подтверждение', () => {
    assert.equal(restoredDefaultStatus('contribution'), 'done');
    assert.equal(restoredDefaultStatus('save'), 'done');
    assert.equal(restoredDefaultStatus('ask'), 'active');
  });

  it('разносит черновики по типам пути', () => {
    assert.notEqual(restoredDraftKey('ask'), restoredDraftKey('connect'));
  });
});
