---
phase: quick-1
plan: 1
subsystem: file-preview
tags: [syntax-highlighting, tokenizer, edit-mode, file-save]
dependency_graph:
  requires: []
  provides: [syntax-colored-file-preview, edit-save-ui, PUT-api-file]
  affects: [client/components/FilePreview.tsx, client/App.tsx, client/App.css, server/index.ts]
tech_stack:
  added: []
  patterns: [inline-regex-tokenizer, sticky-lastIndex-scan, narrowing-via-const-capture]
key_files:
  created: []
  modified:
    - client/components/FilePreview.tsx
    - client/App.tsx
    - client/App.css
    - server/index.ts
decisions:
  - Inline single-pass regex tokenizer using sticky lastIndex avoids external library dependency while covering 7 languages
  - Captured `const content = data.content` before inner functions to preserve TypeScript narrowing inside nested closures
  - Vite build used as final verify since root tsconfig includes pre-existing test errors unrelated to this change
metrics:
  duration: "~8 min"
  completed_date: "2026-04-30"
  tasks_completed: 2
  files_modified: 4
---

# Quick 1 Plan 1: Syntax Highlighting + Edit Mode for File Preview Summary

**One-liner:** Inline regex tokenizer for 7 languages with GitHub Dark token colors, plus an Edit/Save mode that writes changes back to disk via a new PUT /api/file endpoint.

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Add PUT /api/file save endpoint | b1affc9 | server/index.ts |
| 2 | Syntax highlighting + edit/save in FilePreview | a5c4deb | client/components/FilePreview.tsx, client/App.tsx, client/App.css |

## What Was Built

**Server (Task 1):**
- Added `writeFile` import alongside `readFile` in `server/index.ts`
- PUT `/api/file` route with JSON body `{ cwd, path, content }`, same traversal guard as GET
- Returns `{ ok: true }` on success; 400/403/500 for error cases

**Client (Task 2):**
- `tokenize(code, ext)` function using sticky-lastIndex single-pass regex across 7 language rule tables (js/ts, python, json, css, html, shell, markdown)
- Token spans rendered as `<span className="tok-{type}">` inside `<pre className="fp-text">`
- Edit/save state: `editing`, `draft`, `saving` controlled via React hooks; reset on `data` prop change
- `.fp-toolbar` div with Edit (read mode) or Save + Cancel (edit mode) buttons
- `FilePreview` props extended with `filePath?: string | null` and `cwd?: string | null`
- `App.tsx` updated to pass `filePath={previewPath} cwd={cwd}` to `FilePreview`
- CSS: `.file-preview` converted to `flex-direction: column`, `.fp-text` gets `flex: 1; overflow: auto`, new `.fp-toolbar`, `.fp-btn`, `.fp-edit-area`, and `.tok-*` color classes added

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript narrowing lost inside nested function closure**
- **Found during:** Task 2 build
- **Issue:** `data.content` inside `handleEdit()` caused TS2339 — TypeScript can't narrow a discriminated union through an outer `if` into an inner function
- **Fix:** Captured `const content = data.content` at the top of the `if (data.type === 'text')` block, used `content` inside `handleEdit`
- **Files modified:** `client/components/FilePreview.tsx`
- **Commit:** a5c4deb

## Verification

- PUT /api/file: `curl` test confirmed `{"ok":true}` and traversal attack returns error response
- Client build: `vite build` exits 0, 47 modules transformed, no errors
- Pre-existing test file errors in `tests/pty-manager.test.ts` and `tests/usePty.test.ts` are out of scope (unrelated to this change)

## Self-Check: PASSED

- [x] server/index.ts modified (writeFile import + PUT route)
- [x] client/components/FilePreview.tsx created (tokenizer + edit/save)
- [x] client/App.tsx updated (filePath + cwd props passed)
- [x] client/App.css updated (fp-* and tok-* styles)
- [x] Commits b1affc9 and a5c4deb exist in git log
- [x] Vite build exits 0
