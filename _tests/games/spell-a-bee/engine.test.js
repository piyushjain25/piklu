"use strict";
/* Spell-a-Bee reads a word aloud and asks a child to type it. The word, its hint and its
   optional emoji all come from words.json, and the game does almost no validation as it loads —
   it assigns the file straight to BANK. So the checks that matter are on the data: a word with
   a space or an apostrophe cannot be typed on the game's A–Z keyboard, and a hint that contains
   the word itself gives the answer away to a child who can read. A hint is optional — Hint falls
   back to "the next letter is X" without one — so it is validated only when present. */
const fs = require("fs"), path = require("path");
const { ROOT, loadEngine, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("spell-a-bee");

const BANK = JSON.parse(fs.readFileSync(path.join(ROOT, "games/spell-a-bee/words.json"), "utf8"));
const LV = Object.keys(E.LEVELS);
const POOLS = [...LV, "MY"];

/* ---------- 1. the levels ---------- */
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order: " + LV.join(","));
ok(LV.map(l => E.LEVELS[l].label).join(" ") === "🌱 Easy ⭐ Medium 🔥 Hard 🏆 Expert",
   "level labels are the site's four, emoji and name on one line");
ok(E.RECENT_MAX >= 4, "the no-repeat window should be worth having, got " + E.RECENT_MAX);

/* ---------- 2. the file's shape ---------- */
ok(BANK && typeof BANK === "object" && !Array.isArray(BANK), "words.json should be an object of level pools");
for(const k of Object.keys(BANK))
  ok(POOLS.includes(k), "words.json has a pool called " + k + " that no level reads");
for(const lv of LV)
  ok(Array.isArray(BANK[lv]) && BANK[lv].length >= 20, lv + ": needs a real pool, got " + (BANK[lv] || []).length);
/* MY is the optional fifth level: it may be absent or empty, but if present it must be a list */
ok(!("MY" in BANK) || Array.isArray(BANK.MY), "MY must be a list when it is present at all");

/* ---------- 3. every entry ---------- */
for(const pool of POOLS){
  const list = BANK[pool];
  if(!Array.isArray(list)) continue;
  const at = pool + ": ";
  const words = [];
  let noWord = 0, unTypeable = 0, noHint = 0, hintGivesItAway = 0, badEmoji = 0, tooShort = 0, strayKeys = 0;
  const giveaways = [];

  for(const entry of list){
    if(!entry || typeof entry !== "object" || typeof entry.w !== "string" || !entry.w){ noWord++; continue; }
    const w = entry.w;
    words.push(w.toLowerCase());
    /* THE claim: the keyboard is A–Z, so anything else cannot be typed */
    if(!/^[a-zA-Z]+$/.test(w)) unTypeable++;
    if(w.length < 2) tooShort++;
    /* a hint is OPTIONAL — the game falls back to "the next letter is X" without one — but an
       empty string or a non-string is a broken entry rather than an omitted hint */
    if("h" in entry && (typeof entry.h !== "string" || !entry.h.trim())) noHint++;
    else if(entry.h && new RegExp("\\b" + w.toLowerCase() + "\\b", "i").test(entry.h)){
      hintGivesItAway++;
      if(giveaways.length < 3) giveaways.push(w + " — \"" + entry.h + "\"");
    }
    if("e" in entry && (typeof entry.e !== "string" || !entry.e)) badEmoji++;
    for(const k of Object.keys(entry)) if(!["w", "h", "e"].includes(k)) strayKeys++;
  }

  ok(noWord === 0, at + noWord + " entries had no word");
  ok(unTypeable === 0, at + unTypeable + " words cannot be typed on an A–Z keyboard");
  ok(tooShort === 0, at + tooShort + " words were shorter than two letters");
  ok(noHint === 0, at + noHint + " entries had an empty or non-string hint — omit the field instead");
  ok(badEmoji === 0, at + badEmoji + " entries had an empty emoji field — leave it out instead");
  ok(strayKeys === 0, at + strayKeys + " entries carried a field the game does not read");
  ok(hintGivesItAway === 0, at + hintGivesItAway + " hints contain the word they are hinting at"
     + (giveaways.length ? " (e.g. " + giveaways.join("; ") + ")" : ""));
  ok(new Set(words).size === words.length, at + (words.length - new Set(words).size) + " duplicate words");
}
/* a word should not sit in two levels at once — the ladder would not mean anything */
for(let i = 0; i < LV.length; i++) for(let j = i + 1; j < LV.length; j++){
  const a = new Set(BANK[LV[i]].map(e => e.w.toLowerCase()));
  const shared = BANK[LV[j]].filter(e => a.has(e.w.toLowerCase())).map(e => e.w);
  ok(shared.length === 0, LV[i] + " and " + LV[j] + " share " + shared.length + " words"
     + (shared.length ? " (e.g. " + shared.slice(0, 5).join(", ") + ")" : ""));
}
/* the ladder should get harder, and word length is the one measure the data actually carries */
{
  const mean = lv => BANK[lv].reduce((a, e) => a + e.w.length, 0) / BANK[lv].length;
  for(let i = 1; i < LV.length; i++)
    ok(mean(LV[i]) > mean(LV[i-1]), LV[i] + " averages " + mean(LV[i]).toFixed(1)
       + " letters, no longer than " + LV[i-1] + "'s " + mean(LV[i-1]).toFixed(1));
}

/* ---------- 4. serving words ---------- */
E.setBank(BANK);
for(const pool of POOLS){
  const list = BANK[pool];
  if(!Array.isArray(list) || !list.length) continue;
  ok(E.poolFor(pool).length === list.length, pool + ": poolFor should hand back the whole pool");
  const seen = new Set();
  let nulls = 0, offPool = 0, immediateRepeat = 0;
  let prev = null;
  for(let i = 0; i < stress(5000); i++){
    const w = E.pickWord(pool);
    if(!w){ nulls++; continue; }
    if(!list.includes(w)) offPool++;
    if(prev && w.w === prev && list.length > 1) immediateRepeat++;
    prev = w.w;
    seen.add(w.w);
  }
  ok(nulls === 0, pool + ": pickWord came back empty " + nulls + " times");
  ok(offPool === 0, pool + ": " + offPool + " words were not from the pool");
  ok(immediateRepeat === 0, pool + ": the same word was served twice in a row " + immediateRepeat + " times");
  ok(seen.size > Math.min(10, list.length / 2), pool + ": only " + seen.size + " of " + list.length + " words ever came up");
}
/* the recent window really does hold the last few words back */
{
  E.setBank({ EASY: BANK.EASY });
  const run = [];
  for(let i = 0; i < 200; i++) run.push(E.pickWord("EASY").w);
  let tooSoon = 0;
  const window = Math.min(E.RECENT_MAX, BANK.EASY.length - 1);
  for(let i = window; i < run.length; i++)
    if(run.slice(i - window, i).includes(run[i])) tooSoon++;
  ok(tooSoon === 0, tooSoon + " words came back inside the " + window + "-word no-repeat window");
}
/* an unloaded or unknown pool is a "not ready" state, not a crash */
E.setBank({});
ok(E.poolFor("EASY").length === 0, "an unloaded bank has no pool");
ok(E.pickWord("EASY") === null, "an empty pool should serve null rather than throw");
ok(E.poolFor("NOPE").length === 0, "an unknown level has no pool");
E.setBank({ EASY: "not a list" });
ok(E.poolFor("EASY").length === 0, "a malformed pool should read as empty, not throw");

/* ---------- 5. shuffle ---------- */
{
  const src = BANK.EASY.slice(0, 30);
  /* these are objects, so compare by word — .join() on objects is "[object Object]" either way */
  const key = list => list.map(e => e.w).join(",");
  const before = key(src);
  let moved = 0;
  for(let i = 0; i < stress(200); i++){
    const out = E.shuffle(src);
    ok(out.length === src.length, "shuffle changed the number of words");
    if(out.some(x => !src.includes(x))) ok(false, "shuffle invented a word");
    if(key(out) !== before) moved++;
  }
  ok(moved > 0, "shuffle never changed the order at all");
  ok(key(src) === before, "shuffle must not reorder the list it was given");
}

report("spell-a-bee engine");
