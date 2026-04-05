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
  matchType: 'keyword' | 'semantic' | 'hybrid';
}

export interface ProjectInfo {
  projectName: string;
  rootPath: string;
  fileCount: number;
  chunkCount: number;
  lastIndexedAt: string;
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
