"use strict";
/* Pizza Party asks for a fraction — "serve ½" — and the child taps slices on a pizza cut into
   some number of pieces. The whole lesson is in the two numbers agreeing: at Hard and Expert
   the pizza is cut into MORE slices than the fraction's denominator, so ½ of 8 slices is 4, and
   the order and the answer are computed separately. If they ever disagree the child does the
   equivalent-fraction reasoning correctly and is marked wrong. This test re-derives the answer
   from the fraction for every order the game can deal, and checks the fractions themselves are
   in lowest terms — ²⁄₄ printed as an order would be teaching the wrong thing. */
const { loadEngine, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("pizza-party");

const LV = Object.keys(E.LEVELS);
const gcd = (a, b) => b ? gcd(b, a % b) : a;

/* ---------- 1. the levels ---------- */
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order: " + LV.join(","));
ok(LV.map(l => E.LEVELS[l].label).join(" ") === "🌱 Easy ⭐ Medium 🔥 Hard 🏆 Expert",
   "level labels are the site's four, emoji and name on one line");
for(const lv of LV){
  const cfg = E.LEVELS[lv];
  ok(cfg.dens.length > 0, lv + ": needs some denominators to ask about");
  ok(cfg.dens.every(d => d >= 2), lv + ": a denominator below 2 is not a fraction");
  ok(new Set(cfg.dens).size === cfg.dens.length, lv + ": a denominator is listed twice");
  ok(cfg.maxSlices >= Math.max(...cfg.dens), lv + ": the pizza cannot be cut into fewer slices than the denominator");
  /* an equivalent-fraction level needs room to multiply up: 2x the biggest denominator */
  if(cfg.equiv) ok(cfg.maxSlices >= 2 * Math.min(...cfg.dens),
    lv + ": asks for equivalents but " + cfg.maxSlices + " slices leaves no room to multiply up");
}
/* the ladder: Easy and Medium are the plain fractions, Hard and Expert the equivalents */
ok(!E.LEVELS.EASY.equiv && !E.LEVELS.MEDIUM.equiv, "Easy and Medium should serve the fraction as written");
ok(E.LEVELS.HARD.equiv && E.LEVELS.EXPERT.equiv, "Hard and Expert should be the equivalent-fraction levels");
ok(E.LEVELS.EXPERT.maxSlices > E.LEVELS.EASY.maxSlices, "Expert should cut the pizza into more slices than Easy");

/* ---------- 2. the fraction helpers ---------- */
for(const [a, b, want] of [[12, 8, 4], [7, 13, 1], [9, 3, 3], [5, 0, 5], [0, 5, 5]])
  ok(E.gcd(a, b) === want, "gcd(" + a + "," + b + ") should be " + want + ", got " + E.gcd(a, b));
for(const q of [2, 3, 4, 5, 6, 8, 10, 12]){
  const nums = E.reducedNumerators(q);
  ok(nums.length > 0, q + ": should have at least one numerator in lowest terms");
  ok(nums.every(p => p >= 1 && p < q), q + ": a numerator must be a proper fraction, got " + nums.join(","));
  ok(nums.every(p => gcd(p, q) === 1), q + ": " + nums.filter(p => gcd(p, q) !== 1).join(",") + " are not in lowest terms");
  /* and it must not MISS any — that would narrow the game silently */
  const want = [];
  for(let p = 1; p < q; p++) if(gcd(p, q) === 1) want.push(p);
  ok(nums.join(",") === want.join(","), q + ": expected " + want.join(",") + ", got " + nums.join(","));
}

/* ---------- 3. every order, at every level ---------- */
for(const lv of LV){
  const cfg = E.LEVELS[lv];
  const T = stress(20000);
  let nulls = 0, notReduced = 0, wrongTarget = 0, tooManySlices = 0, offDens = 0,
      wholePizza = 0, notProper = 0, badMultiple = 0, noStretch = 0, first = null;
  const seen = new Set();

  for(let i = 0; i < T; i++){
    const o = E.genOrder(lv);
    if(!o){ nulls++; continue; }
    seen.add(o.num + "/" + o.den + " of " + o.slices);

    if(!cfg.dens.includes(o.den)) offDens++;
    /* the fraction a child reads must be in lowest terms */
    if(gcd(o.num, o.den) !== 1){
      notReduced++;
      if(!first) first = "order reads " + o.num + "/" + o.den + ", which is not in lowest terms";
    }
    if(!(o.num >= 1 && o.num < o.den)) notProper++;

    /* THE claim: the slices to serve really are that fraction of the pizza */
    if(o.target * o.den !== o.num * o.slices){
      wrongTarget++;
      if(!first) first = o.num + "/" + o.den + " of " + o.slices + " slices should be "
        + (o.num * o.slices / o.den) + ", the order says " + o.target;
    }
    if(o.slices !== o.m * o.den) badMultiple++;
    if(o.slices > cfg.maxSlices) tooManySlices++;
    /* never the whole pizza and never nothing — neither is a fraction lesson */
    if(!(o.target >= 1 && o.target < o.slices)) wholePizza++;
    /* at an equivalent level the pizza must actually be cut finer than the denominator, or the
       level is identical to Easy */
    if(cfg.equiv && o.m < 2) noStretch++;
    if(!cfg.equiv && o.m !== 1) noStretch++;
  }

  ok(nulls === 0, lv + ": genOrder gave up " + nulls + " times");
  ok(offDens === 0, lv + ": " + offDens + " orders used a denominator this level does not list");
  ok(notReduced === 0, lv + ": " + notReduced + " orders were not in lowest terms" + (first ? " (" + first + ")" : ""));
  ok(notProper === 0, lv + ": " + notProper + " orders were not a proper fraction");
  ok(wrongTarget === 0, lv + ": " + wrongTarget + " orders asked for the wrong number of slices"
     + (first ? "\n      first: " + first : ""));
  ok(badMultiple === 0, lv + ": " + badMultiple + " pizzas were not cut into a multiple of the denominator");
  ok(tooManySlices === 0, lv + ": " + tooManySlices + " pizzas were cut into more than " + cfg.maxSlices + " slices");
  ok(wholePizza === 0, lv + ": " + wholePizza + " orders were the whole pizza or none of it");
  ok(noStretch === 0, lv + ": " + noStretch + " orders used the wrong multiplier for an equiv=" + cfg.equiv + " level");
  /* Enumerate every order this level COULD deal and require that all of them turn up. Easy has
     exactly three (½, ¼, ¾) — a threshold plucked out of the air would either miss a shrinking
     level or fail on a legitimately small one, so the count comes from the level's own table. */
  const possible = new Set();
  for(const q of cfg.dens){
    const ms = [];
    if(cfg.equiv){ const mMax = Math.floor(cfg.maxSlices / q); for(let m = 2; m <= mMax; m++) ms.push(m); }
    else if(q <= cfg.maxSlices) ms.push(1);
    for(const m of ms) for(const p of E.reducedNumerators(q)) possible.add(p + "/" + q + " of " + (m * q));
  }
  ok(possible.size > 0, lv + ": the level's own table allows no orders at all");
  ok(seen.size === possible.size, lv + ": " + seen.size + " of " + possible.size + " possible orders ever came up"
     + (seen.size < possible.size ? " (missing " + [...possible].filter(x => !seen.has(x)).slice(0, 4).join("; ") + ")" : ""));
  for(const o of seen) ok(possible.has(o), lv + ": dealt " + o + ", which its own table does not allow");
}

report("pizza-party engine");
