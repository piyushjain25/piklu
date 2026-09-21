"use strict";
/* Guess the Capital shows a state or country and four capital cities. The one failure that
   makes it unfair is a question where more than one option is right. Two entries are allowed to
   share a capital (Chandigarh serves both Haryana and Punjab), so the game leans on
   uniqueCapitals() to dedupe before drawing distractors — which means the safety is in the code,
   not in the data. This test therefore builds every question the game can ask and checks that
   exactly one option is correct and every distractor is some other entry's real capital, then
   checks the data behind them: unique names, and a two-letter ISO code for every country whose
   flag the world quiz fetches. */
const fs = require("fs"), path = require("path");
const { ROOT, loadEngine, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("guess-the-capital");

const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "games/guess-the-capital/capitals.json"), "utf8"));
const MODES = ["india", "world"];

/* ---------- 1. the file's shape ---------- */
ok(DATA && typeof DATA === "object", "capitals.json should be an object of the two quizzes");
for(const m of MODES){
  ok(Array.isArray(DATA[m]), m + ": should be a list");
  /* four options come from four DISTINCT capitals, so a pool of three can never ask a question */
  ok(DATA[m].length >= 10, m + ": needs a real pool, got " + (DATA[m] || []).length);
}
ok(Object.keys(DATA).every(k => MODES.includes(k)), "capitals.json has a quiz no mode reads: "
   + Object.keys(DATA).filter(k => !MODES.includes(k)).join(","));

/* ---------- 2. every entry ---------- */
for(const m of MODES){
  const at = m + ": ";
  const names = [], caps = [];
  let noName = 0, noCapital = 0, badIso = 0, badFact = 0, stray = 0;
  for(const x of DATA[m]){
    if(!x || typeof x.name !== "string" || !x.name.trim()) { noName++; continue; }
    if(typeof x.capital !== "string" || !x.capital.trim()) noCapital++;
    names.push(x.name); caps.push(x.capital);
    /* the world quiz draws its flag from flagcdn.com by ISO code — the one remote host this
       game is allowed (CLAUDE.md rule 4) — so a missing or malformed code is a broken image */
    if(m === "world"){ if(typeof x.iso2 !== "string" || !/^[a-z]{2}$/.test(x.iso2)) badIso++; }
    else if("iso2" in x) stray++;
    if("fact" in x && typeof x.fact !== "string") badFact++;
    for(const k of Object.keys(x)) if(!["name", "capital", "iso2", "fact"].includes(k)) stray++;
  }
  ok(noName === 0, at + noName + " entries had no name");
  ok(noCapital === 0, at + noCapital + " entries had no capital");
  ok(badFact === 0, at + badFact + " entries had a non-string fact");
  ok(stray === 0, at + stray + " entries carried a field this quiz does not use");
  if(m === "world") ok(badIso === 0, at + badIso + " countries had no usable two-letter ISO code for their flag");
  ok(new Set(names).size === names.length, at + "a name is listed twice: "
     + names.filter((n, i) => names.indexOf(n) !== i).slice(0, 3).join(", "));
  /* Two entries CAN share a capital — Chandigarh really is the capital of both Haryana and
     Punjab, and the game's own `fact` for those two says so. That is safe only because the
     distractors are drawn through uniqueCapitals(), which dedupes; without it the shared name
     could appear twice in one row, or as a distractor that is also the answer. So the check is
     on the dedupe, not on the data — and the question sweep below proves it holds in practice. */
  const distinct = E.uniqueCapitals(DATA[m]);
  ok(new Set(distinct).size === distinct.length, at + "uniqueCapitals returned a duplicate");
  ok(distinct.length === new Set(caps).size, at + "uniqueCapitals lost or invented a capital");
  ok(distinct.length >= 4, at + "needs at least four distinct capitals to fill an option row");
}

/* ---------- 3. flags ---------- */
ok(E.flagEmoji("in") === "🇮🇳", "flagEmoji('in') should be the Indian flag, got " + E.flagEmoji("in"));
ok(E.flagEmoji("JP") === "🇯🇵", "flagEmoji should accept upper case too, got " + E.flagEmoji("JP"));
{
  const seen = new Set();
  for(const x of DATA.world) seen.add(E.flagEmoji(x.iso2));
  ok(seen.size === DATA.world.length, "two countries produced the same flag emoji");
  ok([...seen].every(f => [...f].length === 2), "every flag should be two regional-indicator characters");
}

/* ---------- 4. every question the game can ask ---------- */
E.setData(DATA);
for(const m of MODES){
  const pool = DATA[m];
  const T = stress(20000);
  let nulls = 0, wrongCount = 0, dupOptions = 0, answerMissing = 0, ambiguous = 0,
      badIdx = 0, offPool = 0, first = null;
  const asked = new Set();

  for(let i = 0; i < T; i++){
    const q = E.genQuestion(m);
    if(!q){ nulls++; continue; }
    if(!pool.includes(q.item)) offPool++;
    asked.add(q.item.name);

    if(q.options.length !== 4) wrongCount++;
    if(new Set(q.options).size !== q.options.length) dupOptions++;
    if(!q.options.includes(q.item.capital)) answerMissing++;
    if(q.options[q.correctIdx] !== q.item.capital) badIdx++;

    /* THE claim: exactly one option is the capital of the place being asked about */
    const right = q.options.filter(o => o === q.item.capital).length;
    if(right !== 1){
      ambiguous++;
      if(!first) first = q.item.name + " → [" + q.options.join(", ") + "], answer " + q.item.capital;
    }
    /* and every distractor must be a real capital of something else in the same quiz */
    for(const o of q.options){
      if(o === q.item.capital) continue;
      if(!pool.some(x => x.capital === o)){
        ambiguous++;
        if(!first) first = "distractor " + o + " is not any entry's capital";
      }
    }
  }

  ok(nulls === 0, m + ": genQuestion came back empty " + nulls + " times");
  ok(offPool === 0, m + ": " + offPool + " questions asked about something not in the pool");
  ok(wrongCount === 0, m + ": " + wrongCount + " questions did not offer four options");
  ok(dupOptions === 0, m + ": " + dupOptions + " questions repeated an option");
  ok(answerMissing === 0, m + ": " + answerMissing + " questions did not offer their own answer");
  ok(badIdx === 0, m + ": " + badIdx + " questions pointed correctIdx at the wrong option");
  ok(ambiguous === 0, m + ": " + ambiguous + " questions had more than one right answer, or a made-up distractor"
     + (first ? "\n      first: " + first : ""));
  ok(asked.size === pool.length, m + ": only " + asked.size + " of " + pool.length + " places were ever asked about");
}
/* an unloaded quiz is a "not ready" state, not a crash */
E.setData({ india: [], world: [] });
for(const m of MODES) ok(E.genQuestion(m) === null, m + ": an empty pool should give null rather than throw");
ok(E.genQuestion("nope") === null, "an unknown mode should give null");

/* ---------- 5. shuffle ---------- */
{
  const src = ["a", "b", "c", "d", "e", "f", "g", "h"];
  let moved = 0;
  for(let i = 0; i < stress(400); i++){
    const out = E.shuffle(src);
    ok(out.length === src.length && out.slice().sort().join() === src.slice().sort().join(),
       "shuffle lost or invented an item");
    if(out.join() !== src.join()) moved++;
  }
  ok(moved > 0, "shuffle never changed the order");
  ok(src.join() === "a,b,c,d,e,f,g,h", "shuffle must not reorder the list it was given");
}

report("guess-the-capital engine");
