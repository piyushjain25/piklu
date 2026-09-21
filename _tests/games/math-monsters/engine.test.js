"use strict";
/* Math Monsters is a multiple-choice game, so two things have to hold on every single round or
   it is unplayable: the sum on screen must really equal the answer it scores against, and
   exactly one of the four options must be that answer. Both are properties of a random
   generator, so both are checked across tens of thousands of rounds — along with the things a
   child would notice immediately if they broke: a subtraction that goes negative, a division
   that doesn't come out, a repeated option, and the right answer favouring a spot on the row. */
const { loadEngine, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("math-monsters");

const LV = Object.keys(E.LEVELS);

/* ---------- 1. the level ladder ---------- */
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order: " + LV.join(","));
ok(LV.map(l => E.LEVELS[l].label).join(" ") === "🌱 Easy ⭐ Medium 🔥 Hard 🏆 Expert",
   "level labels are the site's four, emoji and name on one line");
/* each level is a different operation — that IS the difficulty here */
ok(LV.map(l => E.LEVELS[l].op).join("") === "+-×÷", "levels should run + − × ÷, got " + LV.map(l => E.LEVELS[l].op).join(""));
ok(new Set(LV.map(l => E.LEVELS[l].op)).size === 4, "no two levels may share an operation");

/* ---------- 2. the options, on their own ---------- */
for(const answer of [0, 1, 2, 3, 7, 12, 20, 64]){
  for(let t = 0; t < stress(200); t++){
    const opts = E.genOptions(answer);
    const at = "answer " + answer + ": ";
    ok(opts.length === 4, at + "should offer four options, got " + opts.length);
    ok(opts.filter(o => o.correct).length === 1, at + "exactly one option may be the right one");
    ok(opts.find(o => o.correct).value === answer, at + "the option marked correct must BE the answer");
    ok(new Set(opts.map(o => o.value)).size === 4, at + "an option is repeated — " + opts.map(o => o.value).join(","));
    ok(opts.every(o => Number.isInteger(o.value)), at + "every option must be a whole number");
    /* a monster cannot eat a negative number of things — the game is 3+ arithmetic */
    ok(opts.every(o => o.value >= 0), at + "a negative option appeared — " + opts.map(o => o.value).join(","));
    ok(opts.filter(o => o.value === answer).length === 1, at + "the answer must not also appear as a decoy");
  }
}

/* ---------- 3. every problem, at every level ---------- */
for(const lv of LV){
  const op = E.LEVELS[lv].op;
  const N = stress(20000);
  let wrongMath = 0, negative = 0, notWhole = 0, badRange = 0, badOptions = 0, noAnswer = 0,
      dupOptions = 0, flagsWrong = 0;
  const posCorrect = [0, 0, 0, 0];
  const seen = new Set();

  for(let i = 0; i < N; i++){
    const p = E.genProblem(lv);
    if(p.level !== lv || p.op !== op) flagsWrong++;

    /* THE claim: the sum shown is the sum scored */
    const real = op === "+" ? p.a + p.b : op === "-" ? p.a - p.b : op === "×" ? p.a * p.b : p.a / p.b;
    if(real !== p.answer) wrongMath++;
    if(p.answer < 0) negative++;
    if(!Number.isInteger(p.answer) || !Number.isInteger(p.a) || !Number.isInteger(p.b)) notWhole++;

    /* the ranges each operation promises */
    if(op === "+"){ if(p.a < 1 || p.b < 1 || p.answer > 20) badRange++; }
    else if(op === "-"){ if(p.b < 1 || p.b >= p.a || p.a > 20) badRange++; }
    else if(op === "×"){ if(p.a < 2 || p.a > 9 || p.b < 2 || p.b > 9) badRange++; }
    else { if(p.b < 2 || p.b > 9 || p.a % p.b !== 0 || p.answer < 2 || p.answer > 9) badRange++; }

    if(p.options.length !== 4) badOptions++;
    if(p.options.filter(o => o.correct).length !== 1) badOptions++;
    const right = p.options.find(o => o.correct);
    if(!right || right.value !== p.answer) noAnswer++;
    if(new Set(p.options.map(o => o.value)).size !== 4) dupOptions++;
    posCorrect[p.options.findIndex(o => o.correct)]++;
    seen.add(p.a + op + p.b);
  }

  ok(flagsWrong === 0, lv + ": " + flagsWrong + " problems disagreed with their own level");
  ok(wrongMath === 0, lv + ": " + wrongMath + " problems where " + op + " did not give the scored answer");
  ok(negative === 0, lv + ": " + negative + " problems had a negative answer");
  ok(notWhole === 0, lv + ": " + notWhole + " problems were not whole numbers (a ÷ that does not come out)");
  ok(badRange === 0, lv + ": " + badRange + " problems fell outside the range this level promises");
  ok(badOptions === 0, lv + ": " + badOptions + " problems did not offer four options with one right");
  ok(noAnswer === 0, lv + ": " + noAnswer + " problems where the right option was not the answer");
  ok(dupOptions === 0, lv + ": " + dupOptions + " problems repeated an option");
  ok(seen.size > 10, lv + ": only " + seen.size + " different sums ever came up");

  /* no tell: the right answer must not favour a position on the row */
  const expect = N / 4;
  const worst = posCorrect.reduce((w, c) => Math.max(w, Math.abs(c - expect) / expect), 0);
  ok(worst < 0.15, lv + ": the answer favours an option slot (worst is " + (worst * 100).toFixed(1) + "% off even)");
}

report("math-monsters engine");
