"use strict";
/* Color Match asks a 3-year-old to tap every tile of the named colour, so the round has to be
   decidable from the tile's colour alone: a tile the game calls wrong must not BE the named
   colour. Hard is where that gets interesting — there the tiles are random shades of a colour
   family, so "the same colour" no longer means "the same hex", and two tiles that look
   identical must never disagree about whether they are right. Both claims are proved here
   across tens of thousands of rounds, along with the look-alike promise (the confusable colour
   is always on the board) and the absence of any tell in position. */
const { loadEngine, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("color-match");

const LV = Object.keys(E.LEVELS);
const HEX = /^#[0-9A-Fa-f]{6}$/;

/* ---------- 1. the palette ---------- */
for(const k in E.NAMES){
  ok(HEX.test(E.BASE[k] || ""), k + ": needs a valid base colour, got " + E.BASE[k]);
  ok(E.NAMES[k].length > 0, k + ": needs a spoken name");
}
ok(new Set(Object.values(E.NAMES)).size === Object.keys(E.NAMES).length,
   "two colours share a name — a round would be unanswerable");
ok(new Set(Object.values(E.BASE)).size === Object.keys(E.BASE).length,
   "two colours share a hex — they would be the same tile");
for(const fam in E.FAMILIES){
  const shades = E.FAMILIES[fam];
  ok(!!E.NAMES[fam], fam + ": a shade family must be a named colour");
  ok(shades.length >= 3, fam + ": a family needs enough shades to be worth asking about");
  ok(shades.every(h => HEX.test(h)), fam + ": every shade must be a valid hex");
  ok(new Set(shades).size === shades.length, fam + ": a shade is listed twice");
}
/* THE Hard-level precondition: no two families may share a shade, or a tile could belong to
   both the answer and a distractor at once */
{
  const owner = new Map();
  for(const fam in E.FAMILIES) for(const h of E.FAMILIES[fam]){
    ok(!owner.has(h), h + " is in both " + owner.get(h) + " and " + fam + " — the same tile in two answers");
    owner.set(h, fam);
  }
}
/* look-alikes: this one is a CYCLE (red→pink→orange→red), not symmetric pairs, so it is only
   checked for being real and never pointing at itself */
for(const a in E.CONFUSABLE){
  const b = E.CONFUSABLE[a];
  ok(!!E.NAMES[a] && !!E.NAMES[b], a + "/" + b + ": a look-alike must be a named colour");
  ok(a !== b, a + ": a colour cannot look like itself");
}

/* ---------- 2. the level ladder ---------- */
ok(LV.join(",") === "EASY,MEDIUM,HARD,EXPERT", "four levels, in order: " + LV.join(","));
ok(LV.map(l => E.LEVELS[l].label).join(" ") === "🌱 Easy ⭐ Medium 🔥 Hard 🏆 Expert",
   "level labels are the site's four, emoji and name on one line");
for(const lv of LV){
  const cfg = E.LEVELS[lv];
  ok(new Set(cfg.kinds).size === cfg.kinds.length, lv + ": the colour pool has a duplicate");
  ok(cfg.kinds.every(k => E.NAMES[k] && E.BASE[k]), lv + ": a colour in the pool is not in the palette");
  ok(cfg.kinds.length >= 2, lv + ": needs a second colour to act as a distractor");
  ok(cfg.minT >= 1 && cfg.maxT >= cfg.minT, lv + ": the target count must be a real range");
  ok(cfg.tiles > cfg.minT, lv + ": there must be room for at least one distractor");
  if(cfg.shades) ok(cfg.kinds.every(k => cfg.shades[k]), lv + ": every colour in a shades level needs a family");
}
ok(E.LEVELS.EASY.maxT === 1 && E.LEVELS.MEDIUM.maxT === 1, "Easy and Medium ask for exactly one tile");
ok(E.LEVELS.HARD.minT > 1 && E.LEVELS.EXPERT.minT > 1, "Hard and Expert always ask for more than one");
ok(!!E.LEVELS.HARD.shades, "Hard is the shades level — that is what makes it hard");
ok(!E.LEVELS.EASY.shades && !E.LEVELS.MEDIUM.shades && !E.LEVELS.EXPERT.shades,
   "only Hard should use shades; Expert is hard by its look-alikes instead");
/* the colour shown in the prompt: the family's middle shade where there are shades, else the base */
for(const lv of LV){
  const cfg = E.LEVELS[lv];
  for(const k of cfg.kinds)
    ok(E.displayHex(cfg, k) === (cfg.shades ? cfg.shades[k][1] : E.BASE[k]),
       lv + "/" + k + ": the prompt swatch should be the colour's headline shade");
}

/* ---------- 3. every round, at every level ---------- */
for(const lv of LV){
  const cfg = E.LEVELS[lv];
  const N = stress(20000);
  let badSize = 0, distractorWasTarget = 0, correctWasNot = 0, offPool = 0, badCount = 0,
      badIds = 0, badHex = 0, alreadyFound = 0, noDistractor = 0, missingLookalike = 0, hexClash = 0;
  const targetSeen = new Map();
  const posCorrect = new Array(cfg.tiles).fill(0);
  const hexOnCorrect = new Map();

  for(let i = 0; i < N; i++){
    const r = E.genRound(lv);
    if(r.tiles.length !== cfg.tiles) badSize++;
    if(!cfg.kinds.includes(r.target)) offPool++;
    targetSeen.set(r.target, (targetSeen.get(r.target) || 0) + 1);

    const correct = r.tiles.filter(t => t.correct);
    if(correct.length !== r.targetCount) badCount++;
    if(r.targetCount < cfg.minT || r.targetCount > Math.min(cfg.maxT, cfg.tiles - 1)) badCount++;
    if(correct.length === r.tiles.length) noDistractor++;

    /* the hexes a correct tile may wear this round — at Hard that is the whole family */
    const rightHexes = new Set(correct.map(t => t.hex));

    r.tiles.forEach((t, idx) => {
      if(t.id !== idx) badIds++;
      if(!cfg.kinds.includes(t.kind)) offPool++;
      if(t.correct && t.kind !== r.target) correctWasNot++;
      /* THE claim: nothing the game calls wrong may be the named colour */
      if(!t.correct && t.kind === r.target) distractorWasTarget++;
      /* ...and at Hard, where colour no longer means hex: two tiles that look the same must
         never disagree about being right */
      if(!t.correct && rightHexes.has(t.hex)) hexClash++;
      const allowed = cfg.shades ? cfg.shades[t.kind] : [E.BASE[t.kind]];
      if(!allowed.includes(t.hex)) badHex++;
      if(t.found !== false) alreadyFound++;
      if(t.correct){ posCorrect[idx]++; hexOnCorrect.set(t.hex, (hexOnCorrect.get(t.hex) || 0) + 1); }
    });

    const twin = E.CONFUSABLE[r.target];
    if(twin && cfg.kinds.includes(twin) && r.tiles.length > r.targetCount
       && !r.tiles.some(t => t.kind === twin)) missingLookalike++;
  }

  ok(badSize === 0, lv + ": " + badSize + " rounds had the wrong number of tiles");
  ok(correctWasNot === 0, lv + ": " + correctWasNot + " correct tiles were not the named colour");
  ok(distractorWasTarget === 0, lv + ": " + distractorWasTarget + " wrong tiles WERE the named colour");
  ok(hexClash === 0, lv + ": " + hexClash + " wrong tiles were the exact same shade as a right one");
  ok(offPool === 0, lv + ": " + offPool + " tiles used a colour outside the level's pool");
  ok(badCount === 0, lv + ": " + badCount + " rounds disagreed with targetCount or the level's min/max");
  ok(noDistractor === 0, lv + ": " + noDistractor + " rounds had no distractor at all");
  ok(badIds === 0, lv + ": " + badIds + " tiles were not numbered in board order");
  ok(badHex === 0, lv + ": " + badHex + " tiles wore a shade their colour does not have");
  ok(alreadyFound === 0, lv + ": " + alreadyFound + " tiles started already found");
  ok(missingLookalike === 0, lv + ": " + missingLookalike + " rounds left the look-alike colour off the board");
  for(const k of cfg.kinds) ok((targetSeen.get(k) || 0) > 0, lv + ": " + k + " was never the colour asked for");

  /* no tell: position must not give the answer away */
  const nCorrect = posCorrect.reduce((a, b) => a + b, 0), expect = nCorrect / cfg.tiles;
  const worst = posCorrect.reduce((w, c) => Math.max(w, Math.abs(c - expect) / expect), 0);
  ok(worst < 0.25, lv + ": the answer favours a grid position (worst slot is " + (worst * 100).toFixed(1) + "% off)");
  /* at Hard, every shade of a family must really turn up on the answer, or the level is
     quietly easier than it looks */
  if(cfg.shades){
    let missed = 0;
    for(const k of cfg.kinds) for(const h of cfg.shades[k]) if(!hexOnCorrect.has(h)) missed++;
    ok(missed === 0, lv + ": " + missed + " shades never appeared on a correct tile");
  }
}

report("color-match engine");
