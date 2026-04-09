# CLI & MCP Server Expansion

## Context

Foxhound has a minimal CLI (`foxhound ui` in the Python SDK) and a functional but read-only MCP server (6 trace-querying tools). Users need full CLI access to manage traces, alerts, channels, and API keys from the terminal. AI assistants need matching MCP tools to take the same actions. This spec covers expanding both to full API parity with a shared client.

## Architecture

### New packages

```
packages/
  api-client/     — shared typed HTTP client (extracted from mcp-server)
  cli/            — @foxhound-ai/cli, TypeScript, commander.js
```

### Modified packages

```
packages/
  mcp-server/     — swap internal client for @foxhound/api-client, add 11 tools
```

### Shared API Client (`packages/api-client`)

Extracted from `packages/mcp-server/src/api-client.ts`. Exports `FoxhoundApiClient` with typed methods for every API endpoint. Uses `@foxhound/types` for return types.

**Methods:**

| Group    | Methods                                                         |
| -------- | --------------------------------------------------------------- |
| Traces   | `searchTraces`, `getTrace`, `replaySpan`, `diffRuns`            |
| Alerts   | `listAlertRules`, `createAlertRule`, `deleteAlertRule`          |
| Channels | `listChannels`, `createChannel`, `testChannel`, `deleteChannel` |
| Keys     | `listApiKeys`, `createApiKey`, `revokeApiKey`                   |
| Auth     | `login`, `getMe`                                                |
| Health   | `getHealth`, `getUsage`                                         |

The client exposes both `get` and `post`/`delete` private helpers. All methods return typed responses, not `unknown`.

---

## CLI (`packages/cli`)

Published as `@foxhound-ai/cli`. Binary: `foxhound`. Uses `commander.js`.

### Authentication

`foxhound login` — prompts for API key + endpoint, stores to `~/.foxhound/config.json`:

```json
{
  "endpoint": "https://api.foxhound.dev",
  "apiKey": "fox_..."
}
```

Env vars `FOXHOUND_API_KEY` and `FOXHOUND_ENDPOINT` override the config file. Precedence: env vars > config file.

### Commands

**Auth & status:**

- `foxhound login` — store credentials
- `foxhound whoami` — show current org/user
- `foxhound status` — health check + usage summary

**Traces:**

- `foxhound traces list` — search traces (`--agent`, `--status`, `--from`, `--to`, `--limit`)
- `foxhound traces get <id>` — full span tree
- `foxhound traces diff <id-a> <id-b>` — compare two runs
- `foxhound traces replay <trace-id> <span-id>` — replay span state

**Alerts:**

- `foxhound alerts list` — list alert rules
- `foxhound alerts create` — create rule (`--event`, `--severity`, `--channel`)
- `foxhound alerts delete <id>` — delete rule

**Channels:**

- `foxhound channels list` — list notification channels
- `foxhound channels add` — add channel (`--type slack --url <webhook-url>`)
- `foxhound channels test <id>` — send test alert
- `foxhound channels delete <id>` — remove channel

**API Keys:**

- `foxhound keys list` — list active keys (masked)
- `foxhound keys create` — create key (prints plaintext once)
- `foxhound keys revoke <id>` — revoke key

### Output

- Default: human-readable tables and trees (using `chalk` for color)
- `--json` flag on all commands for machine-readable output
- `--no-color` for CI environments

---

## MCP Server Expansion (`packages/mcp-server`)

### Existing tools (unchanged)

- `foxhound_search_traces`
- `foxhound_get_trace`
- `foxhound_replay_span`
- `foxhound_diff_runs`
- `foxhound_get_anomalies`
- `foxhound_get_cost_summary`

### New tools

| Tool                         | Description                      | Mutating |
| ---------------------------- | -------------------------------- | -------- |
| `foxhound_list_alert_rules`  | List all alert rules for the org | No       |
| `foxhound_create_alert_rule` | Create a new alert rule          | Yes      |
| `foxhound_delete_alert_rule` | Delete an alert rule by ID       | Yes      |
| `foxhound_list_channels`     | List notification channels       | No       |
| `foxhound_create_channel`    | Add a Slack webhook channel      | Yes      |
| `foxhound_test_channel`      | Send a test alert to a channel   | Yes      |
| `foxhound_delete_channel`    | Remove a notification channel    | Yes      |
| `foxhound_list_api_keys`     | List active API keys (masked)    | No       |
| `foxhound_create_api_key`    | Create a new API key             | Yes      |
| `foxhound_revoke_api_key`    | Revoke an API key by ID          | Yes      |
| `foxhound_status`            | Health check + usage summary     | No       |

### Client migration

Replace internal `api-client.ts` with import from `@foxhound/api-client`. The `FoxhoundApiClient` constructor and method signatures stay the same — this is a non-breaking change for the existing tool handlers.

---

## Key files to modify

- `packages/mcp-server/src/api-client.ts` — extract to shared package, replace with re-export
- `packages/mcp-server/src/index.ts` — add 11 new tool registrations, update import
- `packages/mcp-server/package.json` — add `@foxhound/api-client` dependency
- `pnpm-workspace.yaml` — add `packages/api-client` and `packages/cli`

## Key files to create

- `packages/api-client/` — `package.json`, `tsconfig.json`, `src/index.ts` (client class), `src/types.ts` (response types)
- `packages/cli/` — `package.json`, `tsconfig.json`, `src/index.ts` (entry), `src/config.ts` (credential storage), `src/commands/` (one file per command group: `traces.ts`, `alerts.ts`, `channels.ts`, `keys.ts`, `auth.ts`, `status.ts`)

---

## Verification

1. **API client:** `pnpm --filter @foxhound/api-client build && pnpm --filter @foxhound/api-client typecheck`
2. **MCP server:** Build succeeds, existing tools still work with the new import. Run `pnpm --filter @foxhound-ai/mcp-server build`
3. **CLI:** `pnpm --filter @foxhound-ai/cli build` then test against a running local API:
   - `foxhound login` (store credentials)
   - `foxhound status` (health check)
   - `foxhound traces list` (query traces)
   - `foxhound keys list` / `foxhound keys create` (key management)
   - `foxhound alerts list` (alert rules)
4. **MCP server new tools:** Start the server via `npx @foxhound-ai/mcp-server` and verify new tools appear in Claude Code's tool list
