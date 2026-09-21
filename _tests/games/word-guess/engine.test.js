"use strict";
/* Guess the Word picks a hidden word by LENGTH: Easy is 3–5 letters, Expert 16–20. Those bands
   are a promise about the data file, and the data file is a plain list with no bands in it — so
   the failure mode is a level that silently has nothing to serve, or a word whose length falls
   in a gap between two bands and can never be dealt at all. Both are checked here against the
   real words.json, along with the word list being clean enough for a hangman keyboard (A–Z
   only, no duplicates) and the two life counters the round is won or lost on. */
const fs = require("fs"), path = require("path");
const { ROOT, loadEngine, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("word-guess");

const RAW = JSON.parse(fs.readFileSync(path.join(ROOT, "games/word-guess/words.json"), "utf8"));
const LV = Object.keys(E.LEVELS);
/* the game upper-cases and drops anything non-alphabetic as it loads — do the same here */
const WORDS = RAW.filter(w => /^[A-Za-z]+$/.test(w)).map(w => w.toUpperCase());

/* ---------- 1. the lives ----------
   These are not a score: they decide whether the round is won or lost (CLAUDE.md's exception
   for this game), so their values are part of how the game plays. */
ok(E.MAX_LETTER_WRONG === 10, "ten letter hearts, got " + E.MAX_LETTER_WRONG);
ok(E.MAX_WORD_WRONG === 3, "three word stars, got " + E.MAX_WORD_WRONG);
ok(E.MAX_LETTER_WRONG > E.MAX_WORD_WRONG, "guessing the whole word must be the riskier move");

/* ---------- 2. the length bands ---------- */
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order: " + LV.join(","));
ok(LV.map(l => E.LEVELS[l].label).join(" ") === "🌱 Easy ⭐ Medium 🔥 Hard 🏆 Expert",
   "level labels are the site's four, emoji and name on one line");
for(const lv of LV){
  const { min, max } = E.LEVELS[lv];
  ok(min >= 3, lv + ": a word under three letters is not a puzzle, got min " + min);
  ok(max >= min, lv + ": the band " + min + "–" + max + " is not a range");
}
/* the bands must tile without a gap or an overlap: a length in a gap can never be dealt, and a
   length in two bands makes bandForLength's answer depend on object key order */
for(let i = 1; i < LV.length; i++){
  const prev = E.LEVELS[LV[i-1]], cur = E.LEVELS[LV[i]];
  ok(cur.min === prev.max + 1, LV[i-1] + " ends at " + prev.max + " but " + LV[i] + " starts at " + cur.min
     + " — lengths in between can never be dealt");
}
{
  const lo = Math.min(...LV.map(l => E.LEVELS[l].min)), hi = Math.max(...LV.map(l => E.LEVELS[l].max));
  for(let n = lo; n <= hi; n++){
    const bands = LV.filter(l => n >= E.LEVELS[l].min && n <= E.LEVELS[l].max);
    ok(bands.length === 1, n + " letters falls in " + bands.length + " bands (" + bands.join(",") + ")");
    ok(E.bandForLength(n) === bands[0], n + " letters: bandForLength said " + E.bandForLength(n) + ", expected " + bands[0]);
  }
  ok(E.bandForLength(lo - 1) === null, (lo - 1) + " letters is below every band and should be null");
  ok(E.bandForLength(hi + 1) === null, (hi + 1) + " letters is above every band and should be null");
  ok(E.bandForLength(0) === null, "an empty word belongs to no band");
}

/* ---------- 3. the word list ---------- */
ok(Array.isArray(RAW) && RAW.length > 200, "words.json should be a decent list, got " + RAW.length);
ok(RAW.length === WORDS.length, (RAW.length - WORDS.length) + " entries would be dropped as non-alphabetic — "
   + "they are dead weight in the file: " + RAW.filter(w => !/^[A-Za-z]+$/.test(w)).slice(0, 5).join(", "));
ok(new Set(WORDS).size === WORDS.length, "the list has "
   + (WORDS.length - new Set(WORDS).size) + " duplicate words (case-insensitively)");
{
  const outside = WORDS.filter(w => E.bandForLength(w.length) === null);
  ok(outside.length === 0, outside.length + " words can never be dealt — their length is outside every band"
     + (outside.length ? " (e.g. " + outside.slice(0, 5).map(w => w + "=" + w.length).join(", ") + ")" : ""));
}
/* THE claim: every level must have words to serve, and enough of them not to repeat */
for(const lv of LV){
  const { min, max } = E.LEVELS[lv];
  const pool = WORDS.filter(w => w.length >= min && w.length <= max);
  ok(pool.length > 0, lv + " (" + min + "–" + max + " letters) has NO words — the level is unplayable");
  ok(pool.length >= 10, lv + " (" + min + "–" + max + ") has only " + pool.length + " words — Skip would loop almost at once");
  /* and every length inside the band should be represented, or the band is narrower than it says */
  const lens = new Set(pool.map(w => w.length));
  ok(lens.size >= Math.min(2, max - min + 1), lv + ": only " + lens.size + " distinct word lengths in a "
     + (max - min + 1) + "-length band");
}

/* ---------- 4. picking a word ---------- */
E.setWords(WORDS);
for(const lv of LV){
  const { min, max } = E.LEVELS[lv];
  const pool = WORDS.filter(w => w.length >= min && w.length <= max);
  const seen = new Set();
  let offBand = 0, nulls = 0, notInList = 0;
  for(let i = 0; i < stress(5000); i++){
    const w = E.pickRandomWord(lv);
    if(w === null){ nulls++; continue; }
    if(w.length < min || w.length > max) offBand++;
    if(!pool.includes(w)) notInList++;
    seen.add(w);
  }
  ok(nulls === 0, lv + ": pickRandomWord came back empty " + nulls + " times");
  ok(offBand === 0, lv + ": " + offBand + " words were outside the " + min + "–" + max + " band");
  ok(notInList === 0, lv + ": " + notInList + " words were not from the list");
  ok(seen.size > Math.min(10, pool.length / 2), lv + ": only " + seen.size + " of " + pool.length + " words ever came up");
}
/* an empty list is the "not loaded yet" state — the game must serve null rather than crash */
E.setWords([]);
for(const lv of LV) ok(E.pickRandomWord(lv) === null, lv + ": an empty word list should serve null, not throw");
/* a list with nothing in a band serves null for that band only */
E.setWords(["CAT", "DOG"]);
ok(E.pickRandomWord("EASY") !== null, "a 3-letter list should still serve Easy");
ok(E.pickRandomWord("EXPERT") === null, "a 3-letter list has nothing for Expert");

report("word-guess engine");
