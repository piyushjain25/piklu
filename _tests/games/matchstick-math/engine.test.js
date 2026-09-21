"use strict";
/* Matchstick Math shows a sum that is wrong and promises it can be fixed by moving exactly one
   stick. If that is ever untrue the child is stuck on an impossible puzzle with no way to tell
   — the board looks the same either way. So the headline test generates thousands of puzzles
   per level and, for each, sweeps EVERY legal one-stick move to confirm at least one lands on a
   true equation, then checks that the move Hint offers is really one of them. Underneath that:
   the seven-segment digits must round-trip, the expression evaluator must agree with real
   arithmetic (× before + −) and refuse the malformed strings a half-moved board produces, and
   the × and = sticks must be impossible to pick up. */
const { loadEngine, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("matchstick-math");

const LV = ["EASY", "MEDIUM", "HARD", "EXPERT"];

/* ---------- 1. the seven-segment alphabet ---------- */
ok(Object.keys(E.DIGIT_ON).length === 10, "all ten digits need a segment pattern");
for(const d in E.DIGIT_ON){
  const segs = E.DIGIT_ON[d];
  ok(segs.length > 0, d + ": a digit must light at least one segment");
  ok([...segs].every(c => E.DIGIT_SEGS[c]), d + ": lights a segment that does not exist");
  ok(new Set(segs).size === segs.length, d + ": lights the same segment twice");
  /* the reverse lookup must bring the digit back — this is what decodeCell reads a board with */
  ok(E.SEG2DIGIT[[...segs].sort().join("")] === d, d + ": does not decode back to itself");
}
ok(new Set(Object.values(E.DIGIT_ON).map(s => [...s].sort().join(""))).size === 10,
   "two digits share a segment pattern — the board would be ambiguous");
/* the stick count per digit is what makes the puzzle work at all */
for(const d in E.DIGIT_ON) ok(E.DIGIT_ON[d].length >= 2 && E.DIGIT_ON[d].length <= 7,
  d + " uses " + E.DIGIT_ON[d].length + " sticks — outside 2..7");
/* every segment is a real line, not a point */
for(const name of [["digit", E.DIGIT_SEGS], ["op", E.OP_SEGS], ["x", E.OPX_SEGS], ["eq", E.EQ_SEGS]])
  for(const seg in name[1]){
    const [x1, y1, x2, y2] = name[1][seg];
    ok([x1, y1, x2, y2].every(Number.isFinite), name[0] + "/" + seg + ": a coordinate is not a number");
    ok(x1 !== x2 || y1 !== y2, name[0] + "/" + seg + ": a stick of zero length");
  }

/* ---------- 2. the evaluator ---------- */
function oracle(tokens){
  /* × binds tighter, then + and − left to right — written out rather than eval()'d */
  if(!tokens.length || tokens.length % 2 === 0) return null;
  for(let i = 0; i < tokens.length; i++){
    if(i % 2 === 0){ if(!/^\d+$/.test(tokens[i])) return null; if(tokens[i].length > 1 && tokens[i][0] === "0") return null; }
    else if(!["+", "-", "*"].includes(tokens[i])) return null;
  }
  const terms = [+tokens[0]], ops = [];
  for(let i = 1; i < tokens.length; i += 2){
    if(tokens[i] === "*") terms[terms.length - 1] *= +tokens[i + 1];
    else { ops.push(tokens[i]); terms.push(+tokens[i + 1]); }
  }
  let r = terms[0];
  for(let k = 0; k < ops.length; k++) r = ops[k] === "+" ? r + terms[k + 1] : r - terms[k + 1];
  return r;
}
for(const t of [["7"], ["1","+","2"], ["9","-","4"], ["3","*","4"], ["2","+","3","*","4"],
                ["3","*","4","+","2"], ["9","-","2","-","3"], ["12","+","34"], ["2","*","3","*","4"]])
  ok(E.evalExprSafe(t) === oracle(t), t.join(" ") + " → " + E.evalExprSafe(t) + ", expected " + oracle(t));
ok(E.evalExprSafe(["2","+","3","*","4"]) === 14, "× must bind tighter than +, got " + E.evalExprSafe(["2","+","3","*","4"]));
ok(E.evalExprSafe(["9","-","2","-","3"]) === 4, "− runs left to right, got " + E.evalExprSafe(["9","-","2","-","3"]));
/* the malformed strings a half-moved board really produces */
for(const t of [[], ["+"], ["1","+"], ["1","2"], ["1","+","+","2"], ["01","+","2"], ["1","=","2"], ["1","+","02"]])
  ok(E.evalExprSafe(t) === null, "[" + t.join(" ") + "] should be rejected, got " + E.evalExprSafe(t));
ok(E.evalExprSafe(["0","+","5"]) === 5, "a bare 0 is a fine number — only a LEADING zero is rejected");

/* ---------- 3. reading a board back ---------- */
{
  /* lay out a known equation and confirm it reads as itself */
  for(const [tokens, display, truth] of [
    [["2","+","2","=","4"], "2+2=4", true],
    [["2","+","2","=","5"], "2+2=5", false],
    [["3","*","4","=","1","2"], "3×4=12", true],
    [["9","-","8","=","1"], "9-8=1", true],
  ]){
    const F = E.layout(E.tokensToCells(tokens));
    const dec = E.decodeEquation(F);
    ok(dec.valid, tokens.join("") + " should lay out as a readable board");
    ok(dec.display === display, tokens.join("") + " displays as " + dec.display + ", expected " + display);
    ok(dec.ok === truth, tokens.join("") + " should read as " + truth);
  }
  /* a board with a segment missing from a digit must be unreadable, not silently something else */
  const F = E.layout(E.tokensToCells(["8","+","1","=","9"]));
  const broken = new Set(F); broken.delete("0-a");
  const dec = E.decodeEquation(broken);
  ok(!dec.valid || dec.display !== "8+1=9", "removing a stick from the 8 must change what the board says");
  /* an empty digit cell reads as nothing at all */
  const blank = new Set([...F].filter(id => !id.startsWith("0-")));
  ok(!E.decodeEquation(blank).valid, "a digit with no sticks at all is not a readable board");
}

/* ---------- 4. the moves ---------- */
{
  const F = E.layout(E.tokensToCells(["3","*","4","=","1","2"]));
  const { fixed } = E.board();
  ok(fixed.size > 0, "the × and = sticks should be fixed in place");
  const moves = E.singleMoves(F);
  ok(moves.length > 0, "there should be moves available");
  let movedFixed = 0, wrongCount = 0, noop = 0, notPresent = 0, occupied = 0;
  for(const m of moves){
    if(fixed.has(m.from) || fixed.has(m.to)) movedFixed++;
    if(m.set.size !== F.size) wrongCount++;                 /* a move never adds or drops a stick */
    if(m.from === m.to) noop++;
    if(!F.has(m.from)) notPresent++;                        /* you can only move a stick that is there */
    if(F.has(m.to)) occupied++;                             /* and only onto an empty slot */
  }
  ok(movedFixed === 0, movedFixed + " moves picked up a fixed × or = stick");
  ok(wrongCount === 0, wrongCount + " moves changed the number of sticks on the board");
  ok(noop === 0, noop + " moves put a stick back where it came from");
  ok(notPresent === 0, notPresent + " moves took a stick from an empty slot");
  ok(occupied === 0, occupied + " moves dropped a stick onto an occupied slot");
  /* every move must be reachable back: the set difference is exactly one out, one in */
  for(const m of moves.slice(0, 50)){
    const removed = [...F].filter(id => !m.set.has(id));
    const added = [...m.set].filter(id => !F.has(id));
    ok(removed.length === 1 && added.length === 1 && removed[0] === m.from && added[0] === m.to,
       "a move should be exactly one stick out and one in");
  }
}

/* ---------- 5. every generated puzzle is wrong, and one move from right ---------- */
for(const lv of LV){
  const T = stress(2000);
  let unreadable = 0, alreadyTrue = 0, unsolvable = 0, hintWrong = 0, hintNotOne = 0, first = null;
  const seen = new Set();

  for(let t = 0; t < T; t++){
    const p = E.generatePuzzle(lv);
    const dec = E.decodeEquation(p.start);

    /* the board a child is shown must READ as a sum, and read as a WRONG one */
    if(!dec.valid){ unreadable++; continue; }
    if(dec.ok){ alreadyTrue++; if(!first) first = "already true: " + dec.display; continue; }
    seen.add(dec.display);

    /* THE claim: sweep every legal single move and find one that lands on a true equation */
    const fixes = E.singleMoves(p.start).filter(m => {
      const d = E.decodeEquation(m.set);
      return d.valid && d.ok;
    });
    if(!fixes.length){ unsolvable++; if(!first) first = "no one-stick fix for: " + dec.display; continue; }

    /* and Hint must offer one of exactly those */
    const hint = E.findSolution(p.start);
    if(!hint){ hintWrong++; if(!first) first = "Hint had nothing for: " + dec.display; continue; }
    const after = E.decodeEquation(hint.set);
    if(!after.valid || !after.ok){
      hintWrong++;
      if(!first) first = "Hint's move on " + dec.display + " gives " + (after.valid ? after.display : "an unreadable board");
    }
    if(hint.set.size !== p.start.size) hintNotOne++;
  }

  ok(unreadable === 0, lv + ": " + unreadable + " of " + T + " puzzles were not a readable sum");
  ok(alreadyTrue === 0, lv + ": " + alreadyTrue + " puzzles were already correct — nothing to fix"
     + (first ? " (" + first + ")" : ""));
  ok(unsolvable === 0, lv + ": " + unsolvable + " puzzles could NOT be fixed by moving one stick"
     + (first ? " (" + first + ")" : ""));
  ok(hintWrong === 0, lv + ": Hint gave a move that does not fix the sum " + hintWrong + " times"
     + (first ? " (" + first + ")" : ""));
  ok(hintNotOne === 0, lv + ": Hint changed the number of sticks " + hintNotOne + " times");
  ok(seen.size > 20, lv + ": only " + seen.size + " different sums ever came up");
}

/* ---------- 6. the sums each level builds are real sums ---------- */
for(const lv of LV){
  let bad = 0, first = null;
  const shapes = new Set();
  for(let t = 0; t < stress(4000); t++){
    const tokens = E.makeTrue(lv);
    const ei = tokens.indexOf("=");
    if(ei < 0){ bad++; continue; }
    const L = [], R = [];
    let cur = "";
    for(let i = 0; i < tokens.length; i++){
      const tk = tokens[i], side = i < ei ? L : R;
      if(tk === "=") continue;
      if(/^\d$/.test(tk)) cur += tk;
      else { if(cur){ side.push(cur); cur = ""; } side.push(tk); }
      if(i + 1 === ei || i + 1 === tokens.length){ if(cur){ side.push(cur); cur = ""; } }
    }
    const lv2 = oracle(L), rv = oracle(R);
    if(lv2 === null || rv === null || lv2 !== rv){
      bad++;
      if(!first) first = tokens.join("") + " (" + lv2 + " vs " + rv + ")";
    }
    /* whatever it builds, the board must be able to show it: single digits only, 0-9 */
    if(tokens.some(tk => !/^[0-9+\-*=]$/.test(tk))){ bad++; if(!first) first = "unshowable token in " + tokens.join(""); }
    shapes.add(L.filter(x => "+-*".includes(x)).join("|") + "=" + R.length);
  }
  ok(bad === 0, lv + ": makeTrue built " + bad + " equations that are not true or not showable"
     + (first ? " (" + first + ")" : ""));
  ok(shapes.size > 0, lv + ": makeTrue built nothing");
}

report("matchstick-math engine");
