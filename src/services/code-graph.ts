import ts from 'typescript';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseScript, scriptDeclarations } from './typescript-ast.js';

export const CODE_GRAPH_VERSION = '1';
export interface GraphSource { filePath: string; content: string }
export interface GraphNode {
  id: string; projectName: string; filePath: string; name: string; kind: string;
  startLine: number; endLine: number; column: number; parentId: string | null;
  signature: string; exported: boolean;
}
export type GraphEdgeKind = 'DEFINES' | 'IMPORTS' | 'REFERENCES' | 'CALLS';
export interface GraphEdge {
  id: string; projectName: string; sourceId: string; targetId: string | null;
  kind: GraphEdgeKind; filePath: string; line: number; column: number;
  targetName: string; resolution: 'resolved' | 'unresolved';
}
export interface CodeGraph { nodes: GraphNode[]; edges: GraphEdge[]; warnings: string[] }
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const normalize = (value: string) => path.resolve(value).replace(/\\/g, '/');

/** Only indexed snapshots participate in resolution; ignored files cannot enter the graph. */
export function analyzeCodeGraph(projectName: string, rootPath: string, inputs: GraphSource[], options: ts.CompilerOptions = {}): CodeGraph {
  const snapshots = new Map(inputs.map(input => [normalize(path.join(rootPath, input.filePath)), input]));
  const compilerOptions: ts.CompilerOptions = {
    ...options, allowJs: true, checkJs: true, noLib: true, noEmit: true,
    target: ts.ScriptTarget.ESNext,
    module: options.module ?? ts.ModuleKind.NodeNext,
    moduleResolution: options.moduleResolution ?? ts.ModuleResolutionKind.NodeNext,
  };
  const host = ts.createCompilerHost(compilerOptions);
  host.getCurrentDirectory = () => normalize(rootPath);
  host.readFile = file => snapshots.get(normalize(file))?.content;
  host.fileExists = file => snapshots.has(normalize(file));
  const dirs = new Set<string>();
  for (const file of snapshots.keys()) {
    let dir = path.dirname(file).replace(/\\/g, '/');
    while (!dirs.has(dir)) { dirs.add(dir); const parent = path.dirname(dir).replace(/\\/g, '/'); if (parent === dir) break; dir = parent; }
  }
  host.directoryExists = dir => dirs.has(normalize(dir));
  host.realpath = normalize;
  host.getSourceFile = file => {
    const input = snapshots.get(normalize(file));
    return input ? parseScript(input.content, normalize(file)) : undefined;
  };
  const program = ts.createProgram([...snapshots.keys()], compilerOptions, host);
  const checker = program.getTypeChecker();
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const warnings: string[] = [];
  const nodeIds = new Map<ts.Node, string>();
  const variableIds = new Set<string>();
  const kindsById = new Map<string, string>();
  const symbolIds = new Map<ts.Symbol, string>();
  const fileIds = new Map<string, string>();
  const sources = program.getSourceFiles().filter(source => snapshots.has(normalize(source.fileName)));

  for (const source of sources) {
    const filePath = snapshots.get(normalize(source.fileName))!.filePath;
    const id = hash(`${projectName}|file|${filePath}`);
    fileIds.set(normalize(source.fileName), id);
    nodeIds.set(source, id);
    nodes.push({ id, projectName, filePath, name: filePath, kind: 'file', startLine: 1,
      endLine: source.text.split('\n').length, column: 1, parentId: null, signature: '', exported: false });
    for (const decl of scriptDeclarations(source)) {
      const id = hash(`${projectName}|${filePath}|${decl.node.getStart(source)}|${decl.kind}|${decl.name}`);
      const parentId = decl.parent ? nodeIds.get(decl.parent.node)! : fileIds.get(normalize(source.fileName))!;
      nodeIds.set(decl.node, id);
      kindsById.set(id, decl.kind);
      if (decl.kind === 'variable') variableIds.add(id);
      nodes.push({ id, projectName, filePath, name: decl.name, kind: decl.kind, startLine: decl.startLine,
        endLine: decl.endLine, column: decl.column, parentId, signature: decl.signature, exported: decl.exported });
      const symbol = decl.nameNode ? checker.getSymbolAtLocation(decl.nameNode) : undefined;
      if (symbol) {
        // Prefer the implementation when there are overload signatures.
        if (!symbolIds.has(symbol) || ('body' in decl.node && decl.node.body)) symbolIds.set(symbol, id);
      }
      addEdge(parentId, id, 'DEFINES', source, decl.node, decl.name);
    }
    for (const diagnostic of program.getSyntacticDiagnostics(source)) {
      const pos = source.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
      warnings.push(`${filePath}:${pos.line + 1}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
    }
  }

  function resolveSymbol(node: ts.Node): string | null {
    let symbol = checker.getSymbolAtLocation(node);
    if (!symbol) return null;
    if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    const direct = symbolIds.get(symbol);
    if (direct) return direct;
    for (const decl of symbol.declarations ?? []) {
      const id = nodeIds.get(decl) ?? (ts.isSourceFile(decl) ? fileIds.get(normalize(decl.fileName)) : undefined);
      if (id) return id;
    }
    return null;
  }
  function owner(node: ts.Node): string {
    let current: ts.Node | undefined = node.parent;
    while (current) {
      const id = nodeIds.get(current);
      if (id && !variableIds.has(id)) return id;
      current = current.parent;
    }
    return fileIds.get(normalize(node.getSourceFile().fileName))!;
  }
  function addEdge(sourceId: string, targetId: string | null, kind: GraphEdgeKind, source: ts.SourceFile, location: ts.Node, targetName: string) {
    const pos = source.getLineAndCharacterOfPosition(location.getStart(source));
    const filePath = snapshots.get(normalize(source.fileName))!.filePath;
    const id = hash(`${projectName}|${sourceId}|${targetId ?? targetName}|${kind}|${location.getStart(source)}`);
    edges.push({ id, projectName, sourceId, targetId, kind, filePath, line: pos.line + 1,
      column: pos.character + 1, targetName, resolution: targetId ? 'resolved' : 'unresolved' });
  }
  function isUse(node: ts.Identifier): boolean {
    const parent = node.parent;
    if ('name' in parent && parent.name === node && !ts.isPropertyAccessExpression(parent)
      && !ts.isShorthandPropertyAssignment(parent)) return false;
    if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) || ts.isImportClause(parent)
      || ts.isNamespaceImport(parent) || ts.isLabeledStatement(parent)
      || ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) return false;
    return true;
  }
  for (const source of sources) {
    function visit(node: ts.Node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        const target = resolveSymbol(node.moduleSpecifier);
        addEdge(fileIds.get(normalize(source.fileName))!, target, 'IMPORTS', source, node.moduleSpecifier,
          ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : node.moduleSpecifier.getText(source));
      }
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        const expression = node.expression;
        const location = ts.isPropertyAccessExpression(expression) ? expression.name : expression;
        const binding = resolveSymbol(location);
        const target = binding && ['function', 'method', 'class'].includes(kindsById.get(binding) ?? '') ? binding : null;
        addEdge(owner(node), target, 'CALLS', source, node, expression.getText(source).slice(0, 200));
      }
      if (ts.isIdentifier(node) && isUse(node)) {
        const target = resolveSymbol(node);
        if (target) addEdge(owner(node), target, 'REFERENCES', source, node, node.text);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return { nodes, edges: [...new Map(edges.map(edge => [edge.id, edge])).values()], warnings };
}
