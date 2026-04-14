# S02 Research: MCP Registry Publication

## Summary

S02 requires publishing the Foxhound MCP server to the official MCP Registry at registry.modelcontextprotocol.io so it's discoverable in Claude Code, VS Code, and JetBrains MCP integrations. Package is already published to npm (@foxhound-ai/mcp-server@0.1.0). Registry publication requires adding mcpName to package.json, creating server.json manifest with metadata, and using mcp-publisher CLI for GitHub-authenticated submission. Missing artifacts: LICENSE file (package.json declares MIT but file doesn't exist) and server.json.

## Recommendation

**Straightforward light research.** The MCP Registry workflow is well-documented and the package already meets npm prerequisites. Work divides cleanly into three tasks: (1) add LICENSE + mcpName to package.json and republish, (2) create server.json manifest using mcp-publisher init + manual editing, (3) authenticate and publish to registry. No novel integration challenges.

Verification: published server appears in registry API search results and can be installed via `claude mcp add foxhound` referencing registry name instead of npm package.

## Implementation Landscape

### Registry Architecture

MCP Registry is a **metaregistry** — it hosts metadata about packages but not the package code/binaries themselves. Workflow:

1. **Package registry** (npm, PyPI, Docker, etc.) hosts the actual code
2. **MCP Registry** hosts structured metadata (server.json) pointing to the package
3. **MCP clients** (Claude Code, VS Code, Cursor, Windsurf) query the registry to discover servers, then install from the underlying package registry

The registry launched in preview (Sept 2025), entered API freeze at v0.1 (Oct 2025), and is now stable for integrations. Community-maintained by MCP working group (Anthropic, GitHub, PulseMCP, Microsoft contributors).

### Discovery Mechanisms

**MCP Registry** (primary): Official registry at registry.modelcontextprotocol.io with REST API. Clients query `/v0/servers?search=<term>` to discover. GitHub-based auth for publishers. Metadata follows server.json JSON Schema.

**VS Code Extensions view**: `@mcp` search filter shows MCP servers that have been packaged as VS Code extensions (wrapper pattern — not applicable for pure MCP servers). VS Code can also autodiscover from other tools' configs via `chat.mcp.discovery.enabled` setting (e.g., reuse Claude Desktop's MCP config).

**Claude Code CLI**: `claude mcp add <server-name>` can reference registry names (once published) or raw npm packages (`npx @pkg/name`).

**Cursor/Windsurf/JetBrains**: Manual `.mcp.json` or `.cursor/mcp.json` config. No first-class registry integration documented (rely on README install instructions or manual config).

Registry publication makes the server searchable and one-click installable for tools that integrate with the registry (Claude Code, VS Code).

### Publication Workflow

**Prerequisites:**
- Package published to npm (✅ done: @foxhound-ai/mcp-server@0.1.0)
- GitHub repo exists (✅ done: https://github.com/caleb-love/foxhound)
- mcpName field in package.json (❌ missing)
- server.json manifest in package root (❌ missing)
- LICENSE file matching package.json license declaration (❌ missing — declares MIT but no file)

**Steps:**
1. Add `"mcpName": "io.github.caleb-love/foxhound"` to packages/mcp-server/package.json (convention for GitHub auth: `io.github.<username>/<server-name>`)
2. Add LICENSE file to packages/mcp-server/ (MIT text)
3. Bump version in package.json (0.1.0 → 0.1.1 or 0.2.0) to trigger new npm publish with mcpName
4. Build and publish to npm: `cd packages/mcp-server && pnpm build && npm publish`
5. Install mcp-publisher CLI: `curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz`
6. Generate server.json template: `./mcp-publisher init` (in packages/mcp-server/)
7. Edit server.json to match actual server metadata (see template structure below)
8. Authenticate: `./mcp-publisher login` (GitHub OAuth device flow)
9. Publish: `./mcp-publisher publish`
10. Verify: `curl "https://registry.modelcontextprotocol.io/v0/servers?search=io.github.caleb-love/foxhound"` should return server metadata

**Registry Validation:** Registry verifies that package.mcpName matches server.json name and that the npm package exists and is accessible.

### server.json Structure

Schema: https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json

Example from quickstart:
```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.caleb-love/foxhound",
  "description": "MCP server for querying Foxhound traces from Claude Code, Cursor, and other MCP clients",
  "repository": {
    "url": "https://github.com/caleb-love/foxhound",
    "source": "github"
  },
  "version": "0.2.0",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "@foxhound-ai/mcp-server",
      "version": "0.2.0",
      "transport": {
        "type": "stdio"
      },
      "environmentVariables": [
        {
          "description": "Your Foxhound API key (create at foxhound.dev)",
          "isRequired": true,
          "format": "string",
          "isSecret": true,
          "name": "FOXHOUND_API_KEY"
        },
        {
          "description": "Foxhound API endpoint (default: http://localhost:3001)",
          "isRequired": false,
          "format": "string",
          "isSecret": false,
          "name": "FOXHOUND_ENDPOINT"
        }
      ]
    }
  ]
}
```

**Key fields:**
- `name`: Must match package.json mcpName exactly
- `version`: Server version (not package version — can differ if server.json schema evolves independently)
- `packages[].registryType`: "npm" | "pypi" | "nuget" | "docker" | "mcpb" | "github" | "gitlab"
- `packages[].identifier`: Package name on the registry (@foxhound-ai/mcp-server)
- `packages[].version`: Specific package version this server.json describes
- `packages[].transport.type`: "stdio" (current) | "sse" (legacy) | "http" (remote servers)
- `environmentVariables`: Declared vars (used by clients to prompt user for config)

mcp-publisher init auto-detects most fields from package.json and git context. Manual edits needed for environmentVariables (not auto-detected).

### Existing Package State

**packages/mcp-server/package.json:**
- name: @foxhound-ai/mcp-server
- version: 0.1.0
- description: "MCP server for querying Foxhound traces from Claude Code, Cursor, and other MCP clients"
- license: MIT (declared but no LICENSE file exists)
- repository.url: https://github.com/caleb-love/foxhound.git
- repository.directory: packages/mcp-server
- keywords: mcp, ai, agents, observability, tracing, claude, cursor
- bin.foxhound-mcp: ./dist/index.js
- exports: { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } }
- publishConfig.access: public

**Environment variables (from src/index.ts getConfig):**
- FOXHOUND_API_KEY (required, validated at startup)
- FOXHOUND_ENDPOINT (optional, default: http://localhost:3001)

**README.md:** Already documents manual installation for Claude Code (`claude mcp add foxhound -e ...`), Cursor/Windsurf (mcp.json config), and env var table. After registry publication, can add registry-based install as the primary method.

**npm publication:** Package exists at https://registry.npmjs.org/@foxhound-ai/mcp-server/-/mcp-server-0.1.0.tgz. Published by caleb-love. No LICENSE file in tarball (missing from source).

### Task Decomposition

**T01: Add LICENSE, update package.json with mcpName, republish to npm**
- Add packages/mcp-server/LICENSE (MIT text)
- Add `"mcpName": "io.github.caleb-love/foxhound"` to package.json
- Bump version to 0.2.0 (minor bump for registry publication feature)
- Build and publish to npm
- Verify: npm view @foxhound-ai/mcp-server shows version 0.2.0 with LICENSE in tarball

**T02: Create server.json manifest**
- Install mcp-publisher CLI to workspace (or use npx)
- Run mcp-publisher init in packages/mcp-server/
- Edit generated server.json to populate environmentVariables array with FOXHOUND_API_KEY (required, secret) and FOXHOUND_ENDPOINT (optional)
- Verify: server.json validates against schema

**T03: Publish to MCP Registry**
- Run mcp-publisher login (GitHub OAuth device flow)
- Run mcp-publisher publish
- Verify: curl registry API returns server metadata
- Update README.md with registry-based install as primary method
- Commit server.json to repo

## Constraints

**API freeze:** Registry is in v0.1 API freeze (Oct 2025–present). Breaking changes unlikely but not impossible during preview. server.json schema is stable.

**mcpName uniqueness:** GitHub auth namespace is `io.github.<username>/`. Server name "foxhound" might conflict with other users' servers (registry enforces uniqueness per namespace, not globally). If `io.github.caleb-love/foxhound` is taken, fallback to `io.github.caleb-love/foxhound-mcp`.

**npm package version:** Registry validates that package.json version matches packages[].version in server.json. Must republish to npm before registry publish if version changes.

**LICENSE requirement:** npm best practice and registry best practice both expect LICENSE file. MIT text is 11 lines, trivial addition.

**Monorepo package publishing:** pnpm workspace. Use `pnpm --filter @foxhound-ai/mcp-server publish` or `cd packages/mcp-server && npm publish` (both work, latter simpler for one-off publish).

## Verification Strategy

**T01 verification:**
- `npm view @foxhound-ai/mcp-server` shows version 0.2.0
- `npm view @foxhound-ai/mcp-server mcpName` returns "io.github.caleb-love/foxhound"
- Download tarball and verify LICENSE file exists

**T02 verification:**
- `npx ajv-cli validate -s <schema-url> -d packages/mcp-server/server.json` passes (JSON Schema validation)
- Manual inspection: environmentVariables array has FOXHOUND_API_KEY (required, secret) and FOXHOUND_ENDPOINT (optional)

**T03 verification:**
- `curl "https://registry.modelcontextprotocol.io/v0/servers?search=foxhound" | jq '.servers[] | select(.name == "io.github.caleb-love/foxhound")'` returns server object
- `claude mcp add io.github.caleb-love/foxhound` succeeds (if Claude Code supports registry name resolution — not documented, may still require npm package name)
- VS Code Extensions view `@mcp foxhound` search may or may not discover it (depends on VS Code's registry integration timeline — not critical for S02 success)

**Integration test (manual, post-publish):**
- Fresh Claude Code or Cursor install
- Add server via registry name (if supported) or via npm package name
- Verify tools are discovered and callable

## Risks

**Low risk:** Workflow is standard, schema is stable, npm package already works. Only unknowns are registry-specific: mcpName conflicts (testable before publish) and registry downtime (preview service, but API freeze suggests stability).

**No JetBrains-specific publication:** JetBrains MCP integration not documented in search results. Assume manual config only (same as Cursor/Windsurf). Registry publication doesn't directly benefit JetBrains unless they add registry client support later — not a blocker for S02 completion ("discoverable in registries" satisfied by MCP Registry listing).

**VS Code extension wrapper not needed:** VS Code's `@mcp` search shows VS Code extensions that wrap MCP servers, not raw MCP servers from the registry. Direct registry integration via chat.mcp.discovery.enabled is experimental. For S02 success criteria ("discoverable in VS Code"), registry listing + README install instructions are sufficient — wrapper extension is out of scope.

## Follow-up Opportunities

**Post-S02:**
- Monitor registry search analytics (if available) to see if server is being discovered
- Update blog/docs to announce registry availability
- Consider VS Code extension wrapper if VS Code registry integration doesn't materialize (but wait for VS Code team guidance first)