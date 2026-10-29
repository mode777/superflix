# player-audio Specification

## Purpose

Defines how the browser player turns the volume slider and mute control into audible gain, so the UI value, the emulator's output, and the controls' labels always describe the same real loudness.

## Requirements

### Requirement: Volume slider is absolute

The player SHALL treat the 0–100 volume slider as an absolute loudness control and apply the corresponding attenuation to emulator audio immediately, without restarting or pausing playback.

#### Scenario: Full volume at the top of the range
- **WHEN** the user sets the volume slider to 100
- **THEN** emulator audio plays at the core's full output level with no attenuation

#### Scenario: Mid-range produces audible attenuation
- **WHEN** the user moves the slider from 100 to 50 while a game is playing
- **THEN** the output level drops to approximately half amplitude (−6 dB) without interrupting playback

#### Scenario: Every slider position is distinct
- **WHEN** the user moves the slider through several positions between 0 and 100
- **THEN** each position produces a corresponding change in output level, monotonically quieter as the value decreases

### Requirement: Zero volume is silent

The player SHALL silence emulator audio completely when the volume slider is at 0.

#### Scenario: Slider at zero
- **WHEN** the user sets the volume slider to 0 while a game is playing
- **THEN** no game audio is audible, and playback continues unaffected

### Requirement: Mute silences and restores

The player SHALL silence emulator audio while muted and restore the previous slider level when unmuted, keeping the mute control's icon and label in sync with that state.

#### Scenario: Mute while playing
- **WHEN** the user activates Mute during playback
- **THEN** game audio becomes silent and the control shows the muted state

#### Scenario: Unmute restores the level
- **WHEN** the user unmutes after muting at a non-zero slider value
- **THEN** audio returns to the level the slider shows, and the control shows the unmuted state

#### Scenario: Muting does not change the slider value
- **WHEN** the user mutes and then unmutes
- **THEN** the volume slider still shows the value it had before muting

### Requirement: Settings apply to a newly started core

When a ROM loads or playback starts, the player SHALL apply the current volume and mute state to the audio output before or as the game starts, so a muted or reduced player never begins at full volume.

#### Scenario: Muted player starts a game
- **WHEN** the user mutes the player, then presses Play
- **THEN** the game starts without audible output until the user unmutes

#### Scenario: Reduced volume survives a ROM reload
- **WHEN** the user has set a reduced volume and the ROM or core is reloaded
- **THEN** the reloaded game plays at the same reduced volume

### Requirement: Volume failures do not stop playback

If the audio output cannot be adjusted, the player SHALL keep the game running and leave the slider and mute controls responsive rather than surfacing an error or interrupting the session.

#### Scenario: Volume change with no running emulator
- **WHEN** the user moves the slider or toggles mute before a game has started
- **THEN** the UI reflects the choice and the game starts with that choice once playback begins
