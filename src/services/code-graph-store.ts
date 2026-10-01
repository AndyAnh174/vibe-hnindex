import ts from 'typescript';
import path from 'node:path';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { config } from '../config.js';
import { getDb } from './sqlite.js';
import { analyzeCodeGraph, CODE_GRAPH_VERSION, type GraphSource, type GraphNode, type GraphEdge, type GraphEdgeKind } from './code-graph.js';
import { isScriptFile } from './typescript-ast.js';

export function graphSources(projectName: string, filePaths?: string[]): GraphSource[] {
  if (filePaths && !filePaths.length) return [];
  const filter = filePaths ? ` AND file_path IN (${filePaths.map(() => '?').join(',')})` : '';
  return getDb().prepare(`SELECT file_path AS filePath, content FROM code_graph_sources WHERE project_name = ?${filter} ORDER BY file_path`).all(projectName, ...(filePaths ?? [])) as GraphSource[];
}

export function graphState(projectName: string): { version: string; warnings: string[]; updatedAt: string } | null {
  if (!config.codeGraphEnabled) return null;
  const row = getDb().prepare('SELECT version, warnings, updated_at AS updatedAt FROM code_graph_state WHERE project_name = ?').get(projectName) as { version: string; warnings: string; updatedAt: string } | undefined;
  return row?.version === CODE_GRAPH_VERSION ? { ...row, warnings: JSON.parse(row.warnings) } : null;
}

function projectOptions(rootPath: string): { options: ts.CompilerOptions; warnings: string[] } {
  const filename = ['tsconfig.json', 'jsconfig.json'].map(file => path.join(rootPath, file)).find(file => fs.existsSync(file));
  if (!filename) return { options: {}, warnings: [] };
  const read = ts.readConfigFile(filename, ts.sys.readFile);
  if (read.error) throw new Error(`Cannot read project config: ${ts.flattenDiagnosticMessageText(read.error.messageText, ' ')}`);
  const parsed = ts.parseJsonConfigFileContent(read.config, { ...ts.sys, readDirectory: () => [] }, rootPath);
  const errors = parsed.errors.filter(error => error.code !== 18003); // no input files: snapshots are supplied separately
  if (errors.length) throw new Error(`Invalid project config: ${errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, ' ')).join('; ')}`);
  return { options: parsed.options, warnings: [] };
}

/** Rebuild resolution across the project when snapshots or compiler options change. */
export function refreshCodeGraph(projectName: string, rootPath: string) {
  if (!config.codeGraphEnabled) return { nodes: 0, edges: 0, unresolved: 0, rebuilt: false, warnings: ['Code graph disabled.'] };
  const db = getDb();
  try {
    const inputs = graphSources(projectName);
    const { options } = projectOptions(rootPath);
    const fingerprint = createHash('sha256').update(JSON.stringify([CODE_GRAPH_VERSION, ts.version, path.resolve(rootPath), options, inputs])).digest('hex');
    const previous = db.prepare('SELECT fingerprint FROM code_graph_state WHERE project_name = ?').get(projectName) as { fingerprint: string } | undefined;
    if (previous?.fingerprint === fingerprint) return { ...graphCounts(projectName), rebuilt: false, warnings: graphState(projectName)?.warnings ?? [] };
    const graph = analyzeCodeGraph(projectName, rootPath, inputs, options);
    db.transaction(() => {
      db.prepare('DELETE FROM code_graph_edges WHERE projectName = ?').run(projectName);
      db.prepare('DELETE FROM code_graph_nodes WHERE projectName = ?').run(projectName);
      const nodeInsert = db.prepare('INSERT INTO code_graph_nodes VALUES (@id, @projectName, @filePath, @name, @kind, @startLine, @endLine, @column, @parentId, @signature, @exported)');
      for (const node of graph.nodes) nodeInsert.run({ ...node, exported: Number(node.exported) });
      const edgeInsert = db.prepare('INSERT INTO code_graph_edges VALUES (@id, @projectName, @sourceId, @targetId, @kind, @filePath, @line, @column, @targetName, @resolution)');
      for (const edge of graph.edges) edgeInsert.run(edge);
      db.prepare('INSERT OR REPLACE INTO code_graph_state VALUES (?, ?, ?, ?, ?)').run(projectName, fingerprint, CODE_GRAPH_VERSION, JSON.stringify(graph.warnings.slice(0, 50)), new Date().toISOString());
    })();
    return { ...graphCounts(projectName), rebuilt: true, warnings: graph.warnings.slice(0, 50) };
  } catch (error) {
    // Failed resolution must never expose edges from the previous source snapshot.
    db.prepare('DELETE FROM code_graph_state WHERE project_name = ?').run(projectName);
    throw error;
  }
}

export function syncCodeGraph(projectName: string, rootPath: string, inputs: GraphSource[]) {
  if (!config.codeGraphEnabled) return refreshCodeGraph(projectName, rootPath);
  const db = getDb();
  const scripts = inputs.filter(input => isScriptFile(input.filePath));
  const previous = graphSources(projectName);
  if (JSON.stringify(previous) !== JSON.stringify([...scripts].sort((a, b) => a.filePath < b.filePath ? -1 : a.filePath > b.filePath ? 1 : 0))) {
    db.transaction(() => {
      db.prepare('DELETE FROM code_graph_state WHERE project_name = ?').run(projectName);
      db.prepare('DELETE FROM code_graph_sources WHERE project_name = ?').run(projectName);
      const insert = db.prepare('INSERT INTO code_graph_sources VALUES (?, ?, ?)');
      for (const input of scripts) insert.run(projectName, input.filePath, input.content);
    })();
  }
  return refreshCodeGraph(projectName, rootPath);
}

export function updateCodeGraphFile(projectName: string, rootPath: string, filePath: string, content: string | null) {
  if (!config.codeGraphEnabled) return;
  const db = getDb();
  const previous = db.prepare('SELECT content FROM code_graph_sources WHERE project_name = ? AND file_path = ?').get(projectName, filePath) as { content: string } | undefined;
  if ((content !== null && isScriptFile(filePath) && previous?.content === content)
    || ((!isScriptFile(filePath) || content === null) && !previous)) return refreshCodeGraph(projectName, rootPath);
  db.transaction(() => {
    db.prepare('DELETE FROM code_graph_state WHERE project_name = ?').run(projectName);
    if (content !== null && isScriptFile(filePath)) db.prepare('INSERT OR REPLACE INTO code_graph_sources VALUES (?, ?, ?)').run(projectName, filePath, content);
    else db.prepare('DELETE FROM code_graph_sources WHERE project_name = ? AND file_path = ?').run(projectName, filePath);
  })();
  return refreshCodeGraph(projectName, rootPath);
}

export function graphCounts(projectName: string): { nodes: number; edges: number; unresolved: number } {
  const db = getDb();
  return {
    nodes: (db.prepare('SELECT COUNT(*) AS n FROM code_graph_nodes WHERE projectName = ?').get(projectName) as { n: number }).n,
    edges: (db.prepare('SELECT COUNT(*) AS n FROM code_graph_edges WHERE projectName = ?').get(projectName) as { n: number }).n,
    unresolved: (db.prepare("SELECT COUNT(*) AS n FROM code_graph_edges WHERE projectName = ? AND resolution = 'unresolved'").get(projectName) as { n: number }).n,
  };
}

export function findGraphNodes(projectName: string, args: { symbol?: string; file_path?: string; line?: number; limit?: number }): GraphNode[] {
  if (!graphState(projectName)) return [];
  const clauses = ['projectName = ?'];
  const params: Array<string | number> = [projectName];
  if (args.symbol) { clauses.push('name = ? AND kind != ?'); params.push(args.symbol, 'file'); }
  if (args.file_path) { clauses.push('filePath = ?'); params.push(args.file_path.replace(/\\/g, '/')); }
  if (args.line !== undefined) { clauses.push('startLine = ?'); params.push(args.line); }
  return getDb().prepare(`SELECT * FROM code_graph_nodes WHERE ${clauses.join(' AND ')} ORDER BY filePath, startLine, column LIMIT ?`).all(...params, args.limit ?? 21) as GraphNode[];
}

export function graphEdges(projectName: string, ids: string[], direction: 'incoming' | 'outgoing' | 'both', kinds: GraphEdgeKind[], limit: number): GraphEdge[] {
  if (!ids.length || !graphState(projectName)) return [];
  const placeholders = ids.map(() => '?').join(',');
  const where = direction === 'both' ? `(sourceId IN (${placeholders}) OR targetId IN (${placeholders}))`
    : `${direction === 'incoming' ? 'targetId' : 'sourceId'} IN (${placeholders})`;
  return getDb().prepare(`SELECT * FROM code_graph_edges WHERE projectName = ? AND ${where} AND kind IN (${kinds.map(() => '?').join(',')}) ORDER BY filePath, line, column, kind LIMIT ?`)
    .all(projectName, ...ids, ...(direction === 'both' ? ids : []), ...kinds, limit) as GraphEdge[];
}

export function graphNodesById(projectName: string, ids: string[]): GraphNode[] {
  if (!ids.length || !graphState(projectName)) return [];
  return getDb().prepare(`SELECT * FROM code_graph_nodes WHERE projectName = ? AND id IN (${ids.map(() => '?').join(',')})`).all(projectName, ...ids) as GraphNode[];
}

export function traverseCodeGraph(projectName: string, seeds: GraphNode[], args: { depth?: number; maxNodes?: number; maxEdges?: number; direction?: 'incoming' | 'outgoing' | 'both' } = {}) {
  const maxNodes = Math.max(1, Math.min(100, args.maxNodes ?? config.codeGraphMaxNodes));
  const maxEdges = Math.max(1, Math.min(500, args.maxEdges ?? 200));
  const depth = Math.max(0, Math.min(3, args.depth ?? 1));
  const nodes = new Map(seeds.slice(0, maxNodes).map(node => [node.id, node]));
  const edges = new Map<string, GraphEdge>();
  let frontier = [...nodes.keys()];
  let truncated = seeds.length > maxNodes;
  const started = performance.now();
  for (let hop = 0; hop < depth && frontier.length; hop++) {
    if (performance.now() - started > 250) { truncated = true; break; }
    const candidates = graphEdges(projectName, frontier, args.direction ?? 'both', ['CALLS', 'REFERENCES', 'IMPORTS', 'DEFINES'], maxEdges + 1);
    const next = new Set<string>();
    for (const edge of candidates) {
      if (performance.now() - started > 250) { truncated = true; break; }
      if (edges.size >= maxEdges) { truncated = true; break; }
      const ids = [edge.sourceId, edge.targetId].filter((id): id is string => id !== null && !nodes.has(id));
      if (nodes.size + ids.length > maxNodes) { truncated = true; continue; }
      edges.set(edge.id, edge);
      for (const node of graphNodesById(projectName, ids)) { nodes.set(node.id, node); next.add(node.id); }
    }
    frontier = [...next];
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()], truncated };
}
