'use strict';

class Governor {
  constructor() {
    this.pending = new Map();
    this.admissions = [];
    this.outcomes = [];
  }
  before(accountId) {
    this.admissions.push(accountId);
    this.pending.set(accountId, (this.pending.get(accountId) || 0) + 1);
  }
  success(accountId) {
    this.outcomes.push(['success', accountId]);
    const n = this.pending.get(accountId) || 0;
    if (n > 0) this.pending.set(accountId, n - 1);
  }
  failure(accountId, kind) {
    this.outcomes.push(['failure', accountId, kind]);
    const n = this.pending.get(accountId) || 0;
    if (n > 0) this.pending.set(accountId, n - 1);
  }
  count(accountId) { return this.pending.get(accountId) || 0; }
}

function currentSemantics() {
  const g = new Governor();
  // server.preparePublicPayloadGoverned(): admission is charged to the preferred account A.
  g.before('A');

  // qwen-client.sendChatRequest(): A fails and the bounded operation continues on B.
  // No requestGovernor.before('B') exists on this path.
  const providerAttempts = ['A', 'B'];

  // quotaTelemetry is rebound to the final response account, then finish() reports one outcome.
  g.success('B');

  return {
    providerAttempts,
    governorAdmissions: g.admissions,
    governorOutcomes: g.outcomes,
    pendingA: g.count('A'),
    pendingB: g.count('B'),
    ungovernedProviderAttemptB: !g.admissions.includes('B'),
    leakedReservationA: g.count('A') === 1,
  };
}

function candidateSemantics() {
  const g = new Governor();
  const providerAttempts = [];

  // Every account that can actually reach provider I/O gets its own admission and terminal outcome.
  g.before('A');
  providerAttempts.push('A');
  g.failure('A', 'captcha_challenge');

  g.before('B');
  providerAttempts.push('B');
  g.success('B');

  return {
    providerAttempts,
    governorAdmissions: g.admissions,
    governorOutcomes: g.outcomes,
    pendingA: g.count('A'),
    pendingB: g.count('B'),
    everyProviderAttemptGoverned: providerAttempts.every((id) => g.admissions.includes(id)),
    noLeakedReservations: g.count('A') === 0 && g.count('B') === 0,
  };
}

const current = currentSemantics();
const candidate = candidateSemantics();

if (!current.ungovernedProviderAttemptB) throw new Error('current gap not reproduced: sibling B unexpectedly governed');
if (!current.leakedReservationA) throw new Error('current gap not reproduced: A reservation did not leak');
if (!candidate.everyProviderAttemptGoverned) throw new Error('candidate failed: provider attempt without governor admission');
if (!candidate.noLeakedReservations) throw new Error('candidate failed: stale governor reservation');

console.log(JSON.stringify({
  verdict: 'QWEN_FAILOVER_GOVERNOR_ACCOUNTING_GAP_REPRODUCED_AND_CONTRACT_PASS',
  current,
  candidate,
}, null, 2));
