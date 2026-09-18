"use strict";
/* Tally & Chart's engine: tally marks really group into fives, every round is representable
   on its chart's scale, most/least never tie, every question's answer is derivable from the
   counts (recomputed here independently), all four options are distinct, and the phase
   checks report counts — never positions. */
const { loadEngine, mulberry32, tally } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("tally-chart");

const LV = Object.keys(E.LEVELS);
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order");
const want = { EASY:[3,6,"1"], MEDIUM:[4,8,"1"], HARD:[4,12,"2"], EXPERT:[5,20,"2,5"] };
for(const l of LV){ const c = E.LEVELS[l]; ok(c.cats === want[l][0] && c.max === want[l][1] && c.scales.join() === want[l][2], l + ": level table"); }
ok(E.LEVELS.HARD.hideScene && E.LEVELS.EXPERT.hideScene && !E.LEVELS.EASY.hideScene && !E.LEVELS.MEDIUM.hideScene,
   "the picture hides in phase 2 at Hard and Expert only");
ok(E.THEMES.length === 6 && E.THEMES.every(t => t.kinds.length >= 5), "six themes, each with enough kinds for Expert");
/* question types grow level by level */
for(let i = 1; i < LV.length; i++) ok(E.LEVELS[LV[i-1]].qs.every(q => E.LEVELS[LV[i]].qs.includes(q)), LV[i] + " keeps the earlier question types");
ok(E.LEVELS.MEDIUM.qs.includes("more") && E.LEVELS.MEDIUM.qs.includes("fewer"), "Medium adds more/fewer");
ok(E.LEVELS.HARD.qs.includes("total") && E.LEVELS.HARD.qs.includes("combined"), "Hard adds total/combined");
ok(E.LEVELS.EXPERT.qs.includes("multistep"), "Expert adds multi-step");

/* ---- 1. tally marks ---- */
for(let k = 0; k <= 40; k++){
  const svg = E.tallySVG(k);
  const ups = (svg.match(/class="up"/g) || []).length, dgs = (svg.match(/class="dg"/g) || []).length;
  ok(ups + dgs === k, "tally " + k + ": strokes should equal the number (" + (ups + dgs) + ")");
  ok(dgs === Math.floor(k / 5), "tally " + k + ": one diagonal per full five");
  const g = E.tallyGroups(k);
  ok(g.slice(0, -1).every(n => n === 5) && (k === 0 ? g.length === 0 : g[g.length - 1] >= 1 && g[g.length - 1] <= 5),
     "tally " + k + ": fives first, then the rest");
  /* every diagonal crosses the four uprights of its own group */
  const lines = [...svg.matchAll(/<line class="(up|dg)" x1="([\d.-]+)" y1="[\d.-]+" x2="([\d.-]+)"/g)].map(m => ({ t:m[1], a:+m[2], b:+m[3] }));
  for(let gi = 0; gi < Math.floor(k / 5); gi++){
    const grp = lines.filter(l => l.t === "up").slice(gi * 4, gi * 4 + 4), dg = lines.filter(l => l.t === "dg")[gi];
    ok(grp.length === 4 && grp.every(u => u.a > Math.min(dg.a, dg.b) && u.a < Math.max(dg.a, dg.b)),
       "tally " + k + ": diagonal " + gi + " must cross its four uprights");
  }
}

/* ---- 2. independent answer checker ---- */
function derive(q, counts){
  const k = counts.length;
  switch(q.type){
    case "most":  { const m = Math.max(...counts); return "k" + counts.indexOf(m); }
    case "least": { const m = Math.min(...counts); return "k" + counts.indexOf(m); }
    case "howmany": return counts[q.x];
    case "more":  return counts[q.x] - counts[q.y];
    case "fewer": return counts[q.y] - counts[q.x];
    case "total": { let s = 0; for(let i = 0; i < k; i++) s += counts[i]; return s; }
    case "combined": return counts[q.x] + counts[q.y];
    case "multistep": return counts[q.x] - (counts[q.y] + counts[q.z]);
  }
}

/* ---- 3. 5,000 rounds per level ---- */
for(const L of LV){
  const cfg = E.LEVELS[L], rand = mulberry32(40 + L.length);
  let nul = 0, range = 0, scaleBad = 0, tie = 0, wrongAns = 0, dupOpt = 0, nOpts = 0, negAns = 0, repeat = 0, total = 0;
  const types = new Set(), scales = new Set();
  let prev = null;
  for(let t = 0; t < 5000; t++){
    const r = E.genRound(L, rand, prev ? E.sigOf(prev) : null);
    if(!r){ nul++; continue; }
    scales.add(r.scale); types.add(r.question.type);
    if(r.counts.length !== cfg.cats) range++;
    if(r.counts.some(c => c < 1 || c > cfg.max)) range++;
    if(r.counts.some(c => c % r.scale !== 0) || !cfg.scales.includes(r.scale)) scaleBad++;
    if(r.counts.reduce((a, b) => a + b, 0) > cfg.maxTotal) total++;
    const q = r.question;
    if(q.type === "most" || q.type === "least"){
      const ext = q.type === "most" ? Math.max(...r.counts) : Math.min(...r.counts);
      if(r.counts.filter(c => c === ext).length !== 1) tie++;
    }
    const expect = derive(q, r.counts);
    if(q.options[q.answer].value !== expect) wrongAns++;
    if(typeof expect === "number" && expect < 0) negAns++;
    if(q.options.length !== 4) nOpts++;
    if(new Set(q.options.map(o => String(o.value))).size !== 4 || new Set(q.options.map(o => o.label)).size !== 4) dupOpt++;
    if(prev && E.sigOf(prev) === E.sigOf(r)) repeat++;
    prev = r;
  }
  ok(nul === 0, L + ": generation gave up " + nul + " times");
  ok(range === 0, L + ": " + range + " rounds had counts out of range");
  ok(scaleBad === 0, L + ": " + scaleBad + " rounds had a count the chart's scale can't show");
  ok(total === 0, L + ": " + total + " rounds had too many things to count");
  ok(tie === 0, L + ": " + tie + " most/least questions had a tie");
  ok(wrongAns === 0, L + ": " + wrongAns + " questions marked an answer the chart doesn't give");
  ok(negAns === 0, L + ": " + negAns + " questions had a negative answer");
  ok(nOpts === 0 && dupOpt === 0, L + ": every question needs four distinct options (" + nOpts + "/" + dupOpt + ")");
  ok(repeat === 0, L + ": Skip/Next repeated a round " + repeat + " times");
  ok(types.size === cfg.qs.length, L + ": every question type turns up (" + [...types] + ")");
  ok(scales.size === cfg.scales.length, L + ": every scale turns up");
}

/* ---- 4. distractors are mistakes, not random numbers ---- */
{
  const rand = mulberry32(8);
  let random = 0, checked = 0;
  for(let t = 0; t < 3000; t++){
    const r = E.genRound("EXPERT", rand);
    const q = r.question, c = r.counts;
    if(typeof q.options[q.answer].value !== "number") continue;
    const a = q.options[q.answer].value, sums = new Set();
    /* everything a child could plausibly produce from this chart */
    c.forEach((x, i) => { sums.add(x); sums.add(x / r.scale); c.forEach((y, j) => { if(i !== j){ sums.add(x + y); sums.add(Math.abs(x - y)); c.forEach((z, l) => { if(l !== i && l !== j){ sums.add(x - y - z); sums.add(x + y + z); } }); } }); });
    const tot = c.reduce((s, v) => s + v, 0); sums.add(tot); sums.add(tot / r.scale); c.forEach(x => sums.add(tot - x));
    for(let d = -3; d <= 3; d++) sums.add(a + d);
    for(const o of q.options){ checked++; if(!sums.has(o.value)) random++; }
  }
  ok(random === 0, random + " of " + checked + " options were not a plausible mistake");
}

/* ---- 5. phase checks: counts only ---- */
ok(E.leftToCount([true, false, false, true]) === 2, "leftToCount counts the uncounted");
ok(E.leftToCount([true, true]) === 0, "nothing left when all counted");
ok(E.wrongBars([2, 4, 6], [2, 5, 7]) === 2, "wrongBars counts wrong bars");
ok(typeof E.leftToCount([false]) === "number" && typeof E.wrongBars([1], [2]) === "number", "the checks return a number, never positions");
/* bar snapping */
ok(E.snapBar(0, 12, 2) === 0 && E.snapBar(1, 12, 2) === 12 && E.snapBar(.5, 12, 2) === 6, "snapBar ends and middle");
ok(E.snapBar(.55, 20, 5) === 10 && E.snapBar(.65, 20, 5) === 15, "snapBar snaps to the scale");
ok(E.snapBar(1.4, 20, 5) === 20 && E.snapBar(-.3, 20, 5) === 0, "snapBar clamps");
{
  let bad = 0;
  for(let f = 0; f <= 1; f += .01) for(const [top, s] of [[6,1],[8,1],[12,2],[20,2],[20,5]]){ const v = E.snapBar(f, top, s); if(v % s || v < 0 || v > top) bad++; }
  ok(bad === 0, "every snapped bar lands on a gridline");
}
/* stars */
ok(E.starsFor(0) === 3 && E.starsFor(1) === 2 && E.starsFor(2) === 2 && E.starsFor(3) === 1 && E.starsFor(9) === 1, "star rule");

report("tally-chart engine");
