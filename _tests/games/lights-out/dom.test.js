"use strict";
/* Headless play-through: drives the real page and asserts a child can actually finish a
   round — the board is solvable through the UI, the win state lands in the right places, the
   control scheme behaves, and Undo really is an undo. */
const { bootGame, loadEngine, tally } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("lights-out");

const { w, d, $ } = bootGame("lights-out", { onError: e => ok(false, "page error: " + e.message) });
const cells = () => [...d.querySelectorAll("#board .win")];
const readBoard = () => cells().map(c => (c.classList.contains("on") ? 1 : 0));
const levelOf = () => $("q-level-label").textContent;

/* ---- start screen ---- */
ok(!$("screen-home").classList.contains("hide"), "start screen should be visible");
ok($("screen-game").classList.contains("hide"), "game screen should start hidden");
ok(d.querySelector(".home-top .hub-link").getAttribute("href") === "../",
   "start screen needs the ← All games link to ../");
ok($("title").textContent.replace(/\s/g, "") === "LightsOut", "bouncy title: " + $("title").textContent);
ok(d.querySelectorAll(".diff").length === 4, "four difficulty cards on the start screen");

$("start-btn").click();
ok($("screen-home").classList.contains("hide"), "start should leave the start screen");
ok(!$("screen-game").classList.contains("hide"), "start should show the game");

/* ---- the board, and state that does not depend on colour ---- */
function checkLevelShape(name, size){
  ok(levelOf().includes(name), "level chip should read " + name + ", got " + levelOf());
  ok(cells().length === size * size, name + ": board should have " + size * size + " windows");
  ok($("board").style.gridTemplateColumns === "repeat(" + size + ",1fr)",
     name + ": grid should be " + size + " columns, got " + $("board").style.gridTemplateColumns);
  /* the glyph is a plus on EVERY level — the rule never changes underneath the player */
  const expect = [1,3,5,7];
  [...$("shape-glyph").children].forEach((el, i) => {
    const want = i === 4 ? "c" : expect.indexOf(i) >= 0 ? "f" : "";
    ok(el.className === want, name + ": shape glyph cell " + i + " should be '" + want + "', got '" + el.className + "'");
  });
  /* never colour alone — on and off must carry different glyphs */
  const on = cells().filter(c => c.classList.contains("on"));
  const off = cells().filter(c => !c.classList.contains("on"));
  ok(on.every(c => c.textContent.trim() === "✦"), name + ": a lit window needs its own glyph");
  ok(off.every(c => c.textContent.trim() === "☾"), name + ": a dark window needs its own glyph");
  ok(on.every(c => c.getAttribute("aria-label").endsWith("light on")), name + ": lit windows need an aria-label");
  ok(off.every(c => c.getAttribute("aria-label").endsWith("light off")), name + ": dark windows need an aria-label");
}
checkLevelShape("Easy", 2);
ok(readBoard().some(v => v === 1), "a fresh board should have at least one light on");

/* ---- Undo restores the EXACT previous board ---- */
{
  const before = readBoard().join("");
  ok(!$("undo-btn").classList.contains("invisible"), "Easy should offer Undo");
  ok($("undo-btn").disabled, "Undo should be disabled before the first tap");
  cells()[0].click();
  ok(readBoard().join("") !== before, "a tap should change the board");
  ok(!$("undo-btn").disabled, "Undo should be live after a tap");
  $("undo-btn").click();
  ok(readBoard().join("") === before, "Undo should restore the exact previous board");
  ok($("undo-btn").disabled, "Undo should be disabled again once the stack is empty");
  ok($("lit-count").textContent.includes("0 tap"), "Undo should take the tap back off the count");
}

/* ---- the Undo allowance: every level has it, they differ in how far back you may step ----
   The limit is on a RUN of undos, not a per-puzzle budget: a new tap always refills it, so a
   child can never be stuck unable to take back the thing they just did. */
function undoLadder(key, size){
  switchTo(key);
  const limit = E.LEVELS[key].undoLimit;
  const u = $("undo-btn");
  ok(!u.classList.contains("invisible"), key + ": Undo must be available on every level");
  ok(u.disabled, key + ": Undo should be disabled before the first tap");
  ok(u.textContent.includes("Undo"), key + ": the Undo link should still say Undo");
  if(limit === Infinity) ok(!/\d/.test(u.textContent), key + ": unlimited Undo needs no counter");
  else ok(u.textContent.includes("(" + limit + ")"), key + ": Undo should show " + limit + " left, got " + u.textContent);

  /* Tap the SAME window over and over. Every level's floor puts the minimum at 2 or more, so
     a single click can never reach the solved board — which means this walk can never trip the
     win mid-test the way tapping 4 different windows on a 2×2 would. */
  const history = [];
  const taps = 4;
  for(let t = 0; t < taps; t++){ history.push(readBoard().join("")); cells()[0].click(); }
  ok(!readBoard().every(v => v === 0), key + ": the undo walk should not have solved the board");
  ok(!u.disabled, key + ": Undo should be live after tapping");

  /* step back as far as the level allows, and no further */
  let steps = 0;
  while(!u.disabled && steps < taps){
    u.click(); steps++;
    ok(readBoard().join("") === history[history.length - steps],
       key + ": undo step " + steps + " should restore the exact earlier board");
  }
  const expected = Math.min(limit, taps);
  ok(steps === expected, key + ": should allow " + expected + " steps back in a run, got " + steps);
  if(limit !== Infinity && taps > limit){
    ok(u.disabled, key + ": the run should be spent after " + limit + " undos");
    /* a new tap refills the allowance — this is the rule that keeps it fair */
    cells()[0].click();
    ok(!u.disabled, key + ": a new tap should refill the step-back allowance");
  }
}
undoLadder("EASY", 2);
undoLadder("MEDIUM", 3);
undoLadder("HARD", 4);
undoLadder("EXPERT", 5);
ok(true, "undo ladder checked on all four levels");

switchTo("EASY");

/* ---- Hint: unlimited, always a window from the current shortest solution ---- */
{
  const h = $("hint-link");
  ok(!!h, "the game needs a #hint-link");
  ok(h.className.includes("tlink"), "Hint is a text link, not a .btn");
  ok(h.closest(".actions"), "Hint belongs in the .actions row under the board");
  ok(d.querySelectorAll(".win.hinted").length === 0, "nothing should be highlighted before a hint");

  const { size } = E.LEVELS.EASY;
  const before = readBoard();
  const mask = E.solveMask(before, size);
  h.click();

  const hinted = [...d.querySelectorAll(".win.hinted")];
  ok(hinted.length === 1, "a hint should point at exactly one window, got " + hinted.length);
  const i = Number(hinted[0].dataset.i);
  ok((mask >> i & 1) === 1, "the hinted window must belong to a minimum solution");
  /* it prefers a LIT window, but only when the solution actually contains one */
  const solutionCells = [];
  for(let c = 0; c < before.length; c++) if(mask >> c & 1) solutionCells.push(c);
  const anyLit = solutionCells.some(c => before[c] === 1);
  ok(!anyLit || before[i] === 1, "the hint should prefer a lit window when the solution has one");
  ok($("feedback").textContent.includes("dashed ring"), "the hint should say what to look for");
  ok(readBoard().join("") === before.join(""), "a hint must not change the board");

  /* hints are unlimited — asking again on an unchanged board must stay correct and stay single */
  for(let n = 0; n < 3; n++){
    h.click();
    const again = [...d.querySelectorAll(".win.hinted")];
    ok(again.length === 1, "repeat hint " + n + " should still ring exactly one window");
    ok(Number(again[0].dataset.i) === i, "an unchanged board should keep pointing at the same window");
    ok(readBoard().join("") === before.join(""), "repeat hints must not change the board");
  }

  /* taking the hint must leave the puzzle exactly one step shorter */
  const minBefore = E.solveMin(before, size);
  cells()[i].click();
  ok(E.solveMin(readBoard(), size) === minBefore - 1,
     "following the hint should drop the minimum by exactly 1");
  ok(d.querySelectorAll(".win.hinted").length === 0, "tapping should clear the hint ring");

  /* and a hint stays available after the board moves on — including mid-solve */
  ok(!$("hint-link").classList.contains("off"), "Hint should never be disabled during play");
  h.click();
  const mid = [...d.querySelectorAll(".win.hinted")];
  ok(mid.length === 1, "a hint should still work after a tap");
  ok((E.solveMask(readBoard(), size) >> Number(mid[0].dataset.i) & 1) === 1,
     "the hint must be recomputed against the CURRENT board, not the one it was dealt");

  $("skip-btn").click();
  ok(d.querySelectorAll(".win.hinted").length === 0, "a fresh puzzle starts with no hint ring");
}

/* ---- solving the board wins, and the win lands in the right places ---- */
function solveCurrent(levelKey){
  const { size } = E.LEVELS[levelKey];
  const mask = E.solveMask(readBoard(), size);
  ok(mask > 0, levelKey + ": the board on screen should be solvable");
  const taps = [];
  for(let i = 0; i < size * size; i++) if(mask >> i & 1) taps.push(i);
  for(const i of taps) cells()[i].click();
  return taps.length;
}
{
  const taps = solveCurrent("EASY");
  ok(readBoard().every(v => v === 0), "solving should turn every light off");
  ok(!$("result-view").classList.contains("hide"), "the result should appear on a win");
  ok($("stars").textContent === "★★★", "a minimum solve should earn three stars, got " + $("stars").textContent);
  ok($("rsub").textContent.includes("shortest way was " + taps), "the result should name the shortest solution");
  /* the bottom slot: Next replaces the placeholder in place */
  ok(!$("next-btn").classList.contains("invisible"), "Next ▶ should be revealed on the win");
  ok($("next-btn").closest(".serve-row"), "Next ▶ belongs in the bottom .serve-row slot");
  ok($("next-btn").className.includes("btn"), "Next ▶ is a real .btn, not a link");
  /* nothing in the top bar may move */
  ok($("skip-btn").classList.contains("invisible"), "Skip should hide with .invisible on a win");
  ok(!$("skip-btn").classList.contains("hide"), "Skip must keep its box, so the owl stays centred");
  ok($("owl-game").classList.contains("win"), "the owl should celebrate");
  ok(d.querySelectorAll(".win.hinted").length === 0, "no hint ring should survive the win");
  $("hint-link").click();
  ok(d.querySelectorAll(".win.hinted").length === 0, "Hint should do nothing once the puzzle is solved");
  /* a solved board must not keep accepting taps */
  const solved = readBoard().join("");
  cells()[0].click();
  ok(readBoard().join("") === solved, "the board should be inert once solved");
}

/* ---- Next gives a fresh, different puzzle and restores the play state ---- */
{
  const before = readBoard().join("");
  $("next-btn").click();
  ok(readBoard().join("") !== before, "Next should load a different puzzle");
  ok(readBoard().some(v => v === 1), "Next should load an unsolved puzzle");
  ok($("result-view").classList.contains("hide"), "the result should be cleared");
  ok($("next-btn").classList.contains("invisible"), "Next should go back to an invisible placeholder");
  ok(!$("skip-btn").classList.contains("invisible"), "Skip should come back");
  ok(!$("owl-game").classList.contains("win"), "the owl should go back to playing");
}

/* ---- hints cap the stars: ★★★ is only for solving it unaided ---- */
{
  /* one hint, then a perfect solve — efficient, but not unaided */
  $("hint-link").click();
  solveCurrent("EASY");
  ok($("stars").textContent === "★★☆",
     "a minimum solve with 1 hint should give 2 stars, got " + $("stars").textContent);
  ok($("rsub").textContent.includes("1 hint used"), "the result should own up to the hint");
  $("next-btn").click();

  /* past HINT_MAX, the round drops to a single star however tidy the solve was */
  for(let i = 0; i < E.HINT_MAX + 1; i++) $("hint-link").click();
  solveCurrent("EASY");
  ok($("stars").textContent === "★☆☆",
     "more than " + E.HINT_MAX + " hints should give 1 star, got " + $("stars").textContent);
  ok($("rsub").textContent.includes((E.HINT_MAX + 1) + " hints used"), "the result should count the hints");
  $("next-btn").click();

  /* and a fresh puzzle starts the hint count over */
  solveCurrent("EASY");
  ok($("stars").textContent === "★★★", "a fresh unaided solve should be back to 3 stars");
  ok(!$("rsub").textContent.includes("hint"), "no hints used, so the result should not mention any");
  $("next-btn").click();
}

/* ---- Skip never hands back the same board ---- */
for(let i = 0; i < 30; i++){
  const before = readBoard().join("");
  $("skip-btn").click();
  ok(readBoard().join("") !== before, "Skip must serve a puzzle different from the current one");
}

/* ---- the level chip is a working switcher ---- */
function switchTo(key){
  $("q-level").click();
  ok($("level-menu").classList.contains("open"), "the level chip should open the menu");
  d.querySelector('.level-opt[data-diff="' + key + '"]').click();
  ok(!$("level-menu").classList.contains("open"), "picking a level should close the menu");
  ok(!$("screen-game").classList.contains("hide"), "switching level should stay in the game");
}
switchTo("MEDIUM");  checkLevelShape("Medium", 3);
switchTo("HARD");    checkLevelShape("Hard", 4);
switchTo("EXPERT");  checkLevelShape("Expert", 5);
/* every level must be finishable through the UI, the 5×5 Expert town included */
for(const key of ["EXPERT", "HARD", "MEDIUM", "EASY"]){
  switchTo(key);
  /* Hint is offered on every level, Undo is not — check it points somewhere real here too */
  ok(!$("hint-link").classList.contains("invisible"), key + ": Hint should be offered");
  ok(!$("undo-btn").classList.contains("invisible"), key + ": Undo should be offered on every level");
  {
    const { size } = E.LEVELS[key];
    const mask = E.solveMask(readBoard(), size);
    $("hint-link").click();
    const hinted = [...d.querySelectorAll(".win.hinted")];
    ok(hinted.length === 1, key + ": the hint should point at one window");
    ok((mask >> Number(hinted[0].dataset.i) & 1) === 1,
       key + ": the hinted window must belong to a minimum solution");
  }
  solveCurrent(key);
  ok(readBoard().every(v => v === 0), key + ": should be solvable through the UI");
  ok(!$("result-view").classList.contains("hide"), key + ": should reach the win state");
  $("next-btn").click();
}

/* ---- Escape closes the level menu; the rules sheet owns the keyboard while open ---- */
$("q-level").click();
d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
ok(!$("level-menu").classList.contains("open"), "Escape should close the level menu");

$("rules-btn").click();
ok($("rules-ov").classList.contains("show"), "the in-game Rules link should open the sheet");
{
  const before = readBoard().join("");
  d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  ok(readBoard().join("") === before, "play keys must do nothing while the rules sheet is up");
}
$("rules-ok").click();
ok(!$("rules-ov").classList.contains("show"), "'Got it!' should close the sheet");

/* ---- keyboard: arrows walk the focus ring, and it never leaves the grid ---- */
{
  /* whatever level the walk above left us on — read the real grid, do not assume one */
  const size = Math.round(Math.sqrt(cells().length));
  cells()[0].focus();
  const press = k => d.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true }));
  press("ArrowLeft");
  ok(d.activeElement === cells()[0], "ArrowLeft at the left edge should stay put");
  press("ArrowUp");
  ok(d.activeElement === cells()[0], "ArrowUp on the top row should stay put");
  press("ArrowRight");
  ok(d.activeElement === cells()[1], "ArrowRight should move one to the right");
  press("ArrowDown");
  ok(d.activeElement === cells()[1 + size], "ArrowDown should move one row down");
  ok(cells()[1 + size].tabIndex === 0 && cells()[0].tabIndex === -1,
     "only the focused window should be in the tab order");
  const before = readBoard().join("");
  cells()[1 + size].click();
  ok(readBoard().join("") !== before, "the focused window should be activatable");
}

/* ---- Home returns to this game's own start screen ---- */
$("home-btn").click();
ok(!$("screen-home").classList.contains("hide"), "Home should return to the start screen");
ok($("screen-game").classList.contains("hide"), "Home should leave the game screen");

report("lights-out play-through");
