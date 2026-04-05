import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import type { ChunkRecord, ProjectInfo, SearchResult } from '../types.js';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function initDatabase(): void {
  fs.mkdirSync(config.storagePath, { recursive: true });
  db = new Database(config.sqlitePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      project_name TEXT PRIMARY KEY,
      root_path TEXT NOT NULL,
      file_count INTEGER DEFAULT 0,
      chunk_count INTEGER DEFAULT 0,
      last_indexed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      project_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      absolute_path TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      content TEXT NOT NULL,
      language TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      indexed_at TEXT NOT NULL,
      UNIQUE(project_name, file_path, chunk_index)
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_project ON chunks(project_name);
    CREATE INDEX IF NOT EXISTS idx_chunks_project_file ON chunks(project_name, file_path);
    CREATE INDEX IF NOT EXISTS idx_chunks_hash ON chunks(project_name, file_path, file_hash);
  `);

  // FTS5 virtual table (content-sync with chunks)
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
      id UNINDEXED,
      project_name UNINDEXED,
      file_path,
      content,
      language UNINDEXED,
      content='chunks',
      content_rowid='rowid',
      tokenize='porter unicode61'
    );
  `);

  // Triggers to keep FTS5 in sync
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
      INSERT INTO chunks_fts(rowid, id, project_name, file_path, content, language)
      VALUES (new.rowid, new.id, new.project_name, new.file_path, new.content, new.language);
    END;

    CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
      INSERT INTO chunks_fts(chunks_fts, rowid, id, project_name, file_path, content, language)
      VALUES ('delete', old.rowid, old.id, old.project_name, old.file_path, old.content, old.language);
    END;

    CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
      INSERT INTO chunks_fts(chunks_fts, rowid, id, project_name, file_path, content, language)
      VALUES ('delete', old.rowid, old.id, old.project_name, old.file_path, old.content, old.language);
      INSERT INTO chunks_fts(rowid, id, project_name, file_path, content, language)
      VALUES (new.rowid, new.id, new.project_name, new.file_path, new.content, new.language);
    END;
  `);

  console.error('[sqlite] Database initialized at', config.sqlitePath);
}

// --- Projects ---

export function upsertProject(projectName: string, rootPath: string): void {
  getDb().prepare(`
    INSERT INTO projects (project_name, root_path, last_indexed_at)
    VALUES (?, ?, ?)
    ON CONFLICT(project_name) DO UPDATE SET
      root_path = excluded.root_path,
      last_indexed_at = excluded.last_indexed_at
  `).run(projectName, rootPath, new Date().toISOString());
}

export function updateProjectStats(projectName: string, fileCount: number, chunkCount: number): void {
  getDb().prepare(`
    UPDATE projects SET file_count = ?, chunk_count = ?, last_indexed_at = ?
    WHERE project_name = ?
  `).run(fileCount, chunkCount, new Date().toISOString(), projectName);
}

export function listProjects(): ProjectInfo[] {
  const rows = getDb().prepare(`
    SELECT project_name, root_path, file_count, chunk_count, last_indexed_at
    FROM projects ORDER BY last_indexed_at DESC
  `).all() as Array<{
    project_name: string;
    root_path: string;
    file_count: number;
    chunk_count: number;
    last_indexed_at: string;
  }>;

  return rows.map(r => ({
    projectName: r.project_name,
    rootPath: r.root_path,
    fileCount: r.file_count,
    chunkCount: r.chunk_count,
    lastIndexedAt: r.last_indexed_at,
  }));
}

export function getProject(projectName: string): ProjectInfo | null {
  const row = getDb().prepare(`
    SELECT project_name, root_path, file_count, chunk_count, last_indexed_at
    FROM projects WHERE project_name = ?
  `).get(projectName) as {
    project_name: string;
    root_path: string;
    file_count: number;
    chunk_count: number;
    last_indexed_at: string;
  } | undefined;

  if (!row) return null;
  return {
    projectName: row.project_name,
    rootPath: row.root_path,
    fileCount: row.file_count,
    chunkCount: row.chunk_count,
    lastIndexedAt: row.last_indexed_at,
  };
}

// --- Chunks ---

export function insertChunks(chunks: ChunkRecord[]): void {
  if (chunks.length === 0) return;

  const insert = getDb().prepare(`
    INSERT OR REPLACE INTO chunks (id, project_name, file_path, absolute_path, chunk_index, start_line, end_line, content, language, file_hash, indexed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = getDb().transaction((items: ChunkRecord[]) => {
    for (const c of items) {
      insert.run(c.id, c.projectName, c.filePath, c.absolutePath, c.chunkIndex, c.startLine, c.endLine, c.content, c.language, c.fileHash, c.indexedAt);
    }
  });

  transaction(chunks);
}

export function deleteFileChunks(projectName: string, filePath: string): string[] {
  const rows = getDb().prepare(`
    SELECT id FROM chunks WHERE project_name = ? AND file_path = ?
  `).all(projectName, filePath) as Array<{ id: string }>;

  if (rows.length > 0) {
    getDb().prepare(`
      DELETE FROM chunks WHERE project_name = ? AND file_path = ?
    `).run(projectName, filePath);
  }

  return rows.map(r => r.id);
}

export function deleteProject(projectName: string): void {
  const d = getDb();
  d.prepare('DELETE FROM chunks WHERE project_name = ?').run(projectName);
  d.prepare('DELETE FROM projects WHERE project_name = ?').run(projectName);
}

export function getExistingFileHash(projectName: string, filePath: string): string | null {
  const row = getDb().prepare(`
    SELECT file_hash FROM chunks WHERE project_name = ? AND file_path = ? LIMIT 1
  `).get(projectName, filePath) as { file_hash: string } | undefined;

  return row?.file_hash ?? null;
}

// --- Search ---

export function searchKeyword(query: string, projectName: string, limit: number): SearchResult[] {
  // Escape FTS5 special characters for safe querying
  const safeQuery = query.replace(/['"]/g, ' ').trim();
  if (!safeQuery) return [];

  const rows = getDb().prepare(`
    SELECT c.id, c.file_path, c.absolute_path, c.chunk_index, c.start_line, c.end_line,
           c.content, c.language, rank
    FROM chunks_fts
    JOIN chunks c ON chunks_fts.rowid = c.rowid
    WHERE chunks_fts MATCH ? AND c.project_name = ?
    ORDER BY rank
    LIMIT ?
  `).all(safeQuery, projectName, limit) as Array<{
    id: string;
    file_path: string;
    absolute_path: string;
    chunk_index: number;
    start_line: number;
    end_line: number;
    content: string;
    language: string;
    rank: number;
  }>;

  return rows.map(r => ({
    id: r.id,
    filePath: r.file_path,
    absolutePath: r.absolute_path,
    chunkIndex: r.chunk_index,
    startLine: r.start_line,
    endLine: r.end_line,
    content: r.content,
    language: r.language,
    score: -r.rank, // FTS5 rank is negative, closer to 0 = better
    matchType: 'keyword' as const,
  }));
}

export function getChunksByIds(ids: string[]): SearchResult[] {
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => '?').join(',');
  const rows = getDb().prepare(`
    SELECT id, file_path, absolute_path, chunk_index, start_line, end_line,
           content, language
    FROM chunks WHERE id IN (${placeholders})
  `).all(...ids) as Array<{
    id: string;
    file_path: string;
    absolute_path: string;
    chunk_index: number;
    start_line: number;
    end_line: number;
    content: string;
    language: string;
  }>;

  return rows.map(r => ({
    id: r.id,
    filePath: r.file_path,
    absolutePath: r.absolute_path,
    chunkIndex: r.chunk_index,
    startLine: r.start_line,
    endLine: r.end_line,
    content: r.content,
    language: r.language,
    score: 0,
    matchType: 'semantic' as const,
  }));
}

export function getFileChunks(projectName: string, filePath: string): SearchResult[] {
  const rows = getDb().prepare(`
    SELECT id, file_path, absolute_path, chunk_index, start_line, end_line,
           content, language
    FROM chunks WHERE project_name = ? AND file_path = ?
    ORDER BY chunk_index
  `).all(projectName, filePath) as Array<{
    id: string;
    file_path: string;
    absolute_path: string;
    chunk_index: number;
    start_line: number;
    end_line: number;
    content: string;
    language: string;
  }>;

  return rows.map(r => ({
    id: r.id,
    filePath: r.file_path,
    absolutePath: r.absolute_path,
    chunkIndex: r.chunk_index,
    startLine: r.start_line,
    endLine: r.end_line,
    content: r.content,
    language: r.language,
    score: 0,
    matchType: 'keyword' as const,
  }));
}

export function getProjectChunkCount(projectName: string): number {
  const row = getDb().prepare(
    'SELECT COUNT(*) as cnt FROM chunks WHERE project_name = ?'
  ).get(projectName) as { cnt: number };
  return row.cnt;
}

export function getProjectFileCount(projectName: string): number {
  const row = getDb().prepare(
    'SELECT COUNT(DISTINCT file_path) as cnt FROM chunks WHERE project_name = ?'
  ).get(projectName) as { cnt: number };
  return row.cnt;
}
