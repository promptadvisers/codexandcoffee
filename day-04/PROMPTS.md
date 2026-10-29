# Eight conversational planning prompts

Open the matching example folder so Codex can read the named inputs.

## 01 · a client intake desk

I run a small design agency. New client requests come in through email, and we keep chasing people for the same missing details.

Use the three fake enquiries in enquiries.md and the questions in intake-checklist.md.

Help me plan a simple page where I can review a request, see what is missing, and draft the next questions to ask.

Keep the first version local, with fake clients and no login or email connection. I want to review every draft before anything is sent.

Before you build anything, show me a short plan: what the page does, a few small build steps, and how we would check it. Point out any assumption that could change the plan.

## 02 · a newsletter workbench

I write a weekly newsletter for a small training company. Good ideas are scattered across notes, and starting a draft takes too long.

Use source-notes.md and voice-notes.md as the starting material. Keep a link back to the note behind each claim.

Plan a small tool where I can pick a topic, get a draft, and edit it beside the source notes.

For now, paste text in and export the draft. No web research, mailing-list connection or automatic publishing. Leave gaps visible instead of making up facts.

Show me the smallest useful version first, then the build steps and a couple of checks we can run. Hold off on coding until I have reviewed the plan.

## 03 · a service visit planner

I run a small maintenance company. Before each visit, the team needs to know the job, the access details and what to bring.

Use jobs.csv and visit-checklist.md. The customer names and addresses are made up.

Plan a browser page that shows upcoming visits and lets me open a clear job card with a checklist for each one.

Start with a CSV upload and one person using it. Leave out route optimisation, live tracking and customer messages. Flag missing access details.

Walk me through the first version in plain English. Break the build into a few steps and tell me what I should try to make sure it works. Do not build it yet.

## 04 · an invoice follow-up desk

I run a small consultancy. I want a clearer way to see which invoices need a follow-up without checking a spreadsheet row by row.

Use invoices.csv. Treat 10 May 2030 as the review date for this example, and show how you decide whether an invoice is overdue.

Plan a page where I can upload the file, see overdue unpaid invoices, and prepare a reminder for one selected invoice.

Do not connect to a bank, change accounting records or send messages. Flag missing dates and conflicting payment details for me to review.

Give me a short plan with the first screens, the build order and a few example checks. Ask about anything that would change the overdue rule before coding.

## 05 · a stock reorder board

I run a small shop. Some products run out unexpectedly, but I do not want a system placing orders for me.

Use stock.csv and reorder-rules.md. Keep the suggested quantities tied to those rules.

Plan a simple board that shows which items need attention and prepares a draft reorder list I can adjust.

Use one uploaded file for now. No supplier connection, automatic orders or demand predictions. If a rule or stock count is missing, flag it.

Show me what we can build first, what can wait, and how we will check the suggested reorder list. Stop at the plan so I can review it.

## 06 · a new-starter hub

I look after onboarding at a small company. New starters keep asking where things are and what they should do in their first week.

Use first-week.md and company-guide.md. Treat these as the source material, and point people back to the relevant section.

Plan a simple hub with a first-week checklist and a way to look up answers from the guide.

Use a fictional starter and sample policies. Leave out payroll, identity documents and employee performance. If the guide does not answer a question, say so.

Give me a short plan for the first version, including whether simple search would be enough. Then list the build steps and how we would check the answers before building.

## 07 · a support reply workbench

I run a small software support team. We spend too much time sorting similar questions and writing the same first reply.

Use tickets.csv and help-articles.md. Show which article supports each suggested reply.

Plan a workbench where we can filter tickets, read a suggested reply, and edit it before copying it out.

Keep everything in a local demo. Do not send replies, change customer accounts or promise refunds. If the articles do not cover the issue, mark it for a person.

Start with a short plan and a few build steps. Include checks for a normal question, an unclear question and one the articles cannot answer. Wait before coding.

## 08 · a site inspection report builder

I inspect commercial properties. After a visit, I spend too long turning rough notes and photos into a report the client can follow.

Use inspection-notes.md and report-outline.md. Photos can be placeholders in this first version.

Plan a phone-friendly page where I can add observations, group them by area, and preview a report before exporting it.

Keep the inspector’s wording and let me edit everything. Do not invent findings, certify compliance or diagnose hazards. Leave photo analysis and offline syncing for later.

Before building, show me a simple screen flow, a few small build steps and how we would check that no observation is lost in the report.
