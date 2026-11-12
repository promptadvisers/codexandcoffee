# Day 14 · Fast decisions and Codex workflows

A standalone 45-minute workshop with 51 slides. Start with OpenAI’s Decisions API and a small request sorter, then work through CLI versus chat, model handoffs, and opening or installing an app.

## Downloads

- [PowerPoint slides](https://github.com/promptadvisers/codexandcoffee/raw/refs/heads/main/day-14/Day-14.pptx)
- [Learner kit](https://github.com/promptadvisers/codexandcoffee/raw/refs/heads/main/day-14/Day-14-Learner-Kit.zip)
- [Exact prompts](PROMPTS.md)

Extract the learner kit and open its `START-HERE.md`. It includes the QuickList browser app, a practice copy, planning and review examples, and the Request Sorter’s local server and README.

## Decisions API example

The Request Sorter chooses Billing, Technical or General review. Its fixed routing rule sends uncertain or unexpected answers to General review. The 0.80 threshold is an illustrative classroom choice. Evaluate labeled examples before selecting a threshold for real use.

Replay mode uses clearly labeled authored answers and needs no API key. Live mode needs your own OpenAI API key configured on the local server. The server keeps the key out of the browser.

The example passed 17 local assertions and six replay browser/HTTP checks. These checks cover the app’s routing and user flow. No live API call or model accuracy/latency test was performed during preparation because a key was unavailable.

## QuickList example

Separate Codex conversations used GPT-6.1 Terra for a plan, GPT-6.1 Sol for the app, and GPT-6 Astra for review. These model assignments are an example, with no comparative performance claim. A separate Chromium run passed nine browser checks. The model reviewer’s blocked browser attempt and its logic simulation are labeled in the kit.

QuickList runs as a local browser file. Its desktop packaging prompt is a follow-on exercise. Browser storage can vary by browser, so use the text export to keep a copy of your tasks.

## Relay Voice installation

[Mac and Windows downloads, source and setup](../day-13/relay-voice/README.md)

## Official documentation

- [Decisions API guide](https://developers.openai.com/api/docs/guides/decisions)
- [Create a decision](https://developers.openai.com/api/reference/resources/decisions/methods/create)
- [Codex CLI](https://developers.openai.com/codex/cli)
- [Projects](https://learn.chatgpt.com/docs/projects)
- [Model selection](https://learn.chatgpt.com/docs/models)
