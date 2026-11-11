# StageInk for Windows

A native Windows edition of the Day 13 presentation drawing app. Requires Windows 10 or 11 on a 64-bit Intel or AMD computer. The release ZIP contains the .NET runtime, so a separate runtime installation is unnecessary.

## Run

Extract the ZIP into a folder and open StageInk.exe. Keep it together with any included supporting files. The app opens in Interact mode. Select a tool and click Start drawing, or press Ctrl+Alt+D. Press Escape or Ctrl+Alt+D to return to the desktop.

Tools include pen, line, arrow, rectangle and ellipse, seven colors, line widths, undo, clear, whiteboard, blackboard, a break timer and a practice surface. Settings and drawing data are saved in `%LOCALAPPDATA%\StageInk`.

## Shortcuts

- Ctrl+Alt+D toggles Draw / Interact
- Ctrl+Alt+P, L, A, R and E select pen, line, arrow, rectangle and ellipse
- Ctrl+Alt+Z undoes the latest mark on each active display
- Ctrl+Alt+X clears the current board
- Ctrl+Alt+0, 1 and 2 select Desktop, Whiteboard and Blackboard
- Ctrl+Alt+T opens the timer

A shortcut already used by another application may be unavailable. Use the palette buttons in that case.

## Build and check

Install the .NET 10 SDK on Windows, then run these commands from this folder.

```powershell
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o publish
$check = Start-Process ./publish/StageInk.exe -ArgumentList @('--self-test', "$PWD/check-results") -PassThru -Wait
Get-Content ./check-results/summary.txt
```

The checks cover the production drawing model, rendering, persistence, countdown and native window styles. They also open the real palette and timer. Physical mouse delivery, global shortcut conflicts, multiple displays, different scaling settings and full-screen presentations need hands-on checks on the destination PC. The preview executable is unsigned.
