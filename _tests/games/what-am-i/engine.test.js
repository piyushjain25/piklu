"use strict";
/* What Am I? is five JSON files of riddles, and the game's only defence against a bad one is
   validRiddles(), which silently DROPS anything malformed as it loads. That silence is the
   risk: a riddle whose answer is not among its own options, or whose options repeat, just
   disappears — the level quietly shrinks and nobody notices. So this test runs every real file
   through that same filter and fails if anything is dropped, then checks the riddles for the
   things the filter cannot see: an answer that appears in the question text, or a riddle
   duplicated across two levels. The optional fifth level (📝 My Riddles) is checked both ways,
   since it only appears when my.json is non-empty. */
const fs = require("fs"), path = require("path");
const { ROOT, loadEngine, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("what-am-i");

const DIR = path.join(ROOT, "games/what-am-i");
const LV = ["EASY", "MEDIUM", "HARD", "EXPERT"];
const read = f => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
const FILES = { EASY: "easy.json", MEDIUM: "medium.json", HARD: "hard.json", EXPERT: "expert.json" };
const RAW = {};
for(const lv of LV) RAW[lv] = read(FILES[lv]);
const MY = fs.existsSync(path.join(DIR, "my.json")) ? read("my.json") : [];

/* ---------- 1. the levels ---------- */
ok(Object.keys(E.LEVELS).join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order");
ok(LV.map(l => E.LEVELS[l].label).join(" ") === "🌱 Easy ⭐ Medium 🔥 Hard 🏆 Expert",
   "level labels are the site's four, emoji and name on one line");
for(const lv of LV)
  ok(E.LEVELS[lv].file === FILES[lv], lv + ": should load " + FILES[lv] + ", not " + E.LEVELS[lv].file);
/* MY is not in LEVELS until my.json turns out to be non-empty — that is what hides the card */
ok(!("MY" in E.LEVELS), "the My Riddles level must not exist until its data loads");
ok(Array.isArray(E.POOLS.MY), "POOLS still needs a MY slot for the optional level");

/* ---------- 2. the filter itself ----------
   validRiddles is the game's whole validation, so check it rejects what it should before
   trusting what it accepts. */
const good = { q: "I have keys but no locks. What am I?", answer: "Piano", options: ["Piano", "Door", "Map", "Tree"] };
ok(E.validRiddles([good]).length === 1, "a well-formed riddle should survive the filter");
for(const [what, bad] of [
  ["no question",        { ...good, q: "" }],
  ["a non-string question", { ...good, q: 42 }],
  ["three options",      { ...good, options: ["Piano", "Door", "Map"] }],
  ["five options",       { ...good, options: ["Piano", "Door", "Map", "Tree", "Cup"] }],
  ["a repeated option",  { ...good, options: ["Piano", "Piano", "Map", "Tree"] }],
  ["an answer that is not an option", { ...good, answer: "Harp" }],
  ["no options at all",  { q: good.q, answer: "Piano" }],
  ["nothing at all",     null],
]) ok(E.validRiddles([bad]).length === 0, "the filter should reject " + what);
ok(E.validRiddles("not a list").length === 0, "the filter should reject a non-list");
ok(E.validRiddles(null).length === 0, "the filter should reject nothing at all");

/* ---------- 3. every riddle file ---------- */
const ALL = { ...RAW, MY };
for(const pool of [...LV, "MY"]){
  const list = ALL[pool];
  const at = pool + ": ";
  ok(Array.isArray(list), at + "should be a list of riddles");
  if(!Array.isArray(list)) continue;
  if(pool !== "MY") ok(list.length >= 20, at + "needs a real pool, got " + list.length);

  /* THE claim: nothing is silently dropped on the way in */
  const kept = E.validRiddles(list);
  const dropped = list.filter(r => !kept.includes(r));
  ok(dropped.length === 0, at + dropped.length + " of " + list.length + " riddles would be silently dropped as malformed"
     + (dropped.length ? " (e.g. " + JSON.stringify(dropped[0]).slice(0, 120) + ")" : ""));

  let givesItAway = 0, noAnswer = 0, stray = 0, shortOption = 0;
  const giveaways = [], qs = [];
  for(const r of kept){
    qs.push(r.q.trim().toLowerCase());
    if(typeof r.answer !== "string" || !r.answer.trim()) noAnswer++;
    else if(new RegExp("\\b" + r.answer.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(r.q)){
      givesItAway++;
      if(giveaways.length < 3) giveaways.push(r.answer + " — \"" + r.q.slice(0, 70) + "…\"");
    }
    if(r.options.some(o => typeof o !== "string" || !o.trim())) shortOption++;
    for(const k of Object.keys(r)) if(!["q", "answer", "options"].includes(k)) stray++;
  }
  ok(noAnswer === 0, at + noAnswer + " riddles had no answer");
  ok(shortOption === 0, at + shortOption + " riddles had a blank option");
  ok(stray === 0, at + stray + " riddles carried a field the game does not read");
  ok(givesItAway === 0, at + givesItAway + " riddles contain their own answer in the question"
     + (giveaways.length ? " (e.g. " + giveaways.join("; ") + ")" : ""));
  ok(new Set(qs).size === qs.length, at + (qs.length - new Set(qs).size) + " riddles are repeated within the file");
}
/* a riddle should not sit in two levels — the ladder would not mean anything */
for(let i = 0; i < LV.length; i++) for(let j = i + 1; j < LV.length; j++){
  const a = new Set(RAW[LV[i]].map(r => r.q.trim().toLowerCase()));
  const shared = RAW[LV[j]].filter(r => a.has(r.q.trim().toLowerCase()));
  ok(shared.length === 0, LV[i] + " and " + LV[j] + " share " + shared.length + " riddles");
}

/* ---------- 4. serving riddles ---------- */
E.setPools({ ...RAW, MY });
for(const pool of [...LV, "MY"]){
  const list = ALL[pool];
  if(!list.length) continue;
  const T = stress(5000);
  let nulls = 0, offPool = 0, immediateRepeat = 0;
  const seen = new Set();
  let prev = null;
  for(let i = 0; i < T; i++){
    const r = E.pickRiddle(pool);
    if(!r){ nulls++; continue; }
    if(!list.includes(r)) offPool++;
    if(prev && r.q === prev && list.length > 1) immediateRepeat++;
    prev = r.q;
    seen.add(r.q);
  }
  ok(nulls === 0, pool + ": pickRiddle came back empty " + nulls + " times");
  ok(offPool === 0, pool + ": " + offPool + " riddles were not from the pool");
  ok(immediateRepeat === 0, pool + ": the same riddle came twice in a row " + immediateRepeat + " times");
  ok(seen.size === list.length, pool + ": only " + seen.size + " of " + list.length + " riddles ever came up");
}
/* the recent window holds back ~70% of the pool, so a riddle cannot come back soon */
{
  E.setPools({ EASY: RAW.EASY });
  const run = [];
  for(let i = 0; i < 300; i++) run.push(E.pickRiddle("EASY").q);
  const cap = Math.max(1, Math.min(RAW.EASY.length - 1, Math.floor(RAW.EASY.length * 0.7)));
  let tooSoon = 0;
  for(let i = cap; i < run.length; i++) if(run.slice(i - cap, i).includes(run[i])) tooSoon++;
  ok(tooSoon === 0, tooSoon + " riddles came back inside the " + cap + "-riddle no-repeat window");
}
/* an unloaded pool is a "not ready" state, not a crash — the files may be missing under file:// */
E.setPools({});
for(const lv of LV) ok(E.pickRiddle(lv) === null, lv + ": an empty pool should serve null rather than throw");
ok(E.pickRiddle("NOPE") === null, "an unknown level has nothing to serve");

/* ---------- 5. shuffle ---------- */
{
  const src = ["a", "b", "c", "d", "e", "f"];
  let moved = 0;
  for(let i = 0; i < stress(400); i++){
    const out = E.shuffle(src);
    ok(out.slice().sort().join() === src.slice().sort().join(), "shuffle lost or invented an item");
    if(out.join() !== src.join()) moved++;
  }
  ok(moved > 0, "shuffle never changed the order");
  ok(src.join() === "a,b,c,d,e,f", "shuffle must not reorder the list it was given");
}

report("what-am-i engine");
