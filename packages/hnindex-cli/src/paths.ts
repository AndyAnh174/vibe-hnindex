import os from 'node:os';
import path from 'node:path';

export type McpTarget =
  | 'claude'
  | 'claude-desktop'
  | 'antigravity'
  | 'cursor'
  | 'cursor-project'
  | 'windsurf'
  | 'vscode';

export type ResolvedTarget = {
  target: McpTarget;
  filePath: string;
  format: 'mcpServers' | 'servers';
};

export const TARGET_LABELS: Record<McpTarget, string> = {
  claude: 'Claude Code — .mcp.json in current directory',
  'claude-desktop': 'Claude Desktop — claude_desktop_config.json (user profile)',
  antigravity: 'Google Antigravity — ~/.gemini/antigravity/mcp_config.json',
  cursor: 'Cursor — global MCP file (user profile)',
  'cursor-project': 'Cursor — .cursor/mcp.json in current directory',
  windsurf: 'Windsurf — ~/.windsurf/mcp_config.json',
  vscode: 'VS Code Copilot — .vscode/mcp.json in current directory',
};

export function listTargets(): McpTarget[] {
  return [
    'claude',
    'claude-desktop',
    'antigravity',
    'cursor',
    'cursor-project',
    'windsurf',
    'vscode',
  ];
}

export function resolveTargetPath(target: McpTarget, cwd: string): ResolvedTarget {
  const home = os.homedir();
  const platform = process.platform;

  switch (target) {
    case 'claude':
      return {
        target,
        filePath: path.join(cwd, '.mcp.json'),
        format: 'mcpServers',
      };
    case 'claude-desktop': {
      let p: string;
      if (platform === 'win32') {
        const appData = process.env.APPDATA;
        if (!appData) {
          throw new Error('APPDATA is not set (required for Claude Desktop on Windows)');
        }
        p = path.join(appData, 'Claude', 'claude_desktop_config.json');
      } else if (platform === 'darwin') {
        p = path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      } else {
        p = path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
      }
      return { target, filePath: p, format: 'mcpServers' };
    }
    case 'antigravity':
      return {
        target,
        filePath: path.join(home, '.gemini', 'antigravity', 'mcp_config.json'),
        format: 'mcpServers',
      };
    case 'cursor': {
      let p: string;
      if (platform === 'win32') {
        const appData = process.env.APPDATA;
        if (!appData) {
          throw new Error('APPDATA is not set (required for Cursor on Windows)');
        }
        p = path.join(appData, 'Cursor', 'User', 'globalStorage', 'cursor.mcp', 'mcp.json');
      } else {
        p = path.join(home, '.cursor', 'mcp.json');
      }
      return { target, filePath: p, format: 'mcpServers' };
    }
    case 'cursor-project':
      return {
        target,
        filePath: path.join(cwd, '.cursor', 'mcp.json'),
        format: 'mcpServers',
      };
    case 'windsurf':
      return {
        target,
        filePath: path.join(home, '.windsurf', 'mcp_config.json'),
        format: 'mcpServers',
      };
    case 'vscode':
      return {
        target,
        filePath: path.join(cwd, '.vscode', 'mcp.json'),
        format: 'servers',
      };
    default: {
      const _x: never = target;
      throw new Error(`Unknown target: ${_x}`);
    }
  }
}

export function parseTarget(s: string): McpTarget {
  const n = s.trim().toLowerCase().replace(/_/g, '-');
  const valid = listTargets();
  if (!valid.includes(n as McpTarget)) {
    throw new Error(
      `Unknown --mcp "${s}". Use one of: ${valid.join(', ')} (or run: hnindex init --list)`,
    );
  }
  return n as McpTarget;
}
