# Managing Copilot Chat Context Window & Session Continuity

## Problem

In long Copilot Chat sessions, the context window (chat history + open files + tool
outputs + workspace context) fills up. Once it gets close to the model's limit, chat
becomes slow and can appear to hang/stop responding. The only way out is usually to
force-start a new session — which loses all prior context, decisions, and progress.

## Why it happens

Every turn re-sends/re-processes accumulated context:
- Full chat history for the session.
- Contents of files opened, read, or edited during the session.
- Terminal output, search results, and other tool results pulled into context.
- Implicit context VS Code attaches automatically (e.g. open editor tabs, `#codebase`
  references) if not scoped down.

There is no clean failure when the limit is approached — performance degrades first,
then the session effectively stalls.

## Prevention

1. **Start new chats proactively.** Don't wait for lag/hang. Once a discrete unit of
   work is done (a feature, a doc, an artifact), start a fresh chat instead of
   continuing indefinitely in one.
2. **Externalize state instead of relying on chat memory.** Keep a living status doc
   (or use the assistant's repo memory — see below) so progress isn't only inside the
   chat transcript.
3. **Don't paste large content into chat.** Let the assistant read files/logs directly
   with its own tools instead of pasting full file contents or long terminal output
   into the conversation.
4. **Trim implicit context in VS Code.**
   - Check `chat.implicitContext.enabled` and disable if not needed.
   - Avoid keeping many unrelated tabs open — Copilot can auto-attach open editors.
   - Be specific with file references instead of broad `#codebase` searches.
5. **Use a large-context model for long sessions** (e.g. Claude Sonnet 4.5) via the
   model picker, reserved for work you know will run long.
6. **Delegate heavy exploration to subagents.** Large read-only investigation (many
   searches/file reads) bloats the *main* conversation. Ask for a subagent to do the
   digging — only its summary comes back to the main thread.

## Recovery when a session is already degraded

1. Open a **new chat** as soon as lag is noticed — don't push until it fully freezes.
2. Before switching, ask the assistant to **write a summary of progress, open
   decisions, and next steps** into a durable location (see below).
3. In the new chat, point the assistant at that summary/memory instead of
   re-explaining the project from scratch.
4. If VS Code chat is fully unresponsive: reload the window
   (`Developer: Reload Window`), check the Copilot Chat output log for errors, and
   confirm the Copilot extension is up to date — some freezes are an extension-side
   issue, not just context size.

## What this repo uses to make recovery cheap

- **Repo memory (`/memories/repo/project-state.md`)** — assistant-maintained notes on
  project stage, key docs, locked architecture decisions, and open items. A new
  session can read this file first instead of the user re-explaining context.
- **Session memory (`/memories/session/`)** — scratch notes for an in-progress task,
  cleared once the conversation ends. Ask the assistant to "save session progress"
  before closing a session that isn't finished.
- **Durable Markdown plans in `docs/`** — implementation plans and major work items
  are tracked in versioned Markdown files (see `docs/implementation-plan/`), not only
  in chat, per project convention.

### Recommended habit

When starting a new chat after a forced restart, say:
> "resume — check repo memory"

The assistant should read `/memories/repo/project-state.md` (and any
`/memories/session/` notes) before doing anything else, and update these files as the
project state changes.

## Using repo memory across multiple parallel sessions

Repo memory is **workspace-scoped, not session-scoped** — it lives on disk under
`workspaceStorage/<workspace-id>/GitHub.copilot-chat/memory-tool/memories/repo/`, keyed
to this workspace folder. Every chat session opened against this same workspace
(same VS Code window or a different one, run in parallel or sequentially) reads and
writes the **same physical file**. This means:

- You can tell any session, in any window: *"update repo memory
  (`/memories/repo/project-state.md`) with what you just did, following
  `.github/copilot-chat-context-management.md`"* — the update is visible to every
  other session the next time it (re-)reads the file. It works.
- Updates are **not live-pushed** into a session that already has the file loaded in
  its own context — a session picks up changes made by another session only when it
  re-reads the file (e.g. at the start of a new chat, or when explicitly told to
  re-check memory).

### Risk: concurrent writes from parallel sessions

If two sessions update `project-state.md` at nearly the same time, the last write
wins and can silently discard the other session's update (or a targeted string-replace
edit can fail if the file content shifted underneath it). To avoid this:

1. **Give each parallel session its own scoped area to write**, instead of having all
   sessions edit the same section of `project-state.md` concurrently. Two options:
   - A dedicated heading/subsection per workstream inside `project-state.md`
     (e.g. `## Track A — <name>`, `## Track B — <name>`), each session only ever
     appends/edits its own heading.
   - A separate file per workstream, e.g. `/memories/repo/track-a.md`,
     `/memories/repo/track-b.md`, with `project-state.md` staying as the single
     consolidated summary that gets updated only when a track finishes (not mid-flight
     by multiple sessions at once).
2. **Don't have two sessions write the shared "Open items" / top-level summary section
   at the same time.** Let one session own consolidation, or do it yourself by asking
   one session at a time, sequentially, to merge track files into `project-state.md`.
3. When telling a parallel session to update memory, be explicit about **which file or
   section is theirs**, e.g.:
   > "Update `/memories/repo/track-b.md` with your progress. Do not edit
   > `project-state.md` directly — I'll consolidate later."

### Sharing this document with a session

You can literally paste or reference `.github/copilot-chat-context-management.md` in
any session (e.g. "follow the conventions in
`.github/copilot-chat-context-management.md` for memory updates") — it's a normal
tracked file in the repo, so every session in this workspace can read it the same way.

## Command cheat sheet — exact phrases to give a session

Copy-paste one of these into any chat session on this workspace.

**Update repo memory with general progress (single/simple case):**
> Update repo memory at `/memories/repo/project-state.md` with what you just did,
> following `.github/copilot-chat-context-management.md`.

**Update repo memory as one of several parallel sessions (avoid clobbering):**
> Update your own section/file in repo memory only — do not edit the shared
> `/memories/repo/project-state.md` top-level summary. Write your progress to
> `/memories/repo/track-<name>.md`, following
> `.github/copilot-chat-context-management.md`.

**Resume a new session after a restart:**
> Resume — check repo memory first (`/memories/repo/project-state.md` and any
> `/memories/session/` notes) before asking me anything.

**Save progress before ending a degraded/long session (handoff):**
> Before we stop, write a handoff summary of progress, open decisions, and next steps
> into repo memory (`/memories/repo/project-state.md`), following
> `.github/copilot-chat-context-management.md`.

**Consolidate parallel track files into the master state file:**
> Read all `/memories/repo/track-*.md` files and merge them into
> `/memories/repo/project-state.md`, then leave the track files as-is (or clear them
> once merged).
