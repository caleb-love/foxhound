# Foxhound Skills Reference

**Last updated:** 2026-04-13

Pi, Claude Code, and Codex all have access to 401 skills from three collections. This document catalogs the most relevant skills for Foxhound development.

## Skills Configuration

**Location:** `~/.agents/skills/` (standard Agent Skills location)

**Structure:**
```
~/.agents/skills/
├── superpowers/ → ~/.claude/skills/           (188 skills)
├──          → ~/.codex/skills/             (32 skills)
└── ecc/         → ~/Developer/everything-claude-code/skills/  (181 skills)
```

**Pi config:** `.pi/settings.json` includes:
```json
{
  "skills": ["~/.agents/skills"]
}
```

**Discovery order:** superpowers → gsd → ecc (first match wins on name collisions)

## Core Workflow Skills

### Planning & Review (Superpowers)

| Skill | Description | When to Use |
|-------|-------------|-------------|
| `/skill:autoplan` | Auto-review pipeline (CEO + design + eng + DX reviews) | Multi-perspective plan review without answering 15-30 questions |
| `/skill:plan-ceo-review` | Executive-level plan critique | Strategic alignment, revenue impact, competitive positioning |
| `/skill:plan-eng-review` | Engineering-level plan critique | Technical correctness, patterns, edge cases, scaling |
| `/skill:plan-devex-review` | Developer experience critique | SDK ergonomics, API usability, documentation clarity |
| `/skill:plan-design-review` | Design and UX critique | User flows, visual design, accessibility |
| `/skill:security-review` | Security audit | Auth changes, API endpoints, data handling, OWASP Top 10 |
| `/skill:quality-gate` | Pre-deployment quality checks | Before merging PRs or shipping features |
| `/skill:verification-loop` | Comprehensive verification system | Before marking milestones complete, pre-deployment checks |

### Development Workflow (Superpowers)

| Skill | Description | When to Use |
|-------|-------------|-------------|
| `/skill:tdd-workflow` | TDD workflow (test-first) | Writing new features or refactoring critical paths |
| `/skill:agent-introspection-debugging` | Structured self-debugging for AI agents | Investigating agent failures, diagnosis, recovery |
| `/skill:executing-plans` | Plan execution workflow | Following documented plans step-by-step |
| `/skill:writing-plans` | Plan creation workflow | Breaking down features into implementation plans |
| `/skill:receiving-code-review` | Code review response workflow | Addressing PR feedback |
| `/skill:requesting-code-review` | Code review request workflow | Preparing PRs for review |

### Architecture & Design (ECC)

| Skill | Description | When to Use |
|-------|-------------|-------------|
| `/skill:architecture-decision-records` | ADR creation | Documenting architectural decisions |
| `/skill:hexagonal-architecture` | Clean architecture patterns | Structuring domain logic, ports, adapters |
| `/skill:backend-patterns` | Backend best practices | API design, database patterns, worker architecture |
| `/skill:api-design` | REST API design patterns | Designing new endpoints, refactoring APIs |

### Project Management

| Skill | Description | When to Use |
|-------|-------------|-------------|
| `/skill:gsd-help` | Show available commands | Learning project workflow |
| `/skill:gsd-new-milestone` | Create new milestone | Starting new major feature or phase |
| `/skill:gsd-plan-phase` | Phase planning | Breaking milestone into executable phases |
| `/skill:gsd-execute-phase` | Phase execution | Working through phase tasks |
| `/skill:gsd-progress` | Track progress | Checking milestone status |
| `/skill:gsd-validate-phase` | Phase validation | Verifying phase completion |
| `/skill:gsd-complete-milestone` | Milestone completion | Final validation and handoff |
| `/skill:gsd-audit-milestone` | Milestone audit | Health check for active milestones |

### Documentation & Codebase (ECC)

| Skill | Description | When to Use |
|-------|-------------|-------------|
| `/skill:documentation-lookup` | Find documentation | Searching for API docs, guides, references |
| `/skill:codebase-onboarding` | Repository onboarding | Understanding new codebases |
| `/skill:repo-scan` | Repository analysis | Analyzing structure, dependencies, patterns |

### Collaboration (Superpowers)

| Skill | Description | When to Use |
|-------|-------------|-------------|
| `/skill:dispatching-parallel-agents` | Parallel agent coordination | Running multiple tasks in parallel |
| `/skill:subagent-driven-development` | Subagent collaboration | Delegating specialized tasks |
| `/skill:brainstorming` | Structured brainstorming | Generating ideas, exploring solutions |

## Foxhound-Specific Workflow

### Feature Development
1. `/skill:writing-plans` → Create plan in `docs/plans/YYYY-MM-DD-feature.md`
2. `/skill:autoplan` → Auto-review with CEO/eng/DX/design perspectives
3. `/skill:tdd-workflow` → Write tests first, implement
4. `/skill:security-review` → Security audit (mandatory for auth/API/data changes)
5. `/skill:verification-loop` → Final checks before PR

### Milestone Execution
1. `/skill:gsd-new-milestone` → Create milestone (e.g., M006)
2. `/skill:gsd-plan-phase` → Break into phases
3. `/skill:gsd-execute-phase` → Execute phase tasks
4. `/skill:gsd-validate-phase` → Verify phase completion
5. `/skill:gsd-progress` → Check status
6. `/skill:gsd-complete-milestone` → Final validation

### Architecture Decisions
1. `/skill:architecture-decision-records` → Document decision in `docs/specs/`
2. `/skill:plan-eng-review` → Engineering review
3. `/skill:plan-ceo-review` → Strategic review
4. Update `docs/reference/architecture-decisions.md`

### Security Changes
1. `/skill:security-review` → Audit changes
2. Multi-tenancy check: Verify all queries scoped by `org_id`
3. Input validation: Verify Zod schemas
4. Auth check: Verify API key or JWT validation
5. Document in `docs/reference/engineering-notes.md` if new pattern

## Name Collisions

150+ skills have the same name across superpowers and ECC. Pi loads the **first match** based on discovery order:

1. **Superpowers** (loads first) - Core workflow skills, tested and tuned
2. **Project-management skills** (loads second) - project management, no overlap with superpowers
3. **ECC** (loads third) - Domain-specific skills, overlaps with superpowers

**Unique to ECC (31 skills):**
- `agent-eval`, `agent-payment-x402`, `architecture-decision-records`
- `autonomous-agent-harness`, `browser-qa`, `bun-runtime`, `canary-watch`
- `click-path-audit`, `codebase-onboarding`, `context-budget`, `design-system`
- `documentation-lookup`, `flutter-dart-code-review`, `gan-style-harness`
- `git-workflow`, `healthcare-*` patterns, `hexagonal-architecture`
- `nextjs-turbopack`, `nuxt4-patterns`, `pytorch-patterns`, `repo-scan`
- `rules-distill`, `safety-guard`, `santa-method`, `opensource-pipeline`

## Updating Skills

Pull latest from each collection:

```bash
# Superpowers (if git clone)
cd ~/.claude/skills && git pull

# Everything Claude Code
cd ~/Developer/everything-claude-code && git pull

# skills update via codex/package manager
# (typically automatic)
```

## Usage Tips

**Direct invocation:**
```bash
/skill:autoplan
```

**Natural language trigger:**
```bash
"Use the TDD skill to help me write tests"
"Review this plan using all the review skills"
```

**Multiple skills:**
```bash
# Skills can be combined
/skill:test-driven-development  # Load TDD workflow
/skill:security-review          # Then run security review
```

**Context-aware auto-loading:**
When you mention specific tasks, the agent may auto-load relevant skills based on description matching. For example, mentioning "create a plan" might trigger the agent to read `/skill:writing-plans`.

## Provider Compatibility

All skills are **provider-agnostic** - they work identically with:
- ✅ Claude (Anthropic)
- ✅ OpenAI (GPT-4, GPT-5)
- ✅ Codex
- ✅ Other OpenAI-compatible models

Skills are markdown instructions, not model-specific prompts.
