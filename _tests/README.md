# `_tests/` — the offline test suite

Not part of the website. Never deployed, never reachable by URL.

## Running

```sh
./_tests/run.sh               # everything (installs jsdom on first run)
./_tests/run.sh site          # only site/*.test.js
./_tests/run.sh <slug>        # site/* plus games/<slug>/*
STRESS=quick ./_tests/run.sh  # fewer random samples (STRESS=deep: 5x more)
```

Node only. Nothing here is needed to build, serve, or open the site — the site itself
stays plain static files with no build step and no dependencies (CLAUDE.md rule 3).

## The one rule for tests

**A test never keeps its own copy of a game's code.** `lib/harness.js` slices the engine
out of the real `games/<slug>/index.html` at run time and boots the real page in jsdom, so
a passing test is a statement about the file the site actually ships. A copied engine
drifts silently from the game and starts proving nothing.

## Layout

```
lib/harness.js              ROOT resolution, loadEngine(), bootGame(), loadCatalog(), tally()
site/catalog.test.js        games.js + the hub, checked for every game in the catalog
site/conventions.test.js    the structural rules of CLAUDE.md, checked for every game
site/rules-sheet.test.js    the shared rules sheet, in the games that use it
games/<slug>/*.test.js      per-game: engine stress tests and jsdom play-throughs
```

`site/*` covers every game in the catalog and is what catches a broken new game earliest — a missing
`site.css` link, an off-scale age band, a redeclared `site.js` global, a stray third-party
host. Add to it rather than duplicating checks per game.

## Harness API

| helper | what it does |
|---|---|
| `loadEngine(slug)` | runs the game's inline script with no `document`, returns its `module.exports` |
| `bootGame(slug, {reducedMotion, seed, onError, data})` | boots the real page in jsdom with the browser bits jsdom lacks stubbed in; `data` (`{"words.json": parsed}`) answers a data-driven game's `loadGameData()` |
| `loadCatalog()` | the `GAMES` array out of `games.js` |
| `tally()` | `{ok, report, checks, fails}` — `report(name)` prints the count and sets the exit code |
| `mulberry32(seed)` | deterministic RNG, so a failure can be reproduced from its seed |

A game whose engine should be stress-tested needs one line at the end of its engine block:

```js
if (typeof module !== "undefined") module.exports = { newGame, applyMove, /* … */ };
```

Harmless in a browser (`module` is undefined there), and it is what lets `loadEngine()`
reach the real code. See `games/tic-tac-toe/index.html` for the pattern.

## Not carried over

Earlier scratch work for `mouse-maze` and `sneak-peek` was left behind: those scripts
tested a hand-copied duplicate of the game's logic, or needed a real browser via
puppeteer. If either game needs cover, add its `module.exports` line and write the test
against the real file.
