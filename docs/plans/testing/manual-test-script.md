# 🧪 Manual Testing Script - Follow Along!

**Server is running at: http://localhost:3001**

Follow this script step-by-step and check off each item as you test!

---

## ✅ Test 1: Root Redirect & Demo Mode (30 seconds)

### Steps:
1. Open browser to: **http://localhost:3001/**
   - [ ] Should automatically redirect to `/demo`
   - [ ] URL changes to `http://localhost:3001/demo`
   - [ ] See trace list page load

2. Check page elements:
   - [ ] "Foxhound" logo in top-left
   - [ ] Sidebar with navigation items
   - [ ] "Traces" heading at top
   - [ ] Search bar visible
   - [ ] Filter controls visible
   - [ ] Trace table with data

**Expected:** Clean redirect, demo page loads with 50 traces ✅

---

## ✅ Test 2: Filters & Search (3 minutes)

### A. Status Filter
1. **Test "Error" filter:**
   - [ ] Click the "Error" pill button (should turn red)
   - [ ] Trace list filters to ~15 traces
   - [ ] Result count shows "Showing 15 traces (filtered from 50)"
   - [ ] All visible traces should have ✗ in status column

2. **Test "Success" filter:**
   - [ ] Click "Success" pill (should turn green)
   - [ ] List shows ~35 traces
   - [ ] All visible traces have ✓ in status column

3. **Test "All" filter:**
   - [ ] Click "All" pill
   - [ ] See all 50 traces again

### B. Agent Filter
1. **Open agent dropdown:**
   - [ ] Click "Agents" button
   - [ ] Popover opens showing 7 agent types:
     - advanced-rag
     - codegen-agent
     - data-pipeline
     - orchestrator
     - research-agent
     - resilient-agent
     - support-agent-v2

2. **Test single selection:**
   - [ ] Check "codegen-agent" checkbox
   - [ ] Popover shows "1" badge on button
   - [ ] List filters to ~7 traces
   - [ ] All traces show "codegen-agent" in Agent column

3. **Test multi-selection:**
   - [ ] Check "research-agent" too (keep codegen checked)
   - [ ] Badge shows "2"
   - [ ] List shows ~14 traces (both types)

4. **Clear selection:**
   - [ ] Click "Clear selection" button in popover
   - [ ] Badge disappears
   - [ ] List shows all 50 traces again

### C. Date Range
1. **Test presets:**
   - [ ] Click date dropdown (default: "Last 24h")
   - [ ] Select "Last 7d"
   - [ ] Dropdown text changes
   - [ ] All traces still visible (demo data is recent)

### D. Search Bar
1. **Test search by agent:**
   - [ ] Type "codegen" in search bar
   - [ ] List filters instantly to codegen traces
   - [ ] See X button appear in search bar

2. **Test search clear:**
   - [ ] Click X button
   - [ ] Search clears
   - [ ] List shows all traces

3. **Test search by workflow:**
   - [ ] Type "research"
   - [ ] Filters to research-related traces

4. **Test search by trace ID:**
   - [ ] Copy any trace ID from the list
   - [ ] Paste into search
   - [ ] Should filter to just that trace

### E. Combined Filters
1. **Test multiple filters:**
   - [ ] Set status to "Error"
   - [ ] Check "codegen-agent" in agent filter
   - [ ] Type "code" in search
   - [ ] Should see only error traces from codegen agent
   - [ ] Result count updates accordingly

2. **Clear all filters:**
   - [ ] Click "Clear filters" button
   - [ ] All filters reset to defaults
   - [ ] See all 50 traces again

**Expected:** All filters work instantly, no page reloads ✅

---

## ✅ Test 3: Trace Timeline (3 minutes)

### A. Navigate to Trace Detail
1. **Open a trace:**
   - [ ] Click "View" button on any trace
   - [ ] URL changes to `/demo/traces/[id]`
   - [ ] Trace detail page loads

2. **Check header:**
   - [ ] See "Trace" heading
   - [ ] See success/error badge
   - [ ] See trace ID in small font

3. **Check stats cards:**
   - [ ] Duration card shows seconds (e.g., "95.30s")
   - [ ] Spans card shows count (e.g., "6")
   - [ ] Agent card shows agent name

### B. Timeline View (Default Tab)
1. **Check timeline display:**
   - [ ] See "Timeline" tab is selected
   - [ ] See "Execution Timeline" section
   - [ ] See colored bars representing spans:
     - Blue bars = LLM calls
     - Green bars = Tool calls
     - Purple bars = Agent steps
     - Gray bars = Workflow steps

2. **Check timeline labels:**
   - [ ] See span names below timeline
   - [ ] See kind badges (LLM Call, Tool Call, etc.)
   - [ ] See duration on right side

### C. Hover Interactions
1. **Test hover state:**
   - [ ] Hover over any span bar
   - [ ] Blue ring should appear around span
   - [ ] Cursor changes to pointer
   - [ ] Tooltip appears with span info

2. **Test error highlighting:**
   - [ ] Find trace with errors (filter by "Error" status first)
   - [ ] Open that trace
   - [ ] Error spans should have RED ring/border

**Expected:** Timeline displays correctly, interactive hover works ✅

---

## ✅ Test 4: Span Detail Panel (3 minutes)

### A. Open Panel
1. **Click a blue span (LLM call):**
   - [ ] Click any blue bar
   - [ ] Panel slides in from RIGHT side
   - [ ] Smooth animation (~300ms)

2. **Check panel header:**
   - [ ] Span name in title
   - [ ] "LLM Call" badge (blue)
   - [ ] "OK" or "Error" status badge
   - [ ] Span ID shown

### B. LLM Call Details
1. **Check LLM-specific section:**
   - [ ] See "LLM Details" heading
   - [ ] Light blue background box
   - [ ] Model name (e.g., "gpt-4-turbo" or "claude-3.5-sonnet")
   - [ ] Input tokens (may be null in some traces)
   - [ ] Output tokens (may be null)
   - [ ] Cost in dollars (e.g., "$0.6780")

2. **Check metrics:**
   - [ ] Duration shows in seconds
   - [ ] Status shows "ok" or "error"

### C. Tool Call Details
1. **Click a green span (tool call):**
   - [ ] Panel updates to new span
   - [ ] See "Tool Details" heading
   - [ ] Green background box
   - [ ] Tool name (e.g., "serp_api", "pytest")
   - [ ] Results count (e.g., 50)

### D. Copy Buttons
1. **Test Copy Span ID:**
   - [ ] Click "Copy Span ID" button
   - [ ] Button shows checkmark icon
   - [ ] Text changes to "Copied!"
   - [ ] After 2 seconds, reverts to normal
   - [ ] Check clipboard (Cmd+V) - should have span ID

2. **Test Copy JSON:**
   - [ ] Click "Copy JSON" button
   - [ ] Same checkmark feedback
   - [ ] Check clipboard - should have formatted JSON

### E. Close Panel
1. **Test ESC key:**
   - [ ] Press ESC key
   - [ ] Panel closes smoothly

2. **Test backdrop click:**
   - [ ] Open panel again
   - [ ] Click anywhere outside panel (darker area)
   - [ ] Panel closes

3. **Test switching spans:**
   - [ ] Open panel on span 1
   - [ ] Click different span (span 2)
   - [ ] Panel updates to show span 2
   - [ ] No close/reopen animation, just content update

### F. All Attributes Section
1. **Check attributes display:**
   - [ ] Scroll down in panel
   - [ ] See "All Attributes" heading
   - [ ] See JSON formatted nicely
   - [ ] Syntax highlighting (keys vs values)

2. **Check timing section:**
   - [ ] See "Timing" section
   - [ ] Started timestamp
   - [ ] Ended timestamp
   - [ ] Both formatted as readable dates

**Expected:** Panel is smooth, all details show correctly, copy works ✅

---

## ✅ Test 5: Session Replay 🔥 (5 minutes)

### A. Switch to Replay Mode
1. **Navigate to replay:**
   - [ ] From trace detail, click "Session Replay" tab
   - [ ] Tab switches (no page reload)
   - [ ] See new interface with playback controls

2. **Check initial state:**
   - [ ] See Play button (▶) in top-left
   - [ ] See Step Forward/Backward buttons
   - [ ] See progress bar
   - [ ] See "Step 1 / X" counter
   - [ ] See speed buttons (0.5x, 1x, 2x, 4x)
   - [ ] "1x" should be selected (blue)

### B. Timeline Scrubber
1. **Check span markers:**
   - [ ] See row of boxes below controls
   - [ ] One box per span
   - [ ] First box should be highlighted (blue ring)
   - [ ] Other boxes gray/white
   - [ ] Red borders on error spans (if any)

2. **Check labels below markers:**
   - [ ] See current span name
   - [ ] See span kind (e.g., "llm_call")

### C. Playback Controls

#### 1. Play Button
- [ ] Click Play (▶) button
- [ ] Button changes to Pause (⏸)
- [ ] Watch automatic progression:
  - Progress bar advances
  - Step counter increments
  - Span markers highlight in sequence
  - "Currently Executing" box updates
  - Agent State cards update
  - About 1 second per step (at 1x speed)

#### 2. Pause Button
- [ ] While playing, click Pause
- [ ] Button changes back to Play
- [ ] Progression stops
- [ ] Can resume from same spot

#### 3. Step Forward
- [ ] Make sure playback is paused
- [ ] Click "Step ▶" button
- [ ] Advances exactly one span
- [ ] Step counter increases by 1
- [ ] State updates

#### 4. Step Backward
- [ ] Click "◀ Step" button
- [ ] Goes back one span
- [ ] Step counter decreases by 1
- [ ] State reverts to previous

#### 5. Progress Bar Seek
- [ ] Click or drag progress bar
- [ ] Should jump to that position
- [ ] Playback pauses if it was playing
- [ ] All state updates to that point

#### 6. Span Marker Click
- [ ] Click any span marker box
- [ ] Should jump directly to that span
- [ ] That marker gets highlighted
- [ ] State updates

#### 7. Speed Controls
- [ ] Click "2x" button
- [ ] Button turns blue
- [ ] Click Play
- [ ] Should advance twice as fast (~0.5s per step)
- [ ] Try "4x" - very fast
- [ ] Try "0.5x" - slow motion
- [ ] Try "1x" - back to normal

### D. State Visualization

#### 1. Currently Executing Box
- [ ] Large box with blue border at top
- [ ] Shows "CURRENTLY EXECUTING" label
- [ ] Span name in large font
- [ ] Kind badge (LLM Call, Tool Call, etc.)
- [ ] Status badge (OK or Error)
- [ ] Duration in seconds

#### 2. Agent State Card (Left)
Step through a few spans and watch this update:
- [ ] "Steps Completed" increases (1, 2, 3...)
- [ ] "Total Cost" accumulates ($0.0000 → $0.1234 → $0.2456...)
- [ ] "Total Tokens" increases
- [ ] "Error Count" - should be 0 for success traces
- [ ] "Last Model" - shows most recent model used

#### 3. Execution History Card (Right)
- [ ] Shows last 5 completed steps
- [ ] Each row has step name
- [ ] Green checkmark (✓) for success
- [ ] Red X (✗) for errors
- [ ] Scrolls as you advance (keeps last 5)

### E. State Diff Viewer ✨

#### 1. First Step
- [ ] Go to step 1 (first span)
- [ ] See "First step - no previous state to compare" message

#### 2. Second Step Onwards
- [ ] Step forward to step 2
- [ ] See "State Changes from Previous Step" section
- [ ] Should see attribute changes:

#### 3. Check Diff Types
Look for these badge types:
- [ ] **Added** (green badge, + icon)
  - New attributes that appeared
  - Shows new value
- [ ] **Removed** (red badge, - icon)  
  - Attributes that disappeared
  - Shows old value (strikethrough)
- [ ] **Changed** (blue badge, → icon)
  - Modified values
  - Shows: old value → new value
  - Old in red (strikethrough)
  - New in green

#### 4. Common Diffs to Look For
Step through LLM calls and check for:
- [ ] Model changes (e.g., gpt-4 → claude-sonnet)
- [ ] Token counts appearing
- [ ] Cost being added
- [ ] Tool names changing

#### 5. No Changes Case
- [ ] Find a step with no attribute changes
- [ ] Should see "No attribute changes from previous step"

### F. Current Step Attributes
1. **Check full attributes:**
   - [ ] Scroll to bottom of page
   - [ ] See "Current Step Attributes" section
   - [ ] See JSON formatted
   - [ ] Should match the span's full attribute set

### G. Auto-Play to End
1. **Test complete playback:**
   - [ ] Go back to step 1 (click first marker)
   - [ ] Set speed to 2x
   - [ ] Click Play
   - [ ] Watch entire trace play through
   - [ ] Should auto-stop at last span
   - [ ] Button changes back to Play
   - [ ] Step counter shows "Step X / X" (at end)

### H. Edge Cases
1. **Last step:**
   - [ ] Jump to last span
   - [ ] "Step Forward" button should be disabled
   - [ ] Can still step backward

2. **First step:**
   - [ ] Jump to first span
   - [ ] "Step Backward" button should be disabled
   - [ ] State diff shows "no previous state"

**Expected:** Full replay control, smooth state updates, diffs show changes ✅

---

## ✅ Test 6: Error Trace Flow (3 minutes)

### A. Find Error Trace
1. **Filter to errors:**
   - [ ] Go back to trace list (click Foxhound logo or use browser back)
   - [ ] Click "Error" status filter
   - [ ] See ~15 error traces

2. **Open error trace:**
   - [ ] Click "View" on first error trace
   - [ ] See "Error" badge in header (red)

### B. Timeline with Error
1. **Identify error span:**
   - [ ] Look for span with RED ring/border
   - [ ] Note which span failed

2. **Click error span:**
   - [ ] Panel opens
   - [ ] See "Error" badge at top (red)
   - [ ] Status shows "error"
   - [ ] Can still see all attributes

### C. Replay Error Trace
1. **Switch to replay:**
   - [ ] Click "Session Replay" tab
   - [ ] Play through or step to error point

2. **Watch error appear:**
   - [ ] Error count increments when hitting error span
   - [ ] Execution history shows ✗ for failed step
   - [ ] Error span marker has red border
   - [ ] "Currently Executing" box shows Error badge

3. **Check state at error:**
   - [ ] See what cost accumulated before failure
   - [ ] See how many steps completed
   - [ ] Check state diff - what changed to cause error?

**Expected:** Errors clearly visible, can debug failure point ✅

---

## ✅ Test 7: Multiple Traces (2 minutes)

### A. Test Different Agent Types
1. **Codegen agent:**
   - [ ] Filter to "codegen-agent"
   - [ ] Open a trace
   - [ ] Should see code-related spans
   - [ ] Check for tool calls (pytest, etc.)

2. **Research agent:**
   - [ ] Filter to "research-agent"
   - [ ] Open a trace
   - [ ] Look for serp_api tool calls
   - [ ] Multiple LLM calls for synthesis

3. **Orchestrator:**
   - [ ] Filter to "orchestrator"
   - [ ] Open a trace
   - [ ] Should have many sub-agents/steps
   - [ ] Complex execution flow

### B. Test Different Trace Lengths
1. **Short trace (3-4 spans):**
   - [ ] Find short trace
   - [ ] Replay should work even with few steps

2. **Long trace (8+ spans):**
   - [ ] Find longer trace
   - [ ] Replay handles many steps
   - [ ] Timeline markers still visible
   - [ ] Execution history scrolls

**Expected:** All agent types work, different trace sizes handled ✅

---

## ✅ Test 8: Navigation & Back Button (2 minutes)

### A. Browser Navigation
1. **Back button:**
   - [ ] From trace detail, click browser back
   - [ ] Should return to trace list
   - [ ] Filters preserved (if any were set)

2. **Forward button:**
   - [ ] Click browser forward
   - [ ] Returns to trace detail
   - [ ] Stays on same tab (Timeline/Replay)

### B. Sidebar Navigation
1. **Click Foxhound logo:**
   - [ ] From any page, click logo
   - [ ] Returns to trace list

2. **Try other nav items:**
   - [ ] Click "Experiments" → See placeholder
   - [ ] Click "Datasets" → See placeholder
   - [ ] Click "Budgets" → See placeholder
   - [ ] All show "Coming soon" messages

**Expected:** Navigation smooth, no broken links ✅

---

## ✅ Test 9: Responsiveness (2 minutes)

### A. Resize Browser
1. **Make window narrower:**
   - [ ] Drag window to ~800px wide
   - [ ] Sidebar should stay visible
   - [ ] Trace table responsive
   - [ ] Filter controls stack if needed

2. **Very narrow (mobile):**
   - [ ] Resize to ~400px
   - [ ] Layout should adapt
   - [ ] Still usable (might need scroll)

### B. Different Zoom Levels
1. **Zoom in (Cmd/Ctrl + ):**
   - [ ] Increase zoom to 125%
   - [ ] Layout should stay intact
   - [ ] Text readable

2. **Zoom out (Cmd/Ctrl - ):**
   - [ ] Decrease zoom to 75%
   - [ ] See more content
   - [ ] Still usable

**Expected:** Works at different sizes, no layout breaks ✅

---

## ✅ Test 10: Performance (2 minutes)

### A. Filter Performance
1. **Rapid filtering:**
   - [ ] Quickly click different status filters
   - [ ] Should update instantly (<100ms)
   - [ ] No lag or delay

2. **Search performance:**
   - [ ] Type quickly in search bar
   - [ ] Results filter as you type
   - [ ] No visible delay

### B. Replay Performance
1. **Fast playback:**
   - [ ] Set speed to 4x
   - [ ] Click Play
   - [ ] Should advance smoothly
   - [ ] No stuttering

2. **Rapid seeking:**
   - [ ] Click different span markers quickly
   - [ ] Should jump immediately
   - [ ] State updates fast

**Expected:** Smooth performance, no lag ✅

---

## 🎉 Final Verification

### Console Check
1. **Open browser DevTools:**
   - [ ] Press F12 or Cmd+Option+I
   - [ ] Go to Console tab
   - [ ] Should see NO errors (red text)
   - [ ] Warnings (yellow) are OK

### Network Check
1. **Check API calls:**
   - [ ] Go to Network tab
   - [ ] Reload page
   - [ ] Should see:
     - `/api/demo/traces` - returns 200
     - `/api/demo/traces/[id]` - returns 200
   - [ ] No failed requests (red)

---

## ✅ Success Criteria

**All features working:**
- [x] Root redirect (/ → /demo)
- [x] Trace list loads (50 traces)
- [x] Status filter (All/Success/Error)
- [x] Agent filter (multi-select, 7 types)
- [x] Date range filter
- [x] Search bar
- [x] Combined filters
- [x] Result count updates
- [x] Timeline displays (color-coded)
- [x] Hover states on spans
- [x] Click span → detail panel
- [x] LLM details (model, tokens, cost)
- [x] Tool details (tool name, results)
- [x] Copy buttons work
- [x] ESC closes panel
- [x] Session Replay tab
- [x] Play/Pause controls
- [x] Step forward/backward
- [x] Speed controls (0.5x-4x)
- [x] Progress bar seek
- [x] Span marker click
- [x] Agent State updates
- [x] Execution History updates
- [x] **State Diff shows changes** 🔥
- [x] Error traces highlighted
- [x] Navigation works
- [x] No console errors

---

## 🎊 If All Tests Pass

**YOU'RE READY TO SHIP!** 🚀

Next steps:
1. ✅ Take screenshots of key features
2. ✅ Record 60-second demo video
3. ✅ Deploy to Vercel
4. ✅ Celebrate! 🎉

---

## 🐛 If Something Breaks

**Report what doesn't work:**
- Which test number/step?
- What did you expect?
- What actually happened?
- Any console errors?

I'll help fix it immediately!

---

**Ready? Start testing!** ⏱️

**Estimated time:** 20-25 minutes for full test
