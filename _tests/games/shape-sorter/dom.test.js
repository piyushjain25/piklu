"use strict";
/* Headless play-through of Shape Sorter: works out which shape the round is asking for by
   matching the target icon against the engine's own drawing, then plays the round through the
   real UI. Checks the control scheme the site standardises on (Next ▶ replacing the slot in
   place, Skip hiding with .invisible so the top bar never shifts), that a wrong tap is survivable,
   that the tiles carry no visual tell before they are tapped, and that Hint, the level chip, the
   keyboard and Home all behave. */
const { bootGame, loadEngine, tally } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("shape-sorter");

const LABEL = { EASY: "🌱 Easy", MEDIUM: "⭐ Medium", HARD: "🔥 Hard", EXPERT: "🏆 Expert" };

function run(reducedMotion){
  const { w, d, $ } = bootGame("shape-sorter", { reducedMotion, onError: e => ok(false, "page error: " + e.message) });
  const tag = reducedMotion ? " [reduced motion]" : "";
  const tiles = () => [...d.querySelectorAll("#tilegrid .tile")];
  const levelKey = () => Object.keys(LABEL).find(k => LABEL[k] === $("q-level-label").textContent);
  /* which shape is the round asking for? the icon is drawn by the engine, so compare against it —
     through a normaliser, because jsdom re-serialises <circle/> as <circle></circle> */
  const norm = s => s.replace(/\s*\/>/g, ">").replace(/<\/\w+>/g, "");
  const target = () => Object.keys(E.NAMES).find(k => norm(E.shapeMarkup(k, "var(--grape)")) === norm($("target-icon").innerHTML));
  const isCorrect = b => b.getAttribute("aria-label") === E.NAMES[target()] + " shape";
  const correctTiles = () => tiles().filter(isCorrect);
  const roundSig = () => target() + ":" + tiles().map(b => b.getAttribute("aria-label")).join(",");

  /* ---- start screen ---- */
  ok(!$("screen-home").classList.contains("hide"), "start screen is visible" + tag);
  ok($("screen-game").classList.contains("hide"), "game screen starts hidden" + tag);
  ok(d.querySelector(".home-top .hub-link").getAttribute("href") === "../", "← All games points at the hub" + tag);
  ok($("title").textContent.replace(/\s/g, "") === "ShapeSorter", "bouncy title: " + $("title").textContent);
  ok(d.querySelectorAll(".diff").length === 4, "four level cards on the start screen" + tag);
  ok(d.querySelectorAll("#level-menu .level-opt").length === 4, "the level chip lists all four levels" + tag);
  ok(d.querySelector('.diff[data-diff="EASY"]').getAttribute("aria-pressed") === "true", "Easy starts selected" + tag);

  $("start-btn").click();
  ok($("screen-home").classList.contains("hide"), "Start leaves the start screen" + tag);
  ok(!$("screen-game").classList.contains("hide"), "Start shows the game" + tag);
  ok(!$("screen-game").querySelector(".hub-link"), "no ← All games during play" + tag);

  for(const L of ["EASY", "MEDIUM", "HARD", "EXPERT"]){
    if(levelKey() !== L){
      $("q-level").click();
      d.querySelector('#level-menu .level-opt[data-diff="' + L + '"]').click();
      ok(levelKey() === L, "the chip switches to " + L + tag);
      ok(!$("screen-game").classList.contains("hide"), L + ": switching level stays in the game" + tag);
      ok(d.querySelector('.diff[data-diff="' + L + '"]').getAttribute("aria-pressed") === "true",
         L + ": the start screen's card follows the chip" + tag);
    }
    const cfg = E.LEVELS[L];
    const t = target();
    ok(!!t, L + ": the target icon matches a known shape" + tag);
    if(!t) continue;

    /* ---- the board ---- */
    ok(tiles().length === cfg.tiles, L + ": " + cfg.tiles + " tiles, got " + tiles().length + tag);
    ok(tiles().every(b => /shape$/.test(b.getAttribute("aria-label") || "")), L + ": every tile names its shape for a screen reader" + tag);
    /* no tell: before anything is tapped the answer looks exactly like the distractors */
    ok(tiles().every(b => b.className === "tile"), L + ": a fresh tile carries no extra class" + tag);
    ok(tiles().every(b => !b.disabled), L + ": every tile starts tappable" + tag);
    const want = correctTiles().length;
    ok(want >= cfg.minT && want <= Math.min(cfg.maxT, cfg.tiles - 1), L + ": " + want + " matching tiles on the board" + tag);
    ok(want < tiles().length, L + ": there is always something wrong to reject" + tag);
    ok($("target-text").textContent.includes(E.NAMES[t]), L + ": the prompt names the shape — " + $("target-text").textContent + tag);
    if(want > 1) ok(/0 of 1?\d found/.test($("target-text").textContent), L + ": a multi-tile round shows the count" + tag);
    ok($("next-btn").classList.contains("invisible"), L + ": the bottom slot holds an invisible Next during play" + tag);
    ok(!$("skip-btn").classList.contains("invisible"), L + ": Skip is available during play" + tag);

    /* ---- a wrong tap is survivable, and never located for you ---- */
    const wrong = tiles().find(b => !isCorrect(b));
    wrong.click();
    ok(wrong.className.includes("wrong-flash"), L + ": a wrong tap wobbles the tile" + tag);
    ok(!wrong.disabled && !wrong.classList.contains("found"), L + ": a wrong tile is not marked or locked" + tag);
    ok($("feedback").textContent.includes(E.NAMES[t]), L + ": a wrong tap says what to look for — " + $("feedback").textContent + tag);
    ok($("result-view").classList.contains("hide") && $("next-btn").classList.contains("invisible"),
       L + ": a wrong tap does not finish the round" + tag);

    /* ---- Hint glows a correct tile, and only a correct one ---- */
    $("hint-link").click();
    const glow = tiles().filter(b => b.classList.contains("hintglow"));
    ok(glow.length === 1, L + ": Hint lights exactly one tile, got " + glow.length + tag);
    ok(glow.length === 1 && isCorrect(glow[0]), L + ": Hint lights a MATCHING tile" + tag);

    /* ---- the right taps win ---- */
    const answers = correctTiles();
    answers.forEach((b, i) => {
      b.click();
      ok(b.classList.contains("found") && b.disabled, L + ": a correct tile is marked found and locked" + tag);
      if(i < answers.length - 1)
        ok($("target-text").textContent.includes(String(i + 1) + " of "), L + ": the count follows along" + tag);
    });
    ok(!$("result-view").classList.contains("hide"), L + ": the result shows on the win" + tag);
    ok($("rlabel").textContent.includes(E.NAMES[t]), L + ": the result names the shape — " + $("rlabel").textContent + tag);
    ok($("tilegrid").classList.contains("hide"), L + ": the tiles step aside for the result" + tag);
    ok(!$("next-btn").classList.contains("invisible"), L + ": Next appears in the bottom slot" + tag);
    ok($("skip-btn").classList.contains("invisible"), L + ": Skip hides with .invisible, keeping its box" + tag);
    ok($("skip-btn").style.display !== "none", L + ": Skip must not be display:none — the top bar would shift" + tag);
    ok($("serve-view").classList.contains("hide"), L + ": the Hint row steps aside on the win" + tag);

    /* ---- Next: a fresh round, controls restored ---- */
    const before = roundSig();
    $("next-btn").click();
    ok(roundSig() !== before, L + ": Next serves a round that differs from the one just solved" + tag);
    ok($("result-view").classList.contains("hide") && !$("tilegrid").classList.contains("hide"),
       L + ": Next brings the tiles back" + tag);
    ok(!$("skip-btn").classList.contains("invisible"), L + ": Next restores Skip" + tag);
    ok($("next-btn").classList.contains("invisible"), L + ": Next hides itself again" + tag);
    ok(tiles().every(b => b.className === "tile" && !b.disabled), L + ": Next clears every tile's state" + tag);
    ok(levelKey() === L, L + ": Next stays on the same level" + tag);

    /* ---- Skip serves something different ---- */
    let changed = false;
    for(let k = 0; k < 12 && !changed; k++){ const s = roundSig(); $("skip-btn").click(); changed = roundSig() !== s; }
    ok(changed, L + ": Skip serves a different round" + tag);
  }

  /* ---- keyboard: h hints, Enter takes the next round ---- */
  {
    const t = target();
    d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "h", bubbles: true }));
    ok(tiles().some(b => b.classList.contains("hintglow")), "the h key gives a hint" + tag);
    correctTiles().forEach(b => b.click());
    ok(!$("next-btn").classList.contains("invisible"), "the round finished" + tag);
    d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    ok($("result-view").classList.contains("hide"), "Enter takes the next round" + tag);
    ok(!!t, "the keyboard round had a target" + tag);
  }

  /* ---- Escape closes the level menu, Home leaves ---- */
  $("q-level").click();
  ok($("level-menu").classList.contains("open"), "the chip opens the level menu" + tag);
  d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  ok(!$("level-menu").classList.contains("open"), "Escape closes the level menu" + tag);

  $("home-btn").click();
  ok(!$("screen-home").classList.contains("hide"), "Home returns to the start screen" + tag);
  ok($("screen-game").classList.contains("hide"), "Home hides the game screen" + tag);
}

run(true);
run(false);
report("shape-sorter play-through");
