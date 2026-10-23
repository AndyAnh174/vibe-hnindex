import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const readJson = (filename) =>
  JSON.parse(fs.readFileSync(path.join(root, filename), "utf8"));
const normalize = (text) => text.replaceAll("\r\n", "\n");
function syncFile(relative, data) {
  const filename = path.join(root, relative);
  const existing = fs.existsSync(filename) ? fs.readFileSync(filename, "utf8") : "";
  if (normalize(existing) === normalize(data)) return;
  if (process.argv.includes("--check"))
    throw new Error(relative + " is stale. Run npm run content:sync.");
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, data);
}
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
const readmeBanner = `<!-- hnindex:release:start -->\nCurrent release: **v${manifest.version}** · MCP server \`vibe-hnindex\` · installer \`hnindex-cli\`. [Release notes](https://github.com/AndyAnh174/vibe-hnindex/releases/tag/v${manifest.version})\n<!-- hnindex:release:end -->`;
for (const relative of ["README.md", "packages/hnindex-cli/README.md", "docs/README.md"]) {
  const filename = path.join(root, relative);
  const body = normalize(fs.readFileSync(filename, "utf8"));
  const marker = /<!-- hnindex:release:start -->[\s\S]*?<!-- hnindex:release:end -->/g;
  if ([...body.matchAll(marker)].length !== 1)
    throw new Error(relative + " must contain exactly one hnindex release banner.");
  syncFile(relative, body.replace(marker, () => readmeBanner));
}
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
  JSON.stringify({ version: manifest.version, graphLanguages: Object.values(readJson("graph-languages.json").labels), releases }, null, 2) + "\n";
const architecture = fs.readFileSync(path.join(root, "docs/architecture.md"), "utf8").replaceAll("\r\n", "\n");
const charts = [...architecture.matchAll(/```mermaid\n([\s\S]*?)\n```/g)].map((match) => match[1]);
if (charts.length !== 3 || charts.some((chart, i) =>
  !chart.startsWith(i === 1 ? "sequenceDiagram" : "flowchart") ||
  !chart.includes("accTitle:") || !chart.includes("accDescr:")))
  throw new Error("Architecture must contain accessible system, sequence and user Mermaid diagrams in that order.");
const readmePath = path.join(root, "README.md");
const readme = normalize(fs.readFileSync(readmePath, "utf8"));
const architectureMarker = /<!-- hnindex:architecture:start -->[\s\S]*?<!-- hnindex:architecture:end -->/g;
if ([...readme.matchAll(architectureMarker)].length !== 1)
  throw new Error("README.md must contain exactly one hnindex architecture block.");
syncFile("README.md", readme.replace(architectureMarker, () =>
  `<!-- hnindex:architecture:start -->\n\`\`\`mermaid\n${charts[0]}\n\`\`\`\n<!-- hnindex:architecture:end -->`));
const diagramContent = JSON.stringify(charts.map((chart, i) => ({
  id: ["system", "sequence", "user"][i], chart,
})), null, 2) + "\n";
for (const site of ["website", "docs-site"]) {
  for (const [name, data] of [["release", content], ["architecture", diagramContent]]) {
    syncFile(`${site}/src/lib/${name}.generated.json`, data);
  }
}
console.log(
  "Both sites synchronized: v" +
    manifest.version +
    ", " +
    releases.length +
    " changelog entries, 3 architecture diagrams.",
);
