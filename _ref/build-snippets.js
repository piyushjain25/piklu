#!/usr/bin/env node
"use strict";
/* Builds _ref/snippets.md from the real files.   Run:  node _ref/build-snippets.js

   Each block is found by an ANCHOR — a piece of text that must appear on exactly one line of
   its source file — plus an offset to the block's first line and a line count. So when a game
   gains or loses lines above a snippet, just re-run this; nothing here needs editing. Edit this
   file only when the markup a block should show has itself changed shape (a different anchor,
   more or fewer lines), or to change the prose.

   Developer-only: _ref/ is excluded from the site in _config.yml. Plain Node, no dependencies. */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");

const P = "games/pizza-party/index.html", L = "games/lights-out/index.html", J = "games/juice-jumble/index.html";
const W = "games/spot-the-words/index.html", SJ = "assets/site.js";
const G = "games/gomoku/index.html", C = "games/connect-four/index.html";
const PP = "games/paper-punch/index.html";

function block(file, anchor, from, count, lang){
  const lines = fs.readFileSync(path.join(ROOT, file), "utf8").split("\n");
  const hits = lines.map((l, i) => l.includes(anchor) ? i : -1).filter(i => i >= 0);
  if(hits.length !== 1) throw new Error(file + ": anchor " + JSON.stringify(anchor) + " is on " + hits.length
    + " lines, not exactly one — pick an anchor that is unique in that file");
  const a = hits[0] + from + 1, b = a + count - 1;       /* 1-based, inclusive */
  if(a < 1 || b > lines.length) throw new Error(file + ": block around " + JSON.stringify(anchor) + " runs off the file");
  return "Source: `" + file + "` lines " + a + "-" + b + "\n```" + lang + "\n" + lines.slice(a - 1, b).join("\n") + "\n```\n";
}

const out = [
  `# Game snippets — copy-paste reference

> **Generated reference, not a source of truth.** Every block below is copied verbatim from the
> file and line range named above it. The real files win: if the two disagree, the snippet is
> the one that's wrong. \`_tests/site/snippets.test.js\` re-reads every range and fails when this
> file drifts — then run \`node _ref/build-snippets.js\`. Don't edit this file by hand: edit
> \`_ref/build-snippets.js\` (sections 9 and 10 are written there) and re-run it.

Read this instead of opening a reference game. The rules behind the markup are in CLAUDE.md
("Standard layout & controls", "Shared JS helpers"); this file is only the literal text.

## 1. Page skeleton

The \`<head>\` (\`site.css\` — which brings the fonts with it — then the game's own \`<style>\`), \`<body class="game">\`,
and the end of the page: \`#confetti\`, then \`games.js\`, then \`site.js\`, then the game's own inline
\`<script>\`. The game links \`games.js\` because its own catalog entry is where its title, card emoji
and subtitle come from — \`site.js\` reads them back from there (see section 10's \`GAME\`), which is why
\`<p class="subtitle">\` is empty in the markup and \`initBouncyTitle()\` takes no argument.

`,
  block(P, "<!DOCTYPE html>", 0, 8, "html"),
  "\n",
  block(P, '<body class="game">', -2, 5, "html"),
  "\n",
  block(P, '<canvas id="confetti">', -3, 9, "html"),
  "\n",
  block(P, "initBouncyTitle(", 0, 5, "js"),
  `
## 2. Top bar

Home (left), owl + level chip with its \`#level-menu\` dropdown (centre), Skip (right). The menu is
filled by \`buildLevelMenu()\`; never write \`.level-opt\` buttons by hand.

`,
  block(P, '<div class="topbar">', 0, 15, "html"),
  `
## 3. Start screen

\`← All games\` (start screen only), the owl + bouncy title (\`initBouncyTitle()\` fills \`#title\` with
the catalog's name, see section 1), the EMPTY \`<p class="subtitle">\` that \`applyGameText()\` fills
with the card emoji + the catalog's \`subtitle\`, the four \`.diff\` cards — \`EMOJI Name\` on one line,
a 2–3 word \`d-range\` — the \`.howto\` block and Start. A \`.howto\` that wants to lead with the card
emoji writes \`<i class="gemoji"></i>\`, never the glyph itself; any OTHER glyph there is the game's
own and stays literal (pizza-party's 🧀 below).

`,
  block(P, '<section id="screen-home">', 0, 20, "html"),
  `
With a rules sheet, the \`.howto\` block ends with the \`📖 Read the full rules\` link:

`,
  block(L, '<div class="howto">', 0, 6, "html"),
  `
## 4. Actions row

Under the game component. Plain Reset + Hint:

`,
  block(P, '<div class="actions">', 0, 4, "html"),
  `
Undo before Reset, Rules last (\`juice-jumble\`):

`,
  block(J, '<div class="actions">', 0, 6, "html"),
  `
Hint + \`📖 Rules\` as the last item (\`lights-out\`, where Undo replaces Reset):

`,
  block(L, '<div class="actions">', 0, 5, "html"),
  `
## 5. Bottom slot

**With a submit action** — the primary \`.btn\`, replaced in place by \`Next ▶\` on a win, with Skip
hidden by \`.invisible\` (never \`display:none\`) so the top bar doesn't shift:

`,
  block(P, '<div class="serve-row">', 0, 4, "html"),
  "\n",
  block(P, '$("skip-btn").classList.add("invisible")', 0, 2, "js"),
  `
**No submit action** (the move is the check) — \`Next ▶\` holds the slot with \`.invisible\` and is
revealed on the win. The result block sits just above it:

`,
  block(L, '<div id="result-view" class="hide">', 0, 10, "html"),
  "\n",
  block(L, '$("skip-btn").classList.add("invisible")', 0, 2, "js"),
  `
## 6. Rules sheet

A game carries **no** sheet markup: \`wireRulesSheet()\` builds the \`.sheet-ov#rules-ov\` dialog
itself (a site test fails if a game contains \`id="rules-ov"\`). This is what it builds, for
reference only:

`,
  block(SJ, "o.innerHTML =", 0, 5, "js"),
  `
The game supplies the two links (sections 3 and 4) and the body. The body is a series of \`.rule\`
sections, each an \`<h3>\` with an emoji, short \`<p>\`s, and optional \`.rrow\` diagrams with a
\`.cap\` caption:

`,
  block(L, "wireRulesSheet(function(){", 0, 8, "js"),
  `
Its own keydown handler must start by standing aside while the sheet is open:

`,
  block(L, 'document.addEventListener("keydown"', 0, 3, "js"),
  `
## 7. Data loading

Only for a game with an extensible content list (CLAUDE.md rule 4). Load once with the shared
helper, into the game's own \`let\`, and validate the shape before use. No inline fallback copy.

`,
  block(W, "let THEMES = [];", -2, 11, "js"),
  `
The validation keeps well-formed entries and drops the rest rather than crashing the page:

`,
  block(W, "function validateThemes(data){", -1, 16, "js"),
  `
## 8. Engine export line

The pure engine ends with this guard; the DOM half follows inside \`if(typeof document !==
"undefined")\`. Export everything a test needs to reach — the level table, the generator, the
solver/checker, the star rule — so \`loadEngine()\` can prove it without a DOM.

`,
  block(L, 'if(typeof module !== "undefined")', 0, 5, "js"),
  `
## 9. Board games: the shared board

A board game does **not** write the board. \`buildBoard()\` puts the shared one (site.css's
GAME BOARD section) inside an empty \`<div id="stage">\`, and the game adds only its own layer of
tap targets over it. Squares are \`<div class="gb-slot" id="s{i}">\`, so a game reaches one with
\`$("s" + i)\`; a piece inside one is \`pieceHTML("you" | "bird")\`. Gomoku's whole board, markup
and all:

`,
  block(G, "buildBoard() puts the shared board here", -1, 2, "html"),
  "\n",
  block(G, "function setupBoard()", 0, 18, "js"),
  `
Connect Four's board is the same one with different knobs — room above it for the disc you are
holding, holes smaller than the discs (so a falling disc is clipped by the frame and looks like
it is behind it), and its own row numbering, because row 0 is the bottom of that board:

`,
  block(C, "const b = buildBoard(\"stage\", {", 0, 5, "js"),
  `
The line through a winning row is drawn by \`drawWinLine(runs, xy)\` — a list of runs of square
indexes, and where a square's centre sits in cell units — and cleared by \`clearWinLine()\`:

`,
  block(G, "if (game.winner && game.line.length) drawWinLine(", 0, 2, "js"),
  `
## 10. \`site.js\` globals

Every top-level name \`assets/site.js\` defines. A game calls these directly and must **never
redeclare any of them** (that throws a \`SyntaxError\` at load) — including the internal ones.

\`\`\`text
$(id)                                   document.getElementById(id)
reduceMotion                            true when the player prefers reduced motion; guard all animation and sound
GAME                                    this page's own entry in /games.js, found by its folder name (null off-catalog)
applyGameText()                         fills <i class="gemoji"> and <p class="subtitle"> from GAME (runs by itself)
loadGameData(path)                      async; fetch a relative JSON file, resolve to the parsed data or null
flash(msg, kind)                        write into #feedback; kind is '' | 'good' | 'bad' | 'hint'
trackEvent(name, params)                internal: ONE analytics event, game_slug + level filled in — site.js only, never a game
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
\`\`\`

## 11. Shared CSS classes

Every class \`assets/site.css\` defines for game pages. If a name is here, it already exists — use
it, don't redeclare it in a game's \`<style>\`. Names only; the rules are in \`site.css\`.

\`\`\`text
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
\`\`\`

## 12. Wiring the controls (JS)

The glue every game writes between its engine and the shared helpers: \`setLevel\` (the \`.diff\`
cards only pick a level; Start begins play), the level menu (\`buildLevelMenu\` + a \`pickLevel\` that
starts a fresh puzzle while staying in the game), Home, Start, Skip, Next and the actions row.
\`goHome()\` opens with \`showHome()\` and then does only the game's own cleanup (timers,
\`stopSpeech()\`, …). Taken from \`paper-punch\`, whose round function is \`newRound(fromHome)\`:

`,
  block(PP, "function setLevel(l){", 0, 23, "js"),
  `
Starting a round: pick a puzzle that differs from the one on screen (Skip/Next never repeat it),
then put every control back in its play state. The bottom slot shown here is the EXPERT pattern
(\`Check ✓\` live, \`Next ▶\` hidden) next to the no-submit pattern (\`Next ▶\` held \`.invisible\`),
and a Reset that goes \`.invisible\` at the levels where it does nothing — in the actions row that
takes no room, so the links left over sit centred together:

`,
  block(PP, "function newRound(fromHome){", 0, 21, "js"),
  `
The end of a round: fill \`#stars\` (here ★★★ minus one per wrong try, never below ★ on a win, and
☆☆☆ when the answer was shown), show \`#result-view\`, swap \`Next ▶\` in where the primary button
was, hide Skip with \`.invisible\`, and celebrate only a real win:

`,
  block(PP, "function endRound(won){", -1, 19, "js"),
];
fs.writeFileSync(path.join(__dirname, "snippets.md"), out.join(""));
console.log("wrote _ref/snippets.md (" + out.join("").split("\n").length + " lines)");
