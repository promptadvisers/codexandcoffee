# Day 14 prompts

Use a copy of the project folder. Model names are the choices used in the worked example. You can use models available in your account.

## Slide 9 · The prompt to build the sorter

Read OpenAI’s Decisions API guide first:
https://developers.openai.com/api/docs/guides/decisions

Build a small Request Sorter. I paste a request and it chooses Billing, Technical or Other. Use the documented model and choice format. Show the answer, confidence and queue. Below 0.80, on a refusal, or on an unexpected answer, use General review.

Keep the API key on a local server. Include clearly labeled replay examples for trying the screen without a key. Give me a short README explaining how to run both modes.

## Slide 10 · The prompt to check the behavior

Check the sorter with a clear billing request, a technical problem, a mixed request and unrelated text. Test an empty input, confidence just below 0.80, exactly 0.80, a refusal and an unexpected category.

Show which checks used replay data and which called the real API. Keep raw results. If live access is unavailable, say so. Give me the exact steps to run a live check later.

## Slide 23 · The request can stay plain English

Look through this QuickList folder. Explain what the app does, which file I should open, and how it saves my tasks. Keep the explanation short and use plain English.

## Slide 30 · The planning request

I want a small app called QuickList for keeping track of today's tasks. I should be able to add a task, mark it done, see what's left, and export my list as a text file. Keep the list when I close and reopen the app on this computer.

Plan the simplest version first. Save PLAN.md with the screen layout, three small build steps, and the checks that would show it works. Include a short handoff for another model to build from. Wait before writing the app.

## Slide 33 · The building request

Read PLAN.md and build QuickList. Follow the agreed layout and behavior. Use a single index.html file that works offline, with clear text and large controls. Keep the design simple in navy, cream and teal. Include the remaining count and text export.

Check adding tasks, completing them, reopening the page and exporting the list. Save a short BUILD.md that says what you made, how to open it, and which checks you actually ran. Keep the plan so the next model can use it.

## Slide 36 · Starting a fresh conversation

Read PLAN.md and BUILD.md, then inspect QuickList. Tell me what is already working, which checks still need to happen, and what you would do next. Use the files as your starting point. Wait before changing the app.

## Slide 37 · The review request

Review QuickList against PLAN.md. Try adding tasks, ticking and unticking them, reopening the app, and exporting the list. Include blank input and text with an apostrophe or emoji. Fix any problems you can demonstrate. Save REVIEW.md with the checks you ran, the results, and anything you could not test.

## Slide 40 · A small change to try

Add a priority flag to each task. Let me switch it on and off. Keep it when I reopen the app, and include it in the text export. Preserve the existing task text and completion state. Check both old and new tasks.

## Slide 45 · A request for a desktop version

Make a desktop version of QuickList for my Mac. I want to double-click the app and use it without installing developer tools. Keep the browser version too. Package a DMG and add a short README with installation and permission steps. Test a fresh launch and saved tasks. Explain which Mac type you built for and what would still need testing on Windows.
