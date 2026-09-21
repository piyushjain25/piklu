"use strict";
/* Times Table Pop floats a row of balloons and asks a child to pop the one carrying the answer.
   The distractors are built by nudging the product around (±a, ±b, ±1, a×(b+1) and so on), and
   several of those nudges can collide — a×(b+1) equals product+a, and product-1 equals
   product-b when b is 1. If a collision ever survives into the round, two balloons carry the
   same number or a second balloon carries the right answer, and a child who pops correctly is
   told they are wrong. This test builds tens of thousands of rounds per level and checks that
   exactly one balloon is right, no two share a value, and none shows a number a child would
   not accept as a product. */
const { loadEngine, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("times-table-pop");

const LV = Object.keys(E.LEVELS);

/* ---------- 1. the levels ---------- */
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order: " + LV.join(","));
ok(LV.map(l => E.LEVELS[l].label).join(" ") === "🌱 Easy ⭐ Medium 🔥 Hard 🏆 Expert",
   "level labels are the site's four, emoji and name on one line");
for(const lv of LV){
  const cfg = E.LEVELS[lv];
  ok(cfg.tables.length > 0, lv + ": needs some times tables");
  ok(cfg.tables.every(t => t >= 2), lv + ": the 1 times table is not worth a round");
  ok(new Set(cfg.tables).size === cfg.tables.length, lv + ": a table is listed twice");
  ok(cfg.bubbles >= 3, lv + ": " + cfg.bubbles + " balloons is not much of a choice");
  ok(cfg.bMax >= 3, lv + ": the multiplier range must leave room, got up to " + cfg.bMax);
  /* the distractors must be drawable: bubbles-1 distinct values below the product's neighbourhood */
  ok(cfg.bubbles - 1 < 2 * cfg.bMax, lv + ": " + cfg.bubbles + " balloons may be hard to fill from this range");
}
for(let i = 1; i < LV.length; i++){
  const a = E.LEVELS[LV[i-1]], b = E.LEVELS[LV[i]];
  ok(b.tables.length >= a.tables.length, LV[i] + " should cover at least as many tables as " + LV[i-1]);
  ok(b.bubbles >= a.bubbles, LV[i] + " should float at least as many balloons as " + LV[i-1]);
  ok(b.bMax >= a.bMax, LV[i] + " should go at least as high as " + LV[i-1]);
}
ok(E.LEVELS.EASY.tables.join() === "2,5,10", "Easy should be the 2, 5 and 10 tables, got " + E.LEVELS.EASY.tables.join());
ok(E.LEVELS.EXPERT.tables.includes(12), "Expert should reach the 12 times table");

/* ---------- 2. every round, at every level ---------- */
for(const lv of LV){
  const cfg = E.LEVELS[lv];
  const T = stress(20000);
  let wrongCount = 0, notOneRight = 0, dupValues = 0, badProduct = 0, offTable = 0,
      badB = 0, nonPositive = 0, badIds = 0, answerRepeated = 0, first = null;
  const tablesSeen = new Set(), sumsSeen = new Set();

  for(let i = 0; i < T; i++){
    const r = E.genRound(lv);
    tablesSeen.add(r.a);
    sumsSeen.add(r.a + "x" + r.b);

    if(!cfg.tables.includes(r.a)) offTable++;
    if(r.b < 2 || r.b > cfg.bMax) badB++;
    if(r.a * r.b !== r.product){
      badProduct++;
      if(!first) first = r.a + " x " + r.b + " should be " + (r.a * r.b) + ", the round says " + r.product;
    }

    if(r.bubbles.length !== cfg.bubbles) wrongCount++;
    const right = r.bubbles.filter(b => b.correct);
    if(right.length !== 1 || right[0].value !== r.product){
      notOneRight++;
      if(!first) first = r.a + "x" + r.b + "=" + r.product + " → " + right.length + " balloons marked correct";
    }
    /* THE claim: no two balloons show the same number, and only one shows the answer */
    const values = r.bubbles.map(b => b.value);
    if(new Set(values).size !== values.length){
      dupValues++;
      if(!first) first = r.a + "x" + r.b + "=" + r.product + " → balloons " + values.join(",") + " repeat a value";
    }
    if(values.filter(v => v === r.product).length !== 1){
      answerRepeated++;
      if(!first) first = r.a + "x" + r.b + "=" + r.product + " → the answer appears "
        + values.filter(v => v === r.product).length + " times in " + values.join(",");
    }
    /* a balloon showing 0 or a negative number is not a product a child would consider */
    if(values.some(v => v <= 0 || !Number.isInteger(v))) nonPositive++;
    r.bubbles.forEach((b, idx) => { if(b.id !== idx) badIds++; });
  }

  ok(offTable === 0, lv + ": " + offTable + " rounds used a table this level does not list");
  ok(badB === 0, lv + ": " + badB + " rounds used a multiplier outside 2–" + cfg.bMax);
  ok(badProduct === 0, lv + ": " + badProduct + " rounds got their own multiplication wrong"
     + (first ? " (" + first + ")" : ""));
  ok(wrongCount === 0, lv + ": " + wrongCount + " rounds did not float " + cfg.bubbles + " balloons");
  ok(notOneRight === 0, lv + ": " + notOneRight + " rounds did not mark exactly one balloon correct"
     + (first ? "\n      first: " + first : ""));
  ok(dupValues === 0, lv + ": " + dupValues + " rounds floated two balloons with the same number"
     + (first ? "\n      first: " + first : ""));
  ok(answerRepeated === 0, lv + ": " + answerRepeated + " rounds showed the answer on more than one balloon"
     + (first ? "\n      first: " + first : ""));
  ok(nonPositive === 0, lv + ": " + nonPositive + " balloons showed zero, a negative or a non-integer");
  ok(badIds === 0, lv + ": " + badIds + " balloons were not numbered in row order");
  /* every table the level lists must actually come up */
  for(const t of cfg.tables) ok(tablesSeen.has(t), lv + ": the " + t + " times table was never asked");
  ok(sumsSeen.size > cfg.tables.length, lv + ": only " + sumsSeen.size + " different sums ever came up");
}

/* ---------- 3. shuffle ---------- */
{
  /* shuffle here mutates in place and returns the same array — genRound relies on that */
  const src = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = E.shuffle(src);
  ok(out === src, "shuffle should return the array it was given");
  ok(out.slice().sort((a, b) => a - b).join() === "1,2,3,4,5,6,7,8", "shuffle lost or invented an item");
  let moved = 0;
  for(let i = 0; i < stress(400); i++){
    const a = [1, 2, 3, 4, 5, 6, 7, 8];
    if(E.shuffle(a).join() !== "1,2,3,4,5,6,7,8") moved++;
  }
  ok(moved > 0, "shuffle never changed the order");
}

report("times-table-pop engine");
