# Live Canvas

**Live Canvas** is a second UI surface inside SlopMop: a **full HTML document** stored in the active project and rendered in the **sidebar** inside a **sandboxed iframe**. The CLI agent (or any tool that can write files or call HTTP) can update that document so you get dashboards, tables, diagrams, or client-side charts without pasting huge blobs into the terminal transcript.

---

## What it is

| Aspect | Detail |
|--------|--------|
| **Storage path** | `<projectRoot>/.slop/live-canvas.html` |
| **Scope** | One canvas **per opened workspace folder** (`cwd` in the UI) |
| **UI entry** | Sidebar tab **“Live Canvas”** (`client/App.tsx` + `LiveCanvasPanel.tsx`) |
| **Refresh** | Panel **polls `GET /api/live-canvas` about every 2 seconds**; iframe **`key`** tied to `mtimeMs` forces a reload when the file changes |
| **Format** | A **complete HTML document** (`<!DOCTYPE html>`, `<html>`, …) |

---

## Security model

The canvas HTML is **user- and agent-generated**. It must not get direct access to SlopMop’s JavaScript context or cookies.

The iframe is created with:

```text
sandbox="allow-scripts allow-forms"
```

**Included**

- Client-side scripts (charts, DOM manipulation).
- Forms (local-only UX patterns).

**Not included** (typical browser defaults when `allow-same-origin` is omitted)

- Same origin as the parent app — the canvas document cannot read SlopMop’s `localStorage` or attach listeners to the parent window.

**Operational caution**

- Embedded **third-party scripts** (CDNs) run inside the sandbox with network access as permitted by the browser; treat canvas content like running untrusted code **isolated from the parent**, not like static markdown.

---

## HTTP API

Implemented in `server/live-canvas.ts` and mounted in `server/index.ts`.

### `GET /api/live-canvas?cwd=<absolute path>`

Returns JSON:

| Field | Type | Meaning |
|-------|------|---------|
| `html` | `string \| null` | Full file contents when present and under size limit |
| `mtimeMs` | `number \| null` | Last modification time when file exists |
| `relPath` | `string` | Always `.slop/live-canvas.html` for display |
| `oversize` | `boolean` (optional) | `true` if file on disk exceeds the byte cap — `html` is null |

Errors: **`400`** without `cwd`; **`500`** on unexpected read failures.

### `PUT /api/live-canvas`

Body (JSON):

```json
{
  "cwd": "/absolute/path/to/project",
  "html": "<!DOCTYPE html><html>...</html>"
}
```

Response: **`200`** `{ "ok": true, "relPath": ".slop/live-canvas.html" }`.

Errors:

- **`400`** — missing `cwd` or `html` not a string
- **`413`** — payload larger than **LIVE_CANVAS_MAX_BYTES** (~2 MB UTF-8)
- **`500`** — filesystem errors

The handler creates **`.slop/`** if needed and writes via **atomic rename** (temp file then replace).

---

## Size limits

| Limit | Value | Source |
|-------|-------|--------|
| Max bytes | **2_000_000** | `LIVE_CANVAS_MAX_BYTES` in `server/live-canvas.ts` |

Oversize **writes** are rejected. Oversize **reads** return `oversize: true` so the UI can show an error instead of loading megabytes into memory.

---

## Path resolution

**`resolveLiveCanvasAbsPath(projectRoot)`** resolves `projectRoot` with `path.resolve`, then joins `.slop/live-canvas.html`, and verifies the result stays **under** the resolved project directory (prefix check with trailing separator). This blocks path escape via manipulated `cwd` on the server when combined with consistent query usage.

---

## Updating the canvas (workflows)

### 1. Agent writes the file (recommended)

Instruct the CLI agent to create or overwrite:

```text
<your project>/.slop/live-canvas.html
```

Use a valid HTML5 document. After save, the sidebar picks up changes within a couple of seconds (or use **Refresh**).

### 2. `PUT /api/live-canvas`

Useful for scripts, CI, or automation running alongside SlopMop:

```bash
curl -sS -X PUT "http://localhost:3000/api/live-canvas" \
  -H "Content-Type: application/json" \
  -d "{\"cwd\":\"/abs/path/project\",\"html\":\"<!DOCTYPE html><html><body><p>Hi</p></body></html>\"}"
```

Adjust host/port to match your server.

### 3. Editor

Open `.slop/live-canvas.html` in SlopMop’s file editor like any other file; saves update `mtime` and the panel refreshes on poll.

---

## UI behavior (`LiveCanvasPanel.tsx`)

- Shows **toolbar** with title and **Refresh** (immediate `GET`).
- **Hint** text documents path and `PUT` endpoint.
- **Empty state** when no file or empty content: explains how to create the first canvas.
- **Oversize state** when `oversize: true`.
- **iframe** uses `srcDoc` so no separate origin URL is required; remount when `mtimeMs` changes.

Styling lives in `client/App.css` under the **Live Canvas** section (panel, toolbar, frame, empty states).

---

## Visualization tips

- **Self-contained** HTML (inline CSS + JS) works offline and avoids CDN flakiness.
- **SVG** and **Canvas** elements are fine.
- **Chart libraries** from a CDN often work; ensure HTTPS URLs and be mindful of CSP defaults (browser-dependent).
- Keep assets small — hard limit **2 MB** total document.

---

## Prompts for agents (copy into skills or project docs)

When the user asks for a **visual summary**, **dashboard**, **structured report**, or **chart** that is easier to read as a page than as chat:

1. Emit a **complete, valid HTML5** document.
2. Save it to **`.slop/live-canvas.html`** (create `.slop` if needed).
3. Tell the user to open the **Live Canvas** tab, or wait ~2 seconds for auto-refresh.

Optional: mention they can hit **Refresh** if they saved from outside the poll window.

---

## Source map

| Piece | File |
|-------|------|
| Read/write + limits | `server/live-canvas.ts` |
| Routes | `server/index.ts` (`/api/live-canvas`) |
| Sidebar + polling UI | `client/components/LiveCanvasPanel.tsx` |
| Tab registration | `client/App.tsx` |
| Styles | `client/App.css` |
| Unit tests | `tests/live-canvas.test.ts` |

---

## Relationship to the rest of SlopMop

- Live Canvas is **not** a replacement for the **terminal**, **file editor**, or **markdown / mermaid** previews elsewhere — it is specifically for **agent-controlled HTML layout** that updates as work progresses.
- The **browser workspace `cwd`** selects **which** `.slop/live-canvas.html` is loaded. Switching projects switches canvas content automatically.
