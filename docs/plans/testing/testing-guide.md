# Foxhound Dashboard Testing Guide

**Quick 5-minute test to verify everything works!**

---

## 🚀 Start the Server

```bash
cd apps/web
pnpm dev
```

Open: **http://localhost:3001/**

**Expected:** Auto-redirects to `/demo` ✅

---

## ✅ Test 1: Trace List & Filters (2 minutes)

### What to Test
1. **Trace List**
   - [ ] See 50 traces listed
   - [ ] Status column shows ✓ or ✗
   - [ ] Duration shows seconds
   - [ ] "View" buttons visible

2. **Status Filter**
   - [ ] Click "Error" pill → List filters to ~7 traces (15% error rate)
   - [ ] Click "Success" → List filters to ~43 traces
   - [ ] Click "All" → Shows all 50 again

3. **Agent Filter**
   - [ ] Click "Agents" button → Popover opens
   - [ ] See 7 agent types listed
   - [ ] Check "codegen-agent" → List filters to ~7 traces
   - [ ] Check "research-agent" too → Shows both types
   - [ ] Click "Clear selection" → Resets

4. **Search**
   - [ ] Type "codegen" → Filters to code generation traces
   - [ ] Clear search (X button) → Shows all again
   - [ ] Type a trace ID → Finds specific trace

5. **Date Range**
   - [ ] Select "Last 7d" → Dropdown changes
   - [ ] All traces still visible (demo data is recent)

6. **Result Count**
   - [ ] Apply filters → See "Showing X traces (filtered from 50)"
   - [ ] Clear filters → Count updates

**Pass criteria:** All filters work, results update instantly ✅

---

## ✅ Test 2: Trace Timeline (2 minutes)

### What to Test
1. **Navigate to Trace**
   - [ ] Click "View" on any trace
   - [ ] See trace detail page load
   - [ ] See 3 stats cards (Duration, Spans, Agent)

2. **Timeline View**
   - [ ] See colored bars for each span
   - [ ] Blue = LLM calls
   - [ ] Green = Tool calls
   - [ ] Purple = Agent steps
   - [ ] Error spans have red ring

3. **Hover Interaction**
   - [ ] Hover over a span → Blue ring appears
   - [ ] Cursor changes to pointer
   - [ ] Tooltip shows span info

**Pass criteria:** Timeline displays correctly, hover works ✅

---

## ✅ Test 3: Span Detail Panel (2 minutes)

### What to Test
1. **Open Panel**
   - [ ] Click any blue span → Panel slides in from right
   - [ ] Header shows span name + kind badge
   - [ ] See "LLM Call" badge

2. **LLM Details**
   - [ ] See model name (e.g., "claude-3.5-sonnet")
   - [ ] See input tokens (e.g., 3,456)
   - [ ] See output tokens (e.g., 349)
   - [ ] See cost (e.g., $0.1234)

3. **Copy Buttons**
   - [ ] Click "Copy Span ID" → Checkmark appears
   - [ ] Click "Copy JSON" → Attributes copied to clipboard

4. **Close Panel**
   - [ ] Press ESC → Panel closes
   - [ ] Click outside panel (backdrop) → Closes
   - [ ] Click another span → New panel opens

5. **Tool Call**
   - [ ] Click a green span → Panel opens
   - [ ] See tool name (e.g., "pytest")
   - [ ] See tool-specific details

**Pass criteria:** Panel works, copy buttons work, can close ✅

---

## ✅ Test 4: Session Replay 🔥 (3 minutes)

### What to Test
1. **Switch to Replay Mode**
   - [ ] Click "Session Replay" tab
   - [ ] See playback controls at top
   - [ ] See timeline markers below controls

2. **Play/Pause**
   - [ ] Click Play ▶ → Watch auto-step through spans
   - [ ] Progress bar advances
   - [ ] Step counter increments (e.g., "Step 2 / 6")
   - [ ] Click Pause → Stops playback

3. **Manual Navigation**
   - [ ] Click "Step Forward" → Advances one span
   - [ ] Click "Step Backward" → Goes back one span
   - [ ] Drag progress bar → Jumps to that position
   - [ ] Click a span marker → Jumps to that span

4. **Speed Control**
   - [ ] Click "2x" → Playback faster
   - [ ] Click "0.5x" → Playback slower
   - [ ] Click "1x" → Normal speed

5. **State Visualization**
   - [ ] See "Agent State" card update
     - Steps Completed increases
     - Total Cost accumulates
     - Total Tokens increases
   - [ ] See "Execution History" show last 5 steps
     - ✓ for success
     - ✗ for errors (if any)

6. **State Diff Viewer** ✨
   - [ ] Step forward to second span
   - [ ] See "State Changes from Previous Step"
   - [ ] See attribute changes:
     - Green badge = Added
     - Red badge = Removed
     - Blue badge = Changed
   - [ ] See old → new values for changed attributes

7. **Current Span Highlight**
   - [ ] See "CURRENTLY EXECUTING" box
   - [ ] Shows current span name
   - [ ] Shows kind badge and status
   - [ ] Shows duration

**Pass criteria:** All playback controls work, state updates correctly, diff viewer shows changes ✅

---

## 🎯 Full Flow Test (5 minutes)

**Complete user journey:**

1. **Find a trace**
   - [ ] Open /demo
   - [ ] Filter to "Error" status
   - [ ] Click first error trace

2. **Inspect timeline**
   - [ ] See which span failed (red ring)
   - [ ] Click the error span → Detail panel
   - [ ] See error status badge
   - [ ] Copy span ID

3. **Replay execution**
   - [ ] Click "Session Replay" tab
   - [ ] Click Play
   - [ ] Watch execution until error
   - [ ] See error count increment
   - [ ] Check state diff at error step

4. **Understand what happened**
   - [ ] See execution history
   - [ ] See cost accumulated before failure
   - [ ] Identify which model was used
   - [ ] Screenshot for bug report

**Pass criteria:** Complete debugging workflow works end-to-end ✅

---

## 🐛 Edge Cases to Test

### Empty States
- [ ] Filter to 0 results → Shows "No traces match your filters"
- [ ] First replay step → Shows "First step - no previous state"

### Error Handling
- [ ] Invalid trace ID in URL → Shows 404
- [ ] No filters active → "Clear filters" button hidden

### Performance
- [ ] Filter 50 traces → Instant (<100ms)
- [ ] Open span panel → Smooth animation
- [ ] Playback at 4x speed → No lag

**Pass criteria:** Edge cases handled gracefully ✅

---

## 📸 Screenshot Checklist

**Take these for marketing:**

1. **Trace List with Filters**
   - [ ] Active filters showing
   - [ ] Result count visible
   - [ ] Multiple agent types

2. **Trace Timeline**
   - [ ] Color-coded spans
   - [ ] Error span with red ring
   - [ ] Duration bars visible

3. **Span Detail Panel**
   - [ ] LLM details (model, tokens, cost)
   - [ ] Professional slide-in UI
   - [ ] Copy buttons visible

4. **Session Replay - Playback Controls**
   - [ ] Play button, step buttons, speed controls
   - [ ] Progress bar showing current position
   - [ ] Timeline markers

5. **Session Replay - State View**
   - [ ] Agent State card filled
   - [ ] Execution History showing
   - [ ] Current span highlighted

6. **State Diff Viewer** 🔥
   - [ ] Multiple changed attributes
   - [ ] Color-coded badges (green/red/blue)
   - [ ] Old → new values visible

---

## ✅ Final Verification

### Build Test
```bash
cd apps/web
pnpm build
```

**Expected:** Build succeeds with no errors ✅

### Type Check
```bash
pnpm typecheck
```

**Expected:** TypeScript passes with no errors ✅

### All Routes Accessible
- [ ] http://localhost:3001/ → Redirects to /demo ✅
- [ ] http://localhost:3001/demo → Trace list ✅
- [ ] http://localhost:3001/demo/traces → Trace list ✅
- [ ] http://localhost:3001/demo/traces/[id] → Trace detail ✅
- [ ] http://localhost:3001/login → Login page ✅

---

## 🎊 Success Criteria

**All features working:**
- ✅ Filters & search (4 types)
- ✅ Trace list (50 demo traces)
- ✅ Timeline view (color-coded, clickable)
- ✅ Span detail panel (slide-in, copy buttons)
- ✅ **Session Replay** (play/pause, step, scrub)
- ✅ **State diff viewer** (shows changes)

**Quality bar:**
- ✅ No console errors
- ✅ Smooth animations
- ✅ Responsive design
- ✅ TypeScript passing
- ✅ Build succeeds

**Ready for:**
- ✅ Demo to users
- ✅ Screenshots
- ✅ Production deploy

---

## 🚀 If Everything Passes

**You're ready to ship!** 🎉

Next steps:
1. Take screenshots
2. Record demo video
3. Deploy to Vercel
4. Share with users

---

## 🐛 If Something Breaks

**Common issues:**

1. **Server won't start**
   ```bash
   pkill -f "next dev"  # Kill existing process
   pnpm dev
   ```

2. **Filters not working**
   - Check browser console for errors
   - Verify demo data loaded (check Network tab)

3. **Replay not advancing**
   - Check that trace has multiple spans
   - Try clicking Step Forward manually

4. **Panel won't close**
   - Press ESC
   - Refresh page

**If issues persist:** Check `docs/plans/` for implementation details or ask for help!

---

**Happy testing! 🎉**
