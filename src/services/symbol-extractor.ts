import crypto from 'node:crypto';
import type { SymbolKind, SymbolRecord } from '../types.js';
import { parseScript, scriptDeclarations } from './typescript-ast.js';

export interface ParsedSymbol {
  name: string;
  kind: SymbolKind;
  lineNumber: number;
  signature: string | null;
  parentName: string | null;
  exported: boolean;
}

function trimSig(line: string): string {
  const t = line.trim();
  return t.length > 200 ? `${t.slice(0, 197)}...` : t;
}

/** AST extraction for TS/JS; heuristic extraction for Python. */
export function extractSymbols(content: string, language: string): ParsedSymbol[] {
  const lang = language.toLowerCase();
  switch (lang) {
    case 'typescript':
    case 'javascript':
    case 'tsx':
    case 'jsx':
      return scriptDeclarations(parseScript(content, `symbols.${lang === 'jsx' ? 'jsx' : lang === 'tsx' ? 'tsx' : 'ts'}`)).map(decl => ({
        name: decl.name, kind: decl.kind, lineNumber: decl.startLine, signature: decl.signature,
        parentName: decl.parent?.name ?? null, exported: decl.exported,
      }));
    case 'python':
      return extractPythonSymbols(content);
    default:
      return [];
  }
}


function dedupeSymbols(symbols: ParsedSymbol[]): ParsedSymbol[] {
  const seen = new Set<string>();
  const out: ParsedSymbol[] = [];
  for (const s of symbols) {
    const key = `${s.name}:${s.lineNumber}:${s.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function extractPythonSymbols(content: string): ParsedSymbol[] {
  const results: ParsedSymbol[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    if (line.startsWith(' ') || line.startsWith('\t')) continue;

    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    let m = trimmed.match(/^def\s+(\w+)\s*\(/);
    if (m) {
      results.push({
        name: m[1],
        kind: 'function',
        lineNumber: lineNum,
        signature: trimSig(trimmed),
        parentName: null,
        exported: true,
      });
      continue;
    }

    m = trimmed.match(/^class\s+(\w+)/);
    if (m) {
      results.push({
        name: m[1],
        kind: 'class',
        lineNumber: lineNum,
        signature: trimSig(trimmed),
        parentName: null,
        exported: true,
      });
    }
  }

  return dedupeSymbols(results);
}

export function toSymbolRecords(
  projectName: string,
  filePath: string,
  language: string,
  parsed: ParsedSymbol[]
): SymbolRecord[] {
  return parsed.map((p) => ({
    id: crypto
      .createHash('sha256')
      .update(`${projectName}|${filePath}|${p.name}|${p.lineNumber}|${p.kind}`)
      .digest('hex'),
    projectName,
    filePath,
    name: p.name,
    kind: p.kind,
    lineNumber: p.lineNumber,
    signature: p.signature,
    parentName: p.parentName,
    exported: p.exported,
    language,
  }));
}
