---
description: Stage 2 of 3 — build a game's page (HTML, CSS, wiring) against a finished engine
model: sonnet
argument-hint: <slug>
---
Build the **page** for the game `$ARGUMENTS` — HTML, CSS and event wiring in
`games/<slug>/index.html` — against the engine that `/game-engine` already wrote and tested.
Every design decision was settled there; this stage translates it into the site's conventions.

If no slug was given, stop and ask for one.

Read `_ref/snippets.md` (all of it) and the *Standard layout & controls* section of
`CLAUDE.md`. **Do not open other games** — the snippets are the reference.

Do not change the engine's logic. Stop before the DOM play-through test — that is `/game-wire`.
