# Retro and Retro Electro workshop

Open `practice-workspace` as a local Codex project. Its hidden `.agents/skills/` folder contains Retro, Retro Electro and a deliberately basic Brief Builder. No global installation is needed.

1. Read `session/transcript.md` and the related fictional source and final brief.
2. Send `prompts/review.txt` in a fresh chat. It reviews and leaves files unchanged.
3. Send `prompts/preview.txt` to inspect proposed changes without edits.
4. Use a clean workspace copy for `prompts/apply.txt`. That request authorizes changes to two named files.
5. Start a fresh chat in that changed copy and send `prompts/fresh.txt`. Inspect whether the new brief preserves proposals and conditions.

`$retro` and `$retro-electro` are skill mentions. `/retro` is not the documented Codex skill command. In the CLI or IDE, use `$` or `/skills` to select a skill. The text after the mention is normal user guidance. `mode=preview` and `mode=apply` are conventions defined by this skill, not native product flags.

A desktop picker check may be needed on your own account; CLI behavior was tested separately. If a new skill does not appear, restart Codex. Official guidance: https://learn.chatgpt.com/docs/build-skills

For class practice, use `prompts/practice.txt`, then review its proposed instruction against the source. The fresh check in `prompts/practice-test.txt` uses new facts. All examples are fictional. Nothing is emailed or published.

## When a skill folder is protected

The default Codex CLI workspace-write sandbox protects `.agents` recursively. A request to edit a skill does not itself change that technical permission. The workshop test used a temporary write grant to the one fictional Brief Builder directory, keeping all other access unchanged.

For a terminal-based local rehearsal, start inside a clean practice-workspace copy with:

```sh
codex --sandbox workspace-write --ask-for-approval on-request --add-dir "$PWD/.agents/skills/brief-builder"
```

Then paste the apply prompt. This is a command-line setup example; the mode text in the prompt remains our skill convention. No broad Full Access mode is required. Desktop permission controls depend on the client and were not separately rehearsed.

If applying an edit is blocked or slow during class, open `checkpoints/after-update` as the next project instead. It contains the actual verified updated guidance, with the original evidence and new test source. Run the fresh prompt there. This checkpoint changes the starting state; do not call it a live edit.
