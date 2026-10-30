# accessibility Specification

## Purpose

Makes Superflix fully operable by keyboard, respectful of reduced-motion preferences, and correctly labeled for screen readers — across browse, details, admin, and the emulator player.

## Requirements

### Requirement: Reduced motion is honored
When the user's system requests reduced motion, the app SHALL disable decorative animation (shimmer, slides, drift, pulsing) without removing any content or functionality.

#### Scenario: Reduced-motion user browses
- **WHEN** the OS is set to reduce motion and the user opens browse with a loading grid
- **THEN** skeletons and toasts appear without shimmer or sliding movement and all content still renders

#### Scenario: Full-motion default unchanged
- **WHEN** no reduced-motion preference is set
- **THEN** animations behave as they do today

### Requirement: Full keyboard operability
Every interactive control SHALL be reachable by keyboard in DOM order and operable with standard keys; pointer-only affordances SHALL have a keyboard equivalent.

#### Scenario: Keyboard-only import
- **WHEN** a keyboard user tabs through the admin identify screen
- **THEN** the ROM picker is reachable and opens the file dialog with Enter/Space, and all action buttons activate

#### Scenario: Keyboard-only player controls
- **WHEN** a keyboard user operates the player transport (play/pause, reset, CRT, mute, volume, save-slot select, save/load)
- **THEN** each control is focusable, operable, and its state change is perceivable

### Requirement: Modal focus management
Any modal-style UI SHALL trap keyboard focus while open, close on Escape, and return focus to the element that opened it.

#### Scenario: Open and dismiss a modal
- **WHEN** a user opens a modal dialog and presses Escape
- **THEN** the dialog closes and focus returns to its trigger

#### Scenario: Focus stays inside modal
- **WHEN** a modal is open and the user tabs repeatedly
- **THEN** focus cycles within the dialog and never reaches content behind it

### Requirement: Visible focus on all interactive elements
Interactive elements SHALL show a clearly visible focus indicator consistent with the theme when focused via keyboard.

#### Scenario: Chip and icon-button focus
- **WHEN** a keyboard user focuses a genre chip, icon button, or card link
- **THEN** a visible focus ring appears using theme tokens

### Requirement: Player surfaces are labeled
The emulator canvas, runtime status, and transport controls SHALL expose accessible names and status changes to assistive technology.

#### Scenario: Status changes announced
- **WHEN** the player transitions between loading, playing, paused, and error states
- **THEN** the change is reflected in an accessible status surface

#### Scenario: Canvas has a name
- **WHEN** a screen reader encounters the player canvas
- **THEN** it announces a meaningful label (game being played), not "unlabeled graphic"

### Requirement: Automated accessibility checks pass
The app's principal routes SHALL pass automated accessibility checks with no serious violations as part of the normal test run.

#### Scenario: Route scans
- **WHEN** the automated checks run against browse, details, admin sign-in, and the player
- **THEN** no serious (level: serious/critical) violations are reported
