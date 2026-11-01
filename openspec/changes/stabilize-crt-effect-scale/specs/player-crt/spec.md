# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
vertically than horizontally. The blur radius SHALL be expressed in fixed frame
units so it does not change with the output surface. The blur SHALL apply to
the base picture and the ghosted halo and SHALL NOT remove the scanline
modulation.

#### Scenario: High-contrast edge

- **WHEN** the frame contains a high-contrast vertical edge
- **THEN** the edge is softened more along the vertical axis than the
  horizontal axis

#### Scenario: Scanlines preserved

- **WHEN** the blur is applied to a flat field
- **THEN** the scanline pattern remains visible

#### Scenario: Surface independence

- **WHEN** the same frame is shown at DPR 1 and DPR 3
- **THEN** the blur radius relative to the picture is the same
