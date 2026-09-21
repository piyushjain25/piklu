"use strict";
/* Number Detective gives a child a handful of clues and a row of numbers, and asks which number
   fits them ALL. That only works if exactly one of the numbers offered does. If two fit, a
   child reasons correctly and is marked wrong; if the target itself fails one of its own clues,
   the puzzle cannot be solved at all. Both are properties of a generator that assembles clues
   at random, so both are checked here by brute force: every clue is re-tested against every
   option. The clues do not have to pin a number down on their own — a child chooses from the
   row, not from 1–99 — but they do have to narrow it hard and always include the answer, which
   is checked against the level's whole range. */
const { loadEngine, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("number-detective");

const LV = Object.keys(E.LEVELS);
const digitSum = n => String(n).split("").reduce((a, d) => a + +d, 0);

/* ---------- 1. the levels ---------- */
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order: " + LV.join(","));
ok(LV.map(l => E.LEVELS[l].label).join(" ") === "🌱 Easy ⭐ Medium 🔥 Hard 🏆 Expert",
   "level labels are the site's four, emoji and name on one line");
for(const lv of LV){
  const cfg = E.LEVELS[lv];
  ok(cfg.lo >= 1 && cfg.hi > cfg.lo, lv + ": the number range must be a real range");
  ok(cfg.clues >= 3, lv + ": fewer than three clues is not a case to crack");
  ok(cfg.opts >= 3, lv + ": needs a few numbers to choose between");
  ok(cfg.opts <= cfg.hi - cfg.lo + 1, lv + ": cannot offer more numbers than the range holds");
  ok(cfg.multiples.every(m => m >= 2), lv + ": a times table must be 2 or more");
}
for(let i = 1; i < LV.length; i++){
  const a = E.LEVELS[LV[i-1]], b = E.LEVELS[LV[i]];
  ok(b.hi >= a.hi, LV[i] + " should not use smaller numbers than " + LV[i-1]);
  ok(b.opts >= a.opts, LV[i] + " should offer at least as many numbers as " + LV[i-1]);
}
ok(E.LEVELS.EXPERT.opts > E.LEVELS.EASY.opts, "Expert should be a wider line-up than Easy");

/* ---------- 2. each kind of clue says what it tests ----------
   The text a child reads and the test the game scores with are written side by side in the
   same object, which is exactly where they can quietly disagree. */
const CLUE_CHECKS = [
  [E.clueGreater(7), "greater than 7", n => n > 7],
  [E.clueLess(30), "less than 30", n => n < 30],
  [E.clueEven(), "even", n => n % 2 === 0],
  [E.clueOdd(), "odd", n => n % 2 === 1],
  [E.clueDigitSum(9), "digits add to 9", n => digitSum(n) === 9],
  [E.clueMultiple(3), "in the 3 times table", n => n % 3 === 0],
  [E.clueOnesDigit(4), "ones digit 4", n => n % 10 === 4],
  [E.clueTensGtOnes(), "tens > ones", n => Math.floor(n / 10) % 10 > n % 10],
  [E.clueOnesGtTens(), "ones > tens", n => n % 10 > Math.floor(n / 10) % 10],
  [E.clueRoundTen(40), "rounds to 40", n => Math.round(n / 10) * 10 === 40],
];
for(const [clue, what, want] of CLUE_CHECKS){
  ok(!!clue.key && !!clue.text, what + ": a clue needs a key and something to read");
  let bad = 0;
  for(let n = 1; n <= 99; n++) if(clue.test(n) !== want(n)) bad++;
  ok(bad === 0, what + ": the clue's test disagrees with what it says for " + bad + " numbers ('" + clue.text + "')");
}
/* the numbers in the sentence must be the numbers being tested */
ok(E.clueGreater(7).text.includes("7") && E.clueLess(30).text.includes("30"), "a bound must name its own number");
ok(E.clueDigitSum(9).text.includes("9"), "the digit-sum clue must name its sum");
ok(E.clueMultiple(3).text.includes("3"), "the times-table clue must name its table");
ok(E.clueOnesDigit(4).text.includes("4"), "the ones-digit clue must name its digit");
ok(E.clueRoundTen(40).text.includes("40"), "the rounding clue must name what it rounds to");
/* every clue kind needs its own key, or the distractor-spreading logic conflates two of them */
ok(new Set(CLUE_CHECKS.map(([c]) => c.key)).size === CLUE_CHECKS.length, "two clue kinds share a key");

/* the two bound helpers must always leave the target inside the range they draw */
for(const wide of [false, true]) for(let T = 2; T <= 99; T++){
  for(let i = 0; i < stress(20); i++){
    const below = E.boundBelow(T, wide);
    ok(below >= 1 && below < T, "boundBelow(" + T + "," + wide + ") = " + below + " is not below the target");
    const above = E.boundAbove(T, 99, wide);
    ok(above > T && above <= 100, "boundAbove(" + T + "," + wide + ") = " + above + " is not above the target");
  }
}

/* ---------- 3. every case, at every level ---------- */
for(const lv of LV){
  const cfg = E.LEVELS[lv];
  const T = stress(5000);
  let nulls = 0, targetFails = 0, wrongOptCount = 0, dupOptions = 0, targetMissing = 0,
      ambiguous = 0, offRange = 0, tooFewClues = 0, notUnique = 0, first = null, widest = 0;
  const seen = new Set();

  for(let t = 0; t < T; t++){
    const p = E.buildPuzzle(lv);
    if(!p){ nulls++; continue; }
    seen.add(p.target);

    /* THE first claim: the target must satisfy every clue it was given */
    const failed = p.clues.filter(c => !c.test(p.target));
    if(failed.length){
      targetFails++;
      if(!first) first = "target " + p.target + " fails its own clue: " + failed[0].text;
    }
    if(p.clues.length < 3) tooFewClues++;
    if(p.clues.length > cfg.clues) tooFewClues++;

    if(p.options.length !== cfg.opts) wrongOptCount++;
    if(new Set(p.options).size !== p.options.length) dupOptions++;
    if(!p.options.includes(p.target)) targetMissing++;
    if(p.options.some(n => n < cfg.lo || n > cfg.hi)) offRange++;

    /* THE second claim: of the numbers OFFERED, exactly one fits every clue */
    const fits = p.options.filter(n => p.clues.every(c => c.test(n)));
    if(fits.length !== 1 || fits[0] !== p.target){
      ambiguous++;
      if(!first) first = "options " + p.options.join(",") + " — " + fits.length + " fit the clues ["
        + p.clues.map(c => c.text).join(" ") + "], target " + p.target;
    }
    /* The clues alone do NOT have to pin one number down — the game asks a child to pick from
       the numbers it shows, and uniqueness THERE is the promise (checked just above). What the
       clues must do is genuinely narrow the field and always include the answer: a clue set
       that fits half the range would make the options carry the whole puzzle. The cap is well
       above what the generator produces (worst observed: 9 of a 90-number range), so it catches
       a clue-selection regression without being brittle. */
    const all = [];
    for(let n = cfg.lo; n <= cfg.hi; n++) if(p.clues.every(c => c.test(n))) all.push(n);
    if(!all.includes(p.target) || all.length >= Math.min(12, cfg.hi - cfg.lo + 1)){
      notUnique++;
      if(!first) first = "clues [" + p.clues.map(c => c.text).join(" ") + "] fit " + all.length
        + " numbers in " + cfg.lo + "–" + cfg.hi + " (" + all.slice(0, 8).join(",") + "), target " + p.target;
    }
    widest = Math.max(widest, all.length);
  }

  ok(nulls === 0, lv + ": buildPuzzle gave up " + nulls + " times");
  ok(targetFails === 0, lv + ": " + targetFails + " cases where the answer fails its own clues"
     + (first ? " (" + first + ")" : ""));
  ok(tooFewClues === 0, lv + ": " + tooFewClues + " cases had the wrong number of clues");
  ok(wrongOptCount === 0, lv + ": " + wrongOptCount + " cases did not offer " + cfg.opts + " numbers");
  ok(dupOptions === 0, lv + ": " + dupOptions + " cases offered the same number twice");
  ok(targetMissing === 0, lv + ": " + targetMissing + " cases did not offer their own answer");
  ok(offRange === 0, lv + ": " + offRange + " cases offered a number outside " + cfg.lo + "–" + cfg.hi);
  ok(ambiguous === 0, lv + ": " + ambiguous + " cases where more than one OFFERED number fits the clues"
     + (first ? "\n      first: " + first : ""));
  ok(seen.size > 10, lv + ": only " + seen.size + " different answers ever came up");
  ok(notUnique === 0, lv + ": " + notUnique + " of " + T + " cases had clues that barely narrowed "
     + cfg.lo + "–" + cfg.hi + ", or left the answer out" + (first ? "\n      first: " + first : ""));
  ok(widest > 1, lv + ": every clue set pinned exactly one number — then the options are decoration");
}

report("number-detective engine");
