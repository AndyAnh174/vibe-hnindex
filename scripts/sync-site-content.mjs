import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const readJson = (filename) =>
  JSON.parse(fs.readFileSync(path.join(root, filename), "utf8"));
const versions = [
  readJson("packages/hnindex-cli/package.json").version,
  readJson("server.json").version,
  ...readJson("server.json").packages.map((pkg) => pkg.version),
  readJson(".claude-plugin/plugin.json").version,
  readJson(".claude-plugin/marketplace.json").metadata.version,
  ...readJson(".claude-plugin/marketplace.json").plugins.map(
    (plugin) => plugin.version,
  ),
  readJson("package-lock.json").version,
  readJson("package-lock.json").packages[""].version,
  readJson("package-lock.json").packages["packages/hnindex-cli"].version,
];
if (versions.some((version) => version !== manifest.version))
  throw new Error("Release metadata versions disagree with package.json.");
const serverSource = fs.readFileSync(path.join(root, "src/index.ts"), "utf8");
if (
  serverSource.match(/\bversion:\s*(['"])(\d+\.\d+\.\d+)\1/)?.[2] !== manifest.version ||
  !serverSource.includes(`Server started (v${manifest.version})`)
)
  throw new Error("MCP server version is stale.");
const pluginArgs = readJson(".claude-plugin/plugin.json").mcpServers[
  "vibe-hnindex"
].args;
if (!pluginArgs.includes(`vibe-hnindex@${manifest.version}`))
  throw new Error("Claude plugin package pin is stale.");
const markdown = fs
  .readFileSync(path.join(root, "docs/changelog.md"), "utf8")
  .replaceAll("\r\n", "\n");
const releases = [
  ...markdown.matchAll(
    /^## (v(\d+\.\d+\.\d+)\s+—\s+(.+))\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm,
  ),
].map((match) => ({
  version: match[2],
  title: match[3].trim(),
  items: match[4]
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim()),
}));
if (!releases.length || releases[0].version !== manifest.version)
  throw new Error("Latest changelog must match package.json version.");
const content =
  JSON.stringify({ version: manifest.version, releases }, null, 2) + "\n";
for (const site of ["website", "docs-site"]) {
  const filename = path.join(root, site, "src/lib/release.generated.json");
  const existing = fs.existsSync(filename)
    ? fs.readFileSync(filename, "utf8")
    : "";
  if (process.argv.includes("--check")) {
    if (existing !== content)
      throw new Error(
        site + " release data is stale. Run npm run content:sync.",
      );
  } else if (existing !== content) {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, content);
  }
}
console.log(
  "Both sites synchronized: v" +
    manifest.version +
    ", " +
    releases.length +
    " changelog entries.",
);
