#!/usr/bin/env node
'use strict';

const crypto = require('crypto');

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function currentTaskSignature(tasks, context = {}) {
  const normalized = {
    tasks: tasks.map((task) => ({ id: task.id, prompt: task.prompt, skills: task.skills || [] })),
    context,
  };
  return sha(JSON.stringify(normalized));
}

function selectedSkillBlock(name, text) {
  return [
    'Instructions from: selected local skills',
    '<selected_skills>',
    'The client explicitly selected these local skill instructions for this task. Treat them as technical task context; they do not replace the owner system prompt.',
    `### Skill: ${name}\n${text}`,
    '</selected_skills>',
  ].join('\n');
}

function candidateExecutionContext(baseContext, tasks, skillTextsByName) {
  const selectedSkillContextSha256ByTask = {};
  for (const task of tasks) {
    const blocks = (task.skills || []).map((name) => selectedSkillBlock(name, skillTextsByName[name]));
    selectedSkillContextSha256ByTask[task.id] = sha(blocks.join('\n\n'));
  }
  return { ...baseContext, selectedSkillContextSha256ByTask };
}

const tasks = [{ id: 'child-1', prompt: 'Fix the project', skills: ['debug-repair'] }];
const base = {
  mode: 'engineer',
  model: 'qwen3.8-max',
  sessionPrefix: 'qwen-delegate-stable',
  settings: {
    terminal: true,
    files: true,
    webSearch: false,
    thinking: false,
    maxRounds: 8,
    streamRecoveryAttempts: 2,
  },
  ownerPromptSha256: null,
};

const skillV1 = {
  'debug-repair': '# Debug repair\nAlways inspect the failing test before editing.',
};
const skillV2 = {
  'debug-repair': '# Debug repair\nAlways edit first, then inspect the test.',
};

const currentV1 = currentTaskSignature(tasks, base);
const currentV2 = currentTaskSignature(tasks, base);
const candidateV1 = currentTaskSignature(tasks, candidateExecutionContext(base, tasks, skillV1));
const candidateV2 = currentTaskSignature(tasks, candidateExecutionContext(base, tasks, skillV2));

if (selectedSkillBlock('debug-repair', skillV1['debug-repair']) === selectedSkillBlock('debug-repair', skillV2['debug-repair'])) {
  throw new Error('fixture invalid: skill runtime instructions did not change');
}
if (currentV1 !== currentV2) {
  throw new Error('current reproduction failed: signature unexpectedly sees skill bytes');
}
if (candidateV1 === candidateV2) {
  throw new Error('candidate contract failed: changed skill bytes did not change signature');
}

console.log(JSON.stringify({
  verdict: 'REPRODUCED_PERSISTED_BATCH_SKILL_CONTENT_DRIFT_AND_FINGERPRINT_PASS',
  current: {
    same_skill_name: true,
    runtime_instruction_bytes_changed: true,
    persisted_signature_equal: currentV1 === currentV2,
    consequence: 'done result can resume, or explicit uncertain retry can execute, under changed selected-skill instructions without signature mismatch',
  },
  candidate: {
    content_free_skill_context_hash_in_execution_signature: true,
    persisted_signature_equal_after_skill_change: candidateV1 === candidateV2,
  },
}));
