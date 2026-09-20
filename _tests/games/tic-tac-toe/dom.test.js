"use strict";
/* jsdom play-through of games/tic-tac-toe: drives the real page at every level and asserts
   the right board is on screen, the level's rules show up in the UI, the control scheme
   behaves, and nothing stale lands after leaving a turn. */
const { bootGame, tally, sleep } = require("../../lib/harness.js");
const { ok, report } = tally();

function fresh(reduced) {
  const { w, d, $ } = bootGame("tic-tac-toe", { reducedMotion: reduced, seed: 20260919,
    onError: e => ok(false, "page error: " + e.message) });
  return { w, d, $, tiles: () => [...d.querySelectorAll("#board .tile")],
           ucells: () => [...d.querySelectorAll("#uboard .ucell")] };
}
const marks = els => els.filter(c => c.textContent.trim()).length;
const over = $ => !$("result-view").classList.contains("hide");

/* play one whole game through the DOM, tapping random legal squares. Between your taps the
   owl thinks (250ms, then a search), which shows up here as "no square is legal yet" — so the
   loop polls for its reply instead of assuming a fixed delay. `guard` is only a runaway stop:
   it has to outlast the owl on a busy machine, where a search can take far longer than usual. */
async function playOut(w, $, cells, sel) {
  for (let guard = 0; guard < 4000 && !over($); guard++) {
    const free = cells().filter(sel);
    if (!free.length) { await sleep(20); continue; }
    free[Math.floor(w.Math.random() * free.length)].click();
    await sleep(5);
  }
  return over($);
}
/* the owl has finished its turn when a square is legal again (or the game has ended) */
async function owlReply($, cells, sel) {
  for (let i = 0; i < 1000 && !over($) && !cells().filter(sel).length; i++) await sleep(10);
}
const gridOk = c => !c.disabled;
const ultOk = c => c.getAttribute("aria-disabled") === "false";

(async () => {
  console.log("— boot & start screen —");
  {
    const { d, $ } = fresh(false);
    ok(!$("screen-home").classList.contains("hide") && $("screen-game").classList.contains("hide"), "start screen first");
    ok($("title").textContent.replace(/ /g, " ") === "Tic Tac Toe", "bouncy title: " + $("title").textContent);
    ok(d.querySelectorAll("#board .tile").length === 9, "3x3 board has 9 squares");
    ok(d.querySelectorAll("#uboard .ucell").length === 81 && d.querySelectorAll("#uboard .ubrd").length === 9,
       "ultimate board has 9 boards of 9");
    ok(d.querySelectorAll(".diff").length === 4 && d.querySelectorAll("#level-menu .level-opt").length === 4,
       "four level cards and four menu options");
    for (const el of d.querySelectorAll(".diff"))
      ok(el.querySelectorAll(".d-name").length === 1 && el.querySelectorAll(".d-range").length === 1 && !el.querySelector("br"),
         "level card follows the shared markup");
    ok(d.querySelector(".home-top .hub-link").getAttribute("href") === "../", "← All games points to the hub");
    ok(d.querySelectorAll("#screen-game .btn").length === 1, "exactly one real .btn on the game screen");
    ok(!$("hint-link") && !$("reset-btn"), "no Hint/Reset — you play against the owl, like the other owl games");
  }

  console.log("— each level plays its own game —");
  for (const lv of ["EASY", "MEDIUM", "HARD", "EXPERT"]) {
    const { w, d, $, tiles, ucells } = fresh(true);
    d.querySelector(`.diff[data-diff="${lv}"]`).click();
    $("start-btn").click();
    const isUlt = lv === "EXPERT";
    ok($("board").classList.contains("hide") === isUlt, `${lv}: 3x3 board ${isUlt ? "hidden" : "shown"}`);
    ok($("uboard").classList.contains("hide") === !isUlt, `${lv}: ultimate board ${isUlt ? "shown" : "hidden"}`);
    ok($("next-btn").classList.contains("invisible") && !$("skip-btn").classList.contains("invisible"), `${lv}: play state`);

    if (lv === "MEDIUM") {
      ok(/owl goes first/i.test($("turnbar").textContent), "Medium: the strip says the owl goes first");
      ok(tiles().every(t => t.disabled), "Medium: you can't tap while the owl opens");
      await owlReply($, tiles, gridOk);
      ok(marks(tiles()) === 1 && tiles().some(t => t.textContent === "◯"), "Medium: the owl has made the first move");
      ok(/don.t/i.test($("turnbar").textContent), "Medium: the strip reminds you NOT to make three");
    }
    if (lv === "EXPERT")
      ok(d.querySelectorAll(".ubrd.active").length === 9, "Expert: the first move is free");

    const results = { X: 0, O: 0, tie: 0 };
    let sawFade = false, sawLost = false, most = 0;
    const games = isUlt ? 2 : 8;
    for (let g = 0; g < games; g++) {
      if (g) { $("next-btn").click(); await owlReply($, isUlt ? ucells : tiles, isUlt ? ultOk : gridOk); }
      const poll = setInterval(() => {
        if (d.querySelector("#board .tile.fading")) sawFade = true;
        for (const g of ["✕", "◯"]) most = Math.max(most, tiles().filter(t => t.textContent === g && !t.classList.contains("ghost")).length);
      }, 5);
      const done = await playOut(w, $, isUlt ? ucells : tiles, isUlt ? ultOk : gridOk);
      clearInterval(poll);
      ok(done, `${lv}: game ${g + 1} reached a result`);
      const lab = $("rlabel").textContent;
      results[/you win/.test(lab) ? "X" : /tie|nobody/i.test(lab) ? "tie" : "O"]++;
      if (d.querySelector("#board .tile.lost")) sawLost = true;
      ok($("skip-btn").classList.contains("invisible") && !$("skip-btn").classList.contains("hide"),
         `${lv}: Skip hidden with .invisible on a result`);
      ok(!$("next-btn").classList.contains("invisible"), `${lv}: Play again in the bottom slot`);
    }
    if (lv === "HARD") {
      ok(sawFade, "Hard: a fading (dashed) mark was shown");
      ok(most <= 3, "Hard: never more than 3 marks a side on screen — not even on the winning move (saw " + most + ")");
    }
    else ok(!sawFade, `${lv}: marks never fade`);
    if (lv === "MEDIUM") ok(!d.querySelector("#board .tile.win"), "Medium: a finished line is never styled as a win");
    console.log(`  ${lv}: ${games} games — you ${results.X} · owl ${results.O} · tie ${results.tie}`
      + (lv === "MEDIUM" ? (sawLost ? " (losing line shown)" : "") : ""));
  }

  console.log("— Medium: making three in a row loses —");
  {
    /* drive the engine rules through the DOM: whenever a result lands, the label and
       the highlighted line must agree about who made the three */
    const { w, d, $, tiles } = fresh(true);
    d.querySelector('.diff[data-diff="MEDIUM"]').click();
    $("start-btn").click();
    let checked = 0;
    for (let g = 0; g < 12; g++) {
      if (g) { $("next-btn").click(); }
      await owlReply($, tiles, gridOk);
      await playOut(w, $, tiles, gridOk);
      const line = tiles().filter(t => t.classList.contains("lost"));
      if (!line.length) continue;
      checked++;
      const sym = line[0].textContent;
      ok(line.length === 3 && line.every(t => t.textContent === sym), "Medium: the losing line is three of one mark");
      ok(sym === "✕" ? /you made three/.test($("rlabel").textContent) : /owl made three.*you win/.test($("rlabel").textContent),
         "Medium: whoever made the three lost — " + sym + " / " + $("rlabel").textContent);
    }
    ok(checked > 0, "Medium: saw at least one game end on a three-in-a-row");
  }

  console.log("— Expert: the sending rule is enforced —");
  {
    const { w, d, $, ucells } = fresh(true);
    d.querySelector('.diff[data-diff="EXPERT"]').click();
    $("start-btn").click();
    ucells()[4 * 9 + 2].click();                   // centre board, top-right square
    ok(ucells()[4 * 9 + 2].textContent === "✕", "your mark appears");
    for (let i = 0; i < 1000 && !d.querySelector('.ucell[aria-disabled="false"]'); i++) await sleep(20);
    const active = [...d.querySelectorAll(".ubrd")].map((b, i) => b.classList.contains("active") ? i : -1).filter(i => i >= 0);
    ok(active.length >= 1, "a board is playable after the owl moves");
    if (active.length === 1) {
      const wrong = (active[0] + 1) % 9;
      const cell = ucells().slice(wrong * 9, wrong * 9 + 9).find(c => !c.textContent);
      if (cell) {
        cell.click();
        ok(!cell.textContent, "a tap on the wrong board places nothing");
        ok(/Not that board/.test($("feedback").textContent), "…and says so");
        ok(d.querySelectorAll(".ubrd")[active[0]].classList.contains("callout"), "…and calls out the right board");
      }
    }
  }

  console.log("— level switch, Skip, Home —");
  {
    const { d, $, tiles, ucells } = fresh(true);
    $("start-btn").click();
    tiles()[0].click();
    await sleep(200);
    d.querySelector('#level-menu .level-opt[data-diff="EXPERT"]').click();
    ok($("q-level-label").textContent.includes("Expert"), "chip shows Expert");
    ok($("board").classList.contains("hide") && !$("uboard").classList.contains("hide"), "switching to Expert swaps in the big board");
    ok(marks(ucells()) === 0, "Expert starts empty");
    d.querySelector('#level-menu .level-opt[data-diff="EASY"]').click();
    ok(!$("board").classList.contains("hide") && $("uboard").classList.contains("hide"), "and back again");
    ok(marks(tiles()) === 0, "switching level starts a fresh board");
    tiles()[4].click();
    await sleep(200);
    $("skip-btn").click();
    ok(marks(tiles()) === 0, "Skip starts a fresh board");
    $("home-btn").click();
    ok(!$("screen-home").classList.contains("hide") && $("screen-game").classList.contains("hide"), "Home returns to the start screen");
  }

  console.log("— leaving mid-turn: no stale beat may land —");
  for (const lv of ["EASY", "HARD", "EXPERT"]) for (const how of ["Home", "Skip", "level"]) {
    const { d, $, tiles, ucells } = fresh(false);   // real animation delays => timers in flight
    d.querySelector(`.diff[data-diff="${lv}"]`).click();
    $("start-btn").click();
    const cells = lv === "EXPERT" ? ucells : tiles;
    cells()[4].click();
    await sleep(30);
    if (how === "Home") $("home-btn").click();
    else if (how === "Skip") $("skip-btn").click();
    else d.querySelector(`#level-menu .level-opt[data-diff="${lv === "EASY" ? "MEDIUM" : "EASY"}"]`).click();
    const before = marks(tiles()) + marks(ucells());
    await sleep(1600);
    const after = marks(tiles()) + marks(ucells());
    /* switching to Medium legitimately lets the NEW round's owl open */
    const allowed = how === "level" && lv === "EASY" ? 1 : 0;
    ok(after - before <= allowed, `${lv} → ${how} mid-turn: the board changed afterwards (${before} → ${after})`);
  }

  console.log("— rules: the start screen shows every level, the game shows only its own —");
  {
    const { d, $ } = fresh(true);
    const NAME = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard", EXPERT: "Expert" };
    const KEY = { EASY: /blocking the owl/i, MEDIUM: /upside down/i, HARD: /oldest goes first/i, EXPERT: /your move sends the owl/i };
    $("rules-home").click();
    const all = $("rules-body").textContent;
    ok(/How to play Tic Tac Toe/.test($("rules-h").textContent), "start screen: the full sheet's heading");
    for (const lv of Object.keys(NAME)) ok(all.includes(NAME[lv] + " —"), "start screen: the full sheet covers " + lv);
    $("rules-ok").click();
    for (const lv of Object.keys(NAME)) {
      d.querySelector(`.diff[data-diff="${lv}"]`).click();
      $("start-btn").click();
      $("rules-btn").click();
      const body = $("rules-body"), text = body.textContent;
      ok($("rules-ov").classList.contains("show"), lv + ": in-game Rules opens the sheet");
      ok($("rules-h").textContent.includes(NAME[lv]), lv + ": heading names the level — " + $("rules-h").textContent);
      ok(KEY[lv].test(text), lv + ": explains this level's own rules");
      for (const other of Object.keys(NAME)) if (other !== lv)
        ok(!KEY[other].test(text), lv + ": must not explain " + other + "'s rules");
      ok(body.querySelectorAll(".rule").length >= 5 && text.length > 900, lv + ": a detailed explanation (" + text.length + " chars)");
      $("rules-ok").click();
      $("home-btn").click();
    }
    /* switching level inside the game changes what Rules shows */
    d.querySelector('.diff[data-diff="EASY"]').click();
    $("start-btn").click();
    d.querySelector('#level-menu .level-opt[data-diff="HARD"]').click();
    $("rules-btn").click();
    ok(KEY.HARD.test($("rules-body").textContent) && !KEY.EASY.test($("rules-body").textContent),
       "after switching to Hard in-game, Rules shows Hard's rules");
    $("rules-ok").click();
    $("rules-home").click();
    ok(/How to play Tic Tac Toe/.test($("rules-h").textContent) && $("rules-body").textContent === all,
       "the start-screen sheet is unchanged afterwards");
    $("rules-ok").click();
  }

  console.log("— keyboard —");
  {
    const { w, d, $, tiles } = fresh(true);
    $("start-btn").click();
    d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "5", bubbles: true }));
    ok(tiles()[4].textContent === "✕", "pressing 5 plays the centre square");
  }

  report("tic-tac-toe play-through");
})();
