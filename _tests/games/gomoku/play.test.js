"use strict";
/* gomoku play-through: boots the real page in jsdom and drives it like a player — start, put
   a stone down, the owl's reply, taken spots, hints, the level switcher rebuilding the board,
   keyboard play, captures at EXPERT, Skip/Home cancelling the owl's pending move, and whole
   games at every level with the result and bottom slot checked. */
const { bootGame, sleep, loadEngine, mulberry32, tally } = require("../../lib/harness.js");
const E = loadEngine("gomoku");   /* the real engine, to drive the page into a capture */
const { ok, report } = tally();

const OWL_WAIT = 400;                 /* reduced motion: the owl replies after 250ms */

function boot(opts = {}) {
  const errors = [];
  const g = bootGame("gomoku", Object.assign({ reducedMotion: true, seed: 7, onError: e => errors.push(e.message) }, opts));
  g.errors = errors;
  g.stone = i => { const s = g.$("s" + i); const d = s && s.firstChild; return !d ? 0 : d.classList.contains("you") ? 1 : 2; };
  g.cells = () => [...g.d.querySelectorAll(".cell")];
  g.board = () => g.cells().map((_, i) => g.stone(i));
  g.count = v => g.board().filter(x => x === v).length;
  g.start = level => { g.d.querySelector('.diff[data-diff="' + level + '"]').click(); g.$("start-btn").click(); };
  g.over = () => !g.$("next-btn").classList.contains("invisible");
  return g;
}
/* play to the end using the page's own Hint each turn (else the first open spot) */
async function playOut(g) {
  let turns = 0, hints = 0;
  while (!g.over() && turns < 400) {
    g.$("hint-link").click(); hints++;
    const pick = g.d.querySelector(".cell.hinted") || g.d.querySelector(".cell.open:not(:disabled)");
    if (!pick) break;
    pick.click();
    await sleep(OWL_WAIT);
    turns++;
  }
  return { turns, hints };
}

(async () => {
  /* ---- start screen ------------------------------------------------------------------- */
  {
    const g = boot();
    const { $, d } = g;
    ok(!$("screen-home").classList.contains("hide") && $("screen-game").classList.contains("hide"), "opens on the start screen");
    ok(d.querySelectorAll(".diff").length === 4, "four level cards");
    ok(d.querySelector('.diff[data-diff="EASY"]').getAttribute("aria-pressed") === "true", "EASY picked by default");
    ok(d.querySelector(".hub-link").getAttribute("href") === "../", "← All games points to the hub");
    ok($("title").textContent.replace(/\s/g, "") === "Gomoku", "bouncy title reads Gomoku");
    d.querySelector('.diff[data-diff="HARD"]').click();
    ok(d.querySelector('.diff[data-diff="HARD"]').getAttribute("aria-pressed") === "true"
       && d.querySelector('.diff[data-diff="EASY"]').getAttribute("aria-pressed") === "false", "tapping a card picks that level");
    $("rules-home").click();
    ok(d.getElementById("rules-ov").classList.contains("show") && d.querySelectorAll("#rules-body .rule").length >= 5,
       "📖 Read the full rules opens the sheet");
    d.getElementById("rules-ok").click();
    ok(!d.getElementById("rules-ov").classList.contains("show"), "Got it! closes the sheet");
    ok(g.errors.length === 0, "no page errors on the start screen: " + g.errors.join("; "));
    g.w.close();
  }

  /* ---- a turn: place, lock while the owl thinks, the owl's reply ----------------------- */
  {
    const g = boot();
    const { $, d } = g;
    g.start("EASY");
    ok($("screen-home").classList.contains("hide") && !$("screen-game").classList.contains("hide"), "Start shows the game");
    ok(g.cells().length === 81 && d.querySelectorAll("#gb-pieces .gb-slot").length === 81, "EASY builds a 9×9 board");
    ok($("stage").style.getPropertyValue("--cols") === "9", "the board's size is handed to the CSS");
    ok($("gb-line").getAttribute("viewBox") === "0 0 9 9", "the win-line layer matches the board");
    ok($("caps-wrap").classList.contains("hide"), "no capture counters outside EXPERT");
    ok(!$("skip-btn").classList.contains("invisible") && $("next-btn").classList.contains("invisible"),
       "Skip visible, Play again holding its slot invisibly");
    ok($("q-level-label").textContent === "🌱 Easy", "level chip reads Easy");
    ok(g.cells().every(c => !c.disabled && c.classList.contains("open")), "every spot open on your first turn");
    ok(/🔴 Your turn/.test($("feedback").textContent), "the turn line says it's your turn");
    ok(g.cells()[40].getAttribute("aria-label") === "Row 5, column 5, empty", "each spot names its row and column");

    g.cells()[40].click();
    ok(g.stone(40) === 1 && g.count(1) === 1 && g.count(2) === 0, "your stone lands on the spot you tapped");
    ok(!g.cells()[40].classList.contains("open") && $("s40").classList.contains("last"), "the spot is taken and marked as the last move");
    ok(g.cells().every(c => c.disabled), "the board is locked while the owl thinks");
    ok(/🟡 The owl is thinking/.test($("feedback").textContent), "the turn line says the owl is thinking");
    g.cells()[41].click();
    ok(g.count(1) === 1, "a tap while the owl thinks does nothing");
    await sleep(OWL_WAIT);
    ok(g.count(1) === 1 && g.count(2) === 1, "the owl puts down one stone in reply");
    ok(g.cells().some(c => !c.disabled), "your turn again after the owl");
    ok(/Your turn/.test($("feedback").textContent), "feedback says it's your turn");
    ok(g.cells()[40].getAttribute("aria-label") === "Row 5, column 5, your stone", "a taken spot says whose stone it is");

    /* a taken spot stays focusable — the board can be read with the arrow keys — but refuses a stone */
    ok(!g.cells()[40].disabled, "a taken spot stays focusable so the board can be walked");
    g.cells()[40].click();
    ok(g.count(1) === 1 && $("feedback").className.includes("bad") && /taken/.test($("feedback").textContent),
       "tapping a taken spot is refused with a message");
    ok(g.errors.length === 0, "no page errors during turns: " + g.errors.join("; "));
    g.w.close();
  }

  /* ---- hint ------------------------------------------------------------------------------ */
  {
    const g = boot();
    const { $, d } = g;
    g.start("MEDIUM");
    ok(g.cells().length === 121, "MEDIUM builds an 11×11 board");
    $("hint-link").click();
    ok(d.querySelectorAll(".cell.hinted").length === 1, "Hint lights exactly one spot");
    ok($("feedback").className.includes("hint") && /row \d+, column \d+/.test($("feedback").textContent),
       "Hint names the row and column");
    const lit = d.querySelector(".cell.hinted");
    ok(lit.classList.contains("open"), "the hint always points at an empty spot");
    lit.click();
    ok(d.querySelectorAll(".cell.hinted").length === 0, "the glow clears once you move");
    await sleep(OWL_WAIT);
    g.w.close();
  }

  /* ---- keyboard --------------------------------------------------------------------------- */
  {
    const g = boot();
    const { $, d } = g;
    g.start("EASY");
    g.cells()[0].focus();
    const key = k => d.dispatchEvent(new g.w.KeyboardEvent("keydown", { key: k, bubbles: true }));
    key("ArrowRight");
    ok(d.activeElement.id === "c1", "→ steps one spot along the row");
    key("ArrowDown");
    ok(d.activeElement.id === "c10", "↓ steps one row down");
    key("ArrowLeft"); key("ArrowUp");
    ok(d.activeElement.id === "c0", "← and ↑ step back");
    key("ArrowUp");
    ok(d.activeElement.id === "c0", "the top edge stops the walk");
    d.getElementById("c10").focus();
    d.activeElement.click();
    ok(g.stone(10) === 1, "Enter/Space on a spot puts your stone there (the button's own click)");
    await sleep(OWL_WAIT);
    ok(d.activeElement.id === "c10", "focus comes back to where the keyboard left it");
    $("rules-btn").click();
    const before = g.count(1);
    key("ArrowRight");
    ok(g.count(1) === before, "the board keys do nothing while the rules sheet is open");
    d.getElementById("rules-close").click();
    ok(g.errors.length === 0, "no page errors playing by keyboard: " + g.errors.join("; "));
    g.w.close();
  }

  /* ---- Skip and Home cancel the owl's pending move ---------------------------------------- */
  {
    const g = boot();
    const { $ } = g;
    g.start("EASY");
    g.cells()[40].click();
    $("skip-btn").click();
    await sleep(OWL_WAIT);
    ok(g.count(1) === 0 && g.count(2) === 0, "Skip starts a fresh empty board and the owl doesn't move on it");
    ok(g.cells().every(c => !c.disabled), "after Skip it is your turn");
    g.cells()[40].click();
    $("home-btn").click();
    ok(!$("screen-home").classList.contains("hide"), "Home returns to the start screen");
    await sleep(OWL_WAIT);
    ok(g.count(2) === 0, "the owl doesn't move after you've gone Home");
    ok(g.errors.length === 0, "no page errors on Skip/Home: " + g.errors.join("; "));
    g.w.close();
  }

  /* ---- the level switcher rebuilds the board ---------------------------------------------- */
  {
    const g = boot();
    const { $, d } = g;
    g.start("EASY");
    g.cells()[40].click();
    await sleep(OWL_WAIT);
    $("q-level").click();
    ok(d.querySelectorAll(".level-opt").length === 4, "the level menu lists four levels");
    d.querySelector('.level-opt[data-diff="EXPERT"]').click();
    ok($("q-level-label").textContent === "🏆 Expert" && !$("screen-game").classList.contains("hide"),
       "picking Expert switches level and stays in the game");
    ok(g.cells().length === 169 && $("stage").style.getPropertyValue("--cols") === "13",
       "the board is rebuilt at the new size");
    ok(g.count(1) === 0 && g.count(2) === 0, "the new level starts on an empty board");
    ok(!$("caps-wrap").classList.contains("hide") && d.querySelectorAll("#cap-you .pip").length === 5,
       "EXPERT shows the five capture pips for each side");
    ok(d.querySelectorAll("#cap-you .pip.on").length === 0, "no pairs taken yet");
    ok(g.errors.length === 0, "no page errors switching levels: " + g.errors.join("; "));
    g.w.close();
  }

  /* ---- EXPERT: taking a pair off the board ------------------------------------------------ */
  {
    /* motion is on here, so the stones flying off the board are checked too */
    const g = boot({ reducedMotion: false, seed: 3 });
    const { $, d } = g;
    g.start("EXPERT");
    const N = 13;
    ok(g.cells().length === N * N, "EXPERT builds a 13×13 board");
    ok(!$("caps-wrap").classList.contains("hide"), "EXPERT shows the capture counters");
    let took = 0, turns = 0, caps = [0, 0, 0], flew = false;
    const rng = mulberry32(19);
    while (turns < 40 && !g.over() && took < 2) {
      const b = g.board();
      /* the owl decides where its stones go, so watch for a sandwich of its two to close;
         with none to close, play a sensible move and wait for one */
      let close = -1, most = 0;
      for (const m of E.nearMoves(b, N, 1)) {
        const t = E.capturesAt(b, m, 1, N).length;
        if (t > most) { most = t; close = m; }
      }
      const m = most ? close : E.carefulMove(b, caps, 1, "capture", N, rng);
      const owlsBefore = g.count(2), mineBefore = g.count(1);
      g.cells()[m].click();
      if (most) {
        ok(g.count(2) === owlsBefore - most, "closing the sandwich takes the owl's stones off the board");
        /* the owl's own fly-outs may still be clearing, so count only its colour */
        ok(d.querySelectorAll("#gb-fx .piece.bird.gone").length === most, "the taken stones fly off on their own layer");
        caps[1] += most;
        took++;
        ok(d.querySelectorAll("#cap-you .pip.on").length === caps[1] / 2,
           "a pip lights up for each pair you have taken (" + caps[1] / 2 + ")");
        ok(/You took/.test($("feedback").textContent), "the page says you took a pair: " + $("feedback").textContent);
      }
      await sleep(750);
      /* the owl captures under the same rule — count what it took from the board */
      const lost = mineBefore + 1 - g.count(1);
      if (lost > 0) {
        caps[2] += lost;
        ok(d.querySelectorAll("#cap-owl .pip.on").length === caps[2] / 2,
           "the owl's pips light up when it takes a pair of yours");
        ok(/The owl took/.test($("feedback").textContent), "the page says the owl took a pair");
      }
      turns++;
    }
    ok(took >= 2, "captures really happen on the page (" + took + " in " + turns + " turns)");
    ok(caps[2] > 0, "and the owl takes pairs of yours under the same rule (" + caps[2] / 2 + ")");
    ok(g.errors.length === 0, "no page errors capturing: " + g.errors.join("; "));
    g.w.close();
  }

  /* ---- whole games at every level ------------------------------------------------------- */
  const outcomes = {};
  for (const level of ["EASY", "MEDIUM", "HARD", "EXPERT"]) {
    const g = boot({ seed: level === "EASY" ? 3 : 7 });
    const { $ } = g;
    g.start(level);
    const { turns, hints } = await playOut(g);
    ok(g.over(), level + ": the game finishes (" + turns + " turns)");
    ok(!$("result-view").classList.contains("hide"), level + ": the result shows");
    ok($("skip-btn").classList.contains("invisible") && !$("skip-btn").classList.contains("hide"),
       level + ": Skip hides but keeps its box");
    ok(g.cells().every(c => c.disabled), level + ": the board is locked once the game is over");
    const stars = $("stars").textContent, label = $("rlabel").textContent;
    const filled = (stars.match(/★/g) || []).length;
    ok(stars.length === 3, level + ": three star places");
    let kind;
    if (/you win/.test(label)) { kind = "win"; ok(filled === Math.max(1, 3 - hints), level + ": a win scores 3 stars minus hints"); }
    else if (/The owl/.test(label)) { kind = "loss"; ok(filled === 0, level + ": a loss earns no stars"); }
    else { kind = "tie"; ok(/tie/.test(label) && filled === 1, level + ": a tie earns one star"); }
    if (kind !== "tie" && /in a row/.test(label)) {
      ok(g.d.querySelectorAll(".gb-slot.win").length >= 5, level + ": the winning five is lit");
      ok(g.d.querySelectorAll("#gb-line line.wl-front").length >= 1, level + ": a line is drawn through the five");
    } else ok(g.d.querySelectorAll("#gb-line line").length === 0, level + ": no line when nobody made five");
    outcomes[level] = kind;
    /* Play again starts fresh at the same level */
    $("next-btn").click();
    ok(g.count(1) === 0 && g.count(2) === 0 && $("next-btn").classList.contains("invisible")
       && !$("skip-btn").classList.contains("invisible") && $("result-view").classList.contains("hide"),
       level + ": Play again clears the board and the bottom slot");
    ok(g.d.querySelectorAll("#gb-line line").length === 0, level + ": Play again clears the win line");
    ok(g.errors.length === 0, level + ": no page errors in a whole game: " + g.errors.join("; "));
    g.w.close();
  }
  console.log("  whole games: " + JSON.stringify(outcomes));

  /* ---- with motion on: the stone pops in, a taken stone flies off ------------------------- */
  {
    const g = boot({ reducedMotion: false });
    g.start("EASY");
    g.cells()[40].click();
    const stone = g.$("s40").firstChild;
    ok(stone && stone.classList.contains("place"), "your stone pops into its spot");
    await sleep(900);
    ok(g.count(2) === 1, "the owl replies with motion on too");
    ok(g.errors.length === 0, "no page errors with motion on: " + g.errors.join("; "));
    g.w.close();
  }

  report("gomoku play-through");
})();
