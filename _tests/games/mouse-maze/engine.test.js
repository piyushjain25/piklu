"use strict";
/* Mouse Maze hands a child a maze and promises two things: the cheese can always be reached,
   and Hint always points the right way. Both are claims about a random carver, so both are
   proved here in bulk rather than sampled — every generated maze is walked with an independent
   flood fill, and Hint's next step is followed all the way to the cheese and checked against the
   true shortest distance at every move. The structural invariants underneath (walls agree from
   both sides, nothing opens through the outer wall, an unbraided maze is exactly a spanning
   tree) are what make the first two possible, so they are checked too. */
const { loadEngine, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("mouse-maze");

const LV = Object.keys(E.LEVELS);
const OPP = { N: "S", S: "N", E: "W", W: "E" };

/* ---------- 1. the level ladder ---------- */
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order: " + LV.join(","));
ok(LV.map(l => E.LEVELS[l].label).join(" ") === "🌱 Easy ⭐ Medium 🔥 Hard 🏆 Expert",
   "level labels are the site's four, emoji and name on one line");
for(let i = 1; i < LV.length; i++){
  ok(E.LEVELS[LV[i]].N > E.LEVELS[LV[i-1]].N, LV[i] + " should be a bigger maze than " + LV[i-1]);
  ok(E.LEVELS[LV[i]].braid >= E.LEVELS[LV[i-1]].braid, LV[i] + " should have at least as many loops as " + LV[i-1]);
}
ok(E.LEVELS.EASY.braid === 0 && E.LEVELS.MEDIUM.braid === 0, "Easy and Medium should be pure mazes, no loops");
ok(E.LEVELS.HARD.braid > 0 && E.LEVELS.EXPERT.braid > 0, "Hard and Expert should open some dead ends into loops");
for(const lv of LV) ok(E.LEVELS[lv].braid >= 0 && E.LEVELS[lv].braid < 1, lv + ": braid is a fraction of dead ends");

/* ---------- 2. the four directions ---------- */
ok(E.DIRS.length === 4, "a square grid has four ways out of a cell");
for(const { d, dr, dc, o } of E.DIRS){
  ok(OPP[d] === o, d + ": its opposite should be " + OPP[d] + ", not " + o);
  ok(Math.abs(dr) + Math.abs(dc) === 1, d + ": a step must move exactly one cell, orthogonally");
  const back = E.DIRS.find(x => x.d === o);
  ok(back.dr === -dr && back.dc === -dc, d + "/" + o + ": the opposite step must undo this one");
}

/* ---------- 3. an independent flood fill ----------
   Deliberately NOT the game's bfs(): if the carver and the solver shared a bug, the game's own
   search would agree with it. This one walks the walls directly. */
function reachable(cells, N, from){
  const seen = Array.from({ length: N }, () => Array(N).fill(false));
  const q = [from]; seen[from[0]][from[1]] = true;
  for(let h = 0; h < q.length; h++){
    const [r, c] = q[h];
    for(const { d, dr, dc } of E.DIRS){
      if(cells[r][c][d]) continue;                       /* wall */
      const nr = r + dr, nc = c + dc;
      if(nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
      if(seen[nr][nc]) continue;
      seen[nr][nc] = true; q.push([nr, nc]);
    }
  }
  return seen;
}
const passages = (cells, N) => {
  let n = 0;
  for(let r = 0; r < N; r++) for(let c = 0; c < N; c++)
    for(const { d, dr, dc } of E.DIRS){
      if(cells[r][c][d]) continue;
      const nr = r + dr, nc = c + dc;
      if(nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
      if(nr > r || nc > c) n++;                          /* count each passage once */
    }
  return n;
};

/* ---------- 4. every maze, at every level ---------- */
for(const lv of LV){
  const { N, braid } = E.LEVELS[lv];
  const T = stress(400);
  let unreachable = 0, asymmetric = 0, leaked = 0, notTree = 0, sameEnds = 0,
      shortHop = 0, notFarthest = 0, hintBroke = 0, hintLong = 0, illegalStep = 0;
  let withLoops = 0, minSteps = Infinity, maxSteps = 0;

  for(let t = 0; t < T; t++){
    const m = E.genMaze(lv);
    if(m.N !== N) { notTree++; continue; }

    /* walls must agree from both sides, and none may open through the outer wall */
    for(let r = 0; r < N; r++) for(let c = 0; c < N; c++)
      for(const { d, dr, dc } of E.DIRS){
        const nr = r + dr, nc = c + dc;
        const out = nr < 0 || nr >= N || nc < 0 || nc >= N;
        if(out){ if(!m.cells[r][c][d]) leaked++; continue; }
        if(m.cells[r][c][d] !== m.cells[nr][nc][OPP[d]]) asymmetric++;
      }

    /* THE claim: the cheese is always reachable — and in fact every cell is */
    const seen = reachable(m.cells, N, m.start);
    let missed = 0;
    for(let r = 0; r < N; r++) for(let c = 0; c < N; c++) if(!seen[r][c]) missed++;
    if(missed) unreachable++;

    /* an unbraided maze is exactly a spanning tree: N²-1 passages, so exactly one route
       between any two cells. A braided one has more — that is what a loop IS. */
    const p = passages(m.cells, N);
    if(braid === 0){ if(p !== N * N - 1) notTree++; }
    else { if(p < N * N - 1) notTree++; if(p > N * N - 1) withLoops++; }

    /* start and finish: two ends of the longest run through the maze */
    const { dist } = E.bfs(m.cells, N, m.start);
    const D = dist[m.finish[0]][m.finish[1]];
    if(m.start[0] === m.finish[0] && m.start[1] === m.finish[1]) sameEnds++;
    if(D < N) shortHop++;                                /* never a couple of steps on an N×N board */
    let further = 0;
    for(let r = 0; r < N; r++) for(let c = 0; c < N; c++) if(dist[r][c] > D) further++;
    if(further) notFarthest++;
    minSteps = Math.min(minSteps, D); maxSteps = Math.max(maxSteps, D);

    /* Hint, followed all the way home: every step legal, and never one step longer than the
       shortest route — that is the whole promise of the hint */
    let cur = m.start, steps = 0;
    while(!(cur[0] === m.finish[0] && cur[1] === m.finish[1])){
      const nxt = E.nextStep(m.cells, N, cur, m.finish);
      if(!nxt){ hintBroke++; break; }
      const dir = E.DIRS.find(x => cur[0] + x.dr === nxt[0] && cur[1] + x.dc === nxt[1]);
      if(!dir || m.cells[cur[0]][cur[1]][dir.d]) illegalStep++;   /* not adjacent, or through a wall */
      cur = nxt;
      if(++steps > N * N){ hintLong++; break; }          /* runaway guard, not a sample count */
    }
    if(steps !== D && steps <= N * N) hintLong++;
  }

  ok(unreachable === 0, lv + ": " + unreachable + " of " + T + " mazes had a cell the mouse could not reach");
  ok(asymmetric === 0, lv + ": " + asymmetric + " walls existed on one side only");
  ok(leaked === 0, lv + ": " + leaked + " passages opened through the outer wall");
  ok(notTree === 0, lv + ": " + notTree + " mazes had the wrong number of passages for braid=" + braid);
  ok(sameEnds === 0, lv + ": " + sameEnds + " mazes put the cheese under the mouse");
  ok(shortHop === 0, lv + ": " + shortHop + " mazes were solvable in fewer than " + N + " steps");
  ok(notFarthest === 0, lv + ": " + notFarthest + " mazes had a cell further away than the cheese");
  ok(hintBroke === 0, lv + ": Hint had nothing to say " + hintBroke + " times");
  ok(illegalStep === 0, lv + ": Hint pointed through a wall " + illegalStep + " times");
  ok(hintLong === 0, lv + ": Hint did not walk the shortest route " + hintLong + " times");
  ok(minSteps >= N, lv + ": the shortest maze ran " + minSteps + " steps (board is " + N + "×" + N + ")");
  ok(maxSteps > minSteps, lv + ": every maze was the same length (" + minSteps + ") — the carver is not varying");
  if(braid > 0) ok(withLoops > 0, lv + ": braid=" + braid + " but not one maze in " + T + " gained a loop");
}

/* ---------- 5. the pieces on their own ---------- */
{
  const N = 6, cells = E.carveMaze(N);
  const seen = reachable(cells, N, [0, 0]);
  let all = true;
  for(let r = 0; r < N; r++) for(let c = 0; c < N; c++) if(!seen[r][c]) all = false;
  ok(all, "carveMaze on its own should connect every cell");
  ok(passages(cells, N) === N * N - 1, "carveMaze on its own is a spanning tree");

  /* braid(0) must change nothing at all */
  const before = JSON.stringify(cells);
  E.braid(cells, N, 0);
  ok(JSON.stringify(cells) === before, "braid(…, 0) must leave the maze exactly as it was");
  /* braiding only ever OPENS walls — it must never put one back */
  const mid = JSON.parse(before);
  E.braid(mid, N, 1);
  let closed = 0;
  for(let r = 0; r < N; r++) for(let c = 0; c < N; c++)
    for(const { d } of E.DIRS) if(!JSON.parse(before)[r][c][d] && mid[r][c][d]) closed++;
  ok(closed === 0, "braiding closed " + closed + " passages — it may only open them");

  /* farthest() really is the farthest */
  const far = E.farthest(cells, N, [0, 0]);
  const { dist } = E.bfs(cells, N, [0, 0]);
  let beyond = 0;
  for(let r = 0; r < N; r++) for(let c = 0; c < N; c++) if(dist[r][c] > dist[far[0]][far[1]]) beyond++;
  ok(beyond === 0, "farthest() found a cell with " + beyond + " cells further out");
  /* standing on the cheese, there is no next step to make */
  ok(E.nextStep(cells, N, far, far) === null, "nextStep from the goal itself should be null");
}

report("mouse-maze engine");
