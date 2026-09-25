"use strict";
/* Paper Punch stands on one claim: the sheet it calls "right" really is what you would see if you
   folded a real sheet, punched it and opened it out — holes, places AND (for the flag) which way
   each one faces. The engine reasons on a grid, walking the folds backwards. This test checks it
   against a completely separate model: a physical stack of paper layers in continuous
   coordinates. Each layer is a convex polygon of the original sheet plus the affine transform
   that carries it to where it now lies. A fold cuts every layer along the crease (Sutherland–
   Hodgman), flips the moving pieces over and stacks them on top; a punch pokes a disc through
   every layer and reads each hole back in original coordinates. It shares no code with the
   engine — only the fold's description (which crease, which side moves) is common input. */
const { loadEngine, mulberry32, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("paper-punch");

/* ================= the independent simulator ================= */
const EPS = 1e-9;
const HOLE_R = 0.45;     /* the whole hole (round or flag) fits in a disc this big around the cell centre */

/* affine: [a,b,c,d,e,f] maps (x,y) → (a·x + b·y + e, c·x + d·y + f) */
const apply = (T, p) => [T[0]*p[0] + T[1]*p[1] + T[4], T[2]*p[0] + T[3]*p[1] + T[5]];
const compose = (A, B) => [                  /* A after B */
  A[0]*B[0] + A[1]*B[2], A[0]*B[1] + A[1]*B[3],
  A[2]*B[0] + A[3]*B[2], A[2]*B[1] + A[3]*B[3],
  A[0]*B[4] + A[1]*B[5] + A[4], A[2]*B[4] + A[3]*B[5] + A[5]];
function invert(T){
  const det = T[0]*T[3] - T[1]*T[2];
  const a = T[3]/det, b = -T[1]/det, c = -T[2]/det, d = T[0]/det;
  return [a, b, c, d, -(a*T[4] + b*T[5]), -(c*T[4] + d*T[5])];
}

/* The crease of a fold, as a linear function g(p) that is > 0 on the MOVING side, and the
   mirror across it as an affine map. Written from the fold's plain description only. */
function crease(f){
  const { x0, y0, w, h } = f;
  let g, R;
  if(f.t === "V"){ const c = x0 + w/2; g = p => (f.mv ? p[0] - c : c - p[0]); R = [-1,0,0,1, 2*c, 0]; }
  else if(f.t === "H"){ const c = y0 + h/2; g = p => (f.mv ? p[1] - c : c - p[1]); R = [1,0,0,-1, 0, 2*c]; }
  else if(f.t === "D"){             /* the line from (x0,y0) to (x0+w,y0+w); side 0 = top-right */
    g = p => { const s = (p[0] - x0) - (p[1] - y0); return f.mv ? -s : s; };
    R = [0,1,1,0, x0 - y0, y0 - x0];
  } else {                          /* the line from (x0+w,y0) to (x0,y0+w); side 0 = top-left */
    g = p => { const s = w - (p[0] - x0) - (p[1] - y0); return f.mv ? -s : s; };
    R = [0,-1,-1,0, x0 + w + y0, y0 + w + x0];
  }
  return { g, R };
}

/* keep the part of a convex polygon where fn(p) >= 0 */
function clip(poly, fn){
  const out = [];
  for(let i = 0; i < poly.length; i++){
    const P = poly[i], Q = poly[(i + 1) % poly.length], a = fn(P), b = fn(Q);
    if(a >= -EPS) out.push(P);
    if((a > EPS && b < -EPS) || (a < -EPS && b > EPS)){
      const t = a / (a - b); out.push([P[0] + t*(Q[0] - P[0]), P[1] + t*(Q[1] - P[1])]);
    }
  }
  return out;
}
const area = poly => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0]*q[1] - q[0]*p[1]; }, 0)) / 2;

function newSheet(N){ return [{ poly: [[0,0],[N,0],[N,N],[0,N]], T: [1,0,0,1,0,0] }]; }   /* bottom → top */

function simFold(stack, f){
  const { g, R } = crease(f), stay = [], move = [];
  for(const L of stack){
    const here = p => g(apply(L.T, p));            /* the crease pulled back into this layer's own coordinates */
    const s = clip(L.poly, p => -here(p)), m = clip(L.poly, here);
    if(s.length >= 3 && area(s) > 1e-7) stay.push({ poly: s, T: L.T });
    if(m.length >= 3 && area(m) > 1e-7) move.push({ poly: m, T: compose(R, L.T) });
  }
  return stay.concat(move.reverse());              /* the flap lands on top, upside down */
}

/* the paper's current outline, measured from the layers themselves */
function simBox(stack){
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for(const L of stack) for(const p of L.poly){ const q = apply(L.T, p);
    x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
  return { x0: Math.round(x0), y0: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
}
/* for a convex polygon: the distance from q to the nearest edge line, positive inside, <= 0 outside */
function inside(poly, q){
  const s = orientSign(poly);
  let m = Infinity;
  for(let i = 0; i < poly.length; i++){
    const P = poly[i], Q = poly[(i + 1) % poly.length], ex = Q[0] - P[0], ey = Q[1] - P[1], len = Math.hypot(ex, ey);
    if(len < 1e-12) continue;
    m = Math.min(m, s * (ex*(q[1] - P[1]) - ey*(q[0] - P[0])) / len);
  }
  return m;
}
function orientSign(poly){ let s = 0; poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; s += p[0]*q[1] - q[0]*p[1]; }); return s > 0 ? 1 : -1; }
/* distance from q to a polygon it is outside of */
function distOut(poly, q){
  let m = Infinity;
  for(let i = 0; i < poly.length; i++){
    const P = poly[i], Q = poly[(i + 1) % poly.length], ex = Q[0] - P[0], ey = Q[1] - P[1];
    const t = Math.max(0, Math.min(1, ((q[0] - P[0])*ex + (q[1] - P[1])*ey) / (ex*ex + ey*ey)));
    m = Math.min(m, Math.hypot(q[0] - P[0] - t*ex, q[1] - P[1] - t*ey));
  }
  return m;
}
/* is a spot of the current paper covered? */
const covered = (stack, q) => stack.some(L => { const p = apply(invert(L.T), q); return inside(L.poly, p) > 1e-6; });

/* punch a disc at the centre of folded cell `cell`: every layer it goes through gives one hole,
   read back in original coordinates, with the matrix that says which way it now faces */
function simPunch(stack, N, cell){
  const c = [cell % N + .5, ((cell / N) | 0) + .5], holes = [];
  let straddle = false;
  for(const L of stack){
    const Ti = invert(L.T), q = apply(Ti, c), m = inside(L.poly, q);
    if(m >= HOLE_R - 1e-9){
      holes.push({ i: Math.floor(q[1])*N + Math.floor(q[0]), M: [Ti[0], Ti[1], Ti[2], Ti[3]].map(Math.round), top: false });
    } else if(m > -1e-9 || distOut(L.poly, q) < HOLE_R - 1e-9) straddle = true;
  }
  if(holes.length) holes[holes.length - 1].top = true;
  return { holes, straddle };
}

/* ================= helpers ================= */
const holeKey = (i, M, shape) => i + ":" + (shape === "round" ? "o" : M.join(" "));
const engineSet = (holes, shape) => holes.map(h => holeKey(h.i, E.D4[h.o], shape)).sort().join(",");

/* ================= 0. the level table ================= */
const LV = Object.keys(E.LEVELS);
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels in order, got " + LV.join(","));
ok(E.LEVELS.EASY.choices === 3 && E.LEVELS.MEDIUM.choices === 4 && E.LEVELS.HARD.choices === 4 && E.LEVELS.EXPERT.choices === 0,
   "choices should be 3 / 4 / 4 / none");
ok(E.LEVELS.EASY.shape === "round" && E.LEVELS.MEDIUM.shape === "round", "EASY and MEDIUM punch round holes");
ok(E.LEVELS.HARD.shape === "flag" && E.LEVELS.EXPERT.shape === "flag", "HARD and EXPERT punch the lopsided flag");
ok(E.starsFor(0) === 3 && E.starsFor(1) === 2 && E.starsFor(2) === 1 && E.starsFor(3) === 1 && E.starsFor(9) === 1,
   "stars: ★★★ minus one per wrong try, never below ★");

/* the flag really is lopsided: its eight orientations are eight different shapes */
{
  const FLAG = [[-.27,-.37],[-.16,-.37],[.36,-.16],[-.16,.05],[-.16,.37],[-.27,.37]];
  const seen = new Set(E.D4.map(m => FLAG.map(p => [m[0]*p[0] + m[1]*p[1], m[2]*p[0] + m[3]*p[1]])
    .map(p => p.map(v => v.toFixed(2)).join(",")).sort().join(" ")));
  ok(seen.size === 8, "the flag should look different in all 8 orientations, got " + seen.size);
  ok(E.D4.every(m => Math.abs(m[0]*m[3] - m[1]*m[2]) === 1), "every D4 entry is a rotation or a reflection");
}

/* ================= 1. bulk proofs, per level ================= */
for(const lv of LV){
  const rng = mulberry32(0xC0FFEE + LV.indexOf(lv));
  const L = E.LEVELS[lv], n = stress(2000);
  let fails = 0, diagCount = 0, punchCounts = new Set(), types = new Set();
  const fail = msg => { if(fails++ < 8) ok(false, lv + ": " + msg); };
  for(let s = 0; s < n; s++){
    const p = E.newPuzzle(lv, rng);
    const N = p.N;
    if(N !== L.size) fail("sheet should be " + L.size + ", got " + N);

    /* fold by fold, on the physical stack */
    let stack = newSheet(N);
    p.folds.forEach((f, k) => {
      const b = simBox(stack);
      if(b.x0 !== f.x0 || b.y0 !== f.y0 || b.w !== f.w || b.h !== f.h)
        fail("fold " + k + " names box " + JSON.stringify([f.x0, f.y0, f.w, f.h]) + " but the paper's box is " + JSON.stringify(b));
      if(f.t === "D" || f.t === "A"){
        diagCount++;
        /* a whole square: box square and every quarter-triangle of every cell in it covered */
        let full = b.w === b.h;
        for(let y = b.y0; full && y < b.y0 + b.h; y++) for(let x = b.x0; full && x < b.x0 + b.w; x++)
          for(const q of [[.5,.2],[.8,.5],[.5,.8],[.2,.5]]) if(!covered(stack, [x + q[0], y + q[1]])){ full = false; break; }
        if(!full) fail("a diagonal fold (fold " + k + ") was made on paper that is not a whole square");
      }
      types.add(f.t);
      stack = simFold(stack, f);
    });

    /* punch and open */
    const sim = [];
    let top = null;
    for(const c of p.punches){
      const r = simPunch(stack, N, c);
      if(r.straddle) fail("the hole at folded cell " + c + " straddles a crease or a paper edge (" + JSON.stringify(p.folds) + ")");
      if(!r.holes.length) fail("the punch at folded cell " + c + " went through no paper");
      sim.push(...r.holes);
      if(!top) top = r.holes.find(h => h.top);
    }
    punchCounts.add(p.punches.length);
    const want = sim.map(h => holeKey(h.i, h.M, p.shape)).sort().join(",");
    const got = engineSet(p.answer, p.shape);
    if(got !== want) fail("engine answer " + got + " ≠ the folded sheet's " + want + " for " + JSON.stringify(p.folds) + " punch " + p.punches);
    if(new Set(sim.map(h => h.i)).size !== sim.length) fail("two layers put a hole in the same cell");
    if(p.stages[p.folds.length] !== p.answer) fail("the last hint stage should be the answer");
    if(p.stages[0].length !== p.punches.length) fail("hint stage 0 should be just the punch");

    /* the choices */
    if(L.choices){
      if(!p.options || p.options.length !== L.choices) fail("should offer " + L.choices + " choices");
      const keys = p.options.map(o => engineSet(o, p.shape));
      if(new Set(keys).size !== keys.length) fail("two choices are the same sheet");
      const right = keys.filter(k => k === want).length;
      if(right !== 1) fail(right + " choices match the folded sheet — exactly one should");
      if(keys[p.correct] !== want) fail("p.correct does not point at the right sheet");
      for(const o of p.options) for(const h of o)
        if(!(h.i >= 0 && h.i < N*N) || !(h.o >= 0 && h.o < 8)) fail("a choice has a hole off the sheet");
    } else {
      /* EXPERT: the check accepts exactly the answer, in any order, and nothing near it */
      if(!E.checkMarks(p, p.answer.slice().reverse())) fail("checkMarks rejects the right marks");
      if(E.checkMarks(p, p.answer.slice(1))) fail("checkMarks accepts a missing hole");
      if(E.checkMarks(p, p.answer.map(h => ({ i: h.i, o: (h.o + 1) % 8 })))) fail("checkMarks accepts wrongly-facing flags");
    }

    /* the top-layer mistake the distractors use is the real top layer */
    const tl = E.topLayer(N, p.folds, p.fps, p.punches[0]);
    if(top && holeKey(tl.i, E.D4[tl.o], "flag") !== holeKey(top.i, top.M, "flag"))
      fail("topLayer() says " + tl.i + " but the stack's top layer is " + top.i);

    /* Skip: never the same puzzle again */
    const q = E.newPuzzle(lv, rng, p.sig);
    if(q.sig === p.sig) fail("Skip returned the same puzzle " + p.sig);
  }
  ok(fails === 0, lv + ": " + fails + " failures over " + n + " puzzles");

  /* the level really is what its card says */
  const probe = mulberry32(99 + LV.indexOf(lv)), ps = [];
  for(let s = 0; s < 300; s++) ps.push(E.newPuzzle(lv, probe));
  const nf = { EASY: 1, MEDIUM: 2, HARD: 2, EXPERT: 3 }[lv];
  ok(ps.every(p => p.folds.length === nf), lv + ": every puzzle should have " + nf + " fold(s)");
  if(lv === "EASY" || lv === "MEDIUM") ok(ps.every(p => p.folds.every(f => f.t === "V" || f.t === "H")), lv + ": half-folds only");
  if(lv === "MEDIUM") ok(ps.every(p => new Set(p.folds.map(f => f.t)).size === 2), "MEDIUM folds in quarters: one V and one H");
  if(lv === "MEDIUM") ok(punchCounts.has(1) && punchCounts.has(2), "MEDIUM should punch 1 or 2 holes, saw " + [...punchCounts]);
  if(lv === "HARD") ok(ps.every(p => p.folds.some(f => f.t === "D" || f.t === "A")), "HARD: every puzzle has a diagonal fold");
  if(lv === "EXPERT"){
    const d = ps.filter(p => p.folds.some(f => f.t === "D" || f.t === "A")).length / ps.length;
    ok(d > .3 && d < .7, "EXPERT: about half the puzzles should carry a diagonal, got " + Math.round(d * 100) + "%");
  }
  console.log("  " + lv.padEnd(7) + " " + n + " puzzles checked against the paper stack; fold types " + [...types].join("") + ", " + diagCount + " diagonal folds");
}

/* ================= 2. the simulator itself, on cases worked by hand ================= */
{
  /* 4×4, left half over right, punch column 2 row 1 (cell 6): holes at 5 and 6, the left one mirrored */
  let st = newSheet(4);
  st = simFold(st, { t:"V", mv:0, x0:0, y0:0, w:4, h:4 });
  const r = simPunch(st, 4, 6);
  ok(!r.straddle && r.holes.map(h => h.i).sort().join() === "5,6", "hand case: V fold gives holes 5 and 6, got " + r.holes.map(h => h.i));
  ok(r.holes.find(h => h.i === 5).M.join() === "-1,0,0,1", "hand case: the flap's hole is mirrored left-right");
  ok(r.holes.find(h => h.i === 5).top, "hand case: the flap lies on top");
  /* a diagonal crease runs through cell 0 — punching it must straddle */
  let sd = simFold(newSheet(4), { t:"D", mv:0, x0:0, y0:0, w:4, h:4 });
  ok(simPunch(sd, 4, 0).straddle, "hand case: a hole on a diagonal crease straddles it");
  ok(!simPunch(sd, 4, 4).straddle && simPunch(sd, 4, 4).holes.map(h => h.i).sort((a, b) => a - b).join() === "1,4",
     "hand case: a D fold sends cell 1 onto cell 4");
}

report("paper-punch engine");
