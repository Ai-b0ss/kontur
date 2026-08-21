'use strict';
const assert = require('assert');
const crypto = require('crypto');

function promptFingerprint({ mode, ownerPrompt = '', projectSystem = '' }) {
  const payload = JSON.stringify({ mode, ownerPrompt, projectSystem });
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

function currentExistingChatId({ record, savedAccountAvailable, rollover }) {
  return (!rollover && savedAccountAvailable) ? (record?.chatId || null) : null;
}

function candidateExistingChatId({ record, savedAccountAvailable, rollover, currentPromptFingerprint }) {
  if (rollover || !savedAccountAvailable) return null;
  if (!record?.chatId) return null;
  if (!record.systemPromptFingerprint) return null;
  if (record.systemPromptFingerprint !== currentPromptFingerprint) return null;
  return record.chatId;
}

function remoteAppend(thread, deliveredPrompt, userText) {
  return [...thread, { role: 'user', applicationPrompt: deliveredPrompt, text: userText }];
}

(function main() {
  const oldOwner = 'OWNER_POLICY_A\nDo not deploy.';
  const newOwner = 'OWNER_POLICY_B\nDeploy only to staging.';
  const project = 'Instructions from: AGENTS.md\nPROJECT_RULE';
  const oldFp = promptFingerprint({ mode: 'owner', ownerPrompt: oldOwner, projectSystem: project });
  const newFp = promptFingerprint({ mode: 'owner', ownerPrompt: newOwner, projectSystem: project });
  assert.notStrictEqual(oldFp, newFp);

  const record = {
    chatId: 'qwen-thread-A',
    accountId: 'acct-1',
    systemPromptFingerprint: oldFp,
  };
  const remoteThread = [
    { role: 'user', applicationPrompt: oldOwner, text: 'first task' },
    { role: 'assistant', text: 'done' },
  ];

  const currentChat = currentExistingChatId({ record, savedAccountAvailable: true, rollover: false });
  assert.strictEqual(currentChat, 'qwen-thread-A');
  const mixed = remoteAppend(remoteThread, newOwner, 'next task');
  const seenPolicies = [...new Set(mixed.map(x => x.applicationPrompt).filter(Boolean))];
  assert.deepStrictEqual(seenPolicies, [oldOwner, newOwner]);

  const candidateChat = candidateExistingChatId({
    record,
    savedAccountAvailable: true,
    rollover: false,
    currentPromptFingerprint: newFp,
  });
  assert.strictEqual(candidateChat, null);

  assert.strictEqual(candidateExistingChatId({
    record,
    savedAccountAvailable: true,
    rollover: false,
    currentPromptFingerprint: oldFp,
  }), 'qwen-thread-A');

  assert.strictEqual(candidateExistingChatId({
    record: { chatId: 'legacy-thread', accountId: 'acct-1' },
    savedAccountAvailable: true,
    rollover: false,
    currentPromptFingerprint: newFp,
  }), null);

  console.log(JSON.stringify({
    verdict: 'PROMPT_THREAD_AFFINITY_GAP_REPRODUCED_AND_GUARD_PASS',
    current: {
      reused_old_chat_id: currentChat,
      remote_application_policies_after_request: seenPolicies,
      mixed_authority: seenPolicies.length > 1,
    },
    candidate: {
      prompt_change_forces_fresh_thread: candidateChat === null,
      exact_prompt_keeps_thread: true,
      legacy_missing_fingerprint_rebases_fail_closed: true,
      persisted_value_is_hash_only: true,
    }
  }, null, 2));
})();
