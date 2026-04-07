/**
 * Merge vibe-hnindex into existing MCP JSON without clobbering other servers.
 */

export type ConfigFormat = 'mcpServers' | 'servers';

export function mergeServerEntry(
  existing: Record<string, unknown> | null,
  format: ConfigFormat,
  serverName: string,
  serverBlock: Record<string, unknown>
): Record<string, unknown> {
  const root: Record<string, unknown> =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...existing }
      : {};

  const key = format === 'mcpServers' ? 'mcpServers' : 'servers';
  const prev = root[key];
  const bucket: Record<string, unknown> =
    prev && typeof prev === 'object' && !Array.isArray(prev)
      ? { ...(prev as Record<string, unknown>) }
      : {};

  bucket[serverName] = serverBlock;
  root[key] = bucket;
  return root;
}
