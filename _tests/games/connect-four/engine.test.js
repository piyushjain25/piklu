"use strict";
/* connect-four engine: the rules (gravity, pops, every ending) checked against an independent
   oracle across thousands of random games, the owl's alpha-beta search proved equal to a plain
   minimax at the same depth (and exact in the endgame), its tactics checked on random
   positions, and full games at every level to show the owls are ordered by strength and
   EASY stays beatable. */
const { loadEngine, mulberry32, tally, stress } = require("../../lib/harness.js");
const E = loadEngine("connect-four");
const { ok, report } = tally();
const { COLS, ROWS, CELLS, EMPTY, YOU, OWL, POP, LEVELS, WIN, at } = E;

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
function oracleMoves(b, p, rules) {
  const out = [];
  for (let c = 0; c < COLS; c++) if (cell(b, ROWS - 1, c) === EMPTY) out.push(c);
  if (rules === "popout") for (let c = 0; c < COLS; c++) if (cell(b, 0, c) === p) out.push(POP + c);
  return out.sort((x, y) => x - y);
}
/* plain minimax — no pruning, no ordering — with the engine's documented scoring */
function minimax(b, p, depth, rules) {
  const ms = E.legalMoves(b, p, rules);
  if (!ms.length) return 0;
  let best = -Infinity;
  for (const m of ms) best = Math.max(best, childMinimax(b, p, m, depth, rules));
  return best;
}
function childMinimax(b, p, m, depth, rules) {
  const n = E.play(b, p, m);
  const me = oracleFour(n, p), them = oracleFour(n, E.other(p));
  if (me) return WIN + depth;
  if (them) return -(WIN + depth);
  if (E.stuck(n, E.other(p), rules)) return 0;
  if (depth <= 1) return E.evaluate(n, p);
  return -minimax(n, E.other(p), depth - 1, rules);
}
/* the true game result for p to move, win/draw/loss only, full depth (endgames) */
function solve(b, p, rules) {
  const ms = E.legalMoves(b, p, rules);
  if (!ms.length) return 0;
  let best = -1;
  for (const m of ms) {
    const n = E.play(b, p, m);
    let v;
    if (oracleFour(n, p)) v = 1;
    else if (oracleFour(n, E.other(p))) v = -1;
    else v = -solve(n, E.other(p), rules);
    if (v > best) best = v;
    if (best === 1) break;
  }
  return best;
}
const sign = v => v >= WIN ? 1 : v <= -WIN ? -1 : 0;

/* a random position reached by legal play, with no winner yet */
function randomPosition(rng, rules, plies) {
  for (;;) {
    let s = E.newGame(rules === "popout" ? "EXPERT" : "HARD");
    for (let i = 0; i < plies && !E.isOver(s); i++) {
      const ms = E.legalMoves(s.board, s.turn, s.rules);
      s = E.applyMove(s, ms[Math.floor(rng() * ms.length)]);
    }
    if (!E.isOver(s)) return s;
  }
}

/* ---- 1. the level table and the 69 lines --------------------------------------------------- */
ok(JSON.stringify(Object.keys(LEVELS)) === '["EASY","MEDIUM","HARD","EXPERT"]', "four levels in order");
ok(LEVELS.EASY.rules === "classic" && LEVELS.MEDIUM.rules === "classic" && LEVELS.HARD.rules === "classic",
   "EASY/MEDIUM/HARD are classic");
ok(LEVELS.EXPERT.rules === "popout", "EXPERT is PopOut");
ok(LEVELS.EASY.owl === "gentle" && LEVELS.MEDIUM.slip > 0 && LEVELS.MEDIUM.depth < LEVELS.HARD.depth, "MEDIUM looks less far than HARD, and slips");
for (const k of ["HARD", "EXPERT"]) ok(!LEVELS[k].slip && LEVELS[k].depth >= 4 && LEVELS[k].nodes > 0, k + " owl searches with a budget");
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
  let s = E.newGame("HARD");
  for (const m of [-1, 1.5, 7, 13, 14, NaN, "3", null]) ok(E.applyMove(s, m) === null, "classic refuses move " + m);
  /* fill column 0: the discs alternate colour, so nobody makes four */
  const seq = [0, 0, 0, 0, 0, 0];
  for (const m of seq) s = E.applyMove(s, m);
  ok(s && !E.isOver(s) && E.height(s.board, 0) === ROWS, "column 0 filled with no winner");
  ok(E.applyMove(s, 0) === null, "a full column refuses a drop");
  let p = E.newGame("EXPERT");
  ok(E.applyMove(p, POP + 3) === null, "PopOut: can't pop an empty column");
  p = E.applyMove(p, 3);                             /* YOU at the bottom of column 3 */
  ok(E.applyMove(p, POP + 3) === null, "PopOut: the owl can't pop your disc");
  p = E.applyMove(p, 4);                             /* owl at column 4 */
  ok(E.applyMove(p, POP + 4) === null, "PopOut: you can't pop the owl's disc");
  const popped = E.applyMove(p, POP + 3);
  ok(popped && popped.board[3] === EMPTY, "PopOut: you can pop your own bottom disc");
  let c = E.newGame("HARD");
  c = E.applyMove(c, 3);
  c = E.applyMove(c, 4);
  ok(E.applyMove(c, POP + 3) === null, "classic: popping is never allowed");
}

/* ---- 3. random games against the oracle: gravity, pops, every ending ---------------------- */
function checkGames(rules, games, rng) {
  let bad = 0, wins = 0, draws = 0, pops = 0, doubles = 0;
  for (let g = 0; g < games; g++) {
    let s = E.newGame(rules === "popout" ? "EXPERT" : "MEDIUM");
    const seen = new Map([[s.board.join("") + s.turn, 1]]);
    let guard = 0;
    while (!E.isOver(s) && guard++ < 600) {
      const b = s.board, p = s.turn;
      const ms = E.legalMoves(b, p, rules);
      if (JSON.stringify(ms.slice().sort((x, y) => x - y)) !== JSON.stringify(oracleMoves(b, p, rules))) { bad++; break; }
      /* PopOut games wander a long time at random; lean on drops so boards fill up */
      const drops = ms.filter(m => m < POP);
      const m = rules === "popout" && drops.length && rng() < 0.6 ? drops[Math.floor(rng() * drops.length)]
                                                                 : ms[Math.floor(rng() * ms.length)];
      const n = E.applyMove(s, m);
      if (!n) { bad++; break; }
      const nb = n.board, col = m % COLS;
      /* what the move must have done to the board */
      let expect = b.slice();
      if (m < POP) { let h = 0; while (cell(b, h, col) !== EMPTY) h++; expect[h * COLS + col] = p; }
      else { pops++; for (let r = 0; r < ROWS - 1; r++) expect[r * COLS + col] = cell(b, r + 1, col); expect[(ROWS - 1) * COLS + col] = EMPTY; }
      if (nb.join() !== expect.join() || !gravityOK(nb)) { bad++; console.log("  move mechanics", rules, m); break; }
      /* ending */
      const me = oracleFour(nb, p), them = oracleFour(nb, 3 - p);
      if (me && them) doubles++;
      const winner = me ? p : them ? 3 - p : 0;
      const key = nb.join("") + (3 - p);
      seen.set(key, (seen.get(key) || 0) + 1);
      const full = [0, 1, 2, 3, 4, 5, 6].every(c => cell(nb, ROWS - 1, c) !== EMPTY);
      const nextStuck = full && (rules !== "popout" || ![0, 1, 2, 3, 4, 5, 6].some(c => cell(nb, 0, c) === 3 - p));
      const draw = winner ? null : nextStuck ? (rules === "popout" ? "stuck" : "full") : seen.get(key) >= 3 ? "repeat" : null;
      if (n.winner !== winner || n.draw !== draw || n.turn !== 3 - p || n.moves !== s.moves + 1) {
        bad++; console.log("  ending", rules, { winner, got: n.winner, draw, gotDraw: n.draw }); break;
      }
      if (winner && JSON.stringify(n.line) !== JSON.stringify(E.fourCells(nb, winner))) { bad++; break; }
      if (winner && !(n.line.length >= 4 && n.line.every(i => nb[i] === winner))) { bad++; break; }
      if (rules === "classic" && n.moves !== nb.filter(v => v).length) { bad++; break; }
      s = n;
    }
    if (!E.isOver(s) && guard >= 600) continue;          /* an unfinished random wander — fine */
    if (s.winner) wins++; else if (s.draw) draws++;
    if (E.applyMove(s, E.legalMoves(s.board, s.turn, rules)[0]) !== null && E.isOver(s)) bad++;
  }
  ok(bad === 0, rules + ": " + bad + " games disagreed with the oracle");
  console.log("  " + rules + ": " + games + " random games — " + wins + " won, " + draws + " drawn"
              + (rules === "popout" ? ", " + pops + " pops, " + doubles + " double-fours" : ""));
  return { wins, pops };
}
{
  const rng = mulberry32(101);
  const c = checkGames("classic", stress(3000), rng);
  ok(c.wins > 0, "classic random games do get won");
  const p = checkGames("popout", stress(2000), rng);
  ok(p.pops > 0 && p.wins > 0, "PopOut random games pop and get won");
}
/* a finished game refuses every move */
{
  let s = E.newGame("HARD");
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
/* PopOut: the same full board — the next player can still pop, so it is NOT over */
{
  /* replay the drawn game under PopOut rules: the last drop fills the board, yet the owl has
     discs on the bottom row, so the game goes on */
  let n = E.newGame("EXPERT");
  for (const m of DRAWN) n = E.applyMove(n, m);
  ok(E.isFull(n.board) && [0, 1, 2, 3, 4, 5, 6].some(c => n.board[c] === n.turn), "PopOut replay reaches the full board");
  ok(n && n.winner === 0 && n.draw === null, "PopOut: a full board is not a draw while the next player can pop");
  ok(E.legalMoves(n.board, n.turn, "popout").every(m => m >= POP), "PopOut: on a full board only pops are left");
  /* a full board where the next player has no bottom disc is stuck */
  const b = n.board.slice();
  for (let c = 0; c < COLS; c++) b[c] = YOU;          /* bottom row all yours (no four check needed: stuck test) */
  ok(E.stuck(b, OWL, "popout") && !E.stuck(b, YOU, "popout"), "PopOut: stuck only when you have no bottom disc");
  ok(E.stuck(b, OWL, "classic") && E.stuck(b, YOU, "classic"), "classic: a full board is stuck for both");
}
/* PopOut: three repeats of a position is a draw, on exactly the third time */
{
  let s = E.newGame("EXPERT");
  const cycle = [0, 6, POP + 0, POP + 6];              /* drop, drop, pop, pop: back to empty */
  const states = [];
  for (let k = 0; k < 2; k++) for (const m of cycle) { s = E.applyMove(s, m); states.push(s); }
  ok(states.slice(0, 7).every(x => x && !E.isOver(x)), "PopOut: no draw before the third repeat");
  ok(s && s.draw === "repeat" && s.winner === 0, "PopOut: the empty board with you to move, a third time, is a draw");
}
/* PopOut: a pop that makes a four for both sides wins for the popper; a pop that makes one only
   for the other side loses */
{
  const B = E.emptyBoard();
  /* column 0 bottom-up: YOU, OWL, YOU, OWL; columns 1-3: OWL, YOU, OWL. Popping your bottom
     disc slides column 0 down to OWL, YOU, OWL — row 1 becomes all yours and rows 0 and 2 all
     the owl's */
  const put = (r, c, p) => { B[at(r, c)] = p; };
  [YOU, OWL, YOU, OWL].forEach((p, r) => put(r, 0, p));
  for (let c = 1; c <= 3; c++) { put(0, c, OWL); put(1, c, YOU); put(2, c, OWL); }
  ok(!oracleFour(B, YOU) && !oracleFour(B, OWL), "double-four fixture starts with no four");
  const s = { level: "EXPERT", rules: "popout", board: B, turn: YOU, winner: 0, draw: null, line: [], last: null, moves: 0, seen: {} };
  const n = E.applyMove(s, POP + 0);
  ok(oracleFour(n.board, YOU) && oracleFour(n.board, OWL), "the pop makes a four for both sides");
  ok(n.winner === YOU, "PopOut: a pop that makes fours for both wins for the popper");
  ok(n.line.every(i => n.board[i] === YOU), "the lit line is the popper's");
  /* same idea, but you pop from a column where only the owl gets a line */
  const C = E.emptyBoard();
  const put2 = (r, c, p) => { C[at(r, c)] = p; };
  [YOU, OWL, OWL].forEach((p, r) => put2(r, 0, p));
  for (let c = 1; c <= 3; c++) { put2(0, c, OWL); put2(1, c, YOU); }
  put2(0, 4, YOU);
  ok(!oracleFour(C, YOU) && !oracleFour(C, OWL), "gift fixture starts with no four");
  const t = { ...s, board: C };
  const u = E.applyMove(t, POP + 0);
  ok(u && u.winner === OWL, "PopOut: a pop that gives only the owl a four loses");
  ok(E.gifts(C, YOU, "popout", POP + 0), "gifts() sees a pop that hands over a four");
}

/* ---- 5. the search: alpha-beta equals plain minimax, exact in the endgame ----------------- */
{
  const rng = mulberry32(202);
  let bad = 0, n = 0;
  for (let i = 0; i < stress(300); i++) {
    const rules = i % 2 ? "popout" : "classic";
    const s = randomPosition(rng, rules, 4 + Math.floor(rng() * 24));
    const depth = 1 + (i % (rules === "popout" ? 3 : 4));
    const res = E.searchRoot(s.board, s.turn, rules, depth);
    const truth = E.legalMoves(s.board, s.turn, rules).map(m => ({ m, v: childMinimax(s.board, s.turn, m, depth, rules) }));
    const best = Math.max(...truth.map(x => x.v));
    const want = truth.filter(x => x.v === best).map(x => x.m).sort((a, b) => a - b);
    n++;
    if (res.best !== best || JSON.stringify(res.bestMoves.slice().sort((a, b) => a - b)) !== JSON.stringify(want)) {
      bad++; if (bad < 4) console.log("  search mismatch", rules, depth, res.best, best, res.bestMoves, want);
    }
    if (res.best !== minimax(s.board, s.turn, depth, rules)) bad++;
  }
  ok(bad === 0, "alpha-beta root agrees with plain minimax (value and every best move): " + bad + "/" + n + " off");
}
{
  const rng = mulberry32(303);
  let bad = 0, n = 0, results = { "-1": 0, 0: 0, 1: 0 };
  while (n < stress(400)) {
    const s = randomPosition(rng, "classic", 32 + Math.floor(rng() * 6));
    const empties = s.board.filter(v => v === EMPTY).length;
    if (empties > 9) continue;
    n++;
    const truth = solve(s.board, s.turn, "classic");
    const res = E.searchRoot(s.board, s.turn, "classic", empties);
    results[truth]++;
    if (sign(res.best) !== truth) bad++;
    /* and every move the owl would pick really achieves that result */
    for (const m of res.bestMoves) {
      const nb = E.play(s.board, s.turn, m);
      const v = oracleFour(nb, s.turn) ? 1 : -solve(nb, E.other(s.turn), "classic");
      if (v !== truth) bad++;
    }
  }
  ok(bad === 0, "full-depth search is exact on " + n + " classic endgames (" + bad + " wrong)");
  ok(results[1] && results[-1] && results[0], "endgame sample covers wins, losses and draws: " + JSON.stringify(results));
}
{
  const rng = mulberry32(404);
  let bad = 0;
  for (let i = 0; i < stress(60); i++) {
    const rules = i % 2 ? "popout" : "classic";
    const s = randomPosition(rng, rules, 2 + Math.floor(rng() * 20));
    const L = LEVELS[rules === "popout" ? "EXPERT" : "HARD"];
    const res = E.deepSearch(s.board, s.turn, rules, L.depth, L.nodes);
    if (res.nodes > L.nodes + 1) bad++;
    if (!(res.depth <= L.depth && (res.depth >= 2 || Math.abs(res.best) >= WIN))) bad++;   /* depth 1 only for a proven result */
    if (res.depth < L.depth && Math.abs(res.best) < WIN && res.nodes <= L.nodes) bad++;  /* stopped early for no reason */
    const again = E.searchRoot(s.board, s.turn, rules, res.depth);
    if (again.best !== res.best) bad++;
  }
  ok(bad === 0, "deepSearch stays in budget and returns a real completed search: " + bad + " off");
}

/* ---- 6. the owl's tactics on random positions --------------------------------------------- */
{
  const rng = mulberry32(505);
  const stats = {};
  for (const level of ["EASY", "MEDIUM", "HARD", "EXPERT", "HINT"]) {
    const rules = level === "EXPERT" ? "popout" : "classic";
    let illegal = 0, missedWin = 0, gifted = 0, missedMate = 0, winChances = 0, blockChances = 0;
    const samples = level === "HARD" || level === "EXPERT" ? stress(250) : stress(1500);
    for (let i = 0; i < samples; i++) {
      const base = randomPosition(rng, rules, 3 + Math.floor(rng() * 28));
      const s = { ...base, level: level === "HINT" ? "MEDIUM" : level };
      const m = level === "HINT" ? E.hintMove(s, rng) : E.owlMove(s, rng);
      const b = s.board, p = s.turn;
      if (!E.isLegal(b, p, rules, m)) { illegal++; continue; }
      const wins = E.winningMoves(b, p, rules);
      if (wins.length) { winChances++; if (!wins.includes(m)) missedWin++; continue; }
      const safe = E.legalMoves(b, p, rules).filter(x => !E.gifts(b, p, rules, x));
      if (E.winningMoves(b, E.other(p), rules).length) blockChances++;
      if (safe.length && E.gifts(b, p, rules, m)) gifted++;
      /* a searching owl finds a forced win in two of its moves when there is one */
      if ((level === "HARD" || level === "EXPERT") && childMinimax(b, p, m, 3, rules) < WIN) {
        const any = E.legalMoves(b, p, rules).some(x => childMinimax(b, p, x, 3, rules) >= WIN);
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
    if (level === "HARD" || level === "EXPERT") ok(missedMate === 0, level + ": finds every win-in-two (" + missedMate + " missed)");
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
      else if (player === "random") { const ms = E.legalMoves(s.board, s.turn, s.rules); m = ms[Math.floor(rng() * ms.length)]; }
      else if (player === "careful") m = E.carefulMove(s.board, s.turn, s.rules, rng);
      else m = E.gentleMove(s.board, s.turn, s.rules, rng);
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
  const hardR = match("HARD", "random", g(24), 5);
  const hardC = match("HARD", "careful", g(24), 6);
  const expR = match("EXPERT", "random", g(24), 7);
  const expC = match("EXPERT", "careful", g(24), 8);
  const rate = t => t.owl / (t.owl + t.you + t.draw);
  ok(rate(easyR) > 0.5, "EASY still beats a random player most of the time");
  ok(easyC.you > easyC.owl, "EASY is beatable: a careful player wins more than it loses");
  ok(rate(medR) > 0.9, "MEDIUM beats a random player");
  ok(rate(medR) > rate(easyR) && rate(medC) > rate(easyC), "MEDIUM is stronger than EASY");
  ok(rate(hardR) >= 0.97 && rate(expR) >= 0.97, "HARD and EXPERT crush a random player");
  ok(rate(hardC) > 0.6 && rate(hardC) > rate(medC), "HARD beats a careful player and is stronger than MEDIUM");
  ok(rate(expC) > 0.6, "EXPERT beats a careful player");
}

report("connect-four engine");
