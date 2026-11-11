# StageInk for Mac

Requires macOS 13 or later. Build using Xcode command-line developer tools.

```sh
./build.sh
./check-components.sh
```

The build script makes a universal Apple Silicon and Intel application. Open StageInk.app. Settings are saved in `~/Library/Application Support/StageInk`. A valid settings file beside an older classroom build is migrated when the new settings file does not exist.

- Command+Option+D toggles Draw / Interact
- Command+Option+P, L, A, R and E select pen, line, arrow, rectangle and ellipse
- Command+Option+Z undoes the latest mark on each display
- Command+Option+X clears the current board
- Command+Option+0, 1 and 2 choose Desktop, Whiteboard and Blackboard
- Command+Option+T opens the timer

Use the palette buttons if a shortcut conflicts with another app. Escape exits drawing when the canvas or controls have keyboard focus. Close the app using Command+Q or the StageInk menu.

The preview build is ad-hoc signed and is not notarized. Apple Silicon execution and the production component checks were tested on the teaching Mac. Intel execution, physical drawing, click-through, global shortcut delivery and full-screen presentations require a hands-on check on the destination Mac.
