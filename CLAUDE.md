# AI Collaboration Guide — FlockOps

This file is read by AI coding assistants (Claude Code, or any other AI you switch to) at the start of every session. It contains conventions that don't change often. For the current build status, always read `PROGRESS.md` as well — that file changes constantly and reflects what's actually been built so far, not just the plan.

## Project Summary

FlockOps is a broiler farm management web app, built first as an internal tool for a 4-shed broiler operation (Phase A), then opened up as a multi-tenant subscription product for other farmers (Phase B). Full feature list, data model, and step-by-step build sequence live in `broiler-farm-management-project-spec.md` in this repo — read that file first if you need the "why," not just the "what."

## Tech Stack (do not deviate without updating this file)

- Frontend: Next.js (React), mobile-first, PWA-configured
- Backend/DB: Supabase (Postgres, Auth, Storage, Row-Level Security)
- Notifications: WhatsApp Business API or Twilio
- Payments (Phase B): JazzCash / EasyPaisa
- Hosting: Vercel (frontend) + Supabase (backend)

## Session Start Protocol

Every AI session (new chat, new context window, or a different AI model entirely) should, before writing any code:
1. Read this file (`CLAUDE.md`).
2. Read `PROGRESS.md` — specifically "Current Phase," "In Progress," and "Next Immediate Task."
3. Read `broiler-farm-management-project-spec.md` sections relevant to whatever is being worked on.
4. Only then start coding.

## Session End Protocol (do this before context runs out, not after)

Don't wait until you're cut off. Update `PROGRESS.md` proactively:
- As soon as a step or sub-feature is completed, mark it done in `PROGRESS.md` immediately — don't batch this up for "later."
- If you sense the context window is getting long (long conversation, many files touched, many tool calls made), stop and update `PROGRESS.md` with current state *before* continuing further work, even if the current task isn't finished. An incomplete task that's well-documented is recoverable; an incomplete task with no notes is not.
- Never leave a session with uncommitted code and an unupdated `PROGRESS.md` at the same time — at least one of the two must reflect reality.

## What Must Be Tracked in PROGRESS.md

- **Current phase/step** — which numbered step from the spec's implementation sequence is active
- **Completed steps** — a checked-off list, not a narrative
- **In-progress work** — exactly what's half-built and what's left to finish it
- **Known issues / bugs** — anything broken or stubbed out with fake data
- **Key decisions log** — any place where the actual build diverged from the spec doc, and why (e.g., "used a different library than planned because X")
- **Environment/setup notes** — what env vars, API keys, or services need to be configured to run the project locally (names only, never actual secret values)
- **Next immediate task** — the single next thing to do, written specifically enough that a new session can start on it with zero back-and-forth

## Git Commit Policy

Commit small and often — a commit should represent one coherent, working (or intentionally WIP-labeled) change, not a whole day's work bundled together.

**Commit after:**
- Completing any single feature or sub-feature from the spec's step list (e.g., "daily log entry form working end-to-end" is a commit, not "all of step 2 through step 4")
- Any schema/migration change, committed separately from feature code that uses it
- Before starting a risky or large refactor — this gives a safe rollback point
- At the end of every session, regardless of whether the current task is finished — commit as WIP if needed (see message convention below)

**Never commit:**
- `.env` files, API keys, or any secrets — these must be in `.gitignore` from the very first commit
- Large generated/build artifacts

**Commit message convention:**
```
feat: add daily log entry form
fix: correct FCR calculation rounding
chore: update dependencies
docs: update PROGRESS.md with step 4 status
wip: partial implementation of shed dashboard — see PROGRESS.md
```

**Branching:** for a solo/AI-assisted build, commit directly to `main` with frequent small commits — a full branching workflow is overhead you don't need yet. Once Phase B (multi-tenant/billing) begins, tag the last Phase-A-only commit (e.g., `git tag phase-a-complete`) so there's a clean rollback point before multi-tenancy changes touch the data model.

## Handling an AI/context switch mid-project

If you're moving to a new AI session, a new context window, or a different AI model entirely:
1. Make sure the last commit and `PROGRESS.md` are both up to date (see Session End Protocol above).
2. Start the new session by pointing the AI at this file, `PROGRESS.md`, and the spec doc, in that order.
3. Do not re-explain the project verbally if these files are current — that's exactly what they're for. If the files are out of date, fix them first, then proceed.
