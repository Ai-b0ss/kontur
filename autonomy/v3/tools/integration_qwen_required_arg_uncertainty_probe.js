'use strict';

// Offline contract probe for Qwen direct-agent -> coding-subagent uncertainty.
// Exact source facts checked separately in evidence:
// 1) agent emits {type:'tool'} before executeTool() for parsed JSON;
// 2) tool-executor now rejects missing required fields before handler side effects;
// 3) subagent-side-effect-state treats every enabled mutating tool event as possible side effect
//    unless disabledTool/invalidArguments is set.

const MUTATING = new Set(['bash', 'run_command', 'write_file', 'edit_file', 'append_file']);

function currentObserve(state, event) {
  if (!state || event?.type !== 'tool') return state;
  if (event.disabledTool === true || event.invalidArguments === true) return state;
  if (!MUTATING.has(String(event.name || ''))) return state;
  state.mayHaveSideEffects = true;
  state.lastPotentialSideEffectTool = String(event.name || '');
  return state;
}

function requiredValidation(name, args) {
  const required = {
    write_file: ['path', 'content'],
    append_file: ['path', 'content'],
    edit_file: ['path', 'old', 'new'],
  }[name] || [];
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(args, key) || args[key] == null) {
      return { ok: false, error: `missing required argument: ${key}` };
    }
  }
  return { ok: true };
}

function candidateObserve(state, event) {
  if (!state || event?.type !== 'tool') return state;
  if (event.disabledTool === true || event.invalidArguments === true || event.preflightRejected === true) return state;
  if (!MUTATING.has(String(event.name || ''))) return state;
  state.mayHaveSideEffects = true;
  state.lastPotentialSideEffectTool = String(event.name || '');
  return state;
}

function main() {
  const args = { path: 'demo.txt' }; // missing content: executor rejects before fs.writeFileSync
  const preflight = requiredValidation('write_file', args);
  if (preflight.ok) throw new Error('probe setup invalid');

  const current = { mayHaveSideEffects: false, lastPotentialSideEffectTool: null };
  currentObserve(current, { type: 'tool', name: 'write_file', args });

  const candidate = { mayHaveSideEffects: false, lastPotentialSideEffectTool: null };
  candidateObserve(candidate, {
    type: 'tool',
    name: 'write_file',
    args,
    preflightRejected: !preflight.ok,
  });

  if (current.mayHaveSideEffects !== true) throw new Error('current false-positive not reproduced');
  if (candidate.mayHaveSideEffects !== false) throw new Error('candidate contract failed');

  const result = {
    verdict: 'QWEN_REQUIRED_ARG_FALSE_UNCERTAINTY_REPRODUCED_CANDIDATE_PASS',
    current: {
      handler_started: false,
      durable_or_fs_side_effect: false,
      uncertainty_flag: current.mayHaveSideEffects,
      consequence: 'later round-limit/provider error can become uncertain and block safe retry',
    },
    candidate: {
      handler_started: false,
      durable_or_fs_side_effect: false,
      uncertainty_flag: candidate.mayHaveSideEffects,
      rule: 'mark mutating side-effect boundary only after executor preflight admits the handler',
    },
  };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main();
