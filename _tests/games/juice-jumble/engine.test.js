"use strict";
/* Juice Jumble engine, run against the real games/juice-jumble/index.html. Proves the pour rule
   exactly, that juice is never created or destroyed, that every generated board is solvable
   with its claimed par, that solveMin really is minimal, and that Skip/Next never repeat. */
const { loadEngine, tally, mulberry32 } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("juice-jumble");
const { LEVELS, FLAVOURS } = E;

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const counts = g => { const c = {}; g.flat().forEach(f => c[f] = (c[f] || 0) + 1); return c; };
function replay(g, path, cap){
  for(const [i, j] of path){ const n = E.pour(g, i, j, cap); if(!n) return null; g = n; }
  return g;
}

/* ---- the flavours: eight, each with its own glyph so colour is never the only cue ---- */
ok(FLAVOURS.length === 8, "eight flavours");
ok(new Set(FLAVOURS.map(f => f.emoji)).size === 8, "every flavour needs a distinct glyph");
ok(new Set(FLAVOURS.map(f => f.color)).size === 8, "every flavour needs a distinct colour");
const spec = { EASY:[3,3,2], MEDIUM:[4,4,2], HARD:[6,4,2], EXPERT:[7,4,1] };
for(const [k, [f, d, e]] of Object.entries(spec))
  ok(LEVELS[k].flavours === f && LEVELS[k].depth === d && LEVELS[k].empties === e,
     k + " should be " + f + " flavours, depth " + d + ", " + e + " empty");

/* ---- the pour rule, by hand ---- */
{
  const cap = 4;
  const g = [[0,1,1], [2,1], [], [3,3,3,3], [0,0,0,2]];
  let n = E.pour(g, 0, 2, cap);
  ok(eq(n, [[0], [2,1], [1,1], [3,3,3,3], [0,0,0,2]]), "the whole top run moves into an empty glass");
  ok(eq(g, [[0,1,1], [2,1], [], [3,3,3,3], [0,0,0,2]]), "pour must never mutate its input");
  n = E.pour(g, 0, 1, cap);
  ok(eq(n[0], [0]) && eq(n[1], [2,1,1,1]), "a run onto a matching top with room moves in full");
  n = E.pour(g, 1, 0, cap);
  ok(eq(n[0], [0,1,1,1]) && eq(n[1], [2]), "a single band onto a match");
  ok(E.pour(g, 0, 4, cap) === null, "mismatched top is illegal");
  ok(E.pour(g, 0, 0, cap) === null, "a glass can't pour into itself");
  ok(E.pour(g, 2, 0, cap) === null, "an empty glass has nothing to pour");
  ok(E.pour(g, 3, 2, cap) === null, "a finished glass (full, one flavour) is not a source");
  ok(E.pour(g, 1, 3, cap) === null, "a full glass takes nothing");
  /* partial pour: fills exactly to capacity, the rest stays behind */
  const p = [[2,1,1,1], [0,0,1]];
  n = E.pour(p, 0, 1, cap);
  ok(eq(n, [[2,1,1], [0,0,1,1]]), "a partial pour fills to capacity and leaves the rest: " + JSON.stringify(n));
  ok(E.pourAmount(p, 0, 1, cap) === 1, "pourAmount reports the partial amount");
  ok(E.topRun([0,1,1,1]) === 3 && E.topRun([]) === 0 && E.topRun([2]) === 1, "topRun");
  ok(E.isDone([1,1,1,1], 4) && !E.isDone([1,1,1], 4) && !E.isDone([1,1,2,1], 4), "isDone");
  ok(E.isSolved([[1,1,1,1], [], [0,0,0,0]], 4) && !E.isSolved([[1,1], [1,1]], 4),
     "solved means every glass empty or full of one flavour");
}

/* ---- conservation and the pour rule across random play ---- */
{
  const rng = mulberry32(7);
  let pours = 0, partial = 0;
  for(const lv of Object.keys(LEVELS)){
    const cap = LEVELS[lv].depth;
    for(let t = 0; t < 300; t++){
      let g = E.deal(lv, rng);
      const c0 = counts(g);
      for(let s = 0; s < 40; s++){
        const moves = E.legalMoves(g, cap);
        /* every legal move is exactly what canPour says, and every other pair is refused */
        for(let i = 0; i < g.length; i++) for(let j = 0; j < g.length; j++){
          const legal = moves.some(m => m[0] === i && m[1] === j);
          if(legal !== (E.pour(g, i, j, cap) !== null)) ok(false, lv + ": legalMoves and pour disagree at " + i + "->" + j);
        }
        if(!moves.length) break;
        const [i, j] = moves[Math.floor(rng() * moves.length)];
        const src = g[i], dst = g[j], top = src[src.length - 1];
        const want = Math.min(E.topRun(src), cap - dst.length);
        const n = E.pour(g, i, j, cap);
        pours++;
        if(want < E.topRun(src)) partial++;
        if(n[i].length !== src.length - want || n[j].length !== dst.length + want)
          ok(false, lv + ": pour moved the wrong amount");
        if(n[j].slice(dst.length).some(f => f !== top)) ok(false, lv + ": poured juice changed flavour");
        if(n[j].length > cap) ok(false, lv + ": a glass overflowed");
        if(!eq(counts(n), c0)) ok(false, lv + ": juice was created or destroyed");
        g = n;
      }
    }
  }
  ok(pours > 20000 && partial > 100, "random play should cover plenty of pours (" + pours + ") and partial pours (" + partial + ")");
}

/* ---- solveMin is really minimal: brute-force iterative deepening over EVERY legal move
   (no pruning, no canonicalisation) on small boards, so the solver's pruning is proven safe ---- */
{
  function idMin(g, cap, max){
    for(let d = 0; d <= max; d++){
      const seen = new Map();
      const dfs = (x, left) => {
        if(E.isSolved(x, cap)) return true;
        if(!left) return false;
        const k = JSON.stringify(x);
        if((seen.get(k) || -1) >= left) return false;
        seen.set(k, left);
        return E.legalMoves(x, cap).some(([i, j]) => dfs(E.pour(x, i, j, cap), left - 1));
      };
      if(dfs(g, d)) return d;
    }
    return Infinity;
  }
  const rng = mulberry32(99);
  let checked = 0;
  for(let t = 0; t < 150; t++){
    const g = E.deal("EASY", rng), cap = 3;
    const r = E.solveMin(g, cap);
    if(r.status !== "solved") continue;
    const truth = idMin(g, cap, r.path.length);
    checked++;
    if(truth !== r.path.length) ok(false, "EASY board " + JSON.stringify(g) + ": solveMin " + r.path.length + " but brute force " + truth);
  }
  ok(checked > 100, "should have brute-force checked many boards, got " + checked);
}

/* ---- generation, 5,000 per level ---- */
const PER_LEVEL = +(process.env.JJ_BOARDS || 5000);
for(const lv of Object.keys(LEVELS)){
  const L = LEVELS[lv], cap = L.depth, rng = mulberry32(1000 + lv.length);
  let fails = 0, minPar = Infinity, maxPar = 0, inexact = 0;
  const t0 = Date.now();
  let prev = null;
  for(let k = 0; k < PER_LEVEL; k++){
    const P = E.genPuzzle(lv, rng, prev);
    const bad = m => { if(fails++ < 5) ok(false, lv + " #" + k + ": " + m + " " + JSON.stringify(P && P.glasses)); };
    if(!P){ bad("generation failed"); continue; }
    const g = P.glasses;
    if(g.length !== L.flavours + L.empties) bad("wrong glass count");
    if(g.filter(a => a.length === 0).length !== L.empties) bad("wrong number of empty glasses");
    if(g.some(a => a.length && a.length !== cap)) bad("a dealt glass isn't filled to depth");
    const c = counts(g);
    if(Object.keys(c).length !== L.flavours || Object.values(c).some(v => v !== cap)) bad("flavour counts are off");
    if(g.some(a => E.isDone(a, cap))) bad("a glass starts full of one flavour (a free win)");
    if(E.isSolved(g, cap)) bad("starts already solved");
    if(P.par < L.floor) bad("par " + P.par + " is under the floor " + L.floor);
    if(P.exact && P.par !== P.path.length) bad("par doesn't match its path");
    const end = replay(g, P.path, cap);
    if(!end || !E.isSolved(end, cap)) bad("its solution path doesn't solve it move by move");
    if(prev && E.boardKey(prev) === E.boardKey(g)) bad("Skip/Next handed back the same board");
    if(!P.exact) inexact++;
    minPar = Math.min(minPar, P.par); maxPar = Math.max(maxPar, P.par);
    prev = g;
  }
  ok(fails === 0, lv + ": " + fails + " bad boards");
  console.log("  " + lv.padEnd(7) + PER_LEVEL + " boards ok · par " + minPar + "–" + maxPar
    + (inexact ? " · " + inexact + " inexact" : "") + " · " + ((Date.now() - t0) / PER_LEVEL).toFixed(1) + " ms/board");
}

/* ---- Skip/Next on a tiny pool: `avoid` is honoured even for the same deal in another order ---- */
{
  const rng = mulberry32(5);
  for(let t = 0; t < 300; t++){
    const P = E.genPuzzle("EASY", rng);
    const shuffled = P.glasses.slice().reverse();
    const Q = E.genPuzzle("EASY", rng, shuffled);
    if(E.boardKey(Q.glasses) === E.boardKey(P.glasses)) { ok(false, "avoid ignored a reordered copy"); break; }
  }
}

/* ---- isSolvable agrees with solveMin wherever both are decisive; stuck states exist ---- */
{
  const rng = mulberry32(31);
  let stuck = 0, agree = 0;
  for(const lv of ["MEDIUM", "HARD", "EXPERT"]){
    const cap = LEVELS[lv].depth;
    for(let t = 0; t < 120; t++){
      let g = E.genPuzzle(lv, rng).glasses;
      for(let s = 0; s < 12; s++){
        const m = E.legalMoves(g, cap);
        if(!m.length) break;
        g = E.pour(g, ...m[Math.floor(rng() * m.length)], cap);
        const a = E.isSolvable(g, cap), r = E.solveMin(g, cap);
        if(a === null || r.status === "budget") continue;
        agree++;
        if(a !== (r.status === "solved")) ok(false, lv + ": isSolvable " + a + " but solveMin " + r.status);
        if(a === false) stuck++;
      }
    }
  }
  ok(agree > 1000, "should have cross-checked plenty of states, got " + agree);
  ok(stuck > 50, "random play should reach stuck states the nudge can name, got " + stuck);
  /* a hopeless board: no legal pour at all */
  const dead = [[0,1,0,1], [1,0,1,0]];
  ok(E.legalMoves(dead, 4).length === 0 && E.isSolvable(dead, 4) === false, "a board with no pours is unsolvable");
  ok(E.solveMin(dead, 4).status === "unsolvable", "solveMin proves it unsolvable");
  /* budget: a tiny cap reports "don't know" instead of guessing */
  const hard = E.genPuzzle("HARD", mulberry32(2)).glasses;
  ok(E.solveMin(hard, 4, 5).status === "budget", "solveMin should report an exceeded budget");
  ok(E.isSolvable(hard, 4, 2) === null, "isSolvable should return null when it runs out of budget");
  const any = E.solveAny(hard, 4);
  ok(any.status === "solved" && E.isSolved(replay(hard, any.path, 4), 4), "solveAny's path solves the board");
}

/* ---- stars ---- */
ok(E.starsFor(10, 10, true) === 3 && E.starsFor(13, 10, true) === 3 && E.starsFor(14, 10, true) === 2
   && E.starsFor(18, 10, true) === 2 && E.starsFor(19, 10, true) === 1, "exact-par star bands: +3 / +8");
ok(E.starsFor(16, 10, false) === 3 && E.starsFor(17, 10, false) === 2 && E.starsFor(25, 10, false) === 1,
   "inexact par widens the bands");

report("juice-jumble engine");
