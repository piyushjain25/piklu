"use strict";
/* Headless play-through of the real page: a board solves through the UI and the win lands in
   the right slots, illegal pours keep the selection, Undo/Reset restore exact states, Skip/Next
   and the level chip deal fresh boards without leaving the game, Hint leads to a win, the
   stuck nudge fires, and the pour animation's busy flag keeps rapid taps from desyncing. */
const { bootGame, loadEngine, tally, sleep } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("juice-jumble");
const EMOJI = E.FLAVOURS.map(f => f.emoji);

function page(opts){
  const p = bootGame("juice-jumble", Object.assign({ reducedMotion:true, seed:4242,
    onError: e => ok(false, "page error: " + e.message) }, opts));
  p.glasses = () => [...p.d.querySelectorAll("#bar .glass")];
  /* read the board back out of the DOM by glyph — the same way a colour-blind child would */
  p.board = () => p.glasses().map(g => [...g.querySelectorAll(".gl")].map(s => EMOJI.indexOf(s.textContent)));
  p.cap = () => +p.$("bar").style.getPropertyValue("--cap");
  p.tap = i => p.glasses()[i].click();
  p.selected = () => p.glasses().findIndex(g => g.getAttribute("aria-pressed") === "true");
  p.won = () => !p.$("result-view").classList.contains("hide");
  p.owl = m => p.$("owl-game").classList.contains(m);
  return p;
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const P = page();
  const { $, d, w } = P;

  /* ---- start screen ---- */
  ok(!$("screen-home").classList.contains("hide"), "start screen visible first");
  ok(d.querySelector(".home-top .hub-link").getAttribute("href") === "../", "← All games link to ../");
  ok($("title").textContent.replace(/\s/g, "") === "JuiceJumble", "bouncy title");
  ok(d.querySelectorAll(".diff").length === 4, "four level cards");
  $("start-btn").click();
  ok($("screen-home").classList.contains("hide") && !$("screen-game").classList.contains("hide"), "Start enters the game");
  ok(!d.querySelector("#screen-game .hub-link"), "no ← All games link during play");

  /* ---- the board carries glyphs, never colour alone ---- */
  let B = P.board();
  ok(P.glasses().length === 5 && P.cap() === 3, "Easy: 5 glasses of depth 3");
  ok(B.flat().every(f => f >= 0), "every band shows its fruit glyph");
  ok(B.filter(g => !g.length).length === 2, "Easy deals two empty glasses");
  ok(P.glasses().every(g => /^Glass \d/.test(g.getAttribute("aria-label"))), "every glass has an aria-label");

  /* ---- control scheme ---- */
  ok($("next-btn").closest(".serve-row") && $("next-btn").classList.contains("invisible"),
     "Next ▶ holds the bottom slot, invisible during play");
  ok($("next-btn").classList.contains("btn"), "Next is a real .btn");
  const acts = [...d.querySelectorAll("#screen-game .actions .tlink")].map(b => b.id);
  ok(eq(acts, ["undo-btn", "reset-btn", "hint-link", "rules-btn"]), "Undo · Reset · Hint (+ Rules) under the glasses: " + acts);
  ok($("undo-btn").disabled && $("undo-btn").classList.contains("off"), "Undo is dimmed with an empty stack");
  ok(d.querySelectorAll("#screen-game .btn").length === 1, "the only real button in play is the bottom slot");

  /* ---- select / cancel / illegal ---- */
  const cap = P.cap();
  const src = B.findIndex(g => g.length && !E.isDone(g, cap));
  P.tap(src);
  ok(P.selected() === src, "tapping a glass picks it up");
  ok(P.glasses()[src].classList.contains("sel"), "the picked-up glass lifts");
  ok(P.glasses()[src].querySelectorAll(".gl.mv").length === E.topRun(B[src]), "its movable top run is highlighted");
  P.tap(src);
  ok(P.selected() === -1, "tapping it again cancels");
  P.tap(src);
  d.dispatchEvent(new w.KeyboardEvent("keydown", { key:"Escape", bubbles:true }));
  ok(P.selected() === -1, "Escape cancels the selection");

  let bad = null;
  for(let i = 0; i < B.length && !bad; i++) for(let j = 0; j < B.length && !bad; j++)
    if(i !== j && B[i].length && !E.isDone(B[i], cap) && B[j].length && !E.canPour(B, i, j, cap)) bad = [i, j];
  ok(!!bad, "found an illegal pour to try");
  P.tap(bad[0]); P.tap(bad[1]);
  ok(P.selected() === bad[0], "an illegal target keeps the current selection");
  ok(eq(P.board(), B), "an illegal pour changes nothing");
  ok($("feedback").className.includes("bad"), "an illegal pour says why");
  P.tap(bad[0]);

  /* ---- a legal pour, then Undo restores the exact prior state ---- */
  const [li, lj] = E.legalMoves(B, cap)[0];
  P.tap(li); P.tap(lj);
  ok(eq(P.board(), E.pour(B, li, lj, cap)), "a pour updates the board exactly as the engine says");
  ok($("pour-count").textContent.startsWith("1 pour"), "the pour is counted: " + $("pour-count").textContent);
  ok(!$("undo-btn").disabled, "Undo is live after a pour");
  $("undo-btn").click();
  ok(eq(P.board(), B), "Undo restores the exact previous board");
  ok($("pour-count").textContent.startsWith("0 pour"), "Undo rewinds the count");
  ok($("undo-btn").disabled, "Undo dims again with an empty stack");

  /* ---- Reset restores the opening deal ---- */
  for(let s = 0; s < 3; s++){ const m = E.legalMoves(P.board(), cap)[0]; if(m){ P.tap(m[0]); P.tap(m[1]); } }
  ok(!eq(P.board(), B), "a few pours moved things");
  $("reset-btn").click();
  ok(eq(P.board(), B), "Reset restores the opening deal");
  ok($("undo-btn").disabled, "Reset clears the undo stack");

  /* ---- solve through the UI with solveMin ---- */
  async function solveHere(label){
    const path = E.solveMin(P.board(), P.cap()).path;
    ok(!!path, label + ": board should be solvable");
    for(const [i, j] of path || []){ P.tap(i); P.tap(j); }
    ok(P.won(), label + ": the win fires the instant the last glass goes pure");
    return path ? path.length : 0;
  }
  const n = await solveHere("Easy");
  ok(!$("next-btn").classList.contains("invisible"), "Next ▶ appears on the win");
  ok($("skip-btn").classList.contains("invisible") && !$("skip-btn").classList.contains("hide"),
     "Skip hides via .invisible (keeps its box), never display:none");
  ok($("stars").textContent === "★★★", "a shortest solve earns 3 stars: " + $("stars").textContent);
  ok($("rsub").textContent.includes(n + " pour"), "result reports the pour count");
  ok(P.owl("win"), "owl celebrates");
  ok(d.activeElement === $("next-btn"), "focus lands on Next");

  /* ---- Next and Skip deal a different board ---- */
  const before = E.boardKey(B);             /* the opening deal that was just solved */
  $("next-btn").click();
  ok(!P.won() && $("next-btn").classList.contains("invisible") && !$("skip-btn").classList.contains("invisible"),
     "Next restores the play state");
  ok(E.boardKey(P.board()) !== before, "Next deals a different board");
  for(let t = 0; t < 30; t++){
    const k = E.boardKey(P.board());
    $("skip-btn").click();
    if(E.boardKey(P.board()) === k){ ok(false, "Skip reproduced the current board"); break; }
  }

  /* ---- level chip switches without leaving the game ---- */
  $("q-level").click();
  ok($("level-menu").classList.contains("open"), "level chip opens its menu");
  d.querySelector('.level-opt[data-diff="EXPERT"]').click();
  ok(!$("level-menu").classList.contains("open"), "picking a level closes the menu");
  ok(!$("screen-game").classList.contains("hide"), "switching level stays in the game");
  ok($("q-level-label").textContent.includes("Expert"), "chip reads Expert");
  B = P.board();
  ok(B.length === 8 && B.filter(g => !g.length).length === 1 && P.cap() === 4, "Expert: 8 glasses, one spare, depth 4");
  ok($("bar").style.getPropertyValue("--cols") === "4", "Expert lays out as two rows of four");

  /* ---- Hint leads all the way to a win ---- */
  let hints = 0;
  while(!P.won() && hints < 60){
    $("hint-link").click(); hints++;
    const from = P.glasses().findIndex(g => g.classList.contains("hint-from"));
    const to = P.glasses().findIndex(g => g.classList.contains("hint-to"));
    if(from < 0 || to < 0){ ok(false, "Hint should ring a source and a destination"); break; }
    P.tap(from); P.tap(to);
  }
  ok(P.won(), "following hints solves an Expert board (" + hints + " hints)");
  ok($("rsub").textContent.includes(hints + " hint"), "the hint count is reported: " + $("rsub").textContent);

  /* ---- stuck detection: play at random until the board is stuck, then check the nudge ---- */
  let nudged = false;
  for(let round = 0; round < 40 && !nudged; round++){
    $("skip-btn").click();
    for(let s = 0; s < 30; s++){
      const b = P.board(), m = E.legalMoves(b, 4);
      if(!m.length) break;
      const [i, j] = m[(s * 7 + round) % m.length];
      P.tap(i); P.tap(j);
      if(P.won()) break;
      const now = P.board();
      if(!E.legalMoves(now, 4).length || E.isSolvable(now, 4) === false){
        ok(P.owl("worried"), "a stuck board worries the owl");
        ok(/stuck|No pours/.test($("feedback").textContent), "and flash()es a nudge: " + $("feedback").textContent);
        ok(!$("undo-btn").disabled, "Undo stays available from a stuck board");
        $("undo-btn").click();
        ok(!P.owl("worried"), "Undo clears the worried owl");
        nudged = true;
        break;
      }
    }
  }
  ok(nudged, "random play should reach a stuck board");

  /* ---- keyboard ---- */
  $("skip-btn").click();
  P.glasses()[0].focus();
  P.glasses()[0].dispatchEvent(new w.KeyboardEvent("keydown", { key:"ArrowRight", bubbles:true }));
  ok(d.activeElement === P.glasses()[1], "ArrowRight moves focus to the next glass");
  P.glasses()[1].dispatchEvent(new w.KeyboardEvent("keydown", { key:"ArrowDown", bubbles:true }));
  ok(d.activeElement === P.glasses()[5], "ArrowDown moves to the glass below (two rows of four)");
  ok(P.glasses().filter(g => g.tabIndex === 0).length === 1, "one roving tab stop");

  /* ---- Home ---- */
  $("home-btn").click();
  ok(!$("screen-home").classList.contains("hide") && $("screen-game").classList.contains("hide"), "Home returns to the start screen");

  /* ---- with motion: the busy flag blocks input during the pour animation ---- */
  {
    const M = page({ reducedMotion:false, seed:77 });
    M.$("start-btn").click();
    const b0 = M.board(), c = M.cap();
    const [i, j] = E.legalMoves(b0, c)[0];
    M.tap(i); M.tap(j);
    ok(eq(M.board(), b0), "the board doesn't change until the pour animation lands");
    ok(M.glasses()[i].classList.contains("away"), "the real source glass steps aside while its double pours");
    await sleep(500);
    ok(M.$("pour-layer").innerHTML.includes("lifted"), "the pouring beaker is drawn on the overlay");
    /* rapid taps while pouring are ignored */
    const extra = E.legalMoves(E.pour(b0, i, j, c), c)[0];
    M.tap(extra[0]); M.tap(extra[1]);
    M.$("undo-btn").click();
    await sleep(2200);
    ok(eq(M.board(), E.pour(b0, i, j, c)), "exactly one pour lands — taps during the animation are dropped");
    ok(M.$("pour-count").textContent.startsWith("1 pour"), "count agrees with the board");
    ok(M.selected() === -1, "no stray selection left over from the blocked taps");
    ok(M.$("pour-layer").innerHTML === "", "the overlay is cleared once the pour settles");
    ok(!M.glasses()[i].classList.contains("away"), "the source glass is back in its place");
    M.tap(extra[0]);
    ok(M.selected() === extra[0], "input works again once the pour settles");
    M.dom.window.close();
  }

  report("juice-jumble play-through");
})();
