"use strict";
/* Headless play-through: drives the real page through one round per level. The puzzle is read
   back from what the page shows — the fold list and punch on #steps, the holes drawn inside each
   choice — and the answer is rebuilt from that with the engine (which engine.test.js proves
   against a physical paper stack). So this proves the page draws the sheet it scores, that a
   round can be won through the interface, that Show answer ticks the right sheet in place, and
   that the control scheme behaves. */
const { bootGame, loadEngine, tally } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("paper-punch");

const { w, d, $ } = bootGame("paper-punch", { seed: 7, onError: e => ok(false, "page error: " + e.message) });
const levelOf = () => $("q-level-label").textContent;
const vis = id => !$(id).classList.contains("hide") && !$(id).classList.contains("invisible");

/* the puzzle on screen, rebuilt from the page */
function readPuzzle(){
  const N = +$("steps").dataset.size, folds = JSON.parse($("steps").dataset.folds);
  const punches = $("steps").dataset.punches.split(",").map(Number);
  let fp = E.fullSheet(N); const fps = [fp];
  for(const f of folds){ fp = E.foldFootprint(fp, f, N); fps.push(fp); }
  const shape = $("steps").querySelector("svg .hole circle, svg circle.hole") ? "round" : "flag";
  const holes = [].concat(...punches.map(c => E.trace(N, folds, fps, c)[folds.length]));
  return { N, folds, punches, shape, answer: E.normalize(holes, shape) };
}
const drawn = el => E.key(E.normalize([...el.querySelectorAll(".hole")].map(h => ({ i: +h.dataset.i, o: +h.dataset.o })), "flag"));
const answerKey = p => E.key(p.answer);
const topbarShape = () => [...d.querySelector(".topbar").querySelectorAll("button")].map(b => b.id + ":" + b.classList.contains("hide")).join(",");

function switchTo(name){
  $("q-level").click();
  const opt = [...d.querySelectorAll("#level-menu .level-opt")].find(b => b.textContent.includes(name));
  ok(!!opt, "level menu should list " + name);
  opt.click();
  ok(levelOf().includes(name), "chip should read " + name + ", got " + levelOf());
  ok(!$("screen-game").classList.contains("hide"), "switching level should stay in the game");
}

/* ---- start screen ---- */
ok(!$("screen-home").classList.contains("hide"), "start screen should be visible");
ok(d.querySelectorAll(".diff").length === 4, "four level cards");
ok($("title").textContent.replace(/\s/g, "") === "PaperPunch", "bouncy title: " + $("title").textContent);
$("start-btn").click();
ok(!$("screen-game").classList.contains("hide"), "Start should show the game");
ok(levelOf().includes("Easy"), "starts at Easy");

/* ---- a multiple-choice round ---- */
function playChoices(name, nChoices, nFolds){
  const p = readPuzzle();
  ok(p.folds.length === nFolds, name + ": " + nFolds + " fold(s), got " + p.folds.length);
  ok($("steps").querySelectorAll(".step").length === nFolds + 1, name + ": one picture per fold plus the punch");
  const tiles = [...$("choices").querySelectorAll(".tile")];
  ok(tiles.length === nChoices, name + ": " + nChoices + " choices, got " + tiles.length);
  ok(!$("choices").classList.contains("hide") && $("mark-view").classList.contains("hide"), name + ": choices shown, no marking sheet");
  const keys = tiles.map(drawn);
  ok(new Set(keys).size === keys.length, name + ": every choice draws a different sheet");
  const right = tiles.filter(t => drawn(t) === answerKey(p));
  ok(right.length === 1, name + ": exactly one drawn choice matches the unfolded paper, got " + right.length);
  ok($("reset-btn").classList.contains("invisible"), name + ": Reset is .invisible (site.css collapses it in the actions row)");
  ok(!$("reveal-btn").classList.contains("invisible") && !$("reveal-btn").classList.contains("off"), name + ": Show answer is offered");
  ok(!$("hint-link"), name + ": there is no Hint — it gave the answer away");
  ok($("next-btn").classList.contains("invisible") && !$("next-btn").classList.contains("hide"), name + ": Next holds the slot, invisible");
  ok($("check-btn").classList.contains("hide"), name + ": no Check button");

  /* a wrong tap: marked by more than colour, the round goes on */
  const wrong = tiles.find(t => t !== right[0]);
  wrong.click();
  ok(wrong.classList.contains("nope") && wrong.disabled && wrong.querySelector(".mark").textContent === "✗", name + ": a wrong choice gets ✗ and is disabled");
  ok($("result-view").classList.contains("hide"), name + ": a wrong choice does not end the round");

  const bar = topbarShape(), slot = $("next-btn").parentElement;
  right[0].click();
  ok(right[0].classList.contains("right") && right[0].querySelector(".mark").textContent === "✓", name + ": the right choice gets ✓");
  ok(!$("result-view").classList.contains("hide"), name + ": the win shows the result");
  ok($("stars").textContent === "★★☆", name + ": one wrong try → ★★, got " + $("stars").textContent);
  ok(vis("next-btn") && $("next-btn").parentElement === slot && slot.classList.contains("serve-row"), name + ": Next appears in the bottom slot");
  ok($("skip-btn").classList.contains("invisible") && !$("skip-btn").classList.contains("hide"), name + ": Skip hides with .invisible, never display:none");
  ok(topbarShape() === bar, name + ": the top bar keeps every control in place");
  ok(tiles.every(t => t.disabled), name + ": choices lock after the win");
}

playChoices("Easy", 3, 1);

/* ---- Next and Skip give a different puzzle ---- */
{
  const before = $("steps").dataset.folds + $("steps").dataset.punches;
  $("next-btn").click();
  ok($("result-view").classList.contains("hide") && $("next-btn").classList.contains("invisible"), "Next restores the play state");
  ok(!$("skip-btn").classList.contains("invisible"), "Next brings Skip back");
  let differs = 0;
  for(let i = 0; i < 20; i++){
    const a = $("steps").dataset.folds + $("steps").dataset.punches;
    $("skip-btn").click();
    if($("steps").dataset.folds + $("steps").dataset.punches !== a) differs++;
  }
  ok(differs === 20, "Skip should always change the puzzle, changed " + differs + "/20");
  ok(before.length > 0, "the steps carry the puzzle");
}

/* ---- a clean win is ★★★ ---- */
{
  const p = readPuzzle();
  [...$("choices").querySelectorAll(".tile")].find(t => drawn(t) === answerKey(p)).click();
  ok($("stars").textContent === "★★★", "right first time → ★★★, got " + $("stars").textContent);
  $("next-btn").click();
}

/* ---- Show answer: ticks the right sheet among the choices, no new component, no stars ---- */
{
  switchTo("Medium");
  const p = readPuzzle();
  const kids = $("screen-game").querySelectorAll("*").length;
  const bar = topbarShape(), slot = $("next-btn").parentElement;
  $("reveal-btn").click();
  const tiles = [...$("choices").querySelectorAll(".tile")];
  const ticked = tiles.filter(t => t.classList.contains("right"));
  ok(ticked.length === 1 && drawn(ticked[0]) === answerKey(p) && ticked[0].querySelector(".mark").textContent === "✓",
     "Show answer ticks exactly the right sheet, in the choices");
  ok(tiles.every(t => t.disabled), "Show answer locks the choices");
  ok($("stars").textContent === "☆☆☆", "Show answer earns no stars, got " + $("stars").textContent);
  ok(!$("result-view").classList.contains("hide") && /answer/i.test($("rlabel").textContent), "the result says it was shown");
  ok(vis("next-btn") && $("next-btn").parentElement === slot, "Next takes the bottom slot");
  ok(topbarShape() === bar && $("skip-btn").classList.contains("invisible"), "the top bar doesn't shift");
  ok($("reveal-btn").classList.contains("off"), "Show answer switches off once used");
  ok($("screen-game").querySelectorAll("*").length - kids <= 2, "Show answer adds no new component to the page");
  $("next-btn").click();
  ok(!$("reveal-btn").classList.contains("off"), "the next round offers Show answer again");
}

/* ---- Medium and Hard, no hints ---- */
$("next-btn").click();
playChoices("Medium", 4, 2);
switchTo("Hard");
{
  const p = readPuzzle();
  ok(p.shape === "flag", "Hard punches the flag");
  ok(p.folds.some(f => f.t === "D" || f.t === "A"), "Hard has a diagonal fold");
}
playChoices("Hard", 4, 2);

/* ---- Expert: mark it yourself ---- */
switchTo("Expert");
{
  const p = readPuzzle();
  ok(p.folds.length === 3, "Expert has three folds");
  ok($("choices").classList.contains("hide") && !$("mark-view").classList.contains("hide"), "Expert shows the marking sheet, no choices");
  ok($("marksheet").querySelectorAll(".mc").length === p.N * p.N, "the marking sheet has every cell");
  ok($("stamps").querySelectorAll(".stamp").length === 8, "eight flag stamps");
  ok(vis("check-btn") && $("next-btn").classList.contains("hide"), "Check is the live primary button");
  ok(!$("reset-btn").classList.contains("invisible"), "Reset is live at Expert");

  const cell = i => $("marksheet").querySelector('.mc[data-i="' + i + '"]');
  const stampBtn = o => $("stamps").querySelector('.stamp[data-o="' + o + '"]');

  /* tapping cycles a cell: a stamp, then the same stamp again rubs it out */
  cell(0).click();
  ok(cell(0).querySelector(".hole") && cell(0).getAttribute("aria-label").includes("hole"), "a tap marks a hole");
  cell(0).click();
  ok(!cell(0).querySelector(".hole") && cell(0).getAttribute("aria-label").includes("empty"), "a second tap with the same stamp clears it");

  /* Reset clears the marks */
  cell(1).click(); cell(2).click();
  $("reset-btn").click();
  ok(!$("marksheet").querySelector(".hole"), "Reset clears every mark");

  /* a wrong Check shakes and the round goes on (and costs a star) */
  cell(p.answer[0].i).click();
  $("check-btn").click();
  ok($("result-view").classList.contains("hide"), "a wrong Check does not end the round");
  ok(vis("check-btn"), "Check stays after a wrong Check");
  ok($("marksheet").classList.contains("shake"), "a wrong Check shakes the sheet");
  ok($("feedback").classList.contains("bad"), "a wrong Check says so");
  $("reset-btn").click();

  /* the right marks, facing the right way */
  for(const h of p.answer){ stampBtn(h.o).click(); ok(stampBtn(h.o).getAttribute("aria-pressed") === "true", "stamp " + h.o + " selected"); cell(h.i).click(); }
  ok(drawn($("marksheet")) === answerKey(p), "the sheet shows the marks we made");
  const bar = topbarShape(), slot = $("check-btn").parentElement;
  $("check-btn").click();
  ok(!$("result-view").classList.contains("hide"), "the right marks win");
  ok($("stars").textContent === "★★☆", "Expert after one wrong Check → ★★, got " + $("stars").textContent);
  ok($("check-btn").classList.contains("hide") && vis("next-btn") && $("next-btn").parentElement === slot, "Next replaces Check in place");
  ok(topbarShape() === bar && $("skip-btn").classList.contains("invisible"), "the top bar doesn't shift on the win");
  ok($("reset-btn").classList.contains("off"), "Reset is switched off after the win");
}

/* ---- Show answer at Expert stamps the answer onto the sheet itself ---- */
$("next-btn").click();
{
  const p = readPuzzle();
  $("reveal-btn").click();
  ok(drawn($("marksheet")) === answerKey(p), "Show answer at Expert stamps the answer onto the marking sheet");
  ok($("marksheet").classList.contains("shown") && $("stars").textContent === "☆☆☆", "…marked as shown, with no stars");
  ok($("check-btn").classList.contains("hide") && vis("next-btn"), "…and Next replaces Check");
}

/* ---- Home ---- */
$("home-btn").click();
ok(!$("screen-home").classList.contains("hide") && $("screen-game").classList.contains("hide"), "Home returns to the start screen");

/* ---- reduced motion: no flipping flaps, only the static pictures ---- */
{
  const g = bootGame("paper-punch", { seed: 3, reducedMotion: true, onError: e => ok(false, "page error (reduced motion): " + e.message) });
  g.$("start-btn").click();
  ok(g.d.querySelectorAll(".flap").length === 0, "reduced motion: no fold animation");
  ok(g.d.querySelectorAll("#steps .step svg").length === 2, "reduced motion: the static fold and punch pictures are there");
  const m = bootGame("paper-punch", { seed: 3, onError: () => {} });
  m.$("start-btn").click();
  ok(m.d.querySelectorAll(".flap").length === 1, "motion on: the fold plays as a flip");
}

report("paper-punch play-through");
