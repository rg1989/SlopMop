# AI Guardian — Project Alignment Rules

## Step 0 — Check if active

Before applying any rule in this file, read `.slop/config.json`.
If `aiGuardian.enabled` is `false`, skip everything below and work normally.

---

## What this is

SlopMop projects are structured around a living roadmap (`.planning/`), GSD phases, and a second brain
(`second-brain/memory/`). This file gives Claude standing instructions to keep all three in sync and
to surface alignment problems before they compound.

---

## Rule 1 — Roadmap check before significant work

Before starting any task that involves writing new code, creating new files, or making architectural
decisions, check whether it maps to a current phase in `.planning/ROADMAP.md` or the active phase plan.

**Significant work** means:
- Implementing a new feature or component
- Refactoring a module or changing its contract
- Adding a dependency
- Creating or deleting top-level directories

**What to do if the work is unplanned:**
> "This work doesn't appear in the current roadmap. Before I proceed I want to flag this — we can:
> (a) add it as a task to the current phase, (b) insert it as a new phase, or (c) confirm it's small
> enough to treat as an inline fix and continue. Which do you prefer?"

Wait for confirmation before proceeding. Do not start the work while raising the flag.

---

## Rule 2 — Phase skipping

If asked to work on a phase that is not the current active phase while an earlier phase is still open
(has unfinished tasks or no VERIFICATION.md), surface this clearly:

> "Phase N is still open — VERIFICATION.md is missing / tasks X and Y are incomplete. Should we
> finish phase N first, or is there a reason to jump ahead? I want to make sure we don't create
> orphaned work."

Do not refuse to help. If the user confirms they want to proceed out of order, note it and continue.

---

## Rule 3 — Docs without progress update

If a session edits documentation, specs, or planning files (anything under `.planning/`, `README.md`,
`CLAUDE.md`) without a corresponding update to phase state or task status, end the session with:

> "We updated docs but didn't touch the phase state. Want me to update the task status in the plan now?"

Offer to do the update — don't force it.

---

## Rule 4 — Commit not mapped to a planned task

When preparing or reviewing a commit, check whether the change set maps to a roadmap task. If it
doesn't (new behaviour, new files, non-trivial refactor), warn before committing:

> "This commit introduces [X] which isn't tracked in the roadmap. Options:
> (a) create a task for it retroactively — I'll draft it, you approve
> (b) add it to the current phase plan
> (c) commit as-is if it's truly a minor fix
> Which do you prefer?"

If the user picks (a) or (b), draft the task entry and show it before writing anything.
Write only after approval (propose+confirm pattern).

---

## Rule 5 — Second brain integration

### 5a — Surface known pitfalls before diving in

At the start of any session, or when beginning a new task, scan the second brain pitfalls file
(`second-brain/memory/pitfalls.md`) for entries that match the current work area. If a relevant
pitfall exists, lead with it before writing any code:

> "Before we start — the second brain has a note on this: [pitfall summary]. Keep that in mind.
> Should I factor this into the approach?"

### 5b — Propose knowledge capture after resolving novel problems

When a session resolves a non-trivial problem (a bug that required real investigation, a non-obvious
workaround, a surprising API behaviour), end with a proposal — do not auto-write:

> "This looks like something worth capturing. Proposed pitfalls.md entry:
>
> **[Short title]**: [What the problem was, what fixed it, what to watch for next time]
>
> Add this to the second brain? (yes / edit / skip)"

Only write to `second-brain/memory/pitfalls.md` after the user says yes or edits and approves.

### 5c — Surface known fixes for recurring errors

If an error message or failure mode matches something already in `pitfalls.md`, skip the investigation
preamble and go straight to the known fix:

> "Seen this before — [pitfall title] has a fix for this: [fix summary]. Applying it now."

If the known fix resolves it, propose a short update to the pitfalls entry noting the recurrence
(propose+confirm).

### 5d — Log significant decisions

After a session where an architectural or workflow decision was made (a pattern chosen, a dependency
approved, a phase structure changed), offer to log it:

> "We made a non-obvious decision today: [decision]. Worth adding to decisions.md?
> Proposed entry: [draft]. (yes / edit / skip)"

---

## Tone

These rules are guardrails, not blockers. Always frame them as offers and options, never as refusals.
The user is in control — these rules exist to keep them informed before drift becomes debt.
