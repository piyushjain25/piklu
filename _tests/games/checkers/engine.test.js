"use strict";
/* Checkers. The rules are the whole game here, so the bulk of this file is an independent
   referee — written from the rules of English draughts rather than from the engine, using a
   character grid and rays of squares instead of the engine's flat board — and every legal
   move list is checked against it. The rest proves the owl: alpha-beta agrees with plain
   minimax, the node budget really caps the search, and a deeper owl picks better moves. */
const { loadEngine, gameHTML, inlineScript, mulberry32, tally, stress } = require("../../lib/harness.js");
const E = loadEngine("checkers");
const { ok, report } = tally();

const sq = i => E.rowOf(i) + "," + E.colOf(i);
const canonMove = m =>
  sq(m.from) + ">" + m.steps.map(sq).join(">") + "x" + m.caps.map(sq).join(">") + (m.crown ? "K" : "");
const engineMoves = s => E.legalMoves(s).map(canonMove).sort();
const show = b => "\n" + E.formatBoard(b).join("\n");

/* ===== 1. the board ===================================================================== */

ok(E.isDark(E.idx(7, 0)) && E.isDark(E.idx(0, 1)), "the bottom-left square is dark, as on a real board");
ok(!E.isDark(E.idx(7, 1)) && !E.isDark(E.idx(0, 0)), "light squares are light");

const start = E.newGame("EASY");
ok(E.countPieces(start.b, E.RED) === 12 && E.countPieces(start.b, E.BLACK) === 12,
   "the game starts 12 pieces a side");
ok(start.b.every((v, i) => v === E.EMPTY || E.isDark(i)), "no piece ever starts on a light square");
ok(start.b.filter(v => v === E.R_MAN).length === 12 && start.b.filter(v => v === E.B_MAN).length === 12,
   "every starting piece is a man");
ok(start.turn === E.RED, "red — the player — moves first");
ok(E.legalMoves(start).length === 7, "the opening position has the 7 legal moves a real board has");
ok(E.legalMoves(start).every(m => m.caps.length === 0 && !m.crown), "none of them jumps or crowns");
ok(E.formatBoard(E.parseBoard(E.formatBoard(start.b))).join("") === E.formatBoard(start.b).join(""),
   "parseBoard and formatBoard are inverses");

/* rows 3 and 4 are the empty no-man's land */
ok(start.b.slice(24, 40).every(v => v === E.EMPTY), "the two middle rows start empty");

/* ===== 2. the level table =============================================================== */

const KEYS = ["EASY", "MEDIUM", "HARD", "EXPERT"];
ok(Object.keys(E.LEVELS).join(",") === KEYS.join(","), "four levels, in order");
for (const k of KEYS) {
  const L = E.LEVELS[k];
  ok(/^\S+ [A-Z][a-z]+$/.test(L.label), k + ": label is one line of emoji + name, got " + L.label);
  ok(L.depth >= 1 && L.budget >= 1000, k + ": has a search depth and a node budget");
}
for (let i = 1; i < KEYS.length; i++) {
  ok(E.LEVELS[KEYS[i]].depth > E.LEVELS[KEYS[i - 1]].depth, KEYS[i] + " searches deeper than " + KEYS[i - 1]);
  ok(E.LEVELS[KEYS[i]].budget > E.LEVELS[KEYS[i - 1]].budget, KEYS[i] + " gets a bigger node budget");
  ok(E.LEVELS[KEYS[i]].slip <= E.LEVELS[KEYS[i - 1]].slip, KEYS[i] + " slips no more often than " + KEYS[i - 1]);
}
ok(KEYS.every(k => E.LEVELS[k].fly === (k === "EXPERT")), "only EXPERT changes the rules to flying kings");
ok(E.newGame("EXPERT").fly === true && E.newGame("HARD").fly === false, "newGame carries its level's rules");

/* the owl must cost the same on every machine: a node budget, never a clock */
const SRC = inlineScript(gameHTML("checkers"));
ok(!/Date\.now|performance\.now|setTimeout\s*\(\s*[^)]*negamax/.test(SRC.split("===== DOM")[0]),
   "the engine never reads a clock — the search is capped by nodes");

/* ===== 3. an independent referee ======================================================== */

const DIRS4 = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const RAY = (r, c, dr, dc) => {
  const out = [];
  for (let rr = r + dr, cc = c + dc; rr >= 0 && rr < 8 && cc >= 0 && cc < 8; rr += dr, cc += dc) out.push([rr, cc]);
  return out;
};
const dirsOf = ch => ch === "R" || ch === "B" ? DIRS4
                   : ch === "r" ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
const isMine = (ch, t) => ch !== "." && ch.toLowerCase() === t;
const isFoe = (ch, t) => ch !== "." && ch.toLowerCase() !== t;
const crownRow = t => t === "r" ? 0 : 7;
const toGrid = b => {
  const back = { 0: ".", 1: "r", 2: "R", "-1": "b", "-2": "B" }, g = [];
  for (let r = 0; r < 8; r++) {
    const row = [];
    for (let c = 0; c < 8; c++) row.push(back[b[r * 8 + c]]);
    g.push(row);
  }
  return g;
};
const canon = (fr, fc, steps, caps, crown) =>
  fr + "," + fc + ">" + steps.map(s => s.join(",")).join(">") +
  "x" + caps.map(s => s.join(",")).join(">") + (crown ? "K" : "");

/* a jump chain, walked square by square: the piece is off the grid for the whole walk and each
   victim comes off as it is taken; a chain is written down only where it can go no further */
function refJumps(g, r0, c0, fr, fc, ch, t, fly, steps, caps, out) {
  const king = ch === ch.toUpperCase(), far = fly && king;
  for (const [dr, dc] of dirsOf(ch)) {
    const line = RAY(r0, c0, dr, dc);
    let v = 0;
    if (far) while (v < line.length && g[line[v][0]][line[v][1]] === ".") v++;
    if (v >= line.length) continue;
    const [vr, vc] = line[v];
    if (!isFoe(g[vr][vc], t)) continue;
    for (let j = v + 1; j < line.length; j++) {
      const [lr, lc] = line[j];
      if (g[lr][lc] !== ".") break;
      const saved = g[vr][vc];
      g[vr][vc] = ".";
      steps.push([lr, lc]); caps.push([vr, vc]);
      if (!king && lr === crownRow(t)) out.push(canon(fr, fc, steps, caps, true));
      else {
        const n = out.length;
        refJumps(g, lr, lc, fr, fc, ch, t, fly, steps, caps, out);
        if (out.length === n) out.push(canon(fr, fc, steps, caps, false));
      }
      steps.pop(); caps.pop();
      g[vr][vc] = saved;
      if (!far) break;
    }
  }
}

function refMoves(b, turn, fly) {
  const g = toGrid(b), t = turn === E.RED ? "r" : "b", jumps = [], walks = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const ch = g[r][c];
    if (!isMine(ch, t)) continue;
    g[r][c] = ".";
    refJumps(g, r, c, r, c, ch, t, fly, [], [], jumps);
    g[r][c] = ch;
  }
  if (jumps.length) return jumps.sort();          /* a jump on the board makes every walk illegal */
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const ch = g[r][c];
    if (!isMine(ch, t)) continue;
    const king = ch === ch.toUpperCase();
    for (const [dr, dc] of dirsOf(ch)) {
      for (const [rr, cc] of RAY(r, c, dr, dc)) {
        if (g[rr][cc] !== ".") break;
        walks.push(canon(r, c, [[rr, cc]], [], !king && rr === crownRow(t)));
        if (!(fly && king)) break;
      }
    }
  }
  return walks.sort();
}

/* a random legal position: a handful of pieces each, men never on the row they would already
   have been crowned on — it reaches king endgames that random play takes hundreds of plies to */
function randomBoard(rnd) {
  const b = new Array(64).fill(E.EMPTY), darks = [];
  for (let i = 0; i < 64; i++) if (E.isDark(i)) darks.push(i);
  for (let i = darks.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = darks[i]; darks[i] = darks[j]; darks[j] = t;
  }
  let k = 0;
  for (let n = 1 + Math.floor(rnd() * 8); n > 0; n--) {
    const i = darks[k++];
    b[i] = (rnd() < 0.5 || E.rowOf(i) === 0) ? E.R_KING : E.R_MAN;
  }
  for (let n = 1 + Math.floor(rnd() * 8); n > 0; n--) {
    const i = darks[k++];
    b[i] = (rnd() < 0.5 || E.rowOf(i) === 7) ? E.B_KING : E.B_MAN;
  }
  return b;
}

for (const fly of [false, true]) {
  const rnd = mulberry32(fly ? 991 : 7);
  const tag = fly ? " (flying kings)" : "";
  let seen = 0, bad = 0, firstBad = "";

  const compare = s => {
    seen++;
    const mine = engineMoves(s).join("|"), ref = refMoves(s.b, s.turn, fly).join("|");
    if (mine !== ref && bad++ === 0)
      firstBad = show(s.b) + "\n  " + (s.turn === E.RED ? "red" : "black") + " to move" +
                 "\n  engine: " + mine + "\n  referee: " + ref;
  };

  /* positions a real game passes through */
  for (let g = 0; g < stress(500); g++) {
    let s = E.makeState(E.startBoard(), E.RED, fly, 0);
    for (let ply = 0; ply < 160; ply++) {
      compare(s);
      const ms = E.legalMoves(s);
      if (!ms.length || E.result(s) !== null) break;
      s = E.applyMove(s, ms[Math.floor(rnd() * ms.length) % ms.length]);
    }
  }
  /* and positions it very rarely does */
  for (let n = 0; n < stress(9000); n++)
    compare(E.makeState(randomBoard(rnd), rnd() < 0.5 ? E.RED : E.BLACK, fly, 0));

  ok(bad === 0, "legalMoves matches the independent referee in all " + seen + " positions" + tag +
                (bad ? " — " + bad + " disagreed, first:" + firstBad : ""));
  ok(seen > 1000, "checked a real number of positions" + tag + ", got " + seen);
}

/* ===== 4. the rules, one at a time ====================================================== */

const pos = (rows, turn, fly, quiet) => E.makeState(E.parseBoard(rows), turn, fly, quiet || 0);
const EMPTY8 = ["........", "........", "........", "........", "........", "........", "........", "........"];
const at = (rows, r, c, ch) => {
  const out = rows.slice();
  out[r] = out[r].slice(0, c) + ch + out[r].slice(c + 1);
  return out;
};
const board = pairs => pairs.reduce((rows, p) => at(rows, p[0], p[1], p[2]), EMPTY8);

/* a jump is compulsory: the quiet move alongside it is not legal at all */
let s = pos(board([[4, 3, "b"], [5, 2, "r"]]), E.RED, false);
let ms = E.legalMoves(s);
ok(ms.length === 1 && ms[0].caps.length === 1, "a jump on the board is compulsory — the walk is gone");
ok(ms[0].from === E.idx(5, 2) && ms[0].to === E.idx(3, 4) && ms[0].caps[0] === E.idx(4, 3),
   "the jump lands over the victim");
ok(E.quietMoves(s).length === 1 && E.quietMoves(s)[0].to === E.idx(4, 1),
   "…though the walk still exists — quietMoves sees it, legalMoves does not");

/* a chain must be played to its end: the single jump is not offered */
s = pos(board([[4, 3, "b"], [2, 3, "b"], [5, 2, "r"]]), E.RED, false);
ms = E.legalMoves(s);
ok(ms.length === 1 && ms[0].caps.length === 2 && ms[0].to === E.idx(1, 2),
   "a double jump must be played out, not stopped halfway");
ok(ms[0].steps.length === 2 && ms[0].steps[0] === E.idx(3, 4), "the chain records every square landed on");
let after = E.applyMove(s, ms[0]);
ok(E.countPieces(after.b, E.BLACK) === 0, "both victims come off the board");

/* a man crowned mid-jump stops there, even with another jump waiting */
s = pos(board([[1, 2, "b"], [1, 4, "b"], [2, 1, "r"]]), E.RED, false);
ms = E.legalMoves(s);
ok(ms.length === 1 && ms[0].caps.length === 1 && ms[0].crown && ms[0].to === E.idx(0, 3),
   "a man that reaches the back row is crowned and the move ends");
after = E.applyMove(s, ms[0]);
ok(after.b[E.idx(0, 3)] === E.R_KING, "…as a king");
ok(after.b[E.idx(1, 4)] === E.B_MAN, "…and the jump it could have made as a king is still there to make");

/* a man never walks or jumps backwards; the same piece crowned does both */
const backwards = board([[3, 2, "r"], [4, 3, "b"], [0, 1, "B"]]);
s = pos(backwards, E.RED, false);
ok(E.captureMoves(s).length === 0 && E.legalMoves(s).length === 2, "a man cannot jump backwards");
ok(E.legalMoves(s).every(m => E.rowOf(m.to) < E.rowOf(m.from)), "…and only ever walks forward");
s = pos(at(backwards, 3, 2, "R"), E.RED, false);
ms = E.legalMoves(s);
ok(ms.length === 1 && ms[0].caps[0] === E.idx(4, 3) && ms[0].to === E.idx(5, 4),
   "a king jumps backwards, and must");

/* a king can jump a full circuit and come home: four victims round a square, and the move
   ends on the square it started from. The board UI has to cope with to === from. */
s = pos(board([[4, 3, "R"], [3, 4, "b"], [3, 6, "b"], [5, 6, "b"], [5, 4, "b"]]), E.RED, false);
ms = E.legalMoves(s);
ok(ms.length === 2 && ms.every(m => m.caps.length === 4 && m.to === m.from && m.to === E.idx(4, 3)),
   "a king rounds up four men and lands back where it started, either way round");
after = E.applyMove(s, ms[0]);
ok(after.b[E.idx(4, 3)] === E.R_KING && E.countPieces(after.b, E.BLACK) === 0,
   "…the king is still on its square and all four men are gone");

/* no legal move loses the game, whether or not any pieces are left */
s = pos(board([[7, 0, "r"], [6, 1, "b"], [5, 2, "b"]]), E.RED, false);
ok(E.legalMoves(s).length === 0 && E.result(s) === "black", "a blocked player loses even with pieces left");
s = pos(board([[5, 2, "r"]]), E.BLACK, false);
ok(E.result(s) === "red", "a player with nothing left to move loses");

/* the quiet rule: only king walks count toward it */
s = pos(board([[4, 3, "B"], [7, 0, "R"]]), E.RED, false, E.QUIET_LIMIT - 1);
ok(E.result(s) === null, "one ply short of the limit the game is still on");
ok(E.result(E.applyMove(s, E.legalMoves(s)[0])) === "draw", "a run of quiet king moves is a draw");
s = pos(board([[4, 3, "B"], [6, 1, "r"]]), E.RED, false, 40);
ok(E.applyMove(s, E.legalMoves(s).find(m => m.caps.length === 0)).quiet === 0, "moving a man resets the count");
s = pos(board([[4, 3, "b"], [5, 2, "R"]]), E.RED, false, 40);
ok(E.applyMove(s, E.legalMoves(s)[0]).quiet === 0, "so does a capture");

/* ===== 5. flying kings (EXPERT) ========================================================= */

const corner = board([[7, 0, "R"], [0, 1, "B"]]);
ok(E.legalMoves(pos(corner, E.RED, true)).length === 7, "a flying king slides the whole diagonal");
ok(E.legalMoves(pos(corner, E.RED, false)).length === 1, "…and a plain king only one square");
ok(E.legalMoves(pos(board([[5, 2, "r"], [0, 1, "B"]]), E.RED, true)).length === 2,
   "men do not fly, even at EXPERT");

/* it takes from a distance, and may land anywhere beyond */
const far = board([[7, 0, "R"], [3, 4, "b"]]);
ms = E.legalMoves(pos(far, E.RED, true));
ok(ms.length === 3 && ms.every(m => m.caps.length === 1 && m.caps[0] === E.idx(3, 4)),
   "a flying king jumps a piece three squares away, landing anywhere past it");
ok(ms.map(m => sq(m.to)).sort().join(" ") === "0,7 1,6 2,5", "…on any of the three squares beyond");
ok(E.captureMoves(pos(far, E.RED, false)).length === 0, "a plain king cannot reach that far");

/* a longer chain is still compulsory to its end, and the shorter prefix is not offered */
ms = E.legalMoves(pos(board([[7, 0, "R"], [3, 4, "b"], [1, 4, "b"]]), E.RED, true));
ok(ms.length === 3, "three ways to take the first piece");
const chain = ms.find(m => m.caps.length === 2);
ok(chain && chain.to === E.idx(0, 3) && chain.steps[0] === E.idx(2, 5),
   "the landing square that sees a second victim must take it");
ok(!ms.some(m => m.caps.length === 1 && m.to === E.idx(2, 5)), "…so stopping on it is not a legal move");

/* a flying king sails back across the square it set off from: (4,3) lies between the two
   landing squares of this chain, and it is empty because the king itself has left it */
s = pos(board([[4, 3, "R"], [2, 5, "b"], [6, 1, "b"]]), E.RED, true);
ms = E.legalMoves(s);
ok(ms.length === 4 && ms.every(m => m.caps.length === 2),
   "both ends of the diagonal must be taken, in one chain, four ways round");
ok(ms.some(m => m.steps[0] === E.idx(1, 6) && m.to === E.idx(7, 0)),
   "a flying king crosses back over the square it set off from");

/* ===== 6. what applying a move may and may not do ======================================= */

for (const fly of [false, true]) {
  const rnd = mulberry32(fly ? 4242 : 24);
  let games = 0, longest = 0, wrong = 0, note = "";
  const fail = msg => { if (wrong++ === 0) note = " — " + msg; };

  /* the first broken rule stops the sweep: a game whose rules are wrong can run for thousands
     of plies, and a thousand more of those is a hang rather than a test result */
  for (let g = 0; g < stress(1500) && wrong === 0; g++) {
    let st = E.makeState(E.startBoard(), E.RED, fly, 0), ply = 0;
    while (E.result(st) === null) {
      if (++ply > 3000) { fail("a game ran past 3000 plies — the draw rule cannot be relied on"); break; }
      const all = E.legalMoves(st);
      const jumping = all[0].caps.length > 0;
      if (all.some(m => (m.caps.length > 0) !== jumping)) fail("jumps and walks offered together");

      const m = all[Math.floor(rnd() * all.length) % all.length];
      const piece = st.b[m.from], side = E.sideOf(piece);
      if (side !== st.turn) fail("moved a piece that was not the player's");
      if (!E.isDark(m.to) || m.steps.some(x => !E.isDark(x)) || m.caps.some(x => !E.isDark(x)))
        fail("a move touched a light square");
      if (m.to !== m.steps[m.steps.length - 1]) fail("to disagrees with the last step");
      if (m.caps.length !== m.capVals.length) fail("capVals does not match caps");
      if (m.caps.some((x, i) => st.b[x] !== m.capVals[i])) fail("capVals is not what stood there");
      if (m.caps.some(x => E.sideOf(st.b[x]) !== -side)) fail("captured one of the player's own pieces");
      if (new Set(m.caps).size !== m.caps.length) fail("captured the same square twice");
      if (m.caps.length > 1 && m.steps.length !== m.caps.length) fail("a chain's steps and victims disagree");
      if (m.crown !== (!E.isKing(piece) && E.rowOf(m.to) === E.promoRow(side))) fail("crown flag is wrong");
      if (!E.isKing(piece)) {
        let prev = m.from;
        for (const st2 of m.steps) {
          if (side === E.RED ? E.rowOf(st2) >= E.rowOf(prev) : E.rowOf(st2) <= E.rowOf(prev))
            fail("a man went backwards");
          prev = st2;
        }
      }

      const before = { r: E.countPieces(st.b, E.RED), b: E.countPieces(st.b, E.BLACK), quiet: st.quiet };
      const next = E.applyMove(st, m);
      const mineNow = E.countPieces(next.b, side), foeNow = E.countPieces(next.b, -side);
      if (mineNow !== (side === E.RED ? before.r : before.b)) fail("a move lost one of the mover's own pieces");
      if (foeNow !== (side === E.RED ? before.b : before.r) - m.caps.length) fail("the wrong number came off");
      /* a king that jumps a full circuit ends where it began, so `from` is only empty
         afterwards when the move actually went somewhere */
      if (m.to !== m.from && next.b[m.from] !== E.EMPTY) fail("the piece did not leave its square");
      if (next.b[m.to] === E.EMPTY) fail("the piece did not arrive");
      if (E.isKing(next.b[m.to]) !== (E.isKing(piece) || m.crown)) fail("the piece changed rank unbidden");
      if (next.turn !== -st.turn) fail("the turn did not pass");
      if (next.b.some((v, i) => v !== E.EMPTY && !E.isDark(i))) fail("left a piece on a light square");
      const shouldReset = m.caps.length > 0 || !E.isKing(piece);
      if (next.quiet !== (shouldReset ? 0 : before.quiet + 1)) fail("the quiet count is wrong");
      st = next;
    }
    games++;
    longest = Math.max(longest, ply);
    const res = E.result(st);
    if (!["red", "black", "draw"].includes(res)) fail("a finished game had no result");
  }
  const tag = fly ? " (flying kings)" : "";
  ok(wrong === 0, "every move of " + games + " random games obeyed the rules" + tag + (wrong ? note : ""));
  ok(longest < 3000, "every random game ends" + tag + " — longest was " + longest + " plies");
}

/* ===== 7. what the board UI asks it ===================================================== */

{
  const rnd = mulberry32(555);
  let wrong = 0;
  for (let n = 0; n < stress(3000); n++) {
    const fly = rnd() < 0.5;
    const st = E.makeState(randomBoard(rnd), rnd() < 0.5 ? E.RED : E.BLACK, fly, 0);
    const all = E.legalMoves(st);
    if (!all.length) continue;

    const movable = E.movablePieces(st);
    if (movable.length !== new Set(all.map(m => m.from)).size) wrong++;
    if (!movable.every(f => E.movesFrom(st, f).length > 0)) wrong++;

    /* every legal move is reachable by tapping its squares one at a time, and nothing else is */
    for (const m of all) {
      const walked = [];
      for (let i = 0; i < m.steps.length; i++) {
        const opt = E.stepOptions(st, m.from, walked);
        if (!opt.nexts.includes(m.steps[i])) { wrong++; break; }
        if (!opt.nexts.every(nx => E.movesFrom(st, m.from).some(x =>
              x.steps.length > walked.length && x.steps[walked.length] === nx))) wrong++;
        walked.push(m.steps[i]);
      }
      const done = E.stepOptions(st, m.from, walked);
      if (!done.move || canonMove(done.move) !== canonMove(m)) wrong++;
    }
  }
  ok(wrong === 0, "stepOptions walks out exactly the legal moves, tap by tap (" + wrong + " slips)");
  ok(E.stepOptions(start, E.idx(5, 0), []).nexts.length === 1, "a start-screen piece offers its one square");
  ok(E.movesFrom(start, E.idx(7, 0)).length === 0, "a piece with nowhere to go offers nothing");
}

/* ===== 8. alpha-beta is exactly minimax ================================================= */

/* deliberately unpruned, and mirroring negamax's own order of checks so the two can only
   differ by the pruning itself */
function plainMinimax(st, depth, ply, maxPly) {
  if (st.quiet >= E.QUIET_LIMIT) return 0;
  const moves = E.legalMoves(st);
  if (moves.length === 0) return -(E.WIN - ply);
  if (depth <= 0 && (moves[0].caps.length === 0 || ply >= maxPly)) return E.evaluate(st) * st.turn;
  let best = -Infinity;
  for (const m of moves) best = Math.max(best, -plainMinimax(E.applyMove(st, m), depth - 1, ply + 1, maxPly));
  return best;
}

{
  let mismatch = 0, compared = 0, note = "";
  const rnd = mulberry32(31337);
  for (let n = 0; n < stress(350); n++) {
    const fly = n % 2 === 1;
    /* half real midgames, half sparse endgames */
    let st;
    if (n % 4 < 2) {
      st = E.makeState(E.startBoard(), E.RED, fly, 0);
      for (let k = 0, stop = 4 + Math.floor(rnd() * 14); k < stop && E.result(st) === null; k++) {
        const all = E.legalMoves(st);
        st = E.applyMove(st, all[Math.floor(rnd() * all.length) % all.length]);
      }
    } else {
      st = E.makeState(randomBoard(rnd), rnd() < 0.5 ? E.RED : E.BLACK, fly, 0);
    }
    if (E.result(st) !== null) continue;

    const D = 4;
    const res = E.searchBest(st, { depth: D, budget: Infinity, rng: () => 0 });
    const d = res.depth;
    for (const entry of res.scores) {
      const slow = -plainMinimax(E.applyMove(st, entry.move), d - 1, 1, d + 12);
      compared++;
      if (slow !== entry.score && mismatch++ === 0)
        note = " — first at depth " + d + ": alpha-beta " + entry.score + " vs minimax " + slow + show(st.b);
    }
  }
  ok(mismatch === 0, "alpha-beta returns the same score as plain minimax for all " + compared +
                     " root moves searched" + (mismatch ? note : ""));
  ok(compared > 200, "compared a real number of root moves, got " + compared);
}

/* ===== 9. the search finds the thing =================================================== */

/* black's last man is cornered: exactly one red move takes its last square away. The other
   move onto that square vacates the landing square behind it, so black jumps out instead. */
const trap = pos(board([[0, 1, "b"], [1, 0, "r"], [2, 1, "r"], [2, 3, "r"]]), E.RED, false);
const trapMoves = E.legalMoves(trap);
const winners = trapMoves.filter(m => E.result(E.applyMove(trap, m)) === "red");
ok(trapMoves.length === 3 && winners.length === 1, "the trap position has one winning move out of three");
ok(canonMove(E.hintMove(trap)) === canonMove(winners[0]), "the hint finds the move that wins on the spot");
for (const lv of ["MEDIUM", "HARD", "EXPERT"])
  ok(canonMove(E.owlMove(trap, lv, () => 0.99)) === canonMove(winners[0]), lv + " owl finds it too");

/* both moves of the man at (5,2) walk into a jump it cannot answer; the far man is safe */
{
  const hang = pos(board([[5, 2, "r"], [7, 6, "r"], [3, 2, "b"]]), E.RED, false);
  ok(E.captureMoves(hang).length === 0, "nothing is forced in the hanging position");
  ok(E.legalMoves(hang).filter(m => m.from === E.idx(5, 2))
      .every(m => E.legalMoves(E.applyMove(hang, m)).some(x => x.caps.length === 1)),
     "…and either move of the near man really does offer black a jump");
  ok(E.searchBest(hang, { depth: 6, budget: 200000, rng: () => 0 }).move.from === E.idx(7, 6),
     "the owl moves the safe man instead of giving one away");
}

/* the reward rule */
ok(E.starsFor("red", 0) === 3 && E.starsFor("red", 1) === 2 && E.starsFor("red", 5) === 1,
   "a win is three stars less one per hint, never below one");
ok(E.starsFor("draw", 0) === 1 && E.starsFor("black", 0) === 0, "a draw is one star, a loss none");

/* ===== 10. the budget really is the cap ================================================ */

{
  const mid = (() => {
    let st = E.newGame("HARD");
    const rnd = mulberry32(8);
    for (let k = 0; k < 10; k++) {
      const all = E.legalMoves(st);
      st = E.applyMove(st, all[Math.floor(rnd() * all.length) % all.length]);
    }
    return st;
  })();
  let over = 0, shallow = 0;
  for (const budget of [2000, 20000, 120000]) {
    const r = E.searchBest(mid, { depth: 30, budget: budget, rng: () => 0 });
    if (r.nodes > budget + 500) over++;
    if (r.depth < 1 || !r.move) shallow++;
  }
  ok(over === 0, "the search never runs past its node budget");
  ok(shallow === 0, "…and always comes back with a move, however small the budget");

  const a = E.searchBest(mid, { depth: 8, budget: 60000, rng: () => 0 });
  const b = E.searchBest(mid, { depth: 8, budget: 60000, rng: () => 0 });
  ok(a.nodes === b.nodes && canonMove(a.move) === canonMove(b.move),
     "the same position searched twice costs the same and answers the same");

  const deeper = E.searchBest(mid, { depth: 30, budget: 300000, rng: () => 0 });
  ok(deeper.depth > E.searchBest(mid, { depth: 30, budget: 5000, rng: () => 0 }).depth,
     "a bigger budget buys more plies");
}

/* ===== 11. the owls really do rank ====================================================== */

/* Every owl's choice is priced by one deep reference search of the same position: because the
   root is searched with a full window, that one search gives the exact value of EVERY move, so
   "how much did this owl give away" is a number rather than an impression. */
function ladder(fly, levels, refOpts, label) {
  const rnd = mulberry32(fly ? 606 : 77);
  const spots = [], want = stress(16);
  for (let tries = 0; spots.length < want && tries < want * 50; tries++) {
    let st = E.makeState(E.startBoard(), E.RED, fly, 0);
    const stop = 6 + Math.floor(rnd() * 26);
    for (let k = 0; k < stop && E.result(st) === null; k++)
      st = E.applyMove(st, E.owlMove(st, "EASY", rnd));
    if (E.result(st) === null && E.legalMoves(st).length > 1) spots.push(st);
  }
  ok(spots.length === want, label + ": found " + spots.length + " of " + want + " positions to judge");
  const refs = spots.map(st => E.searchBest(st, refOpts));
  const priceOf = (i, move) => {
    const key = canonMove(move);
    const hit = refs[i].scores.find(x => canonMove(x.move) === key);
    return refs[i].score - hit.score;
  };
  const loss = {};
  for (const lv of levels) {
    const pick = mulberry32(12345);
    let sum = 0;
    for (let i = 0; i < spots.length; i++) {
      const all = E.legalMoves(spots[i]);
      const m = lv === "RANDOM" ? all[Math.floor(pick() * all.length) % all.length]
                                : E.owlMove(spots[i], lv, pick);
      sum += priceOf(i, m);
    }
    loss[lv] = sum / spots.length;
  }
  const order = levels.map(l => l + " " + loss[l].toFixed(1)).join(" < ");
  for (let i = 1; i < levels.length; i++)
    ok(loss[levels[i - 1]] <= loss[levels[i]],
       label + ": " + levels[i - 1] + " gives away no more than " + levels[i] + " (" + order + ")");
  ok(loss[levels[0]] < loss[levels[levels.length - 1]],
     label + ": the best owl is clearly better than the worst (" + order + ")");
  return loss;
}

ladder(false, ["HARD", "MEDIUM", "EASY", "RANDOM"], { depth: 9, budget: 400000, rng: () => 0 },
       "classic owls");
ladder(true, ["EXPERT", "MEDIUM", "RANDOM"], { depth: 11, budget: 500000, rng: () => 0 },
       "flying-king owls");

/* and end to end: a match, not a metric */
{
  let med = 0, easy = 0, draws = 0;
  for (let g = 0; g < stress(10); g++) {
    const rnd = mulberry32(2000 + g);
    const redIsMedium = g % 2 === 0;
    let st = E.newGame("HARD"), plies = 0, res;
    while ((res = E.result(st)) === null && plies++ < 400) {
      const medTurn = (st.turn === E.RED) === redIsMedium;
      st = E.applyMove(st, E.owlMove(st, medTurn ? "MEDIUM" : "EASY", rnd));
    }
    if (res === "draw" || res === null) draws++;
    else if ((res === "red") === redIsMedium) med += 2;
    else easy += 2;
  }
  ok(med > easy, "over real games the MEDIUM owl beats the EASY one (" + med + " vs " + easy +
                 " points, " + draws + " drawn)");
}

report("checkers engine");
