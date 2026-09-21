"use strict";
/* Set the Clock shows a time in WORDS and asks a child to drag the hands to match. The words
   are generated, and English time-telling is full of traps: 45 past is "quarter to" the NEXT
   hour, 12 wraps to 1 rather than 13, "to" times count backwards from 60, and 1 minute is
   singular. Every one of those is a place where the phrase can name a different time than the
   one the game will accept. So this test parses every phrase the game can produce back into an
   hour and a minute and compares it with the time it was built from — all 720 of them. */
const { loadEngine, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("set-the-clock");

const LV = Object.keys(E.LEVELS);
const WORD = { five: 5, ten: 10, quarter: 15, twenty: 20, "twenty-five": 25, half: 30 };

/* ---------- 1. the levels ---------- */
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order: " + LV.join(","));
ok(LV.map(l => E.LEVELS[l].label).join(" ") === "🌱 Easy ⭐ Medium 🔥 Hard 🏆 Expert",
   "level labels are the site's four, emoji and name on one line");
for(let i = 1; i < LV.length; i++)
  ok(E.LEVELS[LV[i]].step < E.LEVELS[LV[i-1]].step,
     LV[i] + " should use a finer step than " + LV[i-1] + " (" + E.LEVELS[LV[i]].step + " vs " + E.LEVELS[LV[i-1]].step + ")");
ok(E.LEVELS.EASY.step === 60, "Easy should be o'clock only");
ok(E.LEVELS.EXPERT.step === 1, "Expert should be any minute");
for(const lv of LV){
  const s = E.LEVELS[lv].step;
  ok(s === 60 || 60 % s === 0, lv + ": a step of " + s + " does not divide the hour evenly");
}

/* ---------- 2. the hour wraps at 12 ---------- */
for(let h = 1; h <= 12; h++){
  const n = E.nextHour(h);
  ok(n >= 1 && n <= 12, "nextHour(" + h + ") = " + n + " is not a clock hour");
  ok(n === (h === 12 ? 1 : h + 1), "nextHour(" + h + ") should be " + (h === 12 ? 1 : h + 1) + ", got " + n);
}
/* the minute words must agree with the numbers they stand for */
for(const m in E.MW) ok(WORD[E.MW[m]] === +m, m + " minutes is called '" + E.MW[m] + "', which means " + WORD[E.MW[m]]);

/* ---------- 3. the digital face ---------- */
for(let h = 1; h <= 12; h++) for(let m = 0; m < 60; m++){
  const d = E.digital(h, m);
  ok(d === h + ":" + String(m).padStart(2, "0"), "digital(" + h + "," + m + ") = " + d);
  ok(/^\d{1,2}:\d{2}$/.test(d), "digital(" + h + "," + m + ") is not h:mm — " + d);
}
ok(E.digital(9, 5) === "9:05", "single-digit minutes must be padded, got " + E.digital(9, 5));

/* ---------- 4. every phrase, parsed back ----------
   Read the sentence the way a child would and work out which time it names. If that is not the
   time it was built from, the clock they set correctly would be marked wrong. */
function parse(phrase){
  let m;
  if((m = /^(\d{1,2}) o'clock$/.exec(phrase))) return { h: +m[1], m: 0 };
  if((m = /^(\S+) past (\d{1,2})$/.exec(phrase)) && m[1] in WORD) return { h: +m[2], m: WORD[m[1]] };
  if((m = /^(\S+) to (\d{1,2})$/.exec(phrase)) && m[1] in WORD){
    const h = +m[2] === 1 ? 12 : +m[2] - 1;          /* "to" names the NEXT hour, so step back */
    return { h, m: 60 - WORD[m[1]] };
  }
  if((m = /^(\d{1,2}) (minute|minutes) past (\d{1,2})$/.exec(phrase))) return { h: +m[3], m: +m[1], plural: m[2] };
  if((m = /^(\d{1,2}) (minute|minutes) to (\d{1,2})$/.exec(phrase))){
    const h = +m[3] === 1 ? 12 : +m[3] - 1;
    return { h, m: 60 - +m[1], plural: m[2] };
  }
  return null;
}
{
  let unreadable = 0, wrong = 0, badPlural = 0, first = null;
  const phrases = new Set();
  for(let h = 1; h <= 12; h++) for(let m = 0; m < 60; m++){
    const p = E.phraseFor(h, m);
    phrases.add(p);
    const got = parse(p);
    if(!got){ unreadable++; if(!first) first = h + ":" + m + " → \"" + p + "\" cannot be read back"; continue; }
    if(got.h !== h || got.m !== m){
      wrong++;
      if(!first) first = h + ":" + String(m).padStart(2, "0") + " → \"" + p + "\", which names "
        + got.h + ":" + String(got.m).padStart(2, "0");
    }
    /* "1 minute past", not "1 minutes past" */
    if(got.plural){
      const n = m < 30 ? m : 60 - m;
      if(got.plural !== (n === 1 ? "minute" : "minutes")){
        badPlural++;
        if(!first) first = "\"" + p + "\" uses the wrong plural for " + n;
      }
    }
  }
  ok(unreadable === 0, unreadable + " phrases could not be read back as a time"
     + (first ? " (" + first + ")" : ""));
  ok(wrong === 0, wrong + " phrases name a different time than the one they were built from"
     + (first ? "\n      first: " + first : ""));
  ok(badPlural === 0, badPlural + " phrases got the minute/minutes plural wrong" + (first ? " (" + first + ")" : ""));
  /* two different times must never share a phrase, or the answer would be ambiguous */
  ok(phrases.size === 720, "12 x 60 times produced only " + phrases.size + " distinct phrases");
}
/* the phrases a child hears most often, spelled out */
for(const [h, m, want] of [
  [3, 0,  "3 o'clock"],
  [3, 15, "quarter past 3"],
  [3, 30, "half past 3"],
  [3, 45, "quarter to 4"],
  [12, 45, "quarter to 1"],          /* the wrap */
  [12, 0, "12 o'clock"],
  [11, 55, "five to 12"],
  [1, 5,  "five past 1"],
  [1, 1,  "1 minute past 1"],        /* singular */
  [1, 59, "1 minute to 2"],
  [6, 35, "twenty-five to 7"],
  [6, 25, "twenty-five past 6"],
]) ok(E.phraseFor(h, m) === want, h + ":" + String(m).padStart(2, "0") + " should read \"" + want
      + "\", got \"" + E.phraseFor(h, m) + "\"");

/* ---------- 5. the times each level deals ---------- */
for(const lv of LV){
  const step = E.LEVELS[lv].step;
  const T = stress(20000);
  let offStep = 0, badHour = 0, badMinute = 0, mismatch = 0, wrongStep = 0;
  const seen = new Set();
  for(let i = 0; i < T; i++){
    const t = E.genTime(lv);
    if(t.hour < 1 || t.hour > 12) badHour++;
    if(t.minute < 0 || t.minute > 59) badMinute++;
    if(step >= 60){ if(t.minute !== 0) offStep++; }
    else if(t.minute % step !== 0) offStep++;
    if(t.step !== step) wrongStep++;
    /* the two faces and the words must all name the same time */
    if(t.digital !== E.digital(t.hour, t.minute) || t.phrase !== E.phraseFor(t.hour, t.minute)) mismatch++;
    const p = parse(t.phrase);
    if(!p || p.h !== t.hour || p.m !== t.minute) mismatch++;
    seen.add(t.hour + ":" + t.minute);
  }
  ok(badHour === 0, lv + ": " + badHour + " times were not a clock hour");
  ok(badMinute === 0, lv + ": " + badMinute + " times had a minute outside 0–59");
  ok(offStep === 0, lv + ": " + offStep + " times were not on this level's " + step + "-minute step");
  ok(wrongStep === 0, lv + ": " + wrongStep + " times carried the wrong step");
  ok(mismatch === 0, lv + ": " + mismatch + " times where the words and the hands disagree");
  /* every time the step allows must be reachable */
  const want = 12 * (step >= 60 ? 1 : 60 / step);
  ok(seen.size === want, lv + ": " + seen.size + " of " + want + " possible times ever came up");
}

report("set-the-clock engine");
