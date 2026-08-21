'use strict';
const assert = require('assert');

function currentLoad({ primaryReadable, primarySessions, backupReadable, backupSessions }) {
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
  return {
    ...base,
    chatId: null,
    recoveryUncertain: true,
    recoveryKey: normalized,
  };
}

function candidateLoad(input) {
  const state = currentLoad(input);
  return {
    ...state,
    fallbackRecoveryActive: state.source === 'backup',
    recoveryResetKeys: new Set(),
  };
}

function candidateRecoveryState(state, key) {
  const normalized = String(key);
  const existingRecovered = state.recoveredFromBackupKeys.has(normalized);
  const missingUnderFallback = Boolean(
    state.fallbackRecoveryActive &&
    !state.sessions.has(normalized) &&
    !state.recoveryResetKeys.has(normalized)
  );
  return {
    uncertain: existingRecovered || missingUnderFallback,
    source: existingRecovered ? 'backup' : (missingUnderFallback ? 'backup-missing-key' : 'primary-or-empty'),
  };
}

function candidateGetRecord(state, key) {
  const normalized = String(key);
  const existing = currentGetRecord(state, normalized);
  if (existing) return existing;
  const recovery = candidateRecoveryState(state, normalized);
  if (!recovery.uncertain) return null;
  return {
    chatId: null,
    history: [],
    recoveryUncertain: true,
    recoveryMissingKey: true,
    recoveryKey: normalized,
  };
}

function candidateExplicitClear(state, key) {
  const normalized = String(key);
  state.sessions.delete(normalized);
  state.recoveredFromBackupKeys.delete(normalized);
  state.recoveryResetKeys.add(normalized);
}

function main() {
  const fallbackInput = {
    primaryReadable: false,
    backupReadable: true,
    backupSessions: {
      'old-session': { chatId: 'chat-old', accountId: 'acct-A', history: [] },
    },
  };

  const current = currentLoad(fallbackInput);
  assert.strictEqual(current.source, 'backup');
  assert.strictEqual(currentGetRecord(current, 'old-session').recoveryUncertain, true);
  assert.strictEqual(currentGetRecord(current, 'session-X'), null);
  const currentAllowsProvider = currentGetRecord(current, 'session-X') === null;
  assert.strictEqual(currentAllowsProvider, true);

  const candidate = candidateLoad(fallbackInput);
  const missing = candidateGetRecord(candidate, 'session-X');
  assert(missing && missing.recoveryUncertain === true);
  assert.strictEqual(missing.recoveryMissingKey, true);
  assert.strictEqual(candidateRecoveryState(candidate, 'session-X').source, 'backup-missing-key');

  candidateExplicitClear(candidate, 'session-X');
  assert.strictEqual(candidateGetRecord(candidate, 'session-X'), null);
  assert.strictEqual(candidateRecoveryState(candidate, 'session-X').uncertain, false);

  const clean = candidateLoad({ primaryReadable: true, primarySessions: {} });
  assert.strictEqual(candidateGetRecord(clean, 'brand-new-session'), null);
  assert.strictEqual(candidateRecoveryState(clean, 'brand-new-session').uncertain, false);

  const result = {
    verdict: 'QWEN_STALE_BACKUP_MISSING_SESSION_GAP_REPRODUCED_AND_FAIL_CLOSED_CANDIDATE_PASS',
    current: {
      fallback_source: current.source,
      existing_backup_key_uncertain: true,
      missing_newer_key_record: null,
      missing_newer_key_can_reach_provider: currentAllowsProvider,
      duplicate_side_effect_possible: true,
    },
    candidate: {
      missing_key_source: 'backup-missing-key',
      missing_key_recovery_uncertain: true,
      provider_blocked_until_explicit_reset: true,
      explicit_reset_unblocks_key: true,
      clean_primary_start_allows_new_key: true,
    },
  };
  console.log(JSON.stringify(result, null, 2));
}

main();
