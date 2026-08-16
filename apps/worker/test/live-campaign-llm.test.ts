import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createV5Narrative, parseV5Narrative } from '../src/live-campaign-llm.ts';

const input = { eventId: 'event-001', templateId: 'signal-storm' as const, theme: 'systems' as const };

test('V5 narrator is deterministic and complete without any model binding', async () => {
  const narrative = await createV5Narrative({}, input);
  assert.equal(narrative.source, 'fallback');
  assert.ok(narrative.title.length > 0);
  assert.ok(narrative.cta.length > 0);
});

test('V5 narrator rejects links, mechanics-shaped fields and invalid enum values', () => {
  assert.equal(parseV5Narrative({ title: 'https://bad', brief: 'x', cta: 'x', tone: 'cold', reaction: '⚡' }, 'groq'), null);
  assert.equal(parseV5Narrative({ title: 'Тема', brief: 'За этот ход ты получишь 3 яйца', cta: 'Открыть', tone: 'cold', reaction: '⚡' }, 'groq'), null);
  assert.equal(parseV5Narrative({ title: 'Тема', brief: 'Короткая подача', cta: 'Открыть', tone: 'wild', reaction: '⚡' }, 'groq'), null);
  assert.deepEqual(parseV5Narrative({ title: 'Тема', brief: 'Короткая подача', cta: 'Открыть', tone: 'calm', reaction: '🪶' }, 'groq'), {
    title: 'Тема', brief: 'Короткая подача', cta: 'Открыть', tone: 'calm', reaction: '🪶', source: 'groq',
  });
});

test('V5 narrator treats an invalid optional model response as presentation fallback', async () => {
  const narrative = await createV5Narrative({
    V5_LLM_PROVIDER: 'cloudflare',
    AI: { run: async () => ({ response: '{"title":"https://unsafe","brief":"x","cta":"x"}' }) },
  } as never, input);
  assert.equal(narrative.source, 'fallback');
  assert.equal(narrative.title, 'Сигнал штормит');
});
