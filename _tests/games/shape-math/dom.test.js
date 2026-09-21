"use strict";
/* Headless play-through of Shape Math: reads the equation off the page by its aria-labels,
   works the answer out with the engine, and plays the round through the real UI. Checks the
   site's control scheme (Next ▶ taking the bottom slot in place, Skip hiding with .invisible so
   the top bar never shifts), that a wrong option is survivable and never located for you, that
   the option row carries no tell before it is tapped, and that Hint's "watch them combine"
   panel, the level chip, the keyboard and Home all behave. */
const { bootGame, loadEngine, tally } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("shape-math");

const LABEL = { EASY: "🌱 Easy", MEDIUM: "⭐ Medium", HARD: "🔥 Hard", EXPERT: "🏆 Expert" };
const nameOf = human => Object.keys(E.HUMAN_NAME).find(k => E.HUMAN_NAME[k] === human);

function run(reducedMotion){
  const { w, d, $ } = bootGame("shape-math", { reducedMotion, onError: e => ok(false, "page error: " + e.message) });
  const tag = reducedMotion ? " [reduced motion]" : "";
  const opts = () => [...d.querySelectorAll("#options .opt")];
  const levelKey = () => Object.keys(LABEL).find(k => LABEL[k] === $("q-level-label").textContent);
  /* the equation, read back off the page exactly as a player sees it */
  const puzzle = () => {
    const a = nameOf($("eq-a").getAttribute("aria-label")), b = nameOf($("eq-b").getAttribute("aria-label"));
    const op = $("eq-op").textContent === "−" ? "-" : "+";
    return { a, b, op, answer: a && b ? E.canonicalShapeFor(E.computeResult(a, b, op)) : null };
  };
  const sigOf = () => { const p = puzzle(); return p.a + p.op + p.b; };
  const rightBtn = () => opts().find(b => b.dataset.name === puzzle().answer);

  /* ---- start screen ---- */
  ok(!$("screen-home").classList.contains("hide"), "start screen is visible" + tag);
  ok($("screen-game").classList.contains("hide"), "game screen starts hidden" + tag);
  ok(d.querySelector(".home-top .hub-link").getAttribute("href") === "../", "← All games points at the hub" + tag);
  ok($("title").textContent.replace(/\s/g, "") === "ShapeMath", "bouncy title: " + $("title").textContent);
  ok(d.querySelectorAll(".diff").length === 4, "four level cards on the start screen" + tag);
  ok(d.querySelectorAll("#level-menu .level-opt").length === 4, "the level chip lists all four levels" + tag);

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
    const p = puzzle();
    ok(!!p.a && !!p.b, L + ": both operands name a known shape — " + p.a + " " + p.op + " " + p.b + tag);
    ok(!!p.answer, L + ": the equation resolves to a named shape" + tag);
    if(!p.answer) continue;

    /* ---- the equation on screen is one this level can actually deal ---- */
    ok(E.LEVELS[L].recipes.some(r => r.a === p.a && r.b === p.b && r.op === p.op && r.answer === p.answer),
       L + ": " + p.a + p.op + p.b + " is not in the level's recipe table" + tag);
    ok(E.LEVELS[L].ops.includes(p.op), L + ": dealt an operator this level does not allow" + tag);
    ok($("eq-blank").textContent.trim() === "?", L + ": the result slot shows a question mark" + tag);
    ok($("teachwrap").classList.contains("hide"), L + ": the 'watch them combine' panel starts hidden" + tag);

    /* ---- the options ---- */
    ok(opts().length === 4, L + ": four options, got " + opts().length + tag);
    ok(!!rightBtn(), L + ": the answer is on the option row" + tag);
    ok(new Set(opts().map(b => b.dataset.name)).size === 4, L + ": an option is repeated" + tag);
    /* no tell: the answer must look exactly like the decoys until it is tapped */
    ok(opts().every(b => b.className === "opt"), L + ": a fresh option carries no extra class" + tag);
    ok(opts().every(b => !b.disabled), L + ": every option starts tappable" + tag);
    ok(opts().every(b => E.HUMAN_NAME[b.dataset.name] === b.getAttribute("aria-label")),
       L + ": every option names its shape for a screen reader" + tag);
    ok($("next-btn").classList.contains("invisible"), L + ": the bottom slot holds an invisible Next during play" + tag);
    ok(!$("skip-btn").classList.contains("invisible"), L + ": Skip is available during play" + tag);

    /* ---- a wrong option is survivable, and never marked as wrong-forever ---- */
    const wrong = opts().find(b => b !== rightBtn());
    wrong.click();
    ok(wrong.classList.contains("wrong"), L + ": a wrong option wobbles" + tag);
    ok(!wrong.disabled, L + ": a wrong option stays tappable — the round goes on" + tag);
    ok(opts().every(b => !b.classList.contains("correct")), L + ": a wrong tap never reveals the answer" + tag);
    ok(!/\b(circle|square|grid|heart|diamond|plus)\b/i.test($("feedback").textContent),
       L + ": the wrong-answer message must not name a shape — " + $("feedback").textContent + tag);
    ok($("result-view").classList.contains("hide") && $("next-btn").classList.contains("invisible"),
       L + ": a wrong tap does not finish the round" + tag);
    ok(d.getElementById("owl-game").classList.contains("worried"), L + ": the owl looks worried on a wrong tap" + tag);

    /* ---- Hint opens the combine panel, and gives nothing else away ---- */
    $("hint-link").click();
    ok(!$("teachwrap").classList.contains("hide"), L + ": Hint opens the 'watch them combine' panel" + tag);
    ok($("teach-stage").innerHTML.length > 0, L + ": the hint panel actually draws something" + tag);
    ok(opts().every(b => b.className === "opt" || b === wrong), L + ": Hint does not mark an option" + tag);
    ok(d.getElementById("owl-game").classList.contains("think"), L + ": the owl thinks while hinting" + tag);

    /* ---- the right option wins ---- */
    const right = rightBtn();
    right.click();
    ok(right.classList.contains("correct"), L + ": the right option is marked correct" + tag);
    ok(opts().every(b => b.disabled), L + ": every option locks once the round is won" + tag);
    ok(!$("result-view").classList.contains("hide"), L + ": the result shows on the win" + tag);
    ok($("rlabel").textContent.includes(E.HUMAN_NAME[p.answer]),
       L + ": the result names the shape — " + $("rlabel").textContent + tag);
    ok($("play-view").classList.contains("hide"), L + ": the options step aside for the result" + tag);
    ok($("teachwrap").classList.contains("hide"), L + ": the hint panel closes on the win" + tag);
    ok(!$("next-btn").classList.contains("invisible"), L + ": Next appears in the bottom slot" + tag);
    ok($("skip-btn").classList.contains("invisible"), L + ": Skip hides with .invisible, keeping its box" + tag);
    ok($("skip-btn").style.display !== "none", L + ": Skip must not be display:none — the top bar would shift" + tag);
    ok($("hint-link").classList.contains("off"), L + ": Hint switches off once the round is won" + tag);
    ok(d.getElementById("owl-game").classList.contains("win"), L + ": the owl celebrates" + tag);

    /* the blank fills in with the answer the player built */
    ok($("eq-blank").textContent.trim() !== "?", L + ": the ? is replaced once the round is won" + tag);

    /* ---- Next: a fresh, different equation, controls restored ---- */
    const before = sigOf();
    $("next-btn").click();
    ok(sigOf() !== before, L + ": Next deals an equation that differs from the one just solved" + tag);
    ok($("result-view").classList.contains("hide") && !$("play-view").classList.contains("hide"),
       L + ": Next brings the options back" + tag);
    ok(opts().every(b => b.className === "opt" && !b.disabled), L + ": Next clears every option's state" + tag);
    ok(!$("skip-btn").classList.contains("invisible"), L + ": Next restores Skip" + tag);
    ok($("next-btn").classList.contains("invisible"), L + ": Next hides itself again" + tag);
    ok(!$("hint-link").classList.contains("off"), L + ": Next restores Hint" + tag);
    ok($("teachwrap").classList.contains("hide"), L + ": Next closes the hint panel" + tag);
    ok(levelKey() === L, L + ": Next stays on the same level" + tag);

    /* ---- Skip deals something different ---- */
    let changed = false;
    for(let k = 0; k < 12 && !changed; k++){ const s = sigOf(); $("skip-btn").click(); changed = sigOf() !== s; }
    ok(changed, L + ": Skip deals a different equation" + tag);
  }

  /* ---- keyboard: h hints, Enter takes the next round ---- */
  {
    d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "h", bubbles: true }));
    ok(!$("teachwrap").classList.contains("hide"), "the h key opens the hint panel" + tag);
    rightBtn().click();
    ok(!$("next-btn").classList.contains("invisible"), "the round finished" + tag);
    const solved = sigOf();
    d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    ok($("result-view").classList.contains("hide"), "Enter takes the next round" + tag);
    ok(sigOf() !== solved, "the round after Enter is a different equation" + tag);
  }

  /* ---- Escape closes the level menu, Home leaves ---- */
  $("q-level").click();
  ok($("level-menu").classList.contains("open"), "the chip opens the level menu" + tag);
  d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  ok(!$("level-menu").classList.contains("open"), "Escape closes the level menu" + tag);

  $("home-btn").click();
  ok(!$("screen-home").classList.contains("hide"), "Home returns to the start screen" + tag);
  ok($("screen-game").classList.contains("hide"), "Home hides the game screen" + tag);
  /* idle is the ABSENCE of a mood class (see setOwl in site.js), on both owls */
  ok(["happy", "worried", "win", "think"].every(m => !d.getElementById("owl-game").classList.contains(m)),
     "Home settles the owl back to idle" + tag);
}

run(true);
run(false);
report("shape-math play-through");
