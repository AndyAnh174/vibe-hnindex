import path from 'node:path';
import { minimatch } from 'minimatch';
import { config } from '../config.js';
import { getExistingFileHash, getFileChunks, lookupSymbols, searchKeyword } from '../services/sqlite.js';
import { findGraphNodes, graphEdges, graphNodesById, graphSources, graphState } from '../services/code-graph-store.js';
import { projectFiles, readWorkspaceFile, resolveWorkspace, snapshotHash, type WorkspaceArgs } from '../services/workspace.js';
import { loadHnindexIgnore, isIgnored } from '../services/hnindex-ignore.js';
import { graphTokenCount } from './code-graph.js';
import { search } from './search.js';
import type { SearchResult } from '../types.js';

type Location = { file: string; line: number; endLine: number; symbol?: string; kind?: string; signature?: string | null; graphId?: string; origin: string };
export async function locateCodeTool(args: WorkspaceArgs & { query?: string; symbol?: string; file_pattern?: string; mode?: 'auto' | 'symbol' | 'keyword' | 'hybrid'; limit?: number; token_budget?: number }, roots: string[] = []) {
  const response = (value: unknown) => ({ content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] });
  const resolved = resolveWorkspace(args, roots);
  if ('error' in resolved) return response(resolved);
  if (!resolved.project) return response({ error: 'Workspace not indexed.', path: resolved.root, next: 'Run index_code_graph (offline) or index_codebase first.' });
  const project = resolved.project.projectName;
  const query = (args.symbol ?? args.query ?? '').trim();
  if (!query || query.length > 1000) return response('Provide query or symbol (1–1000 characters).');
  const mode = args.symbol ? 'symbol' : args.mode ?? 'auto';
  const limit = Math.max(1, Math.min(20, args.limit ?? 8));
  const budget = Math.max(512, Math.min(10000, args.token_budget ?? 2000));
  const pattern = args.file_pattern;
  const ignored = loadHnindexIgnore(resolved.root);
  const visible = (file: string) => !isIgnored(file, ignored);
  const allowed = (file: string) => visible(file) && (!pattern || minimatch(file, pattern, { dot: true }));
  const allFiles = projectFiles(project).filter(allowed);
  const candidates: Location[] = [];
  const seen = new Set<string>();
  const add = (location: Location) => { const key = `${location.file}:${location.line}:${location.symbol ?? ''}`; if (allowed(location.file) && !seen.has(key)) { seen.add(key); candidates.push(location); } };
  if (mode === 'auto') {
    const fileMatches = allFiles.filter(file => file === query.replace(/\\/g, '/') || path.basename(file) === query);
    for (const file of fileMatches.slice(0, 100)) add({ file, line: 1, endLine: 1, origin: 'file' });
  }
  if (mode === 'symbol' || (mode === 'auto' && !candidates.length && /^[\w$]+$/.test(query))) {
    if (graphState(project)) for (const node of findGraphNodes(project, { symbol: query, limit: 100 })) add({ file: node.filePath, line: node.startLine, endLine: node.endLine, symbol: node.name, kind: node.kind, signature: node.signature, graphId: node.id, origin: 'graph' });
    for (const symbol of lookupSymbols({ projectName: project, name: query, filePattern: pattern, limit: 100 })) {
      if (mode === 'symbol' && symbol.name !== query) continue;
      add({ file: symbol.filePath, line: symbol.lineNumber, endLine: symbol.lineNumber, symbol: symbol.name, kind: symbol.kind, signature: symbol.signature, origin: 'symbol_index' });
    }
  }
  if (!candidates.length && mode !== 'symbol') {
    let hits: SearchResult[];
    if (mode === 'hybrid') {
      hits = [];
      await search({ project_name: project, query, mode: 'hybrid', limit: 30, file_pattern: pattern, rerank: false }, { onResults: results => { hits = results; } });
    } else hits = searchKeyword(query, project, 50, { file_pattern: pattern });
    for (const hit of hits) add({ file: hit.filePath, line: hit.startLine, endLine: hit.endLine, origin: mode === 'hybrid' ? 'hybrid' : 'keyword' });
  }
  const sourceFiles = [...new Set(candidates.slice(0, 100).map(candidate => candidate.file))];
  const snapshots = new Map(graphSources(project, sourceFiles).map(source => [source.filePath, source.content]));
  const current = new Map<string, string | null>();
  const read = (file: string) => { if (!current.has(file)) current.set(file, readWorkspaceFile(resolved.root, file, config.maxFileSize)); return current.get(file)!; };
  const freshness = (file: string, origin = 'graph') => {
    const content = read(file);
    if (content === null) return 'missing_or_excluded';
    const expected = origin === 'graph' ? (snapshots.has(file) ? snapshotHash(snapshots.get(file)!) : null) : getExistingFileHash(project, file);
    return expected ? snapshotHash(content) === expected ? 'fresh' : 'stale' : 'unverified';
  };
  const locations: Array<Record<string, unknown>> = [];
  for (const candidate of candidates.slice(0, limit)) {
    const origin = candidate.origin === 'file' && snapshots.has(candidate.file) ? 'graph' : candidate.origin;
    const status = freshness(candidate.file, origin);
    const snapshot = candidate.origin === 'graph' || origin === 'graph' ? snapshots.get(candidate.file) : undefined;
    const chunk = snapshot === undefined ? getFileChunks(project, candidate.file).find(chunk => chunk.startLine <= candidate.line && chunk.endLine >= candidate.line) : undefined;
    const excerpt = status === 'missing_or_excluded' ? undefined : status === 'fresh' ? read(candidate.file)!.split('\n').slice(Math.max(0, candidate.line - 2), candidate.line + 5).join('\n') : snapshot?.split('\n').slice(Math.max(0, candidate.line - 2), candidate.line + 5).join('\n') ?? chunk?.content.slice(0, 500);
    locations.push({ file: candidate.file, absolutePath: path.join(resolved.root, candidate.file), line: candidate.line, endLine: candidate.endLine, symbol: candidate.symbol, kind: candidate.kind, signature: candidate.signature, origin: candidate.origin, freshness: status, excerpt: excerpt?.slice(0, 700), next: status === 'fresh' ? 'smart_context or graph_context for deeper context' : 'Re-index this file/graph before trusting source positions.' });
  }
  const exact = candidates.filter(candidate => candidate.symbol === query);
  const distinct = [...new Map(exact.map(candidate => [`${candidate.file}:${candidate.line}`, candidate])).values()];
  const relations: Array<Record<string, unknown>> = [];
  if (distinct.length === 1 && distinct[0].graphId && freshness(distinct[0].file) === 'fresh') {
    const edges = graphEdges(project, [distinct[0].graphId], 'both', ['CALLS', 'REFERENCES'], 12);
    const endpoints = new Map(graphNodesById(project, edges.flatMap(edge => [edge.sourceId, edge.targetId].filter((id): id is string => id !== null))).map(node => [node.id, node]));
    const edgeFiles = [...new Set([...edges.map(edge => edge.filePath), ...[...endpoints.values()].map(node => node.filePath)])];
    for (const source of graphSources(project, edgeFiles)) snapshots.set(source.filePath, source.content);
    for (const edge of edges) if (visible(edge.filePath)) {
      const target = edge.targetId ? endpoints.get(edge.targetId) : undefined;
      const sourceStatus = freshness(edge.filePath);
      const targetStatus = target ? freshness(target.filePath) : 'unverified';
      const status = sourceStatus !== 'fresh' ? sourceStatus : target && targetStatus !== 'fresh' ? targetStatus : 'fresh';
      relations.push({ file: edge.filePath, line: edge.line, column: edge.column, kind: edge.kind, target: edge.targetName, targetFile: target && visible(target.filePath) ? target.filePath : undefined, resolution: edge.resolution, freshness: status, targetFreshness: targetStatus });
    }
  }
  const payload: Record<string, unknown> = { project, workspace: resolved.root, query, mode, ambiguousSymbol: distinct.length > 1, locations, relations, truncated: candidates.length > limit,
    note: 'Positions and resolution describe indexed snapshots. Freshness checks files/endpoints, not every resolver input (e.g. tsconfig/barrels); refresh after changes. Dynamic/external calls may be unresolved. Auto is local; hybrid uses configured APIs.' };
  if (!candidates.length) payload.next = 'Try an exact symbol/file path, mode=hybrid for concepts, or update the index. Filesystem search remains available for unindexed/excluded code.';
  let text = JSON.stringify(payload, null, 2);
  while (graphTokenCount(text) > budget && relations.length) { relations.pop(); payload.truncated = true; text = JSON.stringify(payload, null, 2); }
  if (graphTokenCount(text) > budget) { for (const location of locations) { delete location.excerpt; delete location.signature; delete location.next; } payload.truncated = true; text = JSON.stringify(payload, null, 2); }
  while (graphTokenCount(text) > budget && locations.length) { locations.pop(); payload.truncated = true; text = JSON.stringify(payload, null, 2); }
  if (graphTokenCount(text) > budget) return response({ project, truncated: true, next: 'Increase token_budget or narrow query/file_pattern.' });
  return response(text);
}
