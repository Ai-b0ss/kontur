'use strict';

class SessionRequestGate {
  constructor() { this._states = new Map(); }
  async acquire(rawKey) {
    const key = String(rawKey || '').trim();
    if (!key) throw new TypeError('session gate key is required');
    let state = this._states.get(key);
    if (!state) { state = { locked: false, waiters: [] }; this._states.set(key, state); }
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
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

async function reproduceCurrentOrdering() {
  const gate = new SessionRequestGate();
  const state = new Map([['s1', { chatId: 'chat-old', history: ['old'] }]]);
  const providerStarted = deferred();
  const allowProviderFinish = deferred();
  const events = [];

  async function normalRequest() {
    const release = await gate.acquire('s1');
    try {
      const before = state.get('s1');
      events.push(['request-read', before ? before.chatId : null]);
      providerStarted.resolve();
      await allowProviderFinish.promise;
      state.set('s1', { chatId: 'chat-new', history: ['old', 'accepted-mutating-tool-call'] });
      events.push(['request-persist', 'chat-new']);
    } finally {
      release();
    }
  }

  // Exact current server ordering: command detection/handleCommand occurs before gate.acquire().
  async function resetCommandBypassingGate() {
    state.delete('s1');
    events.push(['reset-response', 'Session Reset Complete']);
  }

  const request = normalRequest();
  await providerStarted.promise;
  await resetCommandBypassingGate();
  const emptyImmediatelyAfterReset = !state.has('s1');
  allowProviderFinish.resolve();
  await request;

  return {
    events,
    empty_immediately_after_reset: emptyImmediatelyAfterReset,
    final_session_exists: state.has('s1'),
    final_chat_id: state.get('s1')?.chatId || null,
    accepted_tool_call_resurrected: Boolean(state.get('s1')?.history?.includes('accepted-mutating-tool-call')),
  };
}

async function verifyCandidateOrdering() {
  const gate = new SessionRequestGate();
  const state = new Map([['s1', { chatId: 'chat-old', history: ['old'] }]]);
  const providerStarted = deferred();
  const allowProviderFinish = deferred();
  const resetQueued = deferred();
  const events = [];

  async function normalRequest() {
    const release = await gate.acquire('s1');
    try {
      events.push(['request-read', state.get('s1')?.chatId || null]);
      providerStarted.resolve();
      await allowProviderFinish.promise;
      state.set('s1', { chatId: 'chat-new', history: ['old', 'accepted-mutating-tool-call'] });
      events.push(['request-persist', 'chat-new']);
    } finally { release(); }
  }

  async function resetCommandThroughSameGate() {
    resetQueued.resolve();
    const release = await gate.acquire('s1');
    try {
      state.delete('s1');
      events.push(['reset-response', 'Session Reset Complete']);
    } finally { release(); }
  }

  const request = normalRequest();
  await providerStarted.promise;
  const reset = resetCommandThroughSameGate();
  await resetQueued.promise;
  await new Promise((r) => setTimeout(r, 0));
  const resetRespondedBeforeRequestFinished = events.some((e) => e[0] === 'reset-response');
  allowProviderFinish.resolve();
  await Promise.all([request, reset]);

  return {
    events,
    reset_responded_before_request_finished: resetRespondedBeforeRequestFinished,
    final_session_exists: state.has('s1'),
    final_session_clean: !state.has('s1'),
  };
}

(async () => {
  const current = await reproduceCurrentOrdering();
  const candidate = await verifyCandidateOrdering();
  if (!current.empty_immediately_after_reset || !current.final_session_exists || !current.accepted_tool_call_resurrected) {
    throw new Error(`current reproduction failed: ${JSON.stringify(current)}`);
  }
  if (candidate.reset_responded_before_request_finished || !candidate.final_session_clean) {
    throw new Error(`candidate contract failed: ${JSON.stringify(candidate)}`);
  }
  console.log(JSON.stringify({
    verdict: 'QWEN_SESSION_RESET_GATE_RACE_REPRO_AND_CANDIDATE_PASS',
    current,
    candidate,
  }, null, 2));
})().catch((error) => { console.error(error); process.exit(1); });
