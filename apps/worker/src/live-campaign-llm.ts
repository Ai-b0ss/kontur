import type { Env } from './types.js';

/**
 * The narrator is deliberately incapable of deciding game state. It receives
 * only a server-selected template and safe topic, and any bad/slow answer is
 * replaced with a deterministic line before it reaches a player or Telegram.
 */
export const V5_TEMPLATE_IDS = ['signal-storm', 'fractured-route', 'nest-watch'] as const;
export type V5TemplateId = typeof V5_TEMPLATE_IDS[number];
export const V5_SAFE_THEMES = ['systems', 'visual', 'analysis', 'team'] as const;
export type V5SafeTheme = typeof V5_SAFE_THEMES[number];

export interface V5NarrativeInput {
  eventId: string;
  templateId: V5TemplateId;
  theme: V5SafeTheme;
}

export interface V5Narrative {
  title: string;
  brief: string;
  cta: string;
  tone: 'cold' | 'sharp' | 'calm';
  reaction: '⚡' | '🧭' | '🪶';
  source: 'fallback' | 'cloudflare' | 'groq';
}

/** Opening a game window must never wait on an optional narrator for long. */
export const V5_NARRATIVE_TIMEOUT_MS = 1_250;

const FALLBACKS: Record<V5TemplateId, Record<V5SafeTheme, Omit<V5Narrative, 'source'>>> = {
  'signal-storm': {
    systems: { title: 'Сигнал штормит', brief: 'На ветви дрогнула цепь. Нужен точный ход, не громкий.', cta: 'Выбрать узел', tone: 'sharp', reaction: '⚡' },
    visual: { title: 'Контур расплылся', brief: 'Один маршрут стал нечитаемым. Верни ему форму.', cta: 'Выбрать узел', tone: 'sharp', reaction: '⚡' },
    analysis: { title: 'Шум в показаниях', brief: 'Ветка даёт лишний сигнал. Отдели риск от шума.', cta: 'Выбрать узел', tone: 'cold', reaction: '🧭' },
    team: { title: 'Сбой в связке', brief: 'Порядок ходов разошёлся. Собери безопасный маршрут.', cta: 'Выбрать узел', tone: 'calm', reaction: '🪶' },
  },
  'fractured-route': {
    systems: { title: 'Маршрут треснул', brief: 'Один переход больше не выполняет условие.', cta: 'Проверить ветвь', tone: 'cold', reaction: '⚡' },
    visual: { title: 'Маршрут потерял форму', brief: 'Следующий узел есть, но его нельзя прочитать с первого взгляда.', cta: 'Проверить ветвь', tone: 'sharp', reaction: '🪶' },
    analysis: { title: 'Недостающая связь', brief: 'Перед захватом не хватает одного проверяемого факта.', cta: 'Проверить ветвь', tone: 'cold', reaction: '🧭' },
    team: { title: 'Маршрут без владельца', brief: 'Зависимость висит между узлами. Выбери, что удержать.', cta: 'Проверить ветвь', tone: 'calm', reaction: '🪶' },
  },
  'nest-watch': {
    systems: { title: 'Гнездо под нагрузкой', brief: 'Сектор выдержит только один осмысленный ход.', cta: 'Открыть кампанию', tone: 'sharp', reaction: '⚡' },
    visual: { title: 'Гнездо теряет контраст', brief: 'Шторм прячет важный ориентир. Верни его на карту.', cta: 'Открыть кампанию', tone: 'calm', reaction: '🪶' },
    analysis: { title: 'Гнездо без прогноза', brief: 'Риск уже близко, но его направление ещё можно раскрыть.', cta: 'Открыть кампанию', tone: 'cold', reaction: '🧭' },
    team: { title: 'Гнездо ждёт связку', brief: 'Один сектор держится, пока порядок действий не распался.', cta: 'Открыть кампанию', tone: 'calm', reaction: '🪶' },
  },
};

// The narrator cannot safely explain or invent mechanics. Reject output that
// looks like a rule, reward, answer, person-level claim or wagering prompt;
// the deterministic fallback remains better than plausible hallucinated copy.
const NON_PRESENTATIONAL_TEXT = /\d|яиц|балл|очк|наград|ответ|прогноз|игрок|участник|сообщен|ставк|деньг|правил|услов|порог|секунд|минут|час/iu;

function fallback(input: V5NarrativeInput): V5Narrative {
  return { ...FALLBACKS[input.templateId][input.theme], source: 'fallback' };
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length > max || /https?:|@|<|>/.test(normalized) || NON_PRESENTATIONAL_TEXT.test(normalized)) return null;
  return normalized;
}

/** Validates model output as presentation copy, never as mechanics. */
export function parseV5Narrative(value: unknown, source: Exclude<V5Narrative['source'], 'fallback'>): V5Narrative | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const title = text(row.title, 58);
  const brief = text(row.brief, 180);
  const cta = text(row.cta, 32);
  const tone = row.tone;
  const reaction = row.reaction;
  if (!title || !brief || !cta) return null;
  if (tone !== 'cold' && tone !== 'sharp' && tone !== 'calm') return null;
  if (reaction !== '⚡' && reaction !== '🧭' && reaction !== '🪶') return null;
  return { title, brief, cta, tone, reaction, source };
}

function prompt(input: V5NarrativeInput): string {
  return [
    'Return JSON only. You are a restrained Russian narrator for a Telegram mini game.',
    'You may write only presentation fields; never introduce rules, rewards, people, predictions, links, or calls to pay.',
    `Template=${input.templateId}; safeTheme=${input.theme}; event=${input.eventId}.`,
    'Schema: {"title":string<=58,"brief":string<=180,"cta":string<=32,"tone":"cold"|"sharp"|"calm","reaction":"⚡"|"🧭"|"🪶"}.',
  ].join('\n');
}

async function cloudflareNarrative(env: Env, input: V5NarrativeInput): Promise<V5Narrative | null> {
  if (!env.AI) return null;
  try {
    const output = await env.AI.run(
      env.V5_LLM_MODEL || '@cf/qwen/qwen3-30b-a3b-fp8',
      { messages: [{ role: 'user', content: prompt(input) }], response_format: { type: 'json_object' } },
    ) as unknown;
    const raw = output && typeof output === 'object' && 'response' in output
      ? (output as { response?: unknown }).response : output;
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parseV5Narrative(value, 'cloudflare');
  } catch {
    return null;
  }
}

async function groqNarrative(env: Env, input: V5NarrativeInput): Promise<V5Narrative | null> {
  if (!env.GROQ_API_KEY) return null;
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.V5_LLM_MODEL || 'openai/gpt-oss-20b',
        temperature: 0.45,
        max_completion_tokens: 180,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt(input) }],
      }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const raw = payload.choices?.[0]?.message?.content;
    return typeof raw === 'string' ? parseV5Narrative(JSON.parse(raw), 'groq') : null;
  } catch {
    return null;
  }
}

async function boundedNarrative(
  provider: () => Promise<V5Narrative | null>,
  fallbackValue: V5Narrative,
): Promise<V5Narrative> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const narrative = await new Promise<V5Narrative | null>((resolve) => {
      timer = setTimeout(() => resolve(null), V5_NARRATIVE_TIMEOUT_MS);
      void provider().then(resolve, () => resolve(null));
    });
    return narrative ?? fallbackValue;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function createV5Narrative(env: Env, input: V5NarrativeInput): Promise<V5Narrative> {
  const fallbackValue = fallback(input);
  if (env.V5_LLM_PROVIDER === 'cloudflare') return boundedNarrative(() => cloudflareNarrative(env, input), fallbackValue);
  if (env.V5_LLM_PROVIDER === 'groq') return boundedNarrative(() => groqNarrative(env, input), fallbackValue);
  return fallbackValue;
}
