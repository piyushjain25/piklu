/* Stress test for the tick-tock-toe engine, loaded straight out of the shipped index.html. */
"use strict";
const { loadEngine, tally } = require('../../lib/harness.js');
const { ok, report, checks, fails } = tally();
const E = loadEngine('tick-tock-toe');

function mulberry32(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const LV = Object.keys(E.LEVELS);

/* ---------- A. invariants, checked after every applyMove ---------- */
function checkState(s, prevBoard, mover) {
  for (const p of ['X', 'O']) {
    const q = s.queues[p];
    const atWin = s.winner === p;
    ok(atWin ? q.length <= s.K + 1 : q.length <= s.K, `queue ${p} length ${q.length} vs K=${s.K}`);
    ok(new Set(q).size === q.length, 'no duplicate index in a queue');
    for (const i of q) ok(s.board[i] === p, 'queue index holds that mark');
    let n = 0; for (let i = 0; i < 9; i++) if (s.board[i] === p) n++;
    ok(n === q.length, `board count ${n} matches queue ${q.length} for ${p}`);
    const f = E.fadingIndex(s, p);
    ok(f === -1 || f === q[0], 'fadingIndex is the oldest or -1');
    ok((q.length >= s.K) === (f >= 0), 'fading shown exactly at the limit');
  }
  ok(!(s.queues.X.some(i => s.queues.O.indexOf(i) >= 0)), 'no index in both queues');
  if (s.evicted >= 0) {
    ok(s.board[s.evicted] === null, 'evicted square is now empty');
    ok(prevBoard[s.evicted] === mover, 'evicted square held the mover\'s mark');
    ok(s.winner === null, 'no eviction on a winning move');
  }
  if (s.winner) {
    const L = E.lineFor(s.board, s.winner);
    ok(!!L && L.join() === s.line.join(), 'cached winning line matches the board');
    ok(E.lineFor(s.board, s.winner === 'X' ? 'O' : 'X') === null, 'only one winner');
    ok(s.evicted === -1, 'winner keeps all K+1 marks');
  }
}

/* ---------- personas ---------- */
function pRandom(s, rand) { const m = E.legalMoves(s); return m[Math.floor(rand() * m.length)]; }
function pGreedy(s, rand) {
  const m = E.legalMoves(s);
  for (const i of m) if (E.applyMove(s, i).winner === 'X') return i;
  const th = E.winSquares(s.board, 'O').filter(i => m.indexOf(i) >= 0);
  if (th.length) return th[0];
  if (m.indexOf(4) >= 0) return 4;
  const c = [0, 2, 6, 8].filter(i => m.indexOf(i) >= 0);
  if (c.length) return c[Math.floor(rand() * c.length)];
  return m[Math.floor(rand() * m.length)];
}

/* "fade-aware": greedy, plus it values a line whose third square holds an OWL mark — the
   square that comes good when that mark fades. Models a kid who has understood the rule.
   Uses only board information, so it is valid on the hidden-fade levels too. */
function pSmart(s, rand) {
  const m = E.legalMoves(s);
  for (const i of m) if (E.applyMove(s, i).winner === 'X') return i;
  const th = E.winSquares(s.board, 'O').filter(i => m.indexOf(i) >= 0);
  if (th.length) return th[0];
  let best = m[0], bs = -1e9;
  for (const i of m) {
    const n = E.applyMove(s, i);
    let sc = E.winSquares(n.board, 'X').length * 100;
    for (const L of E.LINES) {
      let x = 0, o = 0;
      for (const c of L) { if (n.board[c] === 'X') x++; else if (n.board[c] === 'O') o++; }
      if (x === 2 && o === 1) sc += 14;
    }
    sc += E.POSW[i] + rand();
    if (sc > bs) { bs = sc; best = i; }
  }
  return best;
}

/* audit counters for section D */
let missedWin = 0, avoidableLoss = 0, aiTurns = 0, evictionTraps = 0, trapTaken = 0;

function playGame(level, persona, rand, opts) {
  let s = E.newGame(level);
  const seen = [];
  while (!s.over) {
    const prevBoard = s.board.slice(), mover = s.turn;
    let mv;
    if (s.turn === 'X') {
      mv = persona(s, rand);
      ok(E.legalMoves(s).indexOf(mv) >= 0, 'persona played a legal square');
    } else {
      const before = JSON.stringify(s);
      const legal = E.legalMoves(s);
      const wins = legal.filter(i => E.applyMove(s, i).winner === 'O');
      const safe = legal.filter(i => E.winSquares(E.applyMove(s, i).board, 'X').length === 0);
      // a move that is unsafe ONLY because of the owl's own eviction
      for (const i of legal) {
        const n = E.applyMove(s, i);
        if (n.evicted < 0) continue;
        const noEvict = n.board.slice(); noEvict[n.evicted] = 'O';
        if (E.winSquares(n.board, 'X').length > 0 && E.winSquares(noEvict, 'X').length === 0) { evictionTraps++; break; }
      }
      mv = E.aiMove(s, rand, opts);
      ok(JSON.stringify(s) === before, 'aiMove did not mutate the state');
      ok(legal.indexOf(mv) >= 0, 'aiMove played a legal square');
      aiTurns++;
      if (wins.length && wins.indexOf(mv) < 0) missedWin++;
      if (!wins.length && safe.length && safe.indexOf(mv) < 0) {
        avoidableLoss++;
        const n = E.applyMove(s, mv);
        if (n.evicted >= 0) { const ne = n.board.slice(); ne[n.evicted] = 'O'; if (E.winSquares(ne, 'X').length === 0) trapTaken++; }
      }
    }
    const before = JSON.stringify(s);
    const next = E.applyMove(s, mv);
    ok(JSON.stringify(s) === before, 'applyMove did not mutate its input');
    checkState(next, prevBoard, mover);
    s = next; seen.push(mv);
  }
  ok(E.legalMoves(s).length === 0, 'no legal moves once over');
  ok(s.ply <= E.MOVE_CAP, `game ended within the cap (${s.ply})`);
  return s;
}

/* ---------- run ---------- */
console.log('— A/B. invariants, rules, purity —');
const rand = mulberry32(12345);
for (const level of LV) for (let g = 0; g < 1500; g++) {
  playGame(level, g % 2 ? pGreedy : pRandom, rand);
}
console.log(`  ${checks()} assertions, ${fails()} failures`);

/* illegal-move rejection, including a fading square */
{
  let s = E.newGame('EASY');
  s = E.applyMove(s, 0); s = E.applyMove(s, 4); s = E.applyMove(s, 1);
  ok(E.fadingIndex(s, 'X') === 0, 'X is at the limit, oldest is square 0');
  let threw = false; try { E.applyMove(s, 0); } catch (e) { threw = true; }
  ok(threw, 'applyMove throws on an occupied FADING square');
  threw = false; try { E.applyMove(s, 4); } catch (e) { threw = true; }
  ok(threw, 'applyMove throws on an occupied square');
}

/* a fading mark wins: for every line, X's OLDEST mark sits on it */
for (const L of E.LINES) {
  let s = E.newGame('EASY');
  // X: L[0] (oldest) then L[1]; O fills two squares off the line
  const off = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(i => L.indexOf(i) < 0);
  s = E.applyMove(s, L[0]); s = E.applyMove(s, off[0]);
  s = E.applyMove(s, L[1]); s = E.applyMove(s, off[1]);
  ok(E.fadingIndex(s, 'X') === L[0], `oldest X is on the line ${L}`);
  const n = E.applyMove(s, L[2]);
  ok(n.winner === 'X', `fading mark completes line ${L}`);
  ok(n.evicted === -1, 'no eviction on that winning move');
  ok(n.board[L[0]] === 'X', 'the fading mark is still on the board at the win');
}

/* eviction order keeps exactly the last K */
for (const [lvl, K] of [['EASY', 2], ['HARD', 3]]) {
  let s = E.newGame(lvl);
  const xs = [0, 1, 3, 6, 7], os = [2, 5, 8, 4];  // deliberately non-winning for both
  for (let i = 0; i < 4; i++) { s = E.applyMove(s, xs[i]); if (s.over) break; s = E.applyMove(s, os[i]); if (s.over) break; }
  if (!s.over) ok(s.queues.X.join() === xs.slice(4 - K, 4).join(), `${lvl}: survivors are the last ${K}`);
}
console.log(`  running total: ${checks()} assertions, ${fails()} failures`);

/* ---------- D. AI correctness at slip:0 ---------- */
console.log('— D. AI correctness (slip: 0) —');
missedWin = avoidableLoss = aiTurns = evictionTraps = trapTaken = 0;
{
  const r = mulberry32(777);
  for (const level of LV) for (let g = 0; g < 2500; g++) playGame(level, g % 2 ? pGreedy : pRandom, r, { slip: 0 });
  console.log(`  ${aiTurns} owl turns · missed wins: ${missedWin} · avoidable losses: ${avoidableLoss}`);
  console.log(`  eviction-trap positions encountered: ${evictionTraps}`);
  ok(missedWin === 0, 'the owl never misses an immediate win');
  ok(avoidableLoss === 0, 'the owl never leaves an avoidable immediate loss');
  ok(evictionTraps > 0, 'eviction-trap logic is actually exercised');
}

/* the slip must never discard a win, at real slip rates */
{
  const r = mulberry32(999);
  missedWin = 0; aiTurns = 0;
  for (const level of LV) for (let g = 0; g < 2000; g++) playGame(level, g % 2 ? pGreedy : pRandom, r);
  ok(missedWin === 0, 'even with slip on, the owl never misses an immediate win');
  console.log(`  ${aiTurns} owl turns at real slip rates · missed wins: ${missedWin}`);
}

/* ---------- C/E. termination + balance ---------- */
console.log('— C/E. termination and balance (8000 games per level per persona) —');
const N = 8000;
for (const level of LV) {
  const row = [];
  for (const [name, persona] of [['random', pRandom], ['greedy', pGreedy], ['smart', pSmart]]) {
    const r = mulberry32(4242);
    let w = 0, l = 0, t = 0, plies = [];
    for (let g = 0; g < N; g++) {
      const s = playGameFast(level, persona, r);
      if (s.result === 'X') w++; else if (s.result === 'O') l++; else t++;
      plies.push(s.ply);
    }
    plies.sort((a, b) => a - b);
    row.push({ name, w: w / N, l: l / N, t: t / N, med: plies[N >> 1], p99: plies[Math.floor(N * .99)], max: plies[N - 1] });
  }
  console.log(`  ${level.padEnd(7)} ` + row.map(x =>
    `${x.name}: win ${(x.w * 100).toFixed(1)}% lose ${(x.l * 100).toFixed(1)}% tie ${(x.t * 100).toFixed(1)}% (med ${x.med}, p99 ${x.p99})`
  ).join('\n          '));
  const g = row[1], h = row[2], rr = row[0];
  ok(rr.w > 0 && rr.w < 0.20, `${level}: a random player wins sometimes but rarely (${(rr.w * 100).toFixed(1)}%)`);
  ok(g.w >= 0.15 && g.w <= 0.65, `${level}: a greedy player wins a healthy share (${(g.w * 100).toFixed(1)}%)`);
  ok(h.w > rr.w, `${level}: understanding the fade rule beats playing randomly (${(h.w * 100).toFixed(1)}% vs ${(rr.w * 100).toFixed(1)}%)`);
  ok(g.t <= 0.15, `${level}: greedy games rarely hit the tie cap (${(g.t * 100).toFixed(1)}%)`);
  ok(row.every(x => x.max <= E.MOVE_CAP), `${level}: every game ends within the cap`);
}
function playGameFast(level, persona, rand, opts) {
  let s = E.newGame(level);
  while (!s.over) s = E.applyMove(s, s.turn === 'X' ? persona(s, rand) : E.aiMove(s, rand, opts));
  return s;
}

/* ---------- guardrail: the vacated-square win, and why slip differs by K ---------- */
console.log('— guardrail: how the game is actually won —');
{
  /* The K=2 win the first "drawishness" proof missed. X must keep a pair on a line whose
     third square holds the owl's OLDEST mark — note X's own placement evicts X's oldest,
     so the pair has to be (kept mark + new mark), not the two marks X already had.
       X 4, O 0, X 1, O 5   ->  X:[4,1]  O:[0,5], owl's oldest is square 0
       X plays 2            ->  X:[1,2]  (4 evicted); X now needs square 0
     Every owl move must evict square 0, and it may not play square 0 while its own mark is
     still there, so it cannot stop X taking it. */
  let s = E.newGame('EASY');
  for (const m of [4, 0, 1, 5]) s = E.applyMove(s, m);
  ok(!s.over && s.turn === 'X', 'setup position reached with X to move');
  s = E.applyMove(s, 2);
  ok(s.queues.X.join() === '1,2', 'X kept 1 and 2; the older mark on 4 was evicted');
  ok(s.board[0] === 'O' && E.fadingIndex(s, 'O') === 0, 'square 0 holds the owl\'s fading mark');
  ok(E.winSquares(s.board, 'X').length === 0, 'X has no threat yet — square 0 is still occupied');
  let escaped = 0;
  for (let t = 0; t < 200; t++) {
    const owl = E.applyMove(s, E.aiMove(s, mulberry32(t + 1), { slip: 0 }));
    if (owl.winner === 'O' || owl.board[0] !== null) { escaped++; continue; }
    const win = E.applyMove(owl, 0);
    if (win.winner !== 'X') escaped++;
  }
  ok(escaped === 0, `the owl cannot escape the fade trap (escaped ${escaped}/200)`);
}

{
  /* The balance correction this encodes: three pieces let the ATTACKER fork, so at equal
     slip the 3-piece levels are EASIER. If anyone equalises the slips, this fails. */
  const r1 = mulberry32(31337), r2 = mulberry32(31337);
  const winRate = (level, rand, slip) => {
    let w = 0;
    for (let g = 0; g < 3000; g++) { const s = playGameFast(level, pGreedy, rand, { slip }); if (s.result === 'X') w++; }
    return w / 3000;
  };
  const k2 = winRate('EASY', r1, 0), k3 = winRate('HARD', r2, 0);
  console.log(`  at equal slip 0: K=2 lets greedy win ${(k2 * 100).toFixed(1)}%, K=3 ${(k3 * 100).toFixed(1)}%`);
  ok(k3 > k2, 'three pieces really is easier for the attacker — hence the lower slip at K=3');
}

/* ---------- perf ---------- */
{
  const r = mulberry32(1);
  const t0 = Date.now(); let turns = 0;
  while (turns < 20000) { let s = E.newGame('EXPERT'); while (!s.over) { if (s.turn === 'O') turns++; s = E.applyMove(s, s.turn === 'X' ? pRandom(s, r) : E.aiMove(s, r)); } }
  console.log(`— perf: ${turns} owl turns in ${Date.now() - t0}ms —`);
}

report('tick-tock-toe engine');
