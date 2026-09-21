"use strict";
/* Shopping Adventure fills a shop and asks a child to get as close to the budget as they can.
   The reward is for hitting it exactly, so the shop has to CONTAIN an exact combination — it is
   built by partitioning the budget into item prices, and if that partition ever fails to survive
   into the shelf the perfect basket a child is hunting for does not exist. This test proves it
   the hard way: a subset-sum sweep over every generated shop, asking whether some set of items
   really adds up to the budget. It also checks the discounts, where the shown price and the
   price actually paid are two different numbers that have to agree to the rupee. */
const { loadEngine, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("shopping-adventure");

const LV = Object.keys(E.LEVELS);

/* ---------- 1. the shelf and the levels ---------- */
ok(E.ITEM_POOL.length >= Math.max(...LV.map(l => E.LEVELS[l].count)),
   "the item pool must be big enough to fill the biggest shop without repeating");
ok(new Set(E.ITEM_POOL.map(i => i.name)).size === E.ITEM_POOL.length, "two items share a name");
ok(new Set(E.ITEM_POOL.map(i => i.emoji)).size === E.ITEM_POOL.length, "two items share a picture");
for(const i of E.ITEM_POOL) ok(!!i.name && !!i.emoji, "every item needs a name and a picture");

ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order: " + LV.join(","));
ok(LV.map(l => E.LEVELS[l].label).join(" ") === "🌱 Easy ⭐ Medium 🔥 Hard 🏆 Expert",
   "level labels are the site's four, emoji and name on one line");
for(const lv of LV){
  const c = E.LEVELS[lv];
  ok(c.budget > 0 && c.budget % c.step === 0, lv + ": the budget must be a whole number of steps");
  ok(c.pmin >= c.step && c.pmin % c.step === 0, lv + ": the cheapest price must sit on the step");
  ok(c.pmax > c.pmin && c.pmax % c.step === 0, lv + ": the dearest price must sit on the step and be above the cheapest");
  ok(c.kMax >= c.kMin && c.kMin >= 2, lv + ": the perfect basket must hold at least two things");
  ok(c.count > c.kMax, lv + ": the shop must hold more than the perfect basket, or there is nothing to choose");
  ok(c.discounts >= 0 && c.discounts <= c.count, lv + ": cannot discount more items than the shop holds");
  /* the budget must be reachable: kMin items at pmax must clear it, kMax at pmin must not exceed it */
  ok(c.kMax * c.pmax >= c.budget, lv + ": even " + c.kMax + " of the dearest items cannot reach " + c.budget);
  ok(c.kMin * c.pmin <= c.budget, lv + ": " + c.kMin + " of the cheapest items already exceed " + c.budget);
}
for(let i = 1; i < LV.length; i++){
  const a = E.LEVELS[LV[i-1]], b = E.LEVELS[LV[i]];
  ok(b.budget > a.budget, LV[i] + " should have a bigger budget than " + LV[i-1]);
  ok(b.kMax >= a.kMax, LV[i] + " should allow at least as big a basket as " + LV[i-1]);
  ok(b.discounts >= a.discounts, LV[i] + " should have at least as many discounts as " + LV[i-1]);
}
ok(E.LEVELS.EASY.discounts === 0 && E.LEVELS.MEDIUM.discounts === 0, "Easy and Medium should have no discounts to work out");
ok(E.LEVELS.HARD.discounts > 0 && E.LEVELS.EXPERT.discounts > 0, "Hard and Expert should put discounts on the shelf");

/* ---------- 2. the partition helper ---------- */
for(const lv of LV){
  const c = E.LEVELS[lv];
  for(let k = c.kMin; k <= c.kMax; k++){
    let nulls = 0, bad = 0;
    for(let i = 0; i < stress(500); i++){
      const parts = E.partition(c.budget, k, c.pmin, c.pmax, c.step);
      if(!parts){ nulls++; continue; }
      if(parts.length !== k) bad++;
      if(parts.reduce((a, b) => a + b, 0) !== c.budget) bad++;
      if(parts.some(p => p < c.pmin || p > c.pmax || p % c.step !== 0)) bad++;
    }
    ok(nulls === 0, lv + "/" + k + ": partition failed " + nulls + " times");
    ok(bad === 0, lv + "/" + k + ": " + bad + " partitions did not add up to " + c.budget + " within the price range");
  }
}

/* ---------- 3. the discounts ---------- */
{
  let bad = 0, first = null;
  for(let dprice = 5; dprice <= 200; dprice += 5){
    for(let i = 0; i < stress(50); i++){
      const d = E.makeDiscount(dprice);
      /* the marked-up price, minus the discount, must come back to exactly what you pay */
      const paid = d.type === "pct" ? d.price * (100 - d.amount) / 100 : d.price - d.amount;
      if(paid !== dprice){
        bad++;
        if(!first) first = d.label + " on a ₹" + d.price + " item pays ₹" + paid + ", expected ₹" + dprice;
      }
      if(d.price <= dprice){ bad++; if(!first) first = d.label + " did not make the item cheaper"; }
      if(!Number.isInteger(d.price)){ bad++; if(!first) first = d.label + " gives a fractional price ₹" + d.price; }
      if(!d.label){ bad++; if(!first) first = "a discount with nothing to read"; }
    }
  }
  ok(bad === 0, bad + " discounts did not work out to the price actually paid" + (first ? " (" + first + ")" : ""));
}

/* ---------- 4. every shop holds a perfect basket ----------
   Subset-sum over the prices actually paid. This is the claim the whole game rests on. */
function reachesExactly(values, target){
  const can = new Array(target + 1).fill(false);
  can[0] = true;
  for(const v of values)
    for(let t = target; t >= v; t--) if(can[t - v]) can[t] = true;
  return can[target];
}
for(const lv of LV){
  const c = E.LEVELS[lv];
  const T = stress(3000);
  let nulls = 0, noPerfect = 0, wrongCount = 0, dupNames = 0, offStep = 0, offRange = 0,
      wrongDiscountCount = 0, badPaid = 0, overBudget = 0, first = null;

  for(let i = 0; i < T; i++){
    const shop = E.genShop(lv);
    if(!shop){ nulls++; continue; }
    if(shop.budget !== c.budget) wrongCount++;
    if(shop.items.length !== c.count) wrongCount++;
    if(new Set(shop.items.map(x => x.name)).size !== shop.items.length) dupNames++;

    for(const it of shop.items){
      if(it.dprice % c.step !== 0) offStep++;
      if(it.dprice < c.pmin || it.dprice > c.pmax) offRange++;
      /* nothing on the shelf may cost more than the whole budget — it could never be bought */
      if(it.dprice > c.budget) overBudget++;
      if(it.discount){
        const paid = it.discount.type === "pct" ? it.price * (100 - it.discount.amount) / 100
                                                : it.price - it.discount.amount;
        if(paid !== it.dprice){
          badPaid++;
          if(!first) first = it.name + ": " + it.discount.label + " on ₹" + it.price + " pays ₹" + paid
            + " but the shop says ₹" + it.dprice;
        }
      } else if(it.price !== it.dprice) badPaid++;
    }
    const discounted = shop.items.filter(x => x.discount).length;
    if(discounted !== Math.min(c.discounts, shop.items.length)) wrongDiscountCount++;

    /* THE claim: some basket adds up to the budget exactly */
    if(!reachesExactly(shop.items.map(x => x.dprice), c.budget)){
      noPerfect++;
      if(!first) first = "no basket reaches ₹" + c.budget + " from [" + shop.items.map(x => x.dprice).join(", ") + "]";
    }
  }

  ok(nulls === 0, lv + ": genShop gave up " + nulls + " times");
  ok(wrongCount === 0, lv + ": " + wrongCount + " shops had the wrong budget or the wrong number of items");
  ok(dupNames === 0, lv + ": " + dupNames + " shops sold the same thing twice");
  ok(offStep === 0, lv + ": " + offStep + " prices were not a whole number of ₹" + c.step + " steps");
  ok(offRange === 0, lv + ": " + offRange + " prices fell outside ₹" + c.pmin + "–₹" + c.pmax);
  ok(overBudget === 0, lv + ": " + overBudget + " items cost more than the whole budget");
  ok(wrongDiscountCount === 0, lv + ": " + wrongDiscountCount + " shops had the wrong number of discounts");
  ok(badPaid === 0, lv + ": " + badPaid + " items charged something other than their marked price"
     + (first ? "\n      first: " + first : ""));
  ok(noPerfect === 0, lv + ": " + noPerfect + " of " + T + " shops had NO basket adding up to the budget"
     + (first ? "\n      first: " + first : ""));
}

report("shopping-adventure engine");
