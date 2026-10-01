import { config } from '../config.js';
import { healthCheck as embeddingHealthCheck, embedSingle, embeddingUnavailableMessage } from '../services/embeddings.js';
import { healthCheck as qdrantHealthCheck, verifyCollectionReady } from '../services/qdrant.js';
import { getProject, getProjectChunkCount } from '../services/sqlite.js';

function mdEscape(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export async function serverDiagnosticsTool(args: {
  project_name?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const lines: string[] = ['# Server diagnostics', ''];

  lines.push('## Configuration');
  lines.push('');
  lines.push(`- **Embedding provider:** ${config.embeddingProvider}`);
  lines.push(`- **Embedding URL:** ${mdEscape(config.embeddingBaseUrl)}`);
  lines.push(`- **API key:** ${config.embeddingApiKey ? 'configured (hidden)' : 'not configured'}`);
  lines.push(`- **Embedding model:** ${mdEscape(config.embeddingModel)}`);
  lines.push(`- **Embedding dimensions (expected):** ${config.embeddingDimensions}`);
  lines.push(`- **Storage path:** ${mdEscape(config.storagePath)}`);
  lines.push(`- **SQLite:** ${mdEscape(config.sqlitePath)}`);
  lines.push(`- **Qdrant URL:** ${mdEscape(config.qdrantUrl)}`);
  lines.push(`- **SEARCH_RERANK:** ${config.searchRerankEnabled ? 'on' : 'off'}`);
  lines.push(
    `- **RERANK_URL:** ${config.rerankUrl ? mdEscape(config.rerankUrl) : '_(unset)_'}`,
  );
  lines.push('');

  const embeddingOk = await embeddingHealthCheck();
  lines.push(config.embeddingProvider === 'ollama' ? '## Ollama' : `## Embedding provider: ${config.embeddingProvider}`);
  lines.push('');
  lines.push(`- **Reachable:** ${embeddingOk ? 'yes' : 'no'}`);
  let embedProbe = embeddingUnavailableMessage();
  if (embeddingOk) {
    try {
      await embedSingle('ping');
      embedProbe = 'ok (single embed dimensions match config)';
    } catch (e) {
      embedProbe = e instanceof Error ? e.message : String(e);
    }
  }
  lines.push(`- **Embed probe:** ${mdEscape(embedProbe)}`);
  lines.push('');

  const qdrantOk = await qdrantHealthCheck();
  lines.push('## Qdrant');
  lines.push('');
  lines.push(`- **Reachable:** ${qdrantOk ? 'yes' : 'no'}`);
  lines.push('');

  const projectName = args.project_name?.trim();
  if (projectName) {
    lines.push(`## Project: ${mdEscape(projectName)}`);
    lines.push('');
    const project = getProject(projectName);
    if (!project) {
      lines.push(`- **Status:** project not found (run \`index_codebase\` first).`);
    } else if (!qdrantOk) {
      lines.push('- **Chunk vs Qdrant:** unknown (Qdrant unreachable)');
    } else {
      const chunkCount = getProjectChunkCount(projectName);
      const verify = await verifyCollectionReady(projectName);
      const points = verify.pointsCount;
      let relation: 'match' | 'mismatch' | 'unknown' = 'unknown';
      let hint = '';
      if (verify.ok && points !== undefined) {
        relation = points === chunkCount ? 'match' : 'mismatch';
        if (relation === 'mismatch') {
          hint =
            'SQLite chunk count differs from Qdrant point count — try `index_codebase` again, or check if Qdrant was unavailable during indexing.';
        }
      } else {
        hint = verify.error
          ? `Collection check failed: ${verify.error}`
          : 'Could not read Qdrant collection point count.';
      }
      lines.push(`- **SQLite chunks:** ${chunkCount}`);
      lines.push(`- **Qdrant points:** ${points ?? 'unknown'}`);
      lines.push(`- **Match:** ${relation}`);
      if (hint) {
        lines.push(`- **Note:** ${mdEscape(hint)}`);
      }
    }
    lines.push('');
  }

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}
