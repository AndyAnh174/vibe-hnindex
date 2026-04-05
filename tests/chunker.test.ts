import { describe, it, expect } from 'vitest';
import { chunkFile } from '../src/services/chunker.js';

describe('chunker', () => {
  it('should return single chunk for small files', () => {
    const content = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join('\n');
    const chunks = chunkFile(content, 'test.ts');

    expect(chunks).toHaveLength(1);
    expect(chunks[0].startLine).toBe(1);
    expect(chunks[0].endLine).toBe(30);
    expect(chunks[0].chunkIndex).toBe(0);
  });

  it('should split large files into multiple chunks', () => {
    const content = Array.from({ length: 200 }, (_, i) => `const x${i} = ${i};`).join('\n');
    const chunks = chunkFile(content, 'big.ts');

    expect(chunks.length).toBeGreaterThan(1);

    // Chunks should be sequential
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].chunkIndex).toBe(i);
    }

    // First chunk starts at line 1
    expect(chunks[0].startLine).toBe(1);

    // Last chunk ends at total lines
    expect(chunks[chunks.length - 1].endLine).toBe(200);
  });

  it('should split at function boundaries when possible', () => {
    const lines: string[] = [];
    // ~55 lines of code
    for (let i = 0; i < 55; i++) {
      lines.push(`  const v${i} = ${i};`);
    }
    // function boundary near the split point
    lines.push('export function handleRequest() {');
    for (let i = 0; i < 60; i++) {
      lines.push(`  const y${i} = ${i};`);
    }
    lines.push('}');

    const content = lines.join('\n');
    const chunks = chunkFile(content, 'boundary.ts');

    expect(chunks.length).toBeGreaterThan(1);

    // The second chunk should start at or near the function declaration
    const secondChunk = chunks[1];
    expect(secondChunk.content).toContain('export function handleRequest');
  });

  it('should handle empty content', () => {
    const chunks = chunkFile('', 'empty.ts');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('');
  });

  it('should preserve content integrity across chunks', () => {
    const content = Array.from({ length: 200 }, (_, i) => `line-${i + 1}`).join('\n');
    const chunks = chunkFile(content, 'integrity.ts');

    // Every original line should appear in at least one chunk
    for (let i = 1; i <= 200; i++) {
      const found = chunks.some(c => c.content.includes(`line-${i}`));
      expect(found, `line-${i} should be in at least one chunk`).toBe(true);
    }
  });

  it('should have overlap between consecutive chunks', () => {
    const content = Array.from({ length: 200 }, (_, i) => `unique-line-${i + 1}`).join('\n');
    const chunks = chunkFile(content, 'overlap.ts');

    if (chunks.length >= 2) {
      // Last few lines of chunk N should appear in chunk N+1
      const firstChunkLines = chunks[0].content.split('\n');
      const lastLinesOfFirst = firstChunkLines.slice(-5);
      const secondChunkContent = chunks[1].content;

      const hasOverlap = lastLinesOfFirst.some(line => secondChunkContent.includes(line));
      expect(hasOverlap, 'consecutive chunks should have overlap').toBe(true);
    }
  });
});
