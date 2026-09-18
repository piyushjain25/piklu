"use strict";
/* Headless play-through of Balance Scales. Easy/Medium: balance through the tray and assert
   the round completes BY ITSELF (Next ▶ appears in the slot the invisible placeholder held,
   Skip hides). Pan totals are checked after every add and remove, Reset restores the exact
   opening state, and the tilt follows the difference. Hard/Expert: a wrong number is
   rejected, the right one swaps Check ✓ for Next ▶, and the hint never gives the number. */
const { bootGame, loadEngine, tally } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("balance-scales");

const { w, d, $ } = bootGame("balance-scales", { onError: e => ok(false, "page error: " + e.message) });
const levelKey = () => ({ "🌱 Easy":"EASY", "⭐ Medium":"MEDIUM", "🔥 Hard":"HARD", "🏆 Expert":"EXPERT" })[$("q-level-label").textContent];
const kg = el => +el.textContent.replace(/[^0-9]/g, "");
const ro = side => d.querySelector("#scale-a .ro." + side);
const tray = v => d.querySelector('#tray button.wt[data-w="' + v + '"]');
const onPan = () => [...d.querySelectorAll("#scale-a .load button.wt")];
const tilt = (id = "scale-a") => +$(id).dataset.tilt;
const snapshot = () => d.querySelector("#scale-a").innerHTML;
const vis = id => !$(id).classList.contains("hide") && !$(id).classList.contains("invisible");
function switchTo(L){ $("q-level").click(); d.querySelector('#level-menu .level-opt[data-diff="' + L + '"]').click(); }
/* the fixed weight of each pan, read before the player touches anything */
function fixedTotals(){ return { L:kg(ro("l")), R:kg(ro("r")) }; }

ok(d.querySelector(".home-top .hub-link").getAttribute("href") === "../", "← All games on the start screen");
$("start-btn").click();
ok(vis("screen-game") && !$("screen-game").querySelector(".hub-link"), "Start shows the game, without the hub link");

for(const L of ["EASY", "MEDIUM"]){
  if(levelKey() !== L){ switchTo(L); ok(vis("screen-game"), L + ": switching level stays in the game"); }
  const set = E.LEVELS[L].set;
  ok(!vis("tray") === false && $("entry").classList.contains("hide"), L + ": the tray, no number pad");
  ok($("check-btn").classList.contains("hide"), L + ": no Check button — balancing is the win");
  ok($("next-btn").classList.contains("invisible") && !$("next-btn").classList.contains("hide"), L + ": Next holds the bottom slot invisibly");
  ok(d.querySelectorAll("#tray button.wt").length === set.length, L + ": the tray has " + set.join("/") + " kg");
  ok([...d.querySelectorAll("#tray button.wt")].every(b => /^\d+kg$/.test(b.textContent)), L + ": every weight shows its number");

  const open0 = snapshot(), f = fixedTotals(), heavy = Math.max(f.L, f.R);
  const openSide = f.L < f.R ? "l" : "r", openTotal = () => kg(ro(openSide));
  ok(f.L !== f.R, L + ": the pans start unequal");
  ok(Math.sign(tilt()) === Math.sign(f.R - f.L), L + ": the beam tips to the heavier side (" + tilt() + "°)");
  ok(tilt() === E.tiltFor(f.R - f.L), L + ": the tilt matches the difference");

  /* add and remove, checking the readout every time */
  /* (never step onto exact balance here — that would, rightly, end the round) */
  const safeAdd = () => set.slice().reverse().find(v => openTotal() + v !== heavy) ;
  let expect = openTotal();
  for(let k = 0; k < 3; k++){ const v = safeAdd(); tray(v).click(); expect += v; ok(openTotal() === expect, L + ": +" + v + " → the pan reads " + expect); }
  ok(onPan().length === 3 && $("next-btn").classList.contains("invisible"), L + ": three weights on the pan, still playing");
  ok(tilt() === E.tiltFor(kg(ro("r")) - kg(ro("l"))), L + ": the tilt follows every change");
  const first = +onPan()[0].textContent.replace(/\D/g, "");
  onPan()[0].click(); expect -= first;
  ok(openTotal() === expect, L + ": −" + first + " → the pan reads " + expect);

  /* overshoot: owl worried, still playing */
  for(let g = 0; g < 40 && openTotal() <= heavy; g++) tray(safeAdd()).click();
  ok(openTotal() > heavy, L + ": (setup) overshot");
  ok(d.getElementById("owl-game").classList.contains("worried"), L + ": owl worried on an overshoot");
  ok($("next-btn").classList.contains("invisible"), L + ": no win while unequal");
  $("hint-link").click();
  ok(/too heavy/.test($("feedback").textContent), L + ": the hint says take a weight off");

  /* Reset restores the exact opening state */
  $("reset-btn").click();
  ok(snapshot().replace(/style="[^"]*"/g, "") === open0.replace(/style="[^"]*"/g, "") && onPan().length === 0, L + ": Reset restores the exact opening state");
  ok(tilt() === E.tiltFor(f.R - f.L), L + ": Reset restores the opening tilt");

  /* the hint: the biggest weight that still fits */
  $("hint-link").click();
  const g0 = heavy - openTotal(), want = E.largestFit(g0, set);
  ok($("feedback").textContent.includes(want + " kg weight"), L + ": the hint suggests " + want + " kg for a " + g0 + " kg gap");
  ok(!!d.querySelector('#tray button.wt.hinted[data-w="' + want + '"]'), L + ": and highlights it in the tray");

  /* balance greedily (fine for these sets), and the round completes by itself */
  for(let g = 0; g < 40 && openTotal() < heavy; g++) tray(E.largestFit(heavy - openTotal(), set)).click();
  ok(openTotal() === heavy && tilt() === 0, L + ": level at " + heavy + " kg, beam at 0°");
  ok(vis("next-btn") && !$("result-view").classList.contains("hide"), L + ": balancing wins automatically — Next ▶ appears");
  ok($("skip-btn").classList.contains("invisible"), L + ": Skip hides with .invisible");
  ok(d.getElementById("owl-game").classList.contains("win"), L + ": owl wins");
  ok(/fewest possible/.test($("rsub").textContent), L + ": the result compares with the fewest weights");
  const pan = onPan().length;
  tray(set[0]).click();
  ok(onPan().length === pan, L + ": the pans are frozen after the win");

  /* Next: a fresh, different puzzle */
  const before = snapshot();
  $("next-btn").click();
  ok(snapshot() !== before && $("next-btn").classList.contains("invisible"), L + ": Next gives a new puzzle and hides again");
  const s0 = snapshot();
  $("skip-btn").click();
  ok(snapshot() !== s0, L + ": Skip gives a different puzzle");
}

/* keyboard: arrows walk tray and pans; Enter is the buttons' own activation */
{
  tray(1).focus();
  tray(1).dispatchEvent(new w.KeyboardEvent("keydown", { key:"ArrowRight", bubbles:true }));
  ok(d.activeElement === tray(2), "ArrowRight moves focus along the tray");
}

for(const L of ["HARD", "EXPERT"]){
  switchTo(L);
  ok(vis("screen-game") && levelKey() === L, L + ": switching level stays in the game");
  ok(!$("entry").classList.contains("hide") && $("tray").classList.contains("hide"), L + ": number pad, no tray");
  ok(!$("check-btn").classList.contains("hide") && $("check-btn").disabled, L + ": Check ✓ owns the slot, waiting for a number");
  ok($("next-btn").classList.contains("hide"), L + ": Next is hidden until the answer is right");
  ok(d.querySelectorAll("#scales .scale").length === (L === "EXPERT" ? 2 : 1), L + ": " + (L === "EXPERT" ? "two scales" : "one scale"));
  ok([...d.querySelectorAll("#scales .scale")].every(s => +s.dataset.tilt === 0), L + ": already level");
  ok(!d.querySelector('input[type="number"]'), L + ": no raw number input");

  /* work the answer out from what's shown, the way a child would */
  let ans;
  if(L === "HARD"){ ans = kg(ro("r")) - kg(ro("l")); }
  else {
    const a = d.querySelector("#scale-a"), b = d.querySelector("#scale-b");
    const m = kg(a.querySelector(".ro.l")), total = kg(a.querySelector(".ro.r")), c = kg(b.querySelector(".ro.l"));
    ans = total / m + c;
  }
  ok(Number.isInteger(ans) && ans > 0, L + ": the answer is a whole positive number (" + ans + ")");
  $("hint-link").click();
  const h = $("feedback").textContent;
  ok(/same|share|together/i.test(h) && !new RegExp("\\b" + ans + "\\b").test(h.replace(/\d+ kg/g, "")), L + ": the hint teaches the method: " + h);
  const typeIn = n => String(n).split("").forEach(k => d.querySelector('#pad .key[data-k="' + k + '"]').click());
  typeIn(ans === 1 ? 2 : ans - 1);
  $("check-btn").click();
  ok($("next-btn").classList.contains("hide") && !$("check-btn").classList.contains("hide"), L + ": a wrong number is rejected");
  ok(d.getElementById("owl-game").classList.contains("worried"), L + ": owl worried on a failed check");
  d.querySelector('#pad .key[data-k="Clear"]').click();
  ok($("ansbox").textContent === "?", L + ": Clear empties the answer");
  typeIn(ans);
  d.querySelector('#pad .key[data-k="⌫"]').click();
  ok($("ansbox").textContent === (String(ans).length > 1 ? String(ans).slice(0, -1) : "?"), L + ": ⌫ deletes a digit");
  $("reset-btn").click();
  ok($("ansbox").textContent === "?", L + ": Reset clears the entered number");
  typeIn(ans);
  $("check-btn").click();
  ok(vis("next-btn") && $("check-btn").classList.contains("hide"), L + ": the right number swaps Check ✓ for Next ▶");
  ok($("skip-btn").classList.contains("invisible"), L + ": Skip hides with .invisible");
  ok($("stars").textContent === "★☆☆", L + ": a wrong try AND a hint = ★, got " + $("stars").textContent);
  $("next-btn").click();
  ok(!$("check-btn").classList.contains("hide") && $("next-btn").classList.contains("hide"), L + ": Next brings Check back");
}

$("home-btn").click();
ok(vis("screen-home"), "Home returns to the start screen");
report("balance-scales play-through");
