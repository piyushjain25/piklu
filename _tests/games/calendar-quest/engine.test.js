"use strict";
/* Calendar Quest is eleven little question generators behind one multiple-choice screen, and
   each one writes its own question text AND its own answer. The failure that matters is the
   quiet one: the wording drifts from the arithmetic and the game starts marking a right answer
   wrong. So this test does not check the generators against themselves — it READS THE QUESTION
   BACK, parses the day, month and date out of the sentences a child actually sees, and
   re-derives the answer from scratch. On top of that: every question must offer four distinct
   options with exactly one of them right, and no other option may also satisfy the question. */
const { loadEngine, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("calendar-quest");

const LV = Object.keys(E.LEVELS);
const dowIdx = d => E.DOW.indexOf(d);
const monIdx = m => E.MONTHS.indexOf(m);
const ordNum = s => { const m = /(\d+)(?:st|nd|rd|th)/.exec(s); return m ? +m[1] : NaN; };

/* ---------- 1. the calendar itself ---------- */
ok(E.DOW.length === 7 && E.DOW[0] === "Sunday", "seven days, starting Sunday");
ok(E.MONTHS.length === 12 && E.MONTHS[0] === "January" && E.MONTHS[11] === "December", "twelve months, January to December");
ok(E.MONTH_DAYS.length === 12, "every month needs a length");
ok(E.MONTH_DAYS.reduce((a, b) => a + b, 0) === 365, "the months should add up to a common year, got " + E.MONTH_DAYS.reduce((a, b) => a + b, 0));
ok(E.MONTH_DAYS[1] === 28, "February is 28 here — the game never deals a leap year");
ok(E.MONTH_DAYS.every(d => [28, 30, 31].includes(d)), "a month must be 28, 30 or 31 days");
/* the two wrap-around helpers, including backwards — that is where an off-by-one hides */
for(let i = 0; i < 7; i++) for(let n = -21; n <= 21; n++){
  const r = E.dowAdd(i, n);
  ok(r >= 0 && r < 7, "dowAdd(" + i + "," + n + ") left the week: " + r);
  ok(r === ((i + n) % 7 + 7) % 7, "dowAdd(" + i + "," + n + ") is wrong");
}
for(let i = 0; i < 12; i++) for(let n = -24; n <= 24; n++){
  const r = E.monthAdd(i, n);
  ok(r >= 0 && r < 12, "monthAdd(" + i + "," + n + ") left the year: " + r);
  ok(r === ((i + n) % 12 + 12) % 12, "monthAdd(" + i + "," + n + ") is wrong");
}
/* ordinals, including the 11/12/13 trap that catches every naive implementation */
for(const [n, want] of [[1,"1st"],[2,"2nd"],[3,"3rd"],[4,"4th"],[10,"10th"],[11,"11th"],[12,"12th"],
                        [13,"13th"],[14,"14th"],[20,"20th"],[21,"21st"],[22,"22nd"],[23,"23rd"],
                        [31,"31st"],[101,"101st"],[111,"111th"],[112,"112th"],[113,"113th"]])
  ok(E.ordinal(n) === want, "ordinal(" + n + ") should be " + want + ", got " + E.ordinal(n));

/* ---------- 2. the levels ---------- */
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order: " + LV.join(","));
ok(LV.map(l => E.LEVELS[l].label).join(" ") === "🌱 Easy ⭐ Medium 🔥 Hard 🏆 Expert",
   "level labels are the site's four, emoji and name on one line");
for(const lv of LV){
  ok(E.LEVELS[lv].kinds.length >= 3, lv + ": needs a few kinds of question so rounds don't repeat");
  ok(new Set(E.LEVELS[lv].kinds).size === E.LEVELS[lv].kinds.length, lv + ": a question kind is listed twice");
}
/* the ladder: Easy's questions must not still be running at Expert */
ok(!E.LEVELS.EXPERT.kinds.some(k => E.LEVELS.EASY.kinds.includes(k)),
   "Expert should share no question kind with Easy");

/* ---------- 3. read the question back, and re-derive its answer ----------
   Each checker returns null when it has nothing to say, or a string naming what is wrong. */
const CHECK = {
  "What Comes Next?": q => {
    const seq = q.lines[0].replace(" → ?", "").split(" → ");
    if(seq.length !== 3) return "expected three items before the ?";
    const days = seq.every(s => dowIdx(s) >= 0);
    const list = days ? E.DOW : E.MONTHS, idx = days ? dowIdx : monIdx;
    if(seq.some(s => idx(s) < 0)) return "an item is neither a day nor a month";
    const step = days ? E.dowAdd : E.monthAdd;
    for(let k = 1; k < 3; k++) if(idx(seq[k]) !== step(idx(seq[0]), k)) return "the run shown is not consecutive";
    const want = list[step(idx(seq[0]), 3)];
    return q.answer === want ? null : "should be " + want;
  },
  "Before & After": q => {
    const m = /right (after|before) (\w+)\?/.exec(q.lines[0]);
    if(!m) return "could not read the prompt";
    const want = E.DOW[E.dowAdd(dowIdx(m[2]), m[1] === "after" ? 1 : -1)];
    return q.answer === want ? null : "should be " + want;
  },
  "Count the Days": q => {
    const from = /Today is (\w+)\./.exec(q.lines[0]);
    const n = /be (\d+) days later/.exec(q.lines[1]);
    if(!from || !n) return "could not read the prompt";
    const want = E.DOW[E.dowAdd(dowIdx(from[1]), +n[1])];
    if(+n[1] % 7 === 0) return "counted a whole number of weeks — the answer is just today again";
    return q.answer === want ? null : "should be " + want;
  },
  "How Many Days?": q => {
    const dc = +/has (\d+) days/.exec(q.lines[0])[1];
    if(E.MONTH_DAYS[monIdx(q.answer)] !== dc) return q.answer + " does not have " + dc + " days";
    const alsoRight = q.options.filter(o => o !== q.answer && E.MONTH_DAYS[monIdx(o)] === dc);
    return alsoRight.length ? "another option is also right: " + alsoRight.join(",") : null;
  },
  "Calendar Facts": q => {
    const known = { "How many days are in a week?": "7", "How many months are in a year?": "12",
                    "Which two days are usually the weekend?": "Saturday and Sunday" };
    const want = known[q.lines[0]];
    if(want === undefined) return "unknown fact question: " + q.lines[0];
    return q.answer === want ? null : "should be " + want;
  },
  "Birthday Countdown": q => {
    const bday = /on (\d+\w\w) (\w+)/.exec(q.lines[0]);
    const today = /Today is (\d+\w\w) (\w+)/.exec(q.lines[1]);
    if(!bday || !today) return "could not read the dates";
    const d2 = ordNum(bday[1]), m2 = monIdx(bday[2]), d1 = ordNum(today[1]), m1 = monIdx(today[2]);
    if(m1 < 0 || m2 < 0) return "an unknown month";
    if(d1 < 1 || d1 > E.MONTH_DAYS[m1] || d2 < 1 || d2 > E.MONTH_DAYS[m2]) return "a date that month does not have";
    /* same month, or the very next one — the birthday is always ahead of today */
    let gap;
    if(m1 === m2){ if(d2 <= d1) return "the birthday is not in the future"; gap = d2 - d1; }
    else if(E.monthAdd(m1, 1) === m2) gap = (E.MONTH_DAYS[m1] - d1) + d2;
    else return "the birthday is more than a month away";
    const want = gap + " day" + (gap === 1 ? "" : "s");
    return q.answer === want ? null : "should be " + want + ", got " + q.answer;
  },
  "Calendar Counting": q => {
    const m = /If the (\d+\w\w) of (\w+) is (\w+), what day is the (\d+\w\w) of (\w+)\?/.exec(q.lines[0]);
    if(!m) return "could not read the prompt";
    const d1 = ordNum(m[1]), mon = monIdx(m[2]), dow = m[3], d2 = ordNum(m[4]);
    if(m[2] !== m[5]) return "the two dates are in different months";
    if(d2 <= d1) return "the second date is not later";
    if(d2 > E.MONTH_DAYS[mon]) return m[2] + " has no " + d2 + "th";
    if((d2 - d1) % 7 !== 0) return "the gap is not a whole number of weeks, so the day would change";
    return q.answer === dow ? null : "should be the same weekday, " + dow;
  },
  "Month Order": q => {
    const shown = q.lines[1].split(" → ");
    const want = shown.slice().sort((a, b) => monIdx(a) - monIdx(b)).join(" → ");
    if(shown.some(s => monIdx(s) < 0)) return "an unknown month";
    if(q.answer !== want) return "should be " + want;
    const alsoRight = q.options.filter(o => o !== q.answer && o === want);
    if(alsoRight.length) return "the right order is offered twice";
    /* the options must all be orderings of the SAME months, or three of them are giveaways */
    const key = shown.slice().sort().join("|");
    const odd = q.options.filter(o => o.split(" → ").sort().join("|") !== key);
    return odd.length ? "an option is not an ordering of the months shown" : null;
  },
  "Month Mystery": q => {
    const after = /I come after (\w+)\./.exec(q.lines[1]);
    const before = /I come before (\w+)\./.exec(q.lines[2]);
    const days = /I have (\d+) days\./.exec(q.lines[3]);
    if(!after || !before || !days) return "could not read the clues";
    const want = E.MONTHS[monIdx(after[1]) + 1];
    if(want !== E.MONTHS[monIdx(before[1]) - 1]) return "the two neighbours do not agree on one month";
    if(E.MONTH_DAYS[monIdx(want)] !== +days[1]) return want + " does not have " + days[1] + " days";
    return q.answer === want ? null : "should be " + want;
  },
};

for(const lv of LV){
  const N = stress(20000);
  let noOptions = 0, dupOptions = 0, answerMissing = 0, answerTwice = 0, noLines = 0, noCategory = 0;
  let wrong = 0, firstWrong = null, uncovered = 0;
  const kinds = new Map();

  for(let i = 0; i < N; i++){
    const q = E.genQuestion(lv);
    if(!q){ noOptions++; continue; }
    if(!q.category) noCategory++;
    if(!q.lines || !q.lines.length || q.lines.some(l => !l)) noLines++;
    if(!q.options || q.options.length !== 4) noOptions++;
    else {
      if(new Set(q.options).size !== 4) dupOptions++;
      const hits = q.options.filter(o => o === q.answer).length;
      if(hits === 0) answerMissing++;
      if(hits > 1) answerTwice++;
    }
    kinds.set(q.category, (kinds.get(q.category) || 0) + 1);
    const check = CHECK[q.category];
    if(!check){ uncovered++; continue; }
    const bad = check(q);
    if(bad){ wrong++; if(!firstWrong) firstWrong = q.category + " — " + bad + " | " + q.lines.join(" / ") + " | answer: " + q.answer; }
  }

  ok(noCategory === 0, lv + ": " + noCategory + " questions had no category");
  ok(noLines === 0, lv + ": " + noLines + " questions had nothing to read");
  ok(noOptions === 0, lv + ": " + noOptions + " questions did not offer exactly four options");
  ok(dupOptions === 0, lv + ": " + dupOptions + " questions repeated an option");
  ok(answerMissing === 0, lv + ": " + answerMissing + " questions did not offer their own answer");
  ok(answerTwice === 0, lv + ": " + answerTwice + " questions offered the answer twice");
  ok(uncovered === 0, lv + ": " + uncovered + " questions came from a category this test does not read back");
  ok(wrong === 0, lv + ": " + wrong + " questions whose text does not match their answer" + (firstWrong ? "\n      first: " + firstWrong : ""));
  /* every kind the level lists must actually be dealt */
  ok(kinds.size >= 2, lv + ": only " + kinds.size + " kind(s) of question ever came up");
}

/* ---------- 4. each generator on its own, including the hardest settings ---------- */
for(const [name, fn, arg] of [
  ["genDowNext", E.genDowNext], ["genDowBefore", E.genDowBefore], ["genMonthNext", E.genMonthNext],
  ["genDowCountForward", E.genDowCountForward, "HARD"], ["genMonthHasDays", E.genMonthHasDays],
  ["genWeekFact", E.genWeekFact], ["genBirthdayCountdown", E.genBirthdayCountdown, "EXPERT"],
  ["genSameWeekdayOffset", E.genSameWeekdayOffset, "EXPERT"], ["genMonthOrder", E.genMonthOrder, "EXPERT"],
  ["genMonthRiddle", E.genMonthRiddle], ["genBirthdayCountdownCrossMonth", E.genBirthdayCountdownCrossMonth],
]){
  let bad = 0, shape = 0, first = null;
  for(let i = 0; i < stress(4000); i++){
    const q = fn(arg);
    if(!q || !q.options || q.options.length !== 4 || new Set(q.options).size !== 4
       || !q.options.includes(q.answer)) { shape++; continue; }
    const msg = CHECK[q.category] ? CHECK[q.category](q) : "no checker for " + q.category;
    if(msg){ bad++; if(!first) first = msg + " | " + q.lines.join(" / ") + " | answer: " + q.answer; }
  }
  ok(shape === 0, name + ": " + shape + " questions were not four distinct options including the answer");
  ok(bad === 0, name + ": " + bad + " questions did not match their own text" + (first ? " (" + first + ")" : ""));
}

report("calendar-quest engine");
