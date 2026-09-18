"use strict";
/* Headless play-through of Coin Counter. Easy/Medium: money that would go over is greyed out
   and refused, and Pay only lights up on the exact amount. Hard/Expert: every coin stays
   tappable, the player can go over, Pay always looks the same, a wrong payment is refused
   without ending the round (and caps the stars at two), and Expert never shows the change.
   Every round has an animal shopper, and with motion on the paid money flies to them before
   the thank-you. */
const { bootGame, tally, sleep } = require("../../lib/harness.js");
const { ok, report } = tally();

(async () => {
for (const reducedMotion of [true, false]) {
  const tag = reducedMotion ? "[reduced] " : "[motion] ";
  const { w, d, $ } = bootGame("coin-counter", { reducedMotion, seed: 7, onError: e => ok(false, "page error: " + e.message) });
  const P = () => w.eval("P");
  const tray = v => d.querySelector('#tray .money[data-denom="' + v + '"]');
  const vis = id => !$(id).classList.contains("hide") && !$(id).classList.contains("invisible");
  const greedy = (T, ds) => { const out = []; for (const x of ds.slice().sort((a, b) => b - a)) while (T >= x) { out.push(x); T -= x; } return out; };
  function switchTo(L) { $("q-level").click(); d.querySelector('#level-menu .level-opt[data-diff="' + L + '"]').click(); }
  async function settle() { if (!reducedMotion) await sleep(1600); }

  $("start-btn").click();
  for (const L of ["EASY", "MEDIUM", "HARD", "EXPERT"]) {
    if (L !== "EASY") switchTo(L);
    for (let round = 0; round < 6; round++) {
      const p = P(), free = L === "HARD" || L === "EXPERT";
      ok(p.level === L, tag + L + ": puzzle is at this level");
      ok($("shopper-face").textContent.trim().length > 0, tag + L + ": an animal shopper is shown");
      const goal = $("goal").textContent;
      if (L === "EXPERT") ok(!goal.includes("₹" + p.target + " change") && goal.includes("₹" + p.paid) && goal.includes("₹" + p.cost),
        tag + "EXPERT: price and payment shown, change amount hidden");
      else ok(goal.includes("₹" + p.target), tag + L + ": target shown in the bubble");

      /* overshoot with the biggest denomination that goes over */
      const big = p.denoms.slice().sort((a, b) => b - a).find(x => x > p.target) || null;
      if (free) {
        ok(!$("pay-btn").disabled && !$("pay-btn").classList.contains("ready"), tag + L + ": Pay is live and neutral with an empty pile");
        ok(![...d.querySelectorAll("#tray .money")].some(b => b.classList.contains("disabled")), tag + L + ": no coin is greyed out");
        // go over on purpose: add the target's greedy set plus one ₹1
        for (const x of greedy(p.target, p.denoms)) tray(x).click();
        tray(1).click();
        ok(w.eval("total()") === p.target + 1, tag + L + ": can go over the target");
        ok(!$("pay-btn").classList.contains("ready"), tag + L + ": Pay looks the same when wrong");
        $("pay-btn").click();
        ok(w.eval("phase") === "build" && $("feedback").classList.contains("bad"), tag + L + ": a wrong payment is refused, round continues");
        if (L === "EXPERT") ok(!$("feedback").textContent.includes("₹" + p.target), tag + "EXPERT: the refusal doesn't reveal the change");
        d.querySelector('#pile .money[data-denom="1"]').click();
      } else {
        if (big) { tray(big).click(); ok(w.eval("total()") === 0 && tray(big).classList.contains("disabled"), tag + L + ": money that goes over is greyed and refused"); }
        ok($("pay-btn").disabled, tag + L + ": Pay disabled until exact");
        for (const x of greedy(p.target, p.denoms)) tray(x).click();
        ok($("pay-btn").classList.contains("ready"), tag + L + ": Pay lights up when exact");
      }
      ok(w.eval("total()") === p.target, tag + L + ": exact amount built");
      $("pay-btn").click();
      ok(w.eval("phase") === "result" && vis("next-btn") && $("skip-btn").classList.contains("invisible"), tag + L + ": Pay → Next in place, Skip hidden");
      const stars = ($("stars").textContent.match(/★/g) || []).length;
      ok(stars === (free ? 2 : 3), tag + L + ": " + (free ? "a wrong try caps at ★★" : "fewest coins earns ★★★") + " (got " + stars + ")");
      await settle();
      ok(/thank|star|wow|yay|perfect/i.test($("goal").querySelector(".make").textContent), tag + L + ": the shopper says thanks");
      ok(!d.querySelector(".flyer"), tag + L + ": no flying coins left behind");
      $("next-btn").click();
      ok(w.eval("phase") === "build" && !d.querySelector(".flyer"), tag + L + ": Next starts a fresh round");
    }
  }
  /* Next mid-animation must not leave clones or a stale thank-you */
  if (!reducedMotion) {
    const p = P(); for (const x of greedy(p.target, p.denoms)) tray(x).click(); $("pay-btn").click();
    $("next-btn").click(); await sleep(1600);
    ok(!d.querySelector(".flyer") && !$("goal").querySelector(".make").classList.contains("thanks"), tag + "Next mid-animation cleans up");
  }
}
report("coin-counter play-through");
})();
