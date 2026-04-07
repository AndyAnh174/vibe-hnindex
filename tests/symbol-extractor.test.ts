import { describe, expect, it } from 'vitest';
import { extractSymbols, toSymbolRecords } from '../src/services/symbol-extractor.js';

describe('symbol-extractor', () => {
  it('extracts exported function and class from TypeScript', () => {
    const src = `
export function foo() {}
export class Bar {
  baz() {}
}
`;
    const syms = extractSymbols(src, 'typescript');
    const names = syms.map((s) => s.name);
    expect(names).toContain('foo');
    expect(names).toContain('Bar');
    const rec = toSymbolRecords('p', 'f.ts', 'typescript', syms);
    expect(rec.length).toBeGreaterThanOrEqual(2);
    expect(rec.every((r) => r.projectName === 'p' && r.filePath === 'f.ts')).toBe(true);
  });

  it('extracts top-level def and class from Python', () => {
    const src = `def hello():
    pass

class Thing:
    def method(self):
        pass
`;
    const syms = extractSymbols(src, 'python');
    const names = syms.map((s) => s.name);
    expect(names).toContain('hello');
    expect(names).toContain('Thing');
  });
});
