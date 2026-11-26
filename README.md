# The Agent's Field Manual

A static, dependency-free website presenting a beginner-friendly guide to prompting an AI coding agent, with a practical focus on building dashboards.

The guide covers 23 habits, a dashboard playbook, copy-paste prompt templates, a working loop, and checklists. It is written for someone who has never directed an agent before.

## View it

Open `index.html` in a browser. That's it. No install, no build step, no server required.

If you prefer a local server:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## What's here

| File | Purpose |
|---|---|
| `index.html` | All guide content and page structure |
| `styles.css` | Design tokens, layout, responsive rules, print styles |
| `app.js` | Theme toggle, contents navigation, search filter, copy buttons |

## How the guide is organised

The content is split into seven chapters: foundations (23 habits), a dashboard playbook (12 rules and 5 war stories, including a prompt for mapping implicit UI state machines), a technique toolkit (32 methods filterable by level), a prompt library (14 prompts filterable by job), a practice lab (prompt composer and knowledge check), further reading with an honest look at prompt optimizers, and a working loop with checklists and a one-screen cheat sheet. Long sections are accordions, so the page scans as a table of contents before you open anything.

The reading list links to primary sources — Anthropic's and OpenAI's prompting docs, Learn Prompting, the Prompt Report — and to evaluation and optimizer tooling such as DSPy, Promptfoo, Langfuse and Braintrust. Tool names and ownership change quickly; the guide says so and points to current documentation.

## Features

- Full-text search across every habit, rule, story, and template; matching sections open automatically
- Category filters for the prompt library and level filters for the technique toolkit
- A "surprise me" button that opens a random technique
- A prompt composer that builds tagged prompts or a metaprompt from your answers
- A five-question knowledge check with instant explanations
- Copy-all for the visible prompt library
- Expand-all and collapse-all controls
- Interactive checklists saved in local storage, with a reset control
- Reading progress, active-section highlighting, and a back-to-top button
- Light and dark themes that respect the system preference on first visit, then remember your choice
- Copy buttons on every prompt, with screen-reader announcements
- Keyboard support: `/` focuses search, `Escape` clears it, `n` and `p` move between collapsed sections, and all accordions are native `<details>` elements
- Responsive down to small phones, with a toggleable contents panel
- Reduced-motion support, visible focus states, and a print stylesheet that opens every section
- Lighthouse scores of 100 for accessibility, best practices, and SEO in both themes

## Customising it

Design tokens live at the top of `styles.css`. Change the palette there rather than in individual rules.

Content lives in `index.html`. Each major section has an `id`; the contents navigation in the sidebar links to those ids, so add a matching link if you add a section.

## Deploying

Upload the directory to any static host, or connect it to a host that serves `index.html` from the repository root.
