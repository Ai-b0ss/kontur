export function telegramShareUrl(text: string): string {
  return `https://t.me/share/url?url=&text=${encodeURIComponent(text)}`;
}
