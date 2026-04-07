import { spawnSync } from 'node:child_process';

/**
 * Run `npm update -g hnindex-cli`. Returns exit code (0 = ok).
 */
export function runGlobalUpdate(): { ok: boolean; message: string } {
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'npm.cmd' : 'npm';
  const result = spawnSync(cmd, ['update', '-g', 'hnindex-cli'], {
    stdio: 'inherit',
    shell: isWin,
    env: process.env,
  });

  if (result.status === 0) {
    return {
      ok: true,
      message:
        'hnindex-cli updated. Restart your terminal or IDE if the `hnindex` command does not refresh.\n' +
        'The MCP server package `vibe-hnindex` is loaded via `npx -y vibe-hnindex` — npx fetches the latest compatible version on each MCP start unless you pin it.',
    };
  }

  return {
    ok: false,
    message:
      'npm update failed. Try manually:\n' +
      '  npm install -g hnindex-cli@latest\n' +
      'If you use a strict proxy or offline mirror, configure npm and retry.',
  };
}
