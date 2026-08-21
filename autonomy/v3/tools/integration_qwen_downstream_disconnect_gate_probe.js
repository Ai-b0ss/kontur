'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');

class SessionRequestGate {
  constructor() { this._states = new Map(); }
  async acquire(rawKey) {
    const key = String(rawKey || '').trim();
    if (!key) throw new TypeError('session gate key is required');
    let state = this._states.get(key);
    if (!state) {
      state = { locked: false, waiters: [] };
      this._states.set(key, state);
    }
    if (state.locked) await new Promise((resolve) => state.waiters.push(resolve));
    state.locked = true;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = state.waiters.shift();
      if (next) { next(); return; }
      state.locked = false;
      if (this._states.get(key) === state) this._states.delete(key);
    };
  }
  size() { return this._states.size; }
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

async function reproduceCurrentBoundary() {
  const gate = new SessionRequestGate();
  const downstream = new EventEmitter();
  downstream.destroyed = false;
  downstream.writableEnded = false;

  const providerDone = deferred();
  const firstEnteredProvider = deferred();
  let providerCalls = 0;
  let firstFinished = false;
  let secondEntered = false;

  const first = (async () => {
    const release = await gate.acquire('session-a');
    try {
      if (downstream.destroyed || downstream.writableEnded) return;
      providerCalls += 1;
      firstEnteredProvider.resolve();
      await providerDone.promise;
      firstFinished = true;
    } finally {
      release();
    }
  })();

  await firstEnteredProvider.promise;

  const second = (async () => {
    const release = await gate.acquire('session-a');
    try { secondEntered = true; }
    finally { release(); }
  })();

  downstream.destroyed = true;
  downstream.emit('close');
  await new Promise((resolve) => setImmediate(resolve));

  const snapshotBeforeProviderEnds = {
    providerCalls,
    gateSize: gate.size(),
    firstFinished,
    secondEntered,
  };

  assert.deepStrictEqual(snapshotBeforeProviderEnds, {
    providerCalls: 1,
    gateSize: 1,
    firstFinished: false,
    secondEntered: false,
  });

  providerDone.resolve();
  await Promise.all([first, second]);
  assert.strictEqual(secondEntered, true);
  assert.strictEqual(gate.size(), 0);
  return snapshotBeforeProviderEnds;
}

class AbortAwareSessionGate {
  constructor() { this._states = new Map(); }
  async acquire(rawKey, signal) {
    const key = String(rawKey || '').trim();
    if (!key) throw new TypeError('session gate key is required');
    if (signal?.aborted) throw Object.assign(new Error('request aborted'), { code: 'QWEN_REQUEST_ABORTED' });

    let state = this._states.get(key);
    if (!state) {
      state = { locked: false, waiters: [] };
      this._states.set(key, state);
    }

    if (state.locked) {
      await new Promise((resolve, reject) => {
        const waiter = { resolve, reject };
        state.waiters.push(waiter);
        const onAbort = () => {
          const idx = state.waiters.indexOf(waiter);
          if (idx >= 0) state.waiters.splice(idx, 1);
          reject(Object.assign(new Error('request aborted'), { code: 'QWEN_REQUEST_ABORTED' }));
        };
        if (signal) signal.addEventListener('abort', onAbort, { once: true });
        waiter.cleanup = () => signal?.removeEventListener('abort', onAbort);
      });
    }

    if (signal?.aborted) throw Object.assign(new Error('request aborted'), { code: 'QWEN_REQUEST_ABORTED' });
    state.locked = true;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = state.waiters.shift();
      if (next) {
        next.cleanup?.();
        next.resolve();
        return;
      }
      state.locked = false;
      if (this._states.get(key) === state) this._states.delete(key);
    };
  }
  size() { return this._states.size; }
}

async function verifyCandidateContract() {
  const gate = new AbortAwareSessionGate();
  const firstAbort = new AbortController();
  const secondAbort = new AbortController();
  const firstEnteredProvider = deferred();
  let providerActive = false;
  let upstreamDestroyed = false;
  let secondEntered = false;

  const first = (async () => {
    const release = await gate.acquire('session-a', firstAbort.signal);
    try {
      providerActive = true;
      firstEnteredProvider.resolve();
      await new Promise((resolve) => {
        firstAbort.signal.addEventListener('abort', () => {
          upstreamDestroyed = true;
          providerActive = false;
          resolve();
        }, { once: true });
      });
    } finally {
      release();
    }
  })();

  await firstEnteredProvider.promise;
  const second = (async () => {
    const release = await gate.acquire('session-a', secondAbort.signal);
    try { secondEntered = true; }
    finally { release(); }
  })();

  firstAbort.abort();
  await Promise.all([first, second]);

  const result = {
    upstreamDestroyed,
    providerActive,
    secondEntered,
    gateSize: gate.size(),
  };
  assert.deepStrictEqual(result, {
    upstreamDestroyed: true,
    providerActive: false,
    secondEntered: true,
    gateSize: 0,
  });
  return result;
}

async function verifyQueuedDisconnectDoesNotRun() {
  const gate = new AbortAwareSessionGate();
  const held = deferred();
  const first = (async () => {
    const release = await gate.acquire('session-z');
    try { await held.promise; }
    finally { release(); }
  })();

  await new Promise((resolve) => setImmediate(resolve));
  const controller = new AbortController();
  let entered = false;
  const queued = (async () => {
    try {
      const release = await gate.acquire('session-z', controller.signal);
      try { entered = true; }
      finally { release(); }
    } catch (error) {
      assert.strictEqual(error.code, 'QWEN_REQUEST_ABORTED');
    }
  })();

  controller.abort();
  held.resolve();
  await Promise.all([first, queued]);
  assert.strictEqual(entered, false);
  assert.strictEqual(gate.size(), 0);
  return { queuedDisconnectedRequestRanProviderWork: entered };
}

(async () => {
  const current = await reproduceCurrentBoundary();
  const candidate = await verifyCandidateContract();
  const queued = await verifyQueuedDisconnectDoesNotRun();
  console.log(JSON.stringify({
    verdict: 'QWEN_DOWNSTREAM_DISCONNECT_GATE_GAP_REPRODUCED_AND_ABORT_CONTRACT_PASS',
    current,
    candidate,
    queued,
  }, null, 2));
})().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
