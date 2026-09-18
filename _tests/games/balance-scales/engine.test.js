"use strict";
/* Balance Scales' engine. The one bug that makes the game unwinnable is an unreachable
   target, so the coin-change DP is proved against brute force for every target, reachable or
   not. Then 5,000 puzzles per level: every target reachable, every unknown whole and
   positive, no one-weight puzzles at Medium+, and the tilt behaves like a real beam. */
const { loadEngine, mulberry32, tally } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("balance-scales");

const LV = Object.keys(E.LEVELS);
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order");
ok(E.LEVELS.EASY.set.join() === "1,2,5" && E.LEVELS.MEDIUM.set.join() === "1,2,5,10", "weight sets");

/* ---- 1. coin-change DP vs brute force ---- */
function brute(target, set){
  /* breadth-first over counts: the first layer that hits the target is the minimum */
  let layer = new Set([0]), seen = new Set([0]);
  for(let n = 0; n <= target; n++){
    if(layer.has(target)) return n;
    const next = new Set();
    for(const v of layer) for(const w of set){ const u = v + w; if(u <= target && !seen.has(u)){ seen.add(u); next.add(u); } }
    if(!next.size) return Infinity;
    layer = next;
  }
  return Infinity;
}
/* the real sets, plus sets where greedy fails and sets with unreachable targets */
const SETS = [[1,2,5], [1,2,5,10], [1,3,4], [2,5], [3,7], [4,6,9], [5,10], [1,5,6,9], [2]];
let dpBad = 0, unreachable = 0, greedyWrong = 0;
for(const set of SETS) for(let t = 0; t <= 60; t++){
  const d = E.minWeights(t, set), b = brute(t, set);
  if(d !== b){ dpBad++; if(dpBad < 5) console.log("   DP " + set + " @" + t + ": " + d + " vs " + b); }
  if(b === Infinity) unreachable++;
  /* greedy for comparison: it must be wrong somewhere, or this test proves nothing */
  let g = 0, left = t; for(const w of set.slice().sort((a, c) => c - a)) while(left >= w){ left -= w; g++; }
  if(left === 0 && g !== b) greedyWrong++;
}
ok(dpBad === 0, "minWeights matches brute force on every target (" + dpBad + " wrong)");
ok(unreachable > 20, "the check includes genuinely unreachable targets (" + unreachable + ")");
ok(greedyWrong > 0, "the check includes targets where greedy gives the wrong count (" + greedyWrong + ")");
ok(E.minWeights(-1, [1]) === Infinity, "negative targets are unreachable");

/* ---- 2. the tilt ---- */
{
  let mono = true, prev = -Infinity;
  for(let d = -60; d <= 60; d++){ const a = E.tiltFor(d); if(a < prev) mono = false; prev = a; }
  ok(mono, "the tilt never decreases as the right pan gets heavier");
  let zero = true;
  for(let d = -60; d <= 60; d++) if((E.tiltFor(d) === 0) !== (d === 0)) zero = false;
  ok(zero, "the beam is level exactly when the pans are equal");
  ok(E.tiltFor(1) > 0 && E.tiltFor(-1) < 0, "the heavier side goes down (right heavier = clockwise)");
  ok(E.tiltFor(1000) === E.TILT_MAX && E.tiltFor(-1000) === -E.TILT_MAX, "clamped at ±" + E.TILT_MAX + "°");
  ok(E.TILT_MAX >= 15 && E.TILT_MAX <= 20, "clamped at about ±18°");
  ok(Math.abs(E.tiltFor(4) - 2 * E.tiltFor(2)) < 1e-9, "proportional to the difference below the clamp");
  ok(Object.is(E.tiltFor(0), 0), "level is exactly 0, not -0");
}

/* ---- 3. 5,000 puzzles per level ---- */
for(const L of LV){
  const rand = mulberry32(21 + L.length);
  let nul = 0, bad = 0, oneWeight = 0, repeat = 0, range = 0, notWhole = 0, midBad = 0;
  let prev = null;
  for(let t = 0; t < 5000; t++){
    const p = E.genPuzzle(L, rand, prev ? E.sigOf(prev) : null);
    if(!p){ nul++; continue; }
    if(prev && E.sigOf(prev) === E.sigOf(p)) repeat++;
    prev = p;
    if(p.kind === "balance"){
      const L0 = p.crate || p.left.reduce((a, b) => a + b, 0), R0 = p.right.reduce((a, b) => a + b, 0);
      const gap = Math.abs(L0 - R0);
      if(gap !== p.gap || gap === 0) bad++;
      if(brute(gap, p.set) === Infinity) bad++;                  /* reachable, proved independently */
      if(p.min !== brute(gap, p.set)) bad++;                     /* the star baseline is right */
      if(L !== "EASY" && p.min < 2) oneWeight++;
      if(L === "EASY" && (p.crate < 3 || p.crate > 20 || p.open !== "r" || R0 !== 0)) range++;
      if(L === "MEDIUM"){
        if(L0 > 40 || R0 > 40) range++;
        if([...p.left, ...p.right].some(w => !p.set.includes(w) || w > 10)) range++;
        if(p.open !== (L0 < R0 ? "l" : "r")) bad++;              /* you add to the LIGHTER side */
      }
    } else if(L === "HARD"){
      const e = p.extras.reduce((a, b) => a + b, 0), r = p.right.reduce((a, b) => a + b, 0);
      if(!Number.isInteger(p.answer) || p.answer <= 0) notWhole++;
      if(p.answer !== r - e || p.answer !== p.box) bad++;        /* 🎁 + e = r really holds */
      if(p.box < 2 || p.box > 15 || p.extras.length < 1 || p.extras.length > 2) range++;
    } else {
      const a = p.aRight.reduce((x, y) => x + y, 0), c = p.bLeft.reduce((x, y) => x + y, 0);
      const one = a / p.m;                                       /* the intermediate step */
      if(!Number.isInteger(one) || one <= 0) midBad++;
      if(!Number.isInteger(p.answer) || p.answer <= 0) notWhole++;
      if(one !== p.box || p.answer !== one + c || c !== p.c) bad++;
      if(p.m < 2 || p.m > 4 || p.box < 2 || p.box > 12) range++;
    }
  }
  ok(nul === 0, L + ": generation gave up " + nul + " times");
  ok(bad === 0, L + ": " + bad + " puzzles were inconsistent or unreachable");
  ok(oneWeight === 0, L + ": " + oneWeight + " puzzles were solvable with a single weight");
  ok(range === 0, L + ": " + range + " puzzles broke the suggested ranges");
  ok(notWhole === 0, L + ": " + notWhole + " answers were not whole and positive");
  ok(midBad === 0, L + ": " + midBad + " intermediate values were not whole and positive");
  ok(repeat === 0, L + ": Skip/Next reproduced the current puzzle " + repeat + " times");
}

/* ---- 4. hints and stars ---- */
ok(E.largestFit(7, [1,2,5]) === 5 && E.largestFit(4, [1,2,5]) === 2 && E.largestFit(10, [1,2,5,10]) === 10, "largestFit picks the biggest that fits");
ok(E.largestFit(0, [1,2,5]) === 0, "nothing fits a zero gap");
ok(E.discsFor(18).reduce((a, b) => a + b, 0) === 18 && E.discsFor(0).length === 0, "discsFor adds up");
ok(E.starsBalance(3, 3, 0) === 3 && E.starsBalance(5, 3, 0) === 2 && E.starsBalance(6, 3, 0) === 1, "balance stars by weights");
ok(E.starsBalance(3, 3, 1) === 2 && E.starsBalance(3, 3, 3) === 1, "balance stars by hints");
ok(E.starsSolve(0, 0) === 3 && E.starsSolve(1, 0) === 2 && E.starsSolve(0, 2) === 2 && E.starsSolve(1, 1) === 1 && E.starsSolve(2, 0) === 1, "solve stars");

report("balance-scales engine");
