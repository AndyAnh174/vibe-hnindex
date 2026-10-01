import { appendFileSync, readFileSync } from 'node:fs';

const server = JSON.parse(readFileSync('package.json', 'utf8'));
const cli = JSON.parse(readFileSync('packages/hnindex-cli/package.json', 'utf8'));
if (server.version !== cli.version) throw new Error('Server and CLI versions must match');

function stableVersion(value) {
  if (!/^\d+\.\d+\.\d+$/.test(value)) throw new Error(`Expected stable release version: ${value}`);
  return value.split('.').map(Number);
}

async function shouldPublish(pkg) {
  const local = stableVersion(pkg.version);
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg.name)}`, {
    signal: AbortSignal.timeout(30_000),
  });
  // Registry failures must stop the release instead of being treated as unpublished versions.
  if (!response.ok) throw new Error(`npm registry lookup failed for ${pkg.name}: HTTP ${response.status}`);
  const metadata = await response.json();
  if (!metadata.versions || !metadata['dist-tags']?.latest) throw new Error(`Invalid registry metadata: ${pkg.name}`);
  if (Object.hasOwn(metadata.versions, pkg.version)) return false;
  const latest = stableVersion(metadata['dist-tags'].latest);
  const differing = local.findIndex((value, index) => value !== latest[index]);
  if (differing < 0 || local[differing] < latest[differing]) {
    throw new Error(`${pkg.name}@${pkg.version} must be newer than latest ${metadata['dist-tags'].latest}`);
  }
  return true;
}

const [serverPublish, cliPublish] = await Promise.all([shouldPublish(server), shouldPublish(cli)]);
const outputs = `server_publish=${serverPublish}\ncli_publish=${cliPublish}\nversion=${server.version}\n`;
console.log(outputs);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, outputs);
