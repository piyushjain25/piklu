"use strict";
/* Sneak Peek shows a grid for a few seconds, hides it, and asks one of three questions about
   what was there. Each question type builds its own answer and its own decoys, and each has a
   way to go wrong that a child would experience as the game lying: a "which wasn't there?"
   round whose answer WAS there, a "what was in the 3rd spot?" round pointing at the wrong
   square, or a "what came right after 🍎?" round where a decoy also came right after something.
   This test re-derives the answer from the grid itself for every round, at every level, and
   checks the decoys are drawn from where they should be. */
const { loadEngine, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("sneak-peek");

const LV = Object.keys(E.LEVELS);

/* ---------- 1. the pool and the levels ---------- */
ok(new Set(E.POOL).size === E.POOL.length, "a picture appears twice in the pool — a grid could show it twice");
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order: " + LV.join(","));
ok(LV.map(l => E.LEVELS[l].label).join(" ") === "🌱 Easy ⭐ Medium 🔥 Hard 🏆 Expert",
   "level labels are the site's four, emoji and name on one line");
for(const lv of LV){
  const c = E.LEVELS[lv];
  ok(c.n >= 4, lv + ": " + c.n + " pictures is barely a memory test");
  ok(c.seconds > 0, lv + ": needs time on screen");
  ok(!!E.COLS[c.n], lv + ": a grid of " + c.n + " has no column count, so it cannot be laid out");
  ok(c.n % E.COLS[c.n] === 0, lv + ": " + c.n + " pictures do not fill " + E.COLS[c.n] + " columns evenly");
  ok(c.kinds.length > 0, lv + ": needs a kind of question");
  ok(c.kinds.every(k => ["missing", "position", "order"].includes(k)), lv + ": unknown question kind");
  /* a round needs n on screen plus enough left over to draw decoys from */
  ok(E.POOL.length >= c.n + 3, lv + ": the pool is too small to fill a grid of " + c.n + " and still find decoys");
}
/* the ladder: more to remember, less time, and harder questions */
for(let i = 1; i < LV.length; i++){
  const a = E.LEVELS[LV[i-1]], b = E.LEVELS[LV[i]];
  ok(b.n >= a.n, LV[i] + " should show at least as many pictures as " + LV[i-1]);
  ok(b.seconds <= a.seconds, LV[i] + " should give no more time than " + LV[i-1]);
  ok(b.kinds.length >= a.kinds.length, LV[i] + " should ask at least as many kinds of question as " + LV[i-1]);
}
ok(E.LEVELS.HARD.kinds.includes("order") && E.LEVELS.EXPERT.kinds.includes("order"),
   "the order question should be the harder levels' addition");
ok(!E.LEVELS.EASY.kinds.includes("order"), "Easy should not ask about order");

/* ---------- 2. ordinals ---------- */
for(const [n, want] of [[1,"1st"],[2,"2nd"],[3,"3rd"],[4,"4th"],[9,"9th"],[11,"11th"],[12,"12th"],
                        [13,"13th"],[21,"21st"],[22,"22nd"],[23,"23rd"],[101,"101st"],[111,"111th"]])
  ok(E.ordinal(n) === want, "ordinal(" + n + ") should be " + want + ", got " + E.ordinal(n));

/* ---------- 3. every round, at every level ---------- */
for(const lv of LV){
  const c = E.LEVELS[lv];
  const T = stress(20000);
  let wrongN = 0, dupShown = 0, offPool = 0, badOptions = 0, dupOptions = 0, answerMissing = 0,
      answerTwice = 0, noPrompt = 0, wrongAnswer = 0, badDecoys = 0, ambiguous = 0, badKind = 0, first = null;
  const kindsSeen = new Set();

  for(let i = 0; i < T; i++){
    const r = E.genRound(lv);
    kindsSeen.add(r.kind);
    if(!c.kinds.includes(r.kind)) badKind++;

    if(r.shown.length !== c.n || r.n !== c.n) wrongN++;
    if(new Set(r.shown).size !== r.shown.length) dupShown++;
    if(r.shown.some(x => !E.POOL.includes(x))) offPool++;
    if(!r.prompt) noPrompt++;

    if(r.options.length !== 4) badOptions++;
    if(new Set(r.options).size !== r.options.length) dupOptions++;
    if(!r.options.includes(r.answer)) answerMissing++;
    if(r.options.filter(o => o === r.answer).length !== 1) answerTwice++;

    /* re-derive the answer from the grid, per question type */
    if(r.kind === "missing"){
      /* THE claim: the answer was NOT on the grid, and every decoy WAS */
      if(r.shown.includes(r.answer)){
        wrongAnswer++;
        if(!first) first = "'wasn't there' answer " + r.answer + " IS on the grid [" + r.shown.join("") + "]";
      }
      const decoysOnGrid = r.options.filter(o => o !== r.answer).every(o => r.shown.includes(o));
      if(!decoysOnGrid){
        ambiguous++;
        if(!first) first = "'wasn't there' offers a second picture that also wasn't there: ["
          + r.options.join("") + "] vs grid [" + r.shown.join("") + "]";
      }
    } else if(r.kind === "position"){
      if(r.pos < 1 || r.pos > c.n){ wrongAnswer++; if(!first) first = "position " + r.pos + " is off a grid of " + c.n; }
      else if(r.shown[r.pos - 1] !== r.answer){
        wrongAnswer++;
        if(!first) first = "the " + E.ordinal(r.pos) + " spot holds " + r.shown[r.pos - 1] + ", the answer is " + r.answer;
      }
      if(!r.prompt.includes(E.ordinal(r.pos))){
        wrongAnswer++;
        if(!first) first = "the prompt does not name the spot it is asking about: " + r.prompt;
      }
      /* every decoy must be somewhere else on the grid — a decoy that was never shown is a
         giveaway for a child who remembers the grid but not the order */
      if(!r.options.filter(o => o !== r.answer).every(o => r.shown.includes(o))) badDecoys++;
    } else {
      /* order: the answer is whatever came right after refItem */
      const idx = r.shown.indexOf(r.refItem);
      if(idx < 0 || idx + 1 >= c.n){
        wrongAnswer++;
        if(!first) first = "the reference " + r.refItem + " is not on the grid, or is last";
      } else if(r.shown[idx + 1] !== r.answer){
        wrongAnswer++;
        if(!first) first = r.refItem + " is followed by " + r.shown[idx + 1] + ", the answer is " + r.answer;
      }
      if(!r.prompt.includes(r.refItem)){
        wrongAnswer++;
        if(!first) first = "the prompt does not name the picture it is asking about: " + r.prompt;
      }
      /* the reference itself must not be offered — it cannot come after itself */
      if(r.options.includes(r.refItem)){
        ambiguous++;
        if(!first) first = "the reference " + r.refItem + " is offered as an answer to its own question";
      }
    }
  }

  ok(badKind === 0, lv + ": " + badKind + " rounds asked a kind of question this level does not list");
  ok(wrongN === 0, lv + ": " + wrongN + " grids were not " + c.n + " pictures");
  ok(dupShown === 0, lv + ": " + dupShown + " grids showed the same picture twice");
  ok(offPool === 0, lv + ": " + offPool + " grids used a picture outside the pool");
  ok(noPrompt === 0, lv + ": " + noPrompt + " rounds had no question to read");
  ok(badOptions === 0, lv + ": " + badOptions + " rounds did not offer four options");
  ok(dupOptions === 0, lv + ": " + dupOptions + " rounds repeated an option");
  ok(answerMissing === 0, lv + ": " + answerMissing + " rounds did not offer their own answer");
  ok(answerTwice === 0, lv + ": " + answerTwice + " rounds offered the answer more than once");
  ok(wrongAnswer === 0, lv + ": " + wrongAnswer + " rounds where the answer does not match the grid"
     + (first ? "\n      first: " + first : ""));
  ok(ambiguous === 0, lv + ": " + ambiguous + " rounds had a second defensible answer"
     + (first ? "\n      first: " + first : ""));
  ok(badDecoys === 0, lv + ": " + badDecoys + " position rounds offered a decoy that was never on the grid");
  for(const k of c.kinds) ok(kindsSeen.has(k), lv + ": the " + k + " question was never asked");
}

report("sneak-peek engine");
