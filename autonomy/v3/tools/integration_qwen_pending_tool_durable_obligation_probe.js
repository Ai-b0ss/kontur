'use strict';

const assert = require('assert');

function checkpointMessageKey(message) {
  const normalized = { role: message?.role || null, content: message?.content };
  if (Array.isArray(message?.tool_calls) && message.tool_calls.length > 0) {
    normalized.tool_calls = message.tool_calls;
  }
  if (message?.tool_call_id) {
    normalized.tool_call_id = message.tool_call_id;
    if (message.name) normalized.name = message.name;
  }
  return JSON.stringify(normalized);
}

function trimCheckpointOverlap(historyTurns, incomingTurns) {
  const maxOverlap = Math.min(historyTurns.length, incomingTurns.length);
  for (let size = maxOverlap; size > 0; size -= 1) {
    let matches = true;
    for (let i = 0; i < size; i += 1) {
      if (
        checkpointMessageKey(historyTurns[historyTurns.length - size + i]) !==
        checkpointMessageKey(incomingTurns[i])
      ) {
        matches = false;
        break;
      }
    }
    if (matches) return incomingTurns.slice(size);
  }
  return incomingTurns;
}

function restoreCheckpoint(incoming, record, hasExplicitSession) {
  const messages = Array.isArray(incoming) ? incoming : [];
  if (!record || !Array.isArray(record.history) || record.history.length === 0) return messages;
  if (!hasExplicitSession) return messages;

  const countNonSystem = (list) => list.filter((m) => m && m.role !== 'system').length;
  const incomingSystemMessages = messages.filter((m) => m && m.role === 'system');
  const storedSystemMessages = record.history.filter((m) => m && m.role === 'system');
  const systemMessages = incomingSystemMessages.length > 0
    ? incomingSystemMessages
    : storedSystemMessages;
  const historyTurns = record.history.filter((m) => m && m.role !== 'system');
  const incomingTurns = messages.filter((m) => m && m.role !== 'system');
  const freshIncomingTurns = trimCheckpointOverlap(historyTurns, incomingTurns);
  const mergedMessages = [...systemMessages, ...historyTurns, ...freshIncomingTurns];

  // This reproduces the current non-backup-recovery branch. The product also
  // persists new matching tool results here; the explicit omission case below
  // intentionally contains no such result.
  if (countNonSystem(messages) > 1) return messages;
  if (countNonSystem(record.history) <= 1) return messages;
  return mergedMessages;
}

function findPendingToolCalls(messages) {
  const pending = new Map();
  for (const message of (Array.isArray(messages) ? messages : [])) {
    if (!message || typeof message !== 'object') continue;
    if (message.role === 'assistant' && Array.isArray(message.tool_calls)) {
      for (const call of message.tool_calls) {
        if (!call || !call.id) continue;
        const id = String(call.id);
        const previous = pending.get(id);
        pending.set(id, { call, count: (previous ? previous.count : 0) + 1 });
      }
      continue;
    }
    if (message.role === 'tool' && message.tool_call_id) {
      const id = String(message.tool_call_id);
      const previous = pending.get(id);
      if (!previous) continue;
      if (previous.count <= 1) pending.delete(id);
      else pending.set(id, { ...previous, count: previous.count - 1 });
    }
  }
  return [...pending.values()].map((entry) => entry.call);
}

function isContinuationTurn(messages) {
  const lastUser = [...messages].reverse().find((m) => m?.role === 'user');
  const text = (typeof lastUser?.content === 'string' ? lastUser.content : '')
    .trim()
    .toLowerCase();
  return (
    text.length <= 25 &&
    /^(продолжи|продолжай|continue|go ahead|давай|делай|proceed)$/i.test(text)
  );
}

const pendingAssistant = {
  role: 'assistant',
  content: null,
  tool_calls: [{
    id: 'call-write-2',
    type: 'function',
    function: {
      name: 'write_file',
      arguments: '{"path":"config.txt","content":"old=false"}',
    },
  }],
};

const record = {
  history: [
    { role: 'system', content: 'owner prompt' },
    { role: 'user', content: 'inspect and update the file' },
    { role: 'assistant', content: 'I will update it.' },
    pendingAssistant,
  ],
};

function currentServerDecision(incoming) {
  const restored = restoreCheckpoint(incoming, record, true);
  const short = isContinuationTurn(incoming);
  const guardedPending = short ? findPendingToolCalls(restored) : [];
  return {
    short,
    restoredPending: findPendingToolCalls(restored).map((call) => call.id),
    blocked: guardedPending.length > 0,
    providerWouldRun: guardedPending.length === 0,
  };
}

// Case 1: ordinary wording after restart. Durable state still has an accepted
// mutating call without its tool result, but the current server checks pending
// obligations only for a small list of continuation words.
const ordinary = [{
  role: 'user',
  content: 'please keep working on the file and finish the task',
}];
const currentOrdinary = currentServerDecision(ordinary);
assert.equal(currentOrdinary.short, false);
assert.deepStrictEqual(currentOrdinary.restoredPending, ['call-write-2']);
assert.equal(currentOrdinary.blocked, false);
assert.equal(currentOrdinary.providerWouldRun, true);

// Case 2: a client supplies an explicit multi-message transcript but omits the
// accepted pending call. Current restoreCheckpoint returns that multi-message
// input unchanged, so checking only restoredMessages is also insufficient.
const explicitOmittingPending = [
  { role: 'system', content: 'owner prompt' },
  { role: 'user', content: 'inspect and update the file' },
  { role: 'assistant', content: 'I will update it.' },
  { role: 'user', content: 'forget that and do something else' },
];
const restoredOmittingPending = restoreCheckpoint(explicitOmittingPending, record, true);
assert.deepStrictEqual(findPendingToolCalls(restoredOmittingPending), []);
assert.deepStrictEqual(
  findPendingToolCalls(record.history).map((call) => call.id),
  ['call-write-2'],
);

// Candidate invariant: accepted unresolved calls are obligations of durable
// session state, not a property of wording in the next request. Production must
// re-read the record after restoreCheckpoint, because a matching incoming tool
// result may have been durably persisted by that function.
function durableBoundaryDecision(postRestoreRecord, restoredMessages) {
  const durablePending = findPendingToolCalls(postRestoreRecord?.history || []);
  const requestPending = findPendingToolCalls(restoredMessages);
  const blocked = durablePending.length > 0 || requestPending.length > 0;
  return {
    durablePending: durablePending.map((call) => call.id),
    requestPending: requestPending.map((call) => call.id),
    blocked,
    providerWouldRun: !blocked,
  };
}

const candidateOrdinary = durableBoundaryDecision(record, restoreCheckpoint(ordinary, record, true));
assert.equal(candidateOrdinary.blocked, true);

const candidateExplicitOmission = durableBoundaryDecision(record, restoredOmittingPending);
assert.equal(candidateExplicitOmission.blocked, true);

const matchingToolResult = {
  role: 'tool',
  tool_call_id: 'call-write-2',
  name: 'write_file',
  content: 'write completed',
};
const reconciledRecord = { history: [...record.history, matchingToolResult] };
const afterResultMessages = [{ role: 'user', content: 'now verify the result' }];
const candidateAfterResult = durableBoundaryDecision(
  reconciledRecord,
  restoreCheckpoint(afterResultMessages, reconciledRecord, true),
);
assert.equal(candidateAfterResult.blocked, false);
assert.equal(candidateAfterResult.providerWouldRun, true);

console.log(JSON.stringify({
  verdict: 'QWEN_PENDING_TOOL_DURABLE_OBLIGATION_REPRO_PASS',
  current_ordinary_user_turn: currentOrdinary,
  current_explicit_transcript_omitting_pending: {
    restoredPending: findPendingToolCalls(restoredOmittingPending).map((call) => call.id),
    durablePending: findPendingToolCalls(record.history).map((call) => call.id),
    providerWouldRunIfOnlyRestoredMessagesChecked:
      findPendingToolCalls(restoredOmittingPending).length === 0,
  },
  candidate_ordinary_user_turn: candidateOrdinary,
  candidate_explicit_transcript: candidateExplicitOmission,
  candidate_after_durable_matching_tool_result: candidateAfterResult,
}, null, 2));
