# Model and execution guide

- GPT-6.1 Sol: start here to plan, build and coordinate workflows across tools and documents.
- GPT-6.1 Terra: writing, visual understanding and supported computer-use work.
- GPT-6 Luna: narrow, repeatable extraction, classification and summaries.
- GPT-6 Astra: difficult work with competing requirements and sustained judgment.
- GPT Image 2.6 Sunburst / Flare: specialized image generation and editing, where available. Codex can orchestrate the image tool; a text model is not the image generator.
- Ordinary code: arithmetic, validation, fixed routing rules and repeatable transformations.

One model is enough to start. Add a specialist only when it has a clear job. These are recommendations based on the official guidance, not a benchmark of these 180 tasks. Available models and tools depend on the account and client.

## Decisions API

The Decisions API currently supports gpt-6-luna. It returns probabilities, a fixed choice, or a score. It is not a guarantee of a correct interpretation. Your application applies tested thresholds and fixed routing rules, including a review route for uncertain, refused or invalid answers. Use ordinary code directly when the condition can be calculated exactly.

API access and billing are separate from selecting a model in Codex. Do not assume that a subscription grants a custom service unrestricted API access.

## Three ways to run work

1. On demand: ask Codex to complete a useful task from the current materials.
2. Scheduled: after testing the prompt, schedule a recurring review. For local project tasks, the machine and app must be running and the folder available.
3. Connected workflow: ask Codex to build the intake, integrations, checks and output. Confirm actual access; the system may need a hosted runtime for continuous operation.

Sources:
- https://learn.chatgpt.com/docs/models
- https://learn.chatgpt.com/docs/automations
- https://developers.openai.com/api/docs/guides/decisions
- https://developers.openai.com/api/docs/guides/image-generation
