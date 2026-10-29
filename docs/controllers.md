# Playing and controllers

Open a game and choose **Play in browser**. The Snes9x core runs in WebAssembly
and the ROM is loaded whole (256 KB–8 MB); nothing is streamed.

## Keyboard

The player uses RetroArch's default keyboard mapping:

| Key         | Control |
| ----------- | ------- |
| Arrow keys  | D-pad   |
| Z           | B       |
| X           | A       |
| A           | Y       |
| S           | X       |
| Q           | L       |
| W           | R       |
| Enter       | Start   |
| Right Shift | Select  |

Focus the game canvas before using the keys. Game keys are captured by the
emulator; browser shortcuts such as Ctrl/Cmd combinations still work.

## Gamepads

Connect a USB/Bluetooth gamepad and press a button so the browser exposes it,
then open the game. Gamepads are read through RetroArch's input layer
(`Gamepad API`); no pairing UI is needed. If a gamepad is not detected, check
`chrome://gamepad` (or the browser's equivalent) and reconnect it before
launching.

## Save states

Save states are core-specific and slot-based:

- Slots: **Auto**, **Slot 1**, **Slot 2**, **Slot 3**.
- **Save state** captures the current session; **Load state** restores it;
  **Delete** removes it.
- States are stored locally in IndexedDB immediately. When signed in, they are
  also synced to PocketBase per user and game; loading on another device uses
  the cloud copy.
- The status chip in the player shows `syncing`, `synced`, or `error`. A failed
  upload keeps the local copy and retries on the next session.
- A state saved on one core is refused by another core (with a clear message)
  instead of crashing the emulator.

The session also saves automatically when the page is hidden or you leave the
player — but never for a game that was never started.

## Battery saves (SRAM)

Games with battery-backed saves expose a **Battery save** menu:

- **Download .srm** exports the current battery save (and syncs it when signed
  in).
- **Load .srm** imports a `.srm`/`.sav` file; the core relaunches with it.
- When a synced battery save exists, the player offers **Load battery save**
  above the game window.

## Display and audio

- **Scaling**: the game renders into a whole-number multiple of the SNES
  256×224 frame, then the browser smoothly fits that buffer to the 4:3 game
  window. Pixel blocks stay hard and evenly sized; the fractional remainder is
  softly interpolated instead of being stretched into uneven pixels.
- **Aspect**: the game window is 4:3 (CRT-correct for the SNES's 8:7 pixels)
  and fills the area for standard games. It is centred and sized to fit the
  viewport height on short screens.
- **Resizing and fullscreen**: the render scale is recomputed when the window
  or fullscreen size changes, so the picture stays even and playback continues.
- **Hi-res and PAL**: screens that are not 256×224 (512×448 hi-res or 239-line
  PAL) are shown at the nearest whole multiple with black borders rather than
  being stretched.
- **CRT scanlines** toggles the CSS scanline overlay. Its pitch follows the
  displayed source-line height, so there is one scanline per game line at any
  scale.
- **Volume** is absolute: 100 is the core's full output, 50 is roughly half
  amplitude (−6 dB), and 0 silences the game. Changes apply immediately and do
  not interrupt playback.
- **Mute** silences the game without changing the slider; unmuting restores the
  level the slider shows. A muted player stays silent when you press Play.
- Fullscreen: the button in the top-right corner or double-click the game
  window.
