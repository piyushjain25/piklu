"use strict";
/* Shape Sorter's whole promise is that the round is decidable from the OUTLINE alone: every
   tile it calls correct really is the target shape, every other tile really isn't, and nothing
   else on the tile — its colour, its size, where it sits in the grid — quietly gives the answer
   away. That is a bulk claim about a random generator, so this test proves it over tens of
   thousands of rounds rather than a handful of examples, then checks the look-alike promise
   (Expert pairs a circle with an oval, a square with a rectangle) and that every shape the
   levels can name actually draws. */
const { loadEngine, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("shape-sorter");

const LV = Object.keys(E.LEVELS);

/* ---------- 1. the level ladder ---------- */
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order: " + LV.join(","));
ok(LV.map(l => E.LEVELS[l].label).join(" ") === "🌱 Easy ⭐ Medium 🔥 Hard 🏆 Expert",
   "level labels are the site's four, emoji and name on one line");
for(let i = 1; i < LV.length; i++){
  const a = E.LEVELS[LV[i-1]], b = E.LEVELS[LV[i]];
  ok(b.kinds.length >= a.kinds.length, LV[i] + " should offer at least as many shapes as " + LV[i-1]);
  ok(b.tiles >= a.tiles, LV[i] + " should show at least as many tiles as " + LV[i-1]);
}
ok(E.LEVELS.EXPERT.kinds.length > E.LEVELS.EASY.kinds.length, "Expert must draw on a wider shape set than Easy");
for(const lv of LV){
  const cfg = E.LEVELS[lv];
  ok(new Set(cfg.kinds).size === cfg.kinds.length, lv + ": the shape pool has a duplicate");
  ok(cfg.kinds.every(k => E.NAMES[k]), lv + ": every shape in the pool needs a NAMES entry");
  ok(cfg.minT >= 1, lv + ": a round must have at least one correct tile");
  ok(cfg.maxT >= cfg.minT, lv + ": maxT cannot be below minT");
  /* a round with no distractor is not a puzzle */
  ok(cfg.tiles > cfg.minT, lv + ": there must be room for at least one distractor");
  ok(cfg.kinds.length >= 2, lv + ": need a second shape to act as a distractor");
}
/* Easy and Medium are the "tap THE shape" levels; Hard and Expert are "tap them all" */
ok(E.LEVELS.EASY.maxT === 1 && E.LEVELS.MEDIUM.maxT === 1, "Easy and Medium ask for exactly one tile");
ok(E.LEVELS.HARD.minT > 1 && E.LEVELS.EXPERT.minT > 1, "Hard and Expert always ask for more than one");

/* ---------- 2. every shape draws ---------- */
for(const kind in E.NAMES){
  const svg = E.shapeMarkup(kind, "#FF6B7A");
  ok(svg.length > 0, kind + ": shapeMarkup drew nothing");
  ok(/^<(circle|ellipse|rect|polygon|path)\b/.test(svg), kind + ": should be one SVG primitive, got " + svg.slice(0, 24));
  ok(svg.includes('fill="#FF6B7A"'), kind + ": should be filled with the colour it was given");
  /* a polygon's points must be real numbers — a NaN here renders an invisible tile */
  const pts = /points="([^"]+)"/.exec(svg);
  if(pts) ok(pts[1].split(" ").every(p => /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(p)), kind + ": bad polygon points " + pts[1]);
}
ok(E.shapeMarkup("not-a-shape", "#000") === "", "an unknown shape draws nothing rather than broken markup");
/* the names a child hears are distinct — two shapes reading "Circle" would make a round unfair */
ok(new Set(Object.values(E.NAMES)).size === Object.keys(E.NAMES).length, "every shape needs its own spoken name");

/* ---------- 3. look-alikes ---------- */
for(const a in E.CONFUSABLE){
  const b = E.CONFUSABLE[a];
  ok(E.NAMES[a] && E.NAMES[b], a + "/" + b + ": a look-alike pair must be real shapes");
  ok(a !== b, a + ": a shape cannot look like itself");
  ok(E.CONFUSABLE[b] === a, a + "/" + b + ": look-alikes must point at each other");
}
ok(Object.keys(E.CONFUSABLE).some(k => E.LEVELS.EXPERT.kinds.includes(k)),
   "Expert's 'look-alikes' hint needs at least one look-alike pair in its pool");

/* ---------- 4. the generator, in bulk ---------- */
for(const lv of LV){
  const cfg = E.LEVELS[lv];
  const N = stress(20000);
  /* everything below is counted across the whole run and asserted once, so a failure prints a
     single line rather than twenty thousand */
  let badSize = 0, badTargetKind = 0, distractorWasTarget = 0, offPool = 0, badCount = 0,
      badIds = 0, badColor = 0, badScale = 0, alreadyFound = 0, noDistractor = 0, missingLookalike = 0;
  const targetSeen = new Map();          /* which shapes ever come up as the target */
  const posCorrect = new Array(cfg.tiles).fill(0);
  let sumCorrectScale = 0, nCorrect = 0, sumOtherScale = 0, nOther = 0;
  const colorOnCorrect = new Map();

  for(let i = 0; i < N; i++){
    const r = E.genRound(lv);
    if(r.tiles.length !== cfg.tiles) badSize++;
    if(!cfg.kinds.includes(r.target)) badTargetKind++;
    targetSeen.set(r.target, (targetSeen.get(r.target) || 0) + 1);

    const correct = r.tiles.filter(t => t.correct);
    if(correct.length !== r.targetCount) badCount++;
    if(r.targetCount < cfg.minT || r.targetCount > Math.min(cfg.maxT, cfg.tiles - 1)) badCount++;
    if(correct.length === r.tiles.length) noDistractor++;

    r.tiles.forEach((t, idx) => {
      if(t.id !== idx) badIds++;                                  /* renderTiles pairs tiles[i] with button i */
      if(!cfg.kinds.includes(t.kind)) offPool++;
      if(t.correct && t.kind !== r.target) badTargetKind++;
      /* THE claim: a tile that is not marked correct must not be the target shape either, or
         "tap every matching tile" would be unfinishable */
      if(!t.correct && t.kind === r.target) distractorWasTarget++;
      if(!E.COLORS.includes(t.color)) badColor++;
      if(!(t.scale >= 0.82 && t.scale < 1.14)) badScale++;
      if(t.found !== false) alreadyFound++;
      if(t.correct){
        posCorrect[idx]++; sumCorrectScale += t.scale; nCorrect++;
        colorOnCorrect.set(t.color, (colorOnCorrect.get(t.color) || 0) + 1);
      } else { sumOtherScale += t.scale; nOther++; }
    });

    /* the look-alike promise: when the target has a twin in this level's pool, the twin is on
       the board — that is what makes Expert a test of the outline rather than of memory */
    const twin = E.CONFUSABLE[r.target];
    if(twin && cfg.kinds.includes(twin) && r.tiles.length > r.targetCount
       && !r.tiles.some(t => t.kind === twin)) missingLookalike++;
  }

  ok(badSize === 0, lv + ": " + badSize + " rounds had the wrong number of tiles");
  ok(badTargetKind === 0, lv + ": " + badTargetKind + " correct tiles were not the target shape");
  ok(distractorWasTarget === 0, lv + ": " + distractorWasTarget + " distractors WERE the target shape");
  ok(offPool === 0, lv + ": " + offPool + " tiles used a shape outside the level's pool");
  ok(badCount === 0, lv + ": " + badCount + " rounds disagreed with targetCount or the level's min/max");
  ok(noDistractor === 0, lv + ": " + noDistractor + " rounds had no distractor at all");
  ok(badIds === 0, lv + ": " + badIds + " tiles were not numbered in board order");
  ok(badColor === 0, lv + ": " + badColor + " tiles used a colour outside the palette");
  ok(badScale === 0, lv + ": " + badScale + " tiles were scaled outside 0.82–1.14");
  ok(alreadyFound === 0, lv + ": " + alreadyFound + " tiles started already found");
  ok(missingLookalike === 0, lv + ": " + missingLookalike + " rounds left the target's look-alike off the board");

  /* every shape in the pool must actually turn up — a shape that never appears is dead weight */
  for(const k of cfg.kinds) ok((targetSeen.get(k) || 0) > 0, lv + ": " + k + " never came up as the target");

  /* ---------- 5. no tells ---------- */
  /* position: the shuffle must not favour a slot. Each of the cfg.tiles slots should hold a
     correct tile about nCorrect/cfg.tiles times; allow a generous ±25%. */
  const expect = nCorrect / cfg.tiles;
  const worst = posCorrect.reduce((w, c) => Math.max(w, Math.abs(c - expect) / expect), 0);
  ok(worst < 0.25, lv + ": the answer favours a grid position (worst slot is " + (worst * 100).toFixed(1) + "% off)");
  /* size: a correct tile must not be systematically bigger or smaller than a distractor */
  const dScale = Math.abs(sumCorrectScale / nCorrect - sumOtherScale / nOther);
  ok(dScale < 0.02, lv + ": correct tiles differ in average size from distractors by " + dScale.toFixed(4));
  /* colour: every palette colour must land on the answer sometimes, so colour says nothing */
  ok(colorOnCorrect.size === E.COLORS.length, lv + ": only " + colorOnCorrect.size + " of " + E.COLORS.length + " colours ever hold the answer");
}

report("shape-sorter engine");
