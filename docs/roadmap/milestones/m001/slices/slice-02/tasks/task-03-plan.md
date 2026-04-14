---
estimated_steps: 5
estimated_files: 1
skills_used: []
---

# T03: Publish to MCP Registry and update README with registry install instructions

Authenticate to MCP Registry via GitHub OAuth device flow, publish server.json, verify via registry API search, then update README to show registry-based installation as the primary method.

Run `mcp-publisher login` (GitHub OAuth device flow — outputs URL and code, polls for auth completion). Then run `mcp-publisher publish` (validates mcpName matches server.json name, verifies npm package exists, submits metadata to registry).

Verify publication succeeded by querying registry API: `curl 'https://registry.modelcontextprotocol.io/v0/servers?search=foxhound'` should return server object with name io.github.caleb-love/foxhound.

Update README.md to add registry-based install as the primary method for Claude Code (if supported — research noted this may still require npm package name). Keep existing manual npm install instructions as fallback.

Commit server.json to repo (registry metadata should be version-controlled).

## Steps

1. Authenticate to MCP Registry: `cd packages/mcp-server && ./mcp-publisher login` (follow GitHub OAuth device flow prompts — outputs URL and code, wait for auth success)
2. Publish to registry: `./mcp-publisher publish` (validates mcpName matches server.json name, verifies npm package exists, submits metadata)
3. Verify publication via API: `curl -s 'https://registry.modelcontextprotocol.io/v0/servers?search=foxhound' | jq '.servers[] | select(.name == "io.github.caleb-love/foxhound")'` should return server object
4. Update README.md to add registry installation as primary method:
   - Add section for registry-based install (e.g., `claude mcp add io.github.caleb-love/foxhound` if supported)
   - Keep existing npm-based install as fallback/alternative method
   - Note: research indicated Claude Code registry name resolution support is unclear — document both approaches
5. Commit server.json to git: `git add packages/mcp-server/server.json && git commit -m "Add MCP Registry server.json manifest"`

## Must-Haves

- [ ] mcp-publisher login succeeds (GitHub OAuth completed)
- [ ] mcp-publisher publish succeeds (no validation errors)
- [ ] Registry API search returns server with name io.github.caleb-love/foxhound
- [ ] README.md mentions registry installation option
- [ ] server.json committed to git

## Inputs

- ``packages/mcp-server/server.json``
- ``packages/mcp-server/README.md``

## Expected Output

- ``packages/mcp-server/README.md``

## Verification

curl -s 'https://registry.modelcontextprotocol.io/v0/servers?search=foxhound' | jq -e '.servers[] | select(.name == "io.github.caleb-love/foxhound")' && grep -q 'registry' packages/mcp-server/README.md
