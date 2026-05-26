export interface ChunkRecord {
  id: string;
  projectName: string;
  filePath: string;       // relative to project root
  absolutePath: string;
  chunkIndex: number;
  startLine: number;
  endLine: number;
  content: string;
  language: string;
  fileHash: string;       // SHA-256 of full file content
  indexedAt: string;       // ISO timestamp
}

export interface SearchResult {
  id: string;
  filePath: string;
  absolutePath: string;
  chunkIndex: number;
  startLine: number;
  endLine: number;
  content: string;
  language: string;
  score: number;
  matchType: 'keyword' | 'semantic' | 'hybrid' | 'symbol' | 'regex';
}

export interface ProjectInfo {
  projectName: string;
  rootPath: string;
  fileCount: number;
  chunkCount: number;
  lastIndexedAt: string;
  /** Git `HEAD` at last successful index (full or incremental); null if not a git repo or unknown. */
  indexedGitHead: string | null;
}

export interface FileEntry {
  absolutePath: string;
  relativePath: string;
  content: string;
  language: string;
}

export interface Chunk {
  content: string;
  startLine: number;
  endLine: number;
  chunkIndex: number;
}

export interface DependencyRecord {
  id: string;
  projectName: string;
  sourceFile: string;
  targetFile: string;
  importSpecifiers: string[] | null;
  importType: 'static' | 'dynamic' | 'require' | 'type-only';
  language: string;
}

export interface ExportRecord {
  id: string;
  projectName: string;
  filePath: string;
  exportName: string;
  exportType: 'function' | 'class' | 'variable' | 'type' | 'interface' | 'enum' | 'default';
  lineNumber: number;
  language: string;
}

export type SymbolKind =
  | 'class'
  | 'function'
  | 'interface'
  | 'type'
  | 'enum'
  | 'variable'
  | 'method'
  | 'namespace';

export interface SymbolRecord {
  id: string;
  projectName: string;
  filePath: string;
  name: string;
  kind: SymbolKind;
  lineNumber: number;
  signature: string | null;
  parentName: string | null;
  exported: boolean;
  language: string;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
  files: string[];
}
