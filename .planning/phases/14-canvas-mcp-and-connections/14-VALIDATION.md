---
phase: 14
slug: canvas-mcp-and-connections
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-03
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x + React Testing Library 16 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/canvas-tab-store.test.ts tests/canvas-mcp-tools.test.ts tests/MultiTabCanvasPanel.test.tsx tests/McpConnectionsModal.test.tsx tests/App.canvasPanel.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/canvas-tab-store.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 0 | MCP-01..05, CANVASTAB-01..04, MCPUI-01..02 stubs | unit | `npx vitest run tests/canvas-tab-store.test.ts tests/canvas-mcp-tools.test.ts tests/MultiTabCanvasPanel.test.tsx tests/McpConnectionsModal.test.tsx tests/App.canvasPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | MCP-01 | unit | `npx vitest run tests/canvas-tab-store.test.ts` | ❌ W0 | ⬜ pending |
| 14-01-03 | 01 | 1 | MCP-02 | unit | `npx vitest run tests/canvas-tab-store.test.ts` | ❌ W0 | ⬜ pending |
| 14-01-04 | 01 | 1 | MCP-03 | unit | `npx vitest run tests/canvas-tab-store.test.ts` | ❌ W0 | ⬜ pending |
| 14-01-05 | 01 | 1 | MCP-04 | unit | `npx vitest run tests/canvas-tab-store.test.ts` | ❌ W0 | ⬜ pending |
| 14-01-06 | 01 | 1 | CANVASTAB-04 | unit | `npx vitest run tests/canvas-tab-store.test.ts` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 1 | MCP-05 | unit | `npx vitest run tests/canvas-mcp-tools.test.ts` | ❌ W0 | ⬜ pending |
| 14-02-02 | 02 | 1 | CANVASTAB-01 | component | `npx vitest run tests/MultiTabCanvasPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 14-02-03 | 02 | 1 | CANVASTAB-02 | component | `npx vitest run tests/MultiTabCanvasPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 14-02-04 | 02 | 1 | CANVASTAB-03 | component | `npx vitest run tests/MultiTabCanvasPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 14-03-01 | 03 | 1 | MCPUI-01 | component | `npx vitest run tests/McpConnectionsModal.test.tsx` | ❌ W0 | ⬜ pending |
| 14-03-02 | 03 | 1 | MCPUI-02 | component | `npx vitest run tests/McpConnectionsModal.test.tsx` | ❌ W0 | ⬜ pending |
| 14-04-02 | 04 | 2 | CANVASTAB-01..03 App wiring | integration | `npx vitest run tests/App.canvasPanel.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/canvas-tab-store.test.ts` — stubs for MCP-01, MCP-02, MCP-03, MCP-04, CANVASTAB-04
- [ ] `tests/canvas-mcp-tools.test.ts` — stubs for MCP-05
- [ ] `tests/MultiTabCanvasPanel.test.tsx` — stubs for CANVASTAB-01, CANVASTAB-02, CANVASTAB-03
- [ ] `tests/McpConnectionsModal.test.tsx` — stubs for MCPUI-01, MCPUI-02
- [ ] `tests/App.canvasPanel.test.tsx` — App.tsx canvas SSE state and MCP modal open wiring

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Claude CLI spawns MCP server and calls tools | MCP-05 | Requires real Claude CLI process — not testable in jsdom | Start SlopMop, open Claude CLI session, ask it to `canvas_open("test")`, verify tab appears |
| SSE push delivers tab state to browser instantly | CANVASTAB-01 | Real HTTP server + SSE stream not testable in jsdom without msw | Create tab via API, verify browser updates without polling delay |
| HTML theme wrapping visual correctness | MCP-02 | CSS variable resolution requires real browser | Submit body-only HTML via canvas_update, inspect rendered tab — verify dark bg, monospace, accent color |
| Full `<!DOCTYPE html>` escape hatch | MCP-02 | Visual-only check | Submit HTML starting with `<!DOCTYPE html>`, verify no theme wrapper applied |
| `~/.claude/settings.json` auto-register | MCPUI-02 | File system side-effect in home dir | Click auto-register button, verify `~/.claude/settings.json` updated with `slopmop-canvas` entry |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
