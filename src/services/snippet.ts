/** Default max characters per chunk body when content_mode is compact. */
export const DEFAULT_MAX_CONTENT_CHARS = 2000;

/**
 * Truncate at Unicode code point boundaries; append ellipsis when truncated.
 */
export function truncateContentUnicode(text: string, maxChars: number): string {
  if (maxChars <= 0) return '';
  if (text.length <= maxChars) return text;
  const chars = Array.from(text);
  if (chars.length <= maxChars) return text;
  return chars.slice(0, maxChars).join('') + '…';
}
