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

The \`<head>\` (Google Fonts + \`site.css\`, then the game's own \`<style>\`), \`<body class="game">\`,
and the end of the page: \`#confetti\`, then \`site.js\`, then the game's own inline \`<script>\`.

`,
  block(P, "<!DOCTYPE html>", 0, 11, "html"),
  "\n",
  block(P, '<body class="game">', -2, 5, "html"),
  "\n",
  block(P, '<canvas id="confetti">', -3, 8, "html"),
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

\`← All games\` (start screen only), the owl + bouncy title (\`initBouncyTitle("Name")\` fills
\`#title\`, see section 1), the four \`.diff\` cards — \`EMOJI Name\` on one line, a 2–3 word \`d-range\`
— the \`.howto\` block and Start.

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
## 9. \`site.js\` globals

Every top-level name \`assets/site.js\` defines. A game calls these directly and must **never
redeclare any of them** (that throws a \`SyntaxError\` at load) — including the internal ones.

\`\`\`text
$(id)                                   document.getElementById(id)
reduceMotion                            true when the player prefers reduced motion; guard all animation and sound
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
initBouncyTitle(word)                   build the animated per-letter #title
\`\`\`

## 10. Shared CSS classes

Every class \`assets/site.css\` defines for game pages. If a name is here, it already exists — use
it, don't redeclare it in a game's \`<style>\`. Names only; the rules are in \`site.css\`.

\`\`\`text
page:        game app card brand title c1 c2 c3 c4 subtitle home-top hub-link center mt row-btns hide
mascot:      owl pupil brow brow-l brow-r beak happy worried win think
monster:     monster monster-name stagewrap mini mini-slot belly-fill sad chomp
buttons:     btn btn-primary btn-go btn-warn btn-sun btn-ghost btn-lg btn-sm ready
levels:      block-label diff-grid diff d-name d-range easy medium hard expert my
start:       howto
top bar:     topbar tb-center tb-right chip par level level-switch level-menu open level-opt caret tick
controls:    tlink off actions serve-row invisible stats-row
tiles:       tilegrid tile wrong-flash hintglow
result:      result rlabel stars rsub feedback good bad hint
rules sheet: sheet-ov show sheet sheet-top sheet-x sheet-body sheet-foot rule cap rrow rarrow rsolo o fade
\`\`\`
`,];
fs.writeFileSync(path.join(__dirname, "snippets.md"), out.join(""));
console.log("wrote _ref/snippets.md (" + out.join("").split("\n").length + " lines)");
