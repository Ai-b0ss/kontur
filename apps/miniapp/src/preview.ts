const PREVIEW_USER_BASE = 980_000;

/** Десять независимых обезличенных мест только для отдельной preview-сборки. */
export function previewInitData(search: string, enabled: boolean): string {
  if (!enabled) return '';
  const value = new URLSearchParams(search).get('preview');
  if (value === null) return `dev:${PREVIEW_USER_BASE + 1}`;
  if (!/^(?:[1-9]|10)$/.test(value)) return '';
  const slot = Number(value);
  return `dev:${PREVIEW_USER_BASE + slot}`;
}
