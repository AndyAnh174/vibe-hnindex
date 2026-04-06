import { describe, it, expect } from 'vitest';
import {
  parseHnindexIgnoreContent,
  isIgnored,
  matchesHnindexPattern,
} from '../src/services/hnindex-ignore.js';

describe('parseHnindexIgnoreContent', () => {
  it('skips blanks and # comments', () => {
    expect(
      parseHnindexIgnoreContent(`
# dist
dist/

  **/*.min.js
`),
    ).toEqual(['dist/', '**/*.min.js']);
  });
});

describe('isIgnored', () => {
  const patterns = ['dist/', '**/*.min.js', 'coverage/**'];

  it('matches directory prefix pattern', () => {
    expect(isIgnored('dist/index.js', patterns)).toBe(true);
    expect(isIgnored('src/main.ts', patterns)).toBe(false);
  });

  it('matches glob minified js', () => {
    expect(isIgnored('static/app.min.js', patterns)).toBe(true);
    expect(isIgnored('static/app.js', patterns)).toBe(false);
  });

  it('matches coverage tree', () => {
    expect(isIgnored('coverage/lcov.info', patterns)).toBe(true);
  });
});

describe('matchesHnindexPattern', () => {
  it('bare filename matches in subdirs', () => {
    expect(matchesHnindexPattern('node_modules/pkg/foo.js', 'foo.js')).toBe(true);
  });
});
