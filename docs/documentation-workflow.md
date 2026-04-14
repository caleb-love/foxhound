# Documentation Workflow Guide

**Purpose:** Automated documentation structure and filing rules for Foxhound  
**Last Updated:** 2026-04-13  
**Status:** Active operating procedure for all sessions

---

## Core Principle

**Every document has a home.** Nothing lives in the wrong place. Plans flow through a lifecycle: draft → active → completed → archived. This guide ensures consistency across sessions.

---

## Directory Structure

```
docs/
├── README.md                    # Navigation hub (keep updated)
├── commit-convention.md         # Git standards
├── skills.md                    # Skills integration guide
├── documentation-workflow.md    # This file
│
├── specs/                       # Design specifications (multi-agent reviewed)
├── overview/                    # Best entry points and current project truth
├── reference/                   # Durable engineering reference
├── roadmap/                     # Milestone outcomes and roadmap history
├── plans/
│   ├── active/                  # Currently being worked on
│   ├── completed/               # Finished, organized by category
│   │   ├── phase-1/
│   │   ├── phase-2/
│   │   ├── phase-3/
│   │   ├── phase-4/
│   │   ├── phase-5/
│   │   ├── phase-6/
│   │   └── brand-gtm/
│   ├── testing/                 # All testing documentation
│   └── archive/                 # Superseded versions
│       ├── demo-mode/
│       ├── dashboard/
│       └── summaries/
└── sessions/                    # Daily session logs
```

---

## Document Lifecycle

### 1. Planning Phase
**When:** Starting new work, exploring approaches, multi-iteration planning

**Action:** Create in `docs/plans/active/`

**Naming:** `YYYY-MM-DD-<feature-name>.md`

**Examples:**
- `2026-04-12-phase6-prompt-management-hardening.md`
- `2026-04-14-session-replay-v2.md`

### 2. Iteration Phase
**When:** Plan has multiple versions, still evolving

**Action:** Keep latest in `active/`, move superseded versions to `archive/<topic>/`

**Pattern:**
```bash
# First version
docs/plans/active/2026-04-13-demo-mode.md

# After revision
docs/plans/active/2026-04-13-demo-mode-REVISED.md
docs/plans/archive/demo-mode/2026-04-13-demo-mode.md  # Move original

# After third version
docs/plans/active/2026-04-13-demo-mode-FINAL.md
docs/plans/archive/demo-mode/2026-04-13-demo-mode-REVISED.md  # Move second
```

**When you have 3+ versions:** Create archive subdirectory for the topic.

### 3. Completion Phase
**When:** Work is done, feature shipped, plan executed

**Action:** Move from `active/` to `completed/<category>/`

**Categories:**
- `phase-N/` - Roadmap phase work (N = 1-6)
- `brand-gtm/` - Marketing, website, brand strategy
- `infrastructure/` - DevOps, deployment, monitoring
- `security/` - Security audits, compliance, hardening
- `refactoring/` - Code quality, tech debt

**Completion artifacts:**
- Implementation plan goes to `completed/<category>/`
- If multiple related docs exist, create a `-COMPLETE.md` summary

**Example:**
```bash
# Before completion
docs/plans/active/2026-04-13-session-replay-plan.md

# After completion
docs/plans/completed/phase-5/2026-04-13-session-replay-plan.md
docs/plans/completed/phase-5/2026-04-13-session-replay-COMPLETE.md  # Summary
```

### 4. Archive Phase
**When:** Superseded by newer approach, intermediate summaries, draft explorations

**Action:** Move to `archive/<topic>/`

**Topics:**
- Create topic subdirectory if 3+ related docs
- Use descriptive topic names (`demo-mode`, `dashboard`, `api-redesign`)

---

## Automatic Filing Rules

### New Plan → Where Does It Go?

```
IS IT A DESIGN SPEC (multi-agent reviewed, strategic)?
├─ YES → docs/specs/YYYY-MM-DD-<name>-design.md
└─ NO → Continue...

IS IT BEING ACTIVELY WORKED ON?
├─ YES → docs/plans/active/YYYY-MM-DD-<name>.md
└─ NO → Continue...

IS IT FINISHED/SHIPPED?
├─ YES → docs/plans/completed/<category>/YYYY-MM-DD-<name>.md
└─ NO → Continue...

IS IT SUPERSEDED/DRAFT/INTERMEDIATE?
└─ YES → docs/plans/archive/<topic>/YYYY-MM-DD-<name>.md
```

### Category Assignment Logic

```
Phase work (following roadmap)?
└─ completed/phase-N/

Brand, marketing, website, GTM?
└─ completed/brand-gtm/

Testing guides, QA scripts, test plans?
└─ plans/testing/

Deployment, infrastructure, monitoring?
└─ completed/infrastructure/

Security audit, compliance, hardening?
└─ completed/security/

Code refactoring, tech debt, cleanup?
└─ completed/refactoring/
```

---

## Session Log Workflow

### Daily Session Summary

**When:** End of each work session

**Action:** Create `docs/sessions/session-YYYY-MM-DD.md`

**Template:**
```markdown
# Session Summary: YYYY-MM-DD

**Completed:** <brief description>

---

## ✅ Completed Work

### 1. <Task Name> (% complete)
- ✅ Item 1
- ✅ Item 2

### 2. <Task Name> (% complete)
- ✅ Item 1
- ⏸️ Item 2 (blocked/paused)

---

## 📁 Key Files

**Created:**
- `path/to/file.md` ← Description

**Modified:**
- `path/to/file.ts`

**Commits:**
- `abc1234` - feat: description

---

## 🎯 Next Steps

1. Next task from sequence
2. Blockers to resolve
3. Follow-ups needed

---

## 📊 Progress

- [x] Step 1
- [x] Step 2
- [ ] Step 3

**Overall: X/Y steps complete (Z%)**
```

### Multiple Sessions Per Day

Use time suffix: `session-YYYY-MM-DD-morning.md`, `session-YYYY-MM-DD-afternoon.md`

---

## Maintenance Rules

### Weekly Cleanup (Every Friday or End of Milestone)

1. **Scan `active/`** - Move completed plans to `completed/<category>/`
2. **Check for duplicates** - Consolidate or archive redundant docs
3. **Update README.md** - Ensure Quick Reference tables are current
4. **Archive iterations** - If 3+ versions of same plan exist, create archive subdirectory

### Milestone Completion

1. **Consolidate phase docs** - Create `YYYY-MM-DD-phaseN-COMPLETE.md` summary
2. **Move all to completed/** - Clear out `active/` for next milestone
3. **Update durable docs** - refresh `docs/overview/`, `docs/reference/`, and `docs/roadmap/` when project truth changes
4. **Update README.md** - Add phase to Completed Phases table

---

## README.md Update Triggers

Update `docs/README.md` when:

1. **New phase starts** - Add to Active Work table
2. **Phase completes** - Update Phase Status Summary table
3. **New category added** - Add to directory structure
4. **Major reorganization** - Rewrite relevant sections

---

## Anti-Patterns to Avoid

❌ **Don't:**
- Leave completed plans in `active/`
- Commit generated site output, build artifacts, coverage reports, local caches, or OS noise as if they were durable docs truth
- Put local operator secrets or auth helper files inside package directories, even if gitignored
- Create multiple `-FINAL.md` versions
- Put session logs in `plans/`
- Mix testing docs with implementation plans
- Delete superseded versions (archive them)
- Create date-less filenames
- Skip category when moving to `completed/`

✅ **Do:**
- Move plans through lifecycle promptly
- Keep authored docs separate from generated output and historical evidence
- Treat `docs-site/docs/` as authored truth, and `docs-site/build/` / `.docusaurus/` as generated output unless there is an explicit versioning reason
- Add a one-line scope statement to audit artifacts indicating whether they are surface-exhaustive or file-by-file exhaustive
- Document any intentional generated-artifact exceptions explicitly (for example, a reviewed composite-action runtime bundle) instead of relying on tribal knowledge
- Archive instead of delete
- Use consistent date prefixes (YYYY-MM-DD)
- Group related archived docs in topic subdirectories
- Keep `active/` lean (< 5 files typically)
- Update README.md after major changes

---

## Automation Checklist

At the end of every session, run this mental checklist:

```
□ Created new plans → Filed in active/ with YYYY-MM-DD prefix?
□ Completed work → Moved from active/ to completed/<category>/?
□ Multiple iterations → Earlier versions in archive/<topic>/?
□ Session notes → Created session-YYYY-MM-DD.md in sessions/?
□ Major changes → Updated docs/README.md Quick Reference?
□ Phase complete → Created phaseN-COMPLETE.md summary?
□ Milestone status changed → Updated `docs/overview/`, `docs/reference/`, and `docs/roadmap/`?
```

---

## Examples

### Example 1: New Feature Plan

```bash
# Day 1: Start planning
docs/plans/active/2026-04-15-prompt-versioning.md

# Day 3: Revised approach
mv docs/plans/active/2026-04-15-prompt-versioning.md \
   docs/plans/archive/prompt-versioning/2026-04-15-prompt-versioning-v1.md
docs/plans/active/2026-04-15-prompt-versioning-v2.md

# Day 7: Feature shipped
mv docs/plans/active/2026-04-15-prompt-versioning-v2.md \
   docs/plans/completed/phase-6/2026-04-15-prompt-versioning.md
```

### Example 2: Testing Documentation

```bash
# New test guide
docs/plans/testing/2026-04-15-e2e-test-guide.md

# Never moves to completed/ or archive/ — stays in testing/
```

### Example 3: Session Logs

```bash
# End of day
docs/sessions/session-2026-04-15.md

# Multiple sessions same day
docs/sessions/session-2026-04-15-morning.md
docs/sessions/session-2026-04-15-afternoon.md
```

### Example 4: Phase Completion

```bash
# Phase 6 work done
docs/plans/completed/phase-6/2026-04-15-prompt-versioning.md
docs/plans/completed/phase-6/2026-04-16-ab-testing.md
docs/plans/completed/phase-6/2026-04-17-analytics.md

# Create completion summary
docs/plans/completed/phase-6/2026-04-17-phase6-COMPLETE.md

# Update README.md Phase Status table
# Update overview/project-overview.md
```

---

## Decision Tree Quick Reference

```
New document?
  ├─ Spec/design doc? → specs/
  ├─ Active work? → plans/active/
  ├─ Testing guide? → plans/testing/
  └─ Session notes? → sessions/

Existing document status changed?
  ├─ Completed? → plans/completed/<category>/
  ├─ Superseded? → plans/archive/<topic>/
  └─ Still active? → Keep in plans/active/

Need to create summary?
  ├─ Phase complete? → completed/phase-N/<phase>-COMPLETE.md
  ├─ Feature complete? → completed/<category>/<feature>-COMPLETE.md
  └─ Session ended? → sessions/session-YYYY-MM-DD.md

Multiple versions piling up?
  └─ Create archive/<topic>/ and move earlier versions
```

---

## Version History

- **2026-04-13**: Initial workflow codification after reorganization
