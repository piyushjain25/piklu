"use strict";
/* Shape Math asks a child to do set arithmetic on strokes and then FIND the result among four
   icons. That only works if the icon it calls the answer is drawn from exactly the strokes the
   equation produces — a "close enough" match would show a shape that isn't what the player
   built. The recipe tables are small and finite, so this test does not sample them: it walks
   EVERY (A, op, B) a level can deal and re-derives the answer independently, then checks the
   subtraction rule that keeps the equations readable (B must be a whole layer of A), that no
   option list ever hides or duplicates the answer, and that every named shape draws. */
const { loadEngine, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("shape-math");

const LV = Object.keys(E.LEVELS);
const key = ids => ids.slice().sort().join(",");

/* ---------- 1. the stroke vocabulary ---------- */
for(const name in E.SHAPES){
  const ids = E.SHAPES[name];
  ok(ids.length > 0, name + ": a shape must be made of at least one stroke");
  ok(new Set(ids).size === ids.length, name + ": the same stroke is listed twice");
  ok(ids.every(id => E.STROKES[id] || E.ARCS[id]), name + ": uses a stroke that does not exist");
  ok(!!E.HUMAN_NAME[name], name + ": needs a spoken name for its aria-label");
  /* it must DRAW — an empty or malformed icon is an unanswerable option */
  const svg = E.shapeInner(name);
  ok(svg.length > 0, name + ": shapeInner drew nothing");
  ok((svg.match(/<(line|path)\b/g) || []).length === ids.length, name + ": drew " + (svg.match(/<(line|path)\b/g) || []).length + " marks for " + ids.length + " strokes");
  ok(!/NaN|undefined/.test(svg), name + ": drew NaN/undefined coordinates");
}
for(const id in E.STROKES){
  const s = E.STROKES[id];
  ok(s.length === 4 && s.every(n => Number.isFinite(n) && n >= 0 && n <= 4), id + ": a stroke must be four numbers on the 0–4 grid");
  ok(s[0] !== s[2] || s[1] !== s[3], id + ": a stroke of zero length draws nothing");
}
/* Two names sharing a stroke set would make a puzzle ambiguous: the player builds one set and
   two different icons both claim it. canonicalShapeFor can then only ever return one of them. */
{
  const byKey = new Map();
  for(const name in E.SHAPES){
    const k = key(E.SHAPES[name]);
    ok(!byKey.has(k), name + " and " + byKey.get(k) + " are the same shape under two names");
    byKey.set(k, name);
  }
  for(const name in E.SHAPES)
    ok(E.canonicalShapeFor(E.SHAPES[name]) === name, name + ": does not canonicalise back to itself");
  ok(E.canonicalShapeFor(["top"]) === null, "an unnamed stroke set has no canonical shape");
  ok(E.canonicalShapeFor([]) === null, "the empty stroke set is not a shape");
}
/* the spoken names must be distinct too: two icons both announced "circle" would make a round
   unanswerable for a screen reader, and it is how the page tells the options apart */
ok(new Set(Object.values(E.HUMAN_NAME)).size === Object.keys(E.HUMAN_NAME).length,
   "every shape needs its own spoken name");

/* order must not matter — the engine keys on a sorted set, and puzzles rely on that */
ok(E.canonicalShapeFor(["bottom", "right", "top", "left"]) === "square", "stroke order must not change the shape");

/* ---------- 2. set arithmetic ---------- */
{
  const names = Object.keys(E.SHAPES);
  for(const a of names) for(const b of names){
    const plus = E.computeResult(a, b, "+"), minus = E.computeResult(a, b, "-");
    ok(new Set(plus).size === plus.length, a + "+" + b + ": union has a duplicate stroke");
    ok(key(plus) === key([...new Set([...E.SHAPES[a], ...E.SHAPES[b]])]), a + "+" + b + ": not the union of the two stroke sets");
    ok(key(minus) === key(E.SHAPES[a].filter(id => !E.SHAPES[b].includes(id))), a + "-" + b + ": not the difference of the two stroke sets");
    ok(plus.every(id => E.SHAPES[a].includes(id) || E.SHAPES[b].includes(id)), a + "+" + b + ": invented a stroke");
    ok(minus.every(id => E.SHAPES[a].includes(id)), a + "-" + b + ": kept a stroke that was never in A");
    /* adding is commutative — the same two icons in the other order build the same picture */
    ok(key(plus) === key(E.computeResult(b, a, "+")), a + "+" + b + ": addition is not commutative");
  }
  ok(key(E.computeResult("square", "plus", "+")) === key(E.SHAPES.grid), "square + plus = grid");
  ok(key(E.computeResult("grid", "plus", "-")) === key(E.SHAPES.square), "grid − plus = square");
  ok(key(E.computeResult("half_l", "half_r", "+")) === key(E.SHAPES.circle), "half + half = circle");
}

/* ---------- 3. every recipe a level can deal ---------- */
for(const lv of LV){
  const cfg = E.LEVELS[lv];
  ok(!!cfg.label, lv + ": needs a level label");
  ok(cfg.ops.length > 0 && cfg.ops.every(o => o === "+" || o === "-"), lv + ": operators must be + or −");
  ok(new Set(cfg.pool).size === cfg.pool.length, lv + ": the operand pool has a duplicate");
  ok(cfg.pool.every(n => E.SHAPES[n]), lv + ": an operand in the pool is not a named shape");
  ok(cfg.recipes.length > 0, lv + ": has no puzzles at all");
  /* the table the game deals from must be exactly what buildRecipes says it is */
  ok(cfg.recipes.length === E.buildRecipes(cfg.pool, cfg.ops).length, lv + ": the cached recipe table is stale");

  const sigs = new Set();
  for(const r of cfg.recipes){
    const label = lv + " " + r.a + " " + r.op + " " + r.b;
    ok(cfg.pool.includes(r.a) && cfg.pool.includes(r.b), label + ": an operand is outside the level's pool");
    ok(cfg.ops.includes(r.op), label + ": uses an operator this level does not allow");
    ok(r.a !== r.b, label + ": a shape combined with itself is not a puzzle");
    /* the claim that matters: the answer icon is drawn from EXACTLY the strokes the equation
       produces — re-derived here without going through canonicalShapeFor */
    ok(key(E.SHAPES[r.answer]) === key(E.computeResult(r.a, r.b, r.op)),
       label + " = " + r.answer + ": the answer icon is not what the equation builds");
    /* "nothing happened" equations read as broken, even when the stroke maths is right */
    ok(r.answer !== r.a && r.answer !== r.b, label + ": the answer is just one of the operands");
    /* subtraction only when B is a whole recognisable layer of A — a partial overlap looks
       arbitrary on screen ("plus − fourbars = hbar") even though the sets work out */
    if(r.op === "-") ok(E.isSubsetOf(r.b, r.a), label + ": subtracts a shape that is not wholly inside A");
    ok(E.SHAPES[r.answer].length > 0, label + ": an empty answer cannot be drawn");
    sigs.add(E.sig(r));
  }
  ok(sigs.size === cfg.recipes.length, lv + ": the same equation is listed twice");
  /* a level whose pool allows − must actually produce some, or the card's promise is empty */
  if(cfg.ops.includes("-")) ok(cfg.recipes.some(r => r.op === "-"), lv + ": allows − but never deals one");
  if(cfg.ops.includes("+")) ok(cfg.recipes.some(r => r.op === "+"), lv + ": allows + but never deals one");
}
/* the ladder: Easy adds only, everything above it also takes away */
ok(E.LEVELS.EASY.ops.join("") === "+", "Easy should only ever add");
for(const lv of ["MEDIUM", "HARD", "EXPERT"]) ok(E.LEVELS[lv].ops.includes("-"), lv + " should also subtract");
ok(E.LEVELS.EXPERT.pool.length > E.LEVELS.EASY.pool.length, "Expert should draw on a wider pool than Easy");
ok(LV.map(l => E.LEVELS[l].label).join(" ") === "🌱 Easy ⭐ Medium 🔥 Hard 🏆 Expert",
   "level labels are the site's four, emoji and name on one line");

/* ---------- 4. the four options ---------- */
for(const lv of LV){
  for(const r of E.LEVELS[lv].recipes){
    /* generateOptions shuffles within distance tiers, so run each recipe a few times */
    for(let t = 0; t < stress(20); t++){
      const opts = E.generateOptions(r.a, r.b, r.answer);
      const label = lv + " " + r.a + r.op + r.b + " → " + opts.join("/");
      ok(opts.length === 4, label + ": should offer exactly 4 options, got " + opts.length);
      ok(new Set(opts).size === opts.length, label + ": an option is repeated");
      ok(opts.includes(r.answer), label + ": the answer is not on the list");
      ok(opts.every(n => E.SHAPES[n]), label + ": an option is not a named shape");
      /* the decoys must be real alternatives, not the answer under another name */
      ok(opts.filter(n => key(E.SHAPES[n]) === key(E.SHAPES[r.answer])).length === 1,
         label + ": a decoy is the same picture as the answer");
    }
  }
}
/* the operands are offered back as decoys — that is the trap the game is built on, and it
   stops the answer from being the only familiar icon on the row */
{
  const r = E.LEVELS.MEDIUM.recipes.find(x => x.a !== x.answer && x.b !== x.answer);
  const opts = E.generateOptions(r.a, r.b, r.answer);
  ok(opts.includes(r.a) && opts.includes(r.b), "the two operands should be offered back as decoys");
}

/* ---------- 5. the dealer ---------- */
for(const lv of LV){
  const cfg = E.LEVELS[lv];
  const seen = new Map();
  let repeated = 0, offTable = 0;
  const N = stress(20000);
  let prev = null;
  for(let i = 0; i < N; i++){
    const r = E.genPuzzle(lv, prev);
    if(!cfg.recipes.includes(r)) offTable++;
    if(prev !== null && E.sig(r) === prev && cfg.recipes.length > 1) repeated++;
    seen.set(E.sig(r), (seen.get(E.sig(r)) || 0) + 1);
    prev = E.sig(r);
  }
  ok(offTable === 0, lv + ": " + offTable + " puzzles came from outside the level's recipe table");
  ok(repeated === 0, lv + ": " + repeated + " rounds repeated the equation just played");
  /* every recipe must be reachable — a puzzle the dealer can never pick is dead code */
  ok(seen.size === cfg.recipes.length, lv + ": only " + seen.size + " of " + cfg.recipes.length + " equations ever came up");
}
/* genPuzzle must still return something when there is nothing else to deal */
ok(!!E.genPuzzle("EASY", E.sig(E.LEVELS.EASY.recipes[0])), "the dealer always returns a puzzle, even when it must repeat");

/* ---------- 6. distractors are ranked by how close they look ---------- */
{
  ok(E.distance("square", "square") === 0, "a shape is zero distance from itself");
  ok(E.distance("grid", "square") < E.distance("heart", "square"),
     "a grid should read as closer to a square than a heart does");
  for(const a in E.SHAPES) for(const b in E.SHAPES)
    ok(E.distance(a, b) === E.distance(b, a), a + "/" + b + ": distance must be symmetric");
}

report("shape-math engine");
