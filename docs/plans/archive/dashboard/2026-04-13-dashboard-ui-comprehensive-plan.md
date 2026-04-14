# Foxhound Web Dashboard: Comprehensive UI Plan

**Date:** 2026-04-13  
**Goal:** Build a production-grade web dashboard that matches LangSmith's quality and usability

---

## Current State Assessment

### ✅ What's Strong (Backend)
- **Comprehensive REST API** with 16+ route modules (traces, scores, evaluators, experiments, datasets, budgets, SLAs, regressions, prompts, billing, notifications, auth, SSO)
- **Robust data model** with proper multi-tenancy, normalized spans table, scoring, evaluators, experiments
- **Unique differentiators** ready for UI: Session Replay API, Run Diff capability, Cost Budgets, SLA monitoring, Behavior Regression detection
- **Production infrastructure** on Fly.io with Neon Postgres, Upstash Redis, Stripe billing
- **Strong SDKs** (Python + TypeScript) with framework auto-instrumentation

### ❌ Critical Gaps (Frontend)
- **No web dashboard exists at all** — zero UI for users to visualize traces, scores, experiments
- **No visual Session Replay** — the API exists but there's no UI to render it
- **No Run Diff UI** — side-by-side comparison exists in API but not visualized
- **No trace explorer/viewer** — users can't browse their traces without API calls
- **No onboarding flow** — new users have nowhere to sign up, get API keys, or see first trace
- **No public demo** — prospects can't experience the product before deploying

---

## What Makes LangSmith/Similar Tools Great

### 1. **Instant Comprehension**
- Land on trace view → understand execution flow in <5 seconds
- Color-coded spans (LLM calls blue, tools green, errors red)
- Visual hierarchy shows parent-child relationships
- Timeline visualization with duration bars
- Hover states reveal metadata without clicking

### 2. **Minimal Clicks to Value**
- Sign up → API key → first trace in <2 minutes
- One-click filtering (errors only, slow traces, specific agents)
- Cmd+K command palette for power users
- Keyboard shortcuts for common actions

### 3. **Information Density Without Clutter**
- Dense tables with smart defaults (last 24h, errors first)
- Expandable rows for details
- Sticky headers on scroll
- Inline editing (rename trace, add tags)

### 4. **Delightful Microinteractions**
- Smooth transitions (not jarring page loads)
- Loading states that show partial data immediately
- Optimistic updates (UI updates before server confirms)
- Toast notifications for async operations
- Copy buttons with visual feedback

### 5. **Trust Through Transparency**
- Show token counts, costs, latency everywhere
- Expose raw API responses (for debugging)
- Clear error messages with actionable fixes
- "Why am I seeing this?" tooltips

---

## Foxhound UI Strategy: Agent-First Design

**Positioning:** LangSmith is built for LLM calls. Foxhound is built for **multi-step agent execution**.

### Key Principles
1. **Execution Flow First** — show the decision tree, not just the call log
2. **Failure Context** — when something breaks, surface why (not just what)
3. **Cost Transparency** — every view shows cumulative cost + budget burn rate
4. **Session-Centric** — group traces by session, not just timestamp
5. **Diff-Native** — compare runs side-by-side as a first-class feature

---

## Phase 1: Foundation & Core Trace Viewer (Week 1-2)

**Goal:** Users can sign up, see their traces, and understand execution flow.

### 1.1 Tech Stack Decision

**Recommendation: Next.js 15 + Tailwind + shadcn/ui + Recharts**

**Why:**
- **Next.js 15**: App Router, React Server Components, built-in auth patterns, Vercel deploy
- **Tailwind CSS**: Rapid UI iteration, consistent design system
- **shadcn/ui**: Unstyled components (Table, Dialog, Dropdown, Command) — copy-paste, full control
- **Recharts**: React-native charts for cost/latency graphs
- **TanStack Query**: Client-side data fetching, caching, optimistic updates
- **Zustand**: Lightweight global state (selected org, filters, sidebar state)

**File Structure:**
```
apps/
  web/                          # NEW — Next.js 15 app
    app/
      (auth)/
        login/page.tsx
        signup/page.tsx
      (dashboard)/
        layout.tsx              # Sidebar + top nav
        page.tsx                # Dashboard home (overview)
        traces/
          page.tsx              # Trace list
          [id]/page.tsx         # Trace detail
        sessions/
          page.tsx              # Session list (grouped traces)
          [id]/page.tsx         # Session detail
        experiments/
          page.tsx
        datasets/
          page.tsx
        settings/
          page.tsx
      api/
        auth/[...nextauth]/route.ts  # NextAuth
    components/
      ui/                       # shadcn components
      trace-viewer/
        trace-timeline.tsx
        span-list.tsx
        span-detail.tsx
      session-replay/
        replay-viewer.tsx
      run-diff/
        diff-viewer.tsx
    lib/
      api-client.ts             # Wrapper around @foxhound-ai/api-client
      auth.ts
      utils.ts
    public/
    package.json
    tsconfig.json
    tailwind.config.ts
```

### 1.2 Authentication & Onboarding

**Sign Up Flow:**
1. `/signup` → Enter email, password, org name
2. POST `/v1/auth/signup` → Create org, user, membership
3. Redirect to `/onboarding`
4. Show API key, copy button, SDK snippets
5. Poll for first trace → Confetti when detected → Redirect to `/traces`

**Login Flow:**
1. `/login` → Email/password
2. POST `/v1/auth/login` → JWT token
3. Store in httpOnly cookie
4. Redirect to `/traces`

**Implementation:**
- NextAuth.js for session management
- Email/password provider (bcrypt hashing already in API)
- JWT stored in httpOnly cookie
- API client auto-injects auth header from cookie

### 1.3 Trace List View

**Layout:**
- Left sidebar: Org switcher, nav (Traces, Sessions, Experiments, Datasets, Settings)
- Top bar: Search, filters, date range picker, user menu
- Main content: Traces table

**Traces Table Columns:**
| Column | Content | Sort |
|--------|---------|------|
| Status | 🟢 Success / 🔴 Error / 🟡 Partial | Yes |
| Agent | `agentId` with icon | Yes |
| Session | `sessionId` (clickable link) | Yes |
| Duration | `endTimeMs - startTimeMs` with sparkline | Yes |
| Spans | Count with breakdown (LLM/Tool/Agent) | Yes |
| Cost | $0.0032 with budget % | Yes |
| Started | Relative time (2m ago) + absolute on hover | Yes |
| Actions | View, Copy ID, Delete | - |

**Filters (sticky header):**
- Status: All / Success / Error / Partial
- Agent: Dropdown (multi-select)
- Date Range: Last 24h / 7d / 30d / Custom
- Search: Full-text across trace metadata

**Keyboard Shortcuts:**
- `Cmd+K` → Open command palette
- `↑/↓` → Navigate table rows
- `Enter` → Open selected trace
- `Cmd+F` → Focus search
- `Cmd+Shift+F` → Open filters

### 1.4 Trace Detail View

**Hero Section:**
- Breadcrumb: Traces > `traceId` (truncated)
- Status badge (Success/Error)
- Duration, span count, cost
- Actions: Copy ID, Export JSON, Delete, Share link

**Main Content:**

#### Tab 1: Timeline (Default)
- **Visual timeline** showing all spans
- Horizontal bars scaled to duration
- Color coding:
  - LLM calls: Blue
  - Tool calls: Green
  - Agent steps: Purple
  - Errors: Red
- Nested indent for parent-child spans
- Click span → Expand details panel (right side)

#### Tab 2: Span List (Table View)
- Flattened table of all spans
- Columns: Name, Type, Duration, Status, Start Time
- Sortable, filterable
- Click row → Expand details

#### Tab 3: Metadata
- JSON viewer for `metadata` field
- Syntax highlighting
- Copy button

#### Tab 4: Scores
- List of all scores for this trace
- Columns: Name, Value, Source, Created At
- Add new score button → Modal
- Filter by score name

**Span Detail Panel (Right Side):**
- Span name, type, status
- Duration breakdown
- Input/output (if LLM call)
- Tool name/args (if tool call)
- Error details (if error)
- Copy span ID button
- "Add to dataset" button

---

## Phase 2: Session Replay & Run Diff (Week 3)

**Goal:** Visualize Foxhound's unique differentiators.

### 2.1 Session Replay Viewer

**What It Shows:**
- Reconstructed agent state at any point in the trace
- Step-by-step execution with state diffs
- Decision points with reasoning (if captured in metadata)

**UI Design:**
```
┌─────────────────────────────────────────────────────────────┐
│  Session Replay: trace_abc123                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ◀ Prev Step          Step 3/12          Next Step ▶     ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────┬────────────────────────────────────────┐│
│  │ Timeline        │ State at Step 3                        ││
│  │                 │                                        ││
│  │ 1. Init         │ {                                      ││
│  │ 2. Tool: Search │   "query": "weather in SF",            ││
│  │ 3. LLM: Plan ← │   "results": [...],                    ││
│  │ 4. Tool: Email  │   "next_action": "send_email"          ││
│  │ 5. Complete     │ }                                      ││
│  │                 │                                        ││
│  │                 │ Δ Changed from Step 2:                 ││
│  │                 │ + "results": [...]                     ││
│  │                 │ + "next_action": "send_email"          ││
│  └─────────────────┴────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Implementation:**
- Call `GET /v1/traces/:id` → Parse spans chronologically
- For each span, build state snapshot from metadata
- Show diff between snapshots (using `diff` library)
- Syntax highlight JSON state
- Keyboard nav: Arrow keys to step through

### 2.2 Run Diff Viewer

**What It Shows:**
- Side-by-side comparison of two traces
- Highlight differences in execution path
- Show cost/latency deltas

**Use Cases:**
- Compare before/after prompt changes
- Debug regressions (why did this version break?)
- Evaluate A/B test results

**UI Design:**
```
┌─────────────────────────────────────────────────────────────┐
│  Run Diff                                                    │
│  ┌──────────────────────────┬──────────────────────────────┐│
│  │ trace_abc (baseline)     │ trace_xyz (comparison)       ││
│  ├──────────────────────────┼──────────────────────────────┤│
│  │ Duration: 2.3s           │ Duration: 1.8s (-22%) ✓     ││
│  │ Cost: $0.012             │ Cost: $0.015 (+25%) ⚠       ││
│  │ Spans: 12                │ Spans: 10 (-2) ✓            ││
│  ├──────────────────────────┼──────────────────────────────┤│
│  │ 1. Init                  │ 1. Init                      ││
│  │ 2. Tool: Search          │ 2. Tool: Search              ││
│  │ 3. LLM: Plan (200ms)     │ 3. LLM: Plan (150ms) ✓      ││
│  │ 4. Tool: Email           │   [SKIPPED - optimization] - ││
│  │ 5. LLM: Confirm          │ 4. LLM: Confirm              ││
│  └──────────────────────────┴──────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Implementation:**
- Select two traces from list (checkboxes)
- Click "Compare" button
- Call `GET /v1/traces/:id1` and `GET /v1/traces/:id2`
- Align spans by name/type (fuzzy matching)
- Highlight added (green), removed (red), modified (yellow)
- Show metric deltas (duration, cost, span count)

---

## Phase 3: Experiments & Evaluations (Week 4)

**Goal:** Visualize evaluation results, experiments, datasets.

### 3.1 Experiments List

**Layout:**
- Table of experiments
- Columns: Name, Status (Running/Complete/Failed), Runs, Best Score, Created
- Click row → Experiment detail

### 3.2 Experiment Detail

**Hero:**
- Experiment name (editable)
- Status badge
- Progress bar (if running)
- Actions: Pause, Resume, Export, Delete

**Tabs:**

#### Tab 1: Results
- Table of all runs
- Columns: Run ID, Variant, Scores (expandable), Duration, Cost
- Sort by score
- Highlight best run (crown icon)

#### Tab 2: Leaderboard
- Visual comparison of variants
- Bar chart showing score distribution
- Box plot for score variance
- Statistical significance indicators

#### Tab 3: Config
- Show experiment parameters (dataset, evaluators, variants)
- Edit config (re-run with changes)

### 3.3 Datasets

**List View:**
- Table: Name, Items, Created, Actions
- Click → Dataset detail

**Detail View:**
- List of dataset items (input/output pairs)
- Add new item button
- Import from CSV
- Export to JSON
- "Create experiment from dataset" button

---

## Phase 4: Cost Budgets & SLA Monitoring (Week 5)

**Goal:** Make cost and performance visible everywhere.

### 4.1 Cost Budget Dashboard

**Layout:**
- Card grid showing all budgets
- Each card:
  - Budget name
  - Current spend / Limit
  - Progress bar (green → yellow → red)
  - Time period (daily/weekly/monthly)
  - Alert status (if over budget)

**Detail View:**
- Cost over time graph (Recharts line chart)
- Breakdown by agent
- Top 10 most expensive traces
- Configure budget limits, alerts

### 4.2 SLA Monitor Dashboard

**Layout:**
- Card grid showing all SLAs
- Each card:
  - SLA name (e.g., "Agent response time < 2s")
  - Success rate (95.2%)
  - Progress bar (green if met, red if violated)
  - Recent violations (if any)

**Detail View:**
- Success rate over time graph
- Violations table (trace links, timestamp, reason)
- Configure SLA thresholds, alerts

### 4.3 Global Cost Widget (Always Visible)

**Top Right Corner:**
- Small badge showing current month's spend
- Click → Expand to show:
  - Spend by agent
  - Budget utilization
  - Cost trend graph
  - Link to budgets page

---

## Phase 5: Behavior Regression Detection (Week 6)

**Goal:** Surface when agent behavior changes unexpectedly.

### 5.1 Regressions Dashboard

**Layout:**
- Timeline of detected regressions
- Each regression card:
  - Agent name
  - Detected at (timestamp)
  - Severity (Critical/High/Medium/Low)
  - Description (e.g., "Success rate dropped 15%")
  - Affected traces (count + link)

**Detail View:**
- Before/after comparison
- Metric changes (success rate, duration, cost)
- Link to run diff between baseline and regressed trace
- Mark as false positive / Acknowledge / Create incident

---

## Phase 6: Settings & Admin (Week 7)

### 6.1 Organization Settings
- Org name, slug
- Billing plan, usage stats
- Team members (invite, remove)
- API keys (create, revoke, view)
- Retention settings
- Sampling rate

### 6.2 User Settings
- Profile (name, email, password)
- Preferences (timezone, theme, notifications)
- Connected accounts (GitHub, Slack)

### 6.3 Integrations
- Slack webhook setup
- GitHub notifications
- Webhook endpoints

---

## Phase 7: Polish & Launch Readiness (Week 8)

### 7.1 Command Palette (Cmd+K)
**Global search + actions:**
- Search traces by ID, agent, metadata
- Quick nav to experiments, datasets, settings
- Actions: Create experiment, add dataset, invite user
- Recent items

### 7.2 Keyboard Shortcuts
- `/` → Focus search
- `Cmd+K` → Command palette
- `Cmd+Shift+F` → Open filters
- `Esc` → Close modals
- `Arrow keys` → Navigate tables
- `Enter` → Open selected item
- `Cmd+C` → Copy trace ID (when selected)

### 7.3 Dark Mode
- Respect system preference
- Toggle in user menu
- Persist in localStorage

### 7.4 Loading States
- Skeleton loaders (not spinners)
- Partial data rendering (show what's available)
- Optimistic updates for mutations

### 7.5 Error Handling
- Toast notifications for errors
- Actionable error messages
- Retry buttons
- Fallback UI for missing data

### 7.6 Mobile Responsive
- Mobile nav (hamburger menu)
- Touch-friendly tables (swipe actions)
- Responsive charts

### 7.7 Launch Screenshots
**Critical for launch (per brand strategy doc):**
1. Trace timeline view (hero shot)
2. Session Replay in action
3. Run Diff comparison
4. Cost Budget dashboard
5. SLA Monitor with violations
6. Experiment leaderboard

---

## Implementation Priorities

### Must-Have for MVP (Weeks 1-4)
- ✅ Auth (signup, login, API keys)
- ✅ Trace list + detail view
- ✅ Session Replay viewer
- ✅ Run Diff viewer
- ✅ Basic settings (API keys, org info)

### Should-Have for Launch (Weeks 5-6)
- ✅ Experiments + evaluations
- ✅ Datasets
- ✅ Cost budgets
- ✅ SLA monitoring

### Nice-to-Have (Week 7-8)
- ✅ Regressions dashboard
- ✅ Command palette
- ✅ Dark mode
- ✅ Mobile responsive

---

## Success Metrics

### User Experience
- **Time to first trace:** <2 minutes (measured from signup to trace visible in UI)
- **Trace comprehension:** User understands execution flow in <5 seconds
- **Session Replay adoption:** >30% of users who view a trace also view replay
- **Run Diff usage:** >20% of users compare runs within first week

### Performance
- **Page load:** <1s for trace list (100 traces)
- **Trace detail:** <500ms initial render
- **Search:** <200ms results
- **No layout shift** (CLS = 0)

### Engagement
- **Daily active users:** >50% of signups return next day
- **Feature discovery:** >60% use ≥3 features (traces, experiments, budgets) in first week
- **Retention:** >40% weekly active after 4 weeks

---

## Design System Decisions

### Colors (Agent-First Theme)
- **Primary:** Indigo 600 (trust, technical)
- **Success:** Green 500 (passed evaluations, under budget)
- **Warning:** Amber 500 (approaching budget, slow traces)
- **Error:** Red 500 (failures, over budget, SLA violations)
- **LLM spans:** Blue 500
- **Tool spans:** Green 600
- **Agent spans:** Purple 600

### Typography
- **Headings:** Inter (clean, modern)
- **Body:** Inter (consistency)
- **Code:** JetBrains Mono (monospace for IDs, JSON)

### Spacing (Tailwind Scale)
- Consistent use of 4px grid (4, 8, 12, 16, 24, 32, 48, 64)

### Components (shadcn/ui)
- Table, Button, Dialog, Dropdown, Command, Tabs, Badge, Card, Input, Textarea, Select, Checkbox, Toast

---

## Deployment Strategy

### Hosting
- **Vercel** for Next.js app (zero-config, Edge functions, preview deployments)
- **Custom domain:** `app.foxhound.dev`
- **Preview deploys:** Every PR gets preview URL

### CI/CD
- GitHub Actions workflow
- On PR: Build, type-check, lint, test
- On merge to main: Deploy to Vercel production

### Environment Variables
```
NEXT_PUBLIC_API_URL=https://api.foxhound.dev
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://app.foxhound.dev
```

---

## Next Steps

### Week 1: Foundation
1. Create `apps/web` Next.js app
2. Set up Tailwind, shadcn/ui, TanStack Query
3. Implement auth (signup, login, API key creation)
4. Build trace list view with filters

### Week 2: Trace Detail
1. Build trace timeline visualization
2. Implement span detail panel
3. Add metadata/scores tabs
4. Polish interactions (hover states, keyboard nav)

### Week 3: Session Replay & Run Diff
1. Build Session Replay viewer
2. Build Run Diff comparison
3. Add "Compare" mode to trace list

### Week 4: Experiments
1. Experiments list + detail
2. Dataset management
3. Evaluation results visualization

**Then continue through Phases 5-7 per the timeline above.**

---

## Open Questions

1. **Real-time updates:** Should trace list auto-refresh when new traces arrive? (WebSocket vs polling)
2. **Collaborative features:** Should multiple users see each other's cursors/selections? (like Figma)
3. **Trace annotations:** Should users be able to comment on specific spans? (already have annotations API)
4. **Export formats:** What formats beyond JSON? (CSV for scores, Markdown for reports?)

---

## Comparison to LangSmith

| Feature | LangSmith | Foxhound (After Plan) | Winner |
|---------|-----------|----------------------|--------|
| Trace visualization | ✅ Excellent | ✅ Comparable | Tie |
| Session Replay | ❌ No | ✅ Yes | **Foxhound** |
| Run Diff | ❌ No | ✅ Yes | **Foxhound** |
| Cost tracking | ✅ Basic | ✅ Budgets + Alerts | **Foxhound** |
| Evaluations | ✅ Excellent | ✅ Comparable | Tie |
| SLA monitoring | ❌ No | ✅ Yes | **Foxhound** |
| Behavior regression | ❌ No | ✅ Yes | **Foxhound** |
| Multi-tenant | ✅ Yes | ✅ Yes | Tie |
| Pricing | $39/seat/mo | $29/mo unlimited | **Foxhound** |
| Onboarding | ✅ <2 min | ✅ <2 min (target) | Tie |

**Foxhound wins on:** Agent-specific features (Session Replay, Run Diff, Regression Detection), pricing model, cost management.

**LangSmith wins on:** Market maturity, brand recognition, ecosystem integrations.

**Tie:** Core observability (traces, evals), onboarding experience.

---

## Final Recommendation

**Start with Phase 1-4 (4 weeks)** to get MVP-level parity with LangSmith, then **prioritize Session Replay and Run Diff** (Week 3) to showcase Foxhound's unique value. The agent-first features will differentiate immediately, and the pricing model ($29 vs $39/seat) will convert price-sensitive teams.

Ship early, iterate fast, listen to feedback. The backend is production-ready — now give it the UI it deserves.
