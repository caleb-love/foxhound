---
id: T02
parent: S02
milestone: M001
key_files:
  - packages/mcp-server/server.json
  - packages/mcp-server/mcp-publisher
key_decisions:
  - (none)
duration: 
verification_result: passed
completed_at: 2026-04-10T05:46:57.297Z
blocker_discovered: false
---

# T02: Created server.json manifest declaring FOXHOUND_API_KEY (required, secret) and FOXHOUND_ENDPOINT (optional, non-secret) environment variables for MCP client installation flows

**Created server.json manifest declaring FOXHOUND_API_KEY (required, secret) and FOXHOUND_ENDPOINT (optional, non-secret) environment variables for MCP client installation flows**

## What Happened

Downloaded mcp-publisher CLI from GitHub releases (18MB binary), moved to packages/mcp-server/, and executed init command. The CLI auto-detected package metadata from package.json and git context, generating a template server.json with placeholder environment variables.

Edited server.json to:
- Correct name field from io.github.caleb-love/mcp-server to io.github.caleb-love/foxhound (matching mcpName in package.json)
- Update version from 1.0.0 to 0.2.0 (matching package.json)
- Replace placeholder environment variable with FOXHOUND_API_KEY (required, secret, format: string, description: 'Your Foxhound API key (create at foxhound.dev)')
- Add FOXHOUND_ENDPOINT (optional, non-secret, format: string, description: 'Foxhound API endpoint (default: http://localhost:3001)')

Validated structure using jq — confirmed name matches expected value and environmentVariables array contains exactly 2 entries.

## Verification

Ran task verification command: `test -f packages/mcp-server/server.json && jq -e '.name == "io.github.caleb-love/foxhound" and (.packages[0].environmentVariables | length) == 2' packages/mcp-server/server.json` — exit code 0, passed.

Verified structure:
- server.json exists at expected path
- name field matches io.github.caleb-love/foxhound
- packages[0].environmentVariables array length is 2
- FOXHOUND_API_KEY declared with isRequired: true, isSecret: true
- FOXHOUND_ENDPOINT declared with isRequired: false, isSecret: false

Partial slice verification (expected at this stage):
- ✅ `test -f packages/mcp-server/server.json` passes
- ✅ `test -f packages/mcp-server/LICENSE` passes (from T01)
- ⏸️ npm view checks pending npm publish (T03)
- ⏸️ registry API search pending registry publish (T04)
- ⏸️ README registry docs pending (T05)

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `test -f packages/mcp-server/server.json && jq -e '.name == "io.github.caleb-love/foxhound" and (.packages[0].environmentVariables | length) == 2' packages/mcp-server/server.json` | 0 | ✅ pass | 82ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `packages/mcp-server/server.json`
- `packages/mcp-server/mcp-publisher`
