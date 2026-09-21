"use strict";
/* Sentence Doctor has two halves that must agree with each other: a generator that breaks a
   sentence, and a checker that decides whether the player has healed it. When they drift, the
   child types the right sentence and is told it is still sick — the worst failure this game can
   have, and an invisible one, because both halves look fine on their own. So the headline test
   feeds every generated item's OWN correct sentence back into the checker and demands a cure,
   thousands of times per level, and demands that the broken sentence is NOT accepted. Around
   that: the levels' promises about how many things are wrong and what kind, the near-miss rule
   (a typo is "almost", a wrong verb form is wrong even when it is spelled close), and the
   doctor having something to say about every kind of symptom it can deal. */
const { loadEngine, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("sentence-doctor");

const LV = Object.keys(E.TIER_OF_LEVEL);

/* ---------- 1. text plumbing ---------- */
ok(E.normalize("  a   b  ") === "a b", "normalize collapses runs of whitespace");
ok(E.normalize("don’t") === "don't", "normalize folds a smart apostrophe");
ok(E.normalize("“hi”") === '"hi"', "normalize folds smart quotes");
for(const [s, body, punct] of [["The cat sat.", "The cat sat", "."], ["Is it?", "Is it", "?"],
                               ["Wow!", "Wow", "!"], ["no end", "no end", ""], ["  spaced .  ", "spaced", "."]])
  ok(E.splitBodyPunct(s).body === body && E.splitBodyPunct(s).punct === punct,
     "splitBodyPunct(" + JSON.stringify(s) + ") → " + JSON.stringify(E.splitBodyPunct(s)));

/* levenshtein: the near-miss rule rests on it, so check it rather than trusting it */
ok(E.levenshtein("", "") === 0 && E.levenshtein("abc", "abc") === 0, "distance from a word to itself is 0");
ok(E.levenshtein("", "abc") === 3 && E.levenshtein("abc", "") === 3, "distance from nothing is the length");
ok(E.levenshtein("cat", "cart") === 1, "one insertion is distance 1");
ok(E.levenshtein("sing", "sang") === 1, "one substitution is distance 1");
ok(E.levenshtein("kitten", "sitting") === 3, "the textbook case is 3");
for(const [a, b] of [["cat", "dog"], ["running", "run"], ["a", "abcdef"], ["", "x"]])
  ok(E.levenshtein(a, b) === E.levenshtein(b, a), "distance must be symmetric for " + a + "/" + b);

/* ---------- 2. the near-miss rule ---------- */
ok(E.compareWord("cat", "cat") === "exact", "the same word is exact");
ok(E.compareWord("Cat", "cat") === "case", "a capital-only difference is its own answer");
ok(E.compareWord("runing", "running") === "almost", "a one-letter typo is a near miss");
ok(E.compareWord("elephant", "cat") === "wrong", "a different word is wrong");
/* the subtlety the game exists to teach: a real but WRONG form of the verb is a grammar miss,
   not a spelling slip, even when the two words are one letter apart */
ok(E.compareWord("sang", "sing", ["sing", "sang", "sung"]) === "wrong",
   "an alternate verb form must be 'wrong', not forgiven as a typo");
ok(E.compareWord("sang", "sing") === "almost", "without the alternates it is only a near miss");
/* short strings have no meaningful near miss — a punctuation mark is not a typo */
ok(E.compareWord(".", "?") === "wrong", "one punctuation mark for another is wrong, not almost");
ok(E.compareWord("", "an") === "wrong", "a blank slot is wrong, not almost");

/* ---------- 3. how many faults a level can actually deal ----------
   EXPERT asks pickErrorCount for 2 or 3, but it can only ever break a slot that is ELIGIBLE —
   capitalisation and punctuation are off the table above Easy — so what it really gets is
   min(2..3, eligible slots on the template it drew). Every template today offers exactly one,
   which makes EXPERT a one-fault level in practice and leaves the multi-fault branch unused.
   The bound is computed from the templates rather than hard-coded, so adding a template with
   two grammar slots brings that branch to life without this test crying wolf. */
const KINDS = new Set();
const eligibleOn = build => Object.keys(build.slots)
  .filter(k => !["capital", "punctuation"].includes(build.slots[k].kind)).length;
const MAX_ELIGIBLE = Math.max(...E.TEMPLATES.map(t => eligibleOn(t.build())));
ok(MAX_ELIGIBLE >= 1, "no template has a slot that can be broken above Easy");
const EXPERT_MAX = Math.min(3, MAX_ELIGIBLE);

/* ---------- 4. every item, at every level ---------- */
for(const lv of LV){
  const N = stress(3000);
  let threw = 0, sameSentence = 0, notCured = 0, brokenAccepted = 0, badCount = 0,
      caseAtWrongLevel = 0, badKinds = 0, slotMismatch = 0, noSlotCure = 0, slotBrokenCured = 0,
      badWordKinds = 0, firstBad = null;
  const recent = E.makeRecentTracker(8);
  const seen = new Set();

  for(let i = 0; i < N; i++){
    let it;
    try { it = E.generateItem(lv, recent); }
    catch(e){ threw++; if(!firstBad) firstBad = e.message; continue; }

    seen.add(it.correctSentence);
    it.chosenKeys.forEach(k => KINDS.add(it.slots[k].kind));

    /* there has to be something to fix */
    if(it.brokenSentence === it.correctSentence) sameSentence++;

    /* THE claim: the sentence the game itself calls correct must cure the patient */
    const cure = E.checkFreeText(it, it.correctSentence);
    if(!cure.cured){
      notCured++;
      if(!firstBad) firstBad = "typing the correct sentence was refused: " + JSON.stringify(it.correctSentence)
        + " (broken: " + JSON.stringify(it.brokenSentence) + ", template " + it.templateId + ")";
    }
    /* ...and the sentence it starts you with must NOT */
    if(E.checkFreeText(it, it.brokenSentence).cured){
      brokenAccepted++;
      if(!firstBad) firstBad = "the broken sentence was accepted as cured: " + JSON.stringify(it.brokenSentence);
    }

    /* how many things are wrong, and of what kind */
    if(lv === "EXPERT"){ if(it.chosenKeys.length < 1 || it.chosenKeys.length > EXPERT_MAX) badCount++; }
    else if(it.chosenKeys.length !== 1) badCount++;
    /* capitalisation and punctuation are only ever the tested fault on Easy */
    if(lv !== "EASY" && it.chosenKeys.some(k => ["capital", "punctuation"].includes(it.slots[k].kind))) caseAtWrongLevel++;
    for(const k of it.chosenKeys){
      const s = it.slots[k];
      if(!s || !s.kind) badKinds++;
      else if(s.broken === s.correct) slotMismatch++;        /* a "fix" that changes nothing */
    }

    /* wordKinds must line up with the words a player actually edits */
    if(it.wordKinds.length !== it.correctBody.split(" ").length) badWordKinds++;

    /* the single-slot path (Easy/Medium's dropdowns) must agree with the same answer */
    if(it.chosenKeys.length === 1){
      const s = it.slots[it.chosenKeys[0]];
      if(!E.checkSingleSlot(it, s.correct).cured) noSlotCure++;
      if(E.checkSingleSlot(it, s.broken).cured) slotBrokenCured++;
    }
  }

  ok(threw === 0, lv + ": generateItem gave up " + threw + " times" + (firstBad ? " (" + firstBad + ")" : ""));
  ok(sameSentence === 0, lv + ": " + sameSentence + " patients were not actually sick");
  ok(notCured === 0, lv + ": " + notCured + " items refused their OWN correct sentence"
     + (firstBad ? "\n      first: " + firstBad : ""));
  ok(brokenAccepted === 0, lv + ": " + brokenAccepted + " items accepted the broken sentence as cured");
  ok(badCount === 0, lv + ": " + badCount + " items had the wrong number of faults for this level"
     + (lv === "EXPERT" ? " (expected 1.." + EXPERT_MAX + ", capped by the templates' eligible slots)" : ""));
  ok(caseAtWrongLevel === 0, lv + ": " + caseAtWrongLevel + " items tested capitals/punctuation above Easy");
  ok(badKinds === 0, lv + ": " + badKinds + " chosen slots had no kind");
  ok(slotMismatch === 0, lv + ": " + slotMismatch + " chosen slots were already correct");
  ok(badWordKinds === 0, lv + ": " + badWordKinds + " items had a wordKinds list that does not match the sentence");
  ok(noSlotCure === 0, lv + ": " + noSlotCure + " single-slot rounds refused the slot's own correct value");
  ok(slotBrokenCured === 0, lv + ": " + slotBrokenCured + " single-slot rounds accepted the broken value");
  ok(seen.size > 20, lv + ": only " + seen.size + " different sentences ever came up");
}

/* Easy and Medium share a tier floor with the harder ones above them */
ok(E.TIER_OF_LEVEL.EASY === 0, "Easy should draw on tier-0 templates only");
for(let i = 1; i < LV.length; i++)
  ok(E.TIER_OF_LEVEL[LV[i]] >= E.TIER_OF_LEVEL[LV[i-1]], LV[i] + " should not draw on fewer templates than " + LV[i-1]);
for(const t of E.TEMPLATES){
  ok(typeof t.build === "function", "every template needs a build()");
  ok(Number.isInteger(t.tier) && t.tier >= 0, "every template needs a tier");
}

/* ---------- 5. the doctor has something to say about every symptom it deals ---------- */
ok(KINDS.size >= 5, "only " + KINDS.size + " kinds of fault were ever dealt — the templates are barely varying");
for(const k of KINDS){
  ok(Array.isArray(E.DIAGNOSES[k]) && E.DIAGNOSES[k].length > 0, k + ": no diagnosis line for a fault the game deals");
  ok(!!E.KIND_LABEL[k], k + ": no KIND_LABEL — the 'still to fix' message would name nothing");
  ok(!!E.HINT_SYMPTOM[k], k + ": no HINT_SYMPTOM — Hint would print the raw kind name");
  /* tense is the one kind with a chip of its own ("🕐 Expected tense: Past"), built from the
     slot's tenseGroup rather than from FOCUS_LABEL — so it needs that, not a label. */
  if(k === "tense") ok(true, "tense gets its own chip rather than a FOCUS_LABEL");
  else ok(!!E.FOCUS_LABEL[k], k + ": no FOCUS_LABEL — the focus chip would be blank");
  ok(typeof E.diagnosisFor([k]) === "string" && E.diagnosisFor([k]).length > 0, k + ": diagnosisFor() said nothing");
  ok(E.hintMessage([k]).includes(E.HINT_SYMPTOM[k]), k + ": hintMessage() did not mention the symptom");
  ok(E.remainingMessage([k]).length > 0, k + ": remainingMessage() said nothing");
}
/* more than one thing wrong gets its own line, and the hint lists them all */
ok(Array.isArray(E.DIAGNOSES.MULTI) && E.DIAGNOSES.MULTI.length > 0, "a multi-fault patient needs its own diagnosis");
{
  const two = [...KINDS].slice(0, 2);
  ok(E.DIAGNOSES.MULTI.includes(E.diagnosisFor(two)), "two faults should draw a MULTI diagnosis");
  ok(two.every(k => E.hintMessage(two).includes(E.HINT_SYMPTOM[k])), "the hint should list every symptom");
}
ok(E.CURED_LINES.length > 0 && E.OUCH_LINES.length > 0, "the doctor needs something to say when you win and when you miss");

/* a tense fault renders its own chip from the slot's tenseGroup — without one the chip reads
   "Expected tense: Undefined" */
{
  let missing = 0, checked = 0;
  for(const lv of LV){
    const r = E.makeRecentTracker(8);
    for(let i = 0; i < stress(600); i++){
      const it = E.generateItem(lv, r);
      for(const k of it.chosenKeys) if(it.slots[k].kind === "tense"){
        checked++;
        if(typeof it.slots[k].tenseGroup !== "string" || !it.slots[k].tenseGroup) missing++;
      }
    }
  }
  ok(checked > 0, "no tense fault was ever dealt, so its chip is untested");
  ok(missing === 0, missing + " tense slots had no tenseGroup for their chip to name");
}

report("sentence-doctor engine");
