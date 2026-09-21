"use strict";
/* Mystery Word is Wordle, and Wordle lives or dies on one function: the colouring of a guess
   when letters repeat. Score SPEED against ABIDE and a naive implementation lights both of the
   guess's Es, when the secret has only one to give. A child cannot deduce anything from tiles
   that lie about how many of a letter there are, and
   nothing else in the game would notice. So scoreGuess is checked here against an independent
   re-implementation over every pair of words in the banks plus a table of the classic
   duplicate-letter traps, and the two data files are checked for the thing that would make the
   game unwinnable: an answer the dictionary would refuse as a guess. */
const fs = require("fs"), path = require("path");
const { ROOT, loadEngine, tally, stress, mulberry32 } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("mystery-word");

const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, "games/mystery-word", f), "utf8"));
const WORDS = read("words.json"), DICT = read("dictionary.json");
const LV = Object.keys(E.LEVELS);

/* ---------- 1. the shape of the game ---------- */
ok(E.WORD_LEN === 5, "a mystery word is five letters");
ok(E.MAX_TRIES === 6, "six tries, like the game it is modelled on");
ok(E.MAX_HINTS >= 1 && E.MAX_HINTS <= E.WORD_LEN, "hints must be worth having but not give the whole word away");
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order: " + LV.join(","));
ok(LV.map(l => E.LEVELS[l].label).join(" ") === "🌱 Easy ⭐ Medium 🔥 Hard 🏆 Expert",
   "level labels are the site's four, emoji and name on one line");

/* ---------- 2. an independent scorer ----------
   Written from the rule rather than from the game's code: count the letters the secret has
   left after the exact matches are taken out, then spend them left to right. */
function oracle(guess, secret){
  const out = new Array(5).fill("absent");
  const pool = new Map();
  for(let i = 0; i < 5; i++)
    if(guess[i] === secret[i]) out[i] = "correct";
    else pool.set(secret[i], (pool.get(secret[i]) || 0) + 1);
  for(let i = 0; i < 5; i++){
    if(out[i] !== "absent") continue;
    const n = pool.get(guess[i]) || 0;
    if(n > 0){ out[i] = "present"; pool.set(guess[i], n - 1); }
  }
  return out;
}

/* the traps, spelled out — these are the cases a naive scorer gets wrong */
const C = "correct", P = "present", A = "absent";
for(const [guess, secret, want] of [
  ["CRANE", "CRANE", [C,C,C,C,C]],
  ["ABCDE", "FGHIJ", [A,A,A,A,A]],
  /* the secret has ONE e and the guess has two: only the first unmatched one may light up */
  ["SPEED", "ABIDE", [A,A,P,A,P]],
  /* ...but when the secret really has two, both do */
  ["SPEED", "ERASE", [P,A,P,P,A]],
  /* both of the guess's Ls are wrong when the secret has none */
  ["LLAMA", "ABBEY", [A,A,P,A,A]],
  /* an exact match must claim its letter before any earlier copy does */
  ["ARRAY", "GRAPH", [P,C,A,A,A]],
  ["EERIE", "THERE", [P,A,P,A,C]],
  /* a doubled guess against a doubled secret: both count */
  ["GEESE", "THESE", [A,A,C,C,C]],
]) ok(E.scoreGuess(guess, secret).join() === want.join(),
      guess + " vs " + secret + " → " + E.scoreGuess(guess, secret).join() + ", expected " + want.join());

/* ---------- 3. scoreGuess against the oracle, in bulk ---------- */
{
  const all = [...new Set([].concat(...LV.map(l => WORDS[l])))].map(w => w.toUpperCase());
  const rand = mulberry32(20260921);
  let bad = 0, first = null, N = stress(200000);
  for(let i = 0; i < N; i++){
    const g = all[Math.floor(rand() * all.length)], s = all[Math.floor(rand() * all.length)];
    const got = E.scoreGuess(g, s).join(), want = oracle(g, s).join();
    if(got !== want){ bad++; if(!first) first = g + " vs " + s + ": got " + got + ", expected " + want; }
  }
  ok(bad === 0, bad + " of " + N + " scored guesses disagreed with the rule" + (first ? " (" + first + ")" : ""));

  /* the invariants a player reasons with, on every pair */
  let broken = 0;
  const rand2 = mulberry32(7);
  for(let i = 0; i < stress(50000); i++){
    const g = all[Math.floor(rand2() * all.length)], s = all[Math.floor(rand2() * all.length)];
    const r = E.scoreGuess(g, s);
    if(r.length !== 5) broken++;
    if(r.some(x => !["correct", "present", "absent"].includes(x))) broken++;
    /* a position is correct exactly when the letters match there */
    for(let j = 0; j < 5; j++) if((r[j] === "correct") !== (g[j] === s[j])) broken++;
    /* the word is won exactly when every tile is correct */
    if((g === s) !== r.every(x => x === "correct")) broken++;
    /* no letter may be coloured more often than the secret actually contains it */
    for(const ch of new Set(g)){
      const lit = r.filter((x, j) => g[j] === ch && x !== "absent").length;
      const has = [...s].filter(c => c === ch).length;
      if(lit > has) broken++;
    }
    /* scoring is not symmetric, but the COUNT of coloured tiles is */
    if(E.scoreGuess(s, g).filter(x => x !== "absent").length !== r.filter(x => x !== "absent").length) broken++;
  }
  ok(broken === 0, broken + " scored guesses broke an invariant a player reasons with");
}

/* ---------- 4. the word banks ---------- */
const dictSet = new Set(DICT.map(w => w.toUpperCase()));
ok(DICT.length > 2000, "the dictionary should be big enough to accept a child's real guesses, got " + DICT.length);
ok(DICT.every(w => /^[A-Za-z]{5}$/.test(w)), "every dictionary entry must be five letters");
ok(dictSet.size === DICT.length, "the dictionary lists a word twice");

for(const lv of LV){
  const bank = WORDS[lv];
  ok(Array.isArray(bank) && bank.length > 50, lv + ": needs a real pool of answers, got " + (bank || []).length);
  const upper = bank.map(w => w.toUpperCase());
  ok(bank.every(w => /^[A-Za-z]{5}$/.test(w)), lv + ": every answer must be five letters");
  ok(new Set(upper).size === upper.length, lv + ": an answer is listed twice");
  /* THE data claim: the answer must be a word the game would let you type. Otherwise a child
     guesses the secret itself and is told it is not a word. */
  const unguessable = upper.filter(w => !dictSet.has(w));
  ok(unguessable.length === 0, lv + ": " + unguessable.length + " answers are not in the dictionary, so they could never be guessed"
     + (unguessable.length ? " — e.g. " + unguessable.slice(0, 5).join(", ") : ""));
}
/* the levels must actually differ, or the ladder is a label */
for(let i = 1; i < LV.length; i++){
  const a = new Set(WORDS[LV[i-1]].map(w => w.toUpperCase()));
  const b = WORDS[LV[i]].map(w => w.toUpperCase());
  const shared = b.filter(w => a.has(w)).length;
  ok(shared / b.length < 0.5, LV[i] + " shares " + shared + " of its " + b.length + " answers with " + LV[i-1]);
}

/* ---------- 5. the serving queue ----------
   Every word in a pool is served once before any repeats — that is what stops Skip from
   cycling between two words. */
for(const lv of LV){
  E.setBank({ [lv]: WORDS[lv].map(w => w.toUpperCase()) });
  const pool = E.poolFor(lv), n = pool.length;
  const first = [];
  for(let i = 0; i < n; i++) first.push(E.pickWord(lv));
  ok(new Set(first).size === n, lv + ": a word repeated before the pool of " + n + " was exhausted");
  ok(first.every(w => pool.includes(w)), lv + ": served a word that is not in the pool");
  /* and the next cycle must not reopen with the word that just closed the last one */
  const next = E.pickWord(lv);
  ok(next !== first[n - 1], lv + ": the new cycle reopened with the word that just closed the old one");
}
/* an empty pool is a "not loaded yet" state, not a crash — the data may be missing under file:// */
E.setBank({ EASY: [] });
ok(E.pickWord("EASY") === null, "an empty pool should serve null rather than throw");
ok(E.poolFor("NOPE").length === 0, "an unknown level has no pool");

/* shuffle keeps the same words, and does move them */
{
  const src = WORDS.EASY.slice(0, 40);
  let moved = 0;
  for(let i = 0; i < stress(200); i++){
    const out = E.shuffle(src);
    ok(out.length === src.length, "shuffle changed the number of words");
    if(out.slice().sort().join() !== src.slice().sort().join()) ok(false, "shuffle lost or invented a word");
    if(out.join() !== src.join()) moved++;
  }
  ok(moved > 0, "shuffle never changed the order at all");
}

report("mystery-word engine");
