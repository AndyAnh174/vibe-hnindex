import { describe, it, expect } from 'vitest';
import { parseImports, parseExports, resolveImportPath } from '../src/services/dependency-parser.js';

describe('parseImports', () => {
  describe('TypeScript/JavaScript', () => {
    it('parses named imports', () => {
      const code = `import { foo, bar } from './utils';`;
      const result = parseImports(code, 'typescript');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        specifier: './utils',
        specifiers: ['foo', 'bar'],
        importType: 'static',
      });
    });

    it('parses default imports', () => {
      const code = `import React from 'react';`;
      const result = parseImports(code, 'javascript');
      expect(result).toHaveLength(1);
      expect(result[0].specifier).toBe('react');
      expect(result[0].specifiers).toEqual(['default']);
    });

    it('parses star imports', () => {
      const code = `import * as path from 'node:path';`;
      const result = parseImports(code, 'typescript');
      expect(result).toHaveLength(1);
      expect(result[0].specifier).toBe('node:path');
      expect(result[0].specifiers).toBeNull();
    });

    it('parses type-only imports', () => {
      const code = `import type { Config } from './config';`;
      const result = parseImports(code, 'typescript');
      expect(result).toHaveLength(1);
      expect(result[0].importType).toBe('type-only');
      expect(result[0].specifiers).toEqual(['Config']);
    });

    it('parses require', () => {
      const code = `const fs = require('node:fs');`;
      const result = parseImports(code, 'javascript');
      expect(result).toHaveLength(1);
      expect(result[0].importType).toBe('require');
    });

    it('parses side-effect imports', () => {
      const code = `import './polyfill';`;
      const result = parseImports(code, 'typescript');
      expect(result).toHaveLength(1);
      expect(result[0].specifier).toBe('./polyfill');
      expect(result[0].specifiers).toBeNull();
    });

    it('parses multiple imports', () => {
      const code = `
import { a } from './a';
import { b } from './b';
import type { C } from './c';
`;
      const result = parseImports(code, 'typescript');
      expect(result).toHaveLength(3);
    });

    it('handles aliased imports', () => {
      const code = `import { foo as bar, baz } from './utils';`;
      const result = parseImports(code, 'typescript');
      expect(result[0].specifiers).toEqual(['foo', 'baz']);
    });
  });

  describe('Python', () => {
    it('parses simple import', () => {
      const code = `import os`;
      const result = parseImports(code, 'python');
      expect(result).toHaveLength(1);
      expect(result[0].specifier).toBe('os');
    });

    it('parses from import', () => {
      const code = `from flask import Flask, jsonify`;
      const result = parseImports(code, 'python');
      expect(result).toHaveLength(1);
      expect(result[0].specifier).toBe('flask');
      expect(result[0].specifiers).toEqual(['Flask', 'jsonify']);
    });

    it('parses dotted module', () => {
      const code = `from os.path import join`;
      const result = parseImports(code, 'python');
      expect(result[0].specifier).toBe('os.path');
    });
  });

  describe('Go', () => {
    it('parses single import', () => {
      const code = `import "fmt"`;
      const result = parseImports(code, 'go');
      expect(result).toHaveLength(1);
      expect(result[0].specifier).toBe('fmt');
    });

    it('parses import block', () => {
      const code = `
import (
  "fmt"
  "net/http"
  "github.com/gin-gonic/gin"
)`;
      const result = parseImports(code, 'go');
      expect(result).toHaveLength(3);
    });
  });

  describe('Rust', () => {
    it('parses use statement', () => {
      const code = `use std::io::Read;`;
      const result = parseImports(code, 'rust');
      expect(result).toHaveLength(1);
      expect(result[0].specifier).toBe('std::io::Read');
    });

    it('parses use with braces', () => {
      const code = `use std::io::{Read, Write};`;
      const result = parseImports(code, 'rust');
      expect(result).toHaveLength(1);
      expect(result[0].specifiers).toEqual(['Read', 'Write']);
    });

    it('parses mod declaration', () => {
      const code = `mod utils;`;
      const result = parseImports(code, 'rust');
      expect(result).toHaveLength(1);
      expect(result[0].specifier).toBe('utils');
    });
  });

  describe('Java', () => {
    it('parses import statement', () => {
      const code = `import java.util.List;`;
      const result = parseImports(code, 'java');
      expect(result).toHaveLength(1);
      expect(result[0].specifier).toBe('java.util.List');
    });

    it('parses wildcard import', () => {
      const code = `import java.util.*;`;
      const result = parseImports(code, 'java');
      expect(result[0].specifier).toBe('java.util.*');
    });
  });

  it('returns empty for unsupported languages', () => {
    const result = parseImports('some code', 'markdown');
    expect(result).toEqual([]);
  });
});

describe('parseExports', () => {
  describe('TypeScript/JavaScript', () => {
    it('parses exported functions', () => {
      const code = `export function hello() {}`;
      const result = parseExports(code, 'typescript');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: 'hello', exportType: 'function', lineNumber: 1 });
    });

    it('parses async exported functions', () => {
      const code = `export async function fetchData() {}`;
      const result = parseExports(code, 'typescript');
      expect(result[0].name).toBe('fetchData');
      expect(result[0].exportType).toBe('function');
    });

    it('parses exported classes', () => {
      const code = `export class MyService {}`;
      const result = parseExports(code, 'typescript');
      expect(result[0]).toEqual({ name: 'MyService', exportType: 'class', lineNumber: 1 });
    });

    it('parses exported consts', () => {
      const code = `export const MAX_SIZE = 100;`;
      const result = parseExports(code, 'typescript');
      expect(result[0].exportType).toBe('variable');
    });

    it('parses exported types and interfaces', () => {
      const code = `
export type Config = { url: string };
export interface Handler { handle(): void }
`;
      const result = parseExports(code, 'typescript');
      expect(result).toHaveLength(2);
      expect(result[0].exportType).toBe('type');
      expect(result[1].exportType).toBe('interface');
    });

    it('parses export default', () => {
      const code = `export default class App {}`;
      const result = parseExports(code, 'typescript');
      expect(result[0]).toEqual({ name: 'default', exportType: 'default', lineNumber: 1 });
    });

    it('parses exported enums', () => {
      const code = `export enum Color { Red, Green }`;
      const result = parseExports(code, 'typescript');
      expect(result[0].exportType).toBe('enum');
    });

    it('tracks line numbers correctly', () => {
      const code = `
// comment
export function a() {}

export function b() {}
`;
      const result = parseExports(code, 'typescript');
      expect(result[0].lineNumber).toBe(3);
      expect(result[1].lineNumber).toBe(5);
    });
  });

  describe('Python', () => {
    it('parses top-level functions', () => {
      const code = `def hello():\n    pass`;
      const result = parseExports(code, 'python');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('hello');
    });

    it('parses top-level classes', () => {
      const code = `class MyClass:\n    pass`;
      const result = parseExports(code, 'python');
      expect(result[0].exportType).toBe('class');
    });

    it('skips private functions', () => {
      const code = `def _internal():\n    pass`;
      const result = parseExports(code, 'python');
      expect(result).toHaveLength(0);
    });

    it('skips indented functions', () => {
      const code = `class Foo:\n    def method(self):\n        pass`;
      const result = parseExports(code, 'python');
      expect(result).toHaveLength(1); // only Foo, not method
      expect(result[0].name).toBe('Foo');
    });
  });

  describe('Go', () => {
    it('parses exported (capitalized) functions', () => {
      const code = `func HandleRequest() {}`;
      const result = parseExports(code, 'go');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('HandleRequest');
    });

    it('skips unexported functions', () => {
      const code = `func handleRequest() {}`;
      const result = parseExports(code, 'go');
      expect(result).toHaveLength(0);
    });

    it('parses exported types', () => {
      const code = `type Server struct {}`;
      const result = parseExports(code, 'go');
      expect(result[0].exportType).toBe('type');
    });
  });

  describe('Rust', () => {
    it('parses pub fn', () => {
      const code = `pub fn serve() {}`;
      const result = parseExports(code, 'rust');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('serve');
    });

    it('parses pub struct', () => {
      const code = `pub struct Config {}`;
      const result = parseExports(code, 'rust');
      expect(result[0].exportType).toBe('class');
    });

    it('parses pub trait', () => {
      const code = `pub trait Handler {}`;
      const result = parseExports(code, 'rust');
      expect(result[0].exportType).toBe('interface');
    });

    it('parses pub async fn', () => {
      const code = `pub async fn fetch() {}`;
      const result = parseExports(code, 'rust');
      expect(result[0].name).toBe('fetch');
    });
  });
});

describe('resolveImportPath', () => {
  const projectFiles = [
    'src/index.ts',
    'src/config.ts',
    'src/utils.ts',
    'src/services/sqlite.ts',
    'src/services/index.ts',
    'src/types.ts',
  ];

  it('resolves relative path with extension', () => {
    const result = resolveImportPath('./config', 'src/index.ts', projectFiles);
    expect(result).toBe('src/config.ts');
  });

  it('resolves .js extension to .ts', () => {
    const result = resolveImportPath('./config.js', 'src/index.ts', projectFiles);
    expect(result).toBe('src/config.ts');
  });

  it('resolves nested relative path', () => {
    const result = resolveImportPath('./services/sqlite', 'src/index.ts', projectFiles);
    expect(result).toBe('src/services/sqlite.ts');
  });

  it('resolves parent directory path', () => {
    const result = resolveImportPath('../config', 'src/services/sqlite.ts', projectFiles);
    expect(result).toBe('src/config.ts');
  });

  it('resolves index file', () => {
    const result = resolveImportPath('./services', 'src/index.ts', projectFiles);
    expect(result).toBe('src/services/index.ts');
  });

  it('returns null for external packages', () => {
    const result = resolveImportPath('react', 'src/index.ts', projectFiles);
    expect(result).toBeNull();
  });

  it('returns null for unresolvable path', () => {
    const result = resolveImportPath('./nonexistent', 'src/index.ts', projectFiles);
    expect(result).toBeNull();
  });
});
