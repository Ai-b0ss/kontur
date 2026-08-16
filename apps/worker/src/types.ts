export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  BOT_TOKEN: string;
  MAIN_CHAT_ID: string;
  JWT_SECRET: string;
  MINIAPP_URL: string;
  WEBHOOK_SECRET: string;
  ADMIN_SECRET: string;
  DEV_MODE: string;
  SEASON_START: string;
  WORM_REACTION: string;
  /** Отсутствие или любое значение кроме true оставляет новую версию выключенной. */
  EXPERIENCE_V2_ENABLED?: string;
  /** Список Telegram ID через запятую; хранится только в защищённой конфигурации. */
  EXPERIENCE_V2_USER_IDS?: string;
  /** Восстановленный продукт: отдельный выключенный по умолчанию gate. */
  EXPERIENCE_V3_ENABLED?: string;
  /** Если не задан, закрытый запуск наследует точный V2 allowlist. */
  EXPERIENCE_V3_USER_IDS?: string;
  /** Нулевой сезон — отдельный отключённый по умолчанию gate для авторизованных участников. */
  ZERO_SEASON_ENABLED?: string;
  /** Живая кампания V5 — отдельна от V1–V4 и выключена по умолчанию. */
  LIVE_CAMPAIGN_V5_ENABLED?: string;
  /** Публикации V5 в чат выключены, пока владелец не включает их отдельно. */
  LIVE_CAMPAIGN_V5_PUBLISH_ENABLED?: string;
  /** Отдельный launch URL V5; если не задан, берётся origin штатной Mini App. */
  V5_MINIAPP_URL?: string;
  /** Username бота без @ для deep-link из группового поста. */
  V5_BOT_USERNAME?: string;
  /** disabled | cloudflare | groq. Внешний ключ нужен только для groq. */
  V5_LLM_PROVIDER?: string;
  V5_LLM_MODEL?: string;
  GROQ_API_KEY?: string;
  /** Workers AI — необязательный режиссёр, не источник игровой истины. */
  AI?: Ai;
}

export interface UserRow {
  id: number;
  tg_id: number;
  username: string | null;
  started_bot_at: string | null;
  is_member: number;
  member_checked_at: string | null;
  banned_at: string | null;
  push_enabled: number;
  quiet_from_hour: number;
  quiet_to_hour: number;
  push_misses: number;
}

export interface ProfileRow {
  user_id: number;
  role: string | null;
  coloring: string;
  hatched_at: string | null;
  bird_name: string | null;
}

export interface WalletRow {
  user_id: number;
  wallet: number;
  reputation: number;
  passive_collected_day: number | null;
}

export interface PlayerRow extends UserRow, ProfileRow, WalletRow {}

export interface ColoringRow {
  code: string;
  title: string;
  rarity: 'common' | 'rare' | 'legendary';
  palette: string;
  weight: number;
}
