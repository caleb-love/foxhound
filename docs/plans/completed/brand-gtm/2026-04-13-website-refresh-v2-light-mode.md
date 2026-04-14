# Foxhound Website Refresh V2: Light Mode + Security Focus

**Date:** 2026-04-13
**Status:** Draft
**Repo:** foxhound-web (`~/Developer/foxhound-web`)
**Context:** User request for lighter theme projecting "security and protection, but proactively"

---

## Executive Summary

**Shift from:** Dark infrastructure aesthetic with orange primary
**Shift to:** Light, clean, trust-building design that projects security and data sovereignty

**Key principle:** Security isn't about locks and shields (reactive). It's about **transparency, control, and visibility** (proactive). The design should say "you're in command" not "we'll protect you."

---

## 1. Color System Transformation

### Current (Dark Mode)
```css
Primary: #E8751A (orange)
Background: #0D1117 (near-black)
Surface: #161b22 (dark gray)
Text: #e6edf3 (light gray)
Accent: #3D8EF0 (blue)
```

### New (Light Mode — Security Palette)
```css
/* Trust & Reliability */
--primary: #1E40AF        /* Deep blue — trust, professionalism, security */
--primary-hover: #1E3A8A  /* Darker on hover */
--primary-light: #DBEAFE /* Subtle blue tints for backgrounds */

/* Success & Safety */
--success: #059669        /* Green — secure, protected, validated */
--success-light: #D1FAE5  /* Soft green backgrounds */

/* Attention & Cost */
--warning: #D97706        /* Amber — cost alerts, budget warnings */
--warning-light: #FEF3C7  /* Soft amber backgrounds */

/* Critical & Errors */
--danger: #DC2626         /* Red — errors, violations */
--danger-light: #FEE2E2   /* Soft red backgrounds */

/* Backgrounds */
--bg-primary: #FFFFFF     /* Clean white */
--bg-secondary: #F9FAFB   /* Soft gray for cards */
--bg-tertiary: #F3F4F6    /* Subtle differentiation */

/* Borders & Dividers */
--border-subtle: #E5E7EB  /* Soft gray borders */
--border-medium: #D1D5DB  /* Medium borders */
--border-strong: #9CA3AF  /* Strong separation */

/* Text */
--text-primary: #111827    /* Near-black for readability */
--text-secondary: #4B5563  /* Gray for secondary info */
--text-muted: #6B7280      /* Muted for tertiary info */

/* Orange Demoted to Tertiary */
--accent-orange: #F59E0B   /* Used only for trace visualization highlights */
```

### Color Philosophy

**Blue = Trust & Security**
- Primary CTAs, navigation, headers
- Conveys reliability, professionalism, data security
- Used for "protective" features: cost budgets, SLA monitoring, regression detection

**Green = Success & Validation**
- Successful states, checkmarks, "protected" badges
- Used for security features: audit logs, data sovereignty, encryption

**Amber/Orange = Attention (not danger)**
- Cost alerts, performance warnings, things to watch
- Demotes orange from brand primary to functional accent

**White/Gray = Clarity & Transparency**
- Clean backgrounds = "nothing to hide"
- Subtle borders = structure without noise
- Generous whitespace = breathing room, not overwhelming

---

## 2. Visual Language: "Command Center" Aesthetic

### Design Principles

**1. Grid-Based Layouts**
- Structured, aligned, predictable
- Visual language: "everything is organized and under control"

**2. Depth Through Subtle Shadows**
- Not flat, but not skeuomorphic
- Light shadows = layers = defense in depth
- Cards "float" slightly above background

**3. Icon Strategy**
- **Proactive icons:** Eye (visibility), Shield-Check (protected), Lock-Open (you control access), Layers (separation), Gauge (monitoring)
- **Avoid reactive icons:** Lock (locked out), Shield (defensive), Warning signs
- Use Heroicons or Lucide for consistency

**4. Data Visualization = Proof**
- Trace trees, cost charts, SLA graphs are the signature visuals
- Orange/amber heatmaps for span duration
- Blue for successful paths, red for errors
- Make visualizations clean and readable, not decorative

**5. Typography**
- **Headlines:** Inter Bold (clean, modern, technical)
- **Body:** Inter Regular (high readability)
- **Code:** JetBrains Mono (infrastructure tooling standard)
- No script fonts, no playful elements

### Component Patterns

**Cards:**
```css
background: white
border: 1px solid #E5E7EB
border-radius: 12px
box-shadow: 0 1px 3px rgba(0,0,0,0.05)
padding: 24px

hover:
  border-color: #1E40AF
  box-shadow: 0 4px 6px rgba(30,64,175,0.08)
```

**Buttons:**
```css
Primary:
  background: #1E40AF
  color: white
  hover: #1E3A8A
  
Secondary:
  background: white
  border: 1.5px solid #1E40AF
  color: #1E40AF
  hover background: #DBEAFE

Tertiary (low emphasis):
  background: transparent
  color: #4B5563
  hover: underline
```

**Badges:**
```css
Security/Protected:
  background: #D1FAE5
  color: #059669
  border: 1px solid #10B981

Warning/Cost:
  background: #FEF3C7
  color: #D97706
  border: 1px solid #F59E0B
```

---

## 3. Page Structure: All 11 Missing Features + Canonical Pain Story

### Hero Section

**Visual:** 3-column layout, clean white background with subtle blue gradient overlay (5% opacity)

**Left Column (60%):**
```
Badge: "Open Source · Self-Hosted · Your Data, Your Infrastructure"

H1: "Stop guessing why your 
agents broke."

Subhead (canonical pain story):
You shipped an agent on Friday. By Monday it had 
looped 40,000 times. The bill was $1,200.

With Foxhound:
• Cost Budgets would have killed it at $50
• Session Replay shows exactly where it broke
• SLA Monitor would have alerted you Friday night

CTA Primary: pip install foxhound-ai [copy icon]
CTA Secondary: View Demo → [arrow]
```

**Right Column (40%):**
- Animated trace tree visualization (light mode)
- Clean, minimal, showing span hierarchy
- Blue successful spans, red error span, orange timing bars
- Subtle shadow, floating above background

**Framework Strip Below:**
Light gray background (`#F9FAFB`), small logos/text:
`Auto-instruments: LangGraph · CrewAI · AutoGen · OpenAI Agents · Claude SDK · Pydantic AI · Mastra · Bedrock · Google ADK · OpenTelemetry`

---

### Section 2: Core Capabilities (3 Groups)

**Visual Treatment:** 
- White background
- 3-column grid on desktop, stacked on mobile
- Each group has an icon, category label, and 3-4 features

#### Group A: "Full Visibility" (Observability)

**Icon:** Eye (Heroicons)
**Color:** Blue (#1E40AF)

| Feature | One-liner | Visual Hint |
|---------|-----------|-------------|
| **Trace Explorer** | Complete span tree of every agent run. Every tool call, LLM invocation, and branch. | Small span tree diagram |
| **Session Replay** | Reconstruct agent state at any point. See exactly what data was available when a decision was made. | Timeline with cursor |
| **Run Diff** | Compare two runs side-by-side. Spot every divergence. Find where behavior changed. | Split-screen icon |

#### Group B: "Continuous Testing" (Evaluation)

**Icon:** Checkmark-Shield (security + validation)
**Color:** Green (#059669)

| Feature | One-liner | Visual Hint |
|---------|-----------|-------------|
| **LLM-as-a-Judge** | Automated evaluation with GPT-4 and Claude. Score every trace. | AI badge icon |
| **Datasets from Traces** | Auto-curate test datasets from production failures. Filter by score, time, agent. | Database icon |
| **Experiments** | Run datasets through agent versions. Compare scores. Catch regressions before deploy. | Beaker/lab icon |
| **GitHub Actions** | Block PRs that degrade quality. Scores in every PR comment. | GitHub logo |

#### Group C: "Proactive Control" (Agent Operations)

**Icon:** Gauge/Dashboard (monitoring & control)
**Color:** Amber (#D97706)

| Feature | One-liner | Visual Hint |
|---------|-----------|-------------|
| **Cost Budgets** | Per-agent spend limits. SDK callback kills runaway loops before the bill arrives. | Dollar icon |
| **SLA Monitoring** | P95 latency and success rate thresholds. Auto-alert on breach. | Clock icon |
| **Regression Detection** | Automatic baseline per version. Alert when span structure changes. | Trending-up icon |
| **Slack Alerts** | Route alerts by type and severity. Cost spikes, SLA breaches, regressions. | Bell icon |

**Card Design:**
- White background
- 1px border (#E5E7EB)
- Icon in colored circle (category color)
- Category label in small caps
- Feature name bold
- One-liner in secondary text color
- Hover: lift shadow, border changes to category color

---

### Section 3: Developer Tools

**2-column layout:**

#### Left: MCP Server
```
Icon: Terminal

31 debugging tools in your IDE.

Install the Foxhound MCP server. Search traces, 
replay sessions, diff runs, check budgets, trigger 
evaluations — without leaving Claude Code, Cursor, 
or Windsurf.

Terminal preview showing:
$ claude mcp add io.github.caleb-love/foxhound
✓ Installed @foxhound-ai/mcp-server@0.2.0

[View all 31 tools →]
```

#### Right: GitHub Actions
```
Icon: GitHub

Quality gates in CI/CD.

Block deployments when agent quality degrades. 
Run experiments in GitHub Actions. Post score 
comparisons in PR comments.

Code preview showing:
- uses: foxhound-ai/quality-gate-action@v1
  with:
    dataset-id: support-agent-eval
    threshold: 0.80
    
[Setup guide →]
```

---

### Section 4: Security & Data Sovereignty

**Background:** Subtle green tint (#F0FDF4)
**Layout:** 3-column feature grid

**Headline:** "Your data. Your infrastructure. Your control."

| Feature | Description | Icon |
|---------|-------------|------|
| **Self-Hosted** | Deploy on your infrastructure. Docker Compose, Kubernetes, or bare metal. | Server icon |
| **Multi-Tenant Isolation** | Org-level database isolation. Every query scoped by org_id. | Layers icon |
| **Open Source** | MIT licensed. Audit the code. Fork it. Contribute. | Code brackets icon |
| **Data Residency** | Traces stay where you put them. No third-party processors. | Map pin icon |
| **API-First** | Every feature accessible via REST API. Build custom integrations. | Plug icon |
| **Audit Logs** | Complete event stream. Every action, every actor, every timestamp. | List icon |

**Visual:** Each card has green checkmark icon, white background, subtle green border

---

### Section 5: SDK Integration

**Tab Switcher:** Python (default) | TypeScript

**Python Tab:**
```python
from foxhound import Foxhound

fox = Foxhound(
    api_key="fh_...",
    endpoint="https://your-instance.foxhound.dev",
)

# Auto-instrument LangGraph agents
fox.instrument("langgraph")

# Set cost budget
fox.budgets.create(
    agent_id="support-agent",
    amount_usd=50.0,
    period="daily",
    on_exceeded=lambda: agent.stop()
)

# Configure SLA monitoring
fox.slas.create(
    agent_id="support-agent",
    max_duration_ms=5000,
    min_success_rate=0.95
)
```

**TypeScript Tab:**
```typescript
import { Foxhound } from "@foxhound-ai/sdk";

const fox = new Foxhound({
  apiKey: process.env.FOXHOUND_API_KEY,
  endpoint: "https://your-instance.foxhound.dev",
});

// Auto-instrument Claude Agent SDK
fox.instrument("claude-agent-sdk");

// Track cost in real-time
fox.budgets.create({
  agentId: "support-agent",
  amountUsd: 50,
  period: "daily",
  onExceeded: () => agent.stop(),
});
```

**Visual:** Light code editor aesthetic, syntax highlighting with security-palette colors

---

### Section 6: Pricing

**Background:** White
**Layout:** 4-column comparison table

| | **Free** | **Pro** | **Team** | **Enterprise** |
|---|---|---|---|---|
| **Price** | $0 | $29/mo | $99/mo | Custom |
| **Spans/month** | 100K | 1M | 5M | Custom |
| **Retention** | 30 days | 1 year | 2 years | Custom |
| **Users** | Unlimited | Unlimited | Unlimited | Unlimited |
| **All Features** | ✓ | ✓ | ✓ | ✓ |
| **Cost Budgets** | ✓ | ✓ | ✓ | ✓ |
| **SLA Monitoring** | ✓ | ✓ | ✓ | ✓ |
| **Regression Detection** | ✓ | ✓ | ✓ | ✓ |
| **Prompt Management** | - | ✓ | ✓ | ✓ |
| **Priority Support** | - | - | ✓ | ✓ |
| **SSO/SAML** | - | - | - | ✓ |

**CTA:** "Start free — pip install foxhound-ai"

**Note below table:** "Unlimited users on all plans. No feature gates on Free tier — volume-limited only."

**Visual:** 
- Pro column highlighted with subtle blue border
- Green checkmarks for included features
- Clean, scannable table design

---

### Section 7: Open Source CTA

**Background:** Subtle blue gradient (#DBEAFE to white)
**Layout:** Centered, max-width 600px

```
Icon: GitHub logo

Open source. Self-host anywhere.

MIT-licensed. Ships as Docker Compose or Kubernetes. 
Your data never leaves your infrastructure. Audit the 
code. Fork it. Contribute.

CTA: Get started on GitHub →
CTA: Read the docs →
```

---

## 4. Component Architecture

Break `Landing.tsx` into focused components:

```
src/components/landing/
├── Hero.tsx                 (~120 lines)
│   ├── HeroText.tsx
│   └── TraceVisualization.tsx
├── FrameworkStrip.tsx       (~40 lines)
├── CapabilitiesGrid.tsx     (~150 lines)
│   ├── CapabilityGroup.tsx
│   └── FeatureCard.tsx
├── DeveloperTools.tsx       (~100 lines)
│   ├── McpServerCard.tsx
│   └── GitHubActionsCard.tsx
├── SecuritySection.tsx      (~80 lines)
├── SdkIntegration.tsx       (~120 lines)
│   └── CodeBlock.tsx
├── PricingTable.tsx         (~150 lines)
├── OpenSourceCta.tsx        (~60 lines)
├── Footer.tsx               (~60 lines)
└── index.ts
```

---

## 5. Implementation Phases

### Phase 1: Design System & Tokens (2-3 hours)

**Files:**
- `src/styles/design-system.css` (new file)
- `src/app/globals.css` (update)

**Tasks:**
- [ ] Define CSS custom properties for new color palette
- [ ] Create light mode theme tokens
- [ ] Define spacing scale (4px base)
- [ ] Define typography scale
- [ ] Create shadow system (3 levels)
- [ ] Define border radius tokens

**Output:** Complete design token system

---

### Phase 2: Component Library (3-4 hours)

**Files:**
- `src/components/ui/Button.tsx` (new)
- `src/components/ui/Card.tsx` (new)
- `src/components/ui/Badge.tsx` (new)
- `src/components/ui/Icon.tsx` (new)

**Tasks:**
- [ ] Build Button component (3 variants: primary, secondary, tertiary)
- [ ] Build Card component (with hover states)
- [ ] Build Badge component (security, warning, info variants)
- [ ] Icon wrapper component (Heroicons integration)
- [ ] Create Storybook or test page for components

**Output:** Reusable UI component library

---

### Phase 3: Hero & Pain Story (2-3 hours)

**Files:**
- `src/components/landing/Hero.tsx`
- `src/components/landing/TraceVisualization.tsx`

**Tasks:**
- [ ] Build hero layout (60/40 split)
- [ ] Implement canonical pain story copy
- [ ] Create animated trace tree (light mode)
- [ ] Add CTA buttons with copy-to-clipboard
- [ ] Framework strip below hero

**Output:** Complete hero section with pain story

---

### Phase 4: Core Capabilities (3-4 hours)

**Files:**
- `src/components/landing/CapabilitiesGrid.tsx`
- `src/components/landing/CapabilityGroup.tsx`
- `src/components/landing/FeatureCard.tsx`

**Tasks:**
- [ ] Build 3-group layout
- [ ] Create 11 feature cards with icons
- [ ] Add category icons and colors
- [ ] Implement hover states
- [ ] Responsive grid (3-col → 1-col)

**Output:** Complete capabilities section with all 11 features

---

### Phase 5: Developer Tools (2 hours)

**Files:**
- `src/components/landing/DeveloperTools.tsx`
- `src/components/landing/McpServerCard.tsx`
- `src/components/landing/GitHubActionsCard.tsx`

**Tasks:**
- [ ] Build 2-column layout
- [ ] MCP Server card with terminal preview
- [ ] GitHub Actions card with code preview
- [ ] Link to detailed documentation

**Output:** Developer tools section

---

### Phase 6: Security & Data Sovereignty (2 hours)

**Files:**
- `src/components/landing/SecuritySection.tsx`

**Tasks:**
- [ ] Build 6-feature grid
- [ ] Green checkmark icons
- [ ] Subtle green background
- [ ] Hover states on cards

**Output:** Security section projecting data sovereignty

---

### Phase 7: SDK Integration & Pricing (3 hours)

**Files:**
- `src/components/landing/SdkIntegration.tsx`
- `src/components/landing/CodeBlock.tsx`
- `src/components/landing/PricingTable.tsx`

**Tasks:**
- [ ] Tab switcher (Python/TypeScript)
- [ ] Syntax highlighting (light theme)
- [ ] Pricing table with 4 tiers
- [ ] Pro column highlight
- [ ] Responsive table (scroll on mobile)

**Output:** SDK and pricing sections

---

### Phase 8: Footer & Navigation (2 hours)

**Files:**
- `src/components/landing/Footer.tsx`
- `src/app/layout.tsx` (update nav)

**Tasks:**
- [ ] Update nav to light theme
- [ ] Add Discord, Twitter links
- [ ] Footer with link groups
- [ ] Update logo for light mode (if needed)

**Output:** Complete navigation and footer

---

### Phase 9: Responsive & Polish (3-4 hours)

**Tasks:**
- [ ] Test all breakpoints (320, 768, 1024, 1440)
- [ ] Mobile navigation (hamburger menu)
- [ ] Touch targets (min 44px)
- [ ] Keyboard navigation
- [ ] Focus states
- [ ] Loading states
- [ ] Performance optimization (lazy loading, image optimization)

**Output:** Production-ready responsive site

---

### Phase 10: Metadata & SEO (1-2 hours)

**Files:**
- `src/app/page.tsx` (metadata)
- `src/app/layout.tsx` (global metadata)
- `src/components/JsonLd.tsx` (update)
- `public/og-image.png` (new - light theme)

**Tasks:**
- [ ] Update meta descriptions
- [ ] Create light-themed OG image
- [ ] Update structured data
- [ ] Add alt text to all images
- [ ] Check canonical URLs

**Output:** SEO-optimized metadata

---

## 6. Copy Checklist (Brand Voice Compliance)

**Do:**
- [x] Lead with canonical pain story in hero
- [x] Use specific numbers ("31 tools", "100K spans/month")
- [x] Code examples in SDK section
- [x] `pip install foxhound-ai` as primary CTA
- [x] Feature names capitalized
- [x] Mechanism proof over adjectives

**Don't:**
- [x] No "powerful/robust/seamless/cutting-edge"
- [x] No "compliance-grade/tamper-evident"
- [x] No "excited to announce"
- [x] No buzzword stacking
- [x] Max one CTA per section

**New additions:**
- [x] "Your data, your infrastructure, your control" (proactive security messaging)
- [x] "Stop guessing why your agents broke" (problem-first)
- [x] All 11 missing features represented
- [x] Pricing transparency (no "contact us" for basic info)

---

## 7. Visual Assets Needed

### Critical (create before launch)

- [ ] Light-themed logo/wordmark (if current orange logo doesn't work on white)
- [ ] Trace tree visualization (light mode, animated)
- [ ] 5-6 dashboard screenshots (light theme):
  - Trace Explorer with span tree
  - Session Replay interface
  - Run Diff comparison
  - Cost Budgets dashboard
  - SLA Monitor alerts
  - Regression Detection graph
- [ ] Icons for all 11 features (Heroicons or Lucide)
- [ ] OG image (1200x630, light theme with logo + tagline)
- [ ] Favicon (multi-size, light-compatible)

### Nice-to-have

- [ ] 30-second demo GIF (Session Replay in action)
- [ ] Architecture diagram (light mode)
- [ ] Framework logos strip

---

## 8. Success Metrics

**Design Quality:**
- [ ] Lighthouse accessibility score >95
- [ ] Lighthouse performance score >90
- [ ] Zero dark mode artifacts
- [ ] Consistent 4px spacing grid
- [ ] All text passes WCAG AA contrast (4.5:1 minimum)

**Content Completeness:**
- [ ] All 11 missing features represented
- [ ] Canonical pain story in hero
- [ ] Pricing table with all 4 tiers
- [ ] Security section projects data sovereignty
- [ ] Zero compliance/tamper-evident claims

**Functional:**
- [ ] Responsive 320-1440px
- [ ] Copy-to-clipboard works
- [ ] Tab switcher works (SDK section)
- [ ] All links functional
- [ ] Fast load time (<2s LCP)

---

## 9. Open Questions for Review

1. **Logo treatment:** Does current orange fox logo work on white background, or do we need a blue variant?
2. **Trace visualization:** Animated or static? If animated, what triggers the animation?
3. **Screenshot source:** Real data or designed mocks? (Recommend designed mocks with realistic fake data)
4. **Navigation:** Sticky header or scroll-away?
5. **CTA strategy:** Single "pip install" throughout, or vary by section?
6. **Pricing page:** Separate `/pricing` route or anchor link from landing?

---

## 10. Timeline Estimate

**Total:** ~25-30 hours across 10 phases

**Breakdown:**
- Design system: 2-3 hours
- Component library: 3-4 hours  
- Content sections: 15-18 hours
- Polish & QA: 3-4 hours
- Metadata: 1-2 hours

**With AI assistance (Claude drafts, human reviews):**
- Code generation: ~40% faster
- Copy generation: ~60% faster
- **Realistic estimate: 15-20 hours human time**

---

## Next Steps

1. **Review this plan** - confirm design direction (light mode + security focus)
2. **Create design tokens** - start with color palette in CSS custom properties
3. **Build component library** - foundation for all sections
4. **Implement sections iteratively** - hero first (highest impact)
5. **Test and refine** - responsive, accessibility, performance

**Ready to start implementation?**
