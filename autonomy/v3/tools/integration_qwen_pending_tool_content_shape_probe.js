'use strict';

const assert = require('assert');

function extractSessionText(content) {
  if (typeof content === 'string') return content.trim().slice(0, 4000);
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === 'string') return part;
      return part?.text || part?.content || '';
    }).join(' ').trim().slice(0, 4000);
  }
  if (content && typeof content === 'object') {
    return extractSessionText(content.text || content.content || '');
  }
  return '';
}

function isContinuationText(text) {
  const normalized = String(text || '').trim().toLowerCase();
  return normalized.length <= 25 &&
    /^(продолжи|продолжай|continue|go ahead|давай|делай|proceed)$/i.test(normalized);
}

function currentServerContinuation(lastUser) {
  const lastUserStr = (
    typeof lastUser?.content === 'string' ? lastUser.content : ''
  ).trim().toLowerCase();
  return isContinuationText(lastUserStr);
}

function candidateContinuation(lastUser) {
  return isContinuationText(extractSessionText(lastUser?.content));
}

function currentPendingGate(lastUser, pendingCalls) {
  const isContinuationTurn = currentServerContinuation(lastUser);
  return isContinuationTurn && pendingCalls.length > 0;
}

function candidatePendingGate(lastUser, pendingCalls) {
  const isContinuationTurn = candidateContinuation(lastUser);
  return isContinuationTurn && pendingCalls.length > 0;
}

const pending = [{ id: 'call-write-2', function: { name: 'write_file' } }];

const shapes = [
  { label: 'plain-string', message: { role: 'user', content: 'continue' }, current: true },
  {
    label: 'openai-text-part-array',
    message: { role: 'user', content: [{ type: 'text', text: 'continue' }] },
    current: false,
  },
  {
    label: 'generic-text-object',
    message: { role: 'user', content: { type: 'text', text: 'continue' } },
    current: false,
  },
  {
    label: 'mixed-array',
    message: { role: 'user', content: [{ type: 'text', text: 'continue' }, { type: 'meta', content: '' }] },
    current: false,
  },
];

for (const item of shapes) {
  assert.strictEqual(
    currentServerContinuation(item.message),
    item.current,
    `current server classification mismatch for ${item.label}`,
  );
  assert.strictEqual(
    candidateContinuation(item.message),
    true,
    `candidate must recognize continuation for ${item.label}`,
  );
}

assert.strictEqual(currentPendingGate(shapes[0].message, pending), true);
for (const item of shapes.slice(1)) {
  assert.strictEqual(
    currentPendingGate(item.message, pending),
    false,
    `current pending-tool restart gate is bypassed by ${item.label}`,
  );
  assert.strictEqual(
    candidatePendingGate(item.message, pending),
    true,
    `candidate must fail closed for ${item.label}`,
  );
}

const nonContinuation = {
  role: 'user',
  content: [{ type: 'text', text: 'please inspect the next file' }],
};
assert.strictEqual(candidateContinuation(nonContinuation), false);

console.log(JSON.stringify({
  verdict: 'QWEN_PENDING_TOOL_CONTENT_SHAPE_GAP_REPRODUCED',
  current: {
    string_continue_blocked: true,
    array_continue_blocked: false,
    object_continue_blocked: false,
    risk: 'pending mutating tool call can pass restart short-continue gate when OpenAI content is non-string',
  },
  candidate: {
    use_existing_extractSessionText: true,
    string_continue_blocked: true,
    array_continue_blocked: true,
    object_continue_blocked: true,
    ordinary_noncontinuation_unchanged: true,
  },
}));
