"use strict";
/* Number Builder gives a child some digit tiles and a goal — largest, smallest, closest to 300,
   the largest even one — and marks the arrangement they build. The goal text and the set of
   accepted answers are computed separately, so the failure to hunt for is a goal that says one
   thing and accepts another: "make the largest even number" accepting an odd one, or a
   "greater than 250" round where no arrangement clears 250 at all. Every challenge here is
   re-solved by brute force over all permutations of its own digits, and the accepted set is
   compared with what the goal's words actually ask for. */
const { loadEngine, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("number-builder");

const LV = Object.keys(E.LEVELS);

/* ---------- 1. the levels ---------- */
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order: " + LV.join(","));
ok(LV.map(l => E.LEVELS[l].label).join(" ") === "🌱 Easy ⭐ Medium 🔥 Hard 🏆 Expert",
   "level labels are the site's four, emoji and name on one line");
for(const lv of LV){
  const cfg = E.LEVELS[lv];
  ok(cfg.D >= 2 && cfg.D <= 4, lv + ": " + cfg.D + " digits is outside what the board can show");
  ok(cfg.goals.length >= 1, lv + ": needs at least one kind of goal");
  ok(!!E.PLACE_NAMES[cfg.D], lv + ": " + cfg.D + " digits has no place-value names");
  ok(E.PLACE_NAMES[cfg.D].length === cfg.D, lv + ": the place names do not match the digit count");
}
for(let i = 1; i < LV.length; i++)
  ok(E.LEVELS[LV[i]].D >= E.LEVELS[LV[i-1]].D, LV[i] + " should use at least as many digits as " + LV[i-1]);
ok(!E.LEVELS.EASY.allowZero && !E.LEVELS.MEDIUM.allowZero, "Easy and Medium should not deal a zero");
ok(E.LEVELS.HARD.allowZero && E.LEVELS.EXPERT.allowZero, "Hard and Expert should deal a zero — that is the leading-zero trap");
ok(E.LEVELS.EXPERT.goals.includes("LARGEST_EVEN") || E.LEVELS.EXPERT.goals.includes("SMALLEST_ODD"),
   "Expert should ask for parity, not just size");

/* ---------- 2. place value ---------- */
for(const D in E.PLACE_NAMES){
  const names = E.PLACE_NAMES[D];
  ok(names[names.length - 1] === "ones", D + " digits: the last place must be the ones");
  for(let i = 0; i < names.length; i++){
    ok(E.placeName(+D, i) === names[i], D + "/" + i + ": placeName disagrees with the table");
    ok(E.placeMult(+D, i) === Math.pow(10, D - 1 - i),
       D + "/" + i + ": " + names[i] + " should be worth " + Math.pow(10, D - 1 - i) + ", got " + E.placeMult(+D, i));
  }
  /* the multipliers must descend by tens, left to right */
  for(let i = 1; i < names.length; i++)
    ok(E.placeMult(+D, i - 1) === E.placeMult(+D, i) * 10, D + ": " + names[i-1] + " should be ten " + names[i]);
}
ok(E.fmtMult(1) === "×1" && E.fmtMult(10) === "×10" && E.fmtMult(100) === "×100" && E.fmtMult(1000) === "×1000",
   "the multiplier chips should read ×1 ×10 ×100 ×1000");

/* ---------- 3. arrangements ---------- */
{
  /* no leading zero, and every distinct ordering exactly once */
  for(const digits of [["1","2"], ["0","5","7"], ["0","1","2","3"], ["4","0","9"]]){
    const A = E.validArrangements(digits);
    const vals = A.map(a => a.val);
    ok(new Set(A.map(a => a.arr.join(""))).size === A.length, digits.join("") + ": an arrangement is listed twice");
    ok(A.every(a => a.arr[0] !== "0"), digits.join("") + ": an arrangement led with a zero");
    ok(A.every(a => a.val === +a.arr.join("")), digits.join("") + ": an arrangement's value is not its digits");
    ok(A.every(a => a.arr.slice().sort().join("") === digits.slice().sort().join("")),
       digits.join("") + ": an arrangement used different digits");
    /* count it independently: distinct permutations that do not start with 0 */
    const all = new Set();
    const perm = (left, acc) => { if(!left.length){ all.add(acc.join("")); return; }
      left.forEach((d, i) => perm(left.filter((_, j) => j !== i), acc.concat(d))); };
    perm(digits, []);
    const want = [...all].filter(s => s[0] !== "0").length;
    ok(A.length === want, digits.join("") + ": " + A.length + " arrangements, expected " + want);
    ok(vals.length === new Set(vals).size || digits.length !== new Set(digits).size,
       digits.join("") + ": two arrangements of distinct digits gave the same value");
  }
  ok(E.validArrangements(["0", "0"]).length === 0, "digits that can only lead with zero have no valid arrangement");
}

/* the digits dealt must be distinct, in range, and never all the same */
for(const lv of LV){
  const cfg = E.LEVELS[lv];
  let bad = 0;
  for(let i = 0; i < stress(4000); i++){
    const d = E.randomDigits(cfg.D, cfg.allowZero);
    if(d.length !== cfg.D) bad++;
    if(new Set(d).size !== d.length) bad++;
    if(d.some(x => !/^[0-9]$/.test(x))) bad++;
    if(!cfg.allowZero && d.includes("0")) bad++;
    if(new Set(d).size < 2) bad++;
  }
  ok(bad === 0, lv + ": " + bad + " digit deals were malformed");
}

/* ---------- 4. every challenge answers its own question ---------- */
for(const lv of LV){
  const cfg = E.LEVELS[lv];
  const T = stress(5000);
  let nulls = 0, wrongDigits = 0, emptyCorrect = 0, trivial = 0, noText = 0,
      mismatch = 0, badArrangement = 0, offGoal = 0, first = null;
  const goalsSeen = new Set();

  for(let t = 0; t < T; t++){
    const c = E.buildChallenge(lv);
    if(!c){ nulls++; continue; }
    if(c.digits.length !== cfg.D || c.D !== cfg.D) wrongDigits++;
    if(!cfg.goals.includes(c.goal.type)) offGoal++;
    goalsSeen.add(c.goal.type);
    if(!c.goal.text) noText++;

    const A = E.validArrangements(c.digits);
    const vals = A.map(a => a.val);
    const accepted = [...c.goal.correct];

    if(!accepted.length){ emptyCorrect++; continue; }
    /* a goal every arrangement satisfies is not a puzzle */
    if(accepted.length >= A.length) trivial++;

    /* the arrangement the game ships as its own answer must be accepted, and be real */
    const shown = +c.goal.arrangement.join("");
    if(!accepted.includes(shown) || !vals.includes(shown) || c.goal.arrangement[0] === "0") badArrangement++;

    /* THE claim: re-solve the goal from its own words and compare */
    let want;
    switch(c.goal.type){
      case "LARGEST":      want = vals.filter(v => v === Math.max(...vals)); break;
      case "SMALLEST":     want = vals.filter(v => v === Math.min(...vals)); break;
      case "LARGEST_EVEN": { const p = vals.filter(v => v % 2 === 0); want = p.filter(v => v === Math.max(...p)); break; }
      case "SMALLEST_ODD": { const p = vals.filter(v => v % 2 === 1); want = p.filter(v => v === Math.min(...p)); break; }
      case "GREATER":      { const p = vals.filter(v => v > c.goal.X); want = p.filter(v => v === Math.min(...p)); break; }
      case "LESS":         { const p = vals.filter(v => v < c.goal.X); want = p.filter(v => v === Math.max(...p)); break; }
      case "CLOSEST":      { const m = Math.min(...vals.map(v => Math.abs(v - c.goal.T)));
                             want = vals.filter(v => Math.abs(v - c.goal.T) === m); break; }
      default: want = null;
    }
    if(!want || !want.length || new Set(want).size !== accepted.length || accepted.some(v => !want.includes(v))){
      mismatch++;
      if(!first) first = c.goal.type + " on digits " + c.digits.join("") + " — \"" + c.goal.text
        + "\" accepts [" + accepted.join(",") + "] but the words mean [" + (want || []).join(",") + "]";
    }
    /* a threshold or target must be named in the sentence a child reads */
    if(c.goal.type === "GREATER" || c.goal.type === "LESS"){
      if(!c.goal.text.includes(String(c.goal.X))){ mismatch++; if(!first) first = "the threshold is not in the text: " + c.goal.text; }
      if(!vals.some(v => c.goal.type === "GREATER" ? v > c.goal.X : v < c.goal.X)){
        mismatch++;
        if(!first) first = "\"" + c.goal.text + "\" but no arrangement of " + c.digits.join("") + " qualifies";
      }
    }
    if(c.goal.type === "CLOSEST" && !c.goal.text.includes(String(c.goal.T))){
      mismatch++; if(!first) first = "the target is not in the text: " + c.goal.text;
    }
  }

  ok(nulls === 0, lv + ": buildChallenge gave up " + nulls + " times");
  ok(wrongDigits === 0, lv + ": " + wrongDigits + " challenges dealt the wrong number of digits");
  ok(offGoal === 0, lv + ": " + offGoal + " challenges used a goal this level does not list");
  ok(noText === 0, lv + ": " + noText + " challenges had nothing to read");
  ok(emptyCorrect === 0, lv + ": " + emptyCorrect + " challenges accepted no answer at all");
  ok(trivial === 0, lv + ": " + trivial + " challenges accepted every arrangement — not a puzzle");
  ok(badArrangement === 0, lv + ": " + badArrangement + " challenges shipped an answer they would not accept");
  ok(mismatch === 0, lv + ": " + mismatch + " challenges accept something other than what they ask for"
     + (first ? "\n      first: " + first : ""));
  ok(goalsSeen.size === cfg.goals.length, lv + ": only " + goalsSeen.size + " of " + cfg.goals.length + " goal kinds ever came up");
}

report("number-builder engine");
