import { getProjectWithRetry, lookupSymbols } from '../services/sqlite.js';
import type { SymbolKind } from '../types.js';

export async function symbolLookupTool(args: {
  project_name: string;
  symbol: string;
  kind?: SymbolKind;
  file_pattern?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const project = await getProjectWithRetry(args.project_name);
  if (!project) {
    return {
      content: [{
        type: 'text',
        text: `Error: Project "${args.project_name}" not found. Run index_codebase first.`,
      }],
    };
  }

  const rows = lookupSymbols({
    projectName: args.project_name,
    name: args.symbol,
    kind: args.kind,
    filePattern: args.file_pattern,
    limit: 40,
  });

  if (rows.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No symbols matching "${args.symbol}" in project "${args.project_name}". Try re-indexing or a broader name.`,
      }],
    };
  }

  const lines: string[] = [
    `## Symbol lookup: "${args.symbol}"`,
    `**Project:** ${args.project_name}`,
    '',
  ];

  for (const s of rows) {
    const bits = [
      `- **${s.name}** (${s.kind})`,
      `  - File: \`${s.filePath}\`:${s.lineNumber}`,
      s.parentName ? `  - Parent: \`${s.parentName}\`` : null,
      `  - Exported: ${s.exported ? 'yes' : 'no'}`,
      s.signature ? `  - \`${s.signature}\`` : null,
    ].filter(Boolean);
    lines.push(bits.join('\n'));
  }

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}
