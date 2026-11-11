# Relay Voice 0.11.0 verification

The green Relay Voice app is available as an Apple Silicon Mac DMG, a Windows x64 ZIP and a source ZIP.

## Build record

The tested app source snapshot is `2e836629383c3368cc3143d2897be96cdf13e832`.

- 37 backend tests pass on Mac and Windows
- 54 Electron component tests pass on Mac and Windows
- Four Mac native policy suites and the real Mac helper protocol checks pass
- 29 Windows native helper protocol checks pass with an isolated fictional provider
- Three checks run the actual bundled Python executable on each platform with an empty environment and no external provider calls
- Both finished apps launch with empty history, unconfigured keys and two blank password fields
- Mac DMG mounting, contents, minimum macOS version and deep signature verification pass
- Windows archive, native helper, bundled runtime and embedded app resources pass inspection
- Source secret scanning reports zero findings. Package inspection found no personal identifiers, provider configuration, recordings or saved history

[Windows build and test run](https://github.com/promptadvisers/codexandcoffee/actions/runs/43080470625)

## What to try on your computer

The Mac package targets Apple Silicon and macOS 13 or later. The Windows package targets Windows 10 or 11 on Intel or AMD x64. Both include their runtimes. Each learner supplies a Gemini API key in Settings & setup and grants operating-system permissions.

These are preview builds. Physical microphone capture, hold-to-speak behavior, insertion into destination editors, provider access and quota still require a hands-on check on the target computer. Global shortcuts were disabled during automated launch checks. The Windows helper is a new implementation. Its automated protocol checks use fictional requests and do not establish physical dictation quality.

The Mac package has an ad-hoc signature and no Apple notarization. The Windows package has no commercial signing certificate. Use the normal operating-system approval process described in the README. Apple Intel and Windows ARM execution were not tested.

## Privacy and source

The public files contain no personal keys, configured accounts, recordings or request history. Relay Voice Community has separate local settings and encrypted provider storage. Audio and relevant request context go to the configured provider after you request work. Optional Gmail uses your own Google Workspace CLI login.

The source includes the original phased build prompts and the new Windows helper. [Setup, source and privacy guide](relay-voice/README.md)
