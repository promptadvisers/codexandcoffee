# Optional Gmail setup

Gmail is an advanced integration. Ordinary dictation requires only the Gemini key entered in Settings.

Install the [Google Workspace CLI](https://github.com/googleworkspace/cli), then complete its OAuth setup and Gmail read-only login using an account you control. Follow the CLI's current setup documentation. Restart Relay after installing command-line tools so it can discover them.

The **Primary** choice uses the CLI's default profile. Authenticate **Work** or **Personal** with `GOOGLE_WORKSPACE_CLI_CONFIG_DIR` set to the corresponding directory before running the CLI's login command.

- Work — `~/.config/relay-voice/google-workspace/work`
- Personal — `~/.config/relay-voice/google-workspace/personal`

On Windows, `~` means your user home directory. Keep these profiles private. Relay shows an explicit provider check in Settings. That check reads the primary Gmail profile when configured.

The packaged app accepts provider keys through Settings. Advanced environment-file overrides in `.env.example` apply to the standalone Python backend. They are retained for source development and tests.
