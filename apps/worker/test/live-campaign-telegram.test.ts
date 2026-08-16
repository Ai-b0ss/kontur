import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildV5DeepLink,
  buildV5MiniAppUrl,
  liveCampaignSummaryNotification,
  openingNarrativeInput,
  openingNotification,
  planLiveCampaignEvent,
} from '../src/live-campaign-telegram.js';
import { createV5Narrative } from '../src/live-campaign-llm.js';
import { checkChatMembership } from '../src/telegram-api.js';

test('V5 personal launch replaces the legacy zero-season query without changing its origin', () => {
  const url = buildV5MiniAppUrl({
    MINIAPP_URL: 'https://kontur.example/?season=zero&source=menu',
  }, 42);
  assert.equal(url, 'https://kontur.example/?source=menu&campaign=v5&event=42');
});

test('explicit V5 launch URL wins over the legacy Mini App URL', () => {
  const url = buildV5MiniAppUrl({
    MINIAPP_URL: 'https://legacy.example/?season=zero',
    V5_MINIAPP_URL: 'https://campaign.example/flight',
  }, 7);
  assert.equal(url, 'https://campaign.example/flight?campaign=v5&event=7');
});

test('group notification always uses a Telegram deep link and rejects unsafe usernames', () => {
  assert.equal(
    buildV5DeepLink({ V5_BOT_USERNAME: '@kontur_igor_test_bot' }, 9),
    'https://t.me/kontur_igor_test_bot?start=v5_9',
  );
  assert.equal(buildV5DeepLink({ V5_BOT_USERNAME: 'bad/name' }, 9), null);
  assert.equal(buildV5DeepLink({ V5_BOT_USERNAME: 'kontur_igor_test_bot' }, 0), null);
});

test('generic membership check uses the passed campaign chat, not MAIN_CHAT_ID', async () => {
  const previousFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | null = null;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return Response.json({ ok: true, result: { status: 'restricted', is_member: true } });
  };
  try {
    const allowed = await checkChatMembership({
      DEV_MODE: 'false',
      BOT_TOKEN: 'test-token',
      MAIN_CHAT_ID: '-100000000001',
    } as never, '-100000000777', 777);
    assert.equal(allowed, true);
    assert.deepEqual(requestBody, { chat_id: '-100000000777', user_id: 777 });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('one reply contract selects its matching legal action, while an unmatched contract is left unused', () => {
  const sectors: Array<{ sector: number; state: 'hidden' | 'exposed' | 'secured' | 'rooted' }> = [
    { sector: 0, state: 'exposed' },
    { sector: 1, state: 'hidden' },
    { sector: 2, state: 'secured' },
    { sector: 3, state: 'rooted' },
  ];
  assert.deepEqual(planLiveCampaignEvent(sectors, 'scout'), {
    target: { sector: 1, state: 'hidden', action: 'scout' }, usesContract: true, opensRaid: false,
  });
  assert.deepEqual(planLiveCampaignEvent(sectors, 'hold'), {
    target: { sector: 2, state: 'secured', action: 'hold' }, usesContract: true, opensRaid: false,
  });
  assert.deepEqual(planLiveCampaignEvent(sectors, 'raid'), {
    target: { sector: 0, state: 'exposed', action: 'claim' }, usesContract: true, opensRaid: true,
  });
  assert.deepEqual(planLiveCampaignEvent([{ sector: 0, state: 'exposed' }], 'hold'), {
    target: { sector: 0, state: 'exposed', action: 'claim' }, usesContract: false, opensRaid: false,
  });
});

test('opening copy uses the bounded narrator output and summary exposes only durable aggregates', async () => {
  const narrative = await createV5Narrative({}, openingNarrativeInput(
    { id: 12, event_number: 4 }, { sector: 2, action: 'scout' },
  ));
  const opening = openingNotification(narrative);
  assert.equal(narrative.source, 'fallback');
  assert.ok(opening.title.startsWith(narrative.reaction));
  assert.match(opening.line, /Личный полёт открывается по ссылке/);

  const summary = liveCampaignSummaryNotification(JSON.stringify({
    objectives: [
      { sector: 0, status: 'completed', answer: 'never-render-this' },
      { sector: 1, status: 'failed', user: 'never-render-this-user' },
    ],
  }), 3);
  assert.equal(summary.title, 'Итог ветви');
  assert.match(summary.line, /1 переход/);
  assert.match(summary.line, /3 изменения/);
  assert.equal(summary.line.includes('never-render-this'), false);
  assert.equal(summary.line.includes('never-render-this-user'), false);
});
