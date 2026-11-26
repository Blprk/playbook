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

## Features

- Sticky contents navigation with active-section highlighting
- Light and dark themes, remembered in local storage
- Search that filters the contents list
- Copy buttons on every prompt block
- Responsive down to small phones, keyboard focus states, reduced-motion support
- Clean print stylesheet

## Customising it

Design tokens live at the top of `styles.css`. Change the palette there rather than in individual rules.

Content lives in `index.html`. Each major section has an `id`; the contents navigation in the sidebar links to those ids, so add a matching link if you add a section.

## Deploying

Upload the directory to any static host, or connect it to a host that serves `index.html` from the repository root.
