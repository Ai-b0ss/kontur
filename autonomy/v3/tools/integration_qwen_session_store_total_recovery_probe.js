'use strict';
const assert = require('assert');

function currentLoad({ primaryExists, primaryReadable, primarySessions, backupExists, backupReadable, backupSessions }) {
  let sessions = new Map();
  let recoveredFromBackupKeys = new Set();
  if (primaryReadable) {
    sessions = new Map(Object.entries(primarySessions || {}));
    return { sessions, recoveredFromBackupKeys, source: 'primary' };
  }
  if (backupReadable) {
    sessions = new Map(Object.entries(backupSessions || {}));
    recoveredFromBackupKeys = new Set(sessions.keys());
    return { sessions, recoveredFromBackupKeys, source: 'backup' };
  }
  sessions = new Map();
  recoveredFromBackupKeys = new Set();
  return { sessions, recoveredFromBackupKeys, source: 'empty' };
}

function currentGetRecord(state, key) {
  const normalized = String(key);
  const value = state.sessions.get(normalized);
  if (!value) return null;
  const base = typeof value === 'string'
    ? { chatId: value, awaitingCompactedHistory: false }
    : value;
  if (!state.recoveredFromBackupKeys.has(normalized)) return base;
  return { ...base, chatId: null, recoveryUncertain: true, recoveryKey: normalized };
}

function candidateLoad(input) {
  const persistenceArtifactsExisted = Boolean(input.primaryExists || input.backupExists);
  let sessions = new Map();
  let source = 'empty';
  let uncertainStoreRecovery = false;

  if (input.primaryReadable) {
    sessions = new Map(Object.entries(input.primarySessions || {}));
    source = 'primary';
  } else if (input.backupReadable) {
    sessions = new Map(Object.entries(input.backupSessions || {}));
    source = 'backup';
    uncertainStoreRecovery = true;
  } else {
    source = 'empty';
    // First-ever clean startup is not ambiguous. But if durable artifacts existed
    // and both became unreadable, the empty map is a recovery failure, not proof
    // that every prior session disappeared safely.
    uncertainStoreRecovery = persistenceArtifactsExisted;
  }

  return {
    sessions,
    source,
    uncertainStoreRecovery,
    recoveredExistingKeys: new Set(source === 'backup' ? sessions.keys() : []),
    recoveryResetKeys: new Set(),
  };
}

function candidateRecoveryState(state, key) {
  const normalized = String(key);
  if (state.recoveryResetKeys.has(normalized)) {
    return { uncertain: false, source: 'explicit-reset' };
  }
  if (state.recoveredExistingKeys.has(normalized)) {
    return { uncertain: true, source: 'backup' };
  }
  if (state.uncertainStoreRecovery && !state.sessions.has(normalized)) {
    return {
      uncertain: true,
      source: state.source === 'backup' ? 'backup-missing-key' : 'corrupt-store-missing-key',
    };
  }
  return { uncertain: false, source: 'primary-or-empty' };
}

function candidateGetRecord(state, key) {
  const normalized = String(key);
  const value = state.sessions.get(normalized);
  if (value) {
    const base = typeof value === 'string'
      ? { chatId: value, awaitingCompactedHistory: false }
      : value;
    if (state.recoveredExistingKeys.has(normalized)) {
      return { ...base, chatId: null, recoveryUncertain: true, recoveryKey: normalized };
    }
    return base;
  }
  const recovery = candidateRecoveryState(state, normalized);
  if (!recovery.uncertain) return null;
  return {
    chatId: null,
    history: [],
    recoveryUncertain: true,
    recoveryMissingKey: true,
    recoverySource: recovery.source,
    recoveryKey: normalized,
  };
}

function explicitReset(state, key) {
  const normalized = String(key);
  state.sessions.delete(normalized);
  state.recoveredExistingKeys.delete(normalized);
  state.recoveryResetKeys.add(normalized);
}

function main() {
  const staleBackup = {
    primaryExists: true,
    primaryReadable: false,
    backupExists: true,
    backupReadable: true,
    backupSessions: { old: { chatId: 'chat-old', accountId: 'acct-A', history: [] } },
  };
  const totalCorruption = {
    primaryExists: true,
    primaryReadable: false,
    backupExists: true,
    backupReadable: false,
  };
  const firstEver = {
    primaryExists: false,
    primaryReadable: false,
    backupExists: false,
    backupReadable: false,
  };
  const readableEmptyPrimary = {
    primaryExists: true,
    primaryReadable: true,
    primarySessions: {},
    backupExists: false,
    backupReadable: false,
  };

  const currentBackup = currentLoad(staleBackup);
  assert.strictEqual(currentGetRecord(currentBackup, 'session-X'), null);
  const currentCorrupt = currentLoad(totalCorruption);
  assert.strictEqual(currentCorrupt.source, 'empty');
  assert.strictEqual(currentGetRecord(currentCorrupt, 'session-X'), null);

  const candidateBackup = candidateLoad(staleBackup);
  assert.strictEqual(candidateGetRecord(candidateBackup, 'session-X').recoveryUncertain, true);
  assert.strictEqual(candidateGetRecord(candidateBackup, 'session-X').recoverySource, 'backup-missing-key');

  const candidateCorrupt = candidateLoad(totalCorruption);
  assert.strictEqual(candidateGetRecord(candidateCorrupt, 'session-X').recoveryUncertain, true);
  assert.strictEqual(candidateGetRecord(candidateCorrupt, 'session-X').recoverySource, 'corrupt-store-missing-key');

  const cleanFirst = candidateLoad(firstEver);
  assert.strictEqual(candidateGetRecord(cleanFirst, 'session-X'), null);
  const cleanPrimary = candidateLoad(readableEmptyPrimary);
  assert.strictEqual(candidateGetRecord(cleanPrimary, 'session-X'), null);

  explicitReset(candidateCorrupt, 'session-X');
  assert.strictEqual(candidateGetRecord(candidateCorrupt, 'session-X'), null);
  assert.strictEqual(candidateRecoveryState(candidateCorrupt, 'session-X').uncertain, false);

  console.log(JSON.stringify({
    verdict: 'QWEN_SESSION_STORE_TOTAL_RECOVERY_GAPS_REPRODUCED_AND_V2_FAIL_CLOSED_PASS',
    current: {
      stale_backup_missing_key_provider_allowed: true,
      both_unreadable_provider_allowed: true,
    },
    candidate: {
      stale_backup_missing_key_blocked: true,
      both_unreadable_missing_key_blocked: true,
      first_ever_start_allowed: true,
      readable_empty_primary_allowed: true,
      explicit_reset_unblocks: true,
    },
  }, null, 2));
}

main();
