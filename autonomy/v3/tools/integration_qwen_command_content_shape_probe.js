'use strict';

function currentIsCommandMessage(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return false;
  const last = [...messages].reverse().find((m) => m?.role === 'user');
  const text = (typeof last?.content === 'string' ? last.content : '').trim();
  return text.startsWith('$qwen-api') || text.startsWith('/qwen-api');
}

function currentRawCommand(messages) {
  const last = [...messages].reverse().find((m) => m?.role === 'user');
  return (typeof last?.content === 'string' ? last.content : '').trim();
}

function extractCommandText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object') {
        if (typeof part.text === 'string') return part.text;
        if (typeof part.content === 'string') return part.content;
        if (part.content && typeof part.content === 'object') return extractCommandText(part.content);
      }
      return '';
    }).join(' ');
  }
  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    if (content.content !== undefined) return extractCommandText(content.content);
  }
  return '';
}

function candidateIsCommandMessage(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return false;
  const last = [...messages].reverse().find((m) => m?.role === 'user');
  const text = extractCommandText(last?.content).trim();
  return /^[$/]qwen-api(?:\s|$)/i.test(text);
}

const sentinel = 'eyJhbGciOiJub25lIn0.JWT_SENTINEL.signature';
const cases = {
  string: [{ role: 'user', content: `$qwen-api account add ${sentinel}` }],
  array_text: [{ role: 'user', content: [{ type: 'text', text: `$qwen-api account add ${sentinel}` }] }],
  array_mixed: [{ role: 'user', content: [{ type: 'text', text: '$qwen-api account' }, { type: 'text', text: `add ${sentinel}` }] }],
  object_text: [{ role: 'user', content: { type: 'text', text: `$qwen-api account add ${sentinel}` } }],
  ordinary_array: [{ role: 'user', content: [{ type: 'text', text: 'please explain $qwen-api but do not execute it' }] }],
};

const result = {};
for (const [name, messages] of Object.entries(cases)) {
  result[name] = {
    current_detected: currentIsCommandMessage(messages),
    current_raw: currentRawCommand(messages),
    candidate_detected: candidateIsCommandMessage(messages),
    candidate_raw: extractCommandText(messages[0].content).trim(),
  };
}

if (result.string.current_detected !== true) throw new Error('string baseline must remain command');
for (const name of ['array_text', 'array_mixed', 'object_text']) {
  if (result[name].current_detected !== false) throw new Error(`${name}: current gap not reproduced`);
  if (result[name].candidate_detected !== true) throw new Error(`${name}: candidate failed to detect`);
  if (!result[name].candidate_raw.includes('JWT_SENTINEL')) throw new Error(`${name}: candidate lost command payload`);
}
if (result.ordinary_array.candidate_detected !== false) throw new Error('ordinary text must not be promoted to command');

console.log(JSON.stringify({
  verdict: 'QWEN_COMMAND_CONTENT_SHAPE_INTERCEPTION_GAP_REPRO_AND_CANDIDATE_PASS',
  risk: 'OpenAI-compatible non-string command content bypasses local command handler and can be forwarded upstream, including account-add token text.',
  result,
}, null, 2));
