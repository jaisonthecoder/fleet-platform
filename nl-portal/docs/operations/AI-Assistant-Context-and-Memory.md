# AI assistant context and memory

How this project handles long sessions and remembered state, for **both** assistants —
and why the two look different.

Copilot-specific detail lives in
[`.github/copilot-chat-context-management.md`](../../.github/copilot-chat-context-management.md).
This document is the comparison and the shared conventions.

## The important difference

Copilot Chat degrades and can stall once its context window fills, and the only way out
is a new session, which loses everything. Claude Code **auto-compacts**: the earlier part
of the conversation is summarised and work continues in the same session.

So the prevention-and-recovery discipline in the Copilot document is genuinely necessary
there and has **no Claude equivalent**. Do not write one.

| | Copilot Chat | Claude Code |
| --- | --- | --- |
| Context window fills | Degrades, then stalls | Auto-compacts, session continues |
| Escape hatch | New chat, context lost | `/compact` to choose the moment; `--continue` / `--resume` to reopen |
| Memory location | `workspaceStorage/<id>/GitHub.copilot-chat/memory-tool/memories/` | `~/.claude/projects/<project-path-key>/memory/` |
| In git? | No | No |
| Shared with teammates? | No | No |
| Shared across your own sessions | Yes, same workspace | Yes, same project path |
| Parallel-session write conflicts | Yes — last write wins | Same risk, same mitigation |
| Team-shared context | `.github/copilot-instructions.md` | `CLAUDE.md` |

**Neither memory store is in the repository.** That is the point most worth internalising:
anything a teammate or a fresh checkout must know belongs in `CLAUDE.md` or `docs/`, not
in either assistant's memory. Memory is a convenience for *you* on *this machine*.

## What each assistant maintains

### Claude Code

Memory is one fact per file, with frontmatter naming its type — `user`, `feedback`,
`project` or `reference` — plus a one-line `MEMORY.md` index that is loaded each session.

Currently held: that the setup is to stay small and flexible; that the two apps share no
code and each must build if lifted out of the monorepo; that branded PDFs and emails need
API-side brand values and that this is unresolved until S1.10; and where the intake
documents live along with the nine v4 override rules.

To use it:

- **"check memory"** at the start of a resumed session, or just describe the task —
  relevant memories surface on their own.
- **"remember this"** when a decision is one you would otherwise repeat. Prefer the
  *reason* over the fact: "we chose X because Y" survives a change of circumstance.
- Ask for a correction when a memory goes stale. They reflect what was true when written.

### Copilot

Repo memory at `/memories/repo/project-state.md`, session scratch at `/memories/session/`.
The command phrases are in the Copilot document. The parallel-session caveat there is
real: give each concurrent session its own file or heading, and let one session own
consolidation.

## Conventions that apply to both

**One unit of work, one session.** A slice, a document, an artifact — then start fresh.
For Copilot this avoids the stall. For Claude it avoids drift: compaction keeps the thread
alive but summarises detail, and stale context from the previous slice is what makes the
next one wander.

**Do not paste large content into the chat.** Point the assistant at the file. Both read
files with their own tools, and a pasted file is spent context that cannot be reclaimed.

**Delegate wide exploration.** A search across many files should return a conclusion, not
a pile of file contents. Copilot: ask for a subagent. Claude Code: it has subagents and
uses them for fan-out searches.

**Durable state goes in the repo.** Plans in `docs/plans/Project-Kickoff-and-Phase1-Plan.md` and
`docs/plans/01-Vertical-Slice-Implementation-Plan.md`; decisions in `docs/adr/`; discovered work
in `docs/gaps.md`. If losing the chat would lose the information, it was in the wrong place.

## Keeping the two instruction files in step

`CLAUDE.md` and `.github/copilot-instructions.md` share their whole body — the project
rules, foundation rules, conventions and definition of done — and that content is
**mirrored** between them.

Both files carry a marker:

```
<!-- END OF SHARED CONTENT ... -->
```

Everything **above** it is mirrored. Everything **below** is assistant-specific and must
survive the mirror: Claude's context section in one, Copilot's in the other.

**When updating the shared rules:** edit `CLAUDE.md`, then copy it over
`copilot-instructions.md` **up to the marker only**, keeping the existing tail. A blind
whole-file copy deletes the Copilot section — that had already nearly happened once.

To check the shared halves still match:

```bash
node -e "const f=require('fs'),c=t=>f.readFileSync(t,'utf8').split('END OF SHARED CONTENT')[0];console.log(c('CLAUDE.md')===c('.github/copilot-instructions.md')?'in step':'DIVERGED')"
```

`CLAUDE.md` sets itself a ceiling of 200 lines. It is loaded on every request, so length
costs attention on every request — when a section grows past a few lines, move the detail
here and leave a pointer.
