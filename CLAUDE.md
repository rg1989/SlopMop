# SlopMop — Project Rules

@.slop/ai-guardian.md

## Design System

### Font

**All UI text uses `monospace` (system monospace).** No exceptions unless noted below.

The global baseline is locked in `App.css` line 1:

```css
* { font-family: monospace; }
html, body, #root { font-family: monospace; }
```

This means every element inherits monospace by default. **Do not remove or weaken these global rules.** They exist precisely to prevent font regressions.

Exceptions (these classes override the global rule intentionally):
- Terminal output: `'SF Mono', 'Fira Code', 'Courier New', monospace`
- Markdown body prose (`.md-body`): `Georgia, serif`

**Do NOT add `font-family` to individual components or CSS classes** unless you are explicitly setting one of the two exception values above. The global `*` rule handles everything else. Adding redundant per-component `font-family: monospace` declarations is noise — the exception case is the only reason to ever write it explicitly.

### Color Palette

**Single source of truth: `client/theme.css`**. All palette colors are CSS custom properties defined there. **Never write a raw hex value in `App.css` or any component.** Use the variable instead.

To change a color app-wide: edit `theme.css` only.

| CSS Variable | Value | Usage |
|---|---|---|
| `--bg` | `#0d1117` | `html`, `body`, `#root` |
| `--surface` | `#161b22` | Panels, menus, composer, tab bars |
| `--surface-hover` | `#1c2128` | Hover backgrounds |
| `--surface-hi` | `#21262d` | Selected rows, code inline bg |
| `--border` | `#30363d` | All borders and dividers |
| `--border-muted` | `#484f58` | Subtle separators, loading dots |
| `--txt-dim` | `#6e7681` | Placeholder-level labels |
| `--txt-sub` | `#8b949e` | Descriptions, timestamps, muted labels |
| `--txt` | `#c9d1d9` | Default body text |
| `--txt-bright` | `#e6edf3` | Emphasis, headings |
| `--accent` | `#d4845a` | Commands, active states, primary interactive, resize handles |
| `--accent-hover` | `#e89a70` | Hover on accent elements |
| `--accent-dim` | `#c57348` | Pressed/active accent |
| `--accent-rgb` | `212, 132, 90` | For `rgba(var(--accent-rgb), 0.1)` alpha variants |
| `--error` | `#f85149` | Errors, destructive actions |
| `--error-rgb` | `248, 81, 73` | For `rgba(var(--error-rgb), 0.1)` alpha variants |
| `--success` | `#7ee787` | Success states |
| `--warning` | `#e3b341` | Warnings |
| `--info` | `#79c0ff` | Info, links |

Syntax variables (`--syn-red/blue/purple/violet/link/green`): use only in code/token rendering contexts.

**rgba() usage pattern:**
```css
/* correct — works at any opacity without a new variable */
background: rgba(var(--accent-rgb), 0.1);
border-color: rgba(var(--accent-rgb), 0.5);

/* wrong — never hardcode */
background: rgba(212, 132, 90, 0.1);
```

### Font Sizes

| Size | Usage |
|---|---|
| `10px` | Uppercase labels (`text-transform: uppercase; letter-spacing: 0.06em`) |
| `11px` | Badges, small metadata, inline code labels |
| `12px` | Default body / descriptions |
| `13px` | Medium UI text, command names in menus |
| `14px` | File names, slightly prominent text |
| `16px` | Titles, headings within panels |

Line height: `1.5` for all body text.

### Spacing

Base unit is `4px`. Common values: `4`, `6`, `8`, `12`, `16px`.

Standard component padding: `6px 12px` (rows/list items), `8px 12px` (bars/toolbars).

### Border Radius

| Value | Usage |
|---|---|
| `3px` | Inline elements (code spans, tokens) |
| `4px` | Small components (badges, inputs, dropdowns) |
| `6px` | Panels, menus, modal surfaces |
| `50%` | Circular indicators, loading dots |

### Transitions

```css
/* Hover background changes */
transition: background 0.15s;

/* Color + background together */
transition: color 0.12s, background 0.12s;
```

Do not use longer durations for simple hover effects.

### Interactive States

- **Hover**: `#1c2128` (just above surface)
- **Selected / active row**: `#21262d`
- **Focus ring**: `1px solid #d4845a` or `outline: 1px solid #d4845a`

### Borders

Standard: `1px solid #30363d`

Do not use `2px` borders except for resize handles or active tab indicators.

---

## Component Patterns

### Popup / Dropdown Menus

```jsx
// Container
{
  background: '#161b22',
  border: '1px solid #30363d',
  borderRadius: '6px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  zIndex: 9999,
}

// Row
{
  padding: '6px 12px',
  display: 'flex',
  gap: '12px',
  alignItems: 'baseline',
  fontFamily: 'monospace',  // ← always include
}

// Row — selected
{ background: '#21262d' }

// Row — hover
{ background: '#1c2128' }
```

### Labels / Badges

```css
font-size: 10px;
text-transform: uppercase;
letter-spacing: 0.06em;
color: #484f58;
font-family: monospace;
```

### Inline Code

```css
color: #a5d6ff;
background: #21262d;
border-radius: 3px;
padding: 0 2px;
font-family: monospace;
```

---

## Architecture

- **Stack**: Node/Express backend (`server/`), React 18 + Vite frontend (`client/`)
- **Terminal**: node-pty over WebSocket (`server/index.ts`)
- **State**: React hooks only — no Redux, no Zustand
- **Styling**: Plain CSS (`client/App.css`) + inline styles in components. No CSS-in-JS libraries, no Tailwind.
- **Tests**: Vitest + React Testing Library (`tests/`)

### File Conventions

- Components: `client/components/PascalCase.tsx`
- Hooks: `client/hooks/useCamelCase.ts`
- All new CSS goes into `client/App.css` — no per-component CSS files
- Inline styles are acceptable for dynamic values; static styles go in `App.css`

---

## Rules for New Features

1. **Font first**: every new component must explicitly set `fontFamily: 'monospace'` on text elements, or inherit it via a CSS class that sets it. Do not assume inheritance will work through inline-styled containers.

2. **Colors from the palette only**: do not introduce new hex values. Map your needs to the table above.

3. **No new dependencies** without discussion — the bundle is intentionally lean.

4. **No comments in code** unless the why is non-obvious. Do not add docstrings or JSDoc blocks.

5. **No external UI libraries** (no MUI, Chakra, Radix, etc.). Build from the patterns above.
