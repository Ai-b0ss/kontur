'use strict';

function currentFindPendingToolCalls(messages) {
  const pending = new Map();
  for (const message of Array.isArray(messages) ? messages : []) {
    if (!message || typeof message !== 'object') continue;
    if (message.role === 'assistant' && Array.isArray(message.tool_calls)) {
      for (const call of message.tool_calls) {
        if (!call || !call.id) continue;
        pending.set(String(call.id), call);
      }
      continue;
    }
    if (message.role === 'tool' && message.tool_call_id) {
      pending.delete(String(message.tool_call_id));
    }
  }
  return [...pending.values()];
}

function candidateFindPendingToolCalls(messages) {
  const pending = new Map();
  for (const message of Array.isArray(messages) ? messages : []) {
    if (!message || typeof message !== 'object') continue;
    if (message.role === 'assistant' && Array.isArray(message.tool_calls)) {
      for (const call of message.tool_calls) {
        if (!call || !call.id) continue;
        const id = String(call.id);
        const prev = pending.get(id);
        pending.set(id, { call, count: (prev ? prev.count : 0) + 1 });
      }
      continue;
    }
    if (message.role === 'tool' && message.tool_call_id) {
      const id = String(message.tool_call_id);
      const prev = pending.get(id);
      if (!prev) continue;
      if (prev.count <= 1) pending.delete(id);
      else pending.set(id, { ...prev, count: prev.count - 1 });
    }
  }
  return [...pending.values()].map((entry) => entry.call);
}

function validateNewAssistantToolCalls(assistantMessage) {
  const calls = Array.isArray(assistantMessage?.tool_calls) ? assistantMessage.tool_calls : [];
  const seen = new Set();
  for (const call of calls) {
    const id = call?.id ? String(call.id) : '';
    if (!id) throw new Error('missing tool_call id');
    if (seen.has(id)) throw new Error('duplicate tool_call id');
    seen.add(id);
  }
  return true;
}

const callA = { id: 'call-1', function: { name: 'write_file' } };
const callB = { id: 'call-1', function: { name: 'append_file' } };

const malformedRestartHistory = [
  { role: 'assistant', content: null, tool_calls: [callA] },
  { role: 'assistant', content: null, tool_calls: [callB] },
  { role: 'tool', tool_call_id: 'call-1', content: 'ok' },
];

const currentPending = currentFindPendingToolCalls(malformedRestartHistory);
const candidatePending = candidateFindPendingToolCalls(malformedRestartHistory);

let duplicateRejected = false;
try {
  validateNewAssistantToolCalls({ role: 'assistant', tool_calls: [callA, callB] });
} catch (error) {
  duplicateRejected = /duplicate/.test(String(error.message));
}

const normalHistory = [
  { role: 'assistant', tool_calls: [callA] },
  { role: 'tool', tool_call_id: 'call-1', content: 'ok' },
  { role: 'assistant', tool_calls: [callB] },
];
const normalPending = candidateFindPendingToolCalls(normalHistory);

const result = {
  verdict: 'REPRODUCED_CURRENT_PENDING_COLLAPSE_AND_CANDIDATE_PASS',
  current_duplicate_calls_plus_one_result_pending_count: currentPending.length,
  candidate_duplicate_calls_plus_one_result_pending_count: candidatePending.length,
  candidate_rejects_duplicate_ids_in_one_new_assistant_message: duplicateRejected,
  candidate_allows_id_reuse_after_prior_call_was_resolved_pending_count: normalPending.length,
};
if (result.current_duplicate_calls_plus_one_result_pending_count !== 0) throw new Error('current reproduction failed');
if (result.candidate_duplicate_calls_plus_one_result_pending_count !== 1) throw new Error('candidate count failed');
if (!duplicateRejected) throw new Error('candidate duplicate rejection failed');
if (result.candidate_allows_id_reuse_after_prior_call_was_resolved_pending_count !== 1) throw new Error('resolved reuse behavior failed');
console.log(JSON.stringify(result));
