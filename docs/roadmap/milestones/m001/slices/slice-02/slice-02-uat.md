# S02: MCP Registry Publication — UAT

**Milestone:** M001
**Written:** 2026-04-10T05:53:33.280Z

# UAT: MCP Registry Publication

## Preconditions

- npm account with publish access to @foxhound-ai org
- GitHub account for OAuth authentication to MCP Registry
- mcp-publisher CLI binary present at packages/mcp-server/mcp-publisher
- Clean working directory (all artifacts committed)

## Test Cases

### TC1: Verify Package Metadata

**Steps:**
1. Navigate to packages/mcp-server/
2. Run `cat package.json | jq '{name, version, mcpName}'`

**Expected:**
```json
{
  "name": "@foxhound-ai/mcp-server",
  "version": "0.2.0",
  "mcpName": "io.github.caleb-love/foxhound"
}
```

**Actual:** ✅ PASS (verified in slice execution)

---

### TC2: Verify LICENSE File

**Steps:**
1. Run `test -f packages/mcp-server/LICENSE && echo "EXISTS"`
2. Run `head -3 packages/mcp-server/LICENSE`

**Expected:**
- File exists
- First line: "MIT License"
- Third line: "Copyright (c) 2026 Foxhound Contributors"

**Actual:** ✅ PASS (verified in slice execution)

---

### TC3: Verify server.json Structure

**Steps:**
1. Run `cat packages/mcp-server/server.json | jq '{name, version, envVars: .packages[0].environmentVariables | map({name, required: .isRequired, secret: .isSecret})}'`

**Expected:**
```json
{
  "name": "io.github.caleb-love/foxhound",
  "version": "0.2.0",
  "envVars": [
    {
      "name": "FOXHOUND_API_KEY",
      "required": true,
      "secret": true
    },
    {
      "name": "FOXHOUND_ENDPOINT",
      "required": false,
      "secret": false
    }
  ]
}
```

**Actual:** ✅ PASS (verified in slice execution)

---

### TC4: Verify README Registry Instructions

**Steps:**
1. Run `grep -A 5 "Install from MCP Registry" packages/mcp-server/README.md`

**Expected:**
- Section titled "Install from MCP Registry (Recommended)"
- Shows `claude mcp add io.github.caleb-love/foxhound` command
- Shows npm fallback: `npx @foxhound-ai/mcp-server`

**Actual:** ✅ PASS (verified in slice execution)

---

### TC5: Publish to npm (Manual)

**Steps:**
1. Authenticate: `npm login` (or set NPM_TOKEN env var)
2. Navigate to packages/mcp-server/
3. Run `npm publish --access public`
4. Verify: `npm view @foxhound-ai/mcp-server version`

**Expected:**
- Publish succeeds without errors
- npm view returns "0.2.0"

**Actual:** ⚠️ BLOCKED — Requires npm authentication (not available in auto-mode)

**Manual Completion Required:** Yes

---

### TC6: Publish to MCP Registry (Manual)

**Steps:**
1. Navigate to packages/mcp-server/
2. Authenticate: `./mcp-publisher login github`
   - Follow OAuth device flow (open URL, enter code)
3. Publish: `./mcp-publisher publish`
4. Verify: `curl -s 'https://registry.modelcontextprotocol.io/v0/servers?search=foxhound' | jq '.servers[] | select(.name == "io.github.caleb-love/foxhound")'`

**Expected:**
- OAuth completes successfully
- Publish succeeds with validation checks passing
- Registry API returns server object with name "io.github.caleb-love/foxhound"

**Actual:** ⚠️ BLOCKED — Requires GitHub OAuth (not available in auto-mode)

**Manual Completion Required:** Yes

---

### TC7: Test Registry-Based Installation (Manual, After TC6)

**Steps:**
1. In Claude Code: `claude mcp add io.github.caleb-love/foxhound`
2. Verify environment variable prompts appear for FOXHOUND_API_KEY and FOXHOUND_ENDPOINT
3. Provide test values and confirm installation
4. Run `claude mcp list` to verify foxhound server is registered

**Expected:**
- Installation succeeds
- Server appears in MCP client registry
- Environment variables correctly prompt with descriptions from server.json

**Actual:** ⏸️ PENDING — Depends on TC6 completion

**Manual Completion Required:** Yes

---

### TC8: Test npm Fallback Installation

**Steps:**
1. In any MCP client config file (.cursor/mcp.json or equivalent):
   ```json
   {
     "mcpServers": {
       "foxhound": {
         "command": "npx",
         "args": ["@foxhound-ai/mcp-server@0.2.0"],
         "env": {
           "FOXHOUND_API_KEY": "fox_test_key",
           "FOXHOUND_ENDPOINT": "http://localhost:3001"
         }
       }
     }
   }
   ```
2. Reload MCP client
3. Verify foxhound tools are available

**Expected:**
- Server starts successfully
- All MCP tools listed (foxhound_search_traces, foxhound_get_trace, etc.)

**Actual:** ⏸️ PENDING — Depends on TC5 completion (npm publish)

**Manual Completion Required:** Yes

---

## Edge Cases

### EC1: mcpName Mismatch

**Scenario:** mcpName in package.json doesn't match name in server.json

**Steps:**
1. Temporarily edit package.json mcpName to "wrong-name"
2. Run `./mcp-publisher publish`

**Expected:** Validation error: "mcpName mismatch"

**Mitigation:** Both files use io.github.caleb-love/foxhound — verified

---

### EC2: Missing npm Package

**Scenario:** server.json references npm package that doesn't exist

**Steps:**
1. Query npm: `npm view @foxhound-ai/mcp-server@0.2.0`

**Expected (Current State):** Returns 404 or shows version 0.1.0 (not 0.2.0)

**Expected (After TC5):** Returns version 0.2.0 metadata

---

### EC3: OAuth Timeout

**Scenario:** User doesn't complete OAuth flow within 120s

**Steps:**
1. Run `./mcp-publisher login github`
2. Wait >120s without completing browser authorization

**Expected:** Command times out with error message

**Mitigation:** PUBLISH.md documents this and instructs to retry

---

## Summary

**Automated Tests:** 4/8 PASS (TC1-TC4)
**Manual Tests:** 4/8 BLOCKED/PENDING (TC5-TC8)

**Slice Goal Achievement:** ⚠️ Partial — All artifacts ready, publication blocked by authentication

**Next Steps:**
1. Complete TC5 (npm publish) with authentication
2. Complete TC6 (MCP Registry publish) with OAuth
3. Run TC7 and TC8 to verify installation flows

**Blocking Issues:** None (authentication is expected manual step, not a bug)
