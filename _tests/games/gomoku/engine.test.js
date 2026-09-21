"use strict";
/* gomoku engine: the rules (five in a row, captures, every ending) checked against an
   independent oracle across thousands of random games, the owl's narrowed alpha-beta proved
   equal to a plain minimax over the same candidates, its tactics checked exhaustively against
   a brute-force sweep of the whole board, and games between the levels to show the owls are
   ordered by strength and EASY stays beatable. */
const { loadEngine, mulberry32, tally, stress } = require("../../lib/harness.js");
const E = loadEngine("gomoku");
const { ok, report } = tally();
const { EMPTY, YOU, OWL, LEVELS, WIN, CAP_WIN, CAP_PAIRS, other } = E;

/* ---- independent oracles (not copies: written from the rules, not the engine) ----------- */
/* five or more of p's stones in a row, anywhere on the board */
function oracleFive(b, p, n) {
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      let k = 0;
      while (k < 5) {
        const rr = r + k * dr, cc = c + k * dc;
        if (rr < 0 || rr >= n || cc < 0 || cc >= n || b[rr * n + cc] !== p) break;
        k++;
      }
      if (k === 5) return true;
    }
  return false;
}
/* custodial capture, written straight from the rule: in each of the eight directions, exactly
   two of the opponent's stones and then one of yours */
function oracleCaptures(b, m, p, n) {
  const q = other(p), out = [], r = (m / n) | 0, c = m % n;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const at = k => {
      const rr = r + k * dr, cc = c + k * dc;
      return rr < 0 || rr >= n || cc < 0 || cc >= n ? -1 : b[rr * n + cc];
    };
    if (at(1) === q && at(2) === q && at(3) === p)
      out.push((r + dr) * n + (c + dc), (r + 2 * dr) * n + (c + 2 * dc));
  }
  return out.sort((x, y) => x - y);
}
/* five or more through one spot, counted out from it — the same rule read locally, so the
   sweeps below can afford to ask it about every empty spot on the board */
function oracleFiveAt(b, m, p, n) {
  const r = (m / n) | 0, c = m % n;
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    let len = 1;
    for (const sd of [1, -1]) {
      for (let k = 1; ; k++) {
        const rr = r + dr * sd * k, cc = c + dc * sd * k;
        if (rr < 0 || rr >= n || cc < 0 || cc >= n || b[rr * n + cc] !== p) break;
        len++;
      }
    }
    if (len >= 5) return true;
  }
  return false;
}
/* the board after p plays m, worked out with the oracle's own capture rule */
function oraclePlay(b, m, p, rules, n) {
  const taken = rules === "capture" ? oracleCaptures(b, m, p, n) : [];
  const nb = b.slice();
  nb[m] = p;
  for (const i of taken) nb[i] = EMPTY;
  return { b: nb, taken };
}
/* every move that ends the game for p — swept over the WHOLE board, not just near a stone */
function oracleWins(b, caps, p, rules, n) {
  const out = [];
  for (let m = 0; m < b.length; m++) {
    if (b[m] !== EMPTY) continue;
    const taken = rules === "capture" ? oracleCaptures(b, m, p, n) : [];
    if (oracleFiveAt(b, m, p, n) || caps[p] + taken.length >= CAP_WIN) out.push(m);
  }
  return out;
}

/* a random position reached by legal play, with no winner yet */
function randomPosition(rng, level, plies) {
  for (;;) {
    let s = E.newGame(level);
    for (let i = 0; i < plies && !E.isOver(s); i++) {
      /* mostly near the other stones, so positions look like real games */
      const pool = rng() < .85 ? E.nearMoves(s.board, s.n, 2) : E.legalMoves(s.board);
      s = E.applyMove(s, pool[Math.floor(rng() * pool.length)]);
    }
    if (!E.isOver(s)) return s;
  }
}

/* ---- 1. the level table ------------------------------------------------------------------ */
ok(JSON.stringify(Object.keys(LEVELS)) === '["EASY","MEDIUM","EXPERT"]', "three levels in order");
ok([9, 11, 13].every((n, i) => Object.values(LEVELS)[i].n === n), "boards grow 9 → 11 → 13");
for (const [k, L] of Object.entries(LEVELS)) ok(L.n % 2 === 1, k + "'s board has a middle square to open on");
ok(["EASY", "MEDIUM"].every(k => LEVELS[k].rules === "classic"), "EASY/MEDIUM are plain five in a row");
ok(LEVELS.EXPERT.rules === "capture", "EXPERT adds captures");
ok(LEVELS.EASY.owl === "gentle" && LEVELS.MEDIUM.slip > 0 && LEVELS.MEDIUM.depth < LEVELS.EXPERT.depth,
   "MEDIUM looks less far than EXPERT, and slips");
ok(!LEVELS.EXPERT.slip && LEVELS.EXPERT.depth >= 4 && LEVELS.EXPERT.nodes > 0 && LEVELS.EXPERT.cand > 0,
   "the EXPERT owl searches a trimmed list under a node budget");

/* ---- 2. the windows of five --------------------------------------------------------------- */
for (const n of [9, 11, 13]) {
  const g = E.geom(n), dirs = { "0,1": 0, "1,0": 0, "1,1": 0, "1,-1": 0 }, keys = new Set();
  for (const w of g.wins) {
    const rc = w.map(i => [(i / n) | 0, i % n]);
    const dr = rc[1][0] - rc[0][0], dc = rc[1][1] - rc[0][1];
    ok(w.every(i => i >= 0 && i < n * n), n + ": window inside the board");
    ok(rc.every(([r, c], k) => r === rc[0][0] + k * dr && c === rc[0][1] + k * dc), n + ": window is 5 in a line");
    dirs[dr + "," + dc]++;
    keys.add(w.join());
  }
  /* n*(n-4) across and the same up, (n-4)² on each diagonal */
  const flat = n * (n - 4), diag = (n - 4) * (n - 4);
  ok(dirs["0,1"] === flat && dirs["1,0"] === flat && dirs["1,1"] === diag && dirs["1,-1"] === diag,
     n + "×" + n + ": " + JSON.stringify(dirs) + " should be " + flat + "/" + flat + "/" + diag + "/" + diag);
  ok(keys.size === g.wins.length, n + ": no window listed twice");
  ok(g.byCell.every((ws, i) => ws.every(w => w.includes(i))), n + ": byCell only lists windows through that cell");
  ok(g.byCell.reduce((t, ws) => t + ws.length, 0) === g.wins.length * 5, n + ": every window is filed under its five cells");
}

/* ---- 3. illegal moves are refused --------------------------------------------------------- */
{
  let s = E.newGame("EASY");
  for (const m of [-1, 1.5, 81, 999, NaN, "3", null, undefined]) ok(E.applyMove(s, m) === null, "refuses move " + m);
  s = E.applyMove(s, 40);
  ok(s.board[40] === YOU && s.turn === OWL, "your stone goes down and the turn passes");
  ok(E.applyMove(s, 40) === null, "a taken spot refuses another stone");
  let w = E.newGame("EASY");
  for (let k = 0; k < 5; k++) { w = E.applyMove(w, 4 * 9 + k); if (w.winner) break; w = E.applyMove(w, k); }
  ok(w.winner === YOU && w.line.length === 5, "five in a row across wins, and the five light up");
  ok(E.applyMove(w, 80) === null, "no more moves once the game is over");
}

/* ---- 4. five in a row, against the oracle ------------------------------------------------- */
{
  const rng = mulberry32(11);
  let checked = 0, bad = 0, seenFive = 0;
  for (let t = 0; t < stress(2000); t++) {
    const n = [9, 11, 13][t % 3];
    const b = Array.from({ length: n * n }, () => (rng() < .35 ? (rng() < .5 ? YOU : OWL) : EMPTY));
    for (const p of [YOU, OWL]) {
      const want = oracleFive(b, p, n);
      if (want) seenFive++;
      if (E.hasFive(b, p, n) !== want) bad++;
      checked++;
    }
  }
  ok(bad === 0, "hasFive matches the oracle on " + checked + " random boards (" + bad + " wrong)");
  ok(seenFive > 0, "the random boards really do contain fives (" + seenFive + ")");
}
/* makesFive, on its own, straight against a fresh scan */
{
  const rng = mulberry32(29);
  let bad = 0, hits = 0, tried = 0;
  for (let t = 0; t < stress(400); t++) {
    const n = [9, 11, 13][t % 3];
    const b = Array.from({ length: n * n }, () => (rng() < .4 ? (rng() < .5 ? YOU : OWL) : EMPTY));
    const empties = [];
    for (let m = 0; m < b.length; m++) if (b[m] === EMPTY) empties.push(m);
    for (let k = 0; k < 8 && empties.length; k++) {
      const m = empties[Math.floor(rng() * empties.length)];
      for (const p of [YOU, OWL]) {
        /* the oracle looks at the whole board, so only ask where p had no five already */
        if (oracleFive(b, p, n)) continue;
        const nb = b.slice();
        nb[m] = p;
        const want = oracleFive(nb, p, n);
        if (want) hits++;
        tried++;
        if (E.makesFive(b, m, p, n) !== want) bad++;
      }
    }
  }
  ok(bad === 0, "makesFive matches the oracle on " + tried + " placements (" + bad + " wrong)");
  ok(hits > 0, "those placements really do make fives (" + hits + ")");
}
/* runsOf: maximal, five or longer, and the union is what the page lights up */
{
  const rng = mulberry32(31);
  let bad = 0, overlines = 0;
  for (let t = 0; t < stress(600); t++) {
    const n = 9;
    const b = Array.from({ length: n * n }, () => (rng() < .45 ? (rng() < .5 ? YOU : OWL) : EMPTY));
    for (const p of [YOU, OWL]) {
      const runs = E.runsOf(b, p, n);
      for (const run of runs) {
        if (run.length > 5) overlines++;
        if (run.length < 5) bad++;
        if (!run.every(i => b[i] === p)) bad++;
        const rc = run.map(i => [(i / n) | 0, i % n]);
        const dr = rc[1][0] - rc[0][0], dc = rc[1][1] - rc[0][1];
        if (!rc.every(([r, c], k) => r === rc[0][0] + k * dr && c === rc[0][1] + k * dc)) bad++;
        /* maximal: neither end may carry on */
        for (const [end, sd] of [[rc[0], -1], [rc[rc.length - 1], 1]]) {
          const rr = end[0] + dr * sd, cc = end[1] + dc * sd;
          if (rr >= 0 && rr < n && cc >= 0 && cc < n && b[rr * n + cc] === p) bad++;
        }
      }
      if (!!runs.length !== oracleFive(b, p, n)) bad++;
      const line = E.lineCells(b, p, n);
      if (line.length !== new Set(runs.flat()).size) bad++;
    }
  }
  ok(bad === 0, "runsOf returns maximal runs of five or more (" + bad + " wrong, " + overlines + " of them overlines)");
}
/* freestyle: six in a row is a win too, and the whole overline lights up */
{
  const n = 9, six = E.emptyBoard(n);
  for (let c = 1; c <= 6; c++) six[3 * n + c] = YOU;
  ok(E.hasFive(six, YOU, n), "six in a row counts as a win");
  const runs = E.runsOf(six, YOU, n);
  ok(runs.length === 1 && runs[0].length === 6, "the overline is one run of six, not two of five");
  ok(E.lineCells(six, YOU, n).length === 6, "all six light up");
  let s = E.newGame("EASY");
  for (let c = 1; c <= 6; c++) { s = E.applyMove(s, 3 * n + c); if (s.winner) break; s = E.applyMove(s, 8 * n + c); }
  ok(s.winner === YOU && s.line.length === 5, "the fifth stone ends it before a sixth is ever played");
}

/* ---- 5. captures, against the oracle ------------------------------------------------------ */
{
  const n = 13, at = (r, c) => r * n + c;
  const b = E.emptyBoard(n);
  b[at(6, 7)] = OWL; b[at(6, 8)] = OWL; b[at(6, 6)] = YOU;
  ok(E.capturesAt(b, at(6, 9), YOU, n).sort().join() === [at(6, 7), at(6, 8)].sort().join(),
     "closing a sandwich takes exactly the two stones inside it");
  ok(E.capturesAt(b, at(6, 9), OWL, n).length === 0, "the owl takes nothing by joining its own stones");
  const three = E.emptyBoard(n);
  three[at(2, 3)] = YOU; three[at(2, 4)] = OWL; three[at(2, 5)] = OWL; three[at(2, 6)] = OWL;
  ok(E.capturesAt(three, at(2, 7), YOU, n).length === 0, "three in a row is safe — only pairs are taken");
  const gap = E.emptyBoard(n);
  gap[at(4, 4)] = OWL; gap[at(4, 7)] = OWL; gap[at(4, 5)] = YOU;
  ok(E.capturesAt(gap, at(4, 6), YOU, n).length === 0 && E.capturesAt(gap, at(4, 6), OWL, n).length === 0,
     "walking into the gap between two of theirs captures nobody");
  /* it is the CLOSING stone that captures, so walking into an open pair of jaws is safe */
  const jaws = E.emptyBoard(n);
  jaws[at(0, 1)] = OWL; jaws[at(0, 4)] = OWL; jaws[at(0, 2)] = YOU;
  ok(E.place(jaws, at(0, 3), YOU, "capture", n).taken.length === 0,
     "filling the last gap between two of the owl's stones captures nothing");
  const jaws2 = E.emptyBoard(n);
  jaws2[at(0, 1)] = OWL; jaws2[at(0, 2)] = YOU; jaws2[at(0, 3)] = YOU;
  ok(E.place(jaws2, at(0, 4), OWL, "capture", n).taken.length === 2,
     "the owl closing the sandwich itself does take both");
  const dbl = E.emptyBoard(n);
  dbl[at(5, 6)] = OWL; dbl[at(5, 7)] = OWL; dbl[at(5, 8)] = YOU;
  dbl[at(6, 5)] = OWL; dbl[at(7, 5)] = OWL; dbl[at(8, 5)] = YOU;
  ok(E.capturesAt(dbl, at(5, 5), YOU, n).length === 4, "one stone can close two sandwiches at once");
  /* and never in the classic rules */
  let c = E.newGame("MEDIUM");
  c = E.applyMove(c, at(6, 6)); c = E.applyMove(c, at(6, 7));
  c = E.applyMove(c, at(0, 0)); c = E.applyMove(c, at(6, 8));
  c = E.applyMove(c, at(6, 9));
  ok(c.last.taken.length === 0 && c.board[at(6, 7)] === OWL, "classic levels never capture");

  const rng = mulberry32(43);
  let bad = 0, taken = 0;
  for (let t = 0; t < stress(1500); t++) {
    const bb = Array.from({ length: n * n }, () => (rng() < .5 ? (rng() < .5 ? YOU : OWL) : EMPTY));
    const m = Math.floor(rng() * bb.length);
    bb[m] = EMPTY;
    for (const p of [YOU, OWL]) {
      const want = oracleCaptures(bb, m, p, n);
      const got = E.capturesAt(bb, m, p, n).sort((x, y) => x - y);
      taken += want.length;
      if (got.join() !== want.join()) bad++;
    }
  }
  ok(bad === 0, "capturesAt matches the oracle on random boards (" + bad + " wrong, " + taken + " stones taken)");
}

/* ---- 6. random games against the oracle: every ending, and the game always ends ----------- */
function checkGames(level, games, rng) {
  const rules = LEVELS[level].rules, n = LEVELS[level].n, cells = n * n;
  let bad = 0, wins = 0, draws = 0, capWins = 0, longest = 0, pairs = 0;
  for (let g = 0; g < games; g++) {
    let s = E.newGame(level);
    let guard = 0;
    while (!E.isOver(s) && guard++ < cells + 64) {
      const b = s.board, p = s.turn;
      const moves = E.legalMoves(b);
      if (moves.length !== b.filter(v => v === EMPTY).length) bad++;
      const m = moves[Math.floor(rng() * moves.length)];
      const { b: want, taken } = oraclePlay(b, m, p, rules, n);
      const next = E.applyMove(s, m);
      if (next.board.join() !== want.join()) bad++;
      if (next.last.taken.slice().sort((x, y) => x - y).join() !== taken.join()) bad++;
      if (next.caps[p] !== s.caps[p] + taken.length) bad++;
      if (next.caps[other(p)] !== s.caps[other(p)]) bad++;
      if (next.turn !== other(p)) bad++;
      /* only the player who just moved can win */
      const winner = oracleFive(want, p, n) || next.caps[p] >= CAP_WIN ? p : 0;
      if (next.winner !== winner) bad++;
      if (oracleFive(want, other(p), n)) bad++;                     /* never possible */
      if (!winner && want.indexOf(EMPTY) < 0 && next.draw !== "full") bad++;
      if (winner && next.draw) bad++;
      if (next.winner && !next.line.length && next.caps[next.winner] < CAP_WIN) bad++;
      s = next;
    }
    if (!E.isOver(s)) { bad++; continue; }
    longest = Math.max(longest, s.moves);
    pairs += (s.caps[YOU] + s.caps[OWL]) / 2;
    if (s.winner) { wins++; if (!s.line.length) capWins++; } else draws++;
    /* every captured stone frees exactly one extra move, so this is the whole bound */
    if (s.moves > cells + s.caps[YOU] + s.caps[OWL]) bad++;
    if (s.caps[YOU] % 2 || s.caps[OWL] % 2) bad++;
    /* the side that did not win never got to five pairs */
    if (s.winner && s.caps[other(s.winner)] >= CAP_WIN) bad++;
  }
  return { bad, wins, draws, capWins, longest, pairs };
}
{
  const r1 = checkGames("EASY", stress(300), mulberry32(5));
  ok(r1.bad === 0, "classic: " + (r1.wins + r1.draws) + " random games match the oracle (" + r1.bad + " slips)");
  ok(r1.wins > 0 && r1.draws >= 0, "classic random games reach an ending (" + r1.wins + " wins, " + r1.draws + " ties)");
  const r2 = checkGames("EXPERT", stress(200), mulberry32(6));
  ok(r2.bad === 0, "capture: " + (r2.wins + r2.draws) + " random games match the oracle (" + r2.bad + " slips)");
  ok(r2.pairs > 20, "captures really happen in random play (" + r2.pairs + " pairs taken)");
  ok(r2.longest <= 13 * 13 + 32, "even with captures a game is finite (longest " + r2.longest + " moves)");
  console.log("  random games — classic: " + r1.wins + "W/" + r1.draws + "T, capture: " + r2.wins + "W/"
    + r2.draws + "T of which " + r2.capWins + " won on pairs, " + r2.pairs + " pairs taken");
}

/* ---- 7. the owl never misses a win, and never misses that it is about to lose ------------- */
{
  const rng = mulberry32(17);
  let bad = 0, withWin = 0, positions = 0;
  for (const level of ["MEDIUM", "EXPERT"]) {
    const rules = LEVELS[level].rules, n = LEVELS[level].n;
    for (let t = 0; t < stress(300); t++) {
      const s = randomPosition(rng, level, 8 + Math.floor(rng() * 40));
      positions++;
      for (const p of [YOU, OWL]) {
        /* the sweep looks at every empty spot; the engine only looks next to a stone */
        const want = oracleWins(s.board, s.caps, p, rules, n);
        const got = E.winningMoves(s.board, s.caps, p, rules, n).sort((x, y) => x - y);
        if (got.join() !== want.join()) bad++;
        if (want.length) withWin++;
      }
      /* a hint always takes a win, and blocks the only losing spot when there is one */
      const mine = E.winningMoves(s.board, s.caps, s.turn, rules, n);
      const hint = E.hintMove(s, rng);
      if (mine.length && !mine.includes(hint)) bad++;
      if (!mine.length) {
        const theirs = E.winningMoves(s.board, s.caps, other(s.turn), rules, n);
        if (theirs.length === 1 && hint !== theirs[0]) bad++;
      }
      if (!E.isLegal(s.board, hint)) bad++;
    }
  }
  ok(bad === 0, "winningMoves and the hint agree with a full-board sweep on " + positions + " positions (" + bad + " wrong)");
  ok(withWin > 0, "those positions really do hold wins on the spot (" + withWin + ")");
}
/* gifts(): the same question one move later */
{
  const rng = mulberry32(19);
  let bad = 0, gifted = 0;
  for (let t = 0; t < stress(150); t++) {
    const level = t % 2 ? "EXPERT" : "MEDIUM";
    const s = randomPosition(rng, level, 10 + Math.floor(rng() * 30));
    const rules = s.rules, n = s.n, p = s.turn;
    for (const m of E.topMoves(s.board, p, rules, n, 6)) {
      const { b: nb, taken } = oraclePlay(s.board, m, p, rules, n);
      const nc = s.caps.slice();
      nc[p] += taken.length;
      const won = oracleFiveAt(nb, m, p, n) || nc[p] >= CAP_WIN;
      const want = !won && oracleWins(nb, nc, other(p), rules, n).length > 0;
      if (E.gifts(s.board, s.caps, p, rules, n, m) !== want) bad++;
      if (want) gifted++;
    }
  }
  ok(bad === 0, "gifts() spots a move that hands over a win (" + bad + " wrong, " + gifted + " gifts seen)");
}

/* ---- 8. alpha-beta = plain minimax over the same candidates ------------------------------- */
/* a plain minimax, no pruning and no ordering, over the engine's own candidate lists */
function minimax(b, caps, p, depth, rules, n, cand, rad) {
  const moves = E.topMoves(b, p, rules, n, cand, rad);
  if (!moves.length) return 0;
  let best = -Infinity;
  for (const m of moves) best = Math.max(best, childMinimax(b, caps, p, m, depth, rules, n, cand));
  return best;
}
function childMinimax(b, caps, p, m, depth, rules, n, cand) {
  const { b: nb, taken } = oraclePlay(b, m, p, rules, n);
  const nc = caps.slice();
  nc[p] += taken.length;
  if (oracleFiveAt(nb, m, p, n) || nc[p] >= CAP_WIN) return WIN + depth;
  if (nb.indexOf(EMPTY) < 0) return 0;
  if (depth <= 1) return E.evaluate(nb, p, n, nc);
  return -minimax(nb, nc, other(p), depth - 1, rules, n, cand, 1);
}
{
  const rng = mulberry32(23);
  let bad = 0, runs = 0, wins = 0;
  for (let t = 0; t < stress(120); t++) {
    const level = t % 3 === 2 ? "EXPERT" : "MEDIUM";
    const s = randomPosition(rng, level, 6 + Math.floor(rng() * 26));
    const cand = 5, depth = 2 + (t % 2);
    const want = minimax(s.board, s.caps, s.turn, depth, s.rules, s.n, cand, 2);
    const got = E.searchRoot(s.board, s.caps, s.turn, s.rules, s.n, depth, { nodes: 0, limit: Infinity, cand });
    runs++;
    if (got.best !== want) bad++;
    if (Math.abs(want) >= WIN) wins++;
    /* a best move's exact value is the search's value */
    for (const m of got.bestMoves)
      if (childMinimax(s.board, s.caps, s.turn, m, depth, s.rules, s.n, cand) !== want) bad++;
  }
  ok(bad === 0, "alpha-beta equals plain minimax on " + runs + " positions (" + bad + " differ)");
  ok(wins > 0, "some of those searches saw a forced result (" + wins + ")");
}

/* ---- 9. the node budget really caps the thinking ------------------------------------------ */
{
  const rng = mulberry32(37);
  let over = 0, deep = 0;
  for (let t = 0; t < stress(40); t++) {
    const s = randomPosition(rng, "EXPERT", 10 + Math.floor(rng() * 30));
    for (const budget of [50, 400, 3000]) {
      const r = E.deepSearch(s.board, s.caps, s.turn, s.rules, s.n, 8, budget, 10);
      if (r.nodes > budget + 1) over++;
      if (r.depth >= 2) deep++;
      if (!r.bestMoves.length || !E.isLegal(s.board, r.bestMoves[0])) over++;
    }
  }
  ok(over === 0, "deepSearch stays inside its node budget and always returns a legal move");
  ok(deep > 0, "and still gets past the first ply (" + deep + " searches)");
  /* every level's owl answers on any position, and its move is legal */
  const rng2 = mulberry32(41);
  let bad = 0;
  for (const level of ["EASY", "MEDIUM", "EXPERT"])
    for (let t = 0; t < stress(20); t++) {
      const s = randomPosition(rng2, level, 4 + Math.floor(rng2() * 24));
      if (!E.isLegal(s.board, E.owlMove(s, rng2))) bad++;
    }
  ok(bad === 0, "every owl plays a legal move");
}

/* ---- 10. the owls are ordered by strength ------------------------------------------------- */
/* a move from an owl setting, on any position (its own level's rules come from the state) */
function owlPick(spec, s, rng) {
  if (spec.owl === "gentle") return E.gentleMove(s.board, s.caps, s.turn, s.rules, s.n, rng);
  if (spec.owl === "careful") return E.carefulMove(s.board, s.caps, s.turn, s.rules, s.n, rng);
  if (spec.slip && rng() < spec.slip) return E.carefulMove(s.board, s.caps, s.turn, s.rules, s.n, rng);
  return E.deepSearch(s.board, s.caps, s.turn, s.rules, s.n, spec.depth, spec.nodes, spec.cand).bestMoves[0];
}
/* How much an owl setting gives away: over one shared set of positions, the gap between the
   best move's value and the one it played, judged by a search deeper than any owl's own, so
   no level is measured against itself. One blunder is capped, so the average is not one game
   in disguise, and the gap never counts below zero — the reference looks at a narrower list of
   spots than the owls do, so a move it never weighed up is no evidence of a blunder. A sharper
   owl gives away less — that is the whole ranking. */
const REF = { depth: 8, cand: 6 }, CLAMP = 20000;
function giveaway(spec, positions, refs, seed) {
  const rng = mulberry32(seed);
  let loss = 0;
  positions.forEach((s, i) => {
    const m = owlPick(spec, s, rng);
    const v = E.childValue(s.board, s.caps, s.turn, m, REF.depth, -Infinity, Infinity, s.rules, s.n,
                           { nodes: 0, limit: Infinity, cand: REF.cand });
    loss += Math.max(0, Math.min(refs[i] - v, CLAMP));
  });
  return Math.round(loss / positions.length);
}
{
  const rng = mulberry32(99);
  const positions = Array.from({ length: stress(24) },
    () => randomPosition(rng, "MEDIUM", 6 + Math.floor(rng() * 30)));
  const refs = positions.map(s => E.searchRoot(s.board, s.caps, s.turn, s.rules, s.n, REF.depth,
    { nodes: 0, limit: Infinity, cand: REF.cand }).best);
  const g = {};
  for (const [name, spec] of [["EASY", LEVELS.EASY], ["careful", { owl: "careful" }], ["MEDIUM", LEVELS.MEDIUM],
                              ["EXPERT", LEVELS.EXPERT]])
    g[name] = giveaway(spec, positions, refs, 7);
  ok(g.EASY > 2 * g.MEDIUM, "EASY gives away far more than MEDIUM (" + g.EASY + " vs " + g.MEDIUM + ")");
  ok(g.MEDIUM > 4 * g.EXPERT, "MEDIUM gives away far more than EXPERT (" + g.MEDIUM + " vs " + g.EXPERT + ")");
  ok(g.EXPERT * 4 < g.MEDIUM, "the EXPERT owl is in the top class too (" + g.EXPERT + " vs MEDIUM's " + g.MEDIUM + ")");
  ok(g.EASY > g.careful, "EASY is looser than plain careful play (" + g.EASY + " vs " + g.careful + ")");
  console.log("  give-away per move (smaller is sharper): " + JSON.stringify(g));
}

/* and the levels really do beat each other over whole games */
function duel(A, B, n, rules, rng) {
  let s = { level: "EXPERT", n, rules, board: E.emptyBoard(n), turn: YOU, winner: 0, draw: null,
            line: [], last: null, caps: [0, 0, 0], moves: 0 };
  s = E.applyMove(s, ((n - 1) >> 1) * n + ((n - 1) >> 1));           /* a fixed opening move … */
  const near = E.nearMoves(s.board, n, 1);
  s = E.applyMove(s, near[Math.floor(rng() * near.length)]);         /* … then a random reply */
  while (!E.isOver(s)) s = E.applyMove(s, owlPick(s.turn === YOU ? A : B, s, rng));
  return s.winner === YOU ? 1 : s.winner === OWL ? -1 : 0;
}
function match(A, B, n, rules, games, seed) {
  const rng = mulberry32(seed);
  let a = 0, b = 0, t = 0;
  for (let g = 0; g < games; g++) {
    /* swap sides every other game, so going first is shared out evenly */
    const r = g % 2 ? -duel(B, A, n, rules, rng) : duel(A, B, n, rules, rng);
    if (r > 0) a++; else if (r < 0) b++; else t++;
  }
  return { a, b, t };
}
{
  const m1 = match(LEVELS.MEDIUM, LEVELS.EASY, 9, "classic", stress(12), 101);
  ok(m1.a > m1.b, "MEDIUM beats EASY over whole games (" + m1.a + "-" + m1.b + "-" + m1.t + ")");
  /* EASY stays beatable: careful play — what the Hint gives a child — wins the match */
  const m2 = match({ owl: "careful" }, LEVELS.EASY, 9, "classic", stress(10), 404);
  ok(m2.a > m2.b, "careful play beats EASY (" + m2.a + "-" + m2.b + "-" + m2.t + ") — the sleepy owl stays beatable");
  /* the capture rules play out too: a whole EXPERT game, both sides at full strength */
  const rng = mulberry32(55);
  let capGames = 0, capWins = 0;
  for (let i = 0; i < stress(4); i++) {
    let s = E.newGame("EXPERT");
    while (!E.isOver(s)) s = E.applyMove(s, E.owlMove(s, rng));
    capGames++;
    if (s.winner && !s.line.length) capWins++;
    ok(s.moves <= s.n * s.n + s.caps[YOU] + s.caps[OWL], "an EXPERT game between two owls ends");
  }
  console.log("  matches — MEDIUM/EASY " + JSON.stringify(m1) + "  careful/EASY " + JSON.stringify(m2)
    + "  EXPERT self-play: " + capGames + " games, " + capWins + " won on pairs");
}

report("gomoku engine");
