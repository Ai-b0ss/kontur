/** Игровые команды принадлежат ровно одному, основному чату. */
export function isMainChat(
  chatId: string | number,
  mainChatId: string,
): boolean {
  const expected = mainChatId.trim();
  return expected.length > 0 && String(chatId) === expected;
}
