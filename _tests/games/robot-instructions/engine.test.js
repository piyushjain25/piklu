"use strict";
/* Robot Instructions hands a child a walled grid and promises the treasure can be reached. Every
   puzzle also ships the route it claims is shortest — that route is what Hint walks and what
   "par" is scored against, so if it is wrong the game quietly misleads. Both are checked here
   against an independent flood fill of the grid rather than against the game's own bfs(): every
   generated puzzle is confirmed reachable, and its stated optimal route is replayed step by
   step through the simulator to confirm it never hits a wall, never leaves the grid, ends on
   the treasure, and is exactly as long as the true shortest path. */
const { loadEngine, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("robot-instructions");

const LV = Object.keys(E.LEVELS);

/* ---------- 1. the four directions ---------- */
ok(Object.keys(E.DIRS).sort().join(",") === "down,left,right,up", "four ways to move");
for(const k in E.DIRS){
  const [dr, dc] = E.DIRS[k];
  ok(Math.abs(dr) + Math.abs(dc) === 1, k + ": a step must move exactly one cell, orthogonally");
  ok(!!E.ARROW[k], k + ": needs an arrow for the program strip");
}
ok(E.DIRS.up[0] === -1 && E.DIRS.down[0] === 1, "up must go up the grid and down must go down");
ok(E.DIRS.left[1] === -1 && E.DIRS.right[1] === 1, "left and right must go the way they say");
ok(new Set(Object.values(E.ARROW)).size === 4, "each direction needs its own arrow");

/* ---------- 2. the level ladder ---------- */
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order: " + LV.join(","));
ok(LV.map(l => E.LEVELS[l].label).join(" ") === "🌱 Easy ⭐ Medium 🔥 Hard 🏆 Expert",
   "level labels are the site's four, emoji and name on one line");
for(let i = 1; i < LV.length; i++){
  const a = E.LEVELS[LV[i-1]], b = E.LEVELS[LV[i]];
  ok(b.R * b.C >= a.R * a.C, LV[i] + " should be at least as big a grid as " + LV[i-1]);
  ok(b.walls >= a.walls, LV[i] + " should have at least as many walls as " + LV[i-1]);
  ok(b.minLen >= a.minLen, LV[i] + " should need at least as long a route as " + LV[i-1]);
  ok(b.detourMin >= a.detourMin, LV[i] + " should demand at least as much of a detour as " + LV[i-1]);
}
for(const lv of LV){
  const cfg = E.LEVELS[lv];
  ok(cfg.walls < cfg.R * cfg.C - 2, lv + ": there must be room for a robot and a treasure");
  ok(cfg.maxLen > cfg.minLen, lv + ": the route-length range must be a real range");
  ok(cfg.minLen >= 1, lv + ": the treasure must not start under the robot");
}
/* Easy drives the robot live; every other level writes a program first */
ok(E.LEVELS.EASY.direct === true, "Easy should move the robot as you tap");
for(const lv of ["MEDIUM", "HARD", "EXPERT"]) ok(E.LEVELS[lv].direct === false, lv + " should build a program, not move live");
ok(!E.LEVELS.EASY.par && !E.LEVELS.MEDIUM.par, "Easy and Medium should not be scored against par");
ok(E.LEVELS.HARD.par && E.LEVELS.EXPERT.par, "Hard and Expert should be scored against par");

/* ---------- 3. an independent flood fill ----------
   Not the game's bfs(): if the generator and the solver shared a bug they would agree. */
function shortest(P){
  const { R, C } = P, dist = new Array(R * C).fill(-1);
  const s = P.start[0] * C + P.start[1];
  dist[s] = 0;
  const q = [s];
  for(let h = 0; h < q.length; h++){
    const cur = q[h], r = (cur / C) | 0, c = cur % C;
    for(const k in E.DIRS){
      const nr = r + E.DIRS[k][0], nc = c + E.DIRS[k][1];
      if(nr < 0 || nr >= R || nc < 0 || nc >= C) continue;
      const ni = nr * C + nc;
      if(P.wallSet.has(ni) || dist[ni] !== -1) continue;
      dist[ni] = dist[cur] + 1; q.push(ni);
    }
  }
  return dist;
}
const manhattan = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

/* ---------- 4. every puzzle, at every level ---------- */
for(const lv of LV){
  const cfg = E.LEVELS[lv];
  const T = stress(2000);
  let nulls = 0, wrongSize = 0, wrongWalls = 0, onWall = 0, sameCell = 0, unreachable = 0,
      wrongOptimal = 0, routeBonks = 0, routeMisses = 0, routeLong = 0, offRange = 0,
      shortDetour = 0, badCells = 0, first = null;
  const lengths = new Set();

  for(let t = 0; t < T; t++){
    const P = E.genPuzzle(lv);
    if(!P){ nulls++; continue; }

    if(P.R !== cfg.R || P.C !== cfg.C) wrongSize++;
    if(P.wallSet.size !== cfg.walls) wrongWalls++;
    const si = P.start[0] * P.C + P.start[1], ti = P.treasure[0] * P.C + P.treasure[1];
    if(P.wallSet.has(si) || P.wallSet.has(ti)) onWall++;
    if(si === ti) sameCell++;
    if(!E.inB(P, P.start[0], P.start[1]) || !E.inB(P, P.treasure[0], P.treasure[1])) offRange++;

    /* THE claim: the treasure is reachable, and `optimal` is the true shortest distance */
    const dist = shortest(P);
    if(dist[ti] < 0){
      unreachable++;
      if(!first) first = "treasure unreachable on a " + P.R + "x" + P.C + " grid";
      continue;
    }
    if(dist[ti] !== P.optimal){
      wrongOptimal++;
      if(!first) first = "claims optimal " + P.optimal + " but the shortest route is " + dist[ti];
    }
    if(P.optimal < cfg.minLen || P.optimal > cfg.maxLen) offRange++;
    if(P.optimal - manhattan(P.start, P.treasure) < cfg.detourMin) shortDetour++;
    lengths.add(P.optimal);

    /* replay the route the puzzle ships, move by move, through the game's own simulator */
    if(P.optimalMoves.length !== P.optimal) routeLong++;
    const trace = E.simulateTrace(P, P.optimalMoves);
    if(trace.some(s => s.bonk)) routeBonks++;
    const end = trace[trace.length - 1];
    if(!end || end.r !== P.treasure[0] || end.c !== P.treasure[1]){
      routeMisses++;
      if(!first) first = "the shipped route ends at " + (end ? end.r + "," + end.c : "nowhere")
        + " not the treasure at " + P.treasure.join(",");
    }
    /* every cell the route passes through must be a real, open cell */
    if(P.optimalCells.length !== P.optimal + 1) badCells++;
    if(P.optimalCells.some(i => P.wallSet.has(i) || i < 0 || i >= P.R * P.C)) badCells++;
    if(P.optimalCells[0] !== si || P.optimalCells[P.optimalCells.length - 1] !== ti) badCells++;
    /* and consecutive cells must actually be neighbours */
    for(let i = 1; i < P.optimalCells.length; i++){
      const a = P.optimalCells[i-1], b = P.optimalCells[i];
      const d = Math.abs(((a / P.C) | 0) - ((b / P.C) | 0)) + Math.abs(a % P.C - b % P.C);
      if(d !== 1) badCells++;
    }
  }

  ok(nulls === 0, lv + ": genPuzzle gave up " + nulls + " times");
  ok(wrongSize === 0, lv + ": " + wrongSize + " puzzles were the wrong size");
  ok(wrongWalls === 0, lv + ": " + wrongWalls + " puzzles had the wrong number of walls");
  ok(onWall === 0, lv + ": " + onWall + " puzzles put the robot or the treasure inside a wall");
  ok(sameCell === 0, lv + ": " + sameCell + " puzzles started the robot on the treasure");
  ok(offRange === 0, lv + ": " + offRange + " puzzles fell outside the grid or the route-length range");
  ok(unreachable === 0, lv + ": " + unreachable + " puzzles where the treasure could NOT be reached"
     + (first ? " (" + first + ")" : ""));
  ok(wrongOptimal === 0, lv + ": " + wrongOptimal + " puzzles claimed the wrong shortest distance"
     + (first ? " (" + first + ")" : ""));
  ok(routeLong === 0, lv + ": " + routeLong + " shipped routes were not `optimal` moves long");
  ok(routeBonks === 0, lv + ": " + routeBonks + " shipped routes walked into a wall");
  ok(routeMisses === 0, lv + ": " + routeMisses + " shipped routes did not end on the treasure"
     + (first ? " (" + first + ")" : ""));
  ok(badCells === 0, lv + ": " + badCells + " shipped routes passed through a wall or jumped a cell");
  ok(shortDetour === 0, lv + ": " + shortDetour + " puzzles were a straighter walk than this level promises");
  ok(lengths.size > 1, lv + ": every puzzle was the same length — the generator is not varying");
}

/* ---------- 5. the simulator ---------- */
{
  /* a hand-built grid: 3x3, one wall in the middle */
  const P = { R: 3, C: 3, wallSet: new Set([4]), start: [0, 0], treasure: [2, 2] };
  ok(E.isWall(P, 1, 1) && !E.isWall(P, 0, 0), "isWall should read the wall set");
  ok(E.inB(P, 2, 2) && !E.inB(P, 3, 0) && !E.inB(P, -1, 0) && !E.inB(P, 0, 3), "inB should fence the grid");

  /* walking into the wall is a bonk, and the robot does not move */
  const t1 = E.simulateTrace(P, ["right", "down"]);
  ok(t1[0].r === 0 && t1[0].c === 1 && !t1[0].bonk, "the first step should move right");
  ok(t1[1].bonk && t1[1].r === 0 && t1[1].c === 1, "stepping into a wall should bonk and not move");
  /* walking off the edge is a bonk too */
  const t2 = E.simulateTrace(P, ["up"]);
  ok(t2[0].bonk && t2[0].r === 0 && t2[0].c === 0, "stepping off the grid should bonk and not move");
  /* an empty program does nothing */
  ok(E.simulateTrace(P, []).length === 0, "an empty program produces no steps");
  /* a legal route round the wall */
  const t3 = E.simulateTrace(P, ["down", "down", "right", "right"]);
  ok(t3.every(s => !s.bonk), "the route round the wall should not bonk");
  ok(t3[3].r === 2 && t3[3].c === 2, "the route round the wall should reach the treasure");
  /* the game's own bfs must agree with the independent one on this grid */
  const { dist } = E.bfs(P);
  ok(dist[8] === 4, "bfs should put the treasure 4 steps away, got " + dist[8]);
  ok(dist[4] === -1, "a walled cell should be unreachable");
}

report("robot-instructions engine");
