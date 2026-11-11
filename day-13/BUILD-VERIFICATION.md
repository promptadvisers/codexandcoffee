# StageInk 0.2 preview verification

Verified on 11 November 2026. Source snapshot `7ba96f7cded1da23c66f7037c9c7ed855e261bda`.

## Mac

- Universal main executable and bundled practice app contain `arm64` and `x86_64`
- 22 production component checks passed on Apple Silicon, including the final release-point regression and creation of a writable settings folder
- DMG filesystem checksum passed
- DMG mounted read-only and both app signatures passed verification
- Mounted main executable matched the locally built executable
- The app is ad-hoc signed and has not been notarized

## Windows

- Self-contained Windows x64 executable built on a GitHub-hosted Windows runner with .NET 10
- 32 production-component and native-window smoke checks passed
- Tests cover drawing types, style preservation, undo, board isolation, persistence, damaged-settings recovery, countdown behavior, palette mode changes, native pass-through flags and rendered pixels
- The real palette and timer windows were created during testing
- The release ZIP passed CRC checks
- The executable is unsigned

[Windows build and test run](https://github.com/promptadvisers/codexandcoffee/actions/runs/43040997986)

## Remaining hands-on checks

Physical desktop drawing, click-through, global shortcut conflicts, multi-monitor behavior, scaling and full-screen presentations need verification on the destination computer. Intel Mac execution was not tested. Windows native-window style checks and direct drawing-model tests establish their stated behavior without proving physical pointer delivery through a real presentation.

The initial lesson's screenshots and 20 Mac checks remain a record of its first prototype. Release 0.2 includes additional packaging and platform work. Its Mac app saves in Application Support and its Windows app saves in Local App Data.
