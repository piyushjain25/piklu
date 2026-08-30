# CLAUDE.md — project guide for Claude Code

This is a **static website of free educational games for kids** (plain HTML/CSS/JS, no
build step, no framework). It is hosted on GitHub Pages today and will grow into an
online toy store later. Read the rules below before changing anything.

## Golden rules (do not break these)

1. **Game URLs are permanent.** Every game lives at `/games/<slug>/` and must stay
   there forever. Never rename or move a game's folder, and never change a `slug`.
   People and (future) store pages will link to these URLs.
2. **The root `index.html` is reserved for the future store.** It currently just
   redirects to `/games/`. Don't put game content in it. When the store is built, the
   store home replaces this file and everything under `/games/` stays untouched.
3. **No build step, no dependencies, no tooling.** Keep it plain static files. Use
   **relative** paths. Do not add bundlers, package managers, frameworks, or a
   `node_modules` requirement to run the site. Most games work when opened directly
   (`file://`) *and* when hosted — but **games that load a data file via `fetch()` only
   work when served** (a browser blocks local `fetch()` under `file://`). That's an
   accepted exception for data-driven games: preview them on the hosted site or a local
   static server, not by double-clicking the file. **Don't add an embedded/inline copy of
   the data as a fallback** for when the `fetch()` fails — that duplicates the dataset in
   two places and lets it silently drift out of sync. If the fetch fails, the game is
   simply not playable (`word-guess`, `guess-the-capital`, `spell-a-bee`); that's expected,
   not a bug.
4. **Each game is one file plus three shared assets.** The game's own CSS and JS are
   **inline** in a single `games/<slug>/index.html` — don't split *game-specific* code
   into extra files. Every game also links three things from `/assets/` that must never be
   copy-pasted into a game's own `<style>`/`<script>`: `assets/site.css` (the shared design
   system — see "Standard layout & controls"), `assets/site.js` (the shared JS helpers —
   see "Shared JS helpers"), and the Google Fonts stylesheet. A game **may** keep
   **data** in a sibling file in the same folder (e.g. `words.json`, `capitals.json`).
   **That file must be plain JSON — no other format is supported** (no `.js` data file
   assigning a `window.X = {...}` global, no embedding the data inline in `index.html`).
   Load it with the shared `loadGameData(path)` helper from `assets/site.js` (see "Shared
   JS helpers") using a **relative** path (e.g. `loadGameData('words.json')`) — keep the
   data next to that game's `index.html` so the game stays portable. The only allowed
   external network calls are Google Fonts and (for a couple of games) `cdnjs.cloudflare.com`.
5. **Keep it kid-safe and ad-free.** Age-appropriate content and friendly tone only.
   No ads, no analytics/tracking, no third-party trackers, no data collection.

## How the site is organised

```
/                       root — redirects to /games/ (future store home)
/games.js               THE CATALOG — single source of truth for the game list
/assets/site.css        shared styles — hub layout AND the shared game-page design
                        system (colours, owl, buttons, topbar/tlink/level-switch, etc.)
/assets/site.js         shared JS helpers every game links before its own inline script
                        ($, reduceMotion, flash, setOwl, level-menu, beep, confetti, title,
                        loadGameData for JSON data files)
/games/index.html       the hub — auto-builds the grid from /games.js
/games/<slug>/index.html   one game per folder; game-specific CSS/JS inline, links site.css
/games/<slug>/*.json        (optional) data a game loads via relative fetch(), e.g. words.json
/CLAUDE.md              this file
```

## Adding a new game (the ONLY supported way)

Two steps — never edit the hub's HTML or CSS to add a game:

1. Create the game at `games/<slug>/index.html` (code inline, following the
   conventions below). `<slug>` is lowercase words joined by hyphens, e.g. `shape-sorter`.
   In `<head>`, link the Google Fonts stylesheet **and** `<link rel="stylesheet"
   href="../../assets/site.css" />`, and give `<body>` the class `game`
   (`<body class="game">`) — that's what pulls in the shared design system and control
   scheme. Right before the game's own `<script>` (after the `<canvas id="confetti">`),
   add `<script src="../../assets/site.js"></script>` — it defines globals
   (`$`, `reduceMotion`, `flash`, `setOwl`, `wireLevelMenu`, `beep`, `stopConfetti`,
   `initBouncyTitle`, …; see "Shared JS helpers") that the game's inline script calls
   directly, unqualified. Never redeclare any of those names in the game's own script.
   Only put a rule in the game's own `<style>` if it's genuinely unique to that
   game (colors, a `.app{max-width}` / `.title{font-size}` override, one-off components);
   never re-declare something `site.css` already defines. If the game needs a data set
   (word list, capitals, etc.), put the JSON in the **same folder** and load it with a
   relative `fetch()` (see rules 3–4 — such a game must be viewed on the hosted site or a
   local server, not via `file://`).
2. Add **one entry** to the `GAMES` array in `games.js`:

   ```js
   { slug: "shape-sorter", title: "Shape Sorter", emoji: "🔷", accent: "sky", ageGroup: "5+",
     tagline: "Sort the shapes into the right bins.", skills: ["Shapes"], badge: "New" },
   ```

   Field reference:
   - `slug` (required) — folder name; becomes the URL `/games/<slug>/`. Must be unique.
   - `title`, `tagline`, `emoji` (required) — shown on the card.
   - `accent` (required) — one of `grape | coral | leaf | sun | sky`.
   - `ageGroup` (required) — recommended starting age, shown on the card as `Age: X+` (e.g. `"6+"`).
     This is a **hub-only** label — never shown inside the game itself.
   - `skills` (optional) — tags shown on the card and used by the hub's search.
   - `badge` (optional) — small ribbon like `"New"`; omit for none.

The card, its link, and the search filter appear automatically.

## Game conventions (match the existing games)

- **Design system:** display font **Fredoka**, body font **Nunito** (Google Fonts).
  Palette: grape `#6C4AB6`, coral `#FF6B7A`, leaf `#2FB37D`, sun `#FFCF43` /
  `#e6a800`, sky `#3FA7E0`, ink `#33236B`; sky→green background with floating clouds.
  Reuse the **owl mascot** SVG with mood states (idle / happy / worried / win / think).
  All of this — colours as CSS vars, the owl mood CSS, `.btn`/`.card`/`.chip`/`.diff`
  etc. — is defined once in `assets/site.css` and shared by every game via `<link>`; a
  game only adds its own extra CSS vars (theme colors like `--paper`) and components.
- **Four difficulty levels** — `EASY`, `MEDIUM`, `HARD`, `EXPERT` — each meaningfully
  different. Exception: `guess-the-capital` has no difficulty levels — it's purely a
  choice of game (Indian States vs World Countries), so it has no level chip at all (see
  below).
- **Endless and score-free.** No points, no lives, and **no per-game streak** (a single
  combined streak across all games will be added at the site level later — do not add a
  🔥 streak inside a game). Reward with stars, confetti, and sounds. Exception:
  `word-guess` is a hangman-style game where wrong guesses are the core mechanic, so it
  keeps its 10 letter hearts + 3 word stars — these decide whether the round is won or
  lost, they are not a score or a streak.
- **Feel:** juicy and encouraging — meters, star ratings, confetti canvas, gentle
  WebAudio beeps.
- **Accessibility:** respect `prefers-reduced-motion` (guard all animation/sound),
  support keyboard where sensible, keep good colour contrast, use `aria-pressed` on the
  difficulty cards. Never rely on colour alone to signal correctness (avoid answer
  "tells" — e.g. the submit button must look the same whether the current answer is
  right or wrong).
- Don't use `localStorage`/`sessionStorage` unless asked; keep state in memory.

## Standard layout & controls (REQUIRED — match `games/pizza-party/index.html`)

`games/pizza-party/index.html` is the reference implementation. Every game must use this
exact control scheme. The CSS for it (`.topbar`, `.tlink`, `.actions`, `.serve-row`,
`.invisible`, `.level-switch` and friends) lives once in `assets/site.css`, not inline —
don't redefine these classes in a game's own `<style>`.

- **Top bar** (a single flex row): **Home** on the left, the owl mascot + a **level
  chip** in the centre, and **Skip** on the right.
- **Home, Skip, Next, Reset, Hint are text links, not buttons** — a shared `.tlink`
  style (emoji + word, no underline, not `.btn`). `Home` returns to this game's own
  start/level-select screen. `Skip` serves a **fresh puzzle that differs from the current
  one** (guard the regeneration so tiny pools don't loop). Skip and Next both count as
  "not solved" (no reward).
- **Under the game component:** **Reset** and **Hint** sit **next to each other** in one
  row (both `.tlink`). `Reset` restarts the *current* puzzle (keeps it, wipes the
  player's work). For pure multiple-choice games with nothing to reset
  (number-detective, times-table-pop, what-comes-next) omit Reset and show only Hint.
- **The primary action is the ONLY real `.btn`** (Serve / Check / Pay / Run / …) and is
  the **last component at the bottom**, in its own bottom slot.
- **On a correct answer, replace the primary button *in place* with a `Next ▶` button**
  in that same bottom slot (Next here is a real `.btn`, not a link), hide Skip, and show
  the result message just above it — so Next appears exactly where the player's eye/finger
  already is. `Next` loads a fresh, different puzzle and restores the play state.
- **Nothing in the top bar may shift when the puzzle completes.** Hide Skip on a win with
  `visibility:hidden` (an `.invisible` helper that keeps its box), never `display:none`,
  so the owl mascot and level chip don't re-center.
- **No bottom footer** — Home/Skip live in the top bar; Reset/Hint under the game; the
  primary button (→ Next) at the bottom.
- **Level chip is a switcher:** tapping it opens a small dropdown built from the game's
  `LEVELS`, listing all levels with the current one marked. Picking a different level
  switches difficulty, starts a fresh puzzle at that level **while staying in the game**,
  and closes the menu. Close the menu on **Escape** or an outside click.
  Exception: a game with no difficulty levels (`guess-the-capital`) omits the level chip
  entirely — the top bar centre is just the owl mascot.
- **Start screen only:** a subtle **`← All games`** link at the top-left that points to
  `../` (the games hub). It must appear only on the start screen, never during play.

## Shared JS helpers (`assets/site.js`)

`assets/site.js` holds the JS that was byte-identical (or safely parameterized) across
every game. Link it once, right before the game's own inline `<script>` — it defines
globals the game calls directly:

- `$(id)` — `document.getElementById(id)`.
- `reduceMotion` — `matchMedia("(prefers-reduced-motion: reduce)").matches`, computed once.
- `flash(msg, kind)` — writes into `#feedback` (`kind` is `''`/`'good'`/`'bad'`/`'hint'`).
- `setOwl(mood)` — toggles the mood class (`idle`/`happy`/`worried`/`win`/`think`) on
  whichever of `#owl-game`/`#owl-quiz`/`#owl-home` exist on the page.
- `wireLevelMenu()` — wires the `#q-level` chip's click-to-open and an outside-click-to-close
  listener for `#level-menu` (a game with no level chip just doesn't call it). Use
  `toggleLevelMenu()` / `closeLevelMenu()` directly, and `wireLevelMenuOutsideClick()`
  alone, if a game needs to wire `#q-level`'s `onclick` itself (e.g. to add a guard clause).
- `beep(freq, dur, type, when, gain)` — a single WebAudio oscillator beep; build a game's
  `sound(kind)` dispatcher out of calls to this.
- `stopConfetti()` — clears and hides `#confetti` and cancels the shared `confettiRAF`
  handle. A game's own confetti *launcher* (particle count/colors/shapes vary per game)
  stays inline in the game's script, and should assign into the shared `confettiRAF`
  (don't redeclare it with `let`).
- `initBouncyTitle(text)` — builds the animated per-letter `<h1 id="title">` and injects
  its keyframes (a no-op past text into the bouncing title, respecting `reduceMotion`).
- `loadGameData(path)` — `async`; `fetch`es a relative **JSON** path (`cache: "no-store"`)
  and returns the parsed data, or `null` on any failure (offline, or opened via `file://`,
  which blocks `fetch()` — see rule 4). Every data-driven game calls this once at the top
  of its own script and assigns into its own `let` variable, e.g.
  `loadGameData("words.json").then(d => { if (d) WORDS = d; })` — then validates the
  shape itself before use. Don't write a game-specific `fetch()`/`try`/`catch` block.
- `speak(text, rate)` — reads `text` aloud via `speechSynthesis`, picking the best
  available English voice itself (Chrome defaults to a low-quality local voice unless one
  is picked explicitly; this also handles the voice list loading asynchronously). No-op if
  the browser lacks `speechSynthesis`. `rate` defaults to `1`; pass a lower value (e.g.
  `0.82`) to read more slowly. `stopSpeech()` cancels any speech in progress — call it from
  a game's `goHome()`/reset so speech doesn't keep playing after leaving the puzzle.

A game's own script must not redeclare any of these names (that throws a `SyntaxError`
at load) — if a game needs different behavior for one of them (e.g. `word-guess`'s
`#q-level` guard), call the lower-level helper instead of the all-in-one wrapper, as
described above.

## Quality bar (how games are verified)

Existing games were built with a **pure-JS engine** (puzzle generation + solver) that is
stress-tested with Node, plus a **jsdom headless play-through** that drives the DOM and
asserts the game is winnable, wrong answers are rejected, and difficulty scales. When you
add or change game logic, follow the same pattern: keep the generator/solver as a
testable function and, if the environment has Node, add a quick check before shipping.
Prefer correctness proofs (e.g. "greedy == optimal for all inputs") over spot checks.

## Publishing (how changes go live)

The site auto-deploys from GitHub: after editing, the human commits and pushes
(VS Code Source Control → Commit → Sync), and GitHub Pages rebuilds within a minute or
two. After you finish a change, **remind the human to Commit and Sync** so it goes live.
Nothing deploys until they push.

## Current games

matchstick-math · number-detective · number-builder · race-to-100 ·
robot-instructions · shopping-adventure · coin-counter · times-table-pop ·
pizza-party · set-the-clock · what-comes-next ·
word-guess · guess-the-capital · math-monsters · shape-sorter · color-match ·
calendar-quest · sentence-doctor · spell-a-bee

`word-guess`, `guess-the-capital`, and `spell-a-bee` are the **data-driven** games:
each loads its data from a JSON file in its own folder (`word-guess/words.json`,
`guess-the-capital/capitals.json`, `spell-a-bee/words.json`) via the shared
`loadGameData()` helper.

## When the store is added later

- Replace root `index.html` with the store home; add sections under new paths like
  `/shop/`, `/products/`, `/cart/`.
- Leave `/games/` and every `/games/<slug>/` exactly where they are.
- The `games.js` catalog pattern can be reused for a `products.js`.
