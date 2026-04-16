# Foxhound Web App Design System

**Date:** 2026-04-15  
**Status:** Active source of truth for `apps/web`

## Purpose

This file defines the design system and visual direction for the Foxhound web app.

It exists to stop the product from drifting into generic AI SaaS UI.

Foxhound should feel deliberate, premium, technical, and memorable. Future UI work should be judged against this file unless the design system itself is being intentionally revised.

---

## Product context

Foxhound is not a generic admin panel.

It is:

- an agent operations console
- a debugging cockpit for multi-step AI systems
- a control room for observability, reliability, regressions, cost, and behavior
- a product where trust, clarity, and workflow speed matter as much as aesthetics

The UI must express that.

---

## Design thesis

**Foxhound is a precision light-mode command center.**

That means:

- editorial hierarchy at the page level
- industrial precision in controls and dense work surfaces
- premium material treatment without decorative excess
- light mode first, dark mode intentional later
- a visual language that feels designed around operator workflows, not generated from default SaaS patterns

---

## Core visual principles

## 1. Hierarchy before decoration

Every page must make it obvious:

- what matters first
- what needs action next
- what supports investigation
- what is background context

## 2. Shape is part of the system

Not every surface should share the same radius.

We use shape to communicate role.

## 3. Depth must be structural

Different planes should feel different:

- app canvas
- shell chrome
- work panel
- technical inset
- selected state
- overlay

## 4. Density should vary by task

- overview pages can breathe more
- investigative and governance pages should become denser and more instrument-like

## 5. Signature workflows deserve signature treatment

Especially:

- Traces
- Run Diff
- Session Replay
- Budgets / SLAs / Regressions

## 6. Restraint beats decoration

Use atmosphere and premium treatment intentionally.
Do not hide weak hierarchy behind blur, gradients, or generic glass.

---

## Aesthetic direction

### Primary direction

**Precision editorial operator console**

### Supporting traits

- sharp
- layered
- technical
- premium
- calm
- controlled
- trustworthy
- alive without being noisy

### Explicitly avoid

- uniformly bubbly control language
- generic purple AI gradients
- equal-weight card soup
- toy-like playful SaaS UI
- dark-only cyberpunk aesthetics

---

## Typography system

## Approved stack

- **Display / headings:** Outfit
- **Body / UI text:** DM Sans
- **Technical / IDs / state:** JetBrains Mono

## Usage rules

### Outfit

Use for:

- page titles
- major section headings
- key metric emphasis where appropriate

### DM Sans

Use for:

- body text
- controls
- navigation
- tables
- helper and descriptive copy

### JetBrains Mono

Use for:

- trace IDs
- prompt versions
- models
- cost / timing / token readouts when technical framing helps
- JSON / state / attributes / code surfaces

---

## Color strategy

## Base stance

Foxhound remains blue-led.

Blue is the trusted product anchor. Purple is a selective support accent, not the default mood for the entire app.

### Roles

- **Blue:** trusted action, active selection, primary product identity
- **Purple / indigo:** support accent, used carefully
- **Light neutrals:** main environment
- **Darker analytical anchors:** allowed inside light mode for technical compare/replay/state surfaces
- **Amber:** warning / threshold / budget risk
- **Red:** failure / critical risk
- **Green:** controlled success / improved state

---

## Shape system

This is central to the redesign.

## Problem being avoided

Uniform soft rounding everywhere makes products feel generic and AI-generated.

## Shape families

### 1. Frame surfaces

Use for:

- major orientation blocks
- hero containers
- shell-scale framing surfaces

Radius:

- 20px to 24px

### 2. Panel surfaces

Use for:

- cards
- tables
- content modules
- standard work surfaces

Radius:

- 12px to 16px

### 3. Tight panel surfaces

Use for:

- inset records
- technical rows
- comparison cards

Radius:

- 10px to 14px

### 4. Precision controls

Use for:

- buttons
- tabs
- shell triggers
- segmented controls
- filter triggers

Radius:

- 8px to 12px

### 5. Control-tight surfaces

Use for:

- small chips
- micro-badges
- status tags
- compact internal control surfaces

Radius:

- 6px to 10px

## Pills policy

`rounded-full` is restricted.

Allowed for:

- true avatar circles
- very small metadata/status dots
- rare semantically justified pills

Not allowed as the default for:

- shell controls
- nav states
- filter triggers
- generic action surfaces

---

## Depth and plane model

Foxhound uses explicit visual planes.

## Plane 0, App canvas

Bright, premium, slightly atmospheric, not sterile.

## Plane 1, Shell chrome

Sidebar, top bar, command surfaces. Should feel distinct from content panels.

## Plane 2, Main panels

Primary work surfaces. Calm, readable, clearly above the canvas.

## Plane 3, Stronger panels

Used to increase emphasis and create contrast between adjacent modules.

## Plane 4, Technical insets

For JSON, state, diff rows, compare tracks, and other dense inspection surfaces.

## Plane 5, Overlay surfaces

Dialogs, popovers, sheets. Should feel clearly elevated and focused.

---

## Layout and composition rules

## Page composition

Every page should establish:

1. orientation
2. headline signal
3. action path
4. supporting evidence

## Overview pages

Should feel more editorial and more compositional.

## Investigative pages

Should feel more instrument-like and workflow-oriented.

## Governance pages

Should feel stricter, clearer, and more operational.

## Card-grid rule

A grid of equal-weight cards is not the default answer.
Use it only when the content is truly equal in importance.

---

## Component rules

## Sidebar

- active states should feel fitted and exact
- not a stack of pills
- footer/help blocks should feel integrated into shell architecture

## Top bar

- should read as command chrome
- not a row of helper chips
- controls should feel precise and durable

## Buttons

- primary should feel confident, not soft and generic
- outline/secondary/ghost must be meaningfully distinct
- destructive should feel serious, not loud candy red

## Cards and panels

Need clear role differentiation:

- frame
- panel
- strong panel
- inset panel
- action panel
- technical panel

## Filter bars

Should feel like operator workbenches, not soft form rows.

## Tables and lists

Need stronger scanability and selected-state quality.

## Badges and status

Not every label needs a badge. Avoid badge spam.

---

## Signature workflow rules

## Traces

Must feel like a serious investigation surface, not a generic log table.

## Run Diff

Must feel like a comparison cockpit and a hero feature.

## Session Replay

Must feel like a precision playback instrument for state transition analysis.

## Budgets / SLAs / Regressions

Must feel like governance and operating-control surfaces, sharper and more threshold-aware than overview pages.

---

## Motion

Motion should:

- support comprehension
- reinforce focus and state changes
- remain restrained and fast

Avoid bouncy toy motion or generic hover theatrics.

---

## Light mode and dark mode

Foxhound is **light-mode first**.

Light mode must feel complete and world-class on its own.

Dark mode should be designed later as a real system counterpart, not as an afterthought inversion.

---

## Accessibility

Foxhound is an operator tool. Accessibility is part of usability.

Must have:

- visible focus states
- reliable contrast
- keyboard navigability
- clear selected/disabled/hover distinctions
- motion that can be reduced if needed

Dense UI is acceptable.
Unreadable UI is not.

---

## Anti-patterns

Do not ship:

- all-pill UI chrome
- uniform rounding on everything
- generic purple AI gradients
- equal-weight dashboard card soup
- decorative glass used to hide weak hierarchy
- signature features styled like ordinary admin widgets

---

## Highest-leverage files for system work

When changing the design system, start with:

- `apps/web/lib/theme/types.ts`
- `apps/web/lib/theme/presets.ts`
- `apps/web/lib/theme/theme-to-css-vars.ts`
- `apps/web/app/globals.css`
- `apps/web/components/ui/button.tsx`
- `apps/web/components/ui/card.tsx`
- `apps/web/components/system/page.tsx`
- `apps/web/components/system/detail.tsx`
- `apps/web/components/layout/*`

That is the system backbone.

---

## Review questions for any new UI work

Before calling a UI change done, ask:

1. Does this feel more like Foxhound and less like generic SaaS?
2. Is the hierarchy clearer?
3. Is the shape language more intentional?
4. Does the depth model feel stronger?
5. Does the page guide action better?
6. Would this make the product more desirable in a screenshot?

If the answer is not clearly yes, it probably needs another pass.
