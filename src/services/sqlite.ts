import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import type { ChunkRecord, DependencyRecord, ExportRecord, ProjectInfo, SearchResult } from '../types.js';
import { normalizeKeywordQuery } from './keyword-query.js';

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

  // --- Dependency graph tables ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS dependencies (
      id TEXT PRIMARY KEY,
      project_name TEXT NOT NULL,
      source_file TEXT NOT NULL,
      target_file TEXT NOT NULL,
      import_specifiers TEXT,
      import_type TEXT NOT NULL,
      language TEXT NOT NULL,
      UNIQUE(project_name, source_file, target_file, import_type)
    );

    CREATE INDEX IF NOT EXISTS idx_deps_source ON dependencies(project_name, source_file);
    CREATE INDEX IF NOT EXISTS idx_deps_target ON dependencies(project_name, target_file);

    CREATE TABLE IF NOT EXISTS exports (
      id TEXT PRIMARY KEY,
      project_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      export_name TEXT NOT NULL,
      export_type TEXT NOT NULL,
      line_number INTEGER NOT NULL,
      language TEXT NOT NULL,
      UNIQUE(project_name, file_path, export_name)
    );

    CREATE INDEX IF NOT EXISTS idx_exports_file ON exports(project_name, file_path);
    CREATE INDEX IF NOT EXISTS idx_exports_name ON exports(project_name, export_name);
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

/** Mitigate rare WAL/connection races right after indexing. */
export async function getProjectWithRetry(
  projectName: string,
  opts: { retries: number; delayMs: number } = { retries: 4, delayMs: 25 }
): Promise<ProjectInfo | null> {
  for (let i = 0; i < opts.retries; i++) {
    const p = getProject(projectName);
    if (p) return p;
    if (i < opts.retries - 1) {
      await new Promise((r) => setTimeout(r, opts.delayMs));
    }
  }
  return null;
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
  d.prepare('DELETE FROM dependencies WHERE project_name = ?').run(projectName);
  d.prepare('DELETE FROM exports WHERE project_name = ?').run(projectName);
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

export function searchKeyword(
  query: string,
  projectName: string,
  limit: number,
  filters?: { language?: string; file_pattern?: string },
  options?: { ftsExpression?: string }
): SearchResult[] {
  const safeQuery = options?.ftsExpression ?? normalizeKeywordQuery(query);
  if (!safeQuery) return [];

  let sql = `
    SELECT c.id, c.file_path, c.absolute_path, c.chunk_index, c.start_line, c.end_line,
           c.content, c.language, rank
    FROM chunks_fts
    JOIN chunks c ON chunks_fts.rowid = c.rowid
    WHERE chunks_fts MATCH ? AND c.project_name = ?
  `;
  const params: unknown[] = [safeQuery, projectName];

  if (filters?.language) {
    sql += ` AND c.language = ?`;
    params.push(filters.language.toLowerCase());
  }
  if (filters?.file_pattern) {
    sql += ` AND c.file_path GLOB ?`;
    params.push(filters.file_pattern);
  }

  sql += ` ORDER BY rank LIMIT ?`;
  params.push(limit);

  const rows = getDb().prepare(sql).all(...params) as Array<{
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

export function getProjectStats(projectName: string): {
  languages: Array<{ language: string; fileCount: number; chunkCount: number }>;
  totalFiles: number;
  totalChunks: number;
  totalLines: number;
  avgChunksPerFile: number;
} {
  const langRows = getDb().prepare(`
    SELECT language,
           COUNT(DISTINCT file_path) as file_count,
           COUNT(*) as chunk_count
    FROM chunks WHERE project_name = ?
    GROUP BY language ORDER BY chunk_count DESC
  `).all(projectName) as Array<{ language: string; file_count: number; chunk_count: number }>;

  const lineRow = getDb().prepare(`
    SELECT COALESCE(SUM(end_line), 0) as total_lines,
           COUNT(*) as total_chunks,
           COUNT(DISTINCT file_path) as total_files
    FROM chunks WHERE project_name = ?
  `).get(projectName) as { total_lines: number; total_chunks: number; total_files: number };

  return {
    languages: langRows.map(r => ({
      language: r.language,
      fileCount: r.file_count,
      chunkCount: r.chunk_count,
    })),
    totalFiles: lineRow.total_files,
    totalChunks: lineRow.total_chunks,
    totalLines: lineRow.total_lines,
    avgChunksPerFile: lineRow.total_files > 0
      ? Math.round((lineRow.total_chunks / lineRow.total_files) * 10) / 10
      : 0,
  };
}

// --- Context expansion: get surrounding chunks ---

export function getAdjacentChunks(
  projectName: string,
  filePath: string,
  chunkIndex: number,
  expandBefore: number,
  expandAfter: number
): SearchResult[] {
  const minIndex = Math.max(0, chunkIndex - expandBefore);
  const maxIndex = chunkIndex + expandAfter;

  const rows = getDb().prepare(`
    SELECT id, file_path, absolute_path, chunk_index, start_line, end_line,
           content, language
    FROM chunks
    WHERE project_name = ? AND file_path = ? AND chunk_index BETWEEN ? AND ?
    ORDER BY chunk_index
  `).all(projectName, filePath, minIndex, maxIndex) as Array<{
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

export function getProjectFileCount(projectName: string): number {
  const row = getDb().prepare(
    'SELECT COUNT(DISTINCT file_path) as cnt FROM chunks WHERE project_name = ?'
  ).get(projectName) as { cnt: number };
  return row.cnt;
}

// --- Dependencies ---

export function insertDependencies(deps: DependencyRecord[]): void {
  if (deps.length === 0) return;

  const insert = getDb().prepare(`
    INSERT OR REPLACE INTO dependencies (id, project_name, source_file, target_file, import_specifiers, import_type, language)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = getDb().transaction((items: DependencyRecord[]) => {
    for (const d of items) {
      insert.run(d.id, d.projectName, d.sourceFile, d.targetFile,
        d.importSpecifiers ? JSON.stringify(d.importSpecifiers) : null,
        d.importType, d.language);
    }
  });

  transaction(deps);
}

export function deleteFileDependencies(projectName: string, filePath: string): void {
  getDb().prepare('DELETE FROM dependencies WHERE project_name = ? AND source_file = ?')
    .run(projectName, filePath);
}

export function getDependencies(projectName: string, filePath: string): DependencyRecord[] {
  const rows = getDb().prepare(`
    SELECT id, project_name, source_file, target_file, import_specifiers, import_type, language
    FROM dependencies WHERE project_name = ? AND source_file = ?
  `).all(projectName, filePath) as Array<{
    id: string; project_name: string; source_file: string; target_file: string;
    import_specifiers: string | null; import_type: string; language: string;
  }>;

  return rows.map(r => ({
    id: r.id,
    projectName: r.project_name,
    sourceFile: r.source_file,
    targetFile: r.target_file,
    importSpecifiers: r.import_specifiers ? JSON.parse(r.import_specifiers) : null,
    importType: r.import_type as DependencyRecord['importType'],
    language: r.language,
  }));
}

export function getDependents(projectName: string, filePath: string): DependencyRecord[] {
  const rows = getDb().prepare(`
    SELECT id, project_name, source_file, target_file, import_specifiers, import_type, language
    FROM dependencies WHERE project_name = ? AND target_file = ?
  `).all(projectName, filePath) as Array<{
    id: string; project_name: string; source_file: string; target_file: string;
    import_specifiers: string | null; import_type: string; language: string;
  }>;

  return rows.map(r => ({
    id: r.id,
    projectName: r.project_name,
    sourceFile: r.source_file,
    targetFile: r.target_file,
    importSpecifiers: r.import_specifiers ? JSON.parse(r.import_specifiers) : null,
    importType: r.import_type as DependencyRecord['importType'],
    language: r.language,
  }));
}

// --- Exports ---

export function insertExports(records: ExportRecord[]): void {
  if (records.length === 0) return;

  const insert = getDb().prepare(`
    INSERT OR REPLACE INTO exports (id, project_name, file_path, export_name, export_type, line_number, language)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = getDb().transaction((items: ExportRecord[]) => {
    for (const e of items) {
      insert.run(e.id, e.projectName, e.filePath, e.exportName, e.exportType, e.lineNumber, e.language);
    }
  });

  transaction(records);
}

export function deleteFileExports(projectName: string, filePath: string): void {
  getDb().prepare('DELETE FROM exports WHERE project_name = ? AND file_path = ?')
    .run(projectName, filePath);
}

export function getExportsByFile(projectName: string, filePath: string): ExportRecord[] {
  const rows = getDb().prepare(`
    SELECT id, project_name, file_path, export_name, export_type, line_number, language
    FROM exports WHERE project_name = ? AND file_path = ?
    ORDER BY line_number
  `).all(projectName, filePath) as Array<{
    id: string; project_name: string; file_path: string; export_name: string;
    export_type: string; line_number: number; language: string;
  }>;

  return rows.map(r => ({
    id: r.id,
    projectName: r.project_name,
    filePath: r.file_path,
    exportName: r.export_name,
    exportType: r.export_type as ExportRecord['exportType'],
    lineNumber: r.line_number,
    language: r.language,
  }));
}

export function getExportsByProject(projectName: string, limit = 50): ExportRecord[] {
  const rows = getDb().prepare(`
    SELECT id, project_name, file_path, export_name, export_type, line_number, language
    FROM exports WHERE project_name = ?
    ORDER BY file_path, line_number
    LIMIT ?
  `).all(projectName, limit) as Array<{
    id: string; project_name: string; file_path: string; export_name: string;
    export_type: string; line_number: number; language: string;
  }>;

  return rows.map(r => ({
    id: r.id,
    projectName: r.project_name,
    filePath: r.file_path,
    exportName: r.export_name,
    exportType: r.export_type as ExportRecord['exportType'],
    lineNumber: r.line_number,
    language: r.language,
  }));
}

// --- Utility ---

export function getAllProjectFiles(projectName: string): string[] {
  const rows = getDb().prepare(
    'SELECT DISTINCT file_path FROM chunks WHERE project_name = ? ORDER BY file_path'
  ).all(projectName) as Array<{ file_path: string }>;
  return rows.map(r => r.file_path);
}
