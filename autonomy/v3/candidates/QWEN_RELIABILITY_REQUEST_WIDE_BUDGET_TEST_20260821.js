'use strict';

function createAttemptContext(limit) {
  return {
    attemptedAccountIds: new Set(),
    limit,
    allowPreferredReuse: false,
  };
}

function operationCandidates(allAccounts, preferredAccount, attemptContext) {
  const attempted = attemptContext.attemptedAccountIds;
  const preferredId = preferredAccount && preferredAccount.id ? preferredAccount.id : null;
  const allowPreferredReuse = Boolean(attemptContext.allowPreferredReuse);
  const reuseCredit = allowPreferredReuse && preferredId && attempted.has(preferredId) ? 1 : 0;
  const remaining = Math.max(0, attemptContext.limit - attempted.size + reuseCredit);
  const ordered = preferredAccount
    ? [preferredAccount, ...allAccounts.filter((account) => account.id !== preferredAccount.id)]
    : [...allAccounts];

  return ordered
    .filter((account) => account.available)
    .filter((account) => !attempted.has(account.id) || (allowPreferredReuse && account.id === preferredId))
    .slice(0, remaining);
}

function consumeRound(allAccounts, preferredAccount, attemptContext) {
  const used = [];
  for (const account of operationCandidates(allAccounts, preferredAccount, attemptContext)) {
    attemptContext.attemptedAccountIds.add(account.id);
    used.push(account.id);
    account.available = false; // model one locally classified failure/cooldown
  }
  return used;
}

const pool = Array.from({ length: 11 }, (_, index) => ({
  id: String.fromCharCode(65 + index),
  available: true,
}));
const context = createAttemptContext(4);
const trace = [];
for (let outerRetry = 0; outerRetry < 4; outerRetry += 1) {
  const preferred = pool.find((account) => account.available) || null;
  trace.push(...consumeRound(pool, preferred, context));
}

if (new Set(trace).size !== 4) {
  throw new Error(`request-wide budget leaked: ${trace.join('->')}`);
}
if (trace.join('->') !== 'A->B->C->D') {
  throw new Error(`unexpected bounded-failover trace: ${trace.join('->')}`);
}

const rebasePool = ['A', 'B', 'C', 'D', 'E'].map((id) => ({ id, available: true }));
const rebaseContext = createAttemptContext(4);
rebaseContext.attemptedAccountIds.add('B');
const rebaseCandidates = operationCandidates(
  rebasePool,
  rebasePool[1],
  { ...rebaseContext, allowPreferredReuse: true },
);
if (rebaseCandidates[0]?.id !== 'B') {
  throw new Error('intentional same-owner rebase lost account/thread affinity');
}
if (rebaseCandidates.filter((account) => account.id !== 'B').length > 3) {
  throw new Error('same-owner rebase opened an extra sibling slot');
}

rebasePool[1].available = false;
const cooledPreferred = operationCandidates(
  rebasePool,
  rebasePool[1],
  { ...rebaseContext, allowPreferredReuse: true },
);
if (cooledPreferred.some((account) => account.id === 'B')) {
  throw new Error('cooled preferred account re-entered the request');
}

console.log('REQUEST_WIDE_BOUNDED_RETRY_REGRESSION_PASS');
