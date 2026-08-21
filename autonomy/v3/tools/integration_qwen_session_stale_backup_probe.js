#!/usr/bin/env node
'use strict';

function currentRecovery() {
  let primary = { generation: 0, pending: [] };
  let backup = { generation: 0, pending: [] };
  primary = { generation: 1, pending: ['call-1'] };
  const setReturnedSuccess = true;
  const backupWriteSucceeded = false;
  primary = '{corrupt-json';
  const restored = backup;
  const shortContinueBlocked = restored.pending.length > 0;
  return {
    setReturnedSuccess,
    backupWriteSucceeded,
    restoredGeneration: restored.generation,
    pendingAfterRecovery: restored.pending,
    shortContinueBlocked,
    duplicateMutationPossible: !shortContinueBlocked,
  };
}

function safeCandidate() {
  const recovery = {
    source: 'backup',
    recoveredFromBackup: true,
    generation: 0,
    pending: [],
  };
  const shortContinueBlocked = recovery.recoveredFromBackup;
  return {
    recoveredFromBackup: true,
    shortContinueBlocked,
    requiresExplicitFullHistoryReconciliation: true,
    duplicateMutationPossible: !shortContinueBlocked,
  };
}

const current = currentRecovery();
const candidate = safeCandidate();
if (!current.setReturnedSuccess) throw new Error('repro setup failed');
if (current.backupWriteSucceeded) throw new Error('backup failure not reproduced');
if (current.restoredGeneration !== 0) throw new Error('stale backup not selected');
if (current.shortContinueBlocked) throw new Error('current semantics unexpectedly safe');
if (!current.duplicateMutationPossible) throw new Error('duplicate risk not reproduced');
if (!candidate.shortContinueBlocked) throw new Error('candidate did not fail closed');
if (candidate.duplicateMutationPossible) throw new Error('candidate still permits duplicate');
console.log(JSON.stringify({
  verdict: 'QWEN_SESSION_STALE_BACKUP_REPLAY_GAP_REPRODUCED_CANDIDATE_PASS',
  current,
  candidate,
}));
