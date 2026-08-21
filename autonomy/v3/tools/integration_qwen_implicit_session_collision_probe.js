'use strict';
const crypto = require('crypto');

function extractSessionText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((p) => {
    if (typeof p === 'string') return p;
    if (!p || typeof p !== 'object') return '';
    if (typeof p.text === 'string') return p.text;
    if (typeof p.content === 'string') return p.content;
    return '';
  }).join(' ');
  if (content && typeof content === 'object') {
    return extractSessionText(content.text || content.content || content.encrypted_content || '');
  }
  return '';
}

function currentDerivedSessionKey(body) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const firstUser = messages.find((m) => m?.role === 'user');
  const firstContent = extractSessionText(firstUser?.content);
  const userKey = body.user || body.metadata?.user_id || body.metadata?.userId || '';
  const seed = JSON.stringify({ model: body.model || '', user: userKey || 'default', firstUser: firstContent });
  return `derived-v2-${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 32)}`;
}

function isInitialConversation(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return true;
  return messages.every((m) => m?.role === 'system' || m?.role === 'user') &&
    messages.filter((m) => m?.role === 'user').length <= 1;
}

function simulateCurrentRouting({ priorRecord, body }) {
  const key = currentDerivedSessionKey(body);
  const savedAccountAvailable = Boolean(priorRecord && priorRecord.accountId === 'acct-A');
  const record = priorRecord;
  const initial = isInitialConversation(body.messages);
  const existingChatId = savedAccountAvailable ? (record?.chatId || null) : null;
  const currentOnly = Boolean(existingChatId);
  const last = body.messages[body.messages.length - 1];
  const providerVisible = currentOnly
    ? { chatId: existingChatId, mode: 'currentOnly', current: last.content }
    : { chatId: null, mode: 'fullHistory', messages: body.messages };
  return { key, initial, existingChatId, currentOnly, providerVisible };
}

function candidateStatelessRouting(body) {
  return {
    explicitSession: false,
    durableRecordRead: false,
    existingChatId: null,
    currentOnly: false,
    providerVisible: { mode: 'fullHistory', messages: body.messages },
  };
}

const first = 'Inspect the repository and continue carefully.';
const convA = {
  model: 'qwen3-coder-plus',
  messages: [
    { role: 'system', content: 'SYSTEM-A' },
    { role: 'user', content: first },
    { role: 'assistant', content: 'A context established' },
    { role: 'user', content: 'Now edit alpha.txt only.' },
  ],
};
const convB = {
  model: 'qwen3-coder-plus',
  messages: [
    { role: 'system', content: 'SYSTEM-B' },
    { role: 'user', content: first },
    { role: 'assistant', content: 'B context established' },
    { role: 'user', content: 'Now inspect beta.txt only; do not edit alpha.txt.' },
  ],
};

const keyA = currentDerivedSessionKey(convA);
const keyB = currentDerivedSessionKey(convB);
if (keyA !== keyB) throw new Error('reproduction failed: expected current derived key collision');
if (isInitialConversation(convB.messages)) throw new Error('reproduction requires a non-initial full transcript');

const priorRecord = {
  chatId: 'qwen-thread-from-conversation-A',
  accountId: 'acct-A',
  history: convA.messages,
};
const current = simulateCurrentRouting({ priorRecord, body: convB });
if (!current.currentOnly) throw new Error('expected current route to reuse prior chat id');
if (current.providerVisible.current !== convB.messages.at(-1).content) throw new Error('unexpected current message');
if (JSON.stringify(current.providerVisible).includes('SYSTEM-B')) {
  throw new Error('currentOnly provider payload should not contain full B transcript in this model');
}

const candidate = candidateStatelessRouting(convB);
if (candidate.existingChatId !== null || candidate.currentOnly !== false) throw new Error('candidate must be stateless');
if (!JSON.stringify(candidate.providerVisible).includes('SYSTEM-B')) throw new Error('candidate must preserve B full history');
if (!JSON.stringify(candidate.providerVisible).includes('beta.txt')) throw new Error('candidate must preserve B current task');

const out = {
  verdict: 'QWEN_IMPLICIT_SESSION_COLLISION_REPRODUCED_AND_STATELESS_CANDIDATE_PASS',
  current: {
    same_derived_key_for_independent_conversations: keyA === keyB,
    derived_key: keyA,
    conversation_b_is_initial: current.initial,
    reused_chat_id_from_conversation_a: current.existingChatId,
    current_only: current.currentOnly,
    provider_receives_b_full_history: JSON.stringify(current.providerVisible).includes('SYSTEM-B'),
    risk: 'independent no-session conversations with same model/user/firstUser can reuse the same upstream Qwen thread and local memo/session namespace',
  },
  candidate: {
    no_explicit_session_means_no_durable_record_read: candidate.durableRecordRead === false,
    no_upstream_thread_reuse: candidate.existingChatId === null,
    full_caller_history_forwarded: JSON.stringify(candidate.providerVisible).includes('SYSTEM-B'),
    note: 'short continuation without explicit session identity should fail closed or remain stateless; content cannot prove conversation identity',
  },
};
console.log(JSON.stringify(out, null, 2));
