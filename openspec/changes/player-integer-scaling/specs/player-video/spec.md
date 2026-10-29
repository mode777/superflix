# Spec Delta

## Purpose

Defines how the console player maps the emulator's native SNES video output onto the page so pixel art stays sharp, evenly scaled and correctly proportioned at any window size, including fullscreen.

## ADDED Requirements

### Requirement: Whole-pixel render scale

The player SHALL render the emulator image at the largest whole-number multiple of the SNES native frame (256×224) that fits the 4:3 player area, measured in device pixels, clamped to a minimum of 1 and a maximum of 8. The rendered buffer SHALL always be an integer multiple of the native frame.

#### Scenario: Desktop panel

- **WHEN** the 4:3 player area measures 984×738 CSS pixels at device pixel ratio 1
- **THEN** the emulator renders at 3× (768×672)

#### Scenario: High-density display

- **WHEN** the device pixel ratio is 2 and the player area covers the same CSS size
- **THEN** the whole-number multiple is selected from physical pixels, so the rendered buffer covers the area at twice the pixel density

#### Scenario: Large display cap

- **WHEN** the player area would allow more than 8×
- **THEN** the render scale stops at 8×

#### Scenario: Small viewport

- **WHEN** the player area cannot fit 2×
- **THEN** the emulator renders at 1× and is never downscaled from a larger buffer

### Requirement: Interpolated fractional remainder

After the whole-pixel stage, the player SHALL scale the rendered image to the player area with smooth interpolation. It SHALL NOT use nearest-neighbour scaling for the final fit, so pixel interiors stay hard while edges soften evenly.

#### Scenario: Fractional fit

- **WHEN** the player area is not an exact multiple of the rendered buffer
- **THEN** the canvas fills the area using smooth interpolation

#### Scenario: Exact fit

- **WHEN** the player area is an exact multiple of the rendered buffer
- **THEN** the rendered image is displayed unchanged, with no visible resampling

### Requirement: CRT-correct 4:3 presentation

The player SHALL present the game area at a 4:3 aspect ratio, treating 256×224 as 8:7 pixels, and SHALL fill that area with the game image for standard 256×224 output. A wider surrounding card SHALL NOT impose its own aspect ratio on the game image.

#### Scenario: Standard game

- **WHEN** a 256×224 game is displayed
- **THEN** the visible game area has a 4:3 ratio with no black bars around the image

#### Scenario: Container independence

- **WHEN** the page is wider or narrower than the player card
- **THEN** the game area keeps 4:3 and the image is not stretched to the container's ratio

### Requirement: Resize and fullscreen without restart

When the window is resized or fullscreen is entered or exited, the player SHALL recompute the whole-pixel scale and resize the canvas while playback continues. It SHALL NOT restart or reload the emulator, and save/SRAM state SHALL survive the resize.

#### Scenario: Entering fullscreen

- **WHEN** the user toggles fullscreen
- **THEN** the canvas adopts the whole-pixel scale for the new area and the runtime status stays playing

#### Scenario: Window resize

- **WHEN** the window becomes narrower or wider
- **THEN** the canvas is resized to the new whole-pixel multiple instead of being stretched with nearest-neighbour filtering

### Requirement: Non-standard frame geometry

When the core outputs a frame other than 256×224 (hi-res 512×448 or non-224-line output), the player SHALL preserve whole-pixel scaling by fitting the largest whole multiple inside the existing buffer and letterboxing the remainder rather than stretching the frame fractionally.

#### Scenario: Hi-res screen

- **WHEN** a game switches to a 512×448 screen
- **THEN** its pixels remain whole multiples of the display grid, accepting bars where the frame does not fill the buffer

#### Scenario: Return to standard

- **WHEN** the game returns to 256×224 output
- **THEN** the standard frame fills the player area again without user action

### Requirement: Scanlines follow the source line pitch

When the CRT overlay is enabled, the scanline period SHALL match the on-screen height of one source line so the pattern does not beat against the render scale.

#### Scenario: Scanlines at a fractional fit

- **WHEN** a 224-line frame is displayed in a 738 px tall area
- **THEN** the scanline period is 738/224 px (about 3.29 px) rather than a fixed 3 px
