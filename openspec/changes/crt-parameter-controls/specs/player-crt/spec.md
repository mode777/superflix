# Spec Delta

## MODIFIED Requirements

### Requirement: Reference look

The effect SHALL, by default, reproduce the tuned reference values for its
per-pixel terms: scanline strength 1.0 with rolling scanlines at one line per
source line, a 3px shadow mask measured in the fixed 1440x960 frame, the
0.95/1.05/0.95 tint, the gain curve, filmic toe 0.013 and shoulder 5.6, gamma
1.18, grain, flicker, vignette 0.35, and no barrel curvature. It SHALL also
soften the sampled picture with the anisotropic beam blur required by the
`Anisotropic beam blur` requirement.

#### Scenario: Tuned values

- **WHEN** a frame is presented with no user overrides
- **THEN** every per-pixel term matches its reference value

#### Scenario: Adjusted values

- **WHEN** a user override is set for an adjustable parameter
- **THEN** that parameter follows the override while the mask, tint, gain
  curve, filmic tonemap, gamma, grain and flicker keep their reference values

#### Scenario: Flat geometry

- **WHEN** a frame is presented
- **THEN** the image is not barrel-warped and fills the 4:3 area without
  rounded corners

#### Scenario: No bezel

- **WHEN** a frame is presented
- **THEN** no frame or bezel artwork is drawn around the picture

### Requirement: Anisotropic beam blur

By default, the effect SHALL soften the sampled picture with a blur that is
stronger horizontally than vertically. The blur radius SHALL be expressed in
fixed frame units so it does not change with the output surface. The blur SHALL
apply to the base picture and the ghosted halo and SHALL NOT remove the scanline
modulation. The user-adjustable horizontal and vertical blur values MAY override
the default ratio.

#### Scenario: High-contrast edge

- **WHEN** the frame contains a high-contrast vertical edge with the default
  values
- **THEN** the edge is softened more along the horizontal axis than the
  vertical axis

#### Scenario: Independent override

- **WHEN** the user sets the horizontal and vertical blur to different values
- **THEN** each radius follows its own value, including a vertical value
  greater than the horizontal

#### Scenario: Scanlines preserved

- **WHEN** the blur is applied to a flat field
- **THEN** the scanline pattern remains visible

#### Scenario: Surface independence

- **WHEN** the same frame is shown at DPR 1 and DPR 3
- **THEN** the blur radius relative to the picture is the same

## ADDED Requirements

### Requirement: Adjustable CRT controls

The player SHALL provide controls for scanline strength, horizontal blur,
vertical blur, vignette and ghosting. The reference values SHALL be the
defaults. The horizontal and vertical blur SHALL be independently adjustable.
The shadow mask, tint, gain curve, filmic tonemap, gamma, grain and flicker
SHALL remain fixed.

#### Scenario: Defaults

- **WHEN** the controls are first shown with no saved values
- **THEN** every control is at its reference value

#### Scenario: Adjust a control

- **WHEN** the user changes one of the five controls
- **THEN** that effect term follows the new value

#### Scenario: Independent blur

- **WHEN** the user sets the horizontal and vertical blur to different values
- **THEN** each radius follows its own value, including a vertical value
  greater than the horizontal

#### Scenario: Fixed terms

- **WHEN** any adjustable value is changed
- **THEN** the shadow mask, tint, gain curve, filmic tonemap, gamma, grain and
  flicker keep their reference values

### Requirement: CRT changes apply live

Changes to the adjustable parameters SHALL apply to a running game without
restarting it or interrupting playback.

#### Scenario: Adjust while playing

- **WHEN** the user moves a control while a game is running with CRT on
- **THEN** the picture updates without a reload and playback continues

### Requirement: CRT preferences persist

The player SHALL persist the adjustable values in the browser and SHALL offer a
reset to the reference. Stored values that are missing, invalid or out of range
SHALL fall back to the reference.

#### Scenario: Persist

- **WHEN** the user reloads the page or starts another game
- **THEN** the last saved values are used

#### Scenario: Reset

- **WHEN** the user resets the controls
- **THEN** every control returns to its reference value

#### Scenario: Invalid stored values

- **WHEN** the stored values are missing, malformed or out of range
- **THEN** the reference values are used instead

#### Scenario: Effect disabled

- **WHEN** the CRT effect is off and the user changes a control
- **THEN** the value is saved and applies when the effect is next enabled
