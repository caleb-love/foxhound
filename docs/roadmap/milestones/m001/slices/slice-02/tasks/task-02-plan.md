---
estimated_steps: 6
estimated_files: 1
skills_used: []
---

# T02: Create server.json manifest with environment variable metadata

Generate server.json template using mcp-publisher CLI, then edit to populate environment variable declarations that MCP clients use to prompt users during installation.

Download mcp-publisher from GitHub releases (not on npm). Run `init` command in packages/mcp-server/ to generate template — it auto-detects name, description, repository, version from package.json and git context.

Manually edit environmentVariables array to declare:
- FOXHOUND_API_KEY (required, secret, format: string, description: 'Your Foxhound API key (create at foxhound.dev)')
- FOXHOUND_ENDPOINT (optional, not secret, format: string, description: 'Foxhound API endpoint (default: http://localhost:3001)')

Validate against JSON Schema to catch structural errors before attempting registry publish.

## Steps

1. Download mcp-publisher CLI: `curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz`
2. Move mcp-publisher to packages/mcp-server/: `mv mcp-publisher packages/mcp-server/`
3. Generate server.json template: `cd packages/mcp-server && ./mcp-publisher init`
4. Edit generated server.json to populate environmentVariables array:
   - Add FOXHOUND_API_KEY: `{ "name": "FOXHOUND_API_KEY", "description": "Your Foxhound API key (create at foxhound.dev)", "isRequired": true, "isSecret": true, "format": "string" }`
   - Add FOXHOUND_ENDPOINT: `{ "name": "FOXHOUND_ENDPOINT", "description": "Foxhound API endpoint (default: http://localhost:3001)", "isRequired": false, "isSecret": false, "format": "string" }`
5. Validate structure: `jq -e '.name == "io.github.caleb-love/foxhound" and .packages[0].environmentVariables | length == 2' server.json`

## Must-Haves

- [ ] mcp-publisher CLI downloaded and executable
- [ ] server.json generated with correct name field (io.github.caleb-love/foxhound)
- [ ] environmentVariables array contains FOXHOUND_API_KEY (required, secret)
- [ ] environmentVariables array contains FOXHOUND_ENDPOINT (optional, not secret)
- [ ] JSON validation passes

## Inputs

- ``packages/mcp-server/package.json``

## Expected Output

- ``packages/mcp-server/server.json``

## Verification

test -f packages/mcp-server/server.json && jq -e '.name == "io.github.caleb-love/foxhound" and .packages[0].environmentVariables | length == 2' packages/mcp-server/server.json
