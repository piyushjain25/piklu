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
   simply not playable (`word-guess`, `guess-the-capital`, `spell-a-bee`, `spot-the-words`,
   `mystery-word`, `what-am-i`, `circuit-builder`); that's expected, not a bug.
4. **Each game is one file plus three shared files.** The game's own CSS and JS are
   **inline** in a single `games/<slug>/index.html` — don't split *game-specific* code
   into extra files. Every game also links three things that must never be
   copy-pasted into a game's own `<style>`/`<script>`: `assets/site.css` (the shared design
   system — see "Standard layout & controls"), `assets/site.js` (the shared JS helpers —
   see "Shared JS helpers"), and `/games.js` (the catalog — see "A game's words live in
   `games.js`"; link it **before** `site.js`, which reads it as it loads). **The fonts come with `site.css`**, which `@import`s the Google
   Fonts stylesheet on its first line — a page never links Google Fonts itself, so the site's
   two fonts are changed in exactly one place. A game **may** keep
   **data** in a sibling file in the same folder (e.g. `words.json`, `capitals.json`).
   **That file must be plain JSON — no other format is supported** (no `.js` data file
   assigning a `window.X = {...}` global, no embedding the data inline in `index.html`).
   Load it with the shared `loadGameData(path)` helper from `assets/site.js` (see "Shared
   JS helpers") using a **relative** path (e.g. `loadGameData('words.json')`) — keep the
   data next to that game's `index.html` so the game stays portable.

   **If a game has an extensible content list, that list goes in a sibling JSON file — not
   inline.** A content list is anything a future edit would want to *add to* without
   touching the game's logic: word lists, capitals, themes, organisms, component
   catalogues, question banks. Keeping it in JSON means extending the game is a data edit,
   reviewable on its own and impossible to break the game with.

   **Mechanics and level configuration stay inline.** Level tables, tolerances, grid sizes,
   generator parameters and anything the engine's own tests assert against are code, not
   content — they belong in the game file next to the logic that reads them.

   The test for which one applies: *would adding a new entry here ever need a code
   change?* If no, it's a content list and belongs in JSON. If a game generates its content
   procedurally and has no list to extend, it has no data file and keeps working under
   `file://`.

   A data file is not free: a game that loads one **cannot be opened via `file://`** (see
   rule 3) and must be previewed on the hosted site or a local static server. Don't create
   one for a handful of fixed values that will never grow.

   The only allowed
   external network calls are Google Fonts (from `site.css`'s `@import` — never from a page) and,
   for `guess-the-capital` only, the flag images from `flagcdn.com`. (`cdnjs.cloudflare.com` is allowed but no game currently uses it.)
   `_tests/site/conventions.test.js` enforces this list — add a host there, with a reason, or
   not at all.
5. **Keep it kid-safe and ad-free.** Age-appropriate content and friendly tone only.
   No ads, no analytics/tracking, no third-party trackers, no data collection.

## How the site is organised

```
/                       root — redirects to /games/ (future store home)
/games.js               THE CATALOG — single source of truth for the game list AND for every
                        game's title, card emoji and start-screen subtitle; linked by the hub
                        and by every game page (before site.js)
/assets/site.css        shared styles — the Google Fonts @import, hub layout AND the shared
                        game-page design system (colours, owl moods, buttons,
                        topbar/tlink/level-switch, the board games' board and piece, etc.)
/assets/site.js         shared JS helpers every game links before its own inline script
                        (the owl drawing itself — MASCOT_SVG/drawMascots — and
                        $, reduceMotion, flash, setOwl, level-menu, beep, confetti, title,
                        loadGameData for JSON data files, wireRulesSheet, speak/stopSpeech,
                        buildBoard + pieceHTML for the board games)
/games/index.html       the hub — auto-builds the grid from /games.js
/games/<slug>/index.html   one game per folder; game-specific CSS/JS inline, links site.css,
                        games.js and site.js
/games/<slug>/*.json        (optional) data a game loads via relative fetch(), e.g. words.json
/_tests/                the offline test suite — Node + jsdom, NEVER deployed (see "Tests")
/_ref/snippets.md       copy-paste markup for every shared pattern — NEVER deployed (see below)
/_ref/build-snippets.js builds snippets.md from the real files (node _ref/build-snippets.js)
/_config.yml            GitHub Pages build config; its only job is keeping non-site files
                        (`_tests/`, CLAUDE.md, README.md) off the public web
/CLAUDE.md              this file
```

### `_ref/snippets.md` — read this instead of a reference game

`_ref/snippets.md` holds the literal markup for every shared pattern — page skeleton, top
bar, `.diff` cards, actions row, bottom slot, rules sheet, data loading — pulled verbatim
from the games that define them. **Read it instead of opening a reference game.** It is a
generated convenience, not a source of truth: `_tests/site/snippets.test.js` fails if it
drifts from the real files, and when they disagree the real file is right. It also lists every
`site.js` global (checked both ways against `site.js`) and every shared `site.css` class.
Never edit it by hand: it is built by `node _ref/build-snippets.js`, which finds each block by a
unique anchor line, so a snippet that merely moved is fixed by re-running it. Add a new global or
shared class to the lists in that script, then re-run.

Anything that is not part of the website — tests, notes, fixtures, scratch work — goes in a
folder whose name starts with `_` **and** gets listed in `_config.yml`'s `exclude:`. Jekyll
skips `_`-prefixed paths, and the explicit `exclude` keeps them private even if that
convention ever stops applying. Never put developer-only files at a plain path: GitHub Pages
serves the repo, so `/whatever.js` is a public URL the moment it is pushed.

## A game's words live in `games.js`

A game's **title**, **card emoji** and **start-screen subtitle** are written once, in its
`games.js` entry, and the page reads them back — so the hub card and the game itself can never
drift apart. Every game links `<script src="../../games.js"></script>` immediately before
`site.js`; `site.js` finds the page's entry by its **folder name** (`GAME`) and fills the page in
(`applyGameText()`, which runs by itself). That works hosted *and* under `file://` — `games.js`
is a plain script, not a `fetch()`, so rule 3 is untouched.

What that means when writing a game:

- **The name.** `initBouncyTitle()` takes **no argument** — it uses `GAME.title`. Never
  `initBouncyTitle("Shape Sorter")`.
- **The subtitle.** The markup is an **empty** `<p class="subtitle"></p>`. `site.js` fills it with
  the card emoji followed by the entry's `subtitle` (or its `tagline` if it has none). Never write
  the sentence, or the leading emoji, into the page.
- **The card emoji anywhere else.** Write `<i class="gemoji"></i>` and `site.js` fills in the
  glyph — that is how a `.howto` block leads with the game's own icon. A **different** glyph there
  is the game's own decoration and stays literal (pizza-party's 🧀, lights-out's 🌙); so does a
  glyph that means something in play (`flash("🔴 Your turn!")` — that 🔴 is the player's colour,
  not the card icon).
- **`<title>` is the one exception.** `<head>` is parsed long before any script runs, so it has to
  be a literal — write the catalog's `title` there exactly.
  `_tests/site/conventions.test.js` checks all five of these, and boots every game to confirm the
  catalog's words really land on the page.

## Adding a new game (the ONLY supported way)

Two steps — never edit the hub's HTML or CSS to add a game:

1. Create the game at `games/<slug>/index.html` (code inline, following the
   conventions below). `<slug>` is lowercase words joined by hyphens, e.g. `shape-sorter`.
   In `<head>`, link `<link rel="stylesheet" href="../../assets/site.css" />` (that one
   link brings the fonts too — never add a Google Fonts `<link>`) and give `<title>` the same
   text as the catalog entry's `title`, and give `<body>` the class `game`
   (`<body class="game">`) — that's what pulls in the shared design system and control
   scheme. Right before the game's own `<script>` (after the `<canvas id="confetti">`),
   add `<script src="../../games.js"></script>` and then
   `<script src="../../assets/site.js"></script>` — it defines globals
   (`$`, `reduceMotion`, `flash`, `setOwl`, `wireLevelMenu`, `beep`, `stopConfetti`,
   `initBouncyTitle`, …; see "Shared JS helpers") that the game's inline script calls
   directly, unqualified. Never redeclare any of those names in the game's own script.
   Only put a rule in the game's own `<style>` if it's genuinely unique to that
   game (colors, a page-width tier `.app{--app-w:var(--app-wide)}`, one-off components);
   never re-declare something `site.css` already defines. A game played on a grid of holes
   calls `buildBoard()` for the board and adds only its own layer on top — see "The board". If the game has a content list
   — apply rule 4's test: *would adding a new entry ever need a code change?* — put it as
   JSON in the **same folder** and load it with `loadGameData()` (see rules 3–4 — such a
   game must be viewed on the hosted site or a local server, not via `file://`).
2. Add **one entry** to the `GAMES` array in `games.js`:

   ```js
   { slug: "shape-sorter", title: "Shape Sorter", emoji: "🔷", accent: "sky", ageGroup: "6+",
     tagline: "Sort the shapes into the right bins.", skills: ["Shapes"], badge: "New",
     subtitle: "Sort every shape into the bin where it belongs!" },
   ```

   Field reference:
   - `slug` (required) — folder name; becomes the URL `/games/<slug>/`. Must be unique.
   - `title`, `tagline`, `emoji` (required) — shown on the card. `title` and `emoji` are also
     what the **game page** shows (see "A game's words live in `games.js`"), so `title` is the
     game's name everywhere and `<title>` must match it.
   - `subtitle` (optional) — the livelier line the **game's own start screen** shows under its
     title, e.g. `tagline: "Put the whole town to sleep."` on the card and
     `subtitle: "Tap the windows and put the whole town to sleep!"` in the game. Falls back to
     `tagline` when omitted. `site.css`/`site.js` render it as the card emoji + this text, so
     don't repeat the emoji here.
   - `accent` (required) — one of `grape | coral | leaf | sun | sky`. Pick one that doesn't
     match the entry 1, 2 or 3 places above it in this array: the hub grid is
     `repeat(auto-fill,minmax(240px,1fr))` inside a 1080px wrap, so it renders as 1–4
     columns and those are the cards that end up side by side or stacked. (4 apart can
     repeat — forbidding that too leaves only a rigid 5-colour stripe.)
   - `ageGroup` (required) — recommended starting age, shown on the card as `Age: X+`.
     Must be one of exactly **five bands**: `"3+"`, `"6+"`, `"9+"`, `"12+"`, `"15+"` — no other
     value. The hub builds its age filter from whatever values appear here, so an off-scale
     age silently adds a stray filter chip. The bands read as:
     `3+` pre-reading recognition (colour, shape, pattern) · `6+` early reading and basic
     number work · `9+` fluent reading, times tables, multi-step logic · `12+` abstract
     reasoning and wide vocabulary · `15+` deep strategy.
     This is a **hub-only** label — never shown inside the game itself.
   - `skills` (optional) — **at most two** tags, shown on the card and used by the hub's
     search. Reuse a tag that already appears in `games.js` rather than coining a near
     synonym — every arithmetic/mental-math/place-value game is just `Math`, and the list
     is short on purpose so the search stays useful.
   - `badge` (optional) — small ribbon like `"New"`; omit for none.

The card, its link, and the search filter appear automatically.

## Game conventions (match the existing games)

- **Design system:** display font **Fredoka**, body font **Nunito** — `@import`ed from Google
  Fonts once, at the top of `assets/site.css`, never linked from a page.
  Palette: grape `#6C4AB6`, coral `#FF6B7A`, leaf `#2FB37D`, sun `#FFCF43` /
  `#e6a800`, sky `#3FA7E0`, ink `#33236B`; sky→green background with floating clouds.
  The **owl mascot** has mood states (idle / happy / worried / win / think). Its drawing
  lives **once**, as `MASCOT_SVG` in `assets/site.js` — swap the site's mascot there and
  every game and the hub change together. A page holds only **empty placeholders**:
  `<svg class="owl" id="owl-home"></svg>` on the start screen and
  `<svg class="owl" id="owl-game" style="width:40px;height:40px;"></svg>` in the top bar
  (`#owl-quiz` in `guess-the-capital`; `<svg class="hub-owl"></svg>` on the hub). Never paste
  the owl's paths into a page — `_tests/site/conventions.test.js` fails on an inline copy.
  The same idea covers a game's **words**: its title, card emoji and subtitle live once in
  `games.js`, and the page holds empty placeholders (see "A game's words live in `games.js`").
  A game may put its **own extras** inside a placeholder (sentence-doctor's stethoscope,
  drawn on top of the owl); an extra marked `data-under` (word-guess's shadow) is drawn
  beneath it.
  All of this — colours as CSS vars, the owl mood CSS, `.btn`/`.card`/`.chip`/`.diff`, the
  board games' board and piece
  etc. — is defined once in `assets/site.css` (and the owl drawing in `assets/site.js`)
  and shared by every game via `<link>`/`<script>`; a game only adds its own extra CSS
  vars (theme colors like `--paper`) and components. That includes the standard
  wrong-answer wobble: use `animation:wrongShake .35s ease` rather than declaring your own
  ±7px shake keyframes.
- **Four difficulty levels** — `EASY`, `MEDIUM`, `HARD`, `EXPERT` — each meaningfully
  different. Exception: the **board games against the owl** (`connect-four`, `checkers`,
  `gomoku`) have **three** — `EASY`, `MEDIUM`, `EXPERT` — because a fourth rung bought
  nothing: their levels differ only in how well the owl plays, and past a certain search
  depth a child cannot tell two owls apart (the engine tests measure it: against a careful
  player the old HARD and EXPERT owls both won every game). Three rungs are three real
  experiences — you almost always win, an even fight, and a wall — and those games mark
  their `.diff-grid` with `three` so the row of cards fills properly. `guess-the-capital`
  has no difficulty levels — it's purely a
  choice of game (Indian States vs World Countries), so it has no level chip at all (see
  below). `spot-the-words` has no levels either: each theme in its `words.json` declares its
  own grid size and word directions, and the theme *is* the difficulty. `crazy-eights` has
  none either — the deal decides far more of a card game than any owl would, so a second
  owl would be a label with almost nothing behind it; like `guess-the-capital` it has no
  level chip at all. `spell-a-bee` and
  `what-am-i` add an optional **fifth** level on top of the four — `📝 My Words` (the `MY`
  list in `spell-a-bee/words.json`) and `📝 My Riddles` (`what-am-i/my.json`) — a hidden
  `.diff` card and level-menu entry that appear only when that data is non-empty.
- **Level cards look the same in every game.** The start screen's level picker is the
  shared `.diff-grid` of four `.diff` buttons, each exactly
  `<div class="d-name">EMOJI Name</div><div class="d-range">a few words</div>` — the emoji
  and name are **one line** (`🌱 Easy`, `⭐ Medium`, `🔥 Hard`, `🏆 Expert`; `site.css` keeps
  them on one line and shrinks them slightly on a narrow card, so never put the emoji on its
  own line or add a `<br>`). The `d-range` is a **short hint** — two or three words
  (`3 juices`, `lots of help`, `up to 20`) — never a list of details; the full explanation
  belongs in the `.howto` block or the rules sheet, not on the card. Keep the four hints
  about the same length. A hint may wrap on a narrow screen — that's fine: `site.css`
  stacks each card's contents from the top and gives every card in the row the same
  height, so the names and hints stay lined up across all four cards. Never override
  `.diff`'s layout in a game (no `display`, alignment, or fixed heights) — that's what keeps
  the cards in sync.
- **Endless and score-free.** No points, no lives, and **no per-game streak** (a single
  combined streak across all games will be added at the site level later — do not add a
  🔥 streak inside a game). Reward with stars, confetti, and sounds. Exception:
  `word-guess` is a hangman-style game where wrong guesses are the core mechanic, so it
  keeps its 10 letter hearts + 3 word stars — these decide whether the round is won or
  lost, they are not a score or a streak. Likewise `dino-dig` keeps **three egg hearts at
  EXPERT only** (🥚🥚🥚, cracking as eggs are woken): they decide whether the dig ends, they
  are not a score or a streak, and at every other level a woken egg only costs stars. And
  `gomoku` keeps **five capture pips per side at EXPERT only** — the pairs each side has taken:
  a fifth pair ends the game, so they are a win condition like word-guess's hearts, not a score.
- **Feel:** juicy and encouraging — meters, star ratings, confetti canvas, gentle
  WebAudio beeps.
- **Accessibility:** respect `prefers-reduced-motion` (guard all animation/sound),
  support keyboard where sensible, keep good colour contrast, use `aria-pressed` on the
  difficulty cards. Never rely on colour alone to signal correctness (avoid answer
  "tells" — e.g. the submit button must look the same whether the current answer is
  right or wrong).
- Don't use `localStorage`/`sessionStorage` unless asked; keep state in memory.

## Standard layout & controls

The common CSS for the game (`.topbar`, `.tlink`, `.actions`, `.serve-row`,
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
  row (both `.tlink`); a game with a rules sheet adds `📖 Rules` as the **last** item of
  that row (see "Game rules" panel below). `Reset` restarts the *current* puzzle (keeps it, wipes the
  player's work). For pure multiple-choice games with nothing to reset
  (e.g. number-detective, times-table-pop, what-comes-next) omit Reset and show only Hint.
  Exception: games where a step-by-step build is worth taking back one move at a time add
  `Undo` **before** Reset — `juice-jumble` (`↩️ Undo`, `🔄 Reset`, `💡 Hint`, because the
  puzzle has genuine dead ends and Reset alone is too punishing an escape), `coin-counter`,
  `number-builder` and `robot-instructions`. `lights-out` shows `↩️ Undo` **instead of**
  Reset. `tic-tac-toe` has **no Hint** (it's a game against the owl, not a puzzle) and
  nothing to reset, so its row is just `📖 Rules`. `connect-four`, `checkers` and `gomoku` are also games against
  the owl with nothing to reset, but keep a Hint, so their row is `💡 Hint`, `📖 Rules`.
  (Rules-sheet games carry `📖 Rules` at the end of the row.)
- **The primary action is the ONLY real `.btn`** (Serve / Check / Pay / Run / …) and is
  the **last component at the bottom**, in its own bottom slot. A game with **no submit
  action** (the move itself is the check — e.g. `lights-out`, `spot-the-words`, `juice-jumble`,
  the pure multiple-choice games, `tic-tac-toe`'s, `connect-four`'s, `checkers`' and `gomoku`'s `Play again ▶`; also `balance-scales` at
  EASY/MEDIUM and `tally-chart`'s last phase, see below) keeps that slot
  occupied during play with `Next ▶` carrying `.invisible`, and just removes `.invisible` on
  the win, so the slot never reflows. Exception: `dino-dig` has no submit action either, but
  its bottom-slot primary `.btn` is a real control — a **🔍 Dig / 🚩 Flag mode toggle** that
  decides what a tap on the grid does. It is replaced in place by `Next ▶` on a win, or by
  `New dig ▶` when an EXPERT dig is lost.
- **Multi-phase rounds:** `tally-chart` runs **three phases per round** (count & tally → build
  the chart → read the chart), shown by a `1 of 3` indicator. Its bottom-slot primary `.btn`
  changes label per phase (`Done counting ✓` → `Check chart ✓`); the last phase is multiple
  choice, so the slot holds `Next ▶` with `.invisible` until the right option is tapped. Its
  `Reset`/`Hint` links are **phase-aware** — each acts on the current phase. Unlike a
  single-phase MCQ game, which omits Reset altogether, `tally-chart` keeps Reset's box and
  makes it `.invisible` in the multiple-choice phase, so the row doesn't reflow between phases.
- **Primary button by level:** `balance-scales` has **no primary button at EASY/MEDIUM** —
  the live beam *is* the check, and the round completes the moment the pans are level — so
  the bottom slot holds `Next ▶` with `.invisible` (the same placeholder pattern as
  `lights-out`) until then. At **HARD/EXPERT** the answer is a number rather than a physical
  state, so `Check ✓` is the primary `.btn`, replaced in place by `Next ▶`.
- **Clues by level:** `coin-counter` greys out money that would go over and lights `Pay` only
  on the exact amount at **EASY/MEDIUM**. At **HARD/EXPERT** it gives no such clues on purpose:
  every coin stays tappable, the player can go over, `Pay` is always live and looks the same, and
  a wrong payment is refused (the round goes on, capped at ★★). EXPERT also hides the change
  amount — the player works it out from the price and the note paid.
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
  `LEVELS` by the shared `buildLevelMenu(LEVELS, pickLevel)`, listing all levels with the
  current one marked (`markLevel()` — see "Shared JS helpers"). Picking a different level
  switches difficulty, starts a fresh puzzle at that level **while staying in the game**,
  and closes the menu. Close the menu on **Escape** or an outside click.
  Exception: a game with no difficulty levels (`guess-the-capital`) omits the level chip
  entirely — the top bar centre is just the owl mascot. `spot-the-words` instead reuses the
  same chip (`#q-level` / `#level-menu`, `wireLevelMenu()`) as a **theme** switcher: it lists
  the fourteen themes rather than levels, and adds its own `max-height`/`overflow-y:auto` on
  `#level-menu` so the long list scrolls.
- **Start screen only:** a subtle **`← All games`** link at the top-left that points to
  `../` (the games hub). It must appear only on the start screen, never during play.
- **"Game rules" panel** (for games whose rules need more room than the start screen's
  `.howto` block). `games/lights-out/index.html` is the reference implementation — copy
  it rather than inventing a different rules UI. Two triggers, both `.tlink`s: a
  `📖 Read the full rules` link (`#rules-home`) centred at the bottom of the start screen's
  `.howto` block, and a `📖 Rules` link (`#rules-btn`) as the **last** item of the in-game
  `.actions` row. Both open the same modal sheet, which `wireRulesSheet(buildBody)` builds
  and wires — the game carries **no** sheet markup of its own; see "Shared JS helpers" for
  its behaviour. The body is a series of `.rule` sections (an `<h3>` with an emoji, short `<p>`s,
  and optional `.rrow` diagrams with a `.cap` caption). Games using it: `tic-tac-toe`,
  `mystery-word`, `matchstick-math`, `lights-out`, `spot-the-words`,
  `juice-jumble`, `dino-dig`, `mirror-draw`, `tally-chart`, `balance-scales`,
  `circuit-builder`, `connect-four`, `checkers`, `gomoku`, `crazy-eights`.
  `_tests/site/rules-sheet.test.js` holds that list — add a new game to it.

## Responsive: mobile-first, and sized from the card

The site is **mobile-first**: the phone layout is the base rule and wider screens are the
enhancement. Three things follow, and `_tests/site/conventions.test.js` enforces all of them.

- **Never size against the viewport.** `vw` counts page and card padding the content never
  gets, so a board written `min(400px,90vw)` overflowed its card on a phone — and every game
  guessed that gutter differently (the same "full width" board was written `70vw`, `74vw`,
  `84vw`, `88vw` and `90vw`, four of them overflowing). `site.css` makes `.card` a **container**
  (`container:card / inline-size`), so **`cqw`/`cqi` measure exactly the room that exists**.
  "As wide as there is, capped" is `min(400px,100cqw)`. A game's `<style>` may not contain `vw`.
- **One page width per tier.** `:root` carries `--app-narrow:520px`, `--app:600px` and
  `--app-wide:720px`; a game picks one — `.app{--app-w:var(--app-wide);}` — and never writes a
  `max-width` of its own. **Pick the tier from what the game is, not from a number that looks
  right**, and match the games it sits beside: all four **owl board games** (`tic-tac-toe`,
  `connect-four`, `checkers`, `gomoku`) are `--app`, so their start screens and level pickers
  are identical; `--app-narrow` is the compact single-board puzzles whose board caps around
  330–440px (`lights-out`, `mouse-maze`, `mirror-draw`, `dino-dig`, `juice-jumble`,
  `mystery-word`); `--app-wide` is the text-heavy ones (`word-guess`, `matchstick-math`,
  `number-builder`, `number-detective`, `guess-the-capital`). A game whose board caps well below
  its tier loses nothing by sitting in the wider one — the board keeps its own cap and only the
  card chrome grows. (Thirty-six games each picking a pixel is how the site ended up with
  ten different card widths, so a level picker looked different in every game.) On a phone none
  of them bind: `.app` is `width:100%` and the card fills the screen.
- **Breakpoints ask the card, not the screen.** A viewport `@media` query made a narrow game and
  a wide one lay out differently at the same card width. Use
  `@container card (min-width:380px | 460px | 560px)` — those three, measured on the card's
  content box, are the site's only breakpoints. An element is never its **own** query container,
  so the two things that cannot be sized this way are the page gutter (`.game`) and the card's
  own padding: those stay on the viewport, and both interpolate with `clamp()` so the content
  width never jumps as the screen grows.

**Touch.** `.game` sets `touch-action:manipulation`: pinch-zoom still works (an accessibility
need — never `user-scalable=no`, which fails WCAG 1.4.4 and iOS has ignored since iOS 10), but
**double-tap zoom is off**, so a fast or mistimed tap is a tap and not a zoom, and the browser
no longer waits ~300ms on every tap to find out. Controls are ≥44px: `.tlink` carries
`min-height:44px`. Keep new tap targets to that floor — small targets are what made double-tap
misfire in the first place.

## The multiple-choice list (`.optlist`) — three games share one

A game whose answers are a **numbered list of full-width choices** (`calendar-quest`,
`what-am-i`, `guess-the-capital`) marks its container `class="optlist"` and writes **no CSS of
its own** for it: `site.css` owns the row, the `.num` badge, the `.otxt` label, the `.correct` /
`.wrong` / `.gone` states, the `.wrong-flash` wobble, and the two-up switch once the card is
wide enough. Resize it with `--opt-pad`, `--opt-size`, `--opt-num` and `--opt-numsize` rather
than restating the component.

Note `.opt` on its own is **not** this component: `math-monsters`, `shape-math`, `sneak-peek`
and `tally-chart` use that name for a compact answer **tile**, which is a different thing and
stays game-local. Only `.optlist .opt` is shared.

## The board (`.gb-*` + `.piece`) — every board game shares one

A game that plays on a grid of round holes — Connect Four, Gomoku, whatever comes next —
**never writes the board**. `buildBoard()` (see below) puts the shared one inside an empty
`<div id="stage">`, and the game adds only its own layer over it: Connect Four's column
buttons and the disc you hold, Gomoku's one tap target per spot. The look lives once in
`assets/site.css`'s **GAME BOARD** section, so changing a board there changes every board game
at once, and `_tests/site/conventions.test.js` fails a game that re-lays-out a `.gb-*` class or
rebuilds the frame itself.

- **The chrome.** Back to front: the back panel, the pieces, the frame (one lavender sheet with
  a hole cut for every square by a mask, so a falling piece slides *behind* it), the holes'
  lips, the leaving-piece layer (`.gb-fx`), the rim, the win line (`.gb-line`), then the game's
  own layer. `buildBoard` sets `--cols`, `--rows` and `--cell` on the `.gb-stage`; every size is
  worked out from those.
- **Squares** are `<div class="gb-slot" id="s{i}">`, already positioned — a game reaches one
  with `$("s" + i)` and marks it `.last` (the white "just played" dot) or `.win` (the pulse).
  `i` is the game's **own** index: a board whose rows run the other way (Connect Four counts
  rows up from the bottom) passes its own `index(row, col)`.
- **The piece** is `.piece.you` (coral, yours) or `.piece.bird` (sun, the owl's) — written by
  `pieceHTML()`, and shared by **every** board game, including ones with no holes at all
  (`checkers` sizes it inside its own chequered square). A game may decide **how big** its
  piece is; it must never re-colour it. Its states are shared too: `.place` (popped onto an
  empty square), `.drop` (fell down a column, `--fall` cells) and `.gone` (taken off the board).
- **Tuning knobs**, all passed to `buildBoard` so a board's numbers sit in one call, never
  scattered through a game's CSS: `hole` (hole radius), `inset` (how much smaller a piece is
  than its square — the default sits a piece *inside* its hole; Connect Four passes a bigger
  piece on purpose, so the frame clips it), `edge` (the piece's darker bottom edge), `head`
  (room above the board for a held piece) and `label`.
- **The board palette** is four CSS vars on `:root` — `--board-frame`, `--board-frame-lo`,
  `--board-back`, `--board-line` — plus `--board-rim`, the key-line rim every board sits in.
  `checkers`' chequered board is not a `.gb-*` board but is coloured from the same vars, so the
  whole site's boards still change together.

## Shared JS helpers (`assets/site.js`)

`assets/site.js` holds the JS that was byte-identical (or safely parameterized) across
every game. Link it once, right before the game's own inline `<script>` — it defines
globals the game calls directly:

- `$(id)` — `document.getElementById(id)`.
- `reduceMotion` — `matchMedia("(prefers-reduced-motion: reduce)").matches`, computed once.
- `GAME` / `applyGameText()` — the page's own entry in `games.js`, found from its folder name,
  and the helper that writes the catalog's words into the page: every `<i class="gemoji">` gets
  `GAME.emoji`, and an empty `<p class="subtitle">` gets the emoji plus `GAME.subtitle` (or
  `GAME.tagline`). It runs by itself as `site.js` loads — a game never calls it — and is a no-op
  on the hub and on any page with no catalog entry. See "A game's words live in `games.js`".
- `flash(msg, kind)` — writes into `#feedback` (`kind` is `''`/`'good'`/`'bad'`/`'hint'`).
- `MASCOT_SVG` / `drawMascots()` — the one copy of the owl drawing, and the helper that
  draws it into every empty `svg.owl` (and the hub's `svg.hub-owl`) placeholder. It runs by
  itself as `site.js` loads (which is after the page's markup, so the owl is there before
  first paint) — a game never calls it. It sets `viewBox="0 0 64 64"` and
  `aria-hidden="true"` (the mascot is decorative), keeps a placeholder's own extras (on top,
  or beneath if marked `data-under`), and is plain inline SVG, so it works under `file://`
  (no external `.svg`, no `<use href>`). A replacement mascot must keep the `.pupil`,
  `.brow-l`, `.brow-r` and `.beak` classes — they are what `site.css`'s mood states move.
  It has no motion of its own; the mood transitions are already switched off under
  `prefers-reduced-motion` by `site.css`'s global rule.
- `setOwl(mood)` — toggles the mood class (`idle`/`happy`/`worried`/`win`/`think`) on
  whichever of `#owl-game`/`#owl-quiz`/`#owl-home` exist on the page.
- `wireLevelMenu()` — wires the `#q-level` chip's click-to-open and an outside-click-to-close
  listener for `#level-menu` (a game with no level chip just doesn't call it). Use
  `toggleLevelMenu()` / `closeLevelMenu()` directly, and `wireLevelMenuOutsideClick()`
  alone, if a game needs to wire `#q-level`'s `onclick` itself (e.g. to add a guard clause).
- `buildLevelMenu(levels, onPick)` — fills `#level-menu` with one `.level-opt` entry per
  level; tapping one calls `onPick(key)`. `levels` is the game's `LEVELS` table
  (`{ EASY: { label }, … }`, or `{ EASY: "🌱 Easy", … }`) or a list of `[key, label]` pairs
  (spot-the-words passes its themes; spell-a-bee and what-am-i call it again to add their
  optional `MY` level once its data loads). Never build `.level-opt` buttons in a game.
- `markLevel(key, label)` — shows `key` as the current level everywhere at once: the start
  screen's `.diff` cards (`aria-pressed`), the menu entries (`aria-current`) and, when
  `label` is given, the chip's `#q-level-label`. A game's `setLevel(l)` is typically just
  `level = l; markLevel(l, LEVELS[l].label);`.
- `beep(freq, dur, type, when, gain)` — a single WebAudio oscillator beep; build a game's
  `sound(kind)` dispatcher out of calls to this.
- `beepWin(dur, gap, delay)` / `beepBad(dur, gain)` — the site's two stock outcome sounds: the
  rising four-note win arpeggio and the wrong-answer buzz. Every game's `sound(kind)` used to
  spell these out (22 and 12 copies), so "right" and "wrong" drifted apart across the site. The
  game still decides **when** they play and what else it makes; only the notes are shared. The
  defaults are the common spelling — pass your own for a slower or delayed one.
- `showScreen(which)` — swaps the two screens every game has, `#screen-home` and `#screen-game`
  (`guess-the-capital`'s is `#screen-quiz`, the same exception `setOwl` makes for its
  `#owl-quiz`), by toggling `.hide`. Pass `"home"` or `"game"`; never write the `classList`
  lines in a game.
- `showHome()` — `stopConfetti()` + `showScreen("home")` + `setOwl("idle")`: the three things
  every `goHome()` opens with. A game calls this first, then does its **own** cleanup (its
  timers, the piece it was holding, `stopSpeech()`).
- `throwConfetti(options)` — every game's celebration, drawn on `#confetti` by one shared
  particle loop; call it as `if (!reduceMotion) throwConfetti(...)`. No options gives the
  small burst most games use; a game tunes its own look with options (`colors` — extend the
  default with `[...CONFETTI_COLORS, "#FF8C42"]` — `count`, `frames`, `rain` to fall from the
  top, `y`, `wide`, `rMin`/`size`, `lift`, `spread`, `gravity`, `spin`, `vr`, `w`/`h` piece
  shape, `round` coins, `mirror` pairs; the full list is in `site.js`). Never write a
  confetti loop in a game.
- `stopConfetti()` — clears and hides `#confetti` and cancels the shared `confettiRAF`
  handle; call it when leaving a round.
- `initBouncyTitle(text)` — builds the animated per-letter `<h1 id="title">` and injects
  its keyframes (respecting `reduceMotion`). **A game calls it with no argument** — the name
  then comes from `GAME.title`, so it is written only in `games.js`. Words are joined with a
  no-break space so a name never wraps mid-title.
- `loadGameData(path)` — `async`; `fetch`es a relative **JSON** path (`cache: "no-store"`)
  and returns the parsed data, or `null` on any failure (offline, or opened via `file://`,
  which blocks `fetch()` — see rule 4). Every data-driven game calls this once at the top
  of its own script and assigns into its own `let` variable, e.g.
  `loadGameData("words.json").then(d => { if (d) WORDS = d; })` — then validates the
  shape itself before use. Don't write a game-specific `fetch()`/`try`/`catch` block.
- `wireRulesSheet(buildBody)` — wires the shared **rules sheet**: a scrollable "how to play"
  panel for games whose rules need more room than the start screen's `.howto` block (the
  games using it are listed under the "Game rules" panel bullet above). It builds the sheet
  itself — a `.sheet-ov#rules-ov` dialog just before the confetti canvas, holding `#rules-h`
  ("📖 How to play " + the page's `<title>`, or pass a name as a second argument),
  `#rules-body`, `#rules-close` and `#rules-ok` — so a game carries none of that markup. The
  game supplies a `📖 Read the full rules` `.tlink` (`#rules-home`) on the start screen, a
  `📖 Rules` `.tlink` (`#rules-btn`) in the `.actions` row, and a callback that fills
  `#rules-body` with that game's own copy. The body is built
  lazily on first open. Escape, the backdrop and both buttons close it; focus moves in and
  returns to the opener. A game's own `keydown` handler must start with
  `if (rulesSheetOpen()) return;` so play keys do nothing while the sheet is up. The chrome
  (`.sheet-ov`, `.sheet`, `.rule`, `.rrow`, `.rarrow`, `.rsolo`) is in `site.css` — never
  copy it into a game; a game adds only diagram CSS unique to itself.
  `rulesSheetOpen()` / `closeRulesSheet()` / `openRulesSheet(opener)` are available too.
- `boardCell(cols, {min, max, gutter})` — a `clamp()` cell size that keeps a board of `cols`
  columns inside the card at any screen width. It measures the **card** (`100cqw`), so `gutter`
  is only extra room the board's own chrome needs beside it and is normally left at `0` — it
  used to be each game's guess at the page padding, which is what made boards overflow on a phone.
- `buildBoard(mount, opts)` — builds (or rebuilds, for a game whose board changes size with the
  level) the shared board inside `mount`, leaving anything else in there alone, and returns
  `{ stage, rig, board, pieces, fx, line }` — append the game's own layer to `board`. `opts` is
  `cols`, `rows` (defaults to `cols`), `cell`, and the knobs listed in "The board" above. Never
  write board markup in a game.
- `boardSlot(id, row, col)` — one square, parked at its place; pass `id: null` for a loose one
  (a piece on its way off the board, dropped into `.gb-fx`).
- `pieceHTML(side, inner)` — one piece: `side` is `"you"` or `"bird"`.
- `drawWinLine(runs, xy)` / `clearWinLine()` — the line through a win. `runs` is a list of runs
  of square indexes; `xy(i)` gives a square's centre in cell units (that is how a board with its
  rows the other way up draws the same line). Redrawing does nothing until `clearWinLine()`, so
  a re-render never restarts the animation.
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

## Tests (`_tests/`) — how games are verified

The suite lives in `/_tests/` and is **not part of the website**: it is excluded from the
build, so it has no public URL, and nothing in it is needed to open, serve, or deploy the
site. The site itself stays plain static files with no build step and no dependencies
(rule 3). The suite's own dependency (jsdom) is confined to `_tests/package.json`.

```sh
./_tests/run.sh                 # everything (installs jsdom on first run)
./_tests/run.sh site            # only _tests/site/*.test.js
./_tests/run.sh <slug>          # _tests/site/* PLUS _tests/games/<slug>/*
STRESS=quick ./_tests/run.sh    # ~2% of the random samples (min 50), for a fast pass
STRESS=deep  ./_tests/run.sh    # 5x the random samples, for a paranoid pre-release run
JOBS=1 ./_tests/run.sh          # one suite at a time (the old serial run), e.g. to read the output live
```

Suites are separate processes that only read the repo, so `run.sh` runs several at once —
half the cores by default, `JOBS=n` to change it. Each suite's output is still printed as one
block, so parallel suites never interleave. **`STRESS=quick` is not the speed dial you might
expect**: it scales random-sample counts, and the slowest suites are jsdom play-throughs whose
cost is the owl thinking, not sampling — quick mode leaves those untouched.

- `./_tests/run.sh site` — after touching `games.js`, `assets/site.css` or `assets/site.js`.
  These are shared by every game, so a careless edit here breaks all of them at once; the
  site tests are the cheap check that it didn't.
- `./_tests/run.sh <slug>` — the normal loop while building or editing one game. Runs the
  site tests too, so a broken catalog entry can't slip through. An unknown slug is an error,
  never a silent pass.
- `./_tests/run.sh` — everything, before you commit and sync.
- `STRESS=quick` in front of any of these for a fast pass with reduced random sampling; the
  full counts still run by default. The header always says which mode ran.

`run.sh` exits non-zero if any suite fails, in every form — so "the tests pass" means exit 0.

**The one rule: a test never keeps its own copy of a game's code.** `_tests/lib/harness.js`
slices the engine out of the real `games/<slug>/index.html` at run time and boots the real
page in jsdom, so a passing test is a statement about the file the site actually ships. A
copied engine drifts from the game and silently stops proving anything — the same reason
rule 4 forbids an inline copy of a data file.

Adding a game is never purely additive — it always edits `games.js`, and often
`assets/site.css` or `assets/site.js` when the game needs a new shared class or helper.
Those shared edits are the ones that break *other* games, which is why `_tests/site/` runs
on every invocation of `run.sh`, including the single-slug form.

**A play-through waits for the page, never for the clock.** The owl replies after a 250ms
pause (550 with motion on) and *then* searches, so `await sleep(400)` is a race that a busy
machine loses — and a test that carries on against a board the owl hasn't answered yet goes
off the rails rather than failing cleanly. Poll the page's own state instead ("some square is
live again"), with a generous count as a runaway guard; the assertions that follow are what
prove the owl moved. The exceptions are the waits whose *point* is that nothing happens — after
Skip and Home, or a window the owl is only passing through — and those stay real sleeps.

A generative test wraps its **random-sample** counts in the harness's `stress(n)` —
`for (let i = 0; i < stress(2000); i++)` — so the `STRESS` dial can scale them. Only sample
counts: never a fixture, a scenario, an assertion or a termination guard.

Layout:

```
_tests/lib/harness.js           loadEngine(), bootGame(), loadCatalog(), tally(), mulberry32(), stress();
                                tally() also arms a 5-minute watchdog, so a stalled suite
                                fails by name instead of hanging run.sh
_tests/site/catalog.test.js     games.js + the hub — every game: real folder, valid accent,
                                on-scale age band, renders as a card, findable by search
_tests/site/conventions.test.js the structural rules of this file — every game: the three
                                shared files linked in order, the fonts left to site.css, its
                                title/emoji/subtitle taken from games.js rather than written
                                into the page, no redeclared site.js global, no
                                re-styled shared class, no stray host, no storage, JSON parses,
                                empty mascot placeholders that site.js really draws into,
                                and no game-local copy of the level menu, confetti loop,
                                rules-sheet markup, board chrome, piece colours or wrong-answer shake
_tests/site/rules-sheet.test.js the shared rules sheet, in the games that use it
_tests/site/snippets.test.js    _ref/snippets.md still matches the real files, byte for byte
_tests/games/<slug>/*.test.js   per-game engine stress tests and jsdom play-throughs
```

**When you add a game,** the `site/*` tests cover it automatically — run them, they catch
most convention slips on their own. Add `_tests/games/<slug>/` when the game has real logic
worth proving. Keep the generator/solver as a pure, DOM-free function and end the engine
block with:

```js
if (typeof module !== "undefined") module.exports = { newGame, applyMove, /* … */ };
```

Harmless in a browser (`module` is undefined there); it is what lets `loadEngine()` reach the
real code. Prefer correctness proofs over spot checks — "every generated board is solvable and
the claimed minimum really clears it, across 10,000 boards" beats a handful of examples. If a
game has no `module.exports` line, the play-through (`bootGame`) still works.

jsdom has no `fetch()`, so a **data-driven** game's play-through passes its real JSON in:
`bootGame(slug, { data: { "words.json": JSON.parse(read("games/<slug>/words.json")) } })`
answers that game's `loadGameData()` call; any other path rejects, as it would under `file://`.
Then wait for the page to finish loading the data before driving it. Since rule 4 puts any
extensible content list in JSON, this applies to most new games — `bootGame(slug, { data:
{ … } })` is the normal path for a play-through, not a special case.

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
calendar-quest · sentence-doctor · spell-a-bee · shape-math · what-am-i ·
mouse-maze · sneak-peek · mystery-word ·
lights-out · spot-the-words · juice-jumble · dino-dig · mirror-draw · tally-chart ·
balance-scales · tic-tac-toe · circuit-builder · connect-four · checkers · gomoku ·
crazy-eights

`word-guess`, `guess-the-capital`, `spell-a-bee`, `spot-the-words`, `mystery-word`,
`what-am-i` and `circuit-builder` are the **data-driven** games: each loads its data from JSON in its own folder
(`word-guess/words.json`, `guess-the-capital/capitals.json`, `spell-a-bee/words.json`,
`spot-the-words/words.json`, `mystery-word/words.json` + `dictionary.json`, and
`what-am-i/easy.json` … `expert.json` + an optional `my.json`, and
`circuit-builder/components.json`) via the shared `loadGameData()` helper.

`circuit-builder/components.json` is `{ "components": [ { id, name, emoji, kind, ends, bend?, says? } ] }`:
`kind` is `source | conductor | insulator | load | switch`, `ends` is 2 (or 3 for a junction
wire), `bend: true` makes a 2-ended conductor a corner piece, and a load's optional `says` names
its three states (`["lit","dim","off"]` by default; a buzzer says `buzz / soft / off`). The
generator needs a battery, a load (it prefers id `bulb`), a switch, a straight conductor (it
prefers id `wire`), a corner, a junction and at least one insulator; every other conductor,
insulator and load in the file is used as it appears, so a new part is a data edit. EASY and
MEDIUM always build with the bulb; HARD and EXPERT use every load. The simulation is real nodal
analysis (loads are equal resistors), which is what makes parts sharing a path run weakly.
HARD deals either a single loop or a two-path "ladder" (sometimes behind a switch) with exactly
one fault (insulator in the circuit, a part turned so an end doesn't touch, an open switch, or a
load wired to one contact). EXPERT deals one of four tasks — `pair` (two loads, a path each),
`trio` (three), `eachSwitch` (a switch on each path) and `master` (one switch for all) — with
only the battery and a few wires left on the bench. HARD and EXPERT trays always hold at least
three spare parts beyond what the circuit needs. `_tests/games/circuit-builder/engine.test.js`
proves every level solvable, every HARD fault single and fixable, and every EXPERT solution
doing what its task says — **run it after editing the parts list or the generator.**

`spot-the-words/words.json` is `{ "themes": [ { name, emoji, grid, dirs, words } ] }`:
`grid` is the N of an N×N board (8–11, which also sets the round size: 8→5 words, 9→6,
10→6, 11→7), `dirs` is `basic` (→ ↓) | `diag` (+ the forward diagonal ↘) — no word is ever placed reading
upward (↑ ↖ ↗) or backwards/right-to-left (← ↙), which is too hard for the age group (a player
may still *draw* a word from either end) — and `words`
are A–Z capitals, each no longer than `grid`, at least 10 per theme (Days of the Week is the
one exception, at 7). `_tests/games/spot-the-words/engine.test.js` checks all of that and
generates 2,000 boards per theme to prove every target appears exactly once — **run it after
editing the word lists**. A word that is a substring of another in the same theme (RAIN /
RAINBOW) is allowed but never picked in the same round as it.

`tic-tac-toe`'s levels change the **rules**, not just the owl: EASY classic, MEDIUM reverse
(three in a row *loses*; the owl goes first there, because in reverse the first player is the
one at a disadvantage), HARD is disappearing tic-tac-toe with the **original rules** (as on
therenotthere.com): at most 3 marks each, and placing a 4th removes your oldest **before** the
line is checked — so a fading mark can't finish a line. Three repeats of a position is a tie.
EXPERT is **ultimate** tic-tac-toe (nine boards; your square sends the owl to that board) with
a full-strength searching owl. The owl solves Easy/Medium/Hard exactly (Hard by a backwards
solve of ~116k positions) and blunders on purpose to stay beatable. It replaced the old
`tick-tock-toe` and `tic-tac-trek` games, which were removed.
Its two rules links show **different sheets**: `📖 Read the full rules` (start screen) tours all
four levels, while the in-game `📖 Rules` shows detailed rules for the **current level only**
(each level is a different game) — it calls `wireRulesSheet()` for the shared wiring and sets
its own `onclick`s on `#rules-home` / `#rules-btn`.

`connect-four` is classic 7×6 Connect Four against the owl; you always go first. Its board is
the shared one (see "The board"), with the holes made smaller than the discs so a falling disc
is clipped by the frame and looks like it is sliding down behind it. Its **three** levels differ
only in the owl, and the rules never change: EASY plays loosely (takes a win it sees 75% of the
time, blocks 50%), MEDIUM searches 3 plies and sometimes plays a simpler careful move instead,
and EXPERT runs an alpha-beta search 6 plies deep. The owl's thinking is capped by a node budget,
not a clock, so it costs the same on every machine. Because a disc only ever lands on top of a
column, a move can never complete a line for the *other* side, and a position can never come
round twice — so the only ending without a winner is a full board. (An earlier EXPERT level
played **PopOut**, where you could pop your own bottom disc out; it was removed — its house
rules about double fours, repetition and full-board draws were far too fiddly for the age group.)
Hint is the careful move (win, else block, else never hand over a win). Stars: a win
earns ★★★ minus one per hint (at least ★), a tie ★, a loss none.
`_tests/games/connect-four/engine.test.js` checks the rules against an independent oracle over
thousands of random games, proves the alpha-beta search equal to plain minimax (and exact in
endgames), and ranks the owls by strength — **run it after touching the search, the evaluation
or the level table.**

`checkers` is 8×8 English draughts against the owl; you are red (coral) and move first, the owl
plays the sun-coloured pieces. It has **three** levels. The rules are the strict ones: **captures are compulsory**, a jump
chain **must** be played to its end, men move and jump forward only, and a man crowned mid-jump
stops there. EASY and MEDIUM differ only in the owl (depth 2 / 5, both slipping to a random or
near-best move on purpose); EXPERT changes the **rules** to **flying
kings** — a king slides any distance along a diagonal and jumps from afar, landing anywhere past
its victim — with the deepest owl. Men never fly, at any level. The owl is capped by a node
budget, not a clock, so it costs the same on every machine. A run of 60 quiet king moves (no
capture, no man moved) is a draw. Hint is a fixed-strength search of the player's own position.
Stars: a win earns ★★★ minus one per hint (at least ★), a draw ★, a loss none.
Two things a board UI has to respect: a move's `to` can equal its `from` (a king that jumps a
circuit of four men comes home), and a jump chain is **played back one hop at a time** so it is
clear which pieces were taken — the real position only changes once that playback ends.
`_tests/games/checkers/engine.test.js` checks every legal-move list against an independent
referee over ~14,000 positions per rule set, proves alpha-beta equal to plain minimax, holds the
node budget to its cap and ranks the owls by how much each gives away — **run it after touching
the move generator, the search or the level table.** `_tests/games/checkers/play.test.js` drives
the real page, rebuilding the board from its own aria-labels, and wins a game through the DOM.

`gomoku` is five in a row against the owl, on the shared board (see "The board") without the
gravity: you always go first and put a stone on any empty spot. It is **freestyle** gomoku — five **or more**
in a row wins, so an overline of six counts, which is the rule a child expects. It has **three** levels. The board grows
with the level (EASY 9×9, MEDIUM 11×11, EXPERT 13×13) and so does the owl: EASY is
sleepy (it takes a win it can see 70% of the time and blocks 55%), MEDIUM looks two plies ahead
and sometimes just plays the careful move. EXPERT changes the **rules**
to **captures** (the Ninuki-renju / Pente rule): a stone that traps **exactly two** of the
opponent's stones between two of yours takes them off the board, and **five captured pairs wins**
just like five in a row — three in a row are safe, and moving *into* a gap between two enemy
stones is safe, because it is the closing stone that captures. That also makes the game finite:
a side that takes five pairs has won, so at most eight pairs ever come off and the board still
fills (a full board is the only draw). The owl searches a **trimmed** list — the best `cand`
spots within one step of a stone — because a 13×13 board has far too many empty spots to search
wide; its thinking is capped by a node budget, not a clock, so it costs the same on every
machine. Hint is the careful move (win, else block, else never hand over a win). Stars: a win
earns ★★★ minus one per hint (at least ★), a tie ★, a loss none.
`_tests/games/gomoku/engine.test.js` checks the rules against an independent oracle, proves
`winningMoves` never misses a win that a full-board sweep finds (the owl only looks next to a
stone), proves alpha-beta equal to plain minimax over the same candidates, holds the node budget
to its cap and ranks the owls by how much each gives away — **run it after touching the search,
the evaluation or the level table.** `_tests/games/gomoku/play.test.js` drives the real page and
plays it into captures at EXPERT.

`crazy-eights` is the card game against the owl, played with one 52-card deck: seven cards
each, and you go first. A card may be laid on the pile when it matches the **suit in force** or
the **rank** of the top card; an **8 is wild** and its player names the next suit, which is why
the suit is held in the state separately from the top card. Two house rules keep it simple for a
child and finite for the engine: you may **only take a card when nothing in your hand matches**
(and only one per turn — play it if you can, otherwise the turn ends), and once the pack is empty
a stuck player passes, with **two passes in a row** ending the round in favour of the smaller
hand (level hands tie). It has **no levels** (see the level rule above) and one owl, which keeps
its eights back for when it is stuck and names the suit it holds most of. The "already took a
card" flag belongs to the **turn**, not the round: it stays set only while the same player still
holds the turn (they drew something playable, so they must play it) and is cleared the moment the
turn passes. Letting it survive the turn change is what made a tap on the pack get refused, so
the player silently passed and the card they were owed went to the owl instead — both the engine
test and the play-through now check that a card taken lands in the taking player's own hand. The pile keeps **every**
card played, not just the top one — `_tests/games/crazy-eights/engine.test.js` counts hands +
pile + pack after every move and fails if the total is ever anything but one whole deck, which is
how the first version's vanishing cards were caught. That test also proves every random game
finishes and that the owl never spends an eight while a plain card would do — **run it after
touching the rules or the owl.**

`dino-dig` builds each board **after the first dig** and only accepts one a perfect logical
player can clear from there without ever guessing; the same solver powers its Hint.
`_tests/games/dino-dig/engine.test.js` proves that across 2,000 boards per level and
re-checks every deduction with an independent search — **run it after touching the solver
or the level table.**

## When the store is added later

- Replace root `index.html` with the store home; add sections under new paths like
  `/shop/`, `/products/`, `/cart/`.
- Leave `/games/` and every `/games/<slug>/` exactly where they are.
- The `games.js` catalog pattern can be reused for a `products.js`.
