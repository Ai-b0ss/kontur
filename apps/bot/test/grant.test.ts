import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { DEFAULT_BALANCE } from '@kontur/core';
import { connect, ensureWallet, migrate, num } from '@kontur/db';
import { applyWormGrant } from '../src/bot.js';

describe('атомарная раздача червяков', () => {
  test('одновременные команды не превышают дневной бюджет', async () => {
    const root = await mkdtemp(join(tmpdir(), 'kontur-worm-grant-'));
    const previous = process.env.PGLITE_DIR;
    process.env.PGLITE_DIR = join(root, 'pg');

    try {
      const db = await connect(undefined);
      try {
        await migrate(db);
        const users: number[] = [];
        for (const tgId of [97001, 97002, 97003, 97004, 97005]) {
          const row = await db.one<{ id: string | number }>(
            'insert into users (tg_id) values ($1) returning id',
            [tgId],
          );
          const id = num(row?.id);
          users.push(id);
          await ensureWallet(db, id);
        }

        const [giver, ...receivers] = users as [number, ...number[]];
        const decisions = await Promise.all(
          receivers.map((receiver, index) =>
            applyWormGrant(db, {
              giver,
              receiver,
              reason: `проверка ${index}`,
              targetMessageId: 100 + index,
              day: 42,
              now: new Date('2026-08-03T12:00:00Z'),
              config: DEFAULT_BALANCE,
            }),
          ),
        );

        assert.equal(decisions.filter((decision) => decision.ok).length, 3);
        assert.equal(
          num((await db.one<{ n: string | number }>('select count(1) as n from worm_grants'))?.n),
          3,
        );
        assert.equal(
          num(
            (
              await db.one<{ total: string | number }>(
                'select coalesce(sum(reputation), 0) as total from wallets',
              )
            )?.total,
          ),
          6,
        );
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
