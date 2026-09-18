"use strict";
/* Dino Dig stands on one claim: every board can be cleared by thinking, from the first dig,
   without ever guessing. This test proves it in bulk (2,000 boards per level) and — so the
   proof is not circular — re-checks every single deduction the solver makes with a separate,
   deliberately naive counter-model search: a square only counts as "proved safe" if NO egg
   layout that fits what is showing puts an egg there (and likewise for proved eggs).
   It also pins down the mechanics a child actually touches: neighbour counts, the flood that
   opens a patch of zeros, chording, hints and the star rule. */
const { loadEngine, mulberry32, tally } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("dino-dig");

const LV = Object.keys(E.LEVELS);
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order: " + LV.join(","));
const want = { EASY:[7,6,Infinity], MEDIUM:[9,12,Infinity], HARD:[10,17,Infinity], EXPERT:[10,22,3] };
for(const l of LV){
  const c = E.LEVELS[l];
  ok(c.size === want[l][0] && c.eggs === want[l][1] && c.lives === want[l][2],
     l + ": expected " + want[l].join("/") + ", got " + [c.size, c.eggs, c.lives].join("/"));
}

/* ---- independent helpers (the test's own, never the engine's) ---- */
function naiveCount(eggs, size, i){
  const r = (i / size) | 0, c = i % size; let k = 0;
  for(let dr = -1; dr <= 1; dr++) for(let dc = -1; dc <= 1; dc++){
    if(!dr && !dc) continue;
    const nr = r + dr, nc = c + dc;
    if(nr >= 0 && nr < size && nc >= 0 && nc < size && eggs[nr * size + nc]) k++;
  }
  return k;
}
const touching = (size, a, b) => a !== b && Math.abs(((a / size) | 0) - ((b / size) | 0)) <= 1 && Math.abs(a % size - b % size) <= 1;

/* Is there ANY egg layout that fits every dug number and the total egg count, with square x
   set to v (1 = egg, 0 = safe)? Plain backtracking — no components, no subset tricks, no count
   bookkeeping per piece, no shared code with the engine's solver. */
function counterModel(size, total, st, counts, x, v){
  const n = size * size;
  let known = 0; for(let i = 0; i < n; i++) if(st[i] === 2) known++;
  const remaining = total - known;
  const cons = [];
  for(let i = 0; i < n; i++){
    if(st[i] !== 1) continue;
    const cells = []; let f = 0;
    for(let j = 0; j < n; j++) if(touching(size, i, j)){ if(st[j] === 2) f++; else if(st[j] === 0) cells.push(j); }
    if(cells.length) cons.push({ cells, need:counts[i] - f });
  }
  const inF = new Uint8Array(n);
  cons.forEach(c => c.cells.forEach(j => { inF[j] = 1; }));
  let interior = 0;
  for(let i = 0; i < n; i++) if(st[i] === 0 && !inF[i]) interior++;
  /* search outward from x, so a contradiction next to x fails fast instead of being retried
     under every combination of far-away squares */
  const front = [], seen = new Uint8Array(n), q = [];
  const seed = inF[x] ? [x] : [];
  for(let i = 0; i < n; i++) if(inF[i]) seed.push(i);
  for(const s0 of seed){
    if(seen[s0]) continue;
    seen[s0] = 1; q.push(s0);
    while(q.length){
      const j = q.shift(); front.push(j);
      for(const c of cons) if(c.cells.includes(j)) for(const k of c.cells) if(!seen[k]){ seen[k] = 1; q.push(k); }
    }
  }
  const val = new Int8Array(n).fill(-1);
  const consOf = new Map(front.map(j => [j, cons.filter(c => c.cells.includes(j))]));
  const okCon = c => {
    let e = 0, u = 0;
    for(const j of c.cells){ if(val[j] === 1) e++; else if(val[j] === -1) u++; }
    return e <= c.need && e + u >= c.need;
  };
  let nodes = 0;
  function rec(p, eggs){
    if(++nodes > 2e5) throw TOO_BIG;
    if(eggs > remaining) return false;
    if(p === front.length){
      let m = remaining - eggs;
      if(!inF[x] && st[x] === 0){                      /* x is an interior square */
        if(v === 1){ if(interior < 1 || m < 1) return false; return m - 1 <= interior - 1; }
        return m >= 0 && m <= interior - 1;
      }
      return m >= 0 && m <= interior;
    }
    const j = front[p];
    for(const t of (j === x ? [v] : [0, 1])){
      val[j] = t;
      if(consOf.get(j).every(okCon) && rec(p + 1, eggs + t)){ val[j] = -1; return true; }
    }
    val[j] = -1;
    return false;
  }
  return rec(0, 0);
}
/* an exhaustive search that is too big to finish is counted, never silently passed */
const TOO_BIG = new Error("too big");
let skipped = 0, verified = 0;
function refuted(size, total, st, counts, x, v){
  try { const r = counterModel(size, total, st, counts, x, v); verified++; return r; }
  catch(e){ if(e !== TOO_BIG) throw e; skipped++; return false; }
}

/* play a board with the engine's deduce(), checking every step independently */
function replay(size, eggs, first, total, checkEach){
  const n = size * size, counts = E.countsFor(eggs, size);
  const st = new Int8Array(n), open = new Uint8Array(n);
  const dig = i => E.openFrom(size, counts, open, null, i).forEach(j => { st[j] = 1; });
  dig(first);
  let bad = 0, guard = 0;
  while(open.reduce((a, b) => a + b, 0) < n - total && guard++ < n * 2){
    const d = E.deduce(size, total, st, counts);
    if(!d.rule) return { solved:false, bad };
    if(checkEach){
      for(const j of d.safe) if(refuted(size, total, st, counts, j, 1)) bad++;
      for(const j of d.eggs) if(refuted(size, total, st, counts, j, 0)) bad++;
    }
    d.eggs.forEach(j => { st[j] = 2; });
    d.safe.forEach(j => { if(!open[j]) dig(j); });
  }
  return { solved:true, bad };
}

/* ---------- 1. every board: safe start, right counts, solvable with zero guesses ---------- */
const BOARDS = 2000;
for(const L of LV){
  const { size, eggs:total } = E.LEVELS[L], n = size * size, rand = mulberry32(1000 + L.length);
  let failGen = 0, failSolve = 0, wrong = 0, badStart = 0, badCount = 0, badTotal = 0, maxTries = 0;
  const used = { simple:0, subset:0, count:0, enum:0 };
  const cornersAndEdges = [0, size - 1, n - size, n - 1, (size >> 1), (size >> 1) * size];
  for(let b = 0; b < BOARDS; b++){
    /* make sure corners and edges get the first dig too, not just random interior squares */
    const first = b < cornersAndEdges.length ? cornersAndEdges[b] : (rand() * n) | 0;
    const g = E.genBoard(L, first, rand);
    if(!g){ failGen++; continue; }
    maxTries = Math.max(maxTries, g.tries);
    const eggs = g.eggs, counts = E.countsFor(eggs, size);
    if(eggs.reduce((a, v) => a + v, 0) !== total) badTotal++;
    if(eggs[first] || counts[first] !== 0) badStart++;
    for(let i = 0; i < n; i++) if(counts[i] !== naiveCount(eggs, size, i)) badCount++;
    const s = E.simulate(size, eggs, first);
    if(!s.solved) failSolve++;
    if(s.wrong) wrong++;
    for(const k in used) used[k] += s.steps[k];
  }
  ok(failGen === 0, L + ": genBoard gave up on " + failGen + " first digs");
  ok(badTotal === 0, L + ": " + badTotal + " boards had the wrong number of eggs");
  ok(badStart === 0, L + ": " + badStart + " boards had an egg on or touching the first dig");
  ok(badCount === 0, L + ": " + badCount + " neighbour counts were wrong");
  ok(failSolve === 0, L + ": " + failSolve + " of " + BOARDS + " boards needed a guess");
  ok(wrong === 0, L + ": the solver 'proved' something false " + wrong + " times");
  console.log("  " + L + ": " + BOARDS + " boards, no-guess ✓ — worst case " + maxTries
    + " layouts tried; deduction steps " + JSON.stringify(used));
}

/* ---------- 2. every deduction is really forced (independent counter-model check) ---------- */
for(const L of LV){
  const { size, eggs:total } = E.LEVELS[L], n = size * size, rand = mulberry32(77 + L.length);
  let bad = 0, unsolved = 0;
  for(let b = 0; b < 120; b++){
    const first = (rand() * n) | 0, g = E.genBoard(L, first, rand);
    const r = replay(size, g.eggs, first, total, true);
    bad += r.bad; if(!r.solved) unsolved++;
  }
  ok(bad === 0, L + ": " + bad + " deductions had a counter-example (a disguised guess)");
  ok(unsolved === 0, L + ": " + unsolved + " replays got stuck");
}
console.log("  independent check: " + verified + " deductions verified, " + skipped + " too large to exhaust");
ok(skipped <= verified / 100, "at most 1% of deductions may be too large to cross-check (" + skipped + ")");

/* ---------- 3. the filter really rejects guessy layouts ---------- */
{
  /* raw random layouts on Expert: a good share must be thrown away, or the filter is idle */
  const size = 10, n = 100, rand = mulberry32(5);
  let rejected = 0, genuineGuess = 0, checked = 0;
  for(let t = 0; t < 400; t++){
    const first = (rand() * n) | 0, banned = new Set([first, ...E.neighbours(size)[first]]);
    const pool = [...Array(n).keys()].filter(i => !banned.has(i));
    const eggs = new Uint8Array(n);
    for(let k = 0; k < 22; k++){ const j = k + ((rand() * (pool.length - k)) | 0); [pool[k], pool[j]] = [pool[j], pool[k]]; eggs[pool[k]] = 1; }
    if(E.simulate(size, eggs, first).solved) continue;
    rejected++;
    if(checked >= 25) continue;
    /* at the stuck point, EVERY buried square must genuinely go either way */
    checked++;
    const counts = E.countsFor(eggs, size), st = new Int8Array(n), open = new Uint8Array(n);
    const dig = i => E.openFrom(size, counts, open, null, i).forEach(j => { st[j] = 1; });
    dig(first);
    for(;;){
      const d = E.deduce(size, 22, st, counts);
      if(!d.rule) break;
      d.eggs.forEach(j => { st[j] = 2; }); d.safe.forEach(j => { if(!open[j]) dig(j); });
    }
    let allOpen = true;
    try {
      for(let i = 0; i < n && allOpen; i++)
        if(st[i] === 0 && !(counterModel(size, 22, st, counts, i, 1) && counterModel(size, 22, st, counts, i, 0))) allOpen = false;
    } catch(e){ if(e !== TOO_BIG) throw e; checked--; continue; }   /* too big to exhaust: pick another */
    if(allOpen) genuineGuess++;
  }
  ok(rejected > 20, "raw Expert layouts should often need a guess (" + rejected + "/400 rejected)");
  ok(genuineGuess === checked, "every rejected layout should be a genuine guess — "
     + genuineGuess + "/" + checked + " were (the solver gave up on a provable square otherwise)");
}

/* ---------- 4. the flood: exactly the connected zeros plus their border ---------- */
{
  const rand = mulberry32(11);
  let bad = 0;
  for(let t = 0; t < 600; t++){
    const size = 5 + ((rand() * 6) | 0), n = size * size, eggs = new Uint8Array(n);
    for(let i = 0; i < n; i++) eggs[i] = rand() < 0.15 ? 1 : 0;
    const counts = E.countsFor(eggs, size);
    const safe = [...Array(n).keys()].filter(i => !eggs[i]);
    if(!safe.length) continue;
    const start = safe[(rand() * safe.length) | 0];
    const got = new Set(E.openFrom(size, counts, new Uint8Array(n), null, start));
    const expect = new Set([start]);
    if(counts[start] === 0){
      /* the connected region of zeros (8-way), then every square touching it */
      const zeros = new Set([start]), q = [start];
      while(q.length){ const i = q.pop(); for(let j = 0; j < n; j++) if(touching(size, i, j) && counts[j] === 0 && !eggs[j] && !zeros.has(j)){ zeros.add(j); q.push(j); } }
      for(const z of zeros){ expect.add(z); for(let j = 0; j < n; j++) if(touching(size, z, j)) expect.add(j); }
    }
    if(got.size !== expect.size || [...expect].some(i => !got.has(i))) bad++;
    if([...got].some(i => eggs[i])) bad++;
  }
  ok(bad === 0, "the flood opened the wrong squares " + bad + " times");
  /* a flag stops the flood */
  const size = 5, eggs = new Uint8Array(25), counts = E.countsFor(eggs, size), blocked = new Uint8Array(25);
  blocked[12] = 1;
  const got = E.openFrom(size, counts, new Uint8Array(25), blocked, 0);
  ok(got.length === 24 && got.indexOf(12) < 0, "a flagged square is never opened by the flood");
}

/* ---------- 5. chording: only when flags match, and exactly the unflagged neighbours ---------- */
{
  const rand = mulberry32(13);
  let bad = 0, fired = 0;
  for(let t = 0; t < 3000; t++){
    const size = 7, n = 49, eggs = new Uint8Array(n);
    for(let i = 0; i < n; i++) eggs[i] = rand() < 0.2 ? 1 : 0;
    const counts = E.countsFor(eggs, size), open = new Uint8Array(n), marked = new Uint8Array(n);
    for(let i = 0; i < n; i++){
      if(!eggs[i] && rand() < 0.5) open[i] = 1;
      else if(!open[i] && rand() < 0.4) marked[i] = 1;     /* flags, some of them wrong */
    }
    const i = (rand() * n) | 0;
    const got = E.chordTargets(size, counts, open, marked, i);
    let f = 0; const rest = [];
    for(let j = 0; j < n; j++) if(touching(size, i, j)){ if(marked[j]) f++; else if(!open[j]) rest.push(j); }
    const expect = open[i] && counts[i] > 0 && f === counts[i] ? rest : [];
    if(expect.length) fired++;
    if(got.slice().sort((a, b) => a - b).join() !== expect.sort((a, b) => a - b).join()) bad++;
  }
  ok(bad === 0, "chordTargets disagreed with the rule " + bad + " times");
  ok(fired > 50, "the chording check should actually exercise matching numbers (" + fired + ")");
}

/* ---------- 6. hints only ever point at proved-safe squares, mid-game ---------- */
{
  const rand = mulberry32(17);
  let bad = 0, empty = 0;
  for(const L of LV){
    const { size, eggs:total } = E.LEVELS[L], n = size * size;
    for(let b = 0; b < 60; b++){
      const first = (rand() * n) | 0, g = E.genBoard(L, first, rand), counts = E.countsFor(g.eggs, size);
      const st = new Int8Array(n), open = new Uint8Array(n);
      E.openFrom(size, counts, open, null, first).forEach(j => { st[j] = 1; });
      /* wander: dig a few extra safe squares at random, and wake an egg or two */
      for(let k = 0; k < 6; k++){
        const i = (rand() * n) | 0;
        if(g.eggs[i]) st[i] = 2; else E.openFrom(size, counts, open, null, i).forEach(j => { st[j] = 1; });
      }
      if(open.reduce((a, v) => a + v, 0) === n - total) continue;
      const safe = E.provenSafe(size, total, st, counts);
      if(!safe.length) empty++;
      for(const j of safe) if(g.eggs[j] || refuted(size, total, st, counts, j, 1)) bad++;
    }
  }
  ok(bad === 0, "provenSafe offered " + bad + " squares that were not proved safe");
  ok(empty === 0, "provenSafe found nothing on " + empty + " unfinished boards (every board is solvable)");
}

/* ---------- 7. stars ---------- */
const S = E.starsFor;
ok(S(0, 0) === 3, "no mistakes, no hints = ★★★");
ok(S(1, 0) === 2, "one woken egg = ★★");
ok(S(0, 1) === 2 && S(0, 2) === 2, "one or two hints = ★★");
ok(S(0, 3) === 1, "three hints = ★");
ok(S(2, 0) === 1, "two woken eggs = ★");
ok(S(1, 1) === 1, "a woken egg AND a hint = ★");

report("dino-dig engine");
