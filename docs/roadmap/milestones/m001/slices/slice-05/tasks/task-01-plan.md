---
estimated_steps: 39
estimated_files: 8
skills_used: []
---

# T01: Scaffold Docusaurus 3 app with workspace integration

## Description

Create the `docs-site/` Docusaurus 3 application from scratch — package.json, docusaurus.config.ts, sidebars.ts, tsconfig.json, landing page, and workspace wiring. This unblocks all content tasks.

## Steps

1. Create `docs-site/package.json` with Docusaurus 3 dependencies: `@docusaurus/core@3.x`, `@docusaurus/preset-classic@3.x`, `@docusaurus/module-type-aliases@3.x`, `@easyops-cn/docusaurus-search-local` for search, React 18, and scripts (`start`, `build`, `clear`, `serve`). Set `name: "@foxhound-ai/docs"`, `private: true`.

2. Create `docs-site/docusaurus.config.ts` with:
   - `title: "Foxhound Docs"`, `tagline: "Compliance-grade observability for AI agent fleets"`
   - `url: "https://docs.foxhound.dev"`, `baseUrl: "/"`
   - `organizationName: "caleb-love"`, `projectName: "foxhound"`
   - Navbar with logo, title "Foxhound", links to Getting Started, API Reference, GitHub
   - Footer with links column and MIT copyright
   - `@docusaurus/preset-classic` with docs as default route (`routeBasePath: "/"`)
   - Theme config with `@easyops-cn/docusaurus-search-local` plugin
   - **Use TypeScript config format** (Docusaurus 3 supports `.ts` natively)

3. Create `docs-site/sidebars.ts` with sidebar structure:
   ```
   getting-started/ (Installation, Quickstart, First Trace)
   sdk/ (TypeScript SDK, Python SDK)
   integrations/ (LangGraph, CrewAI, Mastra, Pydantic AI, Bedrock AgentCore, Google ADK, OpenTelemetry Bridge)
   mcp-server/ (Setup, Tool Reference)
   ci-cd/ (Quality Gate Action)
   evaluation-cookbook/ (Manual Scoring, LLM-as-a-Judge, Dataset Curation, CI Quality Gates)
   ```

4. Create `docs-site/tsconfig.json` with Docusaurus-compatible settings.

5. Create `docs-site/docs/index.md` as the landing page with brief intro and links to each section.

6. Create `docs-site/static/` directory with `CNAME` file containing `docs.foxhound.dev` and copy `docs-site/static/img/` placeholder (use a simple text-based logo.svg or reference `.github/logo.svg`).

7. Create `docs-site/.npmrc` with `shamefully-hoist=true` (required for Docusaurus peer deps in pnpm).

8. Add `"docs-site"` to `pnpm-workspace.yaml` packages array.

9. Run `pnpm install` from the worktree root to install docs-site dependencies.

10. Verify: `pnpm --filter @foxhound-ai/docs build` exits 0 (with just the landing page).

## Must-Haves

- [ ] `docs-site/package.json` has Docusaurus 3 deps and build/start/serve scripts
- [ ] `docs-site/docusaurus.config.ts` configures site with correct url/baseUrl for docs.foxhound.dev
- [ ] `docs-site/sidebars.ts` defines all 6 navigation sections (skeleton — content pages added in T02/T03)
- [ ] `docs-site` added to `pnpm-workspace.yaml`
- [ ] `pnpm --filter @foxhound-ai/docs build` exits 0

## Verification

- `pnpm --filter @foxhound-ai/docs build` exits 0
- `test -f docs-site/build/index.html` passes
- `grep -q 'docs-site' pnpm-workspace.yaml` passes

## Inputs

- `pnpm-workspace.yaml`
- `.github/logo.svg`

## Expected Output

- `docs-site/package.json`
- `docs-site/docusaurus.config.ts`
- `docs-site/sidebars.ts`
- `docs-site/tsconfig.json`
- `docs-site/docs/index.md`
- `docs-site/static/CNAME`
- `docs-site/.npmrc`
- `pnpm-workspace.yaml`

## Verification

pnpm --filter @foxhound-ai/docs build && test -f docs-site/build/index.html && grep -q 'docs-site' pnpm-workspace.yaml
