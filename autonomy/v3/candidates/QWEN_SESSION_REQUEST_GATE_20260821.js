'use strict';

class SessionRequestGate {
  constructor() {
    this._states = new Map();
  }

  async acquire(rawKey) {
    const key = String(rawKey || '').trim();
    if (!key) throw new TypeError('session gate key is required');
    let state = this._states.get(key);
    if (!state) {
      state = { locked: false, waiters: [] };
      this._states.set(key, state);
    }

    if (state.locked) {
      await new Promise((resolve) => state.waiters.push(resolve));
    }
    state.locked = true;

    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = state.waiters.shift();
      if (next) {
        next();
        return;
      }
      state.locked = false;
      if (this._states.get(key) === state) this._states.delete(key);
    };
  }

  async runExclusive(key, operation) {
    const release = await this.acquire(key);
    try {
      return await operation();
    } finally {
      release();
    }
  }

  size() {
    return this._states.size;
  }
}

module.exports = { SessionRequestGate };
