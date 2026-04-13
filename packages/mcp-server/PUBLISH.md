# Publishing to MCP Registry

This document describes how to publish the Foxhound MCP server to the Model Context Protocol Registry.

## Prerequisites

1. Package must be published to npm first (already done for the most recent release cut; example shown here should match the current package version)
2. `server.json` manifest must be present and valid (✓ committed)
3. GitHub account with access to authenticate

## Publishing Steps

### 1. Authenticate to MCP Registry

```bash
cd packages/mcp-server
./mcp-publisher login github
```

This will:

- Display a URL: https://github.com/login/device
- Display a device code (e.g., BB16-AC43)
- Wait for authorization

**Action:** Open the URL in a browser, enter the code, and authorize the application.

### 2. Publish to Registry

Once authenticated:

```bash
./mcp-publisher publish
```

This will:

- Validate that `mcpName` in package.json matches `name` in server.json
- Verify the npm package exists at the declared version
- Submit metadata to the MCP Registry

### 3. Verify Publication

Check that the server appears in the registry:

```bash
curl -s 'https://registry.modelcontextprotocol.io/v0/servers?search=foxhound' | jq '.servers[] | select(.name == "io.github.caleb-love/foxhound")'
```

Expected output:

```json
{
  "name": "io.github.caleb-love/foxhound",
  "description": "MCP server for querying Foxhound traces from Claude Code, Cursor, and other MCP clients",
  "version": "0.3.0",
  ...
}
```

### 4. Test Installation

Once published, users can install via:

```bash
# Claude Code (if registry name resolution is supported)
claude mcp add io.github.caleb-love/foxhound

# Or via npm package name
claude mcp add foxhound -- npx @foxhound-ai/mcp-server
```

## Troubleshooting

### Authentication Timeout

If `mcp-publisher login github` times out, ensure:

- GitHub is accessible
- You complete the OAuth flow within 120 seconds
- You have a GitHub account and are logged in

### Validation Errors

If `mcp-publisher publish` fails validation:

- Ensure `mcpName` in package.json matches `name` in server.json (both should be `io.github.caleb-love/foxhound`)
- Verify npm package exists: `npm view @foxhound-ai/mcp-server version`
- Check server.json schema: `cat server.json | jq .`

### Server Not Found in Registry

If the registry search returns empty:

- Wait a few minutes for indexing
- Check registry status: https://registry.modelcontextprotocol.io/status
- Verify publish succeeded without errors

## Maintenance

### Publishing Updates

When publishing a new version:

1. Bump version in `package.json` and `server.json`
2. Publish to npm: `npm publish`
3. Publish to registry: `./mcp-publisher publish`

The registry will update with the new version metadata.
