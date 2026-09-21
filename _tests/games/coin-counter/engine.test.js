"use strict";
/* Coin Counter awards ★★★ for paying with "the fewest coins", and it works out what the fewest
   IS with a greedy algorithm — take the biggest coin that fits, repeat. Greedy only gives the
   true minimum for a *canonical* coin system: add a 25 to a set that has 1/5/10, and greedy pays
   30 as 25+5 (2 coins) but 40 as 25+10+5 (3) when 20+20 would do it in 2. Nothing in the game
   would notice; a child who found the real minimum would just be told it wasn't the fewest.
   So the headline test here is a proof, not a spot check: for every level's denominations, and
   every amount well past the range the game can deal, greedy is compared against an exact
   dynamic-programming minimum. The rest checks the generator's promises and the star ladder. */
const { loadEngine, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("coin-counter");

const LV = Object.keys(E.LEVELS);

/* ---------- 1. the level ladder ---------- */
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order: " + LV.join(","));
ok(LV.map(l => E.LEVELS[l].label).join(" ") === "🌱 Easy ⭐ Medium 🔥 Hard 🏆 Expert",
   "level labels are the site's four, emoji and name on one line");
for(const lv of LV){
  const cfg = E.LEVELS[lv];
  ok(cfg.denoms.length > 0, lv + ": needs some money to pay with");
  ok(cfg.denoms.includes(1), lv + ": without a 1 there are amounts that cannot be paid at all");
  ok(cfg.denoms.every(d => Number.isInteger(d) && d > 0), lv + ": every denomination must be a whole number");
  ok(new Set(cfg.denoms).size === cfg.denoms.length, lv + ": a denomination is listed twice");
  ok(cfg.denoms.slice().sort((a, b) => a - b).join() === cfg.denoms.join(), lv + ": denominations should be listed smallest first");
  ok(cfg.tmin >= 1 && cfg.tmax > cfg.tmin, lv + ": the amount range must be a real range");
  ok(!!E.RULES[lv], lv + ": needs a RULES entry saying how much help it gives");
}
/* the ladder: more kinds of money, bigger amounts, less help */
for(let i = 1; i < LV.length; i++){
  const a = E.LEVELS[LV[i-1]], b = E.LEVELS[LV[i]];
  ok(b.denoms.length > a.denoms.length, LV[i] + " should offer more kinds of money than " + LV[i-1]);
  ok(a.denoms.every(d => b.denoms.includes(d)), LV[i] + " should keep everything " + LV[i-1] + " had");
  ok(b.tmax > a.tmax, LV[i] + " should reach bigger amounts than " + LV[i-1]);
}
/* Easy and Medium light the way, Hard and Expert do not (CLAUDE.md "Clues by level") */
ok(!E.RULES.EASY.free && !E.RULES.MEDIUM.free, "Easy and Medium should grey out money that would go over");
ok(E.RULES.HARD.free && E.RULES.EXPERT.free, "Hard and Expert should leave every coin tappable");
ok(!E.RULES.HARD.hideChange && E.RULES.EXPERT.hideChange, "only Expert hides the change amount");
ok(!E.LEVELS.EASY.change && !E.LEVELS.MEDIUM.change, "Easy and Medium pay an amount rather than give change");
ok(E.LEVELS.HARD.change && E.LEVELS.EXPERT.change, "Hard and Expert give change");
for(const lv of ["HARD", "EXPERT"]){
  ok(Array.isArray(E.NOTES_FOR[lv]) && E.NOTES_FOR[lv].length > 0, lv + ": a change level needs notes to be paid with");
  ok(E.NOTES_FOR[lv].every(n => n > E.LEVELS[lv].tmin), lv + ": a note must be worth more than the smallest change");
}

/* ---------- 2. greedy really is the fewest ----------
   An exact minimum by dynamic programming, built once per denomination set, then compared with
   greedyCount at every amount. The bound runs far past the game's own tmax on purpose: it is
   the denomination SET that is or isn't canonical, so proving it here means a later widening of
   tmax cannot quietly break the star rule. */
function exactMin(denoms, upTo){
  const best = new Array(upTo + 1).fill(Infinity);
  best[0] = 0;
  for(let t = 1; t <= upTo; t++)
    for(const d of denoms) if(d <= t && best[t - d] + 1 < best[t]) best[t] = best[t - d] + 1;
  return best;
}
const BOUND = 600;                                   /* > 3x the largest tmax (190) */
for(const lv of LV){
  const { denoms, tmin, tmax } = E.LEVELS[lv];
  const best = exactMin(denoms, BOUND);
  let worse = 0, firstBad = null, badSum = 0, offSet = 0;
  for(let t = 1; t <= BOUND; t++){
    const coins = E.greedyCoins(t, denoms);
    if(!coins){ badSum++; continue; }               /* a 1 is always present, so this cannot happen */
    if(coins.reduce((a, b) => a + b, 0) !== t) badSum++;
    if(coins.some(c => !denoms.includes(c))) offSet++;
    if(coins.length !== best[t]){ worse++; if(firstBad === null) firstBad = t; }
  }
  ok(badSum === 0, lv + ": " + badSum + " amounts where greedyCoins did not add up to the amount");
  ok(offSet === 0, lv + ": " + offSet + " amounts paid with money this level does not have");
  ok(worse === 0, lv + ": greedy is NOT the fewest coins for " + worse + " amounts up to " + BOUND
     + (firstBad === null ? "" : " (first at " + firstBad + ": greedy "
        + E.greedyCount(firstBad, denoms) + ", best " + best[firstBad]
        + ") — the ★★★ rule would punish a child who found the real minimum"));
  /* and the number the game scores against is that same minimum, across its own range */
  let mismatched = 0;
  for(let t = tmin; t <= tmax; t++) if(E.greedyCount(t, denoms) !== best[t]) mismatched++;
  ok(mismatched === 0, lv + ": " + mismatched + " amounts in the level's own range score against the wrong minimum");
}
/* the guard the function itself makes: no 1 means some amounts simply cannot be paid */
ok(E.greedyCoins(3, [2]) === null, "an unpayable amount should come back as null, not a wrong answer");
ok(E.greedyCoins(4, [2]).join() === "2,2", "a payable amount comes back as the coins to pay it with");
ok(E.greedyCoins(0, [1, 2]).length === 0, "zero is paid with no coins at all");

/* ---------- 3. the star ladder ---------- */
for(const optimal of [1, 2, 3, 5, 8]){
  ok(E.starsFor(optimal, optimal).stars === 3, "paying in exactly the fewest (" + optimal + ") earns ★★★");
  ok(E.starsFor(optimal + 1, optimal).stars === 2, optimal + "+1 coins earns ★★");
  ok(E.starsFor(optimal + 2, optimal).stars === 2, optimal + "+2 coins still earns ★★");
  ok(E.starsFor(optimal + 3, optimal).stars === 1, optimal + "+3 coins drops to ★");
  ok(E.starsFor(optimal + 40, optimal).stars === 1, "a wildly long payment still earns ★, never 0");
  /* never more stars for more coins — the ladder only ever goes down */
  let prev = 4;
  for(let n = optimal; n <= optimal + 10; n++){
    const s = E.starsFor(n, optimal).stars;
    ok(s <= prev, "stars must not go UP as the payment gets longer (" + n + " coins)");
    ok(s >= 1 && s <= 3, n + " coins scored " + s + " stars — must be 1..3");
    ok(!!E.starsFor(n, optimal).label, n + " coins: every outcome needs something to say");
    prev = s;
  }
}

/* ---------- 4. the generator ---------- */
for(const lv of LV){
  const cfg = E.LEVELS[lv];
  const N = stress(20000);
  let nulls = 0, offRange = 0, wrongDenoms = 0, tooEasy = 0, unpayable = 0, badOptimal = 0,
      badChange = 0, badNote = 0, badItem = 0, flagsWrong = 0;
  const seen = new Set();
  for(let i = 0; i < N; i++){
    const p = E.genPuzzle(lv);
    if(!p){ nulls++; continue; }
    if(p.level !== lv) flagsWrong++;
    if(p.target < cfg.tmin || p.target > cfg.tmax) offRange++;
    if(p.denoms.join() !== cfg.denoms.join()) wrongDenoms++;
    if(p.change !== cfg.change || p.par !== cfg.par) flagsWrong++;

    const coins = E.greedyCoins(p.target, p.denoms);
    if(!coins) unpayable++;
    else if(p.optimal !== coins.length) badOptimal++;
    /* every level but Easy promises more than a single coin — a one-coin round is not a puzzle */
    if(lv !== "EASY" && p.optimal < 2) tooEasy++;

    if(cfg.change){
      /* the change has to be the real change: what was paid, less what it cost */
      if(p.paid - p.cost !== p.target) badChange++;
      if(!E.NOTES_FOR[lv].includes(p.paid)) badNote++;
      if(p.cost < cfg.tmin || p.cost >= p.paid) badChange++;
      if(!E.ITEMS.includes(p.item)) badItem++;
    } else if(p.cost !== null || p.paid !== null || p.item !== null) badChange++;
    seen.add(p.target);
  }
  ok(nulls === 0, lv + ": genPuzzle gave up " + nulls + " times");
  ok(offRange === 0, lv + ": " + offRange + " amounts fell outside " + cfg.tmin + "–" + cfg.tmax);
  ok(wrongDenoms === 0, lv + ": " + wrongDenoms + " puzzles carried the wrong money");
  ok(unpayable === 0, lv + ": " + unpayable + " amounts could not be paid at all");
  ok(badOptimal === 0, lv + ": " + badOptimal + " puzzles disagreed with their own fewest-coins count");
  ok(tooEasy === 0, lv + ": " + tooEasy + " rounds were payable with a single coin");
  ok(badChange === 0, lv + ": " + badChange + " rounds where the change did not match the price and the note");
  ok(badNote === 0, lv + ": " + badNote + " rounds paid with a note this level does not use");
  ok(badItem === 0, lv + ": " + badItem + " rounds sold something that is not on the shelf");
  ok(flagsWrong === 0, lv + ": " + flagsWrong + " puzzles disagreed with their level's own settings");
  /* the range must actually be used, or the level is narrower than it claims */
  ok(seen.size > 5, lv + ": only " + seen.size + " different amounts ever came up");
}

/* ---------- 5. the shop ---------- */
ok(E.ITEMS.length > 0 && new Set(E.ITEMS).size === E.ITEMS.length, "the shelf needs items, none of them twice");
ok(E.SHOPPERS.length > 0, "someone has to come shopping");
ok(new Set(E.SHOPPERS.map(s => s.e)).size === E.SHOPPERS.length, "two shoppers share a face");
for(const s of E.SHOPPERS)
  ok(!!s.e && !!s.n && /^#[0-9a-fA-F]{6}$/.test(s.bg), "shopper " + s.n + " needs a face, a name and a colour");

report("coin-counter engine");
