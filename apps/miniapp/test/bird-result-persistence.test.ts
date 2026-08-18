import assert from 'node:assert/strict';
import test from 'node:test';
import { hydrateBirdResultIdentity, initialLocalStage } from '../src/local-kontur-model.ts';

test('server-persisted Kotosov identity rehydrates a fresh WebView cache', () => {
  const writes = new Map<string, string>();
  const priorWindow = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        setItem(key: string, value: string) { writes.set(key, value); },
      },
    },
  });
  try {
    const state = {
      hatched: true,
      player: { userId: 42, role: 'vibe', birdResultId: 'kotosov' as const },
    };
    assert.equal(initialLocalStage(state), 'home');
    assert.equal(writes.get('kontur:bird-result:42'), 'kotosov');
  } finally {
    if (priorWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else Object.defineProperty(globalThis, 'window', { configurable: true, value: priorWindow });
  }
});

test('invalid or non-vibe server identity never pollutes the presentation cache', () => {
  const writes: Array<[string, string]> = [];
  const priorWindow = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: { setItem(key: string, value: string) { writes.push([key, value]); } } },
  });
  try {
    hydrateBirdResultIdentity({
      hatched: true,
      player: { userId: 7, role: 'coder', birdResultId: 'woodpecker' },
    });
    hydrateBirdResultIdentity({
      hatched: true,
      player: { userId: 8, role: 'vibe', birdResultId: null },
    });
    assert.deepEqual(writes, []);
  } finally {
    if (priorWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else Object.defineProperty(globalThis, 'window', { configurable: true, value: priorWindow });
  }
});
