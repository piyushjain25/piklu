"use strict";
/* Lights Out stands on one claim: every board it hands a child can actually be finished. That
   is a proof, not a spot check — boards are solvable by construction, and solveMin() is exact
   linear algebra over GF(2) — so this test verifies both ends of it in bulk: every generated
   board is solvable, and the minimum solution solveMin() scores the stars on really does clear
   the board when you click it. */
const { loadEngine, mulberry32, tally } = require("../../lib/harness.js");
const { ok, report, checks } = tally();
const E = loadEngine("lights-out");

const LV = Object.keys(E.LEVELS);
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order: " + LV.join(","));
/* the ladder: the town grows, the depth floor rises, and the step-back allowance shrinks */
ok(LV.map(l => E.LEVELS[l].size).join(",") === "2,3,4,5", "grids should run 2x2 up to 5x5");
for(let i = 1; i < LV.length; i++){
  ok(E.LEVELS[LV[i]].size > E.LEVELS[LV[i-1]].size, LV[i] + " should be a bigger town than " + LV[i-1]);
  ok(E.LEVELS[LV[i]].floor > E.LEVELS[LV[i-1]].floor,
     LV[i] + " should demand a deeper puzzle than " + LV[i-1]
     + " (" + E.LEVELS[LV[i]].floor + " vs " + E.LEVELS[LV[i-1]].floor + ")");
  ok(E.LEVELS[LV[i]].undoLimit < E.LEVELS[LV[i-1]].undoLimit,
     LV[i] + " should allow fewer steps back than " + LV[i-1]);
}
ok(E.LEVELS.EASY.undoLimit === Infinity, "Easy should let you undo everything");
ok(E.LEVELS.EXPERT.undoLimit === 1, "Expert should allow only the last tap back");
for(const lv of LV) ok(E.LEVELS[lv].undoLimit >= 1, lv + ": every level must offer some Undo");
/* the floor has to be reachable: a k-click seed can never need more than k clicks */
for(const lv of LV) ok(E.LEVELS[lv].k[0] >= E.LEVELS[lv].floor,
  lv + ": the smallest seed (" + E.LEVELS[lv].k[0] + ") cannot reach the floor (" + E.LEVELS[lv].floor + ")");

/* ---------- 1. the flip rule ---------- */
for(const lv of LV){
  const { size } = E.LEVELS[lv];
  for(let i = 0; i < size * size; i++){
    const f = E.flipList(i, size);
    ok(f.indexOf(i) >= 0, lv + ": a click must toggle the cell you clicked (" + i + ")");
    ok(new Set(f).size === f.length, lv + ": flip list has a duplicate at " + i);
    ok(f.every(t => t >= 0 && t < size * size), lv + ": flip list left the board at " + i);
    ok(f.length <= 5, lv + ": a click should never toggle more than 5 cells");
    /* the rule must be symmetric — if clicking a toggles b, clicking b toggles a */
    for(const t of f) ok(E.flipList(t, size).indexOf(i) >= 0,
      lv + ": flip rule is not symmetric between " + i + " and " + t);
    /* the shape is a PLUS on every level — consistency is the point, no level changes it */
    const r = (i / size) | 0, c = i % size;
    for(const t of f){
      if(t === i) continue;
      const tr = (t / size) | 0, tc = t % size;
      ok(Math.abs(tr - r) + Math.abs(tc - c) === 1,
         lv + ": every level must use the plus shape, but " + i + "->" + t + " is not orthogonal");
    }
  }
  /* clicking twice is the identity — this is why a solution is a SET, and why Undo works */
  const rand = mulberry32(99);
  for(let t = 0; t < 200; t++){
    const b = Array.from({length:size * size}, () => (rand() < .5 ? 1 : 0));
    const i = (rand() * size * size) | 0;
    ok(E.applyClick(E.applyClick(b, i, size), i, size).join("") === b.join(""),
       lv + ": clicking twice should restore the board");
  }
}

/* ---------- 2. 10,000 generated boards: solvable, deep enough, and really clearable ------- */
const N_PER_LEVEL = 2500;
for(const lv of LV){
  const { size, floor } = E.LEVELS[lv];
  const rand = mulberry32(0xC0FFEE ^ lv.length * 7919);
  let worst = Infinity, deepest = 0, t0 = Date.now();
  let prev = null;
  for(let g = 0; g < N_PER_LEVEL; g++){
    const board = E.genBoard(lv, rand, prev);

    ok(board.length === size * size, lv + ": board is the wrong size");
    ok(board.every(v => v === 0 || v === 1), lv + ": board holds something other than 0/1");
    ok(!E.isSolved(board), lv + ": handed out an already-solved board");
    if(prev) ok(board.join("") !== prev.join(""), lv + ": Skip/Next repeated the current board");

    const min = E.solveMin(board, size);
    ok(min > 0, lv + ": board is UNSOLVABLE — " + board.join(""));
    ok(min >= floor, lv + ": board needs only " + min + " clicks, floor is " + floor);

    /* the real check: click the minimum solution and the town must go dark */
    const mask = E.solveMask(board, size);
    let b = board;
    let clicked = 0;
    for(let i = 0; i < size * size; i++) if(mask >> i & 1){ b = E.applyClick(b, i, size); clicked++; }
    ok(E.isSolved(b), lv + ": the minimum solution did not clear the board — " + board.join(""));
    ok(clicked === min, lv + ": solveMin said " + min + " but the mask holds " + clicked);

    worst = Math.min(worst, min); deepest = Math.max(deepest, min);
    prev = board;
  }
  console.log("  " + lv.padEnd(7) + " " + N_PER_LEVEL + " boards · " + size + "×" + size
    + " · min clicks " + worst + "–" + deepest + " (floor " + floor + ") · " + (Date.now() - t0) + "ms");
}

/* ---------- 2b. the property the Hint rests on ----------
   The hint points at a window from the current minimum solution. That is only safe if tapping
   such a window always leaves the puzzle exactly one step shorter — otherwise a hint could
   quietly send a child down a LONGER path. Proven here across every level. */
for(const lv of LV){
  const { size } = E.LEVELS[lv];
  const rand = mulberry32(0x51DE ^ lv.length);
  for(let g = 0; g < 120; g++){
    let b = E.genBoard(lv, rand, null);
    let min = E.solveMin(b, size);
    /* walk the whole solution, re-deriving the hint from scratch at every step */
    let guard = 0;
    while(!E.isSolved(b) && guard++ < 40){
      const mask = E.solveMask(b, size);
      ok(mask > 0, lv + ": a mid-solve board should still be solvable");
      const cells = [];
      for(let i = 0; i < size * size; i++) if(mask >> i & 1) cells.push(i);
      ok(cells.length === min, lv + ": solveMask popcount should equal solveMin");
      /* EVERY cell of the minimum solution must be a safe hint, not just the one we take */
      for(const c of cells)
        ok(E.solveMin(E.applyClick(b, c, size), size) === min - 1,
           lv + ": tapping a minimum-solution window must drop the minimum by exactly 1");
      b = E.applyClick(b, cells[0], size);
      min--;
    }
    ok(E.isSolved(b), lv + ": following the hint to the end should clear the board");
    ok(min === 0, lv + ": the minimum should reach 0 exactly as the board clears");
  }
}
console.log("  hint safety: every minimum-solution window drops the minimum by exactly 1");

/* ---------- 3. solveMin is a MINIMUM, not just any solution ---------- */
/* brute-force every click set on the small grids and confirm solveMin found the smallest */
for(const [lv, n] of [["EASY", 4], ["MEDIUM", 9]]){
  const size = E.LEVELS[lv].size, rand = mulberry32(4242 + n);
  for(let t = 0; t < 300; t++){
    const board = E.genBoard(lv, rand, null);
    let brute = Infinity;
    for(let mask = 0; mask < (1 << n); mask++){
      let b = board;
      for(let i = 0; i < n; i++) if(mask >> i & 1) b = E.applyClick(b, i, size);
      if(E.isSolved(b)) brute = Math.min(brute, E.popcount(mask));
    }
    ok(E.solveMin(board, size) === brute,
       "solveMin " + E.solveMin(board, size) + " != brute-force minimum " + brute);
  }
  console.log("  solveMin matches exhaustive brute force on 300 " + size + "×" + size + " boards");
}

/* ---------- 4. an unsolvable board is reported, not silently 'solved' ---------- */
{
  /* the classic result: on a 4×4 board (HARD), exactly one light on is unsolvable — only
     4096 of its 65536 boards can be cleared at all, which is exactly why generation seeds
     from the solved state instead of randomising the lights */
  const board = new Array(16).fill(0); board[0] = 1;
  const m = E.solveMin(board, 4);
  ok(m === -1, "a single lit corner on 4×4 should be unsolvable, got " + m);
  ok(E.solveMask(board, 4) === -1, "solveMask should report -1 for an unsolvable board");
}

/* ---------- 5. stars ---------- */
/* gate 1 — how close to the shortest solution, with no hints in play */
ok(E.starsFor(5, 5, 0) === 3 && E.starsFor(7, 5, 0) === 3, "3 stars up to min+2");
ok(E.starsFor(8, 5, 0) === 2 && E.starsFor(10, 5, 0) === 2, "2 stars up to min+5");
ok(E.starsFor(11, 5, 0) === 1, "1 star beyond min+5");
ok(E.starsFor(99, 5, 0) === 1, "never fewer than 1 star");
/* gate 2 — hints cap the rating no matter how efficient the solve was */
ok(E.starsFor(5, 5, 1) === 2, "a single hint should cap a perfect solve at 2 stars");
ok(E.starsFor(5, 5, E.HINT_MAX) === 2, "up to HINT_MAX hints still allows 2 stars");
ok(E.starsFor(5, 5, E.HINT_MAX + 1) === 1, "more than HINT_MAX hints drops to 1 star");
/* the round takes the WORSE of the two gates, never the better */
ok(E.starsFor(11, 5, 0) === 1, "hints being clean must not rescue a sprawling solve");
ok(E.starsFor(99, 5, 99) === 1, "both gates bad is still 1 star");
ok(E.HINT_MAX >= 1, "HINT_MAX should leave room for at least one 2-star hint");

report("lights-out engine (" + (N_PER_LEVEL * 4) + " generated boards)");
