import { getProject, getFileChunks, getDependencies, getDependents, getExportsByFile } from '../services/sqlite.js';

export async function fileSummaryTool(args: {
  project_name: string;
  file_path: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const project = getProject(args.project_name);
  if (!project) {
    return {
      content: [{ type: 'text', text: `Error: Project "${args.project_name}" not found. Run index_codebase first.` }],
    };
  }

  const chunks = getFileChunks(args.project_name, args.file_path);
  if (chunks.length === 0) {
    return {
      content: [{ type: 'text', text: `Error: File "${args.file_path}" not found in project "${args.project_name}".` }],
    };
  }

  const language = chunks[0].language;
  const lastLine = Math.max(...chunks.map(c => c.endLine));
  const exports = getExportsByFile(args.project_name, args.file_path);
  const deps = getDependencies(args.project_name, args.file_path);
  const dependents = getDependents(args.project_name, args.file_path);

  // Infer purpose from path and content
  const purpose = inferPurpose(args.file_path, language, exports);

  // Exports table
  let exportsSection: string;
  if (exports.length > 0) {
    const rows = exports.map(e =>
      `| ${e.exportName} | ${e.exportType} | ${e.lineNumber} |`
    ).join('\n');
    exportsSection = [
      '| Name | Type | Line |',
      '|------|------|------|',
      rows,
    ].join('\n');
  } else {
    exportsSection = '_No exports detected_';
  }

  // Imports list
  let importsSection: string;
  if (deps.length > 0) {
    importsSection = deps.map(d => {
      const specs = d.importSpecifiers ? ` (${d.importSpecifiers.join(', ')})` : '';
      const typeTag = d.importType !== 'static' ? ` [${d.importType}]` : '';
      return `- ${d.targetFile}${specs}${typeTag}`;
    }).join('\n');
  } else {
    importsSection = '_No imports detected_';
  }

  // Dependents list
  let dependentsSection: string;
  if (dependents.length > 0) {
    dependentsSection = dependents.map(d => `- ${d.sourceFile}`).join('\n');
  } else {
    dependentsSection = '_No files depend on this file_';
  }

  // Complexity
  const complexity = getComplexity(exports.length, deps.length, lastLine, chunks.length);

  const text = [
    `## File: ${args.file_path}`,
    `**Language:** ${language} | **Lines:** 1-${lastLine} | **Chunks:** ${chunks.length}`,
    '',
    `### Purpose`,
    purpose,
    '',
    `### Exports (${exports.length})`,
    exportsSection,
    '',
    `### Imports (${deps.length})`,
    importsSection,
    '',
    `### Depended on by (${dependents.length} files)`,
    dependentsSection,
    '',
    `### Complexity: ${complexity}`,
    `- ${exports.length} exports, ${deps.length} imports, ${lastLine} lines, ${chunks.length} chunks`,
  ].join('\n');

  return { content: [{ type: 'text', text }] };
}

function inferPurpose(filePath: string, language: string, exports: Array<{ exportName: string; exportType: string }>): string {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const parts = normalized.split('/');
  const fileName = parts[parts.length - 1];
  const dirName = parts.length > 1 ? parts[parts.length - 2] : '';

  // Based on directory
  if (dirName === 'services' || dirName === 'service') return 'Service layer — business logic and data access.';
  if (dirName === 'tools' || dirName === 'handlers') return 'Tool/handler — processes requests and returns responses.';
  if (dirName === 'routes' || dirName === 'api') return 'API route — defines HTTP endpoints.';
  if (dirName === 'models' || dirName === 'entities') return 'Data model — defines data structures and schema.';
  if (dirName === 'utils' || dirName === 'helpers') return 'Utility functions — shared helper logic.';
  if (dirName === 'middleware') return 'Middleware — request/response processing pipeline.';
  if (dirName === 'components') return 'UI component.';
  if (dirName === 'hooks') return 'React hook — reusable stateful logic.';
  if (dirName === 'tests' || dirName === '__tests__') return 'Test file.';

  // Based on filename
  if (fileName.includes('config')) return 'Configuration — environment variables and settings.';
  if (fileName.includes('type') || fileName.includes('interface')) return 'Type definitions — shared interfaces and types.';
  if (fileName.includes('index')) return 'Entry point / barrel file — re-exports and initialization.';
  if (fileName.includes('test') || fileName.includes('spec')) return 'Test file.';
  if (fileName.includes('schema')) return 'Schema definition.';
  if (fileName.includes('migration')) return 'Database migration.';

  // Based on exports
  const hasClasses = exports.some(e => e.exportType === 'class');
  const hasFunctions = exports.some(e => e.exportType === 'function');
  if (hasClasses && hasFunctions) return 'Module with classes and utility functions.';
  if (hasClasses) return 'Class definitions.';
  if (hasFunctions) return 'Function library.';

  return `${language} module.`;
}

function getComplexity(exportCount: number, importCount: number, lines: number, chunks: number): string {
  const score = exportCount * 2 + importCount + Math.floor(lines / 50) + chunks;
  if (score <= 5) return 'Low';
  if (score <= 15) return 'Medium';
  if (score <= 30) return 'High';
  return 'Very High';
}
