/**
 * Fuzzy search utilities — Levenshtein distance and similarity scoring.
 * v0.8.1
 */

/**
 * Standard Levenshtein distance between two strings.
 * Returns the minimum number of single-character edits (insertions, deletions, substitutions)
 * required to change one string into the other.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Optimization: if one string is empty, distance is the length of the other
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

/**
 * Returns a similarity score between 0 and 1 (1 = exact match).
 * Uses normalized Levenshtein distance.
 */
export function fuzzyScore(query: string, target: string): number {
  const maxLen = Math.max(query.length, target.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(query.toLowerCase(), target.toLowerCase());
  return 1 - dist / maxLen;
}

/**
 * Check if a query string likely contains spelling errors or typos.
 * Heuristic: repeated characters (≥3), common misspellings, very short words with unusual patterns.
 */
export function detectTypos(query: string): boolean {
  if (!query || query.length < 3) return false;

  // Repeated character patterns (e.g., "helllo", "wooord")
  if (/(.)\1{2,}/.test(query)) return true;

  // Very long words (>12 chars) are suspicious in code search
  const words = query.split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (w.length > 15) return true;
  }

  // Common misspelling patterns
  const misspellings = [
    /\bie\b.*\bie\b/,       // "recieve" instead of "receive"
    /\bteh\b/,               // "teh" instead of "the"
    /\bfucntion\b/,          // common typo for "function"
    /\bfucntion\b/,
    /\breutrn\b/,            // "reutrn" instead of "return"
    /\bretrun\b/,
    /\bconosle\b/,           // "conosle" instead of "console"
    /\bconsle\b/,
    /\bimprot\b/,            // "improt" instead of "import"
    /\bexpot\b/,             // "expot" instead of "export"
    /\bdocumnet\b/,          // "documnet" instead of "document"
  ];

  for (const pattern of misspellings) {
    if (pattern.test(query)) return true;
  }

  return false;
}
