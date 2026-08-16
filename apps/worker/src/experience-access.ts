import type { Env } from './types.js';

export function parseExperienceV2Allowlist(value: string | undefined): ReadonlySet<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter((part) => /^\d+$/.test(part)),
  );
}

export function experienceV2GloballyEnabled(env: Pick<Env, 'EXPERIENCE_V2_ENABLED'>): boolean {
  return env.EXPERIENCE_V2_ENABLED === 'true';
}

export async function experienceV2Allowed(env: Env, userId: number): Promise<boolean> {
  if (!experienceV2GloballyEnabled(env)) return false;
  const allowlist = parseExperienceV2Allowlist(env.EXPERIENCE_V2_USER_IDS);
  if (allowlist.size === 0) return false;
  const user = await env.DB.prepare('SELECT tg_id FROM users WHERE id = ?')
    .bind(userId).first<{ tg_id: number | string }>();
  return Boolean(user && allowlist.has(String(user.tg_id)));
}

export function experienceV3GloballyEnabled(env: Pick<Env, 'EXPERIENCE_V3_ENABLED'>): boolean {
  return env.EXPERIENCE_V3_ENABLED === 'true';
}

export async function experienceV3Allowed(env: Env, userId: number): Promise<boolean> {
  if (!experienceV3GloballyEnabled(env)) return false;
  const allowlist = parseExperienceV2Allowlist(
    env.EXPERIENCE_V3_USER_IDS ?? env.EXPERIENCE_V2_USER_IDS,
  );
  if (allowlist.size === 0) return false;
  const user = await env.DB.prepare('SELECT tg_id FROM users WHERE id = ?')
    .bind(userId).first<{ tg_id: number | string }>();
  return Boolean(user && allowlist.has(String(user.tg_id)));
}

/**
 * Нулевой сезон включается отдельно и не наследует доступ V2/V3.
 * Сюда попадает только уже проверенный middleware: подписанный Telegram-вход,
 * участник основного чата и не забаненный пользователь.
 */
export function zeroSeasonAllowed(env: Pick<Env, 'ZERO_SEASON_ENABLED'>): boolean {
  return zeroSeasonGloballyEnabled(env);
}

export function zeroSeasonGloballyEnabled(env: Pick<Env, 'ZERO_SEASON_ENABLED'>): boolean {
  return env.ZERO_SEASON_ENABLED === 'true';
}

/**
 * V5 intentionally does not inherit a V2/V3 allowlist or V4 membership cache.
 * Its route checks membership in the campaign's own chat after this gate.
 */
export function liveCampaignV5GloballyEnabled(
  env: Pick<Env, 'LIVE_CAMPAIGN_V5_ENABLED'>,
): boolean {
  return env.LIVE_CAMPAIGN_V5_ENABLED === 'true';
}

export function liveCampaignV5PublishEnabled(
  env: Pick<Env, 'LIVE_CAMPAIGN_V5_PUBLISH_ENABLED'>,
): boolean {
  return env.LIVE_CAMPAIGN_V5_PUBLISH_ENABLED === 'true';
}
