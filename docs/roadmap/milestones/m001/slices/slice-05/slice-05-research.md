# S05 — Documentation Site — Research

**Date:** 2026-04-10

## Summary

S05 must deliver a `docs-site/` Docusaurus app at `docs.foxhound.dev` containing: getting started guides, MCP server reference, GitHub Actions reference, SDK reference (TypeScript + Python), and an evaluation cookbook. The strategic roadmap spec (`docs/superpowers/specs/2026-04-10-foxhound-strategic-roadmap-design.md`) explicitly names Docusaurus as the framework and `docs-site/` as the target directory. No docs-site directory exists yet — this is a greenfield build.

All content already exists in source form. The Python SDK README (`packages/sdk-py/README.md`) contains complete quickstart code for LangGraph, CrewAI, manual tracing, and all four OTel bridge frameworks. The TypeScript SDK README (`packages/sdk/README.md`) covers quickstart, Mastra, and the OTel bridge. The MCP server README (`packages/mcp-server/README.md`) documents all 30 tools and setup across Claude Code, Cursor, and Windsurf. The quality gate action README (described in S03 task summaries; files exist on disk at `.github/actions/quality-gate/README.md` but not git-tracked) documents CI/CD integration. S05's job is to structure this existing content into navigable Docusaurus pages — not write new content from scratch.

The docs site is marked **low risk** because: all source material exists, Docusaurus is a well-known static site generator with zero novel integration work, and there are no backend dependencies. The primary work is scaffolding the Docusaurus project, importing/adapting markdown content, configuring navigation, and adding a GitHub Actions deploy workflow.

## Recommendation

Use **Docusaurus 3** (the current stable major version). The strategic roadmap already specified Docusaurus. It handles MDX, versioning, sidebar autogeneration, and search out of the box. Docusaurus v3 uses React 18 and is the current active release. Add `docs-site/` to the pnpm workspace and turbo pipeline. Deploy via GitHub Actions to GitHub Pages (zero infrastructure cost, consistent with the existing `deploy.yml` pattern which deploys the API to Fly.io separately). The `docs.foxhound.dev` subdomain can be pointed at the GitHub Pages URL via a CNAME.

Do NOT add a new hosting service (Vercel, Netlify) — the project already uses Fly.io for the API and the docs are static. GitHub Pages is the simplest path and the existing CI pattern (`.github/workflows/*.yml`) is already established.

## Implementation Landscape

### Key Files

- `docs-site/` — New directory; entire Docusaurus app lives here
- `docs-site/docusaurus.config.ts` — Site config: title "Foxhound Docs", url `https://docs.foxhound.dev`, baseUrl `/`, GitHub Pages org/repo, navbar, footer links, algolia search (optional)
- `docs-site/sidebars.ts` — Sidebar navigation tree; hand-authored to control order
- `docs-site/docs/` — All documentation markdown pages
- `docs-site/docs/getting-started/` — Installation, quickstart, `foxhound init`, first trace
- `docs-site/docs/sdk/` — TypeScript SDK reference + Python SDK reference pages
- `docs-site/docs/integrations/` — Per-framework pages (LangGraph, CrewAI, Mastra, Pydantic AI, Bedrock AgentCore, Google ADK, OTel bridge)
- `docs-site/docs/mcp-server/` — MCP tool reference, setup for Claude Code/Cursor/Windsurf
- `docs-site/docs/ci-cd/` — GitHub Actions quality gate reference
- `docs-site/docs/evaluation-cookbook/` — Cookbook pages: manual scoring, LLM-as-a-Judge, dataset curation, CI quality gates
- `docs-site/package.json` — Docusaurus 3 dependencies; scoped to `docs-site/` workspace package
- `docs-site/tsconfig.json` — Docusaurus requires its own tsconfig
- `pnpm-workspace.yaml` — Add `"docs-site"` to packages array (already has `.github/actions/*`)
- `.github/workflows/docs.yml` — New workflow: build + deploy to GitHub Pages on push to main
- `turbo.json` — Optionally add docs-site to the build pipeline (or leave standalone)

### Content Sources (already written — import and adapt)

| Doc Section | Source |
|-------------|--------|
| Python quickstart (LangGraph, CrewAI, manual) | `packages/sdk-py/README.md` |
| Python OTel bridge (Pydantic AI, Bedrock, Google ADK) | `packages/sdk-py/README.md` |
| TypeScript quickstart + Mastra OTel bridge | `packages/sdk/README.md` |
| MCP server setup (all IDEs), 30 tool reference | `packages/mcp-server/README.md` |
| GitHub Actions quality gate | `.github/actions/quality-gate/README.md` (on disk, not in git) |
| Evaluation cookbook concepts | S01 task summaries + MCP tool descriptions from `packages/mcp-server/src/index.ts` |

### Build Order

1. **Scaffold Docusaurus app** (`docs-site/` init, config, sidebar skeleton, package.json) — unblocks all content work; must go first because everything else depends on the directory structure existing.
2. **Import and adapt content pages** — Copy/reorganize existing markdown from SDK READMEs and MCP server README into the Docusaurus docs tree. Split monolithic READMEs into per-topic pages. This is the bulk of the work.
3. **Write evaluation cookbook** — This is the only content section without a direct source. Must synthesize from MCP tool descriptions (scoring, evaluators, datasets, curate_dataset) plus S03 quality gate docs.
4. **Add GitHub Actions deploy workflow** (`docs.yml`) — Wire GitHub Pages deployment; requires docs-site to build cleanly first.
5. **Verify end-to-end** — `pnpm --filter docs-site build` produces static output with no broken links; workflow deploys successfully.

### Verification Approach

- `pnpm --filter docs-site build` exits 0 with `docs-site/build/` populated
- `pnpm --filter docs-site start` serves locally at `localhost:3000` showing all pages
- `pnpm --filter docs-site build 2>&1 | grep -i "broken"` returns no broken internal links
- GitHub Actions `docs.yml` workflow runs to completion on push (or dry-run locally with `act`)

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| Static site generation | Docusaurus 3 | Already specified in roadmap; handles sidebar, search, MDX, dark mode, versioning out of the box |
| Search | Docusaurus local search plugin (`@easyops-cn/docusaurus-search-local`) | Free, no Algolia account needed for MVP; one package.json entry |
| GitHub Pages deploy | `peaceiris/actions-gh-pages@v3` or native `actions/deploy-pages@v2` | Established GHA pattern; zero new hosting infra |

## Constraints

- **`docs-site/` is not an app** — it should not be added to `apps/` (that directory is for API + worker). Add to `packages/` OR as a top-level sibling. The strategic roadmap says `docs-site/` at root level.
- **pnpm workspace** — Must add `"docs-site"` to `pnpm-workspace.yaml`. The workspace already has the `.github/actions/*` pattern from S03; follow the same pattern.
- **No TypeScript compilation in turbo** — Docusaurus builds with `docusaurus build`, not `tsc`. The turbo.json `build` task uses `outputs: ["dist/**"]` but Docusaurus outputs to `build/`. If adding to turbo, configure the correct output glob or leave it out of turbo and only invoke from the GHA workflow.
- **S03 action files** — The quality gate README exists on disk at `.github/actions/quality-gate/README.md` but is not git-tracked. S05 tasks should read from this path (it exists in the worktree) without relying on git history.
- **GitHub Pages CNAME** — Requires adding a `CNAME` file to `docs-site/static/` containing `docs.foxhound.dev` and configuring the DNS record. The GHA workflow handles the file deployment; DNS config is manual (outside scope of code).

## Common Pitfalls

- **Docusaurus version mismatch** — Use `@docusaurus/core@3.x` not v2; v2 uses CommonJS config (`docusaurus.config.js`) while v3 supports TypeScript config (`docusaurus.config.ts`). Start with TypeScript from the beginning.
- **baseUrl vs url** — For GitHub Pages with custom domain: `url: "https://docs.foxhound.dev"`, `baseUrl: "/"`. Without custom domain it would be `baseUrl: "/foxhound/"`. Get this right before deploying or all asset links break.
- **pnpm + Docusaurus peer deps** — Docusaurus has strict React version requirements. Set `shamefully-hoist=true` in `.npmrc` inside `docs-site/` or use `pnpm --filter docs-site install` with `--shamefully-hoist` if peer dep warnings appear.
- **turbo output glob** — If adding to turbo, use `outputs: ["build/**"]` not `dist/**` for the docs-site build task.
- **MCP tool reference breadth** — There are 30 MCP tools. Don't list them all in a single wall-of-text page; group into the same categories as the implementation (trace querying, failure analysis, scoring, evaluators, datasets, alerts, keys).
