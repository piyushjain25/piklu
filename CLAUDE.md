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
3. **No build step, no dependencies, no tooling.** Keep it plain static files that work
   both when opened directly (`file://`) and when hosted. Use **relative** paths. Do not
   add bundlers, package managers, frameworks, or a `node_modules` requirement to run
   the site.
4. **Each game is one self-contained file.** A game is a single `games/<slug>/index.html`
   with its CSS and JS inline. The only allowed external calls are Google Fonts and (for
   a couple of games) `cdnjs.cloudflare.com`. Don't split a game into extra files.
5. **Keep it kid-safe and ad-free.** Age-appropriate content and friendly tone only.
   No ads, no analytics/tracking, no third-party trackers, no data collection.

## How the site is organised

```
/                       root — redirects to /games/ (future store home)
/games.js               THE CATALOG — single source of truth for the game list
/assets/site.css        shared styles for the hub
/games/index.html       the hub — auto-builds the grid from /games.js
/games/<slug>/index.html   one self-contained game per folder
/CLAUDE.md              this file
```

## Adding a new game (the ONLY supported way)

Two steps — never edit the hub's HTML or CSS to add a game:

1. Create the game at `games/<slug>/index.html` (self-contained, following the
   conventions below). `<slug>` is lowercase words joined by hyphens, e.g. `shape-sorter`.
2. Add **one entry** to the `GAMES` array in `games.js`:

   ```js
   { slug: "shape-sorter", title: "Shape Sorter", emoji: "🔷", accent: "sky",
     tagline: "Sort the shapes into the right bins.", skills: ["Shapes"], badge: "New" },
   ```

   Field reference:
   - `slug` (required) — folder name; becomes the URL `/games/<slug>/`. Must be unique.
   - `title`, `tagline`, `emoji` (required) — shown on the card.
   - `accent` (required) — one of `grape | coral | leaf | sun | sky`.
   - `skills` (optional) — tags shown on the card and used by the hub's search.
   - `badge` (optional) — small ribbon like `"New"`; omit for none.

The card, its link, and the search filter appear automatically.

## Game conventions (match the existing games)

- **Design system:** display font **Fredoka**, body font **Nunito** (Google Fonts).
  Palette: grape `#6C4AB6`, coral `#FF6B7A`, leaf `#2FB37D`, sun `#FFCF43` /
  `#e6a800`, sky `#3FA7E0`, ink `#33236B`; sky→green background with floating clouds.
  Reuse the **owl mascot** SVG with mood states (idle / happy / worried / win / think).
- **Four difficulty levels** — `EASY`, `MEDIUM`, `HARD`, `EXPERT` — each meaningfully
  different.
- **Endless and score-free.** No points, no lives, and **no per-game streak** (a single
  combined streak across all games will be added at the site level later — do not add a
  🔥 streak inside a game). Reward with stars, confetti, and sounds.
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
exact control scheme:

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
- **Start screen only:** a subtle **`← All games`** link at the top-left that points to
  `../` (the games hub). It must appear only on the start screen, never during play.

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
pizza-party · set-the-clock · what-comes-next

## When the store is added later

- Replace root `index.html` with the store home; add sections under new paths like
  `/shop/`, `/products/`, `/cart/`.
- Leave `/games/` and every `/games/<slug>/` exactly where they are.
- The `games.js` catalog pattern can be reused for a `products.js`.
