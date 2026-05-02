# SlopMop

SlopMop is a local browser-based workspace for AI-assisted development. It wraps a configurable agent CLI in a unified UI alongside file browsing, git integration, voice I/O, and planning tools — eliminating the need to hop between apps to stay on top of work.

## Language

### Core concepts

**Workspace**:
A working directory the user connects to. All panels, sessions, and file state are scoped to the active workspace.
_Avoid_: project, folder, cwd

**Session**:
A single running agent process together with its associated editor tabs and attachments. The unit of interaction with an agent. SlopMop currently shows one session per workspace; multiple sessions per workspace are a planned extension.
_Avoid_: terminal, instance, connection

**Agent**:
The CLI tool spawned inside a session's PTY (e.g. `claude`, `aider`, `hermes`). SlopMop is agent-agnostic — nothing in the UI assumes a specific agent.
_Avoid_: model, AI, Claude (as a generic term)

**AgentConfig**:
The configured command, arguments, and display label used to spawn an agent. Stored in user Settings. One AgentConfig is active per workspace at a time.
_Avoid_: agent settings, CLI config, launch config

**PTY**:
The pseudo-terminal process backing a session. The PTY is a server-side concept; the client interacts with it through a WebSocket. Distinct from the terminal UI component that renders its output.
_Avoid_: terminal (when referring to the process), shell

**Panel**:
A sidebar tab view. Current panels: Explorer, Source Control, GSD Roadmap, Second Brain. Panels are app-scoped — they are shared context, not per-session.
_Avoid_: tab (overloaded), sidebar item, view

**Attachment**:
A file path staged for inclusion in the next Composer message. Attachments are session-scoped and cleared after each send.
_Avoid_: file selection, context file, included file

**Composer**:
The input area where the user types messages sent to the agent's PTY. Sends raw text with optional attachments prepended.
_Avoid_: input, chat box, prompt bar

### Planning

**Roadmap**:
The `.planning/ROADMAP.md` file describing milestones, phases, and plans for the workspace's project. Rendered in the GSD Roadmap panel.
_Avoid_: plan, project plan

**Phase**:
A discrete unit of work in a Roadmap, containing one or more Plans.
_Avoid_: step, stage, task (overloaded)

**Plan**:
A single implementation task within a Phase, represented as a markdown file in `.planning/phases/`.
_Avoid_: subtask, ticket

**Quick task**:
A standalone short-form task tracked in `.planning/STATE.md` outside of the phase/plan structure.
_Avoid_: quick, ad-hoc task

### Audio

**AudioCoordinator**:
The module that owns both TTS and voice input and enforces mutual exclusion between them. App-scoped: audio is shared across all sessions.
_Avoid_: audio manager, voice controller

**TTS** (Text-to-Speech):
The subsystem that reads agent output aloud via local Piper. Operates sentence-by-sentence on streaming PTY data.
_Avoid_: voice output, speech, Piper (as a generic term)

**STT** (Speech-to-Text):
The subsystem that transcribes microphone input via local Whisper and submits the result to the Composer.
_Avoid_: voice input, mic, Whisper (as a generic term)

## Relationships

- A **Workspace** hosts one active **Session** (multiple sessions planned)
- A **Session** has exactly one **PTY** and one **AgentConfig**
- A **Session** owns a set of **Editor tabs** and a list of **Attachments**
- An **AgentConfig** is stored in **Settings** and determines which **Agent** is spawned
- **Attachments** are scoped to a **Session** and cleared after each **Composer** send
- **Panels** are app-scoped and shared across all sessions in a workspace
- The **AudioCoordinator** is app-scoped; it pipes PTY data from the active session to **TTS**
- A **Roadmap** belongs to a **Workspace** (read from `.planning/` in the workspace directory)

## Example dialogue

> **Dev:** "When the user switches workspaces, do we keep the session running?"
> **Domain expert:** "No — changing the workspace tears down the current session and starts a new one. The session is always tied to the workspace."

> **Dev:** "If someone wants to use Aider instead of Claude, what changes?"
> **Domain expert:** "Only the AgentConfig. Everything else — panels, attachments, voice, tabs — is agent-agnostic."

> **Dev:** "Who clears attachments after a send?"
> **Domain expert:** "The session. Attachments are session state. The Composer calls clearAttachments on the session after send."

## Flagged ambiguities

- **"terminal"** is used for both the xterm.js UI component (`<Terminal>`) and the underlying PTY process. In code, prefer `TerminalComponent` for the UI and `PTY`/`ptyProcess` for the process. In speech, qualify: "terminal UI" vs "PTY process."
- **"agent"** can mean the CLI tool (correct in SlopMop) or the underlying AI model (avoid — models are an implementation detail of the agent CLI, not a SlopMop concept).
- **"tab"** is overloaded: sidebar tabs (Panels) vs editor tabs (part of Session state). Use **Panel** for the former and **editor tab** for the latter.
