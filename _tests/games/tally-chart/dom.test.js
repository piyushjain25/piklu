"use strict";
/* Headless play-through of Tally & Chart: every level, all three phases, through the UI —
   including a wrong try at each phase (rejected, counted, never located), phase-aware
   Reset/Hint, Reset going .invisible in the question phase, the win putting Next ▶ in the
   bottom slot, and the level chip starting a fresh round at phase 1. */
const { bootGame, loadEngine, tally, sleep } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("tally-chart");

const { w, d, $ } = bootGame("tally-chart", { onError: e => ok(false, "page error: " + e.message) });
const vis = id => !$(id).classList.contains("hide");
const items = () => [...d.querySelectorAll("#scene .item")];
const cols = () => [...d.querySelectorAll("#plot .col")];
const phaseNum = () => $("phase-num").textContent;
const tallyNums = () => [...d.querySelectorAll("#tallies .tn")].map(e => +e.textContent);
const barVal = c => +c.getAttribute("aria-valuenow");
const levelKey = () => ({ "🌱 Easy":"EASY", "⭐ Medium":"MEDIUM", "🔥 Hard":"HARD", "🏆 Expert":"EXPERT" })[$("q-level-label").textContent];
const key = (el, k) => el.dispatchEvent(new w.KeyboardEvent("keydown", { key:k, bubbles:true }));
/* raise or lower a bar with the keyboard until it reads v */
function setBarTo(c, v){ for(let g = 0; g < 40 && barVal(c) !== v; g++) key(c, barVal(c) < v ? "ArrowUp" : "ArrowDown"); }
/* read the chart the way a child does: the numbers on it, then the question */
function solveQuestion(){
  const q = $("qtext").textContent, vals = cols().map(barVal);
  const ems = [...d.querySelectorAll("#xaxis .xlab")].map(e => e.textContent);
  const opts = [...d.querySelectorAll("#opts .opt")];
  const named = ems.filter(em => q.includes(em)).sort((a, b) => q.indexOf(a) - q.indexOf(b)).map(em => vals[ems.indexOf(em)]);
  let a;
  if(/most\?/.test(q)) a = ems[vals.indexOf(Math.max(...vals))];
  else if(/fewest\?/.test(q)) a = ems[vals.indexOf(Math.min(...vals))];
  else if(/\btogether\?/.test(q)) a = named[0] - named[1] - named[2];
  else if(/How many more/.test(q)) a = named[0] - named[1];
  else if(/How many fewer/.test(q)) a = named[1] - named[0];
  else if(/counted altogether/.test(q)) a = vals.reduce((s, v) => s + v, 0);
  else if(/altogether/.test(q)) a = named[0] + named[1];
  else a = named[0];
  const right = opts.findIndex(o => typeof a === "string" ? o.textContent.startsWith(a) : o.textContent === String(a));
  return { right, wrong:opts.findIndex((o, i) => i !== right && !o.disabled) };
}

(async () => {
ok(d.querySelector(".home-top .hub-link").getAttribute("href") === "../", "← All games on the start screen");
$("start-btn").click();
ok(vis("screen-game") && !$("screen-game").querySelector(".hub-link"), "Start shows the game, without the hub link");

for(const L of ["EASY", "MEDIUM", "HARD", "EXPERT"]){
  if(levelKey() !== L){
    /* move into phase 2 first, to prove the chip really restarts at phase 1 */
    items().forEach(b => b.click()); $("count-btn").click();
    ok(phaseNum() === "2 of 3", L + ": (setup) reached phase 2 before switching");
    $("q-level").click();
    d.querySelector('#level-menu .level-opt[data-diff="' + L + '"]').click();
    ok(vis("screen-game"), L + ": switching level stays in the game");
    ok(phaseNum() === "1 of 3" && items().every(b => !b.classList.contains("counted")), L + ": the chip starts a fresh round at phase 1");
  }
  const cfg = E.LEVELS[L];
  ok(cols().length === cfg.cats && $("tallies").children.length === cfg.cats, L + ": " + cfg.cats + " kinds");

  /* ---- phase 1 ---- */
  ok(vis("count-btn") && !vis("chart-btn") && !vis("next-btn"), L + ": phase 1 shows Done counting");
  ok(!$("reset-btn").classList.contains("invisible"), L + ": Reset is there in phase 1");
  const all = items();
  all.slice(0, 3).forEach(b => b.click());
  all[0].click();                                        /* un-count one */
  ok(!all[0].classList.contains("counted") && all[1].classList.contains("counted"), L + ": tapping counts, tapping again un-counts");
  $("count-btn").click();
  const left = all.length - 2;
  ok(phaseNum() === "1 of 3", L + ": phase 1 won't clear with things uncounted");
  ok($("feedback").textContent.includes(String(left)), L + ": says how many are left (" + left + "): " + $("feedback").textContent);
  ok(!/row|column|left side|top|corner/i.test($("feedback").textContent), L + ": never says where");
  $("hint-link").click();
  ok(d.querySelectorAll("#scene .item.hinted:not(.counted)").length === 1, L + ": Hint highlights one uncounted thing");
  $("reset-btn").click();
  ok(items().every(b => !b.classList.contains("counted")) && tallyNums().every(n => n === 0), L + ": Reset un-counts everything");
  items().forEach(b => b.click());
  /* the tally matches the picture, and the strokes match the numbers */
  const tn = tallyNums();
  ok(tn.reduce((a, b) => a + b, 0) === items().length, L + ": every thing lands in a tally");
  [...d.querySelectorAll("#tallies svg.tally")].forEach((s, k) =>
    ok(s.querySelectorAll("line").length === tn[k] && s.querySelectorAll("line.dg").length === Math.floor(tn[k] / 5), L + ": tally strokes for " + tn[k]));
  $("count-btn").click();
  ok(phaseNum() === "2 of 3", L + ": phase 1 clears");
  ok(d.getElementById("owl-game").classList.contains("happy"), L + ": owl happy on a phase cleared");

  /* ---- phase 2 ---- */
  ok(!vis("count-btn") && vis("chart-btn") && !vis("next-btn"), L + ": Check chart takes the bottom slot");
  ok(vis("scene") === !cfg.hideScene, L + ": the picture " + (cfg.hideScene ? "hides" : "stays") + " in phase 2");
  ok(vis("tallies"), L + ": the tally stays visible beside the chart");
  const sc = +$("scale-note").querySelector("b").textContent;
  ok(cfg.scales.includes(sc), L + ": the scale note shows the gridline value (" + sc + ")");
  ok(d.querySelectorAll("#yaxis .ylab").length === cfg.max / sc + 1, L + ": one axis label per gridline");
  const t = tallyNums();
  setBarTo(cols()[0], t[0] === sc ? 2 * sc : sc);        /* one wrong on purpose */
  cols().slice(1).forEach((c, k) => setBarTo(c, t[k + 1]));
  $("chart-btn").click();
  ok(phaseNum() === "2 of 3", L + ": a wrong chart doesn't clear");
  ok(/^1 bar isn't right/.test($("feedback").textContent), L + ": says how many bars are wrong: " + $("feedback").textContent);
  ok(!d.querySelector("#tallies .tn").textContent.includes("✗") && !d.querySelector(".col.bad"), L + ": never marks which bar");
  $("reset-btn").click();
  ok(cols().every(c => barVal(c) === 0), L + ": Reset sets every bar back to 0");
  $("hint-link").click();
  ok(cols().filter((c, k) => barVal(c) === t[k]).length === 1, L + ": Hint sets exactly one bar right");
  cols().forEach((c, k) => setBarTo(c, t[k]));
  ok(cols().every((c, k) => barVal(c) % sc === 0), L + ": bars move in steps of the scale");
  $("chart-btn").click();
  ok(phaseNum() === "3 of 3", L + ": phase 2 clears");

  /* ---- phase 3 ---- */
  ok(!vis("scene") && !vis("tallies") && vis("chart-view") && vis("q-view"), L + ": phase 3 shows the chart and the question");
  ok($("reset-btn").classList.contains("invisible"), L + ": Reset is .invisible in the question phase");
  ok(vis("next-btn") && $("next-btn").classList.contains("invisible"), L + ": Next holds the slot, invisibly, during the question");
  ok(d.querySelectorAll("#opts .opt").length === 4, L + ": four options");
  const s = solveQuestion();
  ok(s.right >= 0, L + ": the answer can be read off the chart (" + $("qtext").textContent + ")");
  d.querySelectorAll("#opts .opt")[s.wrong].click();
  ok(!$("result-view").classList.contains("hide") === false && $("next-btn").classList.contains("invisible"), L + ": a wrong answer is rejected");
  ok(d.querySelectorAll("#opts .opt")[s.wrong].disabled, L + ": the wrong option is crossed off");
  ok(d.getElementById("owl-game").classList.contains("worried"), L + ": owl worried on a wrong answer");
  $("hint-link").click();
  const gone = d.querySelectorAll("#opts .opt.gone");
  ok(gone.length === 1 && [...d.querySelectorAll("#opts .opt")].indexOf(gone[0]) !== s.right, L + ": Hint eliminates one WRONG option");
  d.querySelectorAll("#opts .opt")[s.right].click();
  ok(!$("next-btn").classList.contains("invisible") && vis("next-btn"), L + ": the win puts Next ▶ in the bottom slot");
  ok($("skip-btn").classList.contains("invisible"), L + ": Skip hides with .invisible on the win");
  ok($("stars").textContent === "★☆☆", L + ": three hints this round = ★, got " + $("stars").textContent);
  ok(d.getElementById("owl-game").classList.contains("win"), L + ": owl wins");

  /* Next: a clean round is ★★★ */
  const before = [...d.querySelectorAll("#xaxis .xlab")].map(e => e.textContent).join() + tallyNums().join();
  $("next-btn").click();
  ok(phaseNum() === "1 of 3" && !$("skip-btn").classList.contains("invisible"), L + ": Next starts a fresh round at phase 1");
  items().forEach(b => b.click()); $("count-btn").click();
  cols().forEach((c, k) => setBarTo(c, tallyNums()[k]));
  $("chart-btn").click();
  d.querySelectorAll("#opts .opt")[solveQuestion().right].click();
  ok($("stars").textContent === "★★★", L + ": no hints = ★★★");
  $("next-btn").click();
  $("skip-btn").click();
  ok(phaseNum() === "1 of 3", L + ": Skip starts a new round at phase 1");
}

$("home-btn").click();
ok(vis("screen-home"), "Home returns to the start screen");
report("tally-chart play-through");
})();
