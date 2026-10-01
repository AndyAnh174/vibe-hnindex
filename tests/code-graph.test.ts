import { describe, it, expect } from 'vitest';
import path from 'node:path';
import ts from 'typescript';
import { analyzeCodeGraph } from '../src/services/code-graph.js';
import { chunkFile } from '../src/services/chunker.js';
import { parseImports, parseExports } from '../src/services/dependency-parser.js';

const root = path.resolve('graph-fixture');
describe('AST code graph resolution', () => {
  it('resolves multiline import aliases through a barrel and records call-site evidence', () => {
    const graph = analyzeCodeGraph('p', root, [
      { filePath: 'util.ts', content: 'export function target() { return 1; }' },
      { filePath: 'barrel.ts', content: "export { target as renamed } from './util.js';" },
      { filePath: 'main.ts', content: "import {\n renamed as local\n} from './barrel.js';\nexport function entry() {\n const value = local();\n return value;\n}" },
    ]);
    const target = graph.nodes.find(node => node.name === 'target')!;
    const entry = graph.nodes.find(node => node.name === 'entry')!;
    expect(graph.edges).toContainEqual(expect.objectContaining({ kind: 'CALLS', sourceId: entry.id, targetId: target.id, filePath: 'main.ts', line: 5, resolution: 'resolved' }));
    expect(graph.edges).toContainEqual(expect.objectContaining({ kind: 'REFERENCES', targetId: target.id, filePath: 'main.ts', line: 5 }));
    expect(graph.edges.filter(edge => edge.kind === 'IMPORTS' && edge.resolution === 'resolved')).toHaveLength(2);
  });

  it('resolves tsconfig paths, default and namespace imports', () => {
    const graph = analyzeCodeGraph('p', root, [
      { filePath: 'src/util.ts', content: 'export default function greet() {}\nexport function named() {}' },
      { filePath: 'src/main.ts', content: "import greet from '@lib/util';\nimport * as lib from '@lib/util';\ngreet(); lib.named();" },
    ], { module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
      baseUrl: root, paths: { '@lib/*': ['src/*'] } });
    const calls = graph.edges.filter(edge => edge.kind === 'CALLS');
    expect(calls).toHaveLength(2);
    expect(calls.every(edge => edge.resolution === 'resolved')).toBe(true);
  });

  it('keeps lexical shadowing and duplicate names distinct', () => {
    const graph = analyzeCodeGraph('p', root, [{ filePath: 'a.ts', content:
      'export function same() {}\nexport function outer() {\n function same() {}\n same();\n}\nsame();' },
    { filePath: 'b.ts', content: 'export function same() {}' }]);
    const same = graph.nodes.filter(node => node.name === 'same');
    expect(same).toHaveLength(3);
    const calls = graph.edges.filter(edge => edge.kind === 'CALLS');
    expect(calls.find(edge => edge.line === 4)?.targetId).toBe(same.find(node => node.startLine === 3)!.id);
    expect(calls.find(edge => edge.line === 6)?.targetId).toBe(same.find(node => node.filePath === 'a.ts' && node.startLine === 1)!.id);
  });

  it('resolves typed methods and JS imports', () => {
    const graph = analyzeCodeGraph('p', root, [
      { filePath: 'service.ts', content: 'export class Service { run() {} }' },
      { filePath: 'main.ts', content: "import { Service } from './service';\nexport function invoke(service: Service) { service.run(); }" },
      { filePath: 'util.js', content: 'export function work() {}' },
      { filePath: 'app.js', content: "import { work } from './util.js'; work();" },
    ], { moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext });
    expect(graph.edges).toContainEqual(expect.objectContaining({ kind: 'CALLS', targetId: graph.nodes.find(node => node.name === 'run')!.id }));
    expect(graph.edges).toContainEqual(expect.objectContaining({ kind: 'CALLS', targetId: graph.nodes.find(node => node.name === 'work')!.id }));
  });

  it('labels dynamic/external calls unresolved and ignores comments/strings', () => {
    const graph = analyzeCodeGraph('p', root, [{ filePath: 'a.ts', content:
      "export function known() {}\n// known();\nconst text = 'known()';\nexport function dynamic(fn: any) { fn(); external(); }" }]);
    const calls = graph.edges.filter(edge => edge.kind === 'CALLS');
    expect(calls).toHaveLength(2);
    expect(calls.every(edge => edge.targetId === null && edge.resolution === 'unresolved')).toBe(true);
  });

  it('prefers overload implementation and reports syntax warnings', () => {
    const graph = analyzeCodeGraph('p', root, [{ filePath: 'a.ts', content:
      'export function load(x: string): string;\nexport function load(x: any) { return x; }\nload("a");' },
    { filePath: 'bad.ts', content: 'export function broken( {' }]);
    expect(graph.edges.find(edge => edge.kind === 'CALLS')?.targetId).toBe(graph.nodes.find(node => node.name === 'load' && node.startLine === 2)!.id);
    expect(graph.warnings.some(warning => warning.startsWith('bad.ts:'))).toBe(true);
  });

  it('distinguishes known arrow functions from variables holding dynamic callbacks', () => {
    const graph = analyzeCodeGraph('p', root, [{ filePath: 'a.ts', content:
      'export const known = () => 1;\nconst dynamic: any = factory();\nknown(); dynamic();' }]);
    const known = graph.nodes.find(node => node.name === 'known')!;
    expect(graph.edges).toContainEqual(expect.objectContaining({ kind: 'CALLS', targetId: known.id, resolution: 'resolved' }));
    expect(graph.edges).toContainEqual(expect.objectContaining({ kind: 'CALLS', targetName: 'dynamic', targetId: null, resolution: 'unresolved' }));
  });

  it('does not resolve imports to excluded files on disk', () => {
    const graph = analyzeCodeGraph('p', root, [{ filePath: 'main.ts', content: "import { analyzeCodeGraph } from '../src/services/code-graph'; analyzeCodeGraph();" }]);
    expect(graph.edges.filter(edge => edge.kind === 'CALLS')[0].resolution).toBe('unresolved');
    expect(graph.nodes.every(node => node.filePath === 'main.ts')).toBe(true);
  });
});

describe('AST source boundaries', () => {
  it('preserves whole functions, comments and exact line content without overlap', () => {
    const first = ['export function first() {', ...Array.from({ length: 40 }, () => '  return 1;'), '}'];
    const second = ['// docs for second', 'export function second() {', ...Array.from({ length: 40 }, () => '  return 2;'), '}'];
    const content = [...first, ...second].join('\n');
    const chunks = chunkFile(content, 'source.ts');
    expect(chunks).toHaveLength(2);
    expect(chunks[0].content).toBe(first.join('\n'));
    expect(chunks[1].content).toBe(second.join('\n'));
    expect(chunks.map(chunk => chunk.content).join('\n')).toBe(content);
  });
  it('caps oversized declarations and keeps all lines', () => {
    const content = ['export function large() {', ...Array.from({ length: 180 }, () => ' const value = 1;'), '}'].join('\n');
    const chunks = chunkFile(content, 'large.ts');
    expect(chunks.every(chunk => chunk.endLine - chunk.startLine + 1 <= 60)).toBe(true);
    expect(chunks.map(chunk => chunk.content).join('\n')).toBe(content);
  });
  it('parses multiline imports and reexports without string/comment false positives', () => {
    const source = "import {\n foo as renamed,\n bar\n} from './util';\nexport { foo } from './util';\n// require('fake');\nconst text = `import { x } from 'fake'`;";
    expect(parseImports(source, 'typescript')).toEqual([
      { specifier: './util', specifiers: ['foo', 'bar'], importType: 'static' },
      { specifier: './util', specifiers: ['foo'], importType: 'static' },
    ]);
    expect(parseExports(source, 'typescript')).toContainEqual({ name: 'foo', exportType: 'variable', lineNumber: 5 });
  });
});
