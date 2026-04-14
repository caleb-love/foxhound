# S02: MCP Registry Publication

**Goal:** Foxhound MCP server is published to MCP Registry and discoverable via registry API search
**Demo:** Foxhound MCP server discoverable in Claude Code, VS Code, and JetBrains MCP registries

## Must-Haves

- LICENSE file in packages/mcp-server/ with MIT license text
- mcpName field in package.json set to io.github.caleb-love/foxhound
- Package republished to npm as @foxhound-ai/mcp-server@0.2.0
- server.json manifest with FOXHOUND_API_KEY and FOXHOUND_ENDPOINT environment variable declarations
- Server metadata published to MCP Registry and discoverable via API search
- README updated with registry-based installation instructions

## Verification

- `npm view @foxhound-ai/mcp-server version` returns 0.2.0
- `npm view @foxhound-ai/mcp-server mcpName` returns io.github.caleb-love/foxhound
- `curl -s 'https://registry.modelcontextprotocol.io/v0/servers?search=foxhound' | jq -e '.servers[] | select(.name == "io.github.caleb-love/foxhound")'` succeeds (server found in registry)
- `test -f packages/mcp-server/LICENSE` passes
- `test -f packages/mcp-server/server.json` passes
- `grep -q 'registry' packages/mcp-server/README.md` passes (registry install docs added)

## Tasks

- [x] **T01: Add LICENSE, mcpName to package.json, and republish to npm** `est:20m`
  Add MIT license file and mcpName field to satisfy registry prerequisites, then bump version and republish to npm. The registry validates that package.json mcpName matches server.json name and that the npm package is accessible.

Registry convention for GitHub-authenticated packages is `io.github.<username>/<server-name>`. Use `io.github.caleb-love/foxhound` as the mcpName (matches repository ownership).

Bump version from 0.1.0 to 0.2.0 (minor bump for registry publication feature).

LICENSE file uses standard MIT license text with copyright holder 'Foxhound Contributors' and year 2026.
  - Files: `packages/mcp-server/LICENSE`, `packages/mcp-server/package.json`
  - Verify: npm view @foxhound-ai/mcp-server version shows 0.2.0, npm view @foxhound-ai/mcp-server mcpName shows io.github.caleb-love/foxhound, and tarball contains LICENSE file

- [x] **T02: Create server.json manifest with environment variable metadata** `est:25m`
  Generate server.json template using mcp-publisher CLI, then edit to populate environment variable declarations that MCP clients use to prompt users during installation.

Download mcp-publisher from GitHub releases (not on npm). Run `init` command in packages/mcp-server/ to generate template — it auto-detects name, description, repository, version from package.json and git context.

Manually edit environmentVariables array to declare:
- FOXHOUND_API_KEY (required, secret, format: string, description: 'Your Foxhound API key (create at foxhound.dev)')
- FOXHOUND_ENDPOINT (optional, not secret, format: string, description: 'Foxhound API endpoint (default: http://localhost:3001)')

Validate against JSON Schema to catch structural errors before attempting registry publish.
  - Files: `packages/mcp-server/server.json`
  - Verify: test -f packages/mcp-server/server.json && jq -e '.name == "io.github.caleb-love/foxhound" and .packages[0].environmentVariables | length == 2' packages/mcp-server/server.json

- [x] **T03: Publish to MCP Registry and update README with registry install instructions** `est:30m`
  Authenticate to MCP Registry via GitHub OAuth device flow, publish server.json, verify via registry API search, then update README to show registry-based installation as the primary method.

Run `mcp-publisher login` (GitHub OAuth device flow — outputs URL and code, polls for auth completion). Then run `mcp-publisher publish` (validates mcpName matches server.json name, verifies npm package exists, submits metadata to registry).

Verify publication succeeded by querying registry API: `curl 'https://registry.modelcontextprotocol.io/v0/servers?search=foxhound'` should return server object with name io.github.caleb-love/foxhound.

Update README.md to add registry-based install as the primary method for Claude Code (if supported — research noted this may still require npm package name). Keep existing manual npm install instructions as fallback.

Commit server.json to repo (registry metadata should be version-controlled).
  - Files: `packages/mcp-server/README.md`
  - Verify: curl -s 'https://registry.modelcontextprotocol.io/v0/servers?search=foxhound' | jq -e '.servers[] | select(.name == "io.github.caleb-love/foxhound")' && grep -q 'registry' packages/mcp-server/README.md

## Files Likely Touched

- packages/mcp-server/LICENSE
- packages/mcp-server/package.json
- packages/mcp-server/server.json
- packages/mcp-server/README.md
