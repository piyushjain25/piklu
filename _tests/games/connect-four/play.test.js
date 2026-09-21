"use strict";
/* connect-four play-through: boots the real page in jsdom and drives it like a player —
   start, drop, the owl's reply, full columns, hints, Skip/Home cancelling the
   owl's pending move, the level switcher, keyboard play, and whole games to the end at every
   level with the result and bottom slot checked. */
const { bootGame, sleep, tally } = require("../../lib/harness.js");
const { ok, report } = tally();

const COLS = 7, ROWS = 6;
const OWL_WAIT = 400;                 /* reduced motion: the owl replies after 250ms */

function boot(opts = {}) {
  const errors = [];
  const g = bootGame("connect-four", Object.assign({ reducedMotion: true, seed: 7, onError: e => errors.push(e.message) }, opts));
  g.errors = errors;
  g.disc = i => { const d = g.$("s" + i).firstChild; return !d ? 0 : d.classList.contains("you") ? 1 : 2; };
  g.board = () => Array.from({ length: COLS * ROWS }, (_, i) => g.disc(i));
  g.count = v => g.board().filter(x => x === v).length;
  g.cols = () => [...g.d.querySelectorAll(".col")];
  g.start = level => { g.d.querySelector('.diff[data-diff="' + level + '"]').click(); g.$("start-btn").click(); };
  g.over = () => !g.$("next-btn").classList.contains("invisible");
  return g;
}
/* play to the end using the page's own Hint each turn (else the first open column) */
async function playOut(g) {
  let turns = 0, hints = 0;
  while (!g.over() && turns < 200) {
    g.$("hint-link").click(); hints++;
    const pick = g.d.querySelector(".col.hinted") || g.d.querySelector(".col:not(:disabled)");
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
    ok(d.querySelectorAll(".diff").length === 3, "three level cards");
    ok(d.querySelector('.diff[data-diff="EASY"]').getAttribute("aria-pressed") === "true", "EASY picked by default");
    ok(d.querySelector(".hub-link").getAttribute("href") === "../", "← All games points to the hub");
    ok($("title").textContent.replace(/\s/g, "") === "ConnectFour", "bouncy title reads Connect Four");
    d.querySelector('.diff[data-diff="MEDIUM"]').click();
    ok(d.querySelector('.diff[data-diff="MEDIUM"]').getAttribute("aria-pressed") === "true"
       && d.querySelector('.diff[data-diff="EASY"]').getAttribute("aria-pressed") === "false", "tapping a card picks that level");
    $("rules-home").click();
    ok(d.getElementById("rules-ov").classList.contains("show") && d.querySelectorAll("#rules-body .rule").length >= 5,
       "📖 Read the full rules opens the sheet");
    d.getElementById("rules-ok").click();
    ok(!d.getElementById("rules-ov").classList.contains("show"), "Got it! closes the sheet");
    ok(g.errors.length === 0, "no page errors on the start screen: " + g.errors.join("; "));
    g.w.close();
  }

  /* ---- a turn: drop, lock while the owl thinks, the owl's reply ------------------------ */
  {
    const g = boot();
    const { $, d } = g;
    g.start("EASY");
    ok($("screen-home").classList.contains("hide") && !$("screen-game").classList.contains("hide"), "Start shows the game");
    ok(g.cols().length === COLS && d.querySelectorAll("#gb-pieces .gb-slot").length === COLS * ROWS, "a 7×6 board");
    ok(!$("skip-btn").classList.contains("invisible") && $("next-btn").classList.contains("invisible"),
       "Skip visible, Play again holding its slot invisibly");
    ok($("q-level-label").textContent === "🌱 Easy", "level chip reads Easy");
    ok(g.cols().every(c => !c.disabled), "every column open on your first turn");
    ok(/🔴 Your turn/.test($("feedback").textContent), "the turn line says it's your turn");

    g.cols()[3].click();
    ok(g.disc(3) === 1 && g.count(1) === 1 && g.count(2) === 0, "your disc lands at the bottom of column 4");
    ok(g.cols().every(c => c.disabled), "the board is locked while the owl thinks");
    ok(/🟡 The owl is thinking/.test($("feedback").textContent), "the turn line says the owl is thinking");
    g.cols()[2].click();
    ok(g.count(1) === 1, "a tap while the owl thinks does nothing");
    await sleep(OWL_WAIT);
    ok(g.count(1) === 1 && g.count(2) === 1, "the owl drops one disc in reply");
    ok(g.cols().some(c => !c.disabled), "your turn again after the owl");
    ok(/Your turn/.test($("feedback").textContent), "feedback says it's your turn");

    /* a full column: keep dropping in column 1 until it fills (the owl may join in) */
    for (let k = 0; k < ROWS && !g.over(); k++) {
      if (g.cols()[0].disabled) break;
      g.cols()[0].click();
      await sleep(OWL_WAIT);
    }
    if (!g.over()) {
      const full = [0, 1, 2, 3, 4, 5].every(r => g.disc(r * COLS) !== 0);
      ok(full && g.cols()[0].disabled, "a full column's button is disabled");
      const before = g.count(1);
      d.dispatchEvent(new g.w.KeyboardEvent("keydown", { key: "1", bubbles: true }));
      ok(g.count(1) === before && $("feedback").className.includes("bad"), "pressing 1 on a full column is refused with a message");
    }
    ok(g.errors.length === 0, "no page errors during turns: " + g.errors.join("; "));
    g.w.close();
  }

  /* ---- hint ------------------------------------------------------------------------------ */
  {
    const g = boot();
    const { $, d } = g;
    g.start("MEDIUM");
    $("hint-link").click();
    ok(d.querySelectorAll(".col.hinted").length === 1, "Hint lights exactly one column");
    ok($("feedback").className.includes("hint") && /column \d/.test($("feedback").textContent), "Hint names the column");
    d.querySelector(".col.hinted").click();
    ok(d.querySelectorAll(".col.hinted").length === 0, "the glow clears once you move");
    await sleep(OWL_WAIT);
    g.w.close();
  }

  /* ---- Skip and Home cancel the owl's pending move ---------------------------------------- */
  {
    const g = boot();
    const { $ } = g;
    g.start("EASY");
    g.cols()[3].click();
    $("skip-btn").click();
    await sleep(OWL_WAIT);
    ok(g.count(1) === 0 && g.count(2) === 0, "Skip starts a fresh empty board and the owl doesn't move on it");
    ok(g.cols().every(c => !c.disabled), "after Skip it is your turn");
    g.cols()[3].click();
    $("home-btn").click();
    ok(!$("screen-home").classList.contains("hide"), "Home returns to the start screen");
    await sleep(OWL_WAIT);
    ok(g.count(2) === 0, "the owl doesn't move after you've gone Home");
    ok(g.errors.length === 0, "no page errors on Skip/Home: " + g.errors.join("; "));
    g.w.close();
  }

  /* ---- level switcher, keyboard ---------------------------------------------------------- */
  {
    const g = boot();
    const { $, d } = g;
    g.start("EASY");
    g.cols()[3].click();
    await sleep(OWL_WAIT);
    $("q-level").click();
    ok(d.querySelectorAll(".level-opt").length === 3, "the level menu lists three levels");
    d.querySelector('.level-opt[data-diff="EXPERT"]').click();
    ok($("q-level-label").textContent === "🏆 Expert" && !$("screen-game").classList.contains("hide"),
       "picking Expert switches level and stays in the game");
    ok(g.count(1) === 0 && g.count(2) === 0, "the new level starts on an empty board");
    d.dispatchEvent(new g.w.KeyboardEvent("keydown", { key: "5", bubbles: true }));
    ok(g.disc(4) === 1, "pressing 5 drops into column 5");
    await sleep(OWL_WAIT);
    $("rules-btn").click();
    const before = g.count(1);
    d.dispatchEvent(new g.w.KeyboardEvent("keydown", { key: "2", bubbles: true }));
    ok(g.count(1) === before, "keys do nothing while the rules sheet is open");
    d.getElementById("rules-close").click();
    ok(g.errors.length === 0, "no page errors switching levels: " + g.errors.join("; "));
    g.w.close();
  }

  /* ---- whole games at every level ------------------------------------------------------- */
  const outcomes = {};
  for (const level of ["EASY", "MEDIUM", "EXPERT"]) for (const seed of [1, 2, 3]) {
    const g = boot({ seed });
    const { $ } = g;
    g.start(level);
    const { turns, hints } = await playOut(g);
    ok(g.over(), level + "/" + seed + ": the game finishes (" + turns + " turns)");
    ok(!$("result-view").classList.contains("hide"), level + ": the result shows");
    ok($("skip-btn").classList.contains("invisible") && !$("skip-btn").classList.contains("hide"),
       level + ": Skip hides but keeps its box");
    ok(g.cols().every(c => c.disabled), level + ": the board is locked once the game is over");
    const stars = $("stars").textContent, label = $("rlabel").textContent;
    const filled = (stars.match(/★/g) || []).length;
    ok(stars.length === 3, level + ": three star places");
    let kind;
    if (/you win/.test(label)) { kind = "win"; ok(filled === Math.max(1, 3 - hints), level + ": a win scores 3 stars minus hints"); }
    else if (/owl got/.test(label)) { kind = "loss"; ok(filled === 0, level + ": a loss earns no stars"); }
    else { kind = "tie"; ok(/tie/.test(label) && filled === 1, level + ": a tie earns one star"); }
    if (kind !== "tie") {
      ok(g.d.querySelectorAll(".gb-slot.win").length >= 4, level + ": the winning four is lit");
      ok(g.d.querySelectorAll("#gb-line line.wl-front").length >= 1, level + ": a line is drawn through the four");
    } else ok(g.d.querySelectorAll("#gb-line line").length === 0, level + ": no line on a tie");
    outcomes[level] = (outcomes[level] || "") + kind[0];
    /* Play again starts fresh at the same level */
    $("next-btn").click();
    ok(g.count(1) === 0 && g.count(2) === 0 && $("next-btn").classList.contains("invisible")
       && !$("skip-btn").classList.contains("invisible") && $("result-view").classList.contains("hide"),
       level + ": Play again resets the board and the bottom slot");
    ok(g.d.querySelectorAll("#gb-line line").length === 0, level + ": Play again clears the win line");
    ok(g.errors.length === 0, level + ": no page errors in a whole game: " + g.errors.join("; "));
    g.w.close();
  }
  console.log("  whole games (w/l/t per seed): " + JSON.stringify(outcomes));

  /* ---- with motion on: the drop animates -------------------------------------------------- */
  {
    const g = boot({ reducedMotion: false });
    g.start("EASY");
    g.cols()[3].click();
    const disc = g.$("s3").firstChild;
    ok(disc && disc.classList.contains("drop") && disc.style.getPropertyValue("--fall") === "6", "a dropped disc animates from the top");
    ok(g.$("hand-disc").classList.contains("show") === false, "your hand empties as the disc drops");
    await sleep(800);
    ok(g.count(2) === 0 && g.$("hand-disc").classList.contains("show") && !!g.$("hand-disc").querySelector(".piece.bird"),
       "the owl holds its disc over a column before dropping it");
    await sleep(700);
    ok(g.count(2) === 1, "the owl replies with motion on too");
    ok(g.errors.length === 0, "no page errors with motion on: " + g.errors.join("; "));
    g.w.close();
  }

  report("connect-four play-through");
})();
