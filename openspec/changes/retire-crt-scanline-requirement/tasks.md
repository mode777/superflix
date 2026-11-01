# Tasks

## 1. Confirm the retired behaviour is already gone

- [x] 1.1 Verify no code still implements a source-line-pitch scanline overlay: `grep -rn "scanlinePitch\|crt-line-pitch\|crt-overlay" src/` reports only the `GameWindow` test that asserts the overlay is absent, and nothing in `scaling.ts` or the player hooks
- [x] 1.2 Verify the player documentation describes the shader's scanlines rather than a per-line overlay pitch: the CRT entry in `docs/controllers.md` mentions rolling scanlines inside the fixed effect frame

## 2. Validate the delta

- [x] 2.1 Run `openspec validate retire-crt-scanline-requirement --strict` and confirm it passes
- [x] 2.2 Confirm the delta's removed requirement name matches the main spec exactly (`### Requirement: Scanlines follow the source line pitch` in `openspec/specs/player-video/spec.md`), so archiving removes that requirement and leaves the other five intact

## Workflow follow-up

- Run `/opsx-archive retire-crt-scanline-requirement` and confirm `openspec/specs/player-video/spec.md` keeps its Purpose and five remaining requirements, with no delta headers.
