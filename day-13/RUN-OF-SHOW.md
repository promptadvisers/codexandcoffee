# Day 13 · Rebuild an app with Codex

45 slides · 45 minutes

The prepared exercise chat is **Day 13 · Inspect and rebuild DemoPro**. Use the saved screenshots and results as the fallback for any live app step. The original DemoPro and the independent StageInk app are separate applications.

## 1. Rebuild an app with Codex
**0–0.5 minutes**

We will use an app I use when presenting. We will inspect its behavior, turn the observations into a plan, build our own Mac version and check the result.

**Show / do**

Show the visual, explain the relationship, and use the stated observation or example.

**Check**

Ask the group to identify the input, action and observable result.

**Source**

https://learn.chatgpt.com/docs/prompting

## 2. The app we are studying
**0.5–1.5 minutes**

DemoPro is the installed Mac annotation tool. Point out drawing, cursor and timer settings. These are actual captured app windows. The goal is to understand both what the controls look like and what they do.

**Show / do**

Open the three settings captures. Ask which features people recognize from a presentation tool.

**Check**

Identify drawing, cursor highlighting and the break timer.

**Source**

https://www.demoproapp.com/faq.html

## 3. Inspect appearance, behavior and code
**1.5–2.25 minutes**

The interface is the visible part of a program. The behavior includes its response to input, the modes it remembers and what happens when we change state. An independent implementation needs a clear description of those interactions.

**Show / do**

Point to the window, the interaction layer and the internals in the illustration. Ask what a screenshot alone can establish.

**Check**

Learners name a visible fact and a behavior that needs an interaction.

**Source**

https://learn.chatgpt.com/docs/prompting

## 4. The investigation and rebuild
**2.25–3.25 minutes**

Follow the same loop throughout the lesson. Observe the app, save a specification, make a plan, build in stages and compare. When a check fails, return to the evidence and refine the implementation.

**Show / do**

Trace the five steps. Explain that a failed comparison sends us back to the specification.

**Check**

The group can place a screenshot, a plan and a test result in the sequence.

**Source**

https://learn.chatgpt.com/docs/prompting

## 5. Observe the original
**3.25–3.5 minutes**

Start by making the target explicit. We are studying DemoPro 4.1 on this Mac, and recording the specific screens and behaviors we can inspect.

**Show / do**

Show the visual, explain the relationship, and use the stated observation or example.

**Check**

Ask the group to identify the input, action and observable result.

**Source**

https://learn.chatgpt.com/docs/prompting

## 6. Read the controls closely
**3.5–4.75 minutes**

A full screen capture preserves context. A close view makes the important controls readable. In this pane, inspect how a tool activates, the available colors, the width value and the command that clears the screen. A label alone does not establish what happens when it is used.

**Show / do**

Point to the full pane, then the enlarged activation and width controls. Keep the source capture visible.

**Check**

Identify the activation choice, width setting and drawing tools.

**Source**

https://learn.chatgpt.com/docs/prompting

## 7. The same tool has different states
**4.75–6 minutes**

The distinction between holding and toggling a key changes the interaction. In hold mode, releasing ends drawing. In toggle mode, another press ends drawing. The app underneath must receive input again at the correct time.

**Show / do**

Mime holding a key and releasing it, then pressing once and pressing again. Describe these as documented modes.

**Check**

Ask when the app underneath should regain the pointer.

**Source**

https://www.demoproapp.com/faq.html

## 8. Ask Codex to inspect the app · 1 of 2
**6–6.75 minutes**

This is a teaching prompt for the next interaction. Its wording is supplied for reuse. The test report identifies which underlying actions were actually completed.

**Show / do**

Read this prompt on screen. The complete copyable version is in the learner kit and the HTML viewer.

**Check**

Point out the requested outcome, the evidence to collect and the proposed check.

**Source**

https://learn.chatgpt.com/docs/prompting

**Complete prompt**

```text
Use Computer Use to inspect DemoPro on this Mac. Go through every settings tab, menu, drawing tool and visible mode. Capture clean screenshots. For each feature, record how I start it, what changes on screen, and how I exit it. Try the main drawing actions on a harmless sample screen. Pay attention to spacing, colours, line widths, shortcuts, and switching back to the application underneath. Separate what you observed from anything you inferred. Save an illustrated feature inventory and a list of anything you could not test.
```

## 9. Ask Codex to inspect the app · 2 of 2
**6.75–7.5 minutes**

This is a teaching prompt for the next interaction. Its wording is supplied for reuse. The test report identifies which underlying actions were actually completed.

**Show / do**

Read this prompt on screen. The complete copyable version is in the learner kit and the HTML viewer.

**Check**

Point out the requested outcome, the evidence to collect and the proposed check.

**Source**

https://learn.chatgpt.com/docs/prompting

**Complete prompt**

```text
Use Computer Use to inspect DemoPro on this Mac. Go through every settings tab, menu, drawing tool and visible mode. Capture clean screenshots. For each feature, record how I start it, what changes on screen, and how I exit it. Try the main drawing actions on a harmless sample screen. Pay attention to spacing, colours, line widths, shortcuts, and switching back to the application underneath. Separate what you observed from anything you inferred. Save an illustrated feature inventory and a list of anything you could not test.
```

## 10. The feature inventory
**7.5–8.5 minutes**

An inventory groups visible controls into behavior we can check. It also records uncertainty instead of inventing details about the internals.

**Show / do**

Use one row to turn a control into an observation to collect. Record unknown behavior as untested.

**Check**

Each proposed requirement has a visible action or result.

**Source**

https://www.demoproapp.com/faq.html

## 11. One action, one visible result
**8.5–9.75 minutes**

Use the original timer as a verified example. Starting it changed the display from 10:00 to 9:56. Pause stopped the countdown and reset restored the configured duration. The drawing hotkeys could not be activated through our current Computer Use route, so that interaction remains unverified.

**Show / do**

Show the captured 9:56 timer, then explain the recorded start, pause and reset checks.

**Check**

The changed time is evidence of a running timer. Drawing activation remains unverified.

**Source**

https://learn.chatgpt.com/docs/prompting

## 12. Turn behavior into repeatable checks
**9.75–10.75 minutes**

This is a teaching prompt for the next interaction. Its wording is supplied for reuse. The test report identifies which underlying actions were actually completed.

**Show / do**

Read this prompt on screen. The complete copyable version is in the learner kit and the HTML viewer.

**Check**

Point out the requested outcome, the evidence to collect and the proposed check.

**Source**

https://learn.chatgpt.com/docs/prompting

**Complete prompt**

```text
Watch what happens when I enter drawing mode, draw an arrow, return to the app underneath, and clear the arrow. Repeat using the other activation mode. Write down each starting state, action and visible result. Turn those observations into checks we can repeat on our own app.
```

## 13. Choose the inspection tools
**10.75–11 minutes**

Some questions are answered by operating the interface. Others require files, package metadata or code analysis. Choose the tool for the fact you need.

**Show / do**

Show the visual, explain the relationship, and use the stated observation or example.

**Check**

Ask the group to identify the input, action and observable result.

**Source**

https://learn.chatgpt.com/docs/prompting

## 14. How Computer Use inspects an app
**11–12.25 minutes**

Codex reads the app state and screenshot, chooses an action, then observes the result. Repeating this loop provides an interaction record. The operating system and the app permissions determine what it can control.

**Show / do**

Walk around the four boxes once with the example of pressing Start on the timer.

**Check**

Ask what Codex must observe after the click.

**Source**

https://learn.chatgpt.com/docs/computer-use

## 15. REA connects Codex to analysis tools
**12.25–13.5 minutes**

REA is an MCP server and command-line tool. It connects the coding agent to inspection engines and returns evidence. MCP is the interface that lets the agent request a named tool and read its result.

**Show / do**

Expand MCP as Model Context Protocol. Trace a request through REA and the result back to Codex.

**Check**

Learners identify REA as the connection to inspection tools.

**Source**

https://github.com/morluto/rea

## 16. Why REA attracted attention
**13.5–14.75 minutes**

The GitHub API snapshot records 451,542 stars on 11 November 2026. Star counts measure repository attention. Our explanation of appeal is an interpretation of the documented features: a familiar coding-agent interface, many target types and runnable examples. We do not have causal analytics proving which feature drove growth.

**Show / do**

Show the dated star count and describe the three possible reasons. Separate the measured count from the explanation.

**Check**

The repository count is sourced; the popularity explanation is an interpretation.

**Source**

https://github.com/morluto/rea

## 17. Match the tool to the question
**14.75–16.25 minutes**

Read the questions first. Computer Use supplies interaction evidence. Static app inspection supplies metadata and files. Disassemblers and decompilers read native machine code. Runtime tools reveal selected live behavior. Each answers a different question.

**Show / do**

Ask the class to choose a tool for a hidden calculation rule, then for a button whose behavior is unclear.

**Check**

Match internal-code questions to analysis tools and visible-interaction questions to Computer Use.

**Source**

https://github.com/morluto/rea/blob/main/docs/reverse-engineering-tools.md

## 18. What sits inside the application
**16.25–17.25 minutes**

An app bundle contains the executable and its supporting resources. The executable links to system frameworks. REA can inspect these declarations before any deeper code analysis.

**Show / do**

Show the visual, explain the relationship, and use the stated observation or example.

**Check**

Ask the group to identify the input, action and observable result.

**Source**

Local REA metadata inspection

## 19. Reading compiled code
**17.25–18.5 minutes**

An executable contains machine instructions. A disassembler exposes those instructions. A decompiler proposes a code-like representation. The agent uses calls, strings and observed results to interpret what it finds. The reconstructed explanation must still be checked.

**Show / do**

Show the visual, explain the relationship, and use the stated observation or example.

**Check**

Ask the group to identify the input, action and observable result.

**Source**

https://github.com/morluto/rea/blob/main/docs/guides/native/native-investigation.md

## 20. REA’s published Calculator example
**18.5–19.5 minutes**

REA’s published Calculator case study traced the percentage handler. After addition, the percentage is taken from the first number. After multiplication, it converts the current number to a fraction. This is the project author’s published example, not a run we performed in this lesson.

**Show / do**

Show the visual, explain the relationship, and use the stated observation or example.

**Check**

Ask the group to identify the input, action and observable result.

**Source**

https://rea.tools/#calculator

## 21. Trace the rule, then test it
**19.5–20.5 minutes**

The published investigation follows the operator branch, names the values and checks the reconstructed result. Reading code becomes useful when it resolves a specific behavior question.

**Show / do**

Show the visual, explain the relationship, and use the stated observation or example.

**Check**

Ask the group to identify the input, action and observable result.

**Source**

https://rea.tools/#calculator

## 22. What REA found in DemoPro
**20.5–21.75 minutes**

These facts came from actual local REA inspection commands. Mach-O is the executable format used by this Mac application. The package declares version 4.1. Native dependency inspection finds the listed frameworks. This tells us about packaging and dependencies, not every internal function.

**Show / do**

Open the saved metadata results if anyone wants to see the raw output. Point to version, processors and frameworks.

**Check**

The facts match the saved local REA results.

**Source**

Local REA inspect-macho, inspect-plist and decode-interface-builder results in production/research

## 23. A missing engine limits deeper analysis
**21.75–22.5 minutes**

Our basic metadata inspections worked. The deeper inspect request reported that Ghidra, Hopper and IDA were unavailable. Keep that limit visible. We can still build from observed behavior, while internal function analysis remains unverified.

**Show / do**

Show the three statuses. Explain that this exercise continued using observed behavior and metadata.

**Check**

Do not describe an internal DemoPro function as recovered.

**Source**

Local REA inspect result and doctor diagnostics

## 24. Ask REA a focused question
**22.5–23.25 minutes**

This is a teaching prompt for the next interaction. Its wording is supplied for reuse. The test report identifies which underlying actions were actually completed.

**Show / do**

Read this prompt on screen. The complete copyable version is in the learner kit and the HTML viewer.

**Check**

Point out the requested outcome, the evidence to collect and the proposed check.

**Source**

https://learn.chatgpt.com/docs/prompting

**Complete prompt**

```text
Use REA to inspect DemoPro on this Mac. Tell me its version, supported processor types and native frameworks. Show which tool returned each fact. Then check whether deeper native-code analysis is available. If a required engine is missing, explain exactly what remains unknown. Save the findings so we can use them in a rebuild plan.
```

## 25. Write the plan
**23.25–23.5 minutes**

The next prompt converts recorded evidence into an implementable plan. We save that plan so the build has explicit behavior and checks.

**Show / do**

Show the visual, explain the relationship, and use the stated observation or example.

**Check**

Ask the group to identify the input, action and observable result.

**Source**

https://learn.chatgpt.com/docs/prompting

## 26. Turn observations into a specification
**23.5–24.75 minutes**

Translate each observation into a requirement and a test. This is where vague imitation becomes a small engineering task. The example rows describe interaction outcomes rather than an internal implementation we cannot see.

**Show / do**

Pick the timer row. Ask what evidence would prove it works and what the reset action should show.

**Check**

A requirement names a repeatable result.

**Source**

https://www.demoproapp.com/faq.html

## 27. Ask for a plan before code · 1 of 2
**24.75–25.5 minutes**

This exact prompt was sent to the prepared exercise chat. Open the saved prompt and resulting plan or build record after reading it.

**Show / do**

Read this prompt on screen. The complete copyable version is in the learner kit and the HTML viewer.

**Check**

Compare the request with the saved result in the exercise chat.

**Source**

https://learn.chatgpt.com/docs/prompting

**Complete prompt**

```text
Use the DemoPro observations to plan a small Mac app I can use during a presentation. List the screens, drawing modes, keyboard controls and saved settings. Explain what each part will do in plain English. Build in stages so I can try drawing first, then switching back to the app underneath, then shapes and the timer. For every stage, say how we will check that it works. Show which parts of the plan are supported by observations and which are design choices. Save the plan before writing the application.
```

## 28. Ask for a plan before code · 2 of 2
**25.5–26.25 minutes**

This exact prompt was sent to the prepared exercise chat. Open the saved prompt and resulting plan or build record after reading it.

**Show / do**

Read this prompt on screen. The complete copyable version is in the learner kit and the HTML viewer.

**Check**

Compare the request with the saved result in the exercise chat.

**Source**

https://learn.chatgpt.com/docs/prompting

**Complete prompt**

```text
Use the DemoPro observations to plan a small Mac app I can use during a presentation. List the screens, drawing modes, keyboard controls and saved settings. Explain what each part will do in plain English. Build in stages so I can try drawing first, then switching back to the app underneath, then shapes and the timer. For every stage, say how we will check that it works. Show which parts of the plan are supported by observations and which are design choices. Save the plan before writing the application.
```

## 29. The saved build plan
**26.25–27.75 minutes**

Walk through the actual plan produced in the exercise chat. Each stage leaves a running program and has a check. Explain any design decision that differs from the original and point to the evidence it uses.

**Show / do**

Open BUILD-PLAN.md in the prepared exercise chat. Walk through the four stages and their checks.

**Check**

The plan exists before the build source in the exercise record.

**Source**

https://learn.chatgpt.com/docs/prompting

## 30. Keep a working version at each stage
**27.75–28.75 minutes**

A saved working stage lets you compare and return if the next change fails. Use a local commit or the project’s normal checkpoint process. The practical point is knowing which version produced which observed result.

**Show / do**

Show the checkpoints folder from the exercise. Explain which build corresponds to which test.

**Check**

A reported result can be linked to a saved stage.

**Source**

https://learn.chatgpt.com/docs/prompting

## 31. Build and inspect
**28.75–29 minutes**

Move from the plan to the small app. The exercise uses an independent Mac implementation and checks each stage through its normal controls.

**Show / do**

Show the visual, explain the relationship, and use the stated observation or example.

**Check**

Ask the group to identify the input, action and observable result.

**Source**

https://learn.chatgpt.com/docs/prompting

## 32. Ask Codex to build in stages · 1 of 2
**29–29.75 minutes**

This exact prompt was sent to the prepared exercise chat. Open the saved prompt and resulting plan or build record after reading it.

**Show / do**

Read this prompt on screen. The complete copyable version is in the learner kit and the HTML viewer.

**Check**

Compare the request with the saved result in the exercise chat.

**Source**

https://learn.chatgpt.com/docs/prompting

**Complete prompt**

```text
Build a Mac application from the observed specification and saved plan. Give it its own name and use original code and artwork. Start with a transparent drawing layer and a clear way to switch between drawing and using the app underneath. Then add the observed pen, shapes, colours, undo and clear controls. Add the board and timer in separate stages. Keep each working stage so we can compare it with the next. After each stage, launch the app and test the actual behavior. Keep a record of what works, what failed and what remains incomplete.
```

## 33. Ask Codex to build in stages · 2 of 2
**29.75–30.5 minutes**

This exact prompt was sent to the prepared exercise chat. Open the saved prompt and resulting plan or build record after reading it.

**Show / do**

Read this prompt on screen. The complete copyable version is in the learner kit and the HTML viewer.

**Check**

Compare the request with the saved result in the exercise chat.

**Source**

https://learn.chatgpt.com/docs/prompting

**Complete prompt**

```text
Build a Mac application from the observed specification and saved plan. Give it its own name and use original code and artwork. Start with a transparent drawing layer and a clear way to switch between drawing and using the app underneath. Then add the observed pen, shapes, colours, undo and clear controls. Add the board and timer in separate stages. Keep each working stage so we can compare it with the next. After each stage, launch the app and test the actual behavior. Keep a record of what works, what failed and what remains incomplete.
```

## 34. How our drawing layer works
**30.5–31.75 minutes**

A transparent window sits above the content. In drawing mode it receives pointer input and stores the drawing. In pointer mode the underlying app receives input. The design needs to handle the switch without losing or trapping the pointer.

**Show / do**

Show the visual, explain the relationship, and use the stated observation or example.

**Check**

Ask the group to identify the input, action and observable result.

**Source**

Independent implementation design from the saved plan; original activation controls were inspected

## 35. The app and its drawing components
**31.75–33.25 minutes**

The left image is the actual StageInk palette. The right image was rendered by a component test using the production drawing code. Twenty focused checks passed for drawing data, rendering, undo, clear, persistence and timer logic. Desktop mouse delivery remains unverified through Computer Use.

**Show / do**

Open StageInk from the rebuild folder or show the final capture. Use only the actions marked verified in the results.

**Check**

The app is launched and the named visible control changes are supported by evidence.

**Source**

https://learn.chatgpt.com/docs/prompting

## 36. When the test cannot reach the canvas
**33.25–34.75 minutes**

Use a recorded issue or explicit comparison gap from the exercise. State the expected result, the observed result, and the next check. If no reproducible defect remains, use the documented limitation and show why it remains unverified.

**Show / do**

Read the expected input and the observed tool error. Explain why a failed input delivery cannot prove whether drawing logic works.

**Check**

Separate the input-routing limitation from a demonstrated application defect.

**Source**

https://learn.chatgpt.com/docs/prompting

## 37. Ask for a focused correction
**34.75–35.5 minutes**

This is a teaching prompt for the next interaction. Its wording is supplied for reuse. The test report identifies which underlying actions were actually completed.

**Show / do**

Read this prompt on screen. The complete copyable version is in the learner kit and the HTML viewer.

**Check**

Point out the requested outcome, the evidence to collect and the proposed check.

**Source**

https://learn.chatgpt.com/docs/prompting

**Complete prompt**

```text
Reproduce the problem using the same screen and actions. Explain which behavior differs from the specification. Fix the cause, then repeat that check and the nearby drawing controls. Show the result and tell me what still needs testing.
```

## 38. Compare the results
**35.5–35.75 minutes**

Use the same starting screen and input sequence on both programs. Then compare appearance and behavior separately.

**Show / do**

Show the visual, explain the relationship, and use the stated observation or example.

**Check**

Ask the group to identify the input, action and observable result.

**Source**

https://learn.chatgpt.com/docs/prompting

## 39. Compare the same timer actions
**35.75–37.25 minutes**

Compare the original and rebuilt timer. Use the same duration and check start, pause and reset. A countdown provides a visible behavior comparison. Desktop drawing needs its own input check; the timer result does not establish drawing equivalence.

**Show / do**

Show both captured timers. Compare start, pause and reset using the verification record.

**Check**

A matching time display alone is insufficient; inspect the sequence of actions.

**Source**

https://learn.chatgpt.com/docs/prompting

## 40. Ask for an evidence-based review · 1 of 2
**37.25–38 minutes**

This exact prompt was sent to the prepared exercise chat. Open the saved prompt and resulting plan or build record after reading it.

**Show / do**

Read this prompt on screen. The complete copyable version is in the learner kit and the HTML viewer.

**Check**

Compare the request with the saved result in the exercise chat.

**Source**

https://learn.chatgpt.com/docs/prompting

**Complete prompt**

```text
Launch each working stage and test it through its normal visible controls. Verify drawing, switching to the underlying harmless fixture, every shape, colors, width, undo, clear, whiteboard, blackboard and the break timer. Record exact passes, failures and untested behavior. If Computer Use cannot deliver input to a window, retain the exact error and run separately labeled tests of the actual event handlers and saved data. Do not mark those tests as end-to-end UI passes. Package the runnable app, editable source and evidence.
```

## 41. Ask for an evidence-based review · 2 of 2
**38–38.75 minutes**

This exact prompt was sent to the prepared exercise chat. Open the saved prompt and resulting plan or build record after reading it.

**Show / do**

Read this prompt on screen. The complete copyable version is in the learner kit and the HTML viewer.

**Check**

Compare the request with the saved result in the exercise chat.

**Source**

https://learn.chatgpt.com/docs/prompting

**Complete prompt**

```text
Launch each working stage and test it through its normal visible controls. Verify drawing, switching to the underlying harmless fixture, every shape, colors, width, undo, clear, whiteboard, blackboard and the break timer. Record exact passes, failures and untested behavior. If Computer Use cannot deliver input to a window, retain the exact error and run separately labeled tests of the actual event handlers and saved data. Do not mark those tests as end-to-end UI passes. Package the runnable app, editable source and evidence.
```

## 42. What the actual checks show
**38.75–40.25 minutes**

Read the actual verification record. A pass needs a matching visible or recorded result. A failure needs reproduction steps. An untested item stays explicit until the required environment or interaction is available.

**Show / do**

Read the final test table. Explain the difference between a component check and an end-to-end desktop interaction.

**Check**

Every pass, failure and untested item has supporting evidence.

**Source**

Actual exercise verification report

## 43. Make one deliberate improvement
**40.25–41.25 minutes**

This is a teaching prompt for the next interaction. Its wording is supplied for reuse. The test report identifies which underlying actions were actually completed.

**Show / do**

Read this prompt on screen. The complete copyable version is in the learner kit and the HTML viewer.

**Check**

Point out the requested outcome, the evidence to collect and the proposed check.

**Source**

https://learn.chatgpt.com/docs/prompting

**Complete prompt**

```text
Add an option that fades a drawing after five seconds. Keep the existing manual clear option. Test a single drawing, several drawings made at different times, and leaving drawing mode while a fade is pending. Show the result before calling it complete.
```

## 44. Choose your next application
**41.25–44.25 minutes**

Give the group three minutes to choose one app and one feature. Ask them to write the action, expected result, useful reference screen and first check. In a quiet room, use a simple screenshot-cropping tool as the worked example and speak through the four decisions.

**Show / do**

Give people three minutes to choose an app and one feature. In a quiet room, work through a screenshot-cropping tool using the four fields.

**Check**

Each learner has a feature, a source of evidence and a repeatable first check.

**Source**

https://learn.chatgpt.com/docs/prompting

## 45. Keep the evidence with the build
**44.25–45 minutes**

Finish with the recorded observation, specification, plan, source and checks. The learner kit keeps the pieces together so people can repeat the method on their own Mac.

**Show / do**

Show the learner kit and the prepared exercise chat. Point to the prompts, plan, source and test report.

**Check**

Learners know where to start and where to find the observed limits.

**Source**

https://learn.chatgpt.com/docs/prompting
