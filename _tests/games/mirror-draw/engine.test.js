"use strict";
/* Mirror Draw's engine: the reflection maps are genuine reflections, the answer set is
   exactly the mirror image of the given half, and every generated picture is a single
   connected shape that sits wholly on the given side, hits its square count, and cannot be
   solved by COPYING instead of reflecting (the "already symmetric" rejection). */
const { loadEngine, mulberry32, tally } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("mirror-draw");

const LV = Object.keys(E.LEVELS);
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order");
ok(E.LEVELS.EASY.size === 6 && E.LEVELS.EASY.axes.join() === "V", "Easy: 6x6, vertical mirror");
ok(E.LEVELS.MEDIUM.size === 8 && E.LEVELS.MEDIUM.axes.sort().join() === "H,V", "Medium: 8x8, vertical or horizontal");
ok(E.LEVELS.HARD.size === 8 && E.LEVELS.HARD.axes.join() === "D", "Hard: 8x8, diagonal");
ok(E.LEVELS.EXPERT.size === 8 && E.LEVELS.EXPERT.axes.join() === "B", "Expert: 8x8, both axes");
for(const l of LV) ok(E.LEVELS[l].size % 2 === 0, l + ": even grid, so V/H mirrors fall between squares");

/* ---- 1. the mappings: involutions, and the right geometry ---- */
for(const size of [6, 8]){
  const n = size * size;
  for(const ax of ["V", "H", "D"]){
    let bad = 0;
    for(let i = 0; i < n; i++) if(E.reflect(ax, size, E.reflect(ax, size, i)) !== i) bad++;
    ok(bad === 0, size + "x" + size + " " + ax + ": reflecting twice must give the square back");
  }
  for(let i = 0; i < n; i++){
    const r = (i / size) | 0, c = i % size;
    if(E.reflect("V", size, i) !== r * size + (size - 1 - c)) ok(false, "V maps (r,c) to (r,N-1-c)");
    if(E.reflect("H", size, i) !== (size - 1 - r) * size + c) ok(false, "H maps (r,c) to (N-1-r,c)");
    if(E.reflect("D", size, i) !== c * size + r) ok(false, "D maps (r,c) to (c,r)");
    /* B's three images, and the image set is closed: any image's images are the same group */
    const im = E.images("B", size, i);
    const expect = [r * size + (size - 1 - c), (size - 1 - r) * size + c, (size - 1 - r) * size + (size - 1 - c)];
    if(im.join() !== expect.join()) ok(false, "B images of " + i);
    const orbit = new Set([i, ...im]);
    for(const j of im) if(![j, ...E.images("B", size, j)].every(k => orbit.has(k))) ok(false, "B orbit closed at " + i);
  }
  /* diagonal squares are their own reflection, on the given side, and never fillable */
  for(let k = 0; k < size; k++){
    const i = k * size + k;
    ok(E.reflect("D", size, i) === i, "diagonal square maps to itself");
    ok(E.inGiven("D", 0, size, i), "diagonal square belongs to the given side");
  }
  /* given + fillable partition the grid, and the mirror swaps them (V/H/D) */
  for(const [ax, side] of [["V",0],["V",1],["H",0],["H",1],["D",0]]){
    let bad = 0;
    for(let i = 0; i < n; i++){
      const j = E.reflect(ax, size, i);
      if(E.inGiven(ax, side, size, i) && j !== i && E.inGiven(ax, side, size, j)) bad++;
      if(!E.inGiven(ax, side, size, i) && !E.inGiven(ax, side, size, j)) bad++;
    }
    ok(bad === 0, size + " " + ax + side + ": the mirror must swap the given and fillable sides");
  }
  /* B: the quarter's three images cover the other three quarters exactly once */
  const cover = new Map();
  for(let i = 0; i < n; i++) if(E.inGiven("B", 0, size, i)) for(const j of E.images("B", size, i)) cover.set(j, (cover.get(j) || 0) + 1);
  ok(cover.size === n * 3 / 4 && [...cover.values()].every(v => v === 1), size + " B: the other three quarters, each square once");
}

/* ---- 2. answerOf is exactly the mirror image ---- */
{
  const rand = mulberry32(3);
  let bad = 0;
  for(let t = 0; t < 2000; t++){
    const size = rand() < .5 ? 6 : 8, n = size * size, ax = ["V","H","D","B"][(rand() * 4) | 0], side = ax === "V" || ax === "H" ? (rand() * 2) | 0 : 0;
    const given = [...Array(n).keys()].filter(i => E.inGiven(ax, side, size, i));
    const pat = given.filter(() => rand() < .3);
    const ans = E.answerOf(ax, side, size, pat);
    /* the reference: brute force over every square */
    const expect = [];
    for(let j = 0; j < n; j++){
      if(E.inGiven(ax, side, size, j)) continue;
      const r = (j / size) | 0, c = j % size;
      const pre = ax === "V" ? [r * size + size - 1 - c] : ax === "H" ? [(size - 1 - r) * size + c]
        : ax === "D" ? [c * size + r] : [r * size + size - 1 - c, (size - 1 - r) * size + c, (size - 1 - r) * size + size - 1 - c];
      if(pre.some(k => pat.includes(k))) expect.push(j);
    }
    if(ans.join() !== expect.join()) bad++;
    if(ans.some(j => E.inGiven(ax, side, size, j))) bad++;
    if(ax === "D" && ans.some(j => ((j / size) | 0) === j % size)) bad++;
  }
  ok(bad === 0, "answerOf disagreed with brute force " + bad + " times");
}

/* ---- 3. generation: 5,000 per level ---- */
for(const L of LV){
  const cfg = E.LEVELS[L], rand = mulberry32(100 + L.length);
  let nul = 0, disc = 0, outside = 0, count = 0, sym = 0, diagFill = 0, repeat = 0;
  const axesSeen = new Set(), sidesSeen = new Set();
  let prev = null;
  for(let t = 0; t < 5000; t++){
    const p = E.genPuzzle(L, rand, prev ? E.sigOf(prev) : null);
    if(!p){ nul++; continue; }
    axesSeen.add(p.axis); sidesSeen.add(p.side);
    if(!E.isConnected(p.size, p.pattern)) disc++;
    if(p.pattern.some(i => !E.inGiven(p.axis, p.side, p.size, i))) outside++;
    if(p.answer.length < cfg.place[0] || p.answer.length > cfg.place[1]) count++;
    if(E.selfSymmetric(p.axis, p.side, p.size, p.pattern)) sym++;
    if(p.axis === "D" && p.answer.some(j => ((j / p.size) | 0) === j % p.size)) diagFill++;
    if(prev && E.sigOf(prev) === E.sigOf(p)) repeat++;
    if(p.answer.join() !== E.answerOf(p.axis, p.side, p.size, p.pattern).join()) count++;
    prev = p;
  }
  ok(nul === 0, L + ": generation gave up " + nul + " times");
  ok(disc === 0, L + ": " + disc + " patterns were not one connected shape");
  ok(outside === 0, L + ": " + outside + " patterns spilled off the given side");
  ok(count === 0, L + ": " + count + " patterns missed the " + cfg.place.join("–") + " squares-to-place range");
  ok(sym === 0, L + ": " + sym + " patterns could be copied instead of reflected");
  ok(diagFill === 0, L + ": diagonal squares must never be fillable");
  ok(repeat === 0, L + ": Skip/Next repeated the current picture " + repeat + " times");
  ok(axesSeen.size === cfg.axes.length, L + ": every mirror type should turn up (" + [...axesSeen] + ")");
  if(L === "MEDIUM") ok(sidesSeen.size === 2, "Medium: the given half should vary");
}
/* the rejection really fires: a hand-made copyable shape is flagged */
ok(E.selfSymmetric("V", 0, 6, [0, 2]), "a shape symmetric within its own half is rejected");
ok(!E.selfSymmetric("V", 0, 6, [0, 1]), "a lopsided shape is kept");
ok(E.selfSymmetric("B", 0, 8, [0, 3]) && E.selfSymmetric("B", 0, 8, [0, 24]), "Expert rejects either quarter-axis symmetry");

/* ---- 4. the mismatch count: missing + extra, never positions ---- */
{
  const rand = mulberry32(9);
  let bad = 0;
  for(let t = 0; t < 3000; t++){
    const ans = [...Array(32).keys()].filter(() => rand() < .3), fil = [...Array(32).keys()].filter(() => rand() < .3);
    const m = E.mismatch(ans, fil);
    const miss = ans.filter(i => !fil.includes(i)).length, extra = fil.filter(i => !ans.includes(i)).length;
    if(m.missing !== miss || m.extra !== extra || m.total !== miss + extra) bad++;
    if(Object.values(m).some(v => typeof v !== "number")) bad++;
  }
  ok(bad === 0, "mismatch() miscounted " + bad + " times");
  ok(Object.keys(E.mismatch([1], [2])).sort().join() === "extra,missing,total", "mismatch() reports counts only");
}

/* ---- 5. stars ---- */
ok(E.starsFor(0, 0) === 3 && E.starsFor(1, 0) === 2 && E.starsFor(0, 2) === 2 && E.starsFor(0, 3) === 1
   && E.starsFor(2, 0) === 1 && E.starsFor(1, 1) === 1, "star rule");

report("mirror-draw engine");
