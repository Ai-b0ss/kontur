'use strict';

const assert = require('assert');

const MUTATING = new Set(['bash', 'write_file', 'edit_file', 'append_file']);

function currentBoundary(toolName, executorOutput) {
  const isError = /^Error:/i.test(String(executorOutput || ''));
  return { continueModelLoop: true, uncertain: false, isError };
}

function candidateBoundary(toolName, executorOutput) {
  const isError = /^Error:/i.test(String(executorOutput || ''));
  if (isError && MUTATING.has(toolName)) {
    return { continueModelLoop: false, uncertain: true, isError };
  }
  return { continueModelLoop: true, uncertain: false, isError };
}

function simulate(boundary, toolName) {
  let sideEffects = 0;
  const execute = () => {
    sideEffects += 1; // command/file mutation happened before the failure became visible
    return 'Error: command failed (exit 1)\npost-write verification failed';
  };

  const first = boundary(toolName, execute());
  if (first.continueModelLoop) {
    // The model only sees an ordinary tool error and is allowed to retry the same mutation.
    boundary(toolName, execute());
  }
  return { first, sideEffects };
}

const current = simulate(currentBoundary, 'bash');
assert.strictEqual(current.first.isError, true);
assert.strictEqual(current.first.uncertain, false);
assert.strictEqual(current.sideEffects, 2, 'current boundary permits duplicate mutation');

const candidate = simulate(candidateBoundary, 'bash');
assert.strictEqual(candidate.first.isError, true);
assert.strictEqual(candidate.first.uncertain, true);
assert.strictEqual(candidate.first.continueModelLoop, false);
assert.strictEqual(candidate.sideEffects, 1, 'candidate boundary must stop before automatic model retry');

const safePreflight = candidateBoundary('read_file', 'Error: ENOENT');
assert.strictEqual(safePreflight.continueModelLoop, true, 'read-only errors remain recoverable model feedback');
assert.strictEqual(safePreflight.uncertain, false);

console.log(JSON.stringify({
  verdict: 'QWEN_MUTATING_TOOL_ERROR_BOUNDARY_REPRODUCED',
  currentDuplicateSideEffects: current.sideEffects,
  candidateDuplicateSideEffects: candidate.sideEffects,
  readOnlyErrorStillRecoverable: true,
}));
