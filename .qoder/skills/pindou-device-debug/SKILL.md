---
name: pindou-device-debug
description: Triage, reproduce, fix, review, deploy, and retest real-device bugs in the pindou mobile web experience. Use when a problem appears on iPhone Safari, iPhone WeChat, Android Chrome, Android WeChat, or another physical-device browser, including upload, EXIF orientation, image generation, long-press saving, downloads, sharing, Blob URLs, gestures, layout, performance, or device-only regressions.
---

# Pindou Device Debug

## Establish the bug record

1. Resolve the repository root with `git rev-parse --show-toplevel`.
2. Read `docs/development_status.md`, `docs/development_schedule.md`, `docs/decisions/0002-device-debug-workflow.md`, and `docs/phase-f-device-testing.md`.
3. Reuse the existing `BUG-F-###` when the symptom is the same. Allocate the next ID only for a distinct defect.
4. Normalize the user's natural-language report. Record when available:
   - device and model;
   - OS version;
   - browser or WeChat version;
   - deployment URL, release candidate, and commit;
   - exact steps and reproducibility;
   - actual and expected behavior;
   - screenshot, recording, console, or network evidence;
   - whether another environment works.
5. Ask only for missing information that materially changes diagnosis. Do not force the user to fill a formal template.

## Triage

- P0: data/privacy breach, unusable primary flow across target environments, or destructive behavior.
- P1: primary flow fails in one required environment with no acceptable fallback.
- P2: degraded interaction, layout, performance, or a working fallback exists.
- P3: cosmetic or low-impact inconsistency.

Distinguish a confirmed code defect from a device-only observation. Preserve uncertainty in the record.

## Reproduce and fix

1. Mark the bug `进行中` and assign one current owner in `docs/development_schedule.md`.
2. Work on `fix/BUG-F-###-description`, never directly on `main`.
3. Identify the smallest code path that explains the evidence.
4. Add an automated regression test whenever the behavior can be modeled outside the device.
5. Keep platform-specific fallback behavior explicit and user-visible.
6. Do not claim that jsdom, desktop emulation, or a viewport screenshot proves real-device saving, sharing, EXIF, or gesture behavior.
7. Run focused tests, the full consumer suite, build, and lint unless the change cannot affect consumer code.

## Review and deploy

1. Hand the fix to the other Agent for independent review when practical; require it for P0/P1.
2. Record the review verdict and validation results.
3. Publish a new release candidate or preview deployment bound to the fix commit. Do not overwrite the identity of the failed candidate.
4. Mark the bug `待真机复测`, not `已完成`.

## Close through real-device evidence

Ask the user to repeat the original steps on the original device or an explicitly accepted equivalent environment.

- On success, record device, version, URL/commit, date, and result; then mark `已完成`.
- On failure, keep the same Bug ID, append the new observation, return to `进行中`, and preserve prior attempts.
- If a fallback is accepted instead of a full fix, record that product decision explicitly.

Update `docs/development_status.md` only when the project's current capability or blocker changes. Keep detailed attempts in the task record rather than creating another global source of truth.

## Protect privacy and history

- Do not commit user photos, personal screenshots, tokens, generated output, or device identifiers beyond what the user approved.
- Do not use destructive Git commands to escape a failed fix.
- Revert shared regressions with an auditable revert commit and redeploy the last known-good version when necessary.
