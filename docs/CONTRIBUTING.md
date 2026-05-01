# Contributing to SlopDock

Thanks for your interest. SlopDock is a personal productivity tool, so the bar for new features is "does this make the core workflow faster or less distracting?" — not "is this generally useful software."

---

## Before you start

- **Bug fixes and small improvements** — open a PR directly, no issue required.
- **New features** — open an issue first to discuss. SlopDock is intentionally lean; new features need a clear reason to exist.
- **New dependencies** — discuss first. The bundle is small on purpose. Most things can be implemented without new packages.

---

## Development setup

```bash
git clone https://github.com/rg1989/SlopDock.git
cd SlopDock
npm install
npm run setup   # verifies Node 20+, Claude CLI, optional voice tools
npm run dev
```

The dev server runs at [http://localhost:5173](http://localhost:5173). The Express backend runs on port 3000 and Vite proxies `/api` and `/ws` to it.

### Running tests

```bash
npm test          # run all tests once
npx vitest        # watch mode
npx vitest run --reporter=verbose   # verbose output
```

Tests live in `tests/`. They use Vitest + React Testing Library. The test suite covers hooks, server utilities, and key UI components.

---

## Code conventions

### TypeScript

- Strict mode is on. No `any` unless unavoidable, and add a comment explaining why.
- Prefer `type` over `interface` for object shapes that aren't extended.
- Server code uses ESM (`import`/`export`). No `require()`.

### React

- Function components only. No class components.
- State: React hooks only — no Redux, no Zustand, no context for non-global state.
- Custom hooks live in `client/hooks/useCamelCase.ts`.
- Components live in `client/components/PascalCase.tsx`.

### CSS

- All new static styles go into `client/App.css`. No per-component `.css` files.
- Inline styles are acceptable for dynamic values (computed at runtime).
- Colors must use CSS custom properties from `client/theme.css`. Never write a raw hex value in component code.
- Font: `monospace` is set globally on `*`. Do not add `font-family: monospace` to individual components.

### Comments

Default to no comments. Only add one when the **why** is non-obvious — a hidden constraint, a subtle invariant, a workaround for a specific bug. If removing the comment wouldn't confuse a future reader, don't write it.

### Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add slash command autocomplete
fix: prevent double PTY spawn on workspace change
refactor: extract useAudioCoordinator from App
docs: update voice setup instructions
```

---

## Architecture guardrails

Before adding new functionality, read [docs/ARCHITECTURE.md](ARCHITECTURE.md). Key boundaries:

- **Session state** — per-session state (PTY, editor tabs, attachments) belongs in `useSession`. Workspace-level state (file tree, roadmap, source control) belongs in `App`. Don't blur this boundary.
- **Audio** — all TTS/STT calls must go through `useAudioCoordinator`. Do not call Piper or Whisper directly from components.
- **File writes** — never write outside the active workspace `cwd`. The server enforces path traversal checks; the client should too.
- **Server** — all API routes go in `server/index.ts`. Keep handlers thin; put business logic in the module files (`file-api.ts`, `gsd.ts`, etc.).

---

## Pull request checklist

- [ ] `npm test` passes
- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] New UI behavior tested manually in the browser
- [ ] No raw hex values introduced in component code
- [ ] No new npm dependencies without discussion
- [ ] Commit messages follow Conventional Commits

---

## Architecture Decision Records

Significant design decisions are documented as ADRs in `docs/adr/`. If your PR makes a non-obvious architectural choice, add an ADR explaining the tradeoffs. See the existing entries for format and scope.

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](../LICENSE).
