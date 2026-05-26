import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import type { FileEntry } from '../types.js';
import { isIgnored, loadHnindexIgnore } from './hnindex-ignore.js';

const SKIP_DIRECTORIES = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  '__pycache__', '.venv', 'venv', 'env',
  'target',       // Rust/Java
  'vendor',       // Go/PHP
  'coverage', '.nyc_output',
  '.cache', '.parcel-cache',
  '.idea', '.vscode', '.vs',
  'bin', 'obj',   // C#
  '.svn', '.hg',
  'bower_components',
  '.gradle', '.terraform',
  '.tox', '.mypy_cache', '.pytest_cache',
  '.eggs',
  'Pods',         // iOS
  '.dart_tool',
]);

const SKIP_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.lock',
  'poetry.lock',
  'Gemfile.lock',
  'composer.lock',
  'Pipfile.lock',
  'bun.lockb',
]);

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'tsx', '.js': 'javascript', '.jsx': 'jsx',
  '.mjs': 'javascript', '.cjs': 'javascript',
  '.py': 'python', '.pyi': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.c': 'c', '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp',
  '.h': 'c', '.hpp': 'cpp', '.hxx': 'cpp',
  '.cs': 'csharp',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin', '.kts': 'kotlin',
  '.scala': 'scala',
  '.lua': 'lua',
  '.sh': 'bash', '.bash': 'bash', '.zsh': 'zsh',
  '.sql': 'sql',
  '.r': 'r', '.R': 'r',
  '.vue': 'vue', '.svelte': 'svelte',
  '.html': 'html', '.htm': 'html',
  '.css': 'css', '.scss': 'scss', '.less': 'less', '.sass': 'sass',
  '.yaml': 'yaml', '.yml': 'yaml',
  '.toml': 'toml',
  '.json': 'json',
  '.xml': 'xml',
  '.md': 'markdown', '.mdx': 'mdx',
  '.proto': 'protobuf',
  '.graphql': 'graphql', '.gql': 'graphql',
  '.tf': 'terraform',
  '.zig': 'zig',
  '.ex': 'elixir', '.exs': 'elixir',
  '.erl': 'erlang',
  '.clj': 'clojure', '.cljs': 'clojurescript',
  '.hs': 'haskell',
  '.ml': 'ocaml', '.mli': 'ocaml',
  '.fs': 'fsharp', '.fsx': 'fsharp',
  '.dart': 'dart',
  '.v': 'v',
  '.sol': 'solidity',
  '.cmake': 'cmake',
  '.gradle': 'gradle',
};

// Special filenames without extensions
const FILENAME_LANGUAGE_MAP: Record<string, string> = {
  'Dockerfile': 'dockerfile',
  'Makefile': 'makefile',
  'Jenkinsfile': 'groovy',
  'Vagrantfile': 'ruby',
  'Rakefile': 'ruby',
  'Gemfile': 'ruby',
  'Procfile': 'yaml',
  '.env': 'env',
  '.gitignore': 'gitignore',
  '.dockerignore': 'dockerignore',
};

export function detectLanguage(filePath: string): string {
  const basename = path.basename(filePath);
  if (FILENAME_LANGUAGE_MAP[basename]) {
    return FILENAME_LANGUAGE_MAP[basename];
  }
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_LANGUAGE_MAP[ext] || 'text';
}

function isBinaryBuffer(buffer: Buffer): boolean {
  // Check first 8KB for null bytes
  const checkLength = Math.min(buffer.length, 8192);
  for (let i = 0; i < checkLength; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

function shouldIndexFile(filePath: string): boolean {
  const basename = path.basename(filePath);

  // Skip known lock files
  if (SKIP_FILES.has(basename)) return false;

  // All text-based files are accepted; we filter out binary files later in the pipeline.
  // This ensures any file format (including uncommon ones like .prisma, .env.local, .eslintrc, etc.)
  // gets indexed as long as it's valid UTF-8 text.
  return true;
}

export async function* scanDirectory(rootPath: string): AsyncGenerator<FileEntry> {
  const absoluteRoot = path.resolve(rootPath);
  const ignorePatterns = loadHnindexIgnore(absoluteRoot);

  async function* walk(dir: string): AsyncGenerator<FileEntry> {
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      console.error(`[scanner] Cannot read directory: ${dir}`);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip symlinks to prevent traversal outside project root
      if (entry.isSymbolicLink()) {
        console.error(`[scanner] Skipping symlink: ${fullPath}`);
        continue;
      }

      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue;
        if (entry.name.startsWith('.')) continue; // skip hidden dirs
        // Verify resolved path is still under project root
        let resolvedDir: string;
        try {
          resolvedDir = await fsp.realpath(fullPath);
        } catch {
          // realpath may fail on Windows (long paths, permissions, etc.)
          // Fall back to path.resolve which doesn't require the path to exist at OS level
          resolvedDir = path.resolve(fullPath);
        }
        const normalizedRoot = path.resolve(absoluteRoot).toLowerCase();
        if (!resolvedDir.toLowerCase().startsWith(normalizedRoot)) {
          console.error(`[scanner] Skipping directory outside root: ${fullPath}`);
          continue;
        }
        yield* walk(fullPath);
      } else if (entry.isFile()) {
        if (!shouldIndexFile(fullPath)) continue;

        try {
          const stat = await fsp.stat(fullPath);
          if (stat.size > config.maxFileSize) {
            console.error(`[scanner] Skipping large file (${(stat.size / 1024).toFixed(0)}KB): ${fullPath}`);
            continue;
          }
          if (stat.size === 0) continue;

          const buffer = await fsp.readFile(fullPath);
          if (isBinaryBuffer(buffer)) {
            console.error(`[scanner] Skipping binary file: ${fullPath}`);
            continue;
          }

          const content = buffer.toString('utf-8');
          const relativePath = path.relative(absoluteRoot, fullPath).replace(/\\/g, '/');
          if (isIgnored(relativePath, ignorePatterns)) continue;

          const language = detectLanguage(fullPath);

          yield { absolutePath: fullPath, relativePath, content, language };
        } catch (error) {
          console.error(`[scanner] Error reading file ${fullPath}:`, error);
        }
      }
    }
  }

  yield* walk(absoluteRoot);
}
