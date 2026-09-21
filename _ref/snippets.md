# Game snippets — copy-paste reference

> **Generated reference, not a source of truth.** Every block below is copied verbatim from the
> file and line range named above it. The real files win: if the two disagree, the snippet is
> the one that's wrong. `_tests/site/snippets.test.js` re-reads every range and fails when this
> file drifts — then run `node _ref/build-snippets.js`. Don't edit this file by hand: edit
> `_ref/build-snippets.js` (sections 9 and 10 are written there) and re-run it.

Read this instead of opening a reference game. The rules behind the markup are in CLAUDE.md
("Standard layout & controls", "Shared JS helpers"); this file is only the literal text.

## 1. Page skeleton

The `<head>` (`site.css` — which brings the fonts with it — then the game's own `<style>`), `<body class="game">`,
and the end of the page: `#confetti`, then `games.js`, then `site.js`, then the game's own inline
`<script>`. The game links `games.js` because its own catalog entry is where its title, card emoji
and subtitle come from — `site.js` reads them back from there (see section 10's `GAME`), which is why
`<p class="subtitle">` is empty in the markup and `initBouncyTitle()` takes no argument.

Source: `games/pizza-party/index.html` lines 1-8
```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Pizza Party</title>
<link rel="stylesheet" href="../../assets/site.css" />
<style>
```

Source: `games/pizza-party/index.html` lines 28-32
```html
</style>
</head>
<body class="game">
<div class="app">
  <div class="card">
```

Source: `games/pizza-party/index.html` lines 96-104
```html
    </section>
  </div>
</div>
<canvas id="confetti"></canvas>

<script src="../../games.js"></script>
<script src="../../assets/site.js"></script>
<script>
"use strict";
```

Source: `games/pizza-party/index.html` lines 220-224
```js
initBouncyTitle();
setLevel("EASY");
</script>
</body>
</html>
```

## 2. Top bar

Home (left), owl + level chip with its `#level-menu` dropdown (centre), Skip (right). The menu is
filled by `buildLevelMenu()`; never write `.level-opt` buttons by hand.

Source: `games/pizza-party/index.html` lines 56-70
```html
      <div class="topbar">
        <button id="home-btn" class="tlink">🏠 Home</button>
        <div class="tb-center">
          <svg class="owl" id="owl-game" style="width:40px;height:40px;"></svg>
          <div class="level-switch">
            <button class="chip level" id="q-level" aria-haspopup="true" aria-expanded="false" aria-label="Change level">
              <span id="q-level-label">🌱 Easy</span><span class="caret">▾</span>
            </button>
            <div class="level-menu" id="level-menu" role="menu"></div>
          </div>
        </div>
        <div class="tb-right">
          <button id="skip-btn" class="tlink">⏭ Skip</button>
        </div>
      </div>
```

## 3. Start screen

`← All games` (start screen only), the owl + bouncy title (`initBouncyTitle()` fills `#title` with
the catalog's name, see section 1), the EMPTY `<p class="subtitle">` that `applyGameText()` fills
with the card emoji + the catalog's `subtitle`, the four `.diff` cards — `EMOJI Name` on one line,
a 2–3 word `d-range` — the `.howto` block and Start. A `.howto` that wants to lead with the card
emoji writes `<i class="gemoji"></i>`, never the glyph itself; any OTHER glyph there is the game's
own and stays literal (pizza-party's 🧀 below).

Source: `games/pizza-party/index.html` lines 34-53
```html
    <section id="screen-home">
      <div class="home-top"><a class="hub-link" href="../">← All games</a></div>
      <div class="brand">
        <svg class="owl" id="owl-home"></svg>
        <h1 class="title" id="title"></h1>
      </div>
      <p class="subtitle"></p>
      <div class="block-label">Choose a level</div>
      <div class="diff-grid" role="group" aria-label="Level">
        <button class="diff easy"   data-diff="EASY"   aria-pressed="true"><div class="d-name">🌱 Easy</div><div class="d-range">½ and ¼</div></button>
        <button class="diff medium" data-diff="MEDIUM" aria-pressed="false"><div class="d-name">⭐ Medium</div><div class="d-range">⅓ to ⅛</div></button>
        <button class="diff hard"   data-diff="HARD"   aria-pressed="false"><div class="d-name">🔥 Hard</div><div class="d-range">½ = 2/4</div></button>
        <button class="diff expert" data-diff="EXPERT" aria-pressed="false"><div class="d-name">🏆 Expert</div><div class="d-range">⅔ = 8/12</div></button>
      </div>
      <div class="howto">
        🧀 <b>How to play:</b> An order comes in for a fraction of pizza. Tap slices to add topping until you've picked exactly that fraction,
        then hit <b>Serve</b>! On harder levels the pizza is cut into more slices, so you'll find the <b>equivalent</b> amount (½ of 8 slices = 4!).
      </div>
      <div class="row-btns mt"><button id="start-btn" class="btn btn-go btn-lg">Start ▶</button></div>
    </section>
```

With a rules sheet, the `.howto` block ends with the `📖 Read the full rules` link:

Source: `games/lights-out/index.html` lines 82-87
```html
      <div class="howto">
        🌙 <b>How to play:</b> Every window is a house light. Tap one and it switches —
        but <b>its neighbours switch too</b>! Turn <b>every light off</b> to put the town to sleep.
        The bigger the town, the harder it gets — and the less you can take back.
        <div class="center" style="margin-top:10px;"><button id="rules-home" class="tlink">📖 Read the full rules</button></div>
      </div>
```

## 4. Actions row

Under the game component. Plain Reset + Hint:

Source: `games/pizza-party/index.html` lines 87-90
```html
        <div class="actions">
          <button id="reset-btn" class="tlink">🔄 Reset</button>
          <button id="hint-link" class="tlink">💡 Hint</button>
        </div>
```

Undo before Reset, Rules last (`juice-jumble`):

Source: `games/juice-jumble/index.html` lines 122-127
```html
      <div class="actions">
        <button id="undo-btn" class="tlink">↩️ Undo</button>
        <button id="reset-btn" class="tlink">🔄 Reset</button>
        <button id="hint-link" class="tlink">💡 Hint</button>
        <button id="rules-btn" class="tlink">📖 Rules</button>
      </div>
```

Hint + `📖 Rules` as the last item (`lights-out`, where Undo replaces Reset):

Source: `games/lights-out/index.html` lines 119-123
```html
      <div class="actions">
        <button id="undo-btn" class="tlink">↩️ Undo</button>
        <button id="hint-link" class="tlink">💡 Hint</button>
        <button id="rules-btn" class="tlink">📖 Rules</button>
      </div>
```

## 5. Bottom slot

**With a submit action** — the primary `.btn`, replaced in place by `Next ▶` on a win, with Skip
hidden by `.invisible` (never `display:none`) so the top bar doesn't shift:

Source: `games/pizza-party/index.html` lines 92-95
```html
      <div class="serve-row">
        <button id="serve-btn" class="btn btn-go" disabled>🍽 Serve</button>
        <button id="next-btn" class="btn btn-primary hide">Next ▶</button>
      </div>
```

Source: `games/pizza-party/index.html` lines 190-191
```js
    $("serve-btn").classList.add("hide"); $("skip-btn").classList.add("invisible");   // Next takes Serve's place; Skip keeps its slot so nothing shifts
    $("next-btn").classList.remove("hide"); $("next-btn").focus(); flash('', ''); setOwl('win');
```

**No submit action** (the move is the check) — `Next ▶` holds the slot with `.invisible` and is
revealed on the win. The result block sits just above it:

Source: `games/lights-out/index.html` lines 124-133
```html
      <div id="result-view" class="hide">
        <div class="result">
          <div class="stars" id="stars">☆☆☆</div>
          <div class="rlabel" id="rlabel"></div>
          <div class="rsub" id="rsub"></div>
        </div>
      </div>
      <div class="serve-row">
        <button id="next-btn" class="btn btn-primary invisible">Next ▶</button>
      </div>
```

Source: `games/lights-out/index.html` lines 447-448
```js
  $("skip-btn").classList.add("invisible");   /* keeps its box, so the owl stays centred */
  $("next-btn").classList.remove("invisible");
```

## 6. Rules sheet

A game carries **no** sheet markup: `wireRulesSheet()` builds the `.sheet-ov#rules-ov` dialog
itself (a site test fails if a game contains `id="rules-ov"`). This is what it builds, for
reference only:

Source: `assets/site.js` lines 273-277
```js
  o.innerHTML =
    '<div class="sheet"><div class="sheet-top"><h2 id="rules-h"></h2>' +
    '<button class="sheet-x" id="rules-close" aria-label="Close rules">✕</button></div>' +
    '<div class="sheet-body" id="rules-body"></div>' +
    '<div class="sheet-foot"><button id="rules-ok" class="btn btn-go">Got it!</button></div></div>';
```

The game supplies the two links (sections 3 and 4) and the body. The body is a series of `.rule`
sections, each an `<h3>` with an emoji, short `<p>`s, and optional `.rrow` diagrams with a
`.cap` caption:

Source: `games/lights-out/index.html` lines 531-538
```js
wireRulesSheet(function(){
  $("rules-body").innerHTML =
    '<div class="rule"><h3>🌙 What you are trying to do</h3>'
    + '<p>Every square is a <b>window</b> in a sleepy town. A bright window (<b>✦</b>) means the '
    + 'light is <b>on</b>. A dark window (<b>☾</b>) means it is <b>off</b>. Turn <b>every light '
    + 'off</b> and the whole town goes to sleep — that wins the round.</p>'
    + '<div class="rrow">' + gridHTML(3, [1,3,4]) + '<span class="rarrow">➡️</span>' + gridHTML(3, []) + '</div>'
    + '<span class="cap">All the windows dark — the town is asleep.</span></div>'
```

Its own keydown handler must start by standing aside while the sheet is open:

Source: `games/lights-out/index.html` lines 505-507
```js
document.addEventListener("keydown", e => {
  if(rulesSheetOpen()) return;              // the sheet owns the keyboard while it is up
  if(e.key === "Escape"){ closeLevelMenu(); return; }
```

## 7. Data loading

Only for a game with an extensible content list (CLAUDE.md rule 4). Load once with the shared
helper, into the game's own `let`, and validate the shape before use. No inline fallback copy.

Source: `games/spot-the-words/index.html` lines 435-445
```js
/* This game only works when served (fetch() is blocked under file://) — no embedded
   fallback data, by design: see CLAUDE.md. */
let THEMES = [];
loadGameData("words.json").then(d => {
  THEMES = validateThemes(d);
  if(THEMES.length) buildPicker();
  else {
    $("loadmsg").textContent = "Couldn't load the word lists. This game needs to be served over http(s), not opened as a local file.";
    $("loadmsg").classList.add("bad");
  }
});
```

The validation keeps well-formed entries and drops the rest rather than crashing the page:

Source: `games/spot-the-words/index.html` lines 196-211
```js
/* Keep only well-formed themes; a malformed entry is dropped rather than crashing the page. */
function validateThemes(data){
  if(!data || !Array.isArray(data.themes)) return [];
  const out = [];
  for(const t of data.themes){
    if(!t || typeof t.name !== "string" || !t.name || typeof t.emoji !== "string" || !t.emoji) continue;
    if(!Number.isInteger(t.grid) || t.grid < 8 || t.grid > 11 || !DIRSETS[t.dirs]) continue;
    if(!Array.isArray(t.words)) continue;
    const words = [];
    for(const w of t.words)
      if(typeof w === "string" && /^[A-Z]+$/.test(w) && w.length >= 2 && w.length <= t.grid && words.indexOf(w) < 0) words.push(w);
    if(words.length < roundSize(t.grid)) continue;
    out.push({ name:t.name, emoji:t.emoji, grid:t.grid, dirs:t.dirs, words });
  }
  return out;
}
```

## 8. Engine export line

The pure engine ends with this guard; the DOM half follows inside `if(typeof document !==
"undefined")`. Export everything a test needs to reach — the level table, the generator, the
solver/checker, the star rule — so `loadEngine()` can prove it without a DOM.

Source: `games/lights-out/index.html` lines 303-307
```js
if(typeof module !== "undefined") module.exports = { LEVELS, HINT_MAX, DELTAS, flipList, flipMask,
  applyClick, isSolved, popcount, solveMask, solveMin, genBoard, starsFor };

/* ===== DOM =============================================================================== */
if(typeof document !== "undefined"){
```

## 9. Board games: the shared board

A board game does **not** write the board. `buildBoard()` puts the shared one (site.css's
GAME BOARD section) inside an empty `<div id="stage">`, and the game adds only its own layer of
tap targets over it. Squares are `<div class="gb-slot" id="s{i}">`, so a game reaches one with
`$("s" + i)`; a piece inside one is `pieceHTML("you" | "bird")`. Gomoku's whole board, markup
and all:

Source: `games/gomoku/index.html` lines 95-96
```html
      <div id="stage">
        <!-- buildBoard() puts the shared board here; the spots to tap go on top of it -->
```

Source: `games/gomoku/index.html` lines 501-518
```js
function setupBoard() {
  const n = game.n;
  const b = buildBoard("stage", { cols: n, cell: boardCell(n), edge: "3px" });
  const cells = document.createElement("div");
  cells.className = "gb-layer cells";
  cells.id = "cells";
  cells.setAttribute("role", "group");
  cells.setAttribute("aria-label", "Gomoku board");
  /* both tracks, or the implicit rows would size to the buttons' (empty) contents */
  cells.style.gridTemplateColumns = cells.style.gridTemplateRows = "repeat(" + n + ", 1fr)";
  for (let i = 0; i < n * n; i++) {
    const t = document.createElement("button");
    t.className = "cell"; t.id = "c" + i; t.dataset.i = i;
    t.onclick = () => humanMove(i);
    cells.appendChild(t);
  }
  b.board.appendChild(cells);
}
```

Connect Four's board is the same one with different knobs — room above it for the disc you are
holding, holes smaller than the discs (so a falling disc is clipped by the frame and looks like
it is behind it), and its own row numbering, because row 0 is the bottom of that board:

Source: `games/connect-four/index.html` lines 372-376
```js
  const b = buildBoard("stage", {
    cols: COLS, rows: ROWS, cell: boardCell(COLS, { min: 36, max: 58 }),
    head: "calc(var(--cell) + 4px)", hole: "calc(var(--cell) * .34)", inset: "7%",
    label: "Connect Four board", index: (r, c) => at(ROWS - 1 - r, c),
  });
```

The line through a winning row is drawn by `drawWinLine(runs, xy)` — a list of runs of square
indexes, and where a square's centre sits in cell units — and cleared by `clearWinLine()`:

Source: `games/gomoku/index.html` lines 535-536
```js
  if (game.winner && game.line.length) drawWinLine(runsOf(b, game.winner, n), i => [(i % n) + .5, ((i / n) | 0) + .5]);
  else clearWinLine();
```

## 10. `site.js` globals

Every top-level name `assets/site.js` defines. A game calls these directly and must **never
redeclare any of them** (that throws a `SyntaxError` at load) — including the internal ones.

```text
$(id)                                   document.getElementById(id)
reduceMotion                            true when the player prefers reduced motion; guard all animation and sound
GAME                                    this page's own entry in /games.js, found by its folder name (null off-catalog)
applyGameText()                         fills <i class="gemoji"> and <p class="subtitle"> from GAME (runs by itself)
loadGameData(path)                      async; fetch a relative JSON file, resolve to the parsed data or null
flash(msg, kind)                        write into #feedback; kind is '' | 'good' | 'bad' | 'hint'
MASCOT_SVG                              the one copy of the owl drawing
drawMascots()                           draws the owl into every empty svg.owl / svg.hub-owl (runs by itself)
setOwl(mood)                            idle | happy | worried | win | think on #owl-game / #owl-quiz / #owl-home
closeLevelMenu()                        close #level-menu
toggleLevelMenu()                       open/close #level-menu
wireLevelMenuOutsideClick()             close the menu on an outside click
wireLevelMenu()                         wire #q-level to open the menu, plus the outside click
buildLevelMenu(levels, onPick)          fill #level-menu from LEVELS (or [key, label] pairs); tap calls onPick(key)
markLevel(key, label)                   show key as current: .diff aria-pressed, menu aria-current, #q-level-label
audioCtx                                internal: the shared AudioContext
beepBus                                 internal: the shared compressor beep() plays through
beep(freq, dur, type, when, gain)       one WebAudio oscillator beep
beepWin(dur, gap)                       the four-note win arpeggio (the site's stock 'correct' sound)
beepBad(dur, gain)                      the wrong-answer buzz
ttsVoice                                internal: the chosen speech voice
pickVoice()                             internal: picks ttsVoice
speak(text, rate)                       read text aloud (rate defaults to 1)
stopSpeech()                            cancel any speech in progress
rulesBody                               internal: the game's rules-body builder
rulesBuilt                              internal: whether the rules body has been built
rulesOpener                             internal: the control that opened the sheet
rulesSheetOpen()                        true while the rules sheet is showing
openRulesSheet(opener)                  open the rules sheet, focus moving in
closeRulesSheet()                       close it, focus returning to the opener
buildRulesSheet(gameName)               internal: builds the .sheet-ov#rules-ov markup
wireRulesSheet(buildBody, gameName)     build + wire the rules sheet; buildBody fills #rules-body on first open
confettiRAF                             the shared confetti animation-frame handle
CONFETTI_COLORS                         the default confetti palette
throwConfetti(options)                  the celebration; call as if(!reduceMotion) throwConfetti(...)
stopConfetti()                          clear and hide #confetti; call when leaving a round
showScreen(which)                       swap #screen-home / #screen-game ('home' | 'game')
showHome()                              stopConfetti + showScreen('home') + setOwl('idle')
initBouncyTitle(word)                   build the animated per-letter #title; no argument = the catalog's GAME.title
boardCell(cols, o)                      a cell size that keeps a board of cols columns inside the card
buildBoard(mount, o)                    build the shared board into mount; returns { stage, rig, board, pieces, fx, line }
boardSlot(id, row, col)                 one square, parked at its place (id null for a loose one, e.g. a piece leaving)
pieceHTML(side, inner)                  one piece: side is 'you' | 'bird'
drawWinLine(runs, xy)                   draw the line through a win; xy(i) is a square's centre in cell units
clearWinLine()                          wipe it, for the next round
```

## 11. Shared CSS classes

Every class `assets/site.css` defines for game pages. If a name is here, it already exists — use
it, don't redeclare it in a game's `<style>`. Names only; the rules are in `site.css`.

```text
page:        game app card brand title c1 c2 c3 c4 subtitle gemoji home-top hub-link center mt row-btns hide
mascot:      owl pupil brow brow-l brow-r beak happy worried win think
monster:     monster monster-name stagewrap mini mini-slot belly-fill sad chomp
buttons:     btn btn-primary btn-go btn-warn btn-sun btn-ghost btn-lg btn-sm ready
levels:      block-label diff-grid diff d-name d-range easy medium hard expert my
start:       howto
top bar:     topbar tb-center tb-right chip par level level-switch level-menu open level-opt caret tick
controls:    tlink off actions serve-row invisible stats-row
choices:     optlist opt num otxt correct wrong gone wrong-flash
tiles:       tilegrid tile wrong-flash hintglow
result:      result rlabel stars rsub feedback good bad hint
rules sheet: sheet-ov show sheet sheet-top sheet-x sheet-body sheet-foot rule cap rrow rarrow rsolo o fade
board:       piece you bird gb-stage gb-rig gb-board gb-layer gb-slot gb-back gb-frame gb-lips gb-rim gb-fx
board line:  gb-line wl-back wl-front
board state: last win place drop gone
```
