# World-Class Claude Code Hooks for Foxhound

**Date:** 2026-04-11
**Author:** Claude (Opus 4.6) + Caleb
**Status:** ALL SPRINTS COMPLETE — 17 hooks implemented, tested, and registered

---

## Executive Summary

Foxhound is a multi-tenant observability platform handling customer telemetry data and API keys. A single org_id bypass exposes every customer's data. A single secret leak in a commit is irrecoverable.

The current hook setup is strong on **global developer hygiene** (formatting, commit conventions, console.log detection, governance capture) but has almost no **Foxhound-specific enforcement**. The only project-level hook is `enforce-commit-convention.js`.

This plan proposes **17 hooks across 4 tiers**, each designed to catch a specific class of defect *before* it reaches a commit. Every hook is justified by a real pattern found in the codebase audit.

---

## Current Coverage Audit

### What's Already Covered (Global — ~/.claude/settings.json)

| Category | Hook | Type | Coverage |
|----------|------|------|----------|
| Git safety | block-no-verify | PreToolUse/Bash | Blocks `--no-verify` |
| Git safety | git-push-reminder | PreToolUse/Bash | Confirms before push |
| Commit quality | pre-bash-commit-quality | PreToolUse/Bash | Staged file lint, secrets, console.log |
| Commit convention | enforce-commit-convention (project) | PreToolUse/Bash | Foxhound commit format |
| Formatting | quality-gate | PostToolUse/Edit\|Write | Auto-format per language |
| Formatting | stop-format-typecheck | Stop | Batch format + tsc |
| Config protection | config-protection | PreToolUse/Edit\|Write | Blocks linter config edits |
| Governance | governance-capture | Pre+Post | Secret detection, approval commands |
| Design quality | design-quality-check | PostToolUse/Edit\|Write | Frontend quality |
| Debug cleanup | check-console-log | Stop | Audits console.log |
| Debug cleanup | post-edit-console-warn | PostToolUse/Edit | Warns on console.log |
| Session mgmt | session-start-bootstrap | SessionStart | Context loading |
| Session mgmt | session-activity-tracker | PostToolUse | Track activity |
| Notifications | desktop-notify | Stop | macOS notification |
| Cost | cost-tracker | Stop | Session cost tracking |
| Compaction | pre-compact | PreCompact | Pre-compaction state save |
| Context | suggest-compact | PreToolUse/Edit\|Write | Suggest compaction |
| Doc guard | doc-file-warning | PreToolUse/Write | Warn on doc writes |

### What's Missing — The Gaps

**No enforcement of:**
- Multi-tenancy (org_id scoping) in DB queries
- Auth verification in route handlers
- Worker job tenant isolation
- SQL injection / raw SQL patterns
- Migration safety
- Test coverage for security-critical paths
- File size limits
- API response consistency
- Cross-resource ownership validation
- Dependency auditing
- Planning discipline

---

## Proposed Hooks

### Tier 1: Security-Critical (MUST HAVE)

These hooks prevent the defects that would be catastrophic for a multi-tenant platform.

---

#### Hook 1: `multi-tenancy-guard.js`

**Type:** PostToolUse on Edit|Write
**Trigger:** Files matching `packages/db/src/queries*.ts` or `apps/api/src/routes/*.ts`
**Action:** WARN (stderr message, exit 0)

**What it catches:**
```typescript
// BAD — query function without orgId parameter
export async function getTrace(id: string) {
  return db.select().from(traces).where(eq(traces.id, id));
}

// GOOD — org-scoped
export async function getTrace(id: string, orgId: string) {
  return db.select().from(traces).where(
    and(eq(traces.id, id), eq(traces.orgId, orgId))
  );
}
```

**Detection logic:**
1. Read the file content after edit
2. Find all exported async functions in query files
3. Check if functions that reference a table with `orgId` column also accept an `orgId` parameter
4. For route files, check that `request.orgId` is used in every route handler
5. Warn (not block) with specific line numbers

**Why WARN not BLOCK:** Some queries legitimately skip org_id (e.g., internal admin, migration scripts). Blocking would create false positives. The warning injects a message into Claude's context so it self-corrects.

**Real example found in audit:**
- `listDatasetItems()` in experiments.ts loads items with `limit: 10000` but doesn't verify the dataset belongs to the requesting org
- `getExperimentComparison()` takes experiment ID arrays without cross-org validation

---

#### Hook 2: `route-auth-guard.js`

**Type:** PostToolUse on Edit|Write
**Trigger:** Files matching `apps/api/src/routes/*.ts` (not test files)
**Action:** WARN

**What it catches:**
- Route handlers that never reference `request.orgId`
- Route handlers that use `request.params` with `as` type assertions instead of Zod validation
- Routes that access DB without passing orgId

**Detection logic:**
1. Parse route handler functions (fastify.get/post/put/delete/patch callbacks)
2. For each handler, check if `request.orgId` appears in the body
3. Check if params are validated with Zod or just cast with `as`
4. Emit warning with the specific route path and missing checks

**Real example found in audit:**
- Route param parsing uses `as { id: string }` type assertion without validation — if param is missing, Fastify provides undefined, causing 500 later

---

#### Hook 3: `secret-blocker.js`

**Type:** PreToolUse on Edit|Write
**Trigger:** Files matching `*.ts`, `*.js`, `*.json`, `*.yaml`, `*.yml`, `*.env*`
**Action:** BLOCK (exit 2)

**What it catches:**
```typescript
// BLOCKED — hardcoded connection strings
const DATABASE_URL = "postgresql://user:pass@host:5432/db";

// BLOCKED — hardcoded API keys
const STRIPE_KEY = "sk_live_xxxxx";

// BLOCKED — hardcoded JWT secrets
const JWT_SECRET = "my-super-secret-key";

// ALLOWED — env references
const DATABASE_URL = process.env.DATABASE_URL;
```

**How it differs from governance-capture:** Governance capture **logs** secret detection events. This hook **blocks the edit entirely**. Defense in depth — governance captures what slips through; this prevents the slip.

**Detection patterns (Foxhound-specific):**
- `postgresql://` or `postgres://` with credentials in source files
- `sk_live_`, `sk_test_`, `pk_live_`, `pk_test_` (Stripe)
- `AKIA` prefix (AWS)
- `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_` (GitHub tokens)
- `neon://` connection strings (Neon Postgres)
- `redis://` with password (Upstash)
- `JWT_SECRET` or `SESSION_SECRET` assigned to a string literal
- Private key blocks (`-----BEGIN`)

**Excludes:** `.env.example`, test fixtures, documentation files

---

#### Hook 4: `sql-injection-scanner.js`

**Type:** PostToolUse on Edit|Write
**Trigger:** Files matching `packages/db/**/*.ts` or `apps/api/**/*.ts`
**Action:** WARN

**What it catches:**
```typescript
// DANGEROUS — template literal SQL with unparameterized input
db.execute(sql`SELECT * FROM traces WHERE org_id = '${orgId}'`);

// DANGEROUS — string concatenation in queries
const query = "SELECT * FROM " + tableName + " WHERE id = " + id;

// SAFE — Drizzle's parameterized approach
db.select().from(traces).where(eq(traces.orgId, orgId));

// SAFE — Drizzle sql template (auto-parameterized)
db.execute(sql`SELECT * FROM traces WHERE org_id = ${orgId}`);
// (Drizzle's sql tag parameterizes automatically, but we still flag for review)
```

**Detection logic:**
1. Scan for string concatenation patterns that look like SQL
2. Scan for `sql` tagged template literals with `'${...}'` (quoted interpolation, which bypasses parameterization)
3. Scan for raw `db.execute()` with non-`sql`-tagged strings
4. Warn with line numbers and suggest the Drizzle query builder pattern

---

#### Hook 5: `env-safety-guard.js`

**Type:** PreToolUse on Edit|Write
**Trigger:** Files matching `.env`, `.env.*` (not `.env.example`)
**Action:** BLOCK (exit 2)

**What it catches:**
- Direct writes to `.env` files (should use `.env.example` + local overrides)
- Writing production credentials to version-controlled files

**Why:** `.env` files should never be committed. `.env.example` is the template. This hook prevents Claude from accidentally creating or modifying `.env` files that could get committed.

---

### Tier 2: Quality & Correctness (HIGH VALUE)

These hooks catch defects that degrade quality, correctness, or reliability.

---

#### Hook 6: `test-companion-enforcer.js`

**Type:** PreToolUse on Bash (git commit)
**Trigger:** When committing changes to security-critical files
**Action:** WARN

**What it catches:**
- Changes to `apps/api/src/routes/*.ts` without corresponding changes to `*.test.ts`
- Changes to `packages/db/src/queries*.ts` without test updates
- Changes to `apps/api/src/plugins/auth.ts` without test updates
- Changes to `apps/worker/src/queues/*.ts` without test updates

**Detection logic:**
1. Get staged files from `git diff --cached`
2. For each security-critical file, check if a corresponding `.test.ts` is also staged
3. If not, emit a warning: "Security-critical file {path} was modified but its test file was not updated"

**Why WARN not BLOCK:** Sometimes test changes are in a separate commit. The warning ensures Claude doesn't forget to write tests but doesn't force a particular commit structure.

---

#### Hook 7: `file-size-guard.js`

**Type:** PreToolUse on Write
**Trigger:** All Write tool calls
**Action:** BLOCK (exit 2) at 800 lines

**What it catches:**
- New files or complete rewrites exceeding 800 lines
- Prevents monolithic files that are hard to review and maintain

**Detection logic:**
1. Parse the `content` from the Write tool input
2. Count lines
3. If > 800 lines, block with message: "File exceeds 800 lines ({count} lines). Split into smaller modules."

**Note:** The global rules mention an 800-line limit but it's not enforced at the project level. This makes it real.

---

#### Hook 8: `migration-safety-gate.js`

**Type:** PreToolUse on Bash
**Trigger:** Commands containing `drizzle-kit`, `pnpm db:migrate`, `pnpm db:push`
**Action:** WARN

**What it catches:**
- Running `drizzle-kit push` (dangerous — applies schema directly)
- Running `drizzle-kit drop` (destructive)
- Running migrations without confirmation

**Detection logic:**
1. Match bash command against drizzle-kit patterns
2. For `push` and `drop` commands, emit a strong warning
3. For `generate`, just log it (safe — generates SQL files)
4. For `migrate`, warn to review the migration SQL first

---

#### Hook 9: `worker-org-validator.js`

**Type:** PostToolUse on Edit|Write
**Trigger:** Files matching `apps/worker/src/queues/*.ts`
**Action:** WARN

**What it catches:**
```typescript
// BAD — blindly trusting job.data.orgId
async function process(job: Job) {
  const { orgId, agentId } = job.data;
  await updateAgentCost(orgId, agentId, cost); // No re-validation!
}

// GOOD — re-validate before using
async function process(job: Job) {
  const { orgId, agentId } = job.data;
  const agent = await getAgentConfig(orgId, agentId);
  if (!agent) throw new Error("Invalid job: agent not found for org");
  await updateAgentCost(orgId, agentId, cost);
}
```

**Detection logic:**
1. Find job processor functions
2. Check if `orgId` from `job.data` is used to fetch/verify a resource before business logic
3. Warn if orgId is used directly in writes without prior validation read

---

#### Hook 10: `api-response-envelope.js`

**Type:** PostToolUse on Edit|Write
**Trigger:** Files matching `apps/api/src/routes/*.ts` (not test files)
**Action:** WARN

**What it catches:**
- Routes returning raw objects instead of the standard response envelope
- Inconsistent error response formats
- Missing status codes on error responses

**Detection logic:**
1. Scan for `reply.send()` and `reply.code().send()` calls
2. Check if error responses include `{ error: ... }` structure
3. Check if success responses include the data directly (acceptable) or wrapped
4. Warn on inconsistencies within the same file

---

### Tier 3: Developer Experience (NICE TO HAVE)

These hooks improve the development workflow and catch common mistakes.

---

#### Hook 11: `dependency-audit.js`

**Type:** PreToolUse on Bash
**Trigger:** Commands containing `pnpm add`, `pnpm install` (with package names)
**Action:** WARN

**What it catches:**
- Adding new dependencies without review
- Adding dependencies with known vulnerabilities

**Detection logic:**
1. Match `pnpm add` commands
2. Extract package names
3. Warn: "Adding new dependency {package}. Verify it's maintained, license-compatible, and necessary."
4. For `pnpm add -D` (dev deps), reduce severity

---

#### Hook 12: `cross-package-import-guard.js`

**Type:** PostToolUse on Edit|Write
**Trigger:** Files in `packages/` or `apps/`
**Action:** WARN

**What it catches:**
```typescript
// BAD — relative import crossing package boundary
import { something } from "../../../packages/db/src/schema";

// GOOD — workspace import
import { something } from "@foxhound/db";
```

**Detection logic:**
1. Scan import statements in the edited file
2. Flag relative imports that traverse into a different workspace package
3. Suggest the `@foxhound/*` workspace import instead

---

#### Hook 13: `type-assertion-guard.js`

**Type:** PostToolUse on Edit|Write
**Trigger:** Files matching `apps/api/src/routes/*.ts`
**Action:** WARN

**What it catches:**
```typescript
// BAD — type assertion on request params (unsafe)
const { id } = request.params as { id: string };

// GOOD — Zod validation
const { id } = routeParamsSchema.parse(request.params);
```

**Detection logic:**
1. Scan for `request.params as` or `request.query as` patterns
2. Warn: "Use Zod validation instead of type assertions for request params"

---

#### Hook 14: `unused-import-detector.js`

**Type:** PostToolUse on Edit|Write
**Trigger:** `.ts` and `.tsx` files
**Action:** WARN

**What it catches:**
- Imports that are no longer referenced in the file after an edit
- Common after refactoring when imports are left behind

**Detection logic:**
1. Parse import statements
2. For each imported identifier, check if it appears in the file body
3. Warn about unused imports (TypeScript will also catch these, but the hook gives immediate feedback)

**Note:** This overlaps with the stop-format-typecheck hook. Consider whether the immediate feedback justifies the overhead.

---

### Tier 4: Planning & Process (META-HOOKS)

These hooks enforce the development workflow itself.

---

#### Hook 15: `plan-before-code.js`

**Type:** PostToolUse on Edit|Write
**Trigger:** When creating new files in `apps/` or `packages/` (not test files)
**Action:** WARN (stderr message injected into Claude's context)

**What it catches:**
- Starting implementation without a plan document
- Creating new feature files without a corresponding `docs/plans/*.md`

**Detection logic:**
1. Check if the Write tool is creating a new file (not editing existing)
2. Check if the file is in a "feature" path (apps/, packages/src/)
3. Look for a recent plan document in `docs/plans/` (created within the last hour)
4. If no plan exists, warn: "New implementation file created without a plan. Consider using /plan or /autoplan first."

**Why this matters:** The CLAUDE.md says "every task gets a plan before execution." This hook makes it real.

---

#### Hook 16: `branch-naming-convention.js`

**Type:** PreToolUse on Bash
**Trigger:** Commands containing `git checkout -b` or `git switch -c`
**Action:** WARN

**What it catches:**
```bash
# BAD
git checkout -b my-feature
git checkout -b FEATURE-123

# GOOD
git checkout -b feat/add-prompt-management
git checkout -b fix/org-id-scoping-in-datasets
```

**Detection logic:**
1. Extract branch name from the command
2. Validate against pattern: `^(feat|fix|refactor|docs|test|chore|perf|ci)/[a-z0-9-]+$`
3. Warn if branch name doesn't match convention

---

#### Hook 17: `changelog-reminder.js`

**Type:** PostToolUse on Bash (after git commit succeeds)
**Trigger:** Commits with `feat:` or `fix:` prefix
**Action:** WARN

**What it catches:**
- Feature or fix commits without changelog updates
- Helps maintain a user-facing changelog

**Detection logic:**
1. After a successful `git commit`, check if the commit message starts with `feat:` or `fix:`
2. Check if `CHANGELOG.md` was included in the commit
3. If not, warn: "Feature/fix commit without changelog update. Consider updating CHANGELOG.md."

---

## Implementation Priority

### Sprint 1: Security Foundation (Do First)

| # | Hook | Type | Effort | Impact |
|---|------|------|--------|--------|
| 3 | secret-blocker | PreToolUse/Edit\|Write | Low | Critical |
| 5 | env-safety-guard | PreToolUse/Edit\|Write | Low | Critical |
| 1 | multi-tenancy-guard | PostToolUse/Edit\|Write | Medium | Critical |
| 2 | route-auth-guard | PostToolUse/Edit\|Write | Medium | Critical |

**Rationale:** These four hooks protect the two most catastrophic failure modes — data leaks and secret exposure. They're the highest ROI.

### Sprint 2: Quality Gates

| # | Hook | Type | Effort | Impact |
|---|------|------|--------|--------|
| 4 | sql-injection-scanner | PostToolUse/Edit\|Write | Medium | High |
| 6 | test-companion-enforcer | PreToolUse/Bash | Low | High |
| 7 | file-size-guard | PreToolUse/Write | Low | Medium |
| 9 | worker-org-validator | PostToolUse/Edit\|Write | Medium | High |

**Rationale:** These hooks catch correctness issues that could slip through code review. The test companion enforcer is especially important — security-critical code without tests is a ticking bomb.

### Sprint 3: DX & Process

| # | Hook | Type | Effort | Impact |
|---|------|------|--------|--------|
| 8 | migration-safety-gate | PreToolUse/Bash | Low | Medium |
| 10 | api-response-envelope | PostToolUse/Edit\|Write | Medium | Medium |
| 11 | dependency-audit | PreToolUse/Bash | Low | Medium |
| 12 | cross-package-import-guard | PostToolUse/Edit\|Write | Medium | Medium |
| 13 | type-assertion-guard | PostToolUse/Edit\|Write | Low | Medium |

### Sprint 4: Meta & Polish

| # | Hook | Type | Effort | Impact |
|---|------|------|--------|--------|
| 15 | plan-before-code | PostToolUse/Edit\|Write | Low | Medium |
| 16 | branch-naming-convention | PreToolUse/Bash | Low | Low |
| 17 | changelog-reminder | PostToolUse/Bash | Low | Low |
| 14 | unused-import-detector | PostToolUse/Edit\|Write | Medium | Low |

---

## Architecture Decisions

### Where hooks live

All Foxhound-specific hooks go in `.claude/hooks/` (project-level, committed to repo). Global hooks stay in `~/.claude/scripts/hooks/` (personal, not committed).

```
.claude/
  hooks/
    enforce-commit-convention.js    # (existing)
    multi-tenancy-guard.js          # NEW
    route-auth-guard.js             # NEW
    secret-blocker.js               # NEW
    sql-injection-scanner.js        # NEW
    env-safety-guard.js             # NEW
    test-companion-enforcer.js      # NEW
    file-size-guard.js              # NEW
    migration-safety-gate.js        # NEW
    worker-org-validator.js         # NEW
    api-response-envelope.js        # NEW
    dependency-audit.js             # NEW
    cross-package-import-guard.js   # NEW
    type-assertion-guard.js         # NEW
    plan-before-code.js             # NEW
    branch-naming-convention.js     # NEW
    changelog-reminder.js           # NEW
  settings.json                     # Hook registration
```

### WARN vs BLOCK philosophy

- **BLOCK (exit 2):** Only for things that are *always* wrong — hardcoded secrets, .env file writes, oversized files. Zero false positive tolerance.
- **WARN (exit 0 + stderr):** For patterns that are *usually* wrong but have legitimate exceptions. The warning injects into Claude's context, causing self-correction without halting the workflow.

### Performance budget

Each hook should complete in < 500ms. Total hook overhead per tool call should not exceed 2s. All hooks that scan file content should:
1. Only process files matching their trigger patterns
2. Exit immediately if the file doesn't match
3. Use line-by-line scanning, not full AST parsing
4. Cap stdin reading at 1MB

### stdin protocol

All hooks follow the Claude Code hook protocol:
1. Read JSON from stdin (tool_name, tool_input, tool_output)
2. Process the relevant fields
3. Write original JSON to stdout (pass-through)
4. Write warnings/errors to stderr
5. Exit 0 (allow) or 2 (block)

---

## Expected Outcomes

### Before (current state)
- Multi-tenancy enforced by code review conventions only
- Secrets detected by governance-capture but not blocked
- No enforcement of test coverage for security paths
- No file size limits enforced
- No migration safety nets
- No planning discipline enforcement

### After (with all hooks)
- Multi-tenancy violations caught at write time, before commit
- Secrets physically blocked from entering source files
- Security-critical code changes flagged if tests are missing
- File size limits enforced at 800 lines
- Dangerous migration commands require explicit acknowledgment
- Planning reminders before new implementation work

### Metrics to track
- Hook fire rate (how often each hook triggers)
- Block rate (how often blocking hooks prevent a defect)
- False positive rate (how often warnings are ignored as irrelevant)
- Time-to-feedback (hook execution latency)

---

## Open Questions

1. **Should multi-tenancy-guard be BLOCK or WARN?** Blocking prevents all org_id bypasses but may have false positives for admin/migration code.

2. **Should we add a pre-deploy hook?** A Stop hook that runs `pnpm build && pnpm test` before session end ensures nothing is left broken. The global stop-format-typecheck already does format + tsc, but doesn't run tests.

3. **Should worker-org-validator be more aggressive?** Currently it warns; it could block if the detection heuristic is reliable enough.

4. **What about a `drizzle-schema-guard`?** Could warn when schema changes don't include a corresponding migration file.

5. **Rate limiting on warnings?** If a hook fires 20 times in a session, should it suppress after N warnings to avoid noise?
