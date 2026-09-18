"use strict";
/* Engine proofs for games/tic-tac-toe.
   - Easy/Medium: the solver agrees with an independent brute-force minimax on EVERY
     reachable position, and the owl at blunder 0 can never be beaten by any line of play.
   - Hard: the ORIGINAL disappearing rules (therenotthere.com) — the oldest mark goes BEFORE
     the line check, so nobody ever has more than 3 marks and a fading mark can't finish a
     line; three repeats of a position is a tie. The backwards solve is checked against its
     own fixpoint conditions on every one of its ~116k positions.
   - Expert: ultimate tic-tac-toe — the sending rule, free moves, claimed and drawn boards
     and the big-board win hold across thousands of random games. */
const { loadEngine, mulberry32, tally } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("tic-tac-toe");

/* ---- level table ---- */
ok(Object.keys(E.LEVELS).join() === "EASY,MEDIUM,HARD,EXPERT", "four levels in order");
ok(E.LEVELS.EASY.mode === "classic" && E.LEVELS.MEDIUM.mode === "reverse"
   && E.LEVELS.HARD.mode === "vanish" && E.LEVELS.EXPERT.mode === "ultimate", "level -> rules mapping");
ok(E.newGrid("EASY").turn === "X", "Easy: you go first");
ok(E.newGrid("MEDIUM").turn === "O", "Medium: the owl goes first");
ok(E.newGrid("HARD").turn === "X" && E.newGrid("HARD").K === 3, "Hard: you go first, 3 marks each");

/* ---- rules ---- */
{
  let s = E.newGrid("EASY");
  for (const m of [0, 3, 1, 4]) s = E.applyGrid(s, m);
  s = E.applyGrid(s, 2);
  ok(s.over && s.winner === "X" && s.line.join() === "0,1,2", "classic: three in a row wins");

  let r = E.newGrid("MEDIUM");                 // O first
  for (const m of [0, 3, 1, 4]) r = E.applyGrid(r, m);
  r = E.applyGrid(r, 2);                       // O completes 0,1,2
  ok(r.over && r.winner === "X" && r.line.join() === "0,1,2", "reverse: making three LOSES — the other player wins");

  let f = E.newGrid("EASY");
  for (const m of [0, 1, 2, 4, 3, 5, 7, 6]) f = E.applyGrid(f, m);
  ok(!f.over, "classic: not over before the board is full");
  f = E.applyGrid(f, 8);
  ok(f.over && f.result === "tie" && f.winner === null, "classic: full board with no line is a tie");

  let threw = false; try { E.applyGrid(E.applyGrid(E.newGrid("EASY"), 4), 4); } catch (e) { threw = true; }
  ok(threw, "an occupied square is illegal");
}

/* ---- an independent brute-force minimax, written from the rules, to check the solver ---- */
function bf(board, turn, mode) {           // +1 / 0 / -1 for the player to move
  let best = -2;
  for (let i = 0; i < 9; i++) if (!board[i]) {
    const b = board.slice(); b[i] = turn;
    const other = turn === "X" ? "O" : "X";
    const line = E.LINES.some(L => L.every(j => b[j] === turn));
    let v;
    if (line) v = mode === "reverse" ? -1 : 1;
    else if (b.every(Boolean)) v = 0;
    else v = -bf(b, other, mode);
    if (v > best) best = v;
  }
  return best;
}
const sign = v => v > 0 ? 1 : v < 0 ? -1 : 0;
for (const [lv, mode] of [["EASY", "classic"], ["MEDIUM", "reverse"]]) {
  /* every reachable position */
  const seen = new Set(); let checked = 0, bad = 0;
  (function walk(s) {
    if (s.over) return;
    const k = s.turn + s.board.map(v => v || ".").join("");
    if (seen.has(k)) return; seen.add(k);
    checked++;
    if (sign(E.solveGrid(s)) !== bf(s.board, s.turn, mode)) bad++;
    for (const m of E.gridMoves(s)) walk(E.applyGrid(s, m));
  })(E.newGrid(lv));
  ok(bad === 0, `${lv}: solver disagrees with brute force on ${bad} of ${checked} positions`);
  ok(checked > 2000, `${lv}: walked ${checked} positions`);
  ok(E.solveGrid(E.newGrid(lv)) === 0, `${lv}: the empty board is a draw with perfect play`);
  console.log(`  ${lv}: solver matches brute force on all ${checked} positions`);
}

/* ---- the owl at blunder 0 is unbeatable: every child move, every owl move it might pick ---- */
for (const lv of ["EASY", "MEDIUM"]) {
  let leaves = 0, xWins = 0;
  (function walk(s) {
    if (s.over) { leaves++; if (s.winner === "X") xWins++; return; }
    if (s.turn === "X") { for (const m of E.gridMoves(s)) walk(E.applyGrid(s, m)); return; }
    /* aiGrid picks at random among the best-valued squares — so try every one of them */
    const vals = E.gridMoves(s).map(m => [m, E.moveValue(s, m)]);
    const best = Math.max(...vals.map(v => v[1]));
    const picks = new Set(vals.filter(v => v[1] === best).map(v => v[0]));
    for (let seed = 1; seed <= 12; seed++) {          // and the real aiGrid only ever picks from that set
      const m = E.aiGrid(s, mulberry32(seed), 0);
      if (!picks.has(m) && E.applyGrid(s, m).winner !== "O") ok(false, `${lv}: aiGrid picked a non-best square`);
    }
    for (const m of picks) walk(E.applyGrid(s, m));
  })(E.newGrid(lv));
  ok(xWins === 0, `${lv}: a perfect owl was beaten in ${xWins} of ${leaves} games`);
  console.log(`  ${lv}: perfect owl unbeaten across ${leaves} complete games`);
}

/* ---- blunders are never suicidal, and a win on the spot is always taken ---- */
{
  const rand = mulberry32(99); let suicides = 0, missedWins = 0, n = 0;
  for (let g = 0; g < 3000; g++) {
    const lv = g % 2 ? "EASY" : "MEDIUM";
    let s = E.newGrid(lv);
    while (!s.over) {
      let m;
      if (s.turn === "O") {
        m = E.aiGrid(s, rand, 1);                                  // ALWAYS blunder
        const evs = E.gridMoves(s).map(x => E.applyGrid(s, x));
        const n2 = E.applyGrid(s, m); n++;
        if (lv === "MEDIUM" && n2.winner === "X" && evs.some(e => !e.winner)) suicides++;
        if (lv === "EASY" && evs.some(e => e.winner === "O") && n2.winner !== "O") missedWins++;
      } else {
        const ms = E.gridMoves(s); m = ms[Math.floor(rand() * ms.length)];
      }
      s = E.applyGrid(s, m);
    }
  }
  ok(suicides === 0, `reverse: the owl blundered into its own three ${suicides} times when it had a safe square`);
  ok(missedWins === 0, `classic: the owl skipped a win on the spot ${missedWins} times`);
  console.log(`  ${n} blunder-mode owl moves: never suicidal, never skips a win`);
}

/* ---- HARD: the original disappearing rules ---- */
{
  /* ✕ owns 0 (oldest), 1, 5 and plays 2: the oldest goes FIRST, so 0-1-2 is NOT a line */
  let s = E.newGrid("HARD");
  for (const m of [0, 3, 1, 4, 5, 8]) s = E.applyGrid(s, m);
  ok(E.fadingIndex(s, "X") === 0, "Hard: ✕'s oldest mark is the one shown fading");
  const n = E.applyGrid(s, 2);
  ok(!n.over && n.evicted === 0 && n.board[0] === null && n.queues.X.join() === "1,5,2",
     "Hard: placing a 4th removes the oldest BEFORE the line check — a fading mark can't finish a line");
  /* …but it still blocks: ◯ owns 3 (oldest), 4, 8 and needs 0 for 0-4-8 — where ✕'s fading mark sits */
  ok(E.fadingIndex(s, "O") === 3 && E.threatSquares(s, "O").length === 0,
     "Hard: a fading mark still blocks the other player's line until it goes");

  /* random play: never more than 3 marks a side, a winner's line is its own 3 live marks,
     and a tie is always the third visit to a position */
  const r = mulberry32(11); let games = 0, ties = 0, bad = 0;
  for (let g = 0; g < 3000; g++) {
    let st = E.newGrid("HARD"); games++;
    while (!st.over) {
      const ms = E.gridMoves(st); st = E.applyGrid(st, ms[Math.floor(r() * ms.length)]);
      const xs = st.board.filter(v => v === "X").length, os = st.board.filter(v => v === "O").length;
      if (xs > 3 || os > 3) bad++;
      if (st.queues.X.length !== xs || st.queues.O.length !== os) bad++;
    }
    if (st.winner && !(st.line.every(i => st.board[i] === st.winner) && E.isLine(st.queues[st.winner]))) bad++;
    if (st.result === "tie") { ties++; if (st.seen[E.posKey(st)] !== E.REPEATS) bad++; }
  }
  ok(bad === 0, `Hard: ${bad} rule violations in ${games} random games`);
  console.log(`  Hard rules hold across ${games} random games`);
}

/* ---- HARD: the backwards solve satisfies its own definition at every position ---- */
{
  const t0 = Date.now(), T = E.vanishTable(), ms = Date.now() - t0;
  let bad = 0;
  for (let i = 0; i < T.states.length; i++) {
    const ch = T.kids[i], v = T.val[i], d = T.dist[i];
    if (T.winNow[i]) { if (v !== 1 || d !== 1) bad++; continue; }
    const lossKids = ch.filter(c => T.val[c] === -1), allWin = ch.length > 0 && ch.every(c => T.val[c] === 1);
    if (lossKids.length) { if (v !== 1 || d !== 1 + Math.min(...lossKids.map(c => T.dist[c]))) bad++; }
    else if (allWin) { if (v !== -1 || d !== 1 + Math.max(...ch.map(c => T.dist[c]))) bad++; }
    else if (v !== 0) bad++;
  }
  ok(bad === 0, `Hard: ${bad} of ${T.states.length} solved positions break the win/loss/draw definition`);
  const s0 = T.index.get(E.vKey([], [], "X"));
  ok(T.val[s0] === 1, "Hard: the first player has a forced win from the empty board");
  console.log(`  Hard solve: ${T.states.length} positions in ${ms} ms, all consistent; first player wins in ${T.dist[s0]}`);

  /* a perfect owl in a won position always converts it, within the promised distance */
  const r = mulberry32(3); let tried = 0, fails = 0;
  for (let i = 0; i < T.states.length && tried < 400; i++) {
    const [xq, oq, t] = T.states[i];
    if (t !== "O" || T.val[i] !== 1 || r() > 0.05) continue;
    tried++;
    let st = E.newGrid("HARD");
    st.queues = { X: xq.slice(), O: oq.slice() }; st.turn = "O";
    st.board = Array(9).fill(null); xq.forEach(c => st.board[c] = "X"); oq.forEach(c => st.board[c] = "O");
    let plies = 0;
    while (!st.over && plies < 200) {
      if (st.turn === "O") st = E.applyGrid(st, E.aiVanish(st, r, 0));
      else { const ms2 = E.gridMoves(st); st = E.applyGrid(st, ms2[Math.floor(r() * ms2.length)]); }
      plies++;
    }
    if (st.winner !== "O" || plies > T.dist[i]) fails++;
  }
  ok(tried > 100 && fails === 0, `Hard: a perfect owl failed to convert ${fails} of ${tried} won positions`);

  /* blunders never hand over a win next move when avoidable; a win on the spot is always taken */
  let missed = 0, gifts = 0;
  for (let g = 0; g < 1500; g++) {
    let st = E.newGrid("HARD");
    while (!st.over) {
      if (st.turn === "O") {
        const vals = E.gridMoves(st).map(m => E.vanishMoveValue(st, m));
        const m = E.aiVanish(st, r, 1), v = E.vanishMoveValue(st, m);
        if (vals.includes(1000) && v !== 1000) missed++;
        if (v === -999 && vals.some(x => x !== -999)) gifts++;
        st = E.applyGrid(st, m);
      } else { const ms2 = E.gridMoves(st); st = E.applyGrid(st, ms2[Math.floor(r() * ms2.length)]); }
    }
  }
  ok(missed === 0, `Hard: the owl skipped a win on the spot ${missed} times`);

  /* from a DRAWN position, perfect vs perfect goes round in circles until the third repeat */
  let drawn = 0, tiesOk = 0;
  for (let i = 0; i < T.states.length && drawn < 200; i++) {
    const [xq, oq, t] = T.states[i];
    if (T.val[i] !== 0 || r() > 0.05) continue;
    drawn++;
    let st = E.newGrid("HARD");
    st.queues = { X: xq.slice(), O: oq.slice() }; st.turn = t;
    xq.forEach(c => st.board[c] = "X"); oq.forEach(c => st.board[c] = "O");
    for (let k = 0; k < 500 && !st.over; k++) {
      st = E.applyGrid(st, E.aiVanish(st, r, 0));    // aiVanish plays whoever is to move
    }
    if (st.result === "tie" && !st.winner && st.seen[E.posKey(st)] === E.REPEATS) tiesOk++;
  }
  ok(drawn > 50 && tiesOk === drawn, `Hard: ${tiesOk} of ${drawn} drawn positions ended in a repetition tie`);
  console.log(`  ${drawn} drawn positions, perfect vs perfect: all end in the three-repeat tie`);
  ok(gifts === 0, `Hard: a blunder handed over an immediate win ${gifts} times`);
}

/* ---- EXPERT: the ultimate rules hold over many random games ---- */
{
  const U = E.Ult;
  let bad = 0, games = 0, freeMoves = 0, maxPly = 0;
  const results = { X: 0, O: 0, tie: 0 };
  for (let g = 0; g < 3000; g++) {
    const r = mulberry32(g + 1);
    let s = U.newGame(); games++;
    while (!s.over) {
      const ms = U.legalMoves(s);
      if (!ms.length) { bad++; break; }
      /* the sending rule: a forced board is always open, and every move is inside it */
      if (s.forced >= 0) { if (!U.boardOpen(s, s.forced) || !ms.every(m => Math.floor(m / 9) === s.forced)) bad++; }
      else {                                   /* a free move offers every open board */
        const bs = new Set(ms.map(m => Math.floor(m / 9)));
        if (!U.openBoards(s).every(b => bs.has(b))) bad++;
        if (s.ply > 0) freeMoves++;
      }
      if (!ms.every(m => s.cells[m] === null && U.boardOpen(s, Math.floor(m / 9)))) bad++;
      /* the last move's square names the next board — or a free move if that board is closed */
      if (s.lastC >= 0 && s.forced !== (U.boardOpen(s, s.lastC) ? s.lastC : -1)) bad++;
      s = U.applyMove(s, ms[Math.floor(r() * ms.length)]);
    }
    maxPly = Math.max(maxPly, s.ply);
    results[s.result === "tie" ? "tie" : s.result]++;
    if (s.winner) {                            /* a winner really holds three claimed boards in a row */
      if (!U.bigLine(s.won, s.winner) || !s.line.every(b => s.won[b] === s.winner && U.lineInBoard(s.cells, b, s.winner))) bad++;
    } else if (U.bigLine(s.won, "X") || U.bigLine(s.won, "O") || U.legalMoves(s).length) bad++;
    for (let b = 0; b < 9; b++) {             /* every claim and every draw is justified by the cells */
      const w = s.won[b]; let full = true;
      for (let c = 0; c < 9; c++) if (s.cells[b * 9 + c] === null) full = false;
      if ((w === "X" || w === "O") && !U.lineInBoard(s.cells, b, w)) bad++;
      if (w === "D" && !(full && !U.lineInBoard(s.cells, b, "X") && !U.lineInBoard(s.cells, b, "O"))) bad++;
    }
  }
  ok(bad === 0, `Expert: ${bad} rule violations in ${games} random games`);
  ok(freeMoves > 0 && results.tie > 0 && results.X > 0 && results.O > 0, "Expert: free moves, wins and ties all exercised");
  ok(maxPly <= 81, "Expert: no game longer than 81 moves");

  /* illegal moves are rejected */
  let s = U.applyMove(U.newGame(), 4 * 9 + 4);
  ok(s.forced === 4, "Expert: the centre square sends to the centre board");
  let t = 0;
  for (const m of [4 * 9 + 4, 0, 99]) { try { U.applyMove(s, m); } catch (e) { t++; } }
  ok(t === 3, "Expert: occupied, wrong-board and out-of-range moves are all rejected");

  /* the owl: always a legal move, and a big-board win on the spot is always taken */
  let missed = 0, owlMoves = 0; const t0 = Date.now();
  for (let g = 0; g < 6; g++) {
    const r = mulberry32(700 + g); let st = U.newGame();
    while (!st.over) {
      const ms = U.legalMoves(st);
      if (st.turn === "O") {
        const m = U.aiMove(st, r); owlMoves++;
        if (!ms.includes(m)) missed++;
        if (ms.some(x => U.applyMove(st, x).winner === "O") && U.applyMove(st, m).winner !== "O") missed++;
        st = U.applyMove(st, m);
      } else st = U.applyMove(st, ms[Math.floor(r() * ms.length)]);
    }
  }
  ok(missed === 0, `Expert: the owl made ${missed} illegal or win-skipping moves`);
  console.log(`  Expert rules hold across ${games} random games (${JSON.stringify(results)}); owl: ${owlMoves} moves in ${Date.now() - t0} ms`);
}

/* ---- the difficulty curve points the right way, against a child-like player ----
   "takes a win, blocks a threat, never makes its own three in reverse, otherwise random" */
function kidGrid(s, r) {
  const ms = E.gridMoves(s);
  if (s.mode === "reverse") {
    const safe = ms.filter(m => E.applyGrid(s, m).winner !== "O"), p = safe.length ? safe : ms;
    return p[Math.floor(r() * p.length)];
  }
  const w = ms.find(m => E.applyGrid(s, m).winner === "X"); if (w !== undefined) return w;
  const b = E.threatSquares(s, "O"); if (b.length) return b[0];
  return ms[Math.floor(r() * ms.length)];
}
function kidUlt(s, r) {
  const T = E.Ult, ms = T.legalMoves(s);
  const w = ms.find(m => T.applyMove(s, m).winner === "X"); if (w !== undefined) return w;
  return ms[Math.floor(r() * ms.length)];
}
{
  const rate = {};
  for (const lv of ["EASY", "MEDIUM", "HARD"]) {
    const r = mulberry32(42), N = 1500; let w = 0;
    for (let g = 0; g < N; g++) {
      let s = E.newGrid(lv);
      while (!s.over) s = E.applyGrid(s, s.turn === "X" ? kidGrid(s, r) : E.aiMoveGrid(s, r));
      if (s.winner === "X") w++;
    }
    rate[lv] = w / N;
  }
  { const r = mulberry32(42), N = 12; let w = 0;
    for (let g = 0; g < N; g++) {
      let s = E.Ult.newGame();
      while (!s.over) s = E.Ult.applyMove(s, s.turn === "X" ? kidUlt(s, r) : E.Ult.aiMove(s, r));
      if (s.winner === "X") w++;
    }
    rate.EXPERT = w / N; }
  console.log("  child-like win rates: " + Object.entries(rate).map(([k, v]) => k + " " + (100 * v).toFixed(0) + "%").join(" · "));
  ok(rate.EASY > 0.35, "Easy should be very winnable (" + rate.EASY + ")");
  ok(rate.MEDIUM > 0.15, "Medium should be winnable (" + rate.MEDIUM + ")");
  ok(rate.EASY > rate.MEDIUM && rate.MEDIUM > rate.HARD && rate.HARD >= rate.EXPERT,
     "win rates should fall level by level");
}

report("tic-tac-toe engine");
