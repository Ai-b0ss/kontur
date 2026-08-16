import { telegramShareUrl } from './share.js';
import { previewInitData } from './preview.js';

interface TelegramWebApp {
  initData: string;
  ready(): void;
  expand(): void;
  close(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  openTelegramLink?(url: string): void;
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const webApp = window.Telegram?.WebApp;

export function initTelegram(): void {
  if (!webApp?.initData) return;
  webApp.ready();
  webApp.expand();
  const isZeroSeason = new URLSearchParams(window.location.search).get('season') === 'zero';
  const bg = isZeroSeason ? '#141414' : '#12111f';
  webApp.setHeaderColor?.(bg);
  webApp.setBackgroundColor?.(bg);
}

export function getInitData(): string {
  return webApp?.initData || previewInitData(
    window.location.search,
    import.meta.env.VITE_PREVIEW_MODE === 'true',
  );
}

export const isInsideTelegram = Boolean(webApp?.initData);

export function haptic(kind: 'tap' | 'ok' | 'fail'): void {
  if (!isInsideTelegram) return;
  const h = webApp?.HapticFeedback;
  if (!h) return;
  if (kind === 'tap') h.impactOccurred('light');
  if (kind === 'ok') h.notificationOccurred('success');
  if (kind === 'fail') h.notificationOccurred('error');
}

/**
 * Похвастаться в чат.
 *
 * Обычный Telegram share-link не требует inline-режима и отдельного
 * обработчика inline_query у бота.
 */
export function shareToChat(text: string): void {
  const url = telegramShareUrl(text);
  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(url);
  } else {
    window.open(url, '_blank');
  }
}
