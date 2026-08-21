#!/usr/bin/env node
'use strict';

const crypto = require('crypto');

function taskSignature(tasks, context = {}) {
  const normalized = {
    tasks: tasks.map((task) => ({
      id: task.id,
      prompt: task.prompt,
      skills: task.skills || [],
    })),
    context,
  };
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

const tasks = [{
  id: 'child-1',
  prompt: 'Edit the project and run tests',
  skills: [],
}];

const currentContext = {
  mode: 'engineer',
  model: 'qwen3.8-max',
  sessionPrefix: 'qwen-delegate-abc',
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

const projectASignature = taskSignature(tasks, currentContext);
const projectBSignature = taskSignature(tasks, currentContext);
if (projectASignature !== projectBSignature) {
  throw new Error('current reproduction failed');
}

function scopedContext(base, stableWorkspaceIdentity) {
  return {
    ...base,
    workspaceIdentitySha256: crypto
      .createHash('sha256')
      .update(stableWorkspaceIdentity)
      .digest('hex'),
  };
}

const hardenedA = taskSignature(
  tasks,
  scopedContext(currentContext, 'repo:Ai-b0ss/project-a'),
);
const hardenedB = taskSignature(
  tasks,
  scopedContext(currentContext, 'repo:Ai-b0ss/project-b'),
);
if (hardenedA === hardenedB) {
  throw new Error('workspace-scoped signature candidate failed');
}

console.log(JSON.stringify({
  verdict: 'QWEN_PERSISTED_BATCH_WORKSPACE_IDENTITY_GAP_REPRO_PASS',
  current: {
    project_a_signature: projectASignature,
    project_b_signature: projectBSignature,
    same_signature_across_logical_workspaces: true,
  },
  candidate: {
    workspace_identity_is_content_free_hash_only: true,
    project_a_signature: hardenedA,
    project_b_signature: hardenedB,
    signatures_differ: true,
  },
}, null, 2));
