import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { connect } from '../src/driver.js';
import { migrate } from '../src/migrate.js';
import { issueSignal, listSignals } from '../src/signals.js';
import { pilotMetrics } from '../src/metrics.js';
import { num } from '../src/repo.js';

describe('сигнал-карты', () => {
  test('выдаёт карту один раз по стабильному ключу', async () => {
    const root = await mkdtemp(join(tmpdir(), 'kontur-signals-'));
    const previous = process.env.PGLITE_DIR;
    process.env.PGLITE_DIR = join(root, 'pg');

    try {
      const db = await connect(undefined);
      try {
        await migrate(db);
        const user = await db.one<{ id: string | number }>(
          "insert into users (tg_id, username) values (91001, 'signal_test') returning id",
        );
        const userId = num(user?.id);

        const first = await db.transaction((tx) =>
          issueSignal(tx, {
            userId,
            kind: 'own_project',
            title: 'Проект прошёл ревью',
            referenceCode: 'test-project-001',
          }),
        );
        const repeat = await db.transaction((tx) =>
          issueSignal(tx, {
            userId,
            kind: 'own_project',
            title: 'Дубликат не должен появиться',
            referenceCode: 'test-project-001',
          }),
        );
        const cards = await listSignals(db, userId);

        assert.equal(first.created, true);
        assert.equal(repeat.created, false);
        assert.equal(cards.length, 1);
        assert.equal(cards[0]?.title, 'Проект прошёл ревью');
        assert.equal(cards[0]?.kind, 'own_project');

        const concurrent = await Promise.all([
          db.transaction((tx) =>
            issueSignal(tx, {
              userId,
              kind: 'cu_event',
              title: 'Событие ЦУ',
              referenceCode: 'test-event-concurrent',
            }),
          ),
          db.transaction((tx) =>
            issueSignal(tx, {
              userId,
              kind: 'cu_event',
              title: 'Событие ЦУ',
              referenceCode: 'test-event-concurrent',
            }),
          ),
        ]);
        assert.equal(concurrent.filter((result) => result.created).length, 1);
        assert.equal((await listSignals(db, userId)).length, 2);

        const metrics = await pilotMetrics(db);
        assert.equal(metrics.signals.total, 2);
        assert.equal(metrics.signals.players, 1);
        assert.equal(metrics.funnel.hatchRate, null);
      } finally {
        await db.close();
      }
    } finally {
      if (previous === undefined) delete process.env.PGLITE_DIR;
      else process.env.PGLITE_DIR = previous;
      await rm(root, { recursive: true, force: true });
    }
  });
});
