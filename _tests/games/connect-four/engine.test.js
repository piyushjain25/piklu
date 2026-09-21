"use strict";
/* connect-four engine: the rules (gravity, every ending) checked against an independent
   oracle across thousands of random games, the owl's alpha-beta search proved equal to a plain
   minimax at the same depth (and exact in the endgame), its tactics checked on random
   positions, and full games at every level to show the owls are ordered by strength and
   EASY stays beatable. */
const { loadEngine, mulberry32, tally, stress } = require("../../lib/harness.js");
const E = loadEngine("connect-four");
const { ok, report } = tally();
const { COLS, ROWS, CELLS, EMPTY, YOU, OWL, LEVELS, WIN, at } = E;

/* ---- independent oracles (not copies: written from the rules, not the engine) ----------- */
function oracleFour(b, p) {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      let k = 0;
      while (k < 4) {
        const rr = r + k * dr, cc = c + k * dc;
        if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || b[rr * COLS + cc] !== p) break;
        k++;
      }
      if (k === 4) return true;
    }
  return false;
}
const cell = (b, r, c) => b[r * COLS + c];
function gravityOK(b) {
  for (let c = 0; c < COLS; c++) for (let r = 1; r < ROWS; r++)
    if (cell(b, r, c) !== EMPTY && cell(b, r - 1, c) === EMPTY) return false;
  return true;
}
function oracleMoves(b) {
  const out = [];
  for (let c = 0; c < COLS; c++) if (cell(b, ROWS - 1, c) === EMPTY) out.push(c);
  return out.sort((x, y) => x - y);
}
/* plain minimax — no pruning, no ordering — with the engine's documented scoring */
function minimax(b, p, depth) {
  const ms = E.legalMoves(b);
  if (!ms.length) return 0;
  let best = -Infinity;
  for (const m of ms) best = Math.max(best, childMinimax(b, p, m, depth));
  return best;
}
function childMinimax(b, p, m, depth) {
  const n = E.play(b, p, m);
  if (oracleFour(n, p)) return WIN + depth;
  if (oracleMoves(n).length === 0) return 0;
  if (depth <= 1) return E.evaluate(n, p);
  return -minimax(n, E.other(p), depth - 1);
}
/* the true game result for p to move, win/draw/loss only, full depth (endgames) */
function solve(b, p) {
  const ms = E.legalMoves(b);
  if (!ms.length) return 0;
  let best = -1;
  for (const m of ms) {
    const n = E.play(b, p, m);
    let v;
    if (oracleFour(n, p)) v = 1;
    else v = -solve(n, E.other(p));
    if (v > best) best = v;
    if (best === 1) break;
  }
  return best;
}
const sign = v => v >= WIN ? 1 : v <= -WIN ? -1 : 0;

/* a random position reached by legal play, with no winner yet */
function randomPosition(rng, plies) {
  for (;;) {
    let s = E.newGame("EXPERT");
    for (let i = 0; i < plies && !E.isOver(s); i++) {
      const ms = E.legalMoves(s.board);
      s = E.applyMove(s, ms[Math.floor(rng() * ms.length)]);
    }
    if (!E.isOver(s)) return s;
  }
}

/* ---- 1. the level table and the 69 lines --------------------------------------------------- */
ok(JSON.stringify(Object.keys(LEVELS)) === '["EASY","MEDIUM","EXPERT"]', "three levels in order");
ok(Object.values(LEVELS).every(L => !("rules" in L)), "every level plays the same classic rules");
ok(LEVELS.EASY.owl === "gentle" && LEVELS.MEDIUM.slip > 0 && LEVELS.MEDIUM.depth < LEVELS.EXPERT.depth,
   "MEDIUM looks less far than EXPERT, and slips");
ok(!LEVELS.EXPERT.slip && LEVELS.EXPERT.depth >= 4 && LEVELS.EXPERT.nodes > 0, "the EXPERT owl searches with a budget");
ok(E.LINES.length === 69, "69 windows of four, got " + E.LINES.length);
{
  const dirs = { "0,1": 0, "1,0": 0, "1,1": 0, "1,-1": 0 }, keys = new Set();
  for (const L of E.LINES) {
    const rc = L.map(i => [Math.floor(i / COLS), i % COLS]);
    const dr = rc[1][0] - rc[0][0], dc = rc[1][1] - rc[0][1];
    ok(L.every(i => i >= 0 && i < CELLS), "line inside the board");
    ok(rc.every(([r, c], k) => r === rc[0][0] + k * dr && c === rc[0][1] + k * dc), "line is 4 in a row");
    dirs[dr + "," + dc]++;
    keys.add(L.slice().sort((a, b) => a - b).join());
  }
  ok(keys.size === 69, "no line listed twice");
  ok(dirs["0,1"] === 24 && dirs["1,0"] === 21 && dirs["1,1"] === 12 && dirs["1,-1"] === 12,
     "24 across, 21 up, 12+12 diagonal: " + JSON.stringify(dirs));
}

/* ---- 2. illegal moves are refused ---------------------------------------------------------- */
{
  let s = E.newGame("EXPERT");
  for (const m of [-1, 1.5, 7, 13, 14, NaN, "3", null]) ok(E.applyMove(s, m) === null, "refuses move " + m);
  /* fill column 0: the discs alternate colour, so nobody makes four */
  const seq = [0, 0, 0, 0, 0, 0];
  for (const m of seq) s = E.applyMove(s, m);
  ok(s && !E.isOver(s) && E.height(s.board, 0) === ROWS, "column 0 filled with no winner");
  ok(E.applyMove(s, 0) === null, "a full column refuses a drop");
  /* a disc only ever lands on top, so the board a move leaves is the board plus one disc */
  let c = E.newGame("EXPERT");
  c = E.applyMove(c, 3);
  ok(c.board.filter(v => v !== EMPTY).length === 1 && c.board[at(0, 3)] === YOU, "a drop adds exactly one disc, at the bottom");
  ok([7, 8, 9, 10, 11, 12, 13].every(m => E.applyMove(c, m) === null), "there is no move beyond the seven columns");
}

/* ---- 3. random games against the oracle: gravity, pops, every ending ---------------------- */
function checkGames(games, rng) {
  let bad = 0, wins = 0, draws = 0, forOther = 0;
  for (let g = 0; g < games; g++) {
    let s = E.newGame("MEDIUM");
    let guard = 0;
    while (!E.isOver(s) && guard++ < 600) {
      const b = s.board, p = s.turn;
      const ms = E.legalMoves(b);
      if (JSON.stringify(ms.slice().sort((x, y) => x - y)) !== JSON.stringify(oracleMoves(b))) { bad++; break; }
      const m = ms[Math.floor(rng() * ms.length)];
      const n = E.applyMove(s, m);
      if (!n) { bad++; break; }
      const nb = n.board, col = m;
      /* what the move must have done to the board: one disc, on top of that column */
      const expect = b.slice();
      let h = 0; while (cell(b, h, col) !== EMPTY) h++;
      expect[h * COLS + col] = p;
      if (nb.join() !== expect.join() || !gravityOK(nb)) { bad++; console.log("  move mechanics", m); break; }
      /* ending. A disc lands on top of a column, so a move can never complete a line for the
         OTHER side — count it, and the assertion below says it never happened. */
      const me = oracleFour(nb, p), them = oracleFour(nb, 3 - p);
      if (them && !me) forOther++;
      const winner = me ? p : 0;
      const full = [0, 1, 2, 3, 4, 5, 6].every(c => cell(nb, ROWS - 1, c) !== EMPTY);
      const draw = winner ? null : full ? "full" : null;
      if (n.winner !== winner || n.draw !== draw || n.turn !== 3 - p || n.moves !== s.moves + 1) {
        bad++; console.log("  ending", { winner, got: n.winner, draw, gotDraw: n.draw }); break;
      }
      if (winner && JSON.stringify(n.line) !== JSON.stringify(E.fourCells(nb, winner))) { bad++; break; }
      if (winner && !(n.line.length >= 4 && n.line.every(i => nb[i] === winner))) { bad++; break; }
      if (n.moves !== nb.filter(v => v).length) { bad++; break; }
      s = n;
    }
    if (!E.isOver(s) && guard >= 600) continue;          /* an unfinished random wander — fine */
    if (s.winner) wins++; else if (s.draw) draws++;
    if (E.applyMove(s, E.legalMoves(s.board)[0]) !== null && E.isOver(s)) bad++;
  }
  ok(bad === 0, bad + " games disagreed with the oracle");
  ok(forOther === 0, "a drop never makes four for the other side (" + forOther + " did)");
  console.log("  " + games + " random games — " + wins + " won, " + draws + " drawn");
  return { wins, draws };
}
{
  const rng = mulberry32(101);
  const c = checkGames(stress(3000), rng);
  ok(c.wins > 0, "random games do get won");
}
/* a finished game refuses every move */
{
  let s = E.newGame("EXPERT");
  for (const m of [0, 1, 0, 1, 0, 1, 0]) s = E.applyMove(s, m);
  ok(s.winner === YOU && s.draw === null, "four up column 0 wins for you");
  ok(JSON.stringify(s.line) === JSON.stringify([at(0, 0), at(1, 0), at(2, 0), at(3, 0)]), "the winning four is reported");
  ok([0, 1, 2, 3, 4, 5, 6].every(m => E.applyMove(s, m) === null), "no move after the game is won");
}

/* ---- 4. endings built by hand -------------------------------------------------------------- */
/* classic full-board draw: a real drawn game, found once by random play and kept as a fixture.
   The oracle confirms no four at any point, so the only possible ending is the full board. */
const DRAWN = "543255633063350500365214441261642264201011".split("").map(Number);
{
  let s = E.newGame("MEDIUM"), early = false;
  for (let i = 0; i < DRAWN.length; i++) {
    s = E.applyMove(s, DRAWN[i]);
    if (!s) break;
    if (oracleFour(s.board, YOU) || oracleFour(s.board, OWL)) early = true;
    if (i < DRAWN.length - 1 && E.isOver(s)) early = true;
  }
  ok(s && !early && s.draw === "full" && s.winner === 0 && E.isFull(s.board),
     "a full board with no four is a draw ('full')");
}
/* ---- 5. the search: alpha-beta equals plain minimax, exact in the endgame ----------------- */
{
  const rng = mulberry32(202);
  let bad = 0, n = 0;
  for (let i = 0; i < stress(300); i++) {
    const s = randomPosition(rng, 4 + Math.floor(rng() * 24));
    const depth = 1 + (i % 4);
    const res = E.searchRoot(s.board, s.turn, depth);
    const truth = E.legalMoves(s.board).map(m => ({ m, v: childMinimax(s.board, s.turn, m, depth) }));
    const best = Math.max(...truth.map(x => x.v));
    const want = truth.filter(x => x.v === best).map(x => x.m).sort((a, b) => a - b);
    n++;
    if (res.best !== best || JSON.stringify(res.bestMoves.slice().sort((a, b) => a - b)) !== JSON.stringify(want)) {
      bad++; if (bad < 4) console.log("  search mismatch", depth, res.best, best, res.bestMoves, want);
    }
    if (res.best !== minimax(s.board, s.turn, depth)) bad++;
  }
  ok(bad === 0, "alpha-beta root agrees with plain minimax (value and every best move): " + bad + "/" + n + " off");
}
{
  const rng = mulberry32(303);
  let bad = 0, n = 0, results = { "-1": 0, 0: 0, 1: 0 };
  while (n < stress(400)) {
    const s = randomPosition(rng, 32 + Math.floor(rng() * 6));
    const empties = s.board.filter(v => v === EMPTY).length;
    if (empties > 9) continue;
    n++;
    const truth = solve(s.board, s.turn);
    const res = E.searchRoot(s.board, s.turn, empties);
    results[truth]++;
    if (sign(res.best) !== truth) bad++;
    /* and every move the owl would pick really achieves that result */
    for (const m of res.bestMoves) {
      const nb = E.play(s.board, s.turn, m);
      const v = oracleFour(nb, s.turn) ? 1 : -solve(nb, E.other(s.turn));
      if (v !== truth) bad++;
    }
  }
  ok(bad === 0, "full-depth search is exact on " + n + " endgames (" + bad + " wrong)");
  ok(results[1] && results[-1] && results[0], "endgame sample covers wins, losses and draws: " + JSON.stringify(results));
}
{
  const rng = mulberry32(404);
  let bad = 0;
  for (let i = 0; i < stress(60); i++) {
    const s = randomPosition(rng, 2 + Math.floor(rng() * 20));
    const L = LEVELS.EXPERT;
    const res = E.deepSearch(s.board, s.turn, L.depth, L.nodes);
    if (res.nodes > L.nodes + 1) bad++;
    if (!(res.depth <= L.depth && (res.depth >= 2 || Math.abs(res.best) >= WIN))) bad++;   /* depth 1 only for a proven result */
    if (res.depth < L.depth && Math.abs(res.best) < WIN && res.nodes <= L.nodes) bad++;  /* stopped early for no reason */
    const again = E.searchRoot(s.board, s.turn, res.depth);
    if (again.best !== res.best) bad++;
  }
  ok(bad === 0, "deepSearch stays in budget and returns a real completed search: " + bad + " off");
}

/* ---- 6. the owl's tactics on random positions --------------------------------------------- */
{
  const rng = mulberry32(505);
  const stats = {};
  for (const level of ["EASY", "MEDIUM", "EXPERT", "HINT"]) {
    let illegal = 0, missedWin = 0, gifted = 0, missedMate = 0, winChances = 0, blockChances = 0;
    const samples = level === "EXPERT" ? stress(250) : stress(1500);
    for (let i = 0; i < samples; i++) {
      const base = randomPosition(rng, 3 + Math.floor(rng() * 28));
      const s = { ...base, level: level === "HINT" ? "MEDIUM" : level };
      const m = level === "HINT" ? E.hintMove(s, rng) : E.owlMove(s, rng);
      const b = s.board, p = s.turn;
      if (!E.isLegal(b, m)) { illegal++; continue; }
      const wins = E.winningMoves(b, p);
      if (wins.length) { winChances++; if (!wins.includes(m)) missedWin++; continue; }
      const safe = E.legalMoves(b).filter(x => !E.gifts(b, p, x));
      if (E.winningMoves(b, E.other(p)).length) blockChances++;
      if (safe.length && E.gifts(b, p, m)) gifted++;
      /* a searching owl finds a forced win in two of its moves when there is one */
      if (level === "EXPERT" && childMinimax(b, p, m, 3) < WIN) {
        const any = E.legalMoves(b).some(x => childMinimax(b, p, x, 3) >= WIN);
        if (any) missedMate++;
      }
    }
    stats[level] = { illegal, missedWin, gifted, missedMate, winChances, blockChances };
    ok(illegal === 0, level + ": owl always plays a legal move");
    if (level !== "EASY") {
      ok(missedWin === 0, level + ": always takes a win on the spot (" + winChances + " chances)");
      ok(gifted === 0, level + ": never hands over a win it could avoid (" + blockChances + " threats to block)");
    } else {
      ok(missedWin > 0 && missedWin < winChances, "EASY: takes some wins and misses some (" + missedWin + "/" + winChances + " missed)");
      ok(gifted > 0, "EASY: sometimes leaves a threat open (" + gifted + ")");
    }
    if (level === "EXPERT") ok(missedMate === 0, level + ": finds every win-in-two (" + missedMate + " missed)");
  }
  console.log("  owl tactics: " + JSON.stringify(stats));
}

/* ---- 7. whole games: legal, finite, and the owls ordered by strength ---------------------- */
function match(level, player, games, seed) {
  const rng = mulberry32(seed);
  const tally = { owl: 0, you: 0, draw: 0, bad: 0 };
  for (let g = 0; g < games; g++) {
    let s = E.newGame(level);
    let guard = 0;
    while (!E.isOver(s) && guard++ < 1000) {
      let m;
      if (s.turn === OWL) m = E.owlMove(s, rng);
      else if (player === "random") { const ms = E.legalMoves(s.board); m = ms[Math.floor(rng() * ms.length)]; }
      else if (player === "careful") m = E.carefulMove(s.board, s.turn, rng);
      else m = E.gentleMove(s.board, s.turn, rng);
      const n = E.applyMove(s, m);
      if (!n) { tally.bad++; break; }
      s = n;
    }
    if (!E.isOver(s)) tally.bad++;
    else if (s.winner === OWL) tally.owl++; else if (s.winner === YOU) tally.you++; else tally.draw++;
  }
  console.log("  " + level + " owl vs " + player + " player, " + games + " games: " + JSON.stringify(tally));
  ok(tally.bad === 0, level + " vs " + player + ": every game legal and finished");
  return tally;
}
{
  const g = n => stress(n);
  const easyR = match("EASY", "random", g(400), 1);
  const easyC = match("EASY", "careful", g(400), 2);
  const medR = match("MEDIUM", "random", g(400), 3);
  const medC = match("MEDIUM", "careful", g(300), 4);
  const expR = match("EXPERT", "random", g(24), 7);
  const expC = match("EXPERT", "careful", g(24), 8);
  const rate = t => t.owl / (t.owl + t.you + t.draw);
  ok(rate(easyR) > 0.5, "EASY still beats a random player most of the time");
  ok(easyC.you > easyC.owl, "EASY is beatable: a careful player wins more than it loses");
  ok(rate(medR) > 0.9, "MEDIUM beats a random player");
  ok(rate(medR) > rate(easyR) && rate(medC) > rate(easyC), "MEDIUM is stronger than EASY");
  ok(rate(expR) >= 0.97, "EXPERT crushes a random player");
  ok(rate(expC) > 0.6 && rate(expC) > rate(medC), "EXPERT beats a careful player and is stronger than MEDIUM");
}

report("connect-four engine");
