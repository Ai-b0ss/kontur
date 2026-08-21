'use strict';
const assert = require('assert');

function estimateTokens(chars, recentAvg = 0) {
  if (chars < 10_000) return 2_000;
  if (chars < 50_000) return Math.round(Math.max(3_500, Math.min(6_500, recentAvg || 5_000)));
  return Math.round(Math.max(6_500, Math.min(9_500, recentAvg || 8_200)));
}

function byteLen(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function currentMeasuredBody({ userText }) {
  // Current prepareInput() has already detached owner_system_prompt and removed
  // selected skill selector fields before server.js measures JSON(body).
  return {
    model: 'qwen3.8-max',
    messages: [{ role: 'user', content: userText }],
  };
}

function outboundApprox({ userText, ownerPrompt, skillContext }) {
  // applyPrepared() later injects both selected skill text and the exact owner
  // application prompt into the first Qwen message.
  return {
    stream: true,
    version: '2.1',
    messages: [{
      role: 'user',
      content: `${ownerPrompt}\n\n${skillContext}\n\n# Current message\n${userText}`,
    }],
  };
}

const ownerPrompt = 'O'.repeat(60_000);
const skillContext = 'S'.repeat(32_000);
const userText = 'continue with the repository fix';
const currentBody = currentMeasuredBody({ userText });
const actualPayload = outboundApprox({ userText, ownerPrompt, skillContext });
const measured = byteLen(currentBody);
const actual = byteLen(actualPayload);
const currentEstimate = estimateTokens(measured);
const actualEstimate = estimateTokens(actual);

assert(measured < 10_000);
assert(actual > 50_000);
assert.strictEqual(currentEstimate, 2_000);
assert.strictEqual(actualEstimate, 8_200);
assert(actual - measured > 90_000);

// Candidate keeps requestGovernor before any chat-id/provider work, but adds the
// exact deferred prompt bytes that prepareInput returned out-of-band in mode.
const candidateMeasured = measured
  + Buffer.byteLength(ownerPrompt, 'utf8')
  + Buffer.byteLength(skillContext, 'utf8');
const candidateEstimate = estimateTokens(candidateMeasured);
assert(candidateMeasured > 50_000);
assert.strictEqual(candidateEstimate, 8_200);

console.log(JSON.stringify({
  verdict: 'POST_GOVERNOR_PROMPT_ACCOUNTING_GAP_REPRODUCED_AND_CANDIDATE_PASS',
  measured_bytes_current: measured,
  outbound_bytes_approx: actual,
  omitted_bytes: actual - measured,
  current_inflight_token_estimate: currentEstimate,
  actual_size_bucket_estimate: actualEstimate,
  candidate_accounted_bytes: candidateMeasured,
  candidate_inflight_token_estimate: candidateEstimate,
  owner_prompt_chars: ownerPrompt.length,
  selected_skill_context_chars: skillContext.length,
  note: 'Candidate preserves governor-before-provider ordering; it adds detached prompt/skill bytes to meta.chars.',
}, null, 2));
