import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { connect } from '../src/driver.js';

describe('PGlite', () => {
  test('открывает новый пустой каталог', async () => {
    const root = await mkdtemp(join(tmpdir(), 'kontur-pglite-'));
    const dataDir = join(root, 'pg');
    const previous = process.env.PGLITE_DIR;
    process.env.PGLITE_DIR = dataDir;

    try {
      const db = await connect(undefined);
      try {
        const row = await db.one<{ answer: number }>('select 42 as answer');
        assert.equal(row?.answer, 42);
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
