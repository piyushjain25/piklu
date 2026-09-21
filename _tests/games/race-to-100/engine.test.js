"use strict";
/* Race to 100 rolls a die and asks a child to pick + − × or ÷ to land exactly on the target.
   Two things have to be true or the game is unfair. First, the target must always still be
   reachable — the whole game is a walk through the numbers, and a position you can never leave
   is a dead end with no message to say so. Second, Hint has to be right: it is backed by an
   expected-turns table solved by value iteration, and if that table is wrong the coach confidently
   recommends the slower move. This test checks the arithmetic, proves the target is reachable
   from every position the table covers, and re-derives the table's own fixed-point equation. */
const { loadEngine, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("race-to-100");

const LV = Object.keys(E.LEVELS);

/* ---------- 1. the levels ---------- */
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order: " + LV.join(","));
ok(LV.map(l => E.LEVELS[l].label).join(" ") === "🌱 Easy ⭐ Medium 🔥 Hard 🏆 Expert",
   "level labels are the site's four, emoji and name on one line");
for(let i = 1; i < LV.length; i++)
  ok(E.LEVELS[LV[i]].target > E.LEVELS[LV[i-1]].target,
     LV[i] + " should race to a bigger number than " + LV[i-1]);
for(const lv of LV) ok(E.LEVELS[lv].target > 6, lv + ": a target under a die roll is not a race");

/* ---------- 2. the four operations ---------- */
ok(E.OPS.join(",") === "add,sub,mul,div", "four operations: " + E.OPS.join(","));
for(const op of E.OPS) ok(!!E.OP_SYM[op], op + ": needs a symbol to show on the button");
ok(new Set(Object.values(E.OP_SYM)).size === 4, "each operation needs its own symbol");
{
  let bad = 0;
  for(let c = 0; c <= 200; c++) for(let d = 1; d <= 6; d++){
    if(E.opResult(c, "add", d) !== c + d) bad++;
    if(E.opResult(c, "sub", d) !== c - d) bad++;
    if(E.opResult(c, "mul", d) !== c * d) bad++;
    /* ÷ floors — a child sees whole numbers only, and the table depends on that being exact */
    if(E.opResult(c, "div", d) !== Math.floor(c / d)) bad++;
  }
  ok(bad === 0, bad + " operation results disagreed with plain arithmetic");
  ok(E.opResult(7, "div", 2) === 3, "7 ÷ 2 should floor to 3");
  ok(E.opResult(3, "sub", 5) === -2, "subtraction may go below zero — the game rejects it, the arithmetic does not");
  ok(E.opResult(0, "mul", 6) === 0, "0 × anything is 0 — a position the table must still handle");
}
/* the die */
{
  const seen = new Set();
  for(let i = 0; i < stress(20000); i++){
    const d = E.rollDie();
    if(d < 1 || d > 6 || !Number.isInteger(d)) ok(false, "rolled " + d + " — a die shows 1..6");
    seen.add(d);
  }
  ok(seen.size === 6, "all six faces should come up, saw " + seen.size);
}

/* ---------- 3. the target is always reachable ----------
   An independent backwards sweep: mark the target, then repeatedly mark any value from which
   SOME die roll has SOME operation landing on an already-marked value. Anything left unmarked
   is a position a child could be stuck in forever. */
function reachableSet(target, tab){
  const good = new Array(tab + 1).fill(false);
  good[target] = true;
  for(let pass = 0; pass < tab + 2; pass++){
    let changed = false;
    for(let v = 0; v <= tab; v++){
      if(good[v]) continue;
      for(let d = 1; d <= 6 && !good[v]; d++)
        for(const op of E.OPS){
          const x = E.opResult(v, op, d);
          if(Number.isInteger(x) && x >= 0 && x <= tab && good[x]){ good[v] = true; changed = true; break; }
        }
    }
    if(!changed) break;
  }
  return good;
}
for(const lv of LV){
  const target = E.LEVELS[lv].target;
  E.ensureE(target);
  const { TAB, E: arr, eTarget } = E.table();
  ok(eTarget === target, lv + ": the table was not built for this target");
  ok(TAB === target * 2, lv + ": the table should run to twice the target, got " + TAB);
  ok(arr.length === TAB + 1, lv + ": the table is the wrong length");
  ok(arr[target] === 0, lv + ": standing on the target should cost 0 more turns, got " + arr[target]);

  const good = reachableSet(target, TAB);
  const stuck = [];
  for(let v = 0; v <= TAB; v++) if(!good[v]) stuck.push(v);
  ok(stuck.length === 0, lv + ": " + stuck.length + " positions can never reach " + target
     + (stuck.length ? " (e.g. " + stuck.slice(0, 8).join(",") + ")" : ""));

  /* a reachable position must have a finite expected cost, and vice versa */
  let mismatch = 0;
  for(let v = 0; v <= TAB; v++) if(good[v] && !(arr[v] < 120)) mismatch++;
  ok(mismatch === 0, lv + ": " + mismatch + " reachable positions were scored as hopeless by the table");

  /* the table must satisfy its own equation: E[v] = 1 + average over the six die faces of the
     best reachable E. Re-derived here rather than trusting value iteration converged. */
  let offBy = 0, worst = 0;
  for(let v = 0; v <= TAB; v++){
    if(v === target) continue;
    let acc = 0;
    for(let d = 1; d <= 6; d++){
      let best = Infinity;
      for(const op of E.OPS){
        const x = E.opResult(v, op, d);
        if(Number.isInteger(x) && x >= 0 && x <= TAB && arr[x] < best) best = arr[x];
      }
      acc += best === Infinity ? 120 : best;
    }
    const want = 1 + acc / 6;
    const err = Math.abs(want - arr[v]);
    worst = Math.max(worst, err);
    if(err > 1e-6) offBy++;
  }
  ok(offBy === 0, lv + ": the expected-turns table does not satisfy its own equation at " + offBy
     + " positions (worst error " + worst.toExponential(2) + ")");
}

/* ---------- 4. Hint never recommends a worse move ---------- */
for(const lv of LV){
  const target = E.LEVELS[lv].target;
  E.ensureE(target);
  const { TAB, E: arr } = E.table();
  let worse = 0, landed = 0, illegal = 0, missedWin = 0, first = null;

  for(let v = 0; v <= TAB; v++){
    if(v === target) continue;
    for(let d = 1; d <= 6; d++){
      const m = E.bestMove(v, d, target);
      if(!E.OPS.includes(m.op)){ illegal++; continue; }
      if(m.result !== E.opResult(v, m.op, d)) landed++;

      /* no other operation may have a strictly better expected cost */
      for(const op of E.OPS){
        const x = E.opResult(v, op, d);
        const e = (Number.isInteger(x) && x >= 0 && x <= TAB) ? arr[x] : 1e6;
        if(e < m.E - 1e-9){
          worse++;
          if(!first) first = "at " + v + " rolling " + d + ": Hint says " + m.op + " (E=" + m.E.toFixed(3)
            + ") but " + op + " gives E=" + e.toFixed(3);
          break;
        }
      }
      /* and if some operation lands exactly on the target, Hint must take it */
      const wins = E.OPS.filter(op => E.opResult(v, op, d) === target);
      if(wins.length && m.result !== target){
        missedWin++;
        if(!first) first = "at " + v + " rolling " + d + ": " + wins[0] + " wins outright, Hint said " + m.op;
      }
    }
  }
  ok(illegal === 0, lv + ": Hint suggested something that is not one of the four operations " + illegal + " times");
  ok(landed === 0, lv + ": Hint's stated result did not match its own operation " + landed + " times");
  ok(worse === 0, lv + ": Hint recommended a worse move at " + worse + " positions"
     + (first ? " (" + first + ")" : ""));
  ok(missedWin === 0, lv + ": Hint passed up an outright win " + missedWin + " times"
     + (first ? " (" + first + ")" : ""));
}

/* ---------- 5. the table is rebuilt only when the target changes ---------- */
{
  E.ensureE(50);
  const a = E.table().E;
  E.ensureE(50);
  ok(E.table().E === a, "asking for the same target again should reuse the table, not rebuild it");
  E.ensureE(100);
  ok(E.table().E !== a && E.table().eTarget === 100, "a new target must build a new table");
  /* a value off the end of the table is hopeless, not a crash */
  ok(E.Elook(-1) === 1e6 && E.Elook(1e9) === 1e6, "a value outside the table should read as hopeless");
}

report("race-to-100 engine");
