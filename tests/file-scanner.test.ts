import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../src/services/file-scanner.js';

describe('file-scanner', () => {
  describe('detectLanguage', () => {
    it('should detect TypeScript files', () => {
      expect(detectLanguage('src/index.ts')).toBe('typescript');
      expect(detectLanguage('components/App.tsx')).toBe('tsx');
    });

    it('should detect JavaScript files', () => {
      expect(detectLanguage('main.js')).toBe('javascript');
      expect(detectLanguage('App.jsx')).toBe('jsx');
      expect(detectLanguage('config.mjs')).toBe('javascript');
    });

    it('should detect Python files', () => {
      expect(detectLanguage('app.py')).toBe('python');
      expect(detectLanguage('types.pyi')).toBe('python');
    });

    it('should detect Go files', () => {
      expect(detectLanguage('main.go')).toBe('go');
    });

    it('should detect Rust files', () => {
      expect(detectLanguage('lib.rs')).toBe('rust');
    });

    it('should detect special filenames', () => {
      expect(detectLanguage('Dockerfile')).toBe('dockerfile');
      expect(detectLanguage('Makefile')).toBe('makefile');
      expect(detectLanguage('Jenkinsfile')).toBe('groovy');
    });

    it('should return "text" for unknown extensions', () => {
      expect(detectLanguage('data.xyz')).toBe('text');
      expect(detectLanguage('README')).toBe('text');
    });

    it('should handle case-insensitive extensions', () => {
      expect(detectLanguage('style.CSS')).toBe('css');
      expect(detectLanguage('app.Py')).toBe('python');
    });

    it('should detect all major languages', () => {
      const cases: [string, string][] = [
        ['app.java', 'java'],
        ['lib.cs', 'csharp'],
        ['app.rb', 'ruby'],
        ['index.php', 'php'],
        ['app.swift', 'swift'],
        ['app.kt', 'kotlin'],
        ['app.scala', 'scala'],
        ['script.lua', 'lua'],
        ['deploy.sh', 'bash'],
        ['query.sql', 'sql'],
        ['App.vue', 'vue'],
        ['App.svelte', 'svelte'],
        ['page.html', 'html'],
        ['style.scss', 'scss'],
        ['config.yaml', 'yaml'],
        ['config.toml', 'toml'],
        ['data.json', 'json'],
        ['schema.graphql', 'graphql'],
        ['main.zig', 'zig'],
        ['app.ex', 'elixir'],
        ['app.dart', 'dart'],
        ['Token.sol', 'solidity'],
      ];

      for (const [file, expected] of cases) {
        expect(detectLanguage(file), `${file} → ${expected}`).toBe(expected);
      }
    });
  });
});
