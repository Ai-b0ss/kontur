import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  LIVE_CAMPAIGN_PRETEST,
  formatLiveCampaignCountdown,
  secondsUntilLiveCampaignClose,
} from '../src/live-campaign-model.ts';

describe('V5 Mini App model', () => {
  test('holds six situational pretest choices, not a profession label', () => {
    assert.equal(LIVE_CAMPAIGN_PRETEST.length, 6);
    for (const question of LIVE_CAMPAIGN_PRETEST) {
      assert.equal(question.options.length, 4);
      assert.equal(new Set(question.options.map((option) => option.bird)).size, 4);
    }
  });

  test('renders the server closeAt timer without inventing client time', () => {
    assert.equal(secondsUntilLiveCampaignClose('2026-08-07T12:00:10.000Z', Date.parse('2026-08-07T12:00:00.200Z')), 10);
    assert.equal(secondsUntilLiveCampaignClose('2026-08-07T12:00:00.000Z', Date.parse('2026-08-07T12:00:01.000Z')), 0);
    assert.equal(formatLiveCampaignCountdown(75), '1:15');
  });
});
