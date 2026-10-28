# Playing and controllers

Open a game and choose **Play in browser**. The Snes9x core runs in WebAssembly
and the ROM is loaded whole (256 KB–8 MB); nothing is streamed.

## Keyboard

The player uses RetroArch's default keyboard mapping:

| Key | Control |
|---|---|
| Arrow keys | D-pad |
| Z | B |
| X | A |
| A | Y |
| S | X |
| Q | L |
| W | R |
| Enter | Start |
| Right Shift | Select |

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

- **CRT scanlines** toggles the CSS scanline overlay.
- **Mute** and the volume slider control approximate emulator volume.
- Fullscreen: the button in the top-right corner or double-click the game
  window.
