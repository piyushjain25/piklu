"use strict";
/* What Comes Next shows a run and hides the last item. Every puzzle carries both the sequence
   and the rule that made it, so the test to run is the obvious one: continue the sequence
   yourself, from the items alone, and check you land on the answer the game will accept. A
   repeating pattern must really repeat, an arithmetic run must really step by the same amount,
   and a doubling run must really double — and in all three the hidden item must be the only
   option that fits, or a child who reasons correctly can still pick a wrong-looking right
   answer. */
const { loadEngine, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("what-comes-next");

const LV = Object.keys(E.LEVELS);

/* ---------- 1. the levels ---------- */
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order: " + LV.join(","));
ok(LV.map(l => E.LEVELS[l].label).join(" ") === "🌱 Easy ⭐ Medium 🔥 Hard 🏆 Expert",
   "level labels are the site's four, emoji and name on one line");
ok(new Set(E.SYMBOLS).size === E.SYMBOLS.length, "a symbol is listed twice — a pattern would be ambiguous");
ok(E.SYMBOLS.length >= 4, "need at least four symbols to fill an option row");
for(const lv of LV){
  const cfg = E.LEVELS[lv];
  ok(cfg.kinds.length > 0, lv + ": needs a kind of pattern");
  ok(cfg.kinds.every(k => ["repeat", "arith", "geo"].includes(k)), lv + ": unknown pattern kind " + cfg.kinds.join(","));
  ok(cfg.templates.length > 0, lv + ": needs a template");
  ok(cfg.templates.every(t => /^[A-Z]{2,4}$/.test(t)), lv + ": a template must be 2–4 capital letters");
  if(cfg.kinds.includes("arith") || cfg.kinds.includes("geo"))
    ok(cfg.arith && cfg.arith.steps.length, lv + ": a number level needs steps to count by");
  if(cfg.kinds.includes("geo")) ok(cfg.arith.geo && cfg.arith.geo.length, lv + ": a geo level needs ratios");
}
/* the ladder: Easy is shapes only, the harder levels are numbers */
ok(E.LEVELS.EASY.kinds.join() === "repeat", "Easy should be repeating shapes only");
ok(E.LEVELS.HARD.kinds.includes("geo") && E.LEVELS.EXPERT.kinds.includes("geo"),
   "Hard and Expert should include multiplying patterns");
ok(!E.LEVELS.EASY.arith, "Easy should have no number rules at all");
ok(E.LEVELS.MEDIUM.arith.dir.join() === "1", "Medium should only count upwards");
ok(E.LEVELS.HARD.arith.dir.includes(-1), "Hard should also count backwards");

/* ---------- 2. continue the sequence yourself ----------
   Deliberately from the ITEMS, not from the rule the puzzle ships. */
function continues(p){
  const shown = p.items.slice(0, p.blankIndex);
  if(p.kind === "repeat"){
    /* find the shortest period that explains everything shown, then step one more */
    for(let u = 1; u <= shown.length; u++){
      let fits = true;
      for(let i = 0; i < shown.length; i++) if(shown[i] !== shown[i % u]) { fits = false; break; }
      if(fits) return shown[p.blankIndex % u];
    }
    return null;
  }
  if(p.kind === "arith"){
    const d = shown[1] - shown[0];
    for(let i = 2; i < shown.length; i++) if(shown[i] - shown[i-1] !== d) return null;
    return shown[shown.length - 1] + d;
  }
  if(p.kind === "geo"){
    const r = shown[1] / shown[0];
    for(let i = 2; i < shown.length; i++) if(shown[i] / shown[i-1] !== r) return null;
    return shown[shown.length - 1] * r;
  }
  return null;
}

for(const lv of LV){
  const T = stress(20000);
  let nulls = 0, wrongAnswer = 0, notDerivable = 0, badOptions = 0, dupOptions = 0,
      answerMissing = 0, badBlank = 0, shortRun = 0, noRule = 0, nonPositive = 0,
      twoFit = 0, badKind = 0, first = null;
  const kindsSeen = new Set(), runs = new Set();

  for(let i = 0; i < T; i++){
    const p = E.genPuzzle(lv);
    if(!p){ nulls++; continue; }
    kindsSeen.add(p.kind);
    runs.add(p.items.join(","));
    if(!E.LEVELS[lv].kinds.includes(p.kind) && !(lv === "EASY" && p.kind === "repeat")) badKind++;
    if(!p.rule) noRule++;

    /* the blank is the last item, and there must be enough before it to see the pattern */
    if(p.blankIndex !== p.items.length - 1) badBlank++;
    if(p.blankIndex < 3) shortRun++;
    if(p.items[p.blankIndex] !== p.answer){
      wrongAnswer++;
      if(!first) first = "[" + p.items.join(" ") + "] hides " + p.items[p.blankIndex] + " but the answer is " + p.answer;
    }

    /* THE claim: continuing the run from the items alone gives the answer the game accepts */
    const mine = continues(p);
    if(mine === null){ notDerivable++; if(!first) first = "[" + p.items.join(" ") + "] has no consistent rule"; }
    else if(mine !== p.answer){
      wrongAnswer++;
      if(!first) first = "[" + p.items.slice(0, p.blankIndex).join(" ") + " ?] continues to " + mine
        + ", the answer is " + p.answer + " (" + p.rule + ")";
    }

    if(p.options.length !== 4) badOptions++;
    if(new Set(p.options).size !== p.options.length) dupOptions++;
    if(!p.options.includes(p.answer)) answerMissing++;
    /* the answer must appear exactly once, or a right tap could land on the wrong tile */
    if(p.options.filter(o => o === p.answer).length !== 1){
      twoFit++;
      if(!first) first = "the answer " + p.answer + " appears twice in [" + p.options.join(", ") + "]";
    }
    if(p.isNumber){
      if(p.items.some(x => !Number.isInteger(x) || x <= 0)) nonPositive++;
      if(p.options.some(o => !Number.isInteger(o) || o <= 0)) nonPositive++;
    } else if(p.items.some(x => !E.SYMBOLS.includes(x))) nonPositive++;
  }

  ok(nulls === 0, lv + ": genPuzzle came back empty " + nulls + " times");
  ok(badKind === 0, lv + ": " + badKind + " puzzles used a pattern kind this level does not list");
  ok(noRule === 0, lv + ": " + noRule + " puzzles carried no rule to explain themselves");
  ok(badBlank === 0, lv + ": " + badBlank + " puzzles did not hide the LAST item");
  ok(shortRun === 0, lv + ": " + shortRun + " puzzles showed fewer than three items before the blank");
  ok(notDerivable === 0, lv + ": " + notDerivable + " puzzles had no consistent rule in the items shown"
     + (first ? " (" + first + ")" : ""));
  ok(wrongAnswer === 0, lv + ": " + wrongAnswer + " puzzles where continuing the run does not give the answer"
     + (first ? "\n      first: " + first : ""));
  ok(badOptions === 0, lv + ": " + badOptions + " puzzles did not offer four options");
  ok(dupOptions === 0, lv + ": " + dupOptions + " puzzles repeated an option");
  ok(answerMissing === 0, lv + ": " + answerMissing + " puzzles did not offer their own answer");
  ok(twoFit === 0, lv + ": " + twoFit + " puzzles offered the answer more than once"
     + (first ? "\n      first: " + first : ""));
  ok(nonPositive === 0, lv + ": " + nonPositive + " puzzles used a value outside what the board can show");
  /* every kind the level lists must actually be dealt */
  for(const k of E.LEVELS[lv].kinds) ok(kindsSeen.has(k), lv + ": the " + k + " pattern was never dealt");
  ok(runs.size > 20, lv + ": only " + runs.size + " different runs ever came up");
}

/* ---------- 3. the distractor helper ---------- */
for(const answer of [1, 2, 7, 25, 100]){
  for(let i = 0; i < stress(200); i++){
    const d = E.distinctDistractors(answer, [answer + 1, answer - 1, answer, answer + 5], 3);
    ok(d.length === 3, "distinctDistractors(" + answer + ") gave " + d.length + ", expected 3");
    ok(!d.includes(answer), "a distractor must not be the answer");
    ok(new Set(d).size === d.length, "distinctDistractors repeated a value: " + d.join(","));
    ok(d.every(x => x > 0), "a distractor must be positive, got " + d.join(","));
  }
}
/* it must cope when the candidates it is handed are useless */
{
  const d = E.distinctDistractors(3, [3, 3, 3], 3);
  ok(d.length === 3 && !d.includes(3) && new Set(d).size === 3,
     "distinctDistractors should fall back to nearby numbers, got " + d.join(","));
}

/* ---------- 4. the three generators on their own ---------- */
for(const [name, fn, lv] of [["genRepeat", E.genRepeat, "EASY"], ["genArith", E.genArith, "EXPERT"],
                             ["genGeo", E.genGeo, "EXPERT"]]){
  let bad = 0, nulls = 0, first = null;
  for(let i = 0; i < stress(4000); i++){
    const p = fn(lv);
    if(!p){ nulls++; continue; }      /* genArith/genGeo may legitimately bail and be retried */
    const mine = continues(p);
    if(mine !== p.answer){ bad++; if(!first) first = "[" + p.items.join(" ") + "] → " + mine + " not " + p.answer; }
  }
  ok(bad === 0, name + ": " + bad + " sequences did not continue to their own answer" + (first ? " (" + first + ")" : ""));
  ok(nulls < stress(4000), name + ": never produced a puzzle at all");
}

report("what-comes-next engine");
