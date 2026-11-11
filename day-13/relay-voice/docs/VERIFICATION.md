# Verification

## Repeatable checks

- `python -m unittest discover -s app -p test_backend.py` tests the real provider-routing code with synthetic fixtures
- `npm --prefix app/electron test` tests the main process, IPC, state, Markdown rendering, window behavior and encrypted-key interface with in-memory surfaces
- `app/test_native.sh` runs Mac native policy checks
- `app/build-helper.sh` then `python app/test_native_helper.py` tests the real Mac helper against a fictional backend, with global shortcuts disabled
- The course repository's `relay-voice-windows.yml` builds the actual Windows helper, runs its NDJSON protocol against a synthetic provider, packages Electron, and launches the finished app with an isolated profile
- `RELAY_SMOKE_DIR` is a release-test override for an empty profile and setup screenshot. It disables global shortcuts and checks for empty keys and history. It performs no live provider request

## Hands-on acceptance

On each target computer, add your own key, grant the required permissions, focus an empty text field, dictate a short sentence, and confirm the resulting words. Then try cancellation, another editor, and a research question if you configured Firecrawl. A successful build or protocol test does not establish microphone quality, physical key behavior, insertion in every editor, provider quota or multi-monitor behavior.

The published release notes record which checks were actually run for each download.
