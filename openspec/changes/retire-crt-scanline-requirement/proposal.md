# Proposal

## Why

`openspec/specs/player-video/spec.md` still requires the static scanline overlay
to track the source-line pitch ("the scanline period SHALL match the on-screen
height of one source line"). That overlay no longer exists: the CRT effect
moved into the emulator as a single-pass shader (capability `player-crt`,
shipped in 0.7.0), and the overlay markup, its CSS and the pitch math were
deleted with it.

A requirement that describes a removed control cannot be satisfied and
contradicts `player-crt`'s fixed 1440x960 frame. Left in place it misleads
anyone reading the spec and would make a future change "restore" behaviour that
was deliberately retired.

## What Changes

- Remove the `Scanlines follow the source line pitch` requirement and its
  scenario from the `player-video` capability.
- Record why it was retired and where the behaviour now lives (`player-crt`
  owns the CRT look, at a fixed frame rather than a per-line overlay).
- No code, configuration, or asset changes: the implementation side was already
  removed in 0.7.0.

Out of scope: `player-video` also states the whole-pixel render scale and the
resize behaviour unconditionally, which is true only while the CRT effect is
off (with it on, the canvas is the effect's 1440x960 frame). That is a separate
scoping question and should be handled by its own change rather than folded
into this removal.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `player-video`: removes the requirement that the CRT overlay's scanline pitch
  follow the source line height.

## Impact

- `openspec/specs/player-video/spec.md` after the delta is applied: one fewer
  requirement, no code or runtime behaviour affected.
- No source, test, documentation, dependency, schema or deployment changes.
