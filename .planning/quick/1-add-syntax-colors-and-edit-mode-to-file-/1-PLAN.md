---
phase: quick-1
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - client/components/FilePreview.tsx
  - client/App.css
  - server/index.ts
autonomous: true
requirements: [QUICK-1]

must_haves:
  truths:
    - "Text files show syntax-colored tokens (keywords, strings, comments) based on file extension"
    - "Non-text files (images, binary) are unaffected"
    - "An Edit button appears on text file previews"
    - "Clicking Edit turns the preview into an editable textarea"
    - "A Save button writes changes back to disk via the server"
    - "After save, the preview returns to read-only display mode"
  artifacts:
    - path: "client/components/FilePreview.tsx"
      provides: "Syntax highlighting + edit/save UI"
      exports: ["FilePreview", "FilePreviewData"]
    - path: "server/index.ts"
      provides: "PUT /api/file endpoint for saving edited content"
      contains: "app.put('/api/file'"
  key_links:
    - from: "client/components/FilePreview.tsx"
      to: "/api/file"
      via: "PUT fetch in handleSave"
      pattern: "fetch.*api/file.*PUT"
    - from: "server/index.ts"
      to: "fs.writeFile"
      via: "PUT /api/file handler"
      pattern: "writeFile.*absPath"
---

<objective>
Add syntax highlighting (token-level, by file extension) and an edit/save mode to the file preview panel.

Purpose: Power users need to read and edit files without leaving SlopMop. Syntax colors reduce cognitive load when scanning code.
Output: FilePreview shows colored tokens for text files; an Edit button unlocks a textarea; Save writes changes to disk via a new PUT endpoint.
</objective>

<execution_context>
@/Users/rgv250cc/.claude/get-shit-done/workflows/execute-plan.md
@/Users/rgv250cc/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

<!-- Key interfaces the executor needs. No codebase exploration required. -->
<interfaces>
From client/components/FilePreview.tsx (current):
```typescript
export type FilePreviewData =
  | { type: 'text'; content: string }
  | { type: 'binary'; isImage: true; base64: string; ext: string }
  | { type: 'binary'; isImage: false; ext: string };

interface FilePreviewProps {
  data: FilePreviewData | null;
}

export function FilePreview({ data }: FilePreviewProps): React.ReactElement | null
```

From App.tsx (how FilePreview is used):
```tsx
<FilePreview data={previewData} />
// previewPath available as string | null — the absolute path of the open file
// cwd available as string | null
```

App.tsx passes previewData from:
  fetch(`/api/file?cwd=${encodeURIComponent(cwd)}&path=${encodeURIComponent(relPath)}`)
  .then(r => r.json()).then(setPreviewData)

Save endpoint will need: cwd + relPath + new content body.
App.tsx needs to pass cwd and previewPath down to FilePreview so Save can construct the PUT request.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add PUT /api/file save endpoint to server</name>
  <files>server/index.ts</files>
  <action>
Add a PUT /api/file route immediately after the existing GET /api/file handler (before the WebSocket attach line).

The route must:
- Accept JSON body: { cwd: string, path: string, content: string }
- Use the same path traversal security check as GET: resolve absPath, verify it starts with resolvedCwd + path.sep
- Call fs.writeFile(absPath, content, 'utf-8')
- Return 200 { ok: true } on success
- Return 400 if cwd/path/content missing, 403 on traversal, 500 on write error

Note: express.json() middleware is already active (added in a prior fix). Import writeFile from 'node:fs/promises' — it is already imported as readFile at the top of the file; add writeFile to the same import.
  </action>
  <verify>
    <automated>curl -s -X PUT http://localhost:3000/api/file -H 'Content-Type: application/json' -d '{"cwd":"/tmp","path":"ct-test.txt","content":"hello"}' | grep -q '"ok":true' && echo PASS || echo FAIL</automated>
  </verify>
  <done>PUT /api/file returns { ok: true } and file is written to disk. 403 returned for path traversal attempts.</done>
</task>

<task type="auto">
  <name>Task 2: Add syntax highlighting + edit/save to FilePreview</name>
  <files>client/components/FilePreview.tsx, client/App.css</files>
  <action>
**FilePreview.tsx — full rewrite with three additions:**

1. **Props update** — add optional `filePath` and `cwd` props so Save can construct the PUT URL:
   ```typescript
   interface FilePreviewProps {
     data: FilePreviewData | null;
     filePath?: string | null;   // absolute path of the open file
     cwd?: string | null;        // working directory
   }
   ```
   Update the export signature to accept these props.

   Also update App.tsx to pass them:
   ```tsx
   <FilePreview data={previewData} filePath={previewPath} cwd={cwd} />
   ```

2. **Minimal inline tokenizer** — implement a `tokenize(code: string, ext: string): Token[]` function where `Token = { type: string; text: string }`.

   Extension groups (map ext → language):
   - `.ts .tsx .js .jsx .mjs` → 'js'
   - `.py` → 'python'
   - `.json` → 'json'
   - `.css .scss` → 'css'
   - `.md .markdown` → 'markdown'
   - `.html .htm .xml .svg` → 'html'
   - `.sh .bash .zsh` → 'shell'
   - everything else → 'plain'

   Tokenizer uses a single-pass regex that tries each pattern in order. Return array of `{ type, text }` spans. For unknown/plain, return a single `{ type: 'plain', text: code }` token (no coloring overhead).

   Token types and regex patterns (apply in this order to avoid mismatches):
   - For 'js': comment (`//.*|/\*[\s\S]*?\*/`), string (`"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|` + backtick template), keyword (`\b(const|let|var|function|return|if|else|for|while|class|import|export|from|default|async|await|typeof|new|this|try|catch|throw|null|undefined|true|false)\b`), number (`\b\d+\.?\d*\b`), plain (fallback)
   - For 'python': comment (`#.*`), string (`"""[\s\S]*?"""|'''[\s\S]*?'''|"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'`), keyword (`\b(def|class|return|if|elif|else|for|while|import|from|as|with|try|except|finally|raise|pass|True|False|None|and|or|not|in|is|lambda|yield|self)\b`), number (`\b\d+\.?\d*\b`), plain
   - For 'json': string (`"[^"\\]*(?:\\.[^"\\]*)*"`), number (`-?\b\d+\.?\d*(?:[eE][+-]?\d+)?\b`), keyword (`\b(true|false|null)\b`), plain
   - For 'css': comment (`/\*[\s\S]*?\*/`), string (`"[^"]*"|'[^']*'`), selector (`.[-\w]+|#[-\w]+|[@:][-\w]+`), property (`[-\w]+(?=\s*:)`), value (`:.*?(?=;|}|$)`), plain
   - For 'html': comment (`<!--[\s\S]*?-->`), tag (`<[/!]?[-\w]+`), attr (`[-\w]+=`), string (`"[^"]*"|'[^']*'`), close (`>`), plain
   - For 'shell': comment (`#.*`), string (`"[^"\\]*(?:\\.[^"\\]*)*"|'[^']*'`), keyword (`\b(if|then|else|fi|for|do|done|while|case|esac|function|return|export|local|echo|cd|ls|grep|find|mkdir|rm|cp|mv)\b`), plain
   - For 'markdown': heading (`^#{1,6} .*`), bold (`\*\*[^*]+\*\*|__[^_]+__`), code (`` `[^`]+` ``), link (`\[[^\]]*\]\([^)]*\)`), plain

   Render tokens as `<span className={`tok-${token.type}`}>{token.text}</span>` inside the `<pre>`.

3. **Edit/save state** — inside FilePreview:
   ```typescript
   const [editing, setEditing] = useState(false);
   const [draft, setDraft] = useState('');
   const [saving, setSaving] = useState(false);
   ```
   Reset editing to false when `data` prop changes (use useEffect watching `data`).

   For text files, render:
   - A toolbar row above the content with the Edit/Save/Cancel buttons (`.fp-toolbar` div)
   - When `editing === false`: show highlighted `<pre>` + an `Edit` button in toolbar
   - When `editing === true`: show `<textarea className="fp-edit-area">` pre-filled with `draft`, onChange updates draft; toolbar shows `Save` + `Cancel` buttons

   handleEdit: `setDraft(data.content); setEditing(true)`

   handleSave:
   ```typescript
   async function handleSave() {
     if (!filePath || !cwd) return;
     const relPath = filePath.startsWith(cwd) ? filePath.slice(cwd.length + 1) : filePath;
     setSaving(true);
     try {
       await fetch('/api/file', {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ cwd, path: relPath, content: draft }),
       });
       setEditing(false);
     } finally {
       setSaving(false);
     }
   }
   ```

**App.css — add styles for new elements:**
```css
/* FilePreview toolbar + edit */
.fp-toolbar {
  display: flex;
  gap: 6px;
  padding: 4px 8px;
  border-bottom: 1px solid #30363d;
  flex-shrink: 0;
  background: #161b22;
}
.fp-btn {
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid #30363d;
  border-radius: 4px;
  background: transparent;
  color: #8b949e;
  cursor: pointer;
}
.fp-btn:hover { color: #c9d1d9; border-color: #8b949e; }
.fp-btn.primary { color: #58a6ff; border-color: #58a6ff; }
.fp-btn.primary:hover { background: #1f3a5f; }
.fp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.fp-edit-area {
  flex: 1;
  font-family: monospace;
  font-size: 12px;
  color: #c9d1d9;
  background: #0d1117;
  border: none;
  outline: none;
  resize: none;
  padding: 12px;
  line-height: 1.5;
  white-space: pre;
  overflow: auto;
}

/* Syntax token colors — GitHub Dark palette */
.tok-comment { color: #8b949e; font-style: italic; }
.tok-string  { color: #a5d6ff; }
.tok-keyword { color: #ff7b72; font-weight: 600; }
.tok-number  { color: #79c0ff; }
.tok-plain   { color: #c9d1d9; }
/* CSS-specific */
.tok-selector { color: #7ee787; }
.tok-property { color: #79c0ff; }
.tok-value    { color: #a5d6ff; }
/* HTML-specific */
.tok-tag   { color: #7ee787; }
.tok-attr  { color: #79c0ff; }
.tok-close { color: #7ee787; }
/* Markdown */
.tok-heading { color: #79c0ff; font-weight: 700; }
.tok-bold    { color: #e3b341; font-weight: 700; }
.tok-code    { color: #a5d6ff; background: #21262d; border-radius: 3px; }
.tok-link    { color: #58a6ff; text-decoration: underline; }
/* Shell */
/* .tok-keyword already covered above */
```

Also update `.file-preview` to use flexbox so toolbar + content stack properly:
```css
.file-preview { display: flex; flex-direction: column; padding: 0; overflow: hidden; height: 100%; }
.fp-text { font-family: monospace; font-size: 12px; color: #c9d1d9; white-space: pre; line-height: 1.5; padding: 12px; flex: 1; overflow: auto; }
```
(Remove the old `padding: 12px` from `.file-preview` since padding moves into `.fp-text`.)
  </action>
  <verify>
    <automated>cd /Users/rgv250cc/Documents/Projects/SlopMop && npm run build 2>&1 | tail -5</automated>
  </verify>
  <done>
- TypeScript build passes (no errors)
- FilePreview renders a highlighted pre for text files
- Edit button visible; clicking it switches to textarea
- Save button calls PUT /api/file and returns to read-only
- Image and binary previews unchanged
  </done>
</task>

</tasks>

<verification>
1. `npm run build` exits 0
2. Open app, select a .ts or .py file — verify colored tokens appear (keywords in red/orange, strings in blue, comments in gray)
3. Click Edit — textarea appears with file content
4. Modify text, click Save — file written to disk (confirm with `cat` in terminal)
5. Select an image — no toolbar, no edit button
</verification>

<success_criteria>
- Build passes with zero TypeScript errors
- Text file preview shows token-colored syntax (at minimum: keywords, strings, comments)
- Edit unlocks textarea, Save writes to disk, view returns to read-only
- Non-text previews unaffected
</success_criteria>

<output>
After completion, create `.planning/quick/1-add-syntax-colors-and-edit-mode-to-file-/1-SUMMARY.md`
</output>
