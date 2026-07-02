---
name: pindou-develop
description: Develop and maintain the pindou project through a shared workflow for implementation, planning, testing, code review, project questions, status reporting, documentation synchronization, and Git version control. Use when Codex or Qoder is asked to develop pindou, change its plan, test it, review code, answer implementation questions, report status, or prepare a versioned handoff.
---

# Pindou Develop

## Resolve project context

1. Run `git rev-parse --show-toplevel` and work from that root.
2. Read `docs/development_status.md` and `docs/development_schedule.md`.
3. Read the relevant record under `docs/decisions/`.
4. Read only the product, technical, test, or module instructions needed for the request.
5. When changing `apps/consumer/`, read `apps/consumer/AGENTS.md` before coding.

Treat the status and schedule files as the dynamic authorities. Treat phase review handoffs as historical evidence only.

## Route the request

- `dev`: implement the requested change, validate it, update status and schedule, and prepare a review handoff.
- `plan`: update task breakdown, owner, state, dependencies, acceptance criteria, or priority in the schedule.
- `test`: select checks proportionate to risk; report commands and actual results without changing unrelated code.
- `review`: inspect requirements, diff, tests, regressions, legal boundaries, and documentation; return prioritized findings and a clear verdict.
- `quest`: answer from current code and authoritative documents; identify discrepancies instead of repeating stale handoffs.
- `status`: summarize the current phase, active tasks, blockers, latest validation, and next action.

Accept either explicit command-like requests or natural language.

## Execute development

1. Inspect `git status -sb`, the current branch, and overlapping user changes.
2. Associate work with a stable task ID from the schedule. Add one if needed.
3. Use a task branch. Do not develop directly on `main` unless the user explicitly requests it.
4. Preserve `inputs/`, `processed/`, `outputs/`, secrets, local verification assets, and the independent repository under `reference-projects/`.
5. Keep the Zippland reference read-only. Do not copy its source, tests, structure, palette JSON, branding, or assets.
6. Implement only the requested scope and add regression tests for changed behavior.
7. Run relevant unit tests, then build and lint for consumer changes. Add browser or real-device validation when behavior depends on them.
8. Update `docs/development_status.md` only when current facts change.
9. Update `docs/development_schedule.md` with state, owner, validation, blocker, and next action.
10. Update product, technical, or test baselines only when their contract changes.

## Apply version control

- Use one branch and PR per task or coherent baseline.
- Prefer explicit staging paths in mixed worktrees.
- Make small commits that describe one logical result.
- Never upload user images, generated production output, secrets, dependency caches, or third-party nested repository source.
- Require relevant checks and independent review before merging.
- Bind release candidates and device deployments to a commit and version.
- Prefer `git revert` for an already-shared bad change. Never use destructive reset or force push without explicit authorization.
- Follow `docs/decisions/0003-version-management.md` for release and recovery rules.

Do not push, merge, deploy, tag, or publish unless the user requested that external action or already authorized it as part of the task.

## Review independently

When acting as reviewer, do not silently become the implementer. Report:

- P0, P1, and P2 findings with tight file and line references.
- Commands run and actual results.
- Missing evidence, especially for mobile behavior.
- One verdict: `通过`, `修复后复审`, or `阻断`.

If Codex implemented, prefer Qoder review. If Qoder implemented, prefer Codex review.

## Hand off

Provide the task ID, objective, non-goals, branch and commit, changed files, design choices, commands and results, remaining risks, documentation updates, and the exact review request. Follow `docs/agent-collaboration.md`.

For a real-device failure, route to `pindou-device-debug` instead of treating automated checks as final acceptance.
