# Spec Delta

## REMOVED Requirements

### Requirement: Scanlines follow the source line pitch

**Reason**: The static scanline overlay this requirement described was replaced
by the single-pass CRT effect that the emulator applies to its own output
(capability `player-crt`, shipped in 0.7.0). The overlay markup, its CSS and
the source-line pitch math were removed with that change, so the requirement
can no longer be satisfied and contradicts `player-crt`'s fixed output frame.

**Migration**: None required at runtime — the player no longer draws a scanline
overlay. The CRT look, including scanlines, is specified by `player-crt`, which
pins the effect to a 1440x960 frame so its scanline pattern cannot beat against
the render scale.
