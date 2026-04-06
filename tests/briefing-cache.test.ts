import { describe, it, expect } from 'vitest';
import { buildBriefingCacheKey } from '../src/tools/project-briefing.js';
import type { ProjectInfo } from '../src/types.js';

function sampleProject(overrides: Partial<ProjectInfo> = {}): ProjectInfo {
  return {
    projectName: 'demo',
    rootPath: '/tmp/demo',
    fileCount: 10,
    chunkCount: 50,
    lastIndexedAt: '2026-04-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('buildBriefingCacheKey', () => {
  it('concatenates file count, chunk count, and last indexed time', () => {
    const p = sampleProject();
    expect(buildBriefingCacheKey(p)).toBe('10|50|2026-04-01T12:00:00.000Z');
  });

  it('changes when any fingerprint field changes', () => {
    const a = buildBriefingCacheKey(sampleProject());
    const b = buildBriefingCacheKey(sampleProject({ fileCount: 11 }));
    const c = buildBriefingCacheKey(sampleProject({ chunkCount: 51 }));
    const d = buildBriefingCacheKey(sampleProject({ lastIndexedAt: '2026-04-02T12:00:00.000Z' }));
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
  });
});
