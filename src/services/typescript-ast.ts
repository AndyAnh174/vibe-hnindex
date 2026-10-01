import ts from 'typescript';
import type { SymbolKind } from '../types.js';

export function isScriptFile(filePath: string): boolean {
  return /\.(?:[cm]?[jt]s|[jt]sx)$/i.test(filePath);
}

export function parseScript(content: string, filePath: string): ts.SourceFile {
  return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
}

export interface AstDeclaration {
  node: ts.Node;
  nameNode?: ts.Node;
  name: string;
  kind: SymbolKind;
  startLine: number;
  endLine: number;
  column: number;
  signature: string;
  parent?: AstDeclaration;
  exported: boolean;
}

/** Syntax-only declarations. Project-wide reference resolution lives in code-graph.ts. */
export function scriptDeclarations(source: ts.SourceFile): AstDeclaration[] {
  const result: AstDeclaration[] = [];
  function visit(node: ts.Node, parent?: AstDeclaration) {
    let kind: SymbolKind | undefined;
    let nameNode: ts.Node | undefined;
    if (ts.isFunctionDeclaration(node)) { kind = 'function'; nameNode = node.name; }
    else if (ts.isClassDeclaration(node)) { kind = 'class'; nameNode = node.name; }
    else if (ts.isInterfaceDeclaration(node)) { kind = 'interface'; nameNode = node.name; }
    else if (ts.isTypeAliasDeclaration(node)) { kind = 'type'; nameNode = node.name; }
    else if (ts.isEnumDeclaration(node)) { kind = 'enum'; nameNode = node.name; }
    else if (ts.isModuleDeclaration(node)) { kind = 'namespace'; nameNode = node.name; }
    else if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)
      || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
      kind = 'method'; nameNode = node.name;
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      kind = node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
        ? 'function' : 'variable';
      nameNode = node.name;
    } else if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
      kind = ts.isPropertyDeclaration(node) && node.initializer && ts.isArrowFunction(node.initializer)
        ? 'method' : 'variable';
      nameNode = node.name;
    }
    let declaration = parent;
    if (kind && (nameNode || ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node))) {
      const pos = source.getLineAndCharacterOfPosition(node.getStart(source));
      const end = source.getLineAndCharacterOfPosition(node.getEnd());
      let modifierNode: ts.Node = node;
      if (ts.isVariableDeclaration(node)) modifierNode = node.parent.parent;
      const modifiers = ts.canHaveModifiers(modifierNode) ? ts.getModifiers(modifierNode) : undefined;
      const exported = modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword || m.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
      const body = 'body' in node ? (node as ts.FunctionDeclaration).body : undefined;
      let signatureEnd = body?.getStart(source) ?? node.getEnd();
      if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) {
        signatureEnd = node.members.pos;
      } else if (ts.isVariableDeclaration(node) && node.initializer) {
        const init = node.initializer;
        signatureEnd = ts.isArrowFunction(init) || ts.isFunctionExpression(init)
          ? init.body.getStart(source) : init.getStart(source);
      }
      declaration = {
        node, nameNode, name: nameNode && (ts.isIdentifier(nameNode) || ts.isStringLiteral(nameNode) || ts.isNumericLiteral(nameNode))
          ? nameNode.text : nameNode?.getText(source) ?? 'default', kind,
        startLine: pos.line + 1, endLine: end.line + 1, column: pos.character + 1,
        signature: source.text.slice(node.getStart(source), signatureEnd).replace(/\s+/g, ' ').trim().slice(0, 300),
        parent, exported,
      };
      result.push(declaration);
    }
    ts.forEachChild(node, child => visit(child, declaration));
  }
  visit(source);
  return result;
}

/** Non-overlapping line ranges covering the entire file, preserving declaration boundaries. */
export function scriptChunkRanges(content: string, filePath: string, maxLines: number): Array<[number, number]> | null {
  const source = parseScript(content, filePath);
  if ((source as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics?.length) return null;
  const total = content.split('\n').length;
  const boundaries = new Set<number>([1, total + 1]);
  function splitStatement(node: ts.Node) {
    // Include leading comments with their declaration.
    const trivia = source.text.slice(node.getFullStart(), node.getStart(source));
    const leading = trivia.search(/\S/);
    const start = source.getLineAndCharacterOfPosition(leading >= 0 ? node.getFullStart() + leading : node.getStart(source)).line + 1;
    if (start > 1) boundaries.add(start);
    const end = source.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
    if (end - start + 1 > maxLines && (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node))) {
      for (const member of node.members) {
        const line = source.getLineAndCharacterOfPosition(member.getStart(source)).line + 1;
        if (line > start) boundaries.add(line);
      }
    }
  }
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)
      || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)
      || ts.isEnumDeclaration(statement) || ts.isModuleDeclaration(statement)
      || (ts.isVariableStatement(statement) && statement.declarationList.declarations.some(decl =>
        decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))))) {
      splitStatement(statement);
    }
  }
  const sorted = [...boundaries].sort((a, b) => a - b);
  const ranges: Array<[number, number]> = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    // Oversized functions still have a hard cap; every source line is retained.
    for (let start = sorted[i]; start < sorted[i + 1]; start += maxLines) {
      ranges.push([start, Math.min(start + maxLines - 1, sorted[i + 1] - 1)]);
    }
  }
  return ranges;
}

/** Embedding-only metadata; stored source text and its line numbers remain unchanged. */
export function embeddingChunkText(chunk: { content: string; startLine: number; endLine: number }, filePath: string): string {
  if (!isScriptFile(filePath)) return chunk.content;
  return `File: ${filePath}\nLines: ${chunk.startLine}-${chunk.endLine}\n${chunk.content}`;
}
