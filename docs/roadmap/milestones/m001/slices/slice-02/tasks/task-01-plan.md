---
estimated_steps: 4
estimated_files: 2
skills_used: []
---

# T01: Add LICENSE, mcpName to package.json, and republish to npm

Add MIT license file and mcpName field to satisfy registry prerequisites, then bump version and republish to npm. The registry validates that package.json mcpName matches server.json name and that the npm package is accessible.

Registry convention for GitHub-authenticated packages is `io.github.<username>/<server-name>`. Use `io.github.caleb-love/foxhound` as the mcpName (matches repository ownership).

Bump version from 0.1.0 to 0.2.0 (minor bump for registry publication feature).

LICENSE file uses standard MIT license text with copyright holder 'Foxhound Contributors' and year 2026.

## Steps

1. Create `packages/mcp-server/LICENSE` with MIT license text (use standard MIT template with copyright year 2026 and holder 'Foxhound Contributors')
2. Edit `packages/mcp-server/package.json` to add `"mcpName": "io.github.caleb-love/foxhound"` field (add after `name` field for clarity)
3. Bump `version` field from "0.1.0" to "0.2.0" in package.json
4. Build the package: `cd packages/mcp-server && pnpm build`
5. Publish to npm: `npm publish` (requires npm authentication — assumes user is already logged in)
6. Verify publication: `npm view @foxhound-ai/mcp-server version` should show 0.2.0

## Must-Haves

- [ ] LICENSE file exists with MIT license text
- [ ] package.json contains mcpName field set to io.github.caleb-love/foxhound
- [ ] package.json version bumped to 0.2.0
- [ ] Package published to npm successfully
- [ ] npm view commands confirm version and mcpName are correct

## Inputs

- ``packages/mcp-server/package.json``

## Expected Output

- ``packages/mcp-server/LICENSE``
- ``packages/mcp-server/package.json``

## Verification

npm view @foxhound-ai/mcp-server version shows 0.2.0, npm view @foxhound-ai/mcp-server mcpName shows io.github.caleb-love/foxhound, and tarball contains LICENSE file
