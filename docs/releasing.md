# Publishing a release

Develop on a version branch, update both npm packages, `server.json`, the Claude plugin manifests, server version and changelogs, then open a pull request to `main`. Wait for CI on Node 22 and 24 before merging. v0.14.0 requires Node 22+ for the N-API SQLite driver.

## GitHub Actions

`.github/workflows/publish.yml` runs when package versions change on `main`, or manually from **Actions → Publish to npm → Run workflow** on `main`.

The workflow builds and tests both packages, checks the exact versions on npm, publishes missing newer versions with provenance, then creates an annotated tag and GitHub Release. Existing npm versions are skipped so a partial release can be retried. Registry lookup failures stop publication. Server and CLI versions must match. Only one release workflow runs at a time.

Set a publishing token with access to both `vibe-hnindex` and `hnindex-cli` in the GitHub repository secret **NPM_TOKEN**. npm credentials are stored in GitHub Secrets, never in tracked files.

The workflow also supports npm trusted publishing: configure each npm package with GitHub owner `AndyAnh174`, repository `vibe-hnindex`, workflow `publish.yml`, and no environment name. Node 22, npm 11 and `id-token: write` are configured. OIDC is attempted before the existing token fallback. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

## Claude Code marketplace

The GitHub repository hosts `.claude-plugin/marketplace.json`, the root plugin and `skills/use-vibe-hnindex`. The plugin's MCP command pins the same npm release version. Update that pin for every release and validate before pushing:

```sh
claude plugin validate .
claude plugin validate .claude-plugin/plugin.json
```

Users install the marketplace and plugin in Claude Code:

```text
/plugin marketplace add AndyAnh174/vibe-hnindex
/plugin install vibe-hnindex@vibe-hnindex-marketplace
```

Users with an existing installation can run `/plugin marketplace update vibe-hnindex-marketplace` and `/plugin update vibe-hnindex@vibe-hnindex-marketplace`. This publishes to the project's own marketplace. Listing in Anthropic's official directory has a separate submission process.

## Saved embedding configuration

The [embedding guide](embedding-providers.md) contains ready-to-copy MCP configuration for each provider. `hnindex init` saves provider, model, URL and dimensions in the selected client's MCP JSON file. Existing embedding settings are preserved when omitted; switching providers clears generic settings from the previous provider. Prefer supplying cloud keys through the client process environment; keep personal MCP files and API keys out of source control.
