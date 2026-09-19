---
description: Stage 1 of 3 — build a game's engine (generator/solver) and its engine test
model: opus
argument-hint: <slug> [what the game is]
---
Build the **engine** for the game `$ARGUMENTS`: its generator, solver or interpreter, plus
`_tests/games/<slug>/engine.test.js`. No HTML, no CSS, no UI — those are `/game-ui` and
`/game-wire`.

If no slug was given, stop and ask for one.

Read **only** `_ref/snippets.md` sections 8–9 and the *Tests* section of `CLAUDE.md`. Do not
open other games.

- Write pure, DOM-free functions, and end the engine block with the `module.exports` guard
  from snippets section 8.
- Wrap every random-sample iteration count in `stress(n)` — never a fixture, assertion or guard.
- Prefer correctness proofs over spot checks (every generated puzzle solvable, every claimed
  answer really correct, across thousands of samples).
- This stage does not economise: a wrong engine makes the other two stages worthless.

Stop when `./_tests/run.sh <slug>` exits 0.
