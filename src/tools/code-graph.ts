import path from 'node:path';
import fs from 'node:fs';
import { Tiktoken } from 'js-tiktoken/lite';
import cl100k from 'js-tiktoken/ranks/cl100k_base';
import { config } from '../config.js';
import { getProject, upsertProject, getExistingFileHash } from '../services/sqlite.js';
import { fastHash } from '../services/fast-hash.js';
import { scanDirectory } from '../services/file-scanner.js';
import { isScriptFile } from '../services/typescript-ast.js';
import { findGraphNodes, graphEdges, graphNodesById, graphSources, graphState, syncCodeGraph, traverseCodeGraph } from '../services/code-graph-store.js';
import type { GraphNode } from '../services/code-graph.js';
import type { SearchResult } from '../types.js';
import { search } from './search.js';
import { rerankSearchResults } from '../services/rerank.js';

const result = (text: string) => ({ content: [{ type: 'text' as const, text }] });
let tokenizer: Tiktoken | undefined;
export function graphTokenCount(text: string): number {
  tokenizer ??= new Tiktoken(cl100k);
  return tokenizer.encode(text, [], []).length;
}

export async function indexCodeGraphTool(args: { path: string; project_name: string }) {
  if (!config.codeGraphEnabled) return result('Error: CODE_GRAPH_ENABLED=false.');
  const rootPath = path.resolve(args.path);
  if (!fs.existsSync(rootPath) || !fs.statSync(rootPath).isDirectory()) return result('Error: path must be a directory.');
  const project = getProject(args.project_name);
  if (project && path.resolve(project.rootPath) !== rootPath) return result('Error: project_name already belongs to another directory. Use a new project name.');
  const inputs = [];
  for await (const file of scanDirectory(rootPath)) {
    if (isScriptFile(file.relativePath)) inputs.push({ filePath: file.relativePath, content: file.content });
  }
  upsertProject(args.project_name, rootPath);
  try {
    const graph = syncCodeGraph(args.project_name, rootPath, inputs);
    return result(`Code graph indexed for "${args.project_name}".\nFiles: ${inputs.length}\nNodes: ${graph.nodes}\nEdges: ${graph.edges}\nUnresolved edges: ${graph.unresolved}\nRebuilt: ${graph.rebuilt}\n${graph.warnings.join('\n')}\nStatic analysis only. Dynamic and external calls may be unresolved. Keyword/vector chunks require index_codebase separately.`);
  } catch (error) { return result(`Error: Graph analysis failed: ${error instanceof Error ? error.message : 'unknown error'}`); }
}

export interface GraphToolArgs { project_name: string; symbol: string; file_path?: string; line?: number; limit?: number }
function graphError(projectName: string): string | null {
  if (!getProject(projectName)) return `Error: Project "${projectName}" not found.`;
  if (!graphState(projectName)) return 'Error: Code graph unavailable or outdated. Run index_code_graph or index_codebase with CODE_GRAPH_ENABLED=true.';
  return null;
}
function uniqueSymbol(args: GraphToolArgs): GraphNode | string {
  const error = graphError(args.project_name);
  if (error) return error;
  const nodes = findGraphNodes(args.project_name, { ...args, limit: 21 });
  if (!nodes.length) return `Symbol "${args.symbol}" not found in the code graph.`;
  if (nodes.length > 1) return `Ambiguous symbol "${args.symbol}". Specify file_path and line (definition start line).\n${nodes.slice(0, 20).map(node => `- ${node.name}: ${node.filePath}:${node.startLine}:${node.column} (${node.kind})`).join('\n')}`;
  return nodes[0];
}
function relationsTool(args: GraphToolArgs, kind: 'CALLS' | 'REFERENCES') {
  const node = uniqueSymbol(args);
  if (typeof node === 'string') return result(node);
  const limit = Math.max(1, Math.min(200, args.limit ?? 50));
  const edges = graphEdges(args.project_name, [node.id], 'incoming', [kind], limit + 1);
  const sources = new Map(graphNodesById(args.project_name, edges.map(edge => edge.sourceId)).map(source => [source.id, source]));
  const lines = [`${kind === 'CALLS' ? 'Call sites' : 'References'} to ${node.name} (${node.filePath}:${node.startLine})`,
    'Static, resolved relationships only; dynamic/external calls can be missing.'];
  for (const edge of edges.slice(0, limit)) {
    const source = sources.get(edge.sourceId);
    lines.push(`- ${edge.filePath}:${edge.line}:${edge.column} — ${source?.name ?? '<file>'} → ${node.name} [${kind}, resolved]`);
  }
  if (!edges.length) lines.push('No resolved relationships found.');
  if (edges.length > limit) lines.push(`Truncated at ${limit} results.`);
  const warnings = graphState(args.project_name)?.warnings ?? [];
  if (warnings.length) lines.push(`Parser warnings: ${warnings.slice(0, 3).join('; ')}`);
  return result(lines.join('\n'));
}
export const findReferencesTool = (args: GraphToolArgs) => relationsTool(args, 'REFERENCES');
export const callersTool = (args: GraphToolArgs) => relationsTool(args, 'CALLS');

export async function graphContextTool(args: {
  project_name: string; symbol?: string; file_path?: string; line?: number; query?: string;
  depth?: number; max_nodes?: number; token_budget?: number;
  direction?: 'incoming' | 'outgoing' | 'both';
}) {
  const error = graphError(args.project_name);
  if (error) return result(error);
  if (!args.symbol && !args.file_path && !args.query) return result('Error: Provide symbol, file_path or query.');
  let seeds: GraphNode[];
  if (args.symbol) {
    const node = uniqueSymbol({ ...args, symbol: args.symbol });
    if (typeof node === 'string') return result(node);
    seeds = [node];
  } else if (args.file_path) {
    seeds = findGraphNodes(args.project_name, { file_path: args.file_path, limit: 101 });
    // The file node contains the entire file; start from declarations to get call/reference edges at depth 1.
    const declarations = seeds.filter(node => node.kind !== 'file');
    if (declarations.length) seeds = declarations;
  } else {
    let hits: SearchResult[] = [];
    await search({ project_name: args.project_name, query: args.query!, mode: 'hybrid', limit: 5 }, {
      onResults: results => { hits = results; },
    });
    const snapshotHashes = new Map(graphSources(args.project_name, [...new Set(hits.map(hit => hit.filePath))])
      .map(source => [source.filePath, fastHash(source.content)]));
    const freshHits = hits.filter(hit => snapshotHashes.get(hit.filePath) === getExistingFileHash(args.project_name, hit.filePath));
    if (hits.length && !freshHits.length) return result('Graph source snapshots differ from retrieved chunks. Run index_codebase to synchronize chunks and graph before query mode.');
    seeds = freshHits.flatMap(hit => findGraphNodes(args.project_name, { file_path: hit.filePath, limit: 101 })
      .filter(node => node.kind !== 'file' && node.endLine >= hit.startLine && node.startLine <= hit.endLine));
  }
  if (!seeds.length) return result('No graph seeds found. Use an exact symbol/file or index keyword/vector chunks for query mode.');
  const graph = traverseCodeGraph(args.project_name, seeds, {
    depth: args.depth, maxNodes: args.max_nodes, direction: args.direction,
  });
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  const files = [...new Set([...graph.nodes.map(node => node.filePath), ...graph.edges.map(edge => edge.filePath)])];
  const inputs = new Map(graphSources(args.project_name, files).map(source => [source.filePath, source.content.split('\n')]));
  const budget = Math.max(256, Math.min(20000, args.token_budget ?? 4000));
  const warnings = graphState(args.project_name)?.warnings ?? [];
  const pieces = [`Code graph context — ${args.project_name}\nStatic analysis; dynamic/external calls may be unresolved. Tokenizer: cl100k_base; budget: ${budget}.\n${graph.truncated ? 'Traversal truncated by node/edge/time limits.\n' : ''}${warnings.length ? 'Parser warnings present; some relationships may be missing.\n' : ''}`];
  let omitted = 0;
  function add(piece: string) {
    const candidate = [...pieces, piece].join('\n\n');
    if (graphTokenCount(candidate) <= budget) pieces.push(piece);
    else omitted++;
  }
  for (const edge of [...graph.edges].sort((a, b) => Number(a.kind === 'DEFINES') - Number(b.kind === 'DEFINES'))) {
    const from = nodes.get(edge.sourceId);
    const to = edge.targetId ? nodes.get(edge.targetId) : undefined;
    const evidence = inputs.get(edge.filePath)?.[edge.line - 1]?.trim().slice(0, 250) ?? '';
    add(`${edge.filePath}:${edge.line}:${edge.column} — ${from?.name ?? '<file>'} ${edge.kind} ${to?.name ?? edge.targetName} [${edge.resolution}]${evidence ? '\n  ' + evidence : ''}`);
  }
  let snippets: SearchResult[] = graph.nodes.filter(node => node.kind !== 'file').map((node, index) => ({
    id: node.id, filePath: node.filePath, absolutePath: '', chunkIndex: index,
    startLine: node.startLine, endLine: Math.min(node.endLine, node.startLine + 79),
    content: (inputs.get(node.filePath) ?? []).slice(node.startLine - 1, Math.min(node.endLine, node.startLine + 79)).join('\n'),
    language: /\.[cm]?jsx?$/.test(node.filePath) ? 'javascript' : 'typescript',
    score: 1 / (index + 1), matchType: 'symbol',
  }));
  if (args.query && snippets.length > 1) snippets = await rerankSearchResults(args.query, snippets);
  for (const snippet of snippets) {
    const node = nodes.get(snippet.id)!;
    const header = `${node.name} — ${node.filePath}:${snippet.startLine}-${snippet.endLine}\n${node.signature}`;
    let contentLines = snippet.content.split('\n');
    let piece = `${header}\n\`\`\`${snippet.language}\n${contentLines.join('\n')}\n\`\`\``;
    while (contentLines.length > 1 && graphTokenCount([...pieces, piece].join('\n\n')) > budget - 30) {
      contentLines = contentLines.slice(0, -1);
      piece = `${header}\n\`\`\`${snippet.language}\n${contentLines.join('\n')}\n// ... source excerpt truncated\n\`\`\``;
    }
    add(piece);
  }
  if (omitted) add(`Context truncated by token budget; ${omitted} entries omitted.`);
  return result(pieces.join('\n\n'));
}
