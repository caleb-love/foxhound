# Cost Budgets: Implementation Plan

**Feature:** Per-agent spending limits & alerts  
**Time Estimate:** 4-5 hours  
**Status:** Starting now  

---

## 🎯 User Story

**As a developer**, I want to set spending limits on my agents so I can:
- Prevent runaway costs
- Get alerted before hitting limits
- Track spending by agent
- Stay within budget

---

## ✅ Features to Build

### 1. Budget Settings UI (1.5 hours)
- [ ] Budget settings page (`/demo/budgets`)
- [ ] List all agents with current spend
- [ ] Set monthly limit per agent
- [ ] Set alert thresholds (80%, 90%, 100%)
- [ ] Enable/disable budgets
- [ ] Save settings (local storage for demo)

### 2. Real-Time Cost Tracking (1 hour)
- [ ] Calculate total cost per agent
- [ ] Calculate costs for current month
- [ ] Show progress bars (spent vs budget)
- [ ] Color coding (green/yellow/red)
- [ ] Percentage used display

### 3. Alert System (1 hour)
- [ ] Visual alerts when threshold hit
- [ ] Badge on sidebar "Budgets" item
- [ ] Alert banner on dashboard
- [ ] List of agents over budget
- [ ] Email alerts (mock for demo)

### 4. Visualization (1.5 hours)
- [ ] Bar chart: budget vs actual
- [ ] Line chart: daily spending trend
- [ ] Pie chart: spending by agent
- [ ] Top spenders list
- [ ] Projected month-end costs

---

## 🎨 UI Design

```
┌──────────────────────────────────────────────────────────────┐
│  Cost Budgets                                    [+ Add]     │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Monthly Budget Overview                                     │
│  ┌────────────────────────────────────────────┐             │
│  │ Total Budget:     $500.00                  │             │
│  │ Spent This Month: $342.50 (68.5%)          │             │
│  │ Remaining:        $157.50                  │             │
│  │ [████████████░░░░░░] 68.5%                 │             │
│  └────────────────────────────────────────────┘             │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Agent              Budget    Spent    Status             ││
│  ├─────────────────────────────────────────────────────────┤│
│  │ codegen-agent      $100.00   $89.45   [██████████] 89%  ││
│  │ ⚠️  Alert: Approaching limit (90%)                       ││
│  ├─────────────────────────────────────────────────────────┤│
│  │ research-agent     $150.00   $125.30  [████████] 83%    ││
│  │ ✅ On track                                               ││
│  ├─────────────────────────────────────────────────────────┤│
│  │ support-agent-v2   $100.00   $127.75  [██████████] 127% ││
│  │ 🚨 Over budget by $27.75!                                ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  Spending Trend (Last 30 Days)                              │
│  ┌────────────────────────────────────────────┐             │
│  │     $                                      │             │
│  │ 20  │         ╭─╮                          │             │
│  │ 15  │    ╭───╯  ╰─╮    ╭───╮              │             │
│  │ 10  │ ╭─╯          ╰────╯   ╰─╮            │             │
│  │  5  │─╯                       ╰────         │             │
│  │  0  └──────────────────────────────────>  │             │
│  │         5    10    15    20    25    30    │             │
│  └────────────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔧 Technical Implementation

### Data Structure
```typescript
interface Budget {
  agentId: string;
  monthlyLimit: number;      // $100.00
  alertThresholds: {
    warning: number;          // 80%
    critical: number;         // 90%
    exceeded: number;         // 100%
  };
  enabled: boolean;
  notifications: {
    email: boolean;
    slack: boolean;
    webhook?: string;
  };
}

interface BudgetStatus {
  agentId: string;
  budget: number;
  spent: number;
  percentage: number;
  remaining: number;
  status: 'ok' | 'warning' | 'critical' | 'exceeded';
  alerts: Alert[];
}

interface Alert {
  type: 'warning' | 'critical' | 'exceeded';
  message: string;
  timestamp: number;
  agentId: string;
}
```

### Components to Create
1. `components/budgets/budget-overview.tsx` — Summary cards
2. `components/budgets/budget-table.tsx` — Agent budgets table
3. `components/budgets/budget-form.tsx` — Set/edit budget modal
4. `components/budgets/spending-chart.tsx` — Recharts visualization
5. `components/budgets/budget-alerts.tsx` — Alert banner
6. `lib/stores/budget-store.ts` — Budget state (Zustand)

### Routes
- `/demo/budgets` — Budget management page
- Alert banner appears on all pages when over limit

---

## 📊 Calculations

### Monthly Cost per Agent
```typescript
function calculateAgentCost(agentId: string, traces: Trace[]): number {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  return traces
    .filter(trace => 
      trace.agentId === agentId &&
      new Date(trace.startTimeMs) >= monthStart
    )
    .reduce((total, trace) => {
      return total + trace.spans.reduce((sum, span) => {
        return sum + ((span.attributes.cost as number) || 0);
      }, 0);
    }, 0);
}
```

### Budget Status
```typescript
function getBudgetStatus(spent: number, limit: number): BudgetStatus['status'] {
  const percentage = (spent / limit) * 100;
  
  if (percentage >= 100) return 'exceeded';
  if (percentage >= 90) return 'critical';
  if (percentage >= 80) return 'warning';
  return 'ok';
}
```

### Projected End of Month
```typescript
function projectMonthEnd(currentSpent: number, daysElapsed: number): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dailyAverage = currentSpent / daysElapsed;
  return dailyAverage * daysInMonth;
}
```

---

## 🎯 Success Criteria

**Must Have:**
- [ ] Can set budget per agent
- [ ] Shows current spending
- [ ] Progress bars work
- [ ] Alerts appear when over budget
- [ ] Chart visualizes spending
- [ ] Settings persist (localStorage)

**Nice to Have:**
- [ ] Email notifications (mocked)
- [ ] Slack integration (mocked)
- [ ] Webhook alerts
- [ ] Export budget reports
- [ ] Multi-currency support

---

## 🚀 Implementation Order

1. ✅ Plan complete
2. ⏳ Create budget store (30 min)
3. ⏳ Build overview cards (30 min)
4. ⏳ Build budget table (1 hour)
5. ⏳ Add budget form modal (1 hour)
6. ⏳ Create spending chart (1 hour)
7. ⏳ Add alert system (1 hour)
8. ⏳ Test with demo data (30 min)

**Total:** 4-5 hours

---

## 💰 Example Scenarios

### Scenario 1: Approaching Limit
```
Agent: codegen-agent
Budget: $100/month
Spent: $89.45 (89%)
Status: Warning (yellow)

Alert: "codegen-agent has used 89% of monthly budget"
Action: Review usage, optimize prompts
```

### Scenario 2: Over Budget
```
Agent: support-agent-v2
Budget: $100/month
Spent: $127.75 (127%)
Status: Exceeded (red)

Alert: "support-agent-v2 is over budget by $27.75!"
Action: Pause agent, increase budget, or optimize
```

### Scenario 3: On Track
```
Agent: research-agent
Budget: $150/month
Spent: $45.20 (30%)
Status: OK (green)
Projected: $125.50 (within budget)

No alerts needed
```

---

## 🔥 Let's Build It!

Starting with the budget store and overview...
