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
- **Structure:** home screen with 4 difficulty cards (`EASY`, `MEDIUM`, `HARD`,
  `EXPERT`, each meaningfully different) → game screen → inline result. Footer has
  🏠 Home, a New/Skip button, and a hidden Next button.
- **New games are endless and score-free** (no points/lives). Reward with stars,
  streaks 🔥, confetti, and sounds instead. (Two of the original games have scoring;
  leave those as they are unless asked.)
- **Feel:** juicy and encouraging — meters, star ratings, confetti canvas, gentle
  WebAudio beeps. Hints are a subtle text link, never a big button.
- **Accessibility:** respect `prefers-reduced-motion` (guard all animation/sound),
  support keyboard where sensible, keep good colour contrast, use `aria-pressed` on the
  difficulty cards. Never rely on colour alone to signal correctness (avoid answer
  "tells").
- Don't use `localStorage`/`sessionStorage` unless asked; keep state in memory.

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
