import path from 'node:path';
import ts from 'typescript';
import { parseScript } from './typescript-ast.js';

export interface ParsedImport {
  specifier: string;
  specifiers: string[] | null;
  importType: 'static' | 'dynamic' | 'require' | 'type-only';
}

export interface ParsedExport {
  name: string;
  exportType: 'function' | 'class' | 'variable' | 'type' | 'interface' | 'enum' | 'default';
  lineNumber: number;
}

// --- Import Parsing ---

export function parseImports(content: string, language: string): ParsedImport[] {
  const lang = language.toLowerCase();
  switch (lang) {
    case 'typescript':
    case 'javascript':
    case 'tsx':
    case 'jsx':
      return parseTsJsImports(content);
    case 'python':
      return parsePythonImports(content);
    case 'go':
      return parseGoImports(content);
    case 'rust':
      return parseRustImports(content);
    case 'java':
    case 'kotlin':
      return parseJavaImports(content);
    default:
      return [];
  }
}

function parseTsJsImports(content: string): ParsedImport[] {
  const source = parseScript(content, 'imports.ts');
  const results: ParsedImport[] = [];
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const specifiers = bindings && ts.isNamedImports(bindings)
        ? [...(clause?.name ? ['default'] : []), ...bindings.elements.map(element => (element.propertyName ?? element.name).text)]
        : clause?.name ? ['default'] : null;
      results.push({ specifier: node.moduleSpecifier.text, specifiers,
        importType: clause?.isTypeOnly ? 'type-only' : 'static' });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      results.push({ specifier: node.moduleSpecifier.text,
        specifiers: node.exportClause && ts.isNamedExports(node.exportClause)
          ? node.exportClause.elements.map(element => (element.propertyName ?? element.name).text) : null,
        importType: node.isTypeOnly ? 'type-only' : 'static' });
    } else if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])
      && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      results.push({ specifier: node.arguments[0].text, specifiers: null,
        importType: node.expression.kind === ts.SyntaxKind.ImportKeyword ? 'dynamic' : 'require' });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return results;
}

function parsePythonImports(content: string): ParsedImport[] {
  const results: ParsedImport[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // from module import X, Y
    const fromImport = trimmed.match(/^from\s+([\w.]+)\s+import\s+(.+)/);
    if (fromImport) {
      const specs = fromImport[2].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
      results.push({ specifier: fromImport[1], specifiers: specs, importType: 'static' });
      continue;
    }

    // import module
    const simpleImport = trimmed.match(/^import\s+([\w.]+)(?:\s+as\s+\w+)?$/);
    if (simpleImport) {
      results.push({ specifier: simpleImport[1], specifiers: null, importType: 'static' });
    }
  }

  return results;
}

function parseGoImports(content: string): ParsedImport[] {
  const results: ParsedImport[] = [];

  // Single import: import "path"
  const singleImports = content.matchAll(/import\s+"([^"]+)"/g);
  for (const match of singleImports) {
    results.push({ specifier: match[1], specifiers: null, importType: 'static' });
  }

  // Multi-line import block: import ( "path1" "path2" )
  const blockMatch = content.match(/import\s*\(([\s\S]*?)\)/);
  if (blockMatch) {
    const imports = blockMatch[1].matchAll(/"([^"]+)"/g);
    for (const m of imports) {
      results.push({ specifier: m[1], specifiers: null, importType: 'static' });
    }
  }

  return results;
}

function parseRustImports(content: string): ParsedImport[] {
  const results: ParsedImport[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // use crate::module::Item;
    const useMatch = trimmed.match(/^use\s+([\w:]+)(?:::\{([^}]*)\})?;/);
    if (useMatch) {
      const specs = useMatch[2] ? useMatch[2].split(',').map(s => s.trim()).filter(Boolean) : null;
      results.push({ specifier: useMatch[1], specifiers: specs, importType: 'static' });
      continue;
    }

    // mod module_name;
    const modMatch = trimmed.match(/^(?:pub\s+)?mod\s+(\w+);/);
    if (modMatch) {
      results.push({ specifier: modMatch[1], specifiers: null, importType: 'static' });
    }
  }

  return results;
}

function parseJavaImports(content: string): ParsedImport[] {
  const results: ParsedImport[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    const importMatch = trimmed.match(/^import\s+(?:static\s+)?([\w.]+(?:\.\*)?);/);
    if (importMatch) {
      results.push({ specifier: importMatch[1], specifiers: null, importType: 'static' });
    }
  }

  return results;
}

// --- Export Parsing ---

export function parseExports(content: string, language: string): ParsedExport[] {
  const lang = language.toLowerCase();
  switch (lang) {
    case 'typescript':
    case 'javascript':
    case 'tsx':
    case 'jsx':
      return parseTsJsExports(content);
    case 'python':
      return parsePythonExports(content);
    case 'go':
      return parseGoExports(content);
    case 'rust':
      return parseRustExports(content);
    default:
      return [];
  }
}

function parseTsJsExports(content: string): ParsedExport[] {
  const source = parseScript(content, 'exports.ts');
  const results: ParsedExport[] = [];
  for (const statement of source.statements) {
    const lineNumber = source.getLineAndCharacterOfPosition(statement.getStart(source)).line + 1;
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      results.push({ name: 'default', exportType: 'default', lineNumber });
      continue;
    }
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) results.push({
        name: element.name.text, exportType: statement.isTypeOnly || element.isTypeOnly ? 'type' : 'variable', lineNumber,
      });
      continue;
    }
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    if (!modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (modifiers.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword)) {
      results.push({ name: 'default', exportType: 'default', lineNumber });
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) results.push({ name: declaration.name.text, exportType: 'variable', lineNumber });
      }
    } else {
      const exportType = ts.isFunctionDeclaration(statement) ? 'function' : ts.isClassDeclaration(statement) ? 'class'
        : ts.isTypeAliasDeclaration(statement) ? 'type' : ts.isInterfaceDeclaration(statement) ? 'interface'
        : ts.isEnumDeclaration(statement) ? 'enum' : undefined;
      if (exportType && 'name' in statement && statement.name) {
        results.push({ name: (statement.name as ts.Node).getText(source), exportType, lineNumber });
      }
    }
  }
  return results;
}

function parsePythonExports(content: string): ParsedExport[] {
  const results: ParsedExport[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Only top-level (no indentation)
    if (line.startsWith(' ') || line.startsWith('\t')) continue;

    const defMatch = line.match(/^def\s+(\w+)\s*\(/);
    if (defMatch && !defMatch[1].startsWith('_')) {
      results.push({ name: defMatch[1], exportType: 'function', lineNumber: lineNum });
      continue;
    }

    const classMatch = line.match(/^class\s+(\w+)/);
    if (classMatch && !classMatch[1].startsWith('_')) {
      results.push({ name: classMatch[1], exportType: 'class', lineNumber: lineNum });
    }
  }

  return results;
}

function parseGoExports(content: string): ParsedExport[] {
  const results: ParsedExport[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const lineNum = i + 1;

    // func FooBar(
    const funcMatch = trimmed.match(/^func\s+([A-Z]\w*)\s*\(/);
    if (funcMatch) {
      results.push({ name: funcMatch[1], exportType: 'function', lineNumber: lineNum });
      continue;
    }

    // type FooBar struct/interface
    const typeMatch = trimmed.match(/^type\s+([A-Z]\w*)\s+/);
    if (typeMatch) {
      results.push({ name: typeMatch[1], exportType: 'type', lineNumber: lineNum });
      continue;
    }

    // var/const FooBar
    const varMatch = trimmed.match(/^(?:var|const)\s+([A-Z]\w*)/);
    if (varMatch) {
      results.push({ name: varMatch[1], exportType: 'variable', lineNumber: lineNum });
    }
  }

  return results;
}

function parseRustExports(content: string): ParsedExport[] {
  const results: ParsedExport[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const lineNum = i + 1;

    const pubFn = trimmed.match(/^pub\s+(?:async\s+)?fn\s+(\w+)/);
    if (pubFn) {
      results.push({ name: pubFn[1], exportType: 'function', lineNumber: lineNum });
      continue;
    }

    const pubStruct = trimmed.match(/^pub\s+struct\s+(\w+)/);
    if (pubStruct) {
      results.push({ name: pubStruct[1], exportType: 'class', lineNumber: lineNum });
      continue;
    }

    const pubEnum = trimmed.match(/^pub\s+enum\s+(\w+)/);
    if (pubEnum) {
      results.push({ name: pubEnum[1], exportType: 'enum', lineNumber: lineNum });
      continue;
    }

    const pubTrait = trimmed.match(/^pub\s+trait\s+(\w+)/);
    if (pubTrait) {
      results.push({ name: pubTrait[1], exportType: 'interface', lineNumber: lineNum });
    }
  }

  return results;
}

// --- Import Path Resolution ---

const TS_JS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

export function resolveImportPath(
  specifier: string,
  sourceFile: string,
  projectFiles: string[]
): string | null {
  // Skip external packages (no ./ or ../ prefix)
  if (!specifier.startsWith('.')) return null;

  const sourceDir = path.dirname(sourceFile);
  const rawResolved = path.posix.join(
    sourceDir.replace(/\\/g, '/'),
    specifier.replace(/\\/g, '/')
  );

  // Normalize to forward slashes
  const normalized = rawResolved.replace(/\\/g, '/');

  // Remove .js extension for TS projects (import './foo.js' → look for foo.ts)
  const withoutJsExt = normalized.replace(/\.js$/, '');

  const fileSet = new Set(projectFiles.map(f => f.replace(/\\/g, '/')));

  // Try exact match first
  if (fileSet.has(normalized)) return normalized;

  // Try without .js extension
  if (withoutJsExt !== normalized && fileSet.has(withoutJsExt)) return withoutJsExt;

  // Try adding extensions
  for (const ext of TS_JS_EXTENSIONS) {
    if (fileSet.has(withoutJsExt + ext)) return withoutJsExt + ext;
    if (fileSet.has(normalized + ext)) return normalized + ext;
  }

  // Try index files
  for (const ext of TS_JS_EXTENSIONS) {
    const indexPath = normalized + '/index' + ext;
    if (fileSet.has(indexPath)) return indexPath;
    const indexPath2 = withoutJsExt + '/index' + ext;
    if (fileSet.has(indexPath2)) return indexPath2;
  }

  return null;
}
