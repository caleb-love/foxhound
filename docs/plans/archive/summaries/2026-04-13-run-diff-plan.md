# Run Diff: Implementation Plan

**Feature:** Side-by-side trace comparison tool  
**Time Estimate:** 3-4 hours  
**Status:** Starting now  

---

## 🎯 User Story

**As a developer**, I want to compare two traces side-by-side so I can:
- See what changed between versions
- Identify performance regressions
- Understand cost differences
- Debug behavior changes

---

## ✅ Features to Build

### 1. Trace Selection (30 min)
- [ ] Add checkbox column to trace table
- [ ] "Compare" button appears when 2 selected
- [ ] Click "Compare" opens comparison view
- [ ] Show selected trace badges

### 2. Comparison View (1 hour)
- [ ] Split layout (50/50)
- [ ] Left: Trace A details
- [ ] Right: Trace B details
- [ ] Synchronized scrolling
- [ ] Header with trace IDs

### 3. Visual Span Diff (1 hour)
- [ ] Side-by-side timelines
- [ ] Color coding:
  - Green: Added spans (only in B)
  - Red: Removed spans (only in A)
  - Blue: Modified spans
  - Gray: Unchanged spans
- [ ] Diff indicators

### 4. Metrics Comparison (1 hour)
- [ ] Cost delta card
  - Trace A: $1.23
  - Trace B: $0.89
  - Delta: -$0.34 (27% cheaper) ✅
- [ ] Duration delta card
  - Trace A: 120.5s
  - Trace B: 95.3s
  - Delta: -25.2s (21% faster) ✅
- [ ] Span count comparison
- [ ] Error comparison

### 5. Optimization Insights (30 min)
- [ ] Auto-detect improvements
  - "Trace B is 27% cheaper"
  - "Trace B is 21% faster"
  - "Removed 2 unnecessary tool calls"
- [ ] Highlight cost savings
- [ ] Suggest optimizations

---

## 🎨 UI Design

```
┌──────────────────────────────────────────────────────────────┐
│  Run Diff: trace-001 vs trace-002              [Close]       │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────┐  ┌─────────────────────┐           │
│  │ Cost: $1.23         │  │ Cost: $0.89         │           │
│  │ Delta: -$0.34 (27%) │  │ 💰 Cheaper!         │           │
│  └─────────────────────┘  └─────────────────────┘           │
│                                                               │
│  ┌─────────────────────┐  ┌─────────────────────┐           │
│  │ Duration: 120.5s    │  │ Duration: 95.3s     │           │
│  │ Delta: -25.2s (21%) │  │ ⚡ Faster!          │           │
│  └─────────────────────┘  └─────────────────────┘           │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Trace A (baseline)        Trace B (comparison)              │
│  ━━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━             │
│                                                               │
│  [█ span1] ───────────    [█ span1] ───────────  (unchanged) │
│  [█ span2] ──────         [█ span2] ────         (faster)    │
│  [█ span3] ────────                              (removed)   │
│                           [█ span4] ──────       (added)     │
│  [█ span5] ────────       [█ span5] ────────     (unchanged) │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│  Insights:                                                    │
│  ✅ 27% cost reduction                                        │
│  ✅ 21% latency improvement                                   │
│  ✅ Removed 1 unnecessary span                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔧 Technical Implementation

### Data Structure
```typescript
interface TraceDiff {
  traceA: Trace;
  traceB: Trace;
  costDelta: {
    absolute: number;  // -0.34
    percentage: number; // -27
    improved: boolean;  // true if B is cheaper
  };
  durationDelta: {
    absolute: number;   // -25200 (ms)
    percentage: number; // -21
    improved: boolean;  // true if B is faster
  };
  spanDiff: {
    added: Span[];      // Only in B
    removed: Span[];    // Only in A
    modified: Span[];   // Different between A & B
    unchanged: Span[];  // Same in both
  };
}
```

### Components to Create
1. `components/diff/trace-selector.tsx` — Checkbox selection
2. `components/diff/run-diff-view.tsx` — Main comparison view
3. `components/diff/timeline-diff.tsx` — Side-by-side timelines
4. `components/diff/metrics-delta.tsx` — Cost/duration cards
5. `components/diff/insights-panel.tsx` — Auto-generated insights

### Route
- `/demo/diff?a=[traceId]&b=[traceId]` — Comparison view

---

## 🎯 Success Criteria

**Must Have:**
- [ ] Can select 2 traces from list
- [ ] Comparison view shows both traces
- [ ] Cost delta calculated correctly
- [ ] Duration delta calculated correctly
- [ ] Visual diff shows added/removed/modified spans
- [ ] Insights panel provides value

**Nice to Have:**
- [ ] Share comparison URL
- [ ] Export comparison as PDF
- [ ] Compare more than 2 traces
- [ ] Historical comparison (before/after deploy)

---

## 📊 Example Use Cases

### Use Case 1: Model Swap
**Scenario:** Changed from GPT-4 to Claude Sonnet
- Compare traces before/after
- See cost reduction: -35%
- See latency improvement: -12%
- Validate output quality maintained

### Use Case 2: Optimization
**Scenario:** Removed unnecessary tool call
- Compare before/after
- See removed span highlighted
- See cost savings: -$0.15 per trace
- Calculate savings at scale

### Use Case 3: Debugging
**Scenario:** New version has higher latency
- Compare working vs broken version
- See added spans causing slowdown
- Identify bottleneck
- Fix and re-compare

---

## 🚀 Implementation Order

1. ✅ Plan complete
2. ⏳ Build trace selector (30 min)
3. ⏳ Build comparison view layout (30 min)
4. ⏳ Add metrics delta cards (30 min)
5. ⏳ Build timeline diff component (1 hour)
6. ⏳ Add insights panel (30 min)
7. ⏳ Test with demo data (30 min)

**Total:** 3-4 hours

---

## 🔥 Let's Build It!

Starting now...
