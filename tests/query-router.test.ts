import { describe, it, expect } from 'vitest';
import { resolveSearchMode } from '../src/services/query-router.js';

describe('resolveSearchMode', () => {
  it.each([
    ['keyword', 'getFoo', 'keyword'],
    ['semantic', 'getFoo', 'semantic'],
    ['hybrid', 'getFoo', 'hybrid'],
    ['auto', 'src/api/handler.ts', 'keyword'],
    ['auto', 'foo_bar_baz', 'keyword'],
    ['auto', 'MyClassName', 'keyword'],
    ['auto', 'how does authentication work in this codebase', 'hybrid'],
    ['auto', 'where is the database connection configured for production', 'hybrid'],
    ['auto', 'a '.repeat(30).trim(), 'hybrid'],
    ['auto', 'what', 'hybrid'],
    ['auto', 'import react from', 'keyword'],
    ['auto', 'import react from react package', 'hybrid'],
  ] as const)('explicit or auto: %s + %j → %s', (mode, query, expected) => {
    expect(resolveSearchMode(query, mode)).toBe(expected);
  });
});
