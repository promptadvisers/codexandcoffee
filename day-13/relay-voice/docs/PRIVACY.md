# Privacy and local data

The release contains source, synthetic tests, prompts and app assets. It ships without configured accounts, API keys, OAuth credentials, recordings or conversation history.

## Your device

The desktop release uses a separate `Relay Voice Community` data folder.

- Mac — `~/Library/Application Support/Relay Voice Community/`
- Windows — `%APPDATA%\Relay Voice Community\`

`providers.json` contains operating-system-encrypted provider keys. The main process decrypts them when starting its local helper. The renderer receives only whether a key is configured. Keys belong to your login and are unsuitable for sharing between computers.

The `voice` subfolder stores settings and request history. History can contain your dictated words, answers and requested email context. Use Clear history in the app to remove its saved entries. Temporary audio is deleted after completion or cancellation. A crash or forced shutdown may leave a temporary recording in the operating-system temp folder.

The packaged app ignores keys inherited from the launching shell and does not load the original app's `.env` file or saved history. The standalone source backend retains explicit environment-file support for development. Keep development credentials outside source control.

## Provider services

Audio and relevant request context are sent to Gemini for transcription and answers. Web queries go to Firecrawl when you configure it. Requested Gmail context may be sent to Gemini to produce the answer. These services apply their own processing, retention and pricing terms.

Optional Google authentication stays in your Google Workspace CLI configuration. Relay does not bundle an account login. Its desktop controls offer requested email reads and unsaved reply previews.

The project configures no analytics service. Do not put raw audio, history, credentials or private screenshots into public bug reports.
