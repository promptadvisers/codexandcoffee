# Day 13 · Rebuild an app with Codex

A 45-minute lesson on inspecting DemoPro, using Computer Use and REA, writing a specification, planning an independent app and checking the result.

## Lesson downloads

- [PowerPoint slides](https://github.com/promptadvisers/codexandcoffee/raw/refs/heads/main/day-13/Day-13.pptx)
- [Offline slide viewer](https://github.com/promptadvisers/codexandcoffee/raw/refs/heads/main/day-13/Reverse-Engineering.html)
- [Lesson prompts and original experiment](https://github.com/promptadvisers/codexandcoffee/raw/refs/heads/main/day-13/Reverse-Engineering-Learner-Kit.zip)
- [Presenter guide](RUN-OF-SHOW.md)

## StageInk downloads

- [Mac DMG — macOS 13+, Apple Silicon and Intel](https://github.com/promptadvisers/codexandcoffee/releases/download/day-13-stageink-v0.2.0/StageInk-macOS.dmg)
- [Windows ZIP — Windows 10/11, Intel and AMD 64-bit](https://github.com/promptadvisers/codexandcoffee/releases/download/day-13-stageink-v0.2.0/StageInk-Windows-x64.zip)
- [App source only](https://github.com/promptadvisers/codexandcoffee/releases/download/day-13-stageink-v0.2.0/StageInk-Source.zip)
- [Release and verification notes](https://github.com/promptadvisers/codexandcoffee/releases/tag/day-13-stageink-v0.2.0)
- [Browse the source](app/)
- [Read the build and verification record](BUILD-VERIFICATION.md)

On Mac, open the DMG, drag StageInk into Applications, eject the disk and launch StageInk. On Windows, extract the ZIP and launch StageInk.exe. The Windows package includes its runtime. These are unsigned or ad-hoc-signed previews, and operating-system security may require approval to open them.

StageInk provides pen, line, arrow, rectangle and ellipse tools, seven colors, line widths, undo, clear, whiteboard, blackboard, a break timer and a practice surface. The Mac edition uses Swift and AppKit. The Windows edition uses C# and WPF. See each platform's README for shortcuts.

## What was checked

The lesson preserves the original Mac investigation and its twenty passing component checks. The installable Mac preview adds a writable Application Support folder, a bundled practice surface and universal binaries. Its updated component checks run on the teaching Mac. The Windows build runs automated production-component and native-window smoke checks on a Windows GitHub runner.

Physical desktop drawing, click-through, shortcut conflicts, multiple displays, scaling and full-screen presentations still need hands-on checks on the destination computer. Intel Mac execution is also unverified. The previews are suitable for trying the lesson and continuing the build. They are independent implementations and include a subset of DemoPro's features.

The lesson kit contains the recorded first prototype. Use the StageInk downloads above for the packaged release and current source. REA metadata inspection was executed. Deeper native decompilation was unavailable because the required engine was absent.
