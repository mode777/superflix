# player-crt Specification

## Purpose

Defines how the console player achieves its CRT presentation: the single-pass
effect RetroArch applies to its own output, the reference look, the fixed
output frame and its fit, the toggle, reduced-motion selection, and what
happens when the effect cannot be applied.

## Requirements

### Requirement: CRT presentation through the emulator

When the CRT setting is enabled and a game is running, the player SHALL present
the picture through a single-pass shader applied by the emulator to its own
output. The player SHALL NOT draw a scanline overlay, a second canvas, or any
other CRT layer on top of the emulator canvas.

#### Scenario: Default presentation

- **WHEN** a game is playing and the CRT setting is at its default
- **THEN** the picture shows the CRT effect and no overlay element is drawn
  over the canvas

#### Scenario: No overlay

- **WHEN** the effect is active
- **THEN** the canvas is the only element rendering the game picture

### Requirement: Fixed output frame

In CRT mode the player SHALL request a 1440x960 drawing buffer and fit it to
the 4:3 game area with a single smooth scale. The emulator MAY render that
frame at the display's device resolution, but the effect's coordinate space
SHALL remain the fixed 1440x960 frame. The effect's scanline count SHALL NOT
change with window size, device pixel ratio or fullscreen; it SHALL follow the
emulated frame's line count.

#### Scenario: Window resize

- **WHEN** the window is resized while a game is playing with CRT on
- **THEN** the requested buffer stays 1440x960, only the fitted scale changes,
  and the scanline count is unchanged

#### Scenario: Fullscreen

- **WHEN** the user enters fullscreen with CRT on
- **THEN** playback continues, the fixed frame is fitted to the new area, and
  the scanline count is unchanged

#### Scenario: Device pixel ratio

- **WHEN** the same game and player size are shown on a DPR 1, DPR 2 and DPR 3
  display
- **THEN** each shows the same number of scanlines for the same emulated frame

#### Scenario: CRT off

- **WHEN** the CRT setting is off
- **THEN** the canvas returns to a whole-number multiple of 256x224 for the
  game area

### Requirement: Reference look

The effect SHALL reproduce the tuned reference values for its per-pixel terms:
scanline strength 1.0 with rolling scanlines at one line per source line, a 3px
shadow mask measured in the fixed 1440x960 frame, the 0.95/1.05/0.95 tint, the
gain curve, filmic toe 0.013 and shoulder 5.6, gamma 1.18, grain, flicker,
vignette 0.35, and no barrel curvature. It SHALL also soften the sampled
picture with the anisotropic beam blur required by the `Anisotropic beam blur`
requirement.

#### Scenario: Tuned values

- **WHEN** a frame is presented
- **THEN** every per-pixel term matches its reference value

#### Scenario: Flat geometry

- **WHEN** a frame is presented
- **THEN** the image is not barrel-warped and fills the 4:3 area without
  rounded corners

#### Scenario: No bezel

- **WHEN** a frame is presented
- **THEN** no frame or bezel artwork is drawn around the picture

### Requirement: Pattern anchored to the source frame

The scanline pitch, shadow mask, per-scanline horizontal jitter and blur radii
SHALL be expressed in source-frame or fixed 1440x960 frame units, not output
pixels. The pattern SHALL NOT change with device pixel ratio, window size,
fullscreen or the emulator's actual drawing-buffer size. The scanline pitch
SHALL be one line per emulated source line.

#### Scenario: Device pixel ratio

- **WHEN** the same frame and player size are presented at DPR 1, DPR 2 and
  DPR 3
- **THEN** the number of scanlines and the mask period relative to the picture
  are the same

#### Scenario: Window resize

- **WHEN** the player is resized or enters fullscreen
- **THEN** the scanline, mask and jitter periods relative to the picture do not
  change

#### Scenario: PAL and hi-res frames

- **WHEN** the core presents a 239-line PAL or 448-line hi-res frame
- **THEN** the scanline pitch follows that frame's line count

### Requirement: Anisotropic beam blur

The effect SHALL soften the sampled picture with a blur that is stronger
horizontally than vertically. The blur radius SHALL be expressed in fixed frame
units so it does not change with the output surface. The blur SHALL apply to
the base picture and the ghosted halo and SHALL NOT remove the scanline
modulation.

#### Scenario: High-contrast edge

- **WHEN** the frame contains a high-contrast vertical edge
- **THEN** the edge is softened more along the horizontal axis than the
  vertical axis

#### Scenario: Scanlines preserved

- **WHEN** the blur is applied to a flat field
- **THEN** the scanline pattern remains visible

#### Scenario: Surface independence

- **WHEN** the same frame is shown at DPR 1 and DPR 3
- **THEN** the blur radius relative to the picture is the same

### Requirement: Current-frame only

The effect SHALL be a function of the current frame only. It SHALL NOT depend
on cross-frame persistence, so the picture remains stable when frames repeat
and no trail is drawn behind moving content.

#### Scenario: Paused frame

- **WHEN** the game is paused
- **THEN** the picture is stable and its per-pixel effect is unchanged

#### Scenario: Moving content

- **WHEN** content moves quickly across the screen
- **THEN** no phosphor trail follows it

### Requirement: Chroma bleed and ghosting

The effect SHALL include the reference's chromatic bleed and ghosting
(`ghosting` 0.3) by sampling the current frame at the reference's offsets,
tinted per channel.

#### Scenario: High-contrast edges

- **WHEN** the frame contains a bright edge on a dark background
- **THEN** a faint coloured fringe appears beside it

### Requirement: Upright, native-resolution source

The effect SHALL sample the emulator's frame at its native resolution in the
same orientation as the raw canvas, so blur and mask scale do not depend on the
render scale and the picture is never flipped.

#### Scenario: Orientation

- **WHEN** a game frame is presented through the effect
- **THEN** it is upright and matches the raw canvas

#### Scenario: Render scale change

- **WHEN** the player is resized so the underlying buffer would change
- **THEN** the effect's sampling and mask are unchanged

### Requirement: Toggle and default

The CRT setting SHALL default to enabled. Toggling it SHALL switch the effect
on and off without restarting the game, and the canvas SHALL remain the
focusable input surface in both states.

#### Scenario: Toggle off

- **WHEN** the user toggles CRT off
- **THEN** the raw emulator picture is shown and playback continues

#### Scenario: Toggle on

- **WHEN** the user toggles it back on mid-game
- **THEN** the effect returns without a reload

#### Scenario: Input focus

- **WHEN** the effect is active and the user clicks the picture
- **THEN** keyboard and gamepad input still reach the emulator

### Requirement: Failure behaviour

When the shader preset cannot be loaded or applied, the player SHALL keep the
game playable with the emulator's stock output and SHALL NOT block play, audio
or input.

#### Scenario: Preset rejected

- **WHEN** the emulator cannot apply the preset
- **THEN** the game keeps playing without the effect

### Requirement: Reduced motion

When the user requests reduced motion, the player SHALL load a still variant of
the effect in which the scanlines do not roll and the flicker and grain do not
change between frames.

#### Scenario: Reduced motion preference

- **WHEN** the user prefers reduced motion
- **THEN** the effect is static

### Requirement: Effect lifecycle

The effect SHALL only be applied while a game is running, and the player SHALL
return the canvas to the non-CRT size when the effect is disabled.

#### Scenario: Leaving the player

- **WHEN** the user leaves the player
- **THEN** the emulator is torn down as before and the next game starts with
  the effect re-applied

#### Scenario: Before the first frame

- **WHEN** a game is loaded but has not produced a frame yet
- **THEN** the loading state is shown as before
