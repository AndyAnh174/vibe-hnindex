/**
 * Merge vibe-hnindex into parsed MCP JSON or TOML without clobbering other servers.
 */

export type ConfigFormat = 'mcpServers' | 'servers' | 'mcp_servers';

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

  const key = format;
  const prev = root[key];
  const bucket: Record<string, unknown> =
    prev && typeof prev === 'object' && !Array.isArray(prev)
      ? { ...(prev as Record<string, unknown>) }
      : {};

  const prior = bucket[serverName];
  // Codex tables can also contain timeouts and tool policies: keep those values.
  const mergedBlock = format === 'mcp_servers' && prior && typeof prior === 'object' && !Array.isArray(prior)
    ? { ...(prior as Record<string, unknown>), ...serverBlock }
    : serverBlock;
  root[key] = { ...bucket, [serverName]: mergedBlock };
  return root;
}
