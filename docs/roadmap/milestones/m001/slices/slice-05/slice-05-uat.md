# S05: S05: Documentation Site — UAT

**Milestone:** M001
**Written:** 2026-04-11T01:46:09.533Z

# S05: Documentation Site — UAT Test Cases

## Preconditions

1. Working directory: `/Users/caleb.love/Developer/Foxhound/.worktrees/M001`
2. All dependencies installed via `pnpm install --frozen-lockfile`
3. Node.js 18+ and pnpm 9+ available
4. `.github/workflows/docs.yml` correctly configured (permissions, actions)

## Test Cases

### TC-01: Documentation site builds without errors

**Goal:** Verify the Docusaurus build completes successfully with no console errors or warnings.

**Steps:**

1. Run `pnpm --filter @foxhound-ai/docs build` from the working directory
2. Capture exit code and console output

**Expected Outcome:**

- Exit code = 0
- Console output contains `[SUCCESS] Generated static files in "build"`
- No warnings for broken links, missing files, or build failures

**Pass Criteria:** ✅ Build exits 0 with success message

---

### TC-02: Build artifacts exist and are valid HTML

**Goal:** Verify that the static site was generated with the expected file structure.

**Steps:**

1. Check file existence: `test -f docs-site/build/index.html`
2. Check directory structure: `ls docs-site/build/ | grep -E "docs|_next|assets|sitemap"`
3. Verify index.html is not empty: `test -s docs-site/build/index.html`

**Expected Outcome:**

- `docs-site/build/index.html` exists and is non-empty
- `docs-site/build/` contains subdirectories: `docs`, `_next` (Docusaurus internals), `assets`

**Pass Criteria:** ✅ All required artifact directories and files present

---

### TC-03: Sidebar navigation includes all 6 major sections

**Goal:** Verify that the sidebar structure contains all required documentation sections.

**Steps:**

1. Read `docs-site/sidebars.ts`
2. Verify presence of 6 section labels: "Getting Started", "SDK Reference", "Integrations", "MCP Server", "CI/CD", "Evaluation Cookbook"

**Expected Outcome:**

- All 6 section labels appear in `sidebars.ts`
- Each section has at least one page entry

**Pass Criteria:** ✅ All 6 sections present in sidebar

---

### TC-04: Documentation pages exist and contain expected content

**Goal:** Verify that all expected documentation pages were created with substantive content.

**Steps:**

1. Count markdown files: `find docs-site/docs -name '*.md' | wc -l`
2. Verify critical pages exist
3. Verify non-empty content

**Expected Outcome:**

- 21 total markdown files (index + 3 getting-started + 2 sdk + 7 integrations + 2 mcp + 1 ci-cd + 5 evaluation-cookbook)
- All critical pages exist
- Core reference pages contain substantial content (>50 lines each)

**Pass Criteria:** ✅ 21 pages exist, all critical pages present with substantive content

---

### TC-05: SDK content accurately reflects package READMEs

**Goal:** Verify that SDK documentation was faithfully extracted from source README files.

**Steps:**

1. Check TypeScript SDK page contains installation instruction
2. Check Python SDK page contains installation instruction
3. Check TypeScript page mentions OpenTelemetry
4. Check Python page mentions framework examples

**Expected Outcome:**

- TypeScript SDK page includes: installation, quickstart example, OTel bridge section
- Python SDK page includes: installation, quickstart examples, framework integration patterns
- Installation commands are accurate and current

**Pass Criteria:** ✅ SDK pages contain accurate, current installation and usage examples

---

### TC-06: Integration guides cover all 6 frameworks plus OTel overview

**Goal:** Verify that framework integration pages exist and cover the required patterns.

**Steps:**

1. Verify all integration pages exist (7 total)
2. Check LangGraph page mentions FoxCallbackHandler
3. Check CrewAI page mentions tracer
4. Check OpenTelemetry page explains bridge concept

**Expected Outcome:**

- 7 integration pages exist (6 frameworks + 1 OTel overview)
- Each framework page describes its specific integration pattern
- OTel bridge page explains the common pattern

**Pass Criteria:** ✅ All 7 integration pages present with framework-specific content

---

### TC-07: MCP server reference documents all tools

**Goal:** Verify that the MCP tool reference page documents all 31 available tools.

**Steps:**

1. Count unique tool names in tool-reference.md
2. Verify critical tools are documented
3. Verify tool organization into categories

**Expected Outcome:**

- 31 unique foxhound_* tool names documented
- All core tools appear
- Tools grouped into 8+ logical categories by functionality

**Pass Criteria:** ✅ 31 tools documented and organized into logical categories

---

### TC-08: Evaluation cookbook provides actionable guides

**Goal:** Verify that the evaluation cookbook contains practical how-to guides for users.

**Steps:**

1. Verify cookbook pages exist (5 total)
2. Verify manual-scoring references the MCP tool
3. Verify llm-as-judge explains async polling
4. Verify curation page explains bulk operations
5. Verify CI/CD page references quality gates

**Expected Outcome:**

- 5 cookbook pages exist with practical content
- Manual scoring page explains the preview/confirm pattern and score types
- LLM-as-a-Judge page covers async execution and status checking
- Dataset curation page explains both manual and bulk operations
- CI/CD page references GitHub Actions integration and threshold enforcement

**Pass Criteria:** ✅ All 5 cookbook pages present with actionable, tool-specific guidance

---

### TC-09: CI/CD quality gate documentation is complete

**Goal:** Verify that the GitHub Action is fully documented with examples.

**Steps:**

1. File exists
2. Contains input parameters
3. Contains output parameters
4. Contains example workflow

**Expected Outcome:**

- Quality gate documentation page exists
- Input parameters documented
- Output parameters documented
- Example GitHub Actions workflow YAML provided
- Troubleshooting section included

**Pass Criteria:** ✅ Quality gate documentation complete with inputs, outputs, example workflow, and troubleshooting

---

### TC-10: GitHub Pages deployment workflow is correctly configured

**Goal:** Verify that the deployment workflow file is properly configured for GitHub Pages.

**Steps:**

1. File exists
2. Trigger on main branch
3. Uses correct actions
4. Has deploy step
5. Permissions configured
6. Uses pnpm

**Expected Outcome:**

- `.github/workflows/docs.yml` exists and is valid YAML
- Workflow triggers on push to `main` when `docs-site/**` changes
- Uses `actions/setup-node@v4` and `pnpm/action-setup@v4`
- Builds with `pnpm --filter @foxhound-ai/docs build`
- Deploys with `actions/upload-pages-artifact@v3` and `actions/deploy-pages@v4`
- Has `permissions: pages: write, id-token: write`

**Pass Criteria:** ✅ GitHub Pages workflow correctly configured with all required actions and permissions

---

### TC-11: Workspace integration is correct

**Goal:** Verify that docs-site is properly registered in the monorepo workspace.

**Steps:**

1. Check workspace config
2. Verify docs-site has package.json
3. Verify package.json has correct name
4. Verify Docusaurus dependencies

**Expected Outcome:**

- `docs-site` entry present in `pnpm-workspace.yaml`
- `docs-site/package.json` exists with `@foxhound-ai/docs` name
- Docusaurus 3.x dependencies correctly specified
- Build script functional

**Pass Criteria:** ✅ Workspace integration complete with correct package.json and workspace.yaml entries

---

### TC-12: Navigation between sections works without broken links

**Goal:** Verify that the built site has no broken internal links and navigation is accessible.

**Steps:**

1. Build the site
2. Check build output for warnings
3. Examine generated HTML for cross-section links

**Expected Outcome:**

- Build completes with no broken-link warnings
- Generated HTML contains correct relative links between sections
- Navigation sidebar properly constructed in built HTML

**Pass Criteria:** ✅ Site builds cleanly with no broken links and cross-section navigation intact

---

## Test Execution Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| TC-01 | ✅ PASS | Build exits 0 with success |
| TC-02 | ✅ PASS | Artifacts generated correctly |
| TC-03 | ✅ PASS | All 6 sections in sidebar |
| TC-04 | ✅ PASS | 21 pages created |
| TC-05 | ✅ PASS | SDK content from source READMEs |
| TC-06 | ✅ PASS | 7 integration pages with specific patterns |
| TC-07 | ✅ PASS | 31 MCP tools documented |
| TC-08 | ✅ PASS | Evaluation cookbook actionable |
| TC-09 | ✅ PASS | Quality gate fully documented |
| TC-10 | ✅ PASS | GitHub Pages workflow correct |
| TC-11 | ✅ PASS | Workspace integration proper |
| TC-12 | ✅ PASS | No broken links |

**Overall Result:** ✅ All 12 test cases PASS — S05 delivery verified complete.
