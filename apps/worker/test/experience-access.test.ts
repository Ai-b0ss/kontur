import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  experienceV2GloballyEnabled,
  experienceV3GloballyEnabled,
  liveCampaignV5GloballyEnabled,
  liveCampaignV5PublishEnabled,
  parseExperienceV2Allowlist,
  zeroSeasonAllowed,
} from '../src/experience-access.ts';
import { currentGameDay } from '../src/db.ts';

describe('переключатель новой версии', () => {
  test('по умолчанию и при похожих значениях выключен', () => {
    assert.equal(experienceV2GloballyEnabled({}), false);
    assert.equal(experienceV2GloballyEnabled({ EXPERIENCE_V2_ENABLED: 'TRUE' }), false);
    assert.equal(experienceV2GloballyEnabled({ EXPERIENCE_V2_ENABLED: '1' }), false);
  });

  test('включается только точным значением true', () => {
    assert.equal(experienceV2GloballyEnabled({ EXPERIENCE_V2_ENABLED: 'true' }), true);
  });

  test('список принимает только числовые Telegram ID и не поддерживает звёздочку', () => {
    assert.deepEqual(
      [...parseExperienceV2Allowlist(' 1001,*,abc,1002,1001 ')],
      ['1001', '1002'],
    );
  });
});

describe('переключатель восстановленного продукта', () => {
  test('тоже закрыт по умолчанию и требует точного true', () => {
    assert.equal(experienceV3GloballyEnabled({}), false);
    assert.equal(experienceV3GloballyEnabled({ EXPERIENCE_V3_ENABLED: 'True' }), false);
    assert.equal(experienceV3GloballyEnabled({ EXPERIENCE_V3_ENABLED: 'true' }), true);
  });
});

describe('переключатель нулевого сезона', () => {
  test('не наследует V3, требует точный gate и не использует allowlist', () => {
    assert.equal(zeroSeasonAllowed({}), false);
    assert.equal(zeroSeasonAllowed({ ZERO_SEASON_ENABLED: 'TRUE' }), false);
    assert.equal(zeroSeasonAllowed({ ZERO_SEASON_ENABLED: 'true' }), true);
  });
});

describe('переключатель живой кампании V5', () => {
  test('не наследует старые gates и выключен по умолчанию', () => {
    assert.equal(liveCampaignV5GloballyEnabled({}), false);
    assert.equal(liveCampaignV5GloballyEnabled({ LIVE_CAMPAIGN_V5_ENABLED: 'TRUE' }), false);
    assert.equal(liveCampaignV5GloballyEnabled({ LIVE_CAMPAIGN_V5_ENABLED: 'true' }), true);
  });

  test('публикация в чат требует отдельного точного gate', () => {
    assert.equal(liveCampaignV5PublishEnabled({}), false);
    assert.equal(liveCampaignV5PublishEnabled({ LIVE_CAMPAIGN_V5_PUBLISH_ENABLED: 'yes' }), false);
    assert.equal(liveCampaignV5PublishEnabled({ LIVE_CAMPAIGN_V5_PUBLISH_ENABLED: 'true' }), true);
  });
});

describe('старт сезона', () => {
  test('не отдаёт отрицательный игровой день до первой границы в 04:00 МСК', () => {
    const env = { SEASON_START: '2026-08-07' };
    assert.equal(currentGameDay(env, new Date('2026-08-07T00:59:59Z')), 0);
    assert.equal(currentGameDay(env, new Date('2026-08-08T01:00:00Z')), 1);
  });
});
