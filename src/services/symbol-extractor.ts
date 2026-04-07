import crypto from 'node:crypto';
import type { SymbolKind, SymbolRecord } from '../types.js';

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

/** Heuristic symbol extraction (no full AST). TS/JS + Python first. */
export function extractSymbols(content: string, language: string): ParsedSymbol[] {
  const lang = language.toLowerCase();
  switch (lang) {
    case 'typescript':
    case 'javascript':
    case 'tsx':
    case 'jsx':
      return extractTsJsSymbols(content);
    case 'python':
      return extractPythonSymbols(content);
    default:
      return [];
  }
}

function extractTsJsSymbols(content: string): ParsedSymbol[] {
  const results: ParsedSymbol[] = [];
  const lines = content.split('\n');
  let classDepth = 0;
  let currentClass: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }

    // Track rough brace depth for class bodies (skip strings roughly)
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;
    if (classDepth > 0) {
      classDepth += openBraces - closeBraces;
      if (classDepth <= 0) {
        classDepth = 0;
        currentClass = null;
      }
    }

    // --- exported / top-level declarations ---
    let m: RegExpMatchArray | null;

    m = trimmed.match(/^export\s+default\s+(?:async\s+)?function\s+(\w+)/);
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

    m =
      trimmed.match(/^export\s+default\s+(?:abstract\s+)?class\s+(\w+)/) ||
      trimmed.match(/^export\s+(?:abstract\s+)?class\s+(\w+)/);
    if (m) {
      results.push({
        name: m[1],
        kind: 'class',
        lineNumber: lineNum,
        signature: trimSig(trimmed),
        parentName: null,
        exported: true,
      });
      currentClass = m[1];
      classDepth = Math.max(1, openBraces - closeBraces);
      continue;
    }

    m = trimmed.match(/^export\s+(?:async\s+)?function\s+(\w+)/);
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

    m = trimmed.match(/^export\s+(?:const|let|var)\s+(\w+)/);
    if (m) {
      results.push({
        name: m[1],
        kind: 'variable',
        lineNumber: lineNum,
        signature: trimSig(trimmed),
        parentName: null,
        exported: true,
      });
      continue;
    }

    m = trimmed.match(/^export\s+interface\s+(\w+)/);
    if (m) {
      results.push({
        name: m[1],
        kind: 'interface',
        lineNumber: lineNum,
        signature: trimSig(trimmed),
        parentName: null,
        exported: true,
      });
      continue;
    }

    m = trimmed.match(/^export\s+type\s+(\w+)/);
    if (m) {
      results.push({
        name: m[1],
        kind: 'type',
        lineNumber: lineNum,
        signature: trimSig(trimmed),
        parentName: null,
        exported: true,
      });
      continue;
    }

    m = trimmed.match(/^export\s+enum\s+(\w+)/);
    if (m) {
      results.push({
        name: m[1],
        kind: 'enum',
        lineNumber: lineNum,
        signature: trimSig(trimmed),
        parentName: null,
        exported: true,
      });
      continue;
    }

    m = trimmed.match(/^export\s*\{[^}]*\}\s*from\s/m);
    if (m) continue;

    // Non-export top-level (heuristic: column 0 or starts with keyword)
    if (!trimmed.startsWith('export ')) {
      m = trimmed.match(/^class\s+(\w+)/);
      if (m && !trimmed.includes(' extends ') && classDepth === 0) {
        results.push({
          name: m[1],
          kind: 'class',
          lineNumber: lineNum,
          signature: trimSig(trimmed),
          parentName: null,
          exported: false,
        });
        currentClass = m[1];
        classDepth = openBraces - closeBraces;
        if (classDepth <= 0) classDepth = 1;
        continue;
      }

      m = trimmed.match(/^(?:async\s+)?function\s+(\w+)\s*\(/);
      if (m) {
        results.push({
          name: m[1],
          kind: 'function',
          lineNumber: lineNum,
          signature: trimSig(trimmed),
          parentName: null,
          exported: false,
        });
        continue;
      }

      m = trimmed.match(/^interface\s+(\w+)/);
      if (m) {
        results.push({
          name: m[1],
          kind: 'interface',
          lineNumber: lineNum,
          signature: trimSig(trimmed),
          parentName: null,
          exported: false,
        });
        continue;
      }

      m = trimmed.match(/^type\s+(\w+)\s*(?:<|=)/);
      if (m) {
        results.push({
          name: m[1],
          kind: 'type',
          lineNumber: lineNum,
          signature: trimSig(trimmed),
          parentName: null,
          exported: false,
        });
        continue;
      }

      m = trimmed.match(/^enum\s+(\w+)/);
      if (m) {
        results.push({
          name: m[1],
          kind: 'enum',
          lineNumber: lineNum,
          signature: trimSig(trimmed),
          parentName: null,
          exported: false,
        });
        continue;
      }

      m = trimmed.match(/^(?:const|let|var)\s+(\w+)\s*(?::|=)/);
      if (m && classDepth === 0) {
        results.push({
          name: m[1],
          kind: 'variable',
          lineNumber: lineNum,
          signature: trimSig(trimmed),
          parentName: null,
          exported: false,
        });
        continue;
      }
    }

    // Class methods (indented, inside class)
    if (currentClass && classDepth > 0) {
      m = /^(\s{2,})(?:public|private|protected|readonly|static|async|\s)*?(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::|\{|;)/.exec(line);
      if (m && m[2] && !['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(m[2])) {
        results.push({
          name: m[2],
          kind: 'method',
          lineNumber: lineNum,
          signature: trimSig(trimmed),
          parentName: currentClass,
          exported: false,
        });
      }
    }
  }

  return dedupeSymbols(results);
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
