---
description: Stage 3 of 3 — catalog entry, DOM play-through, docs, full test run
model: haiku
argument-hint: <slug>
---
Wire up the game `$ARGUMENTS`: its `games.js` entry, the jsdom play-through test, the
`CLAUDE.md` updates, and the full test run.

If no slug was given, stop and ask for one.

Read `_ref/snippets.md` section 7 (data loading — for `bootGame`'s `data` argument) and the
*Adding a new game* field reference in `CLAUDE.md`. Do not open other games.

- Add **one** entry to `GAMES` in `games.js`. Its `accent` must differ from the entries 1, 2
  and 3 places above it. Reuse a `skills` spelling already in `games.js`; never coin a synonym.
- Add the play-through under `_tests/games/<slug>/`.
- Update `CLAUDE.md`: the *Current games* list, and any per-game list the game belongs to
  (data-driven games, rules-sheet games — a rules-sheet game also goes in
  `_tests/site/rules-sheet.test.js`).

Finish with a full `./_tests/run.sh` (exit 0), then remind the human to Commit and Sync.
