# Foxhound Versioning Policy

This document defines the single versioning system for the Foxhound monorepo, public packages, deployable apps, and release documentation.

## Goals

- keep version bumps predictable and explainable
- separate **workspace progress** from **public package releases**
- avoid fake precision on internal packages that are not independently consumed
- ensure published artifacts, runtime-reported versions, and docs stay in sync

## Versioning Model

Foxhound uses **SemVer 2.0.0** with two lanes:

1. **Product / workspace lane** — the repo-level version for the overall Foxhound platform
2. **Artifact lane** — independent versions for packages that are published or installed by users

## Source of Truth

### 1. Repo / platform version

The root `package.json` version is the canonical version for the overall Foxhound product/workspace:

- File: `package.json`
- Current release target: `0.1.0`

Use this version for:

- repo-level release notes
- product milestones and platform releases
- the API health/version surface when reporting platform version
- top-level changelog entries if a root changelog is maintained

### 2. Package versions

Each independently consumed package owns its own SemVer in its local `package.json`.

Current public-package candidates include:

- `packages/sdk` → `@foxhound-ai/sdk`
- `packages/mcp-server` → `@foxhound-ai/mcp-server`
- `packages/cli` → `@foxhound-ai/cli`
- `packages/api-client` → `@foxhound/api-client` if externally published/consumed
- `apps/web` only if it is released as a standalone deployable dashboard artifact with meaningful release tracking

### 3. Internal packages

Internal-only workspace packages do **not** need carefully curated public release cadence.

Examples:

- `@foxhound/db`
- `@foxhound/billing`
- `@foxhound/notifications`
- `@foxhound/types`
- `@foxhound/api`
- `@foxhound/worker`

These should still keep valid SemVer values in `package.json`, but they are treated as **implementation versions**, not marketing/release surfaces.

## SemVer Rules

### Patch bump (`x.y.Z`)

Use for backwards-compatible bug fixes and non-breaking improvements.

Examples:

- bug fix with same API/CLI behavior contract
- docs-only correction for a published package
- perf improvement with no public API change
- implementation cleanup with unchanged external behavior
- dependency/security patch with no breaking contract changes

### Minor bump (`x.Y.z`)

Use for backwards-compatible new features.

Examples:

- new SDK method
- new CLI command or flag that does not break old usage
- new MCP tools added without breaking existing tools
- new optional config fields
- expanded integration support

### Major bump (`X.y.z`)

Use for breaking changes.

Examples:

- renamed or removed exported SDK APIs
- changed CLI flags or output contract in a breaking way
- removed MCP tools or changed required tool parameters incompatibly
- changed config format requiring user action
- changed auth or transport behavior that breaks existing clients

## Pre-1.0 Rule

Foxhound is currently in `0.x` for several artifacts.

While pre-1.0, treat bumps with this discipline:

- `0.x.patch` = safe, non-breaking fix
- `0.x.minor` = potentially breaking or meaningfully expanded release

In other words: while below `1.0.0`, do **not** hide meaningful breaking changes inside a patch bump.

## Which Things Version Together

### Version independently

These should version independently because users install them separately:

- TypeScript SDK
- MCP server
- CLI
- Python SDK (in its own packaging system)
- API client if published externally

### Do not force lockstep versioning

Do **not** require every package in the monorepo to share one version.

Why:

- the SDK may ship multiple times without a platform release
- the MCP server may ship registry fixes without SDK changes
- internal packages change frequently and should not force noisy public bumps

### Version together only when necessary

If a release requires coordinated changes across multiple public artifacts, bump each impacted artifact intentionally and mention the coordination in release notes.

## Runtime Version Reporting Rules

To prevent drift, any user-facing runtime version should come from package metadata, not a hardcoded string.

### Required rule

Do **not** hardcode versions in runtime code when the artifact already has a package version.

Prefer:

- reading from local `package.json` at build/runtime when practical
- injecting the version at build time
- maintaining one source of truth per artifact

### Applies to

- API `/health` version output
- CLI `.version(...)`
- MCP server reported server version
- registry metadata such as `server.json`
- docs that claim current package versions

## Release Classification

### A. Platform release

A platform release updates the root repo/product version and may include multiple apps/packages.

Trigger this when:

- the hosted product meaningfully changes
- multiple subsystems ship together as one notable release
- you want a canonical product release identifier

Update:

- root `package.json`
- root/platform changelog or release notes
- any platform version surfaces derived from root version

### B. Package release

A package release updates only the affected package version(s).

Trigger this when:

- publishing SDK/CLI/MCP/package updates to npm or registry
- shipping consumer-facing changes without a broader platform release

Update:

- the package’s `package.json`
- package-specific changelog if present
- package-specific manifests (for example `server.json` for MCP)
- any runtime version surfaces for that package

### C. Internal change only

If no public artifact is being released, do not bump versions just because code changed.

Examples:

- internal refactor
- tests only
- docs only for internal workflow
- internal package changes not being published independently

## Required Sync Rules

When bumping a version, update all matching surfaces in the same change.

### TypeScript SDK

When `packages/sdk/package.json` changes, also review:

- `packages/sdk/CHANGELOG.md`
- docs-site install/version references
- README badges/examples if version-specific

### CLI

When `packages/cli/package.json` changes, also update:

- `packages/cli/src/index.ts` if version is manually declared
- docs referencing install/version

### MCP Server

When `packages/mcp-server/package.json` changes, also update:

- `packages/mcp-server/server.json`
- `packages/mcp-server/PUBLISH.md`
- runtime server version in `packages/mcp-server/src/index.ts` if manually declared

### API / Platform

When root `package.json` changes for a platform release, also update:

- API-reported version surfaces
- product release docs/changelog if applicable

## Current Release Baseline

The current intended baseline for this release is:

- root platform: `0.1.0`
- `@foxhound-ai/sdk`: `0.3.0`
- `@foxhound-ai/mcp-server`: `0.3.0`
- `@foxhound-ai/cli`: `0.1.0`
- `@foxhound/api-client`: `0.1.0`

## Current Cleanup Targets

The repo previously contained version drift risks in these places:

- `apps/api/src/index.ts` for API version reporting
- `packages/cli/src/index.ts` for CLI version reporting
- `packages/mcp-server/src/index.ts` for MCP runtime version reporting
- `packages/mcp-server/server.json` for registry metadata sync

These surfaces should remain aligned whenever versions change.

## Release Workflow

### For a package release

1. Decide release scope: patch / minor / major
2. Bump the package version in its `package.json`
3. Update all synced manifests/runtime version surfaces
4. Update changelog/release notes for that artifact
5. Run targeted verification for the package
6. Publish/tag/release

### For a platform release

1. Decide release scope at root
2. Bump root `package.json`
3. Update any platform version surfaces
4. Summarize notable changes across apps/packages
5. Run repo-level verification appropriate to the release
6. Tag the release

## Practical Bump Guidance

### Bump the root version when

- the product/platform as a whole is being announced or released
- the API/backend/dashboard meaningfully changed as one release unit
- you want one canonical release number for the hosted product

### Bump SDK/CLI/MCP versions when

- their published installable artifacts changed
- users who install them would receive different behavior
- docs/examples/changelog need a new distributable release

### Do not bump everything on every merge

That creates noise, drift, and fake release semantics.

## Recommended Near-Term Policy for Foxhound

Given the current repo shape, use this policy now:

- Root `package.json` = overall Foxhound platform version
- `@foxhound-ai/sdk` = independent SemVer
- `@foxhound-ai/mcp-server` = independent SemVer
- `@foxhound-ai/cli` = independent SemVer
- `@foxhound/api-client` = independent SemVer only if treated as a real external package
- internal packages/apps keep valid versions but only bump when there is an operational reason
- do not bump every package on every merge to `main`
- when cutting a public release, update runtime/manifests in the same change so no artifact reports stale versions

## Documentation Rule

When docs mention a versioning workflow, link to this file instead of re-explaining the policy from scratch.

## Maintainer Checklist

Before merging a release-related PR:

- [ ] Did I classify this as platform release vs package release vs internal-only change?
- [ ] Did I bump only the versions that actually need bumping?
- [ ] Did I update all synced manifests and runtime version surfaces?
- [ ] Did I avoid hardcoded drift where possible?
- [ ] Did I update release notes/changelog/docs where relevant?
- [ ] Did I verify the changed artifact(s)?
