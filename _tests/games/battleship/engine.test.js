"use strict";
/* battleship engine: every hidden fleet checked legal by an independent reader of the rules,
   every shot's verdict re-derived from the real boats, the free water around a wreck re-proved
   against that fleet on every sinking, the owl shown to decide from what it is ALLOWED to know
   (a different fleet behind the same marks gets the same shot), and the three owls ranked by
   how many shots each needs to clear a sea. */
const { loadEngine, mulberry32, tally, stress } = require("../../lib/harness.js");
const E = loadEngine("battleship");
const { ok, report } = tally();
const { YOU, OWL, UNKNOWN, MISS, HIT, LEVELS, FLEET, other, rowOf, colOf, squareName } = E;

const LEVEL_KEYS = Object.keys(LEVELS);
const cheb = (a, b, n) => Math.max(Math.abs(rowOf(a, n) - rowOf(b, n)), Math.abs(colOf(a, n) - colOf(b, n)));

/* ---- independent oracles (written from the rules, not read off the engine) --------------- */

/* the cells of a boat of `len` at (r,c) lying across (dir 0) or down (dir 1), or null if any
   part of it would fall off the sea — counted out here rather than asked of the engine */
function oracleCells(len, r, c, dir, n) {
  const out = [];
  for (let k = 0; k < len; k++) {
    const rr = dir ? r + k : r, cc = dir ? c : c + k;
    if (rr < 0 || rr >= n || cc < 0 || cc >= n) return null;
    out.push(rr * n + cc);
  }
  return out;
}

/* Is `ships` a legal hiding place for `fleet` on an n×n sea? Every rule of the layout, read
   straight from the description: the right boats, each a straight in-bounds run of its own
   length, no two overlapping — and, unless boats may touch, no two within a king's move of
   each other (which is what makes the ring around a wreck a deduction). */
function oracleLayoutLegal(ships, fleet, n, touch) {
  if (!ships || ships.length !== fleet.length) return "wrong number of boats";
  const want = fleet.map(s => s.len).slice().sort(), got = ships.map(s => s.len).slice().sort();
  if (want.join() !== got.join()) return "fleet lengths " + got.join() + " should be " + want.join();
  for (const sh of ships) {
    const cells = oracleCells(sh.len, sh.r, sh.c, sh.dir, n);
    if (!cells) return "a " + sh.name + " hangs off the sea";
    if (cells.join() !== sh.cells.slice().join()) return sh.name + "'s cells are not the run it claims";
    if (sh.cells.length !== sh.len) return sh.name + " is " + sh.cells.length + " squares, not " + sh.len;
  }
  const gap = touch ? 0 : 1;
  for (let a = 0; a < ships.length; a++)
    for (let b = a + 1; b < ships.length; b++)
      for (const i of ships[a].cells) for (const j of ships[b].cells)
        if (cheb(i, j, n) <= gap)
          return ships[a].name + " and " + ships[b].name + " are " + (gap ? "touching" : "overlapping")
               + " at " + squareName(i, n) + "/" + squareName(j, n);
  return null;
}

/* every placement of a boat of `len` that no mark rules out: a run of cells none of which is a
   known miss and none of which belongs to a boat already sunk */
function consistentPlacements(v, len) {
  const out = [];
  for (let dir = 0; dir < 2; dir++)
    for (let r = 0; r < v.n; r++) for (let c = 0; c < v.n; c++) {
      const cells = oracleCells(len, r, c, dir, v.n);
      if (!cells) continue;
      if (cells.some(i => v.marks[i] === MISS || v.sunkMask[i])) continue;
      out.push(cells);
    }
  return out;
}
/* how many ways the boats still afloat could be lying on each square (the plain count, with no
   follow-up weighting) — the reckoning a hunting owl is supposed to be doing */
function oracleDensity(v) {
  const W = new Array(v.n * v.n).fill(0);
  for (const len of v.remaining)
    for (const cells of consistentPlacements(v, len))
      for (const i of cells) if (v.marks[i] === UNKNOWN) W[i]++;
  return W;
}
const argmax = W => {
  let best = -1, top = [];
  for (let i = 0; i < W.length; i++) {
    if (W[i] <= 0) continue;
    if (W[i] > best) { best = W[i]; top = [i]; } else if (W[i] === best) top.push(i);
  }
  return { best, top: new Set(top) };
};

/* the squares just off each end of a run of two or more live hits, found by sweeping every row
   and column — the engine walks out from each hit instead, so this is a genuinely other route */
function oracleLineEnds(v) {
  const n = v.n, live = i => v.marks[i] === HIT && !v.sunkMask[i], out = new Set();
  for (const [dr, dc] of [[0, 1], [1, 0]])
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!live(r * n + c)) continue;
      const pr = r - dr, pc = c - dc;
      if (pr >= 0 && pc >= 0 && live(pr * n + pc)) continue;      /* not the start of a run */
      let k = 0;
      while (r + k * dr < n && c + k * dc < n && live((r + k * dr) * n + (c + k * dc))) k++;
      if (k < 2) continue;                                        /* a lone hit says nothing */
      for (const [er, ec] of [[r - dr, c - dc], [r + k * dr, c + k * dc]])
        if (er >= 0 && er < n && ec >= 0 && ec < n && v.marks[er * n + ec] === UNKNOWN) out.add(er * n + ec);
    }
  return out;
}

/* ---- the hidden fleets are legal ---------------------------------------------------------- */
for (const key of LEVEL_KEYS) {
  const L = LEVELS[key], fleet = FLEET;
  let bad = null, nulls = 0;
  for (let t = 0; t < stress(3000) && !bad; t++) {
    const ships = E.randomLayout(fleet, L.n, L.touch, mulberry32(t + 1));
    if (!ships) { nulls++; continue; }
    const why = oracleLayoutLegal(ships, fleet, L.n, L.touch);
    if (why) bad = "seed " + (t + 1) + ": " + why;
  }
  ok(!bad, key + ": every random layout should be legal — " + bad);
  ok(nulls === 0, key + ": randomLayout gave up " + nulls + " times — the fleet should always fit");
}

/* every boat reaches every part of the sea — a layout that quietly favoured the corners would
   still be "legal", so coverage is checked as well as legality */
for (const key of LEVEL_KEYS) {
  const L = LEVELS[key], seen = new Set();
  for (let t = 0; t < stress(2000); t++)
    for (const sh of E.randomLayout(FLEET, L.n, L.touch, mulberry32(t + 9001)) || [])
      for (const i of sh.cells) seen.add(i);
  ok(seen.size === L.n * L.n, key + ": boats only ever reached " + seen.size + " of " + (L.n * L.n) + " squares");
}

/* canPlace agrees with the rules read independently, on real crowded seas */
{
  const L = LEVELS.EXPERT, n = L.n;
  let bad = null;
  for (let t = 0; t < stress(300) && !bad; t++) {
    const rng = mulberry32(t + 500), all = E.randomLayout(FLEET, n, L.touch, rng);
    const ships = all.slice(0, 1 + Math.floor(rng() * (all.length - 1)));
    for (const len of [2, 3, 4, 5])
      for (let dir = 0; dir < 2 && !bad; dir++)
        for (let r = 0; r < n && !bad; r++) for (let c = 0; c < n && !bad; c++) {
          const cells = oracleCells(len, r, c, dir, n);
          const want = !!cells && !ships.some(sh => sh.cells.some(j => cells.some(i => cheb(i, j, n) <= (L.touch ? 0 : 1))));
          const got = E.canPlace(ships, len, r, c, dir, n, L.touch, null);
          if (want !== got) bad = "len " + len + " at " + squareName(r * n + c, n) + " dir " + dir + ": engine says " + got;
        }
  }
  ok(!bad, "canPlace should match the layout rules read independently — " + bad);
  /* spotsFor must list exactly the legal ones, so the placing UI can never offer a bad square */
  const ships = E.randomLayout(FLEET, n, L.touch, mulberry32(77)).slice(0, 2);
  let mismatch = 0;
  for (const len of [2, 3, 4, 5]) {
    const got = new Set(E.spotsFor(ships, len, n, L.touch, null).map(s => s.join()));
    for (let dir = 0; dir < 2; dir++) for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
      if (E.canPlace(ships, len, r, c, dir, n, L.touch, null) !== got.has([r, c, dir].join())) mismatch++;
  }
  ok(mismatch === 0, "spotsFor should list exactly the placements canPlace allows (" + mismatch + " differ)");
  /* `skip` is the boat being picked up and put down — it must not block its own old home */
  const one = ships[0];
  ok(E.canPlace(ships, one.len, one.r, one.c, one.dir, n, L.touch, one),
     "a boat picked up should always be allowed straight back where it was");
  ok(!E.canPlace(ships, one.len, one.r, one.c, one.dir, n, L.touch, null),
     "without skip, a boat's own squares should be occupied");
}

/* ---- a shot's verdict is the truth about the real fleet ------------------------------------ */
/* Plays a whole game with both sides firing as told, re-deriving every verdict from the boats
   that are really there, and re-proving the free water around each wreck. Returns the state. */
function playOut(level, seed, shotFor) {
  const rng = mulberry32(seed);
  let s = E.newGame(level, rng), guard = 0;
  const fired = { 1: new Set(), 2: new Set() };
  /* the real fleets, read once before a shot is fired — the oracle below never consults the
     engine's running state, only this */
  const truth = { 1: s.owl.ships.map(sh => sh.cells.slice()), 2: s.you.ships.map(sh => sh.cells.slice()) };
  while (!E.isOver(s) && guard++ < 4 * s.n * s.n) {
    const p = s.turn, i = shotFor(s, p, rng);
    if (fired[p].has(i)) return { bad: "player " + p + " fired at " + squareName(i, s.n) + " twice" };
    fired[p].add(i);
    const before = s, next = E.fire(s, i);
    if (!next) return { bad: "a legal shot at " + squareName(i, s.n) + " was refused" };
    s = next;
    const last = s.last, boats = truth[p];
    /* hit or miss, from the real boats */
    const onBoat = boats.findIndex(cells => cells.indexOf(i) >= 0);
    if (last.hit !== (onBoat >= 0)) return { bad: squareName(i, s.n) + " called " + (last.hit ? "a hit" : "a miss") + " wrongly" };
    /* sunk exactly when every one of that boat's squares has been fired at */
    const nowSunk = onBoat >= 0 && boats[onBoat].every(c => fired[p].has(c));
    if (!!last.sunk !== nowSunk) return { bad: squareName(i, s.n) + ": sinking reported as " + !!last.sunk + ", truth " + nowSunk };
    if (last.sunk && last.sunk.cells.slice().sort((a, b) => a - b).join() !== boats[onBoat].slice().sort((a, b) => a - b).join())
      return { bad: "the boat reported sunk is not the boat that was hit" };
    /* the free water around a wreck is a DEDUCTION: every square it turns over must really be
       water in the fleet that is actually there, and it may only appear when boats can't touch */
    if (s.touch && last.ring.length) return { bad: "boats may touch here, so a wreck must reveal nothing" };
    for (const j of last.ring) {
      if (boats.some(cells => cells.indexOf(j) >= 0)) return { bad: "the ring round a wreck marked " + squareName(j, s.n) + " as water, but a boat is there" };
      fired[p].add(j);                                 /* it is now a known square for that side */
    }
    if (last.sunk && !s.touch) {
      /* and it must reveal ALL of that water, or the deduction is only half made */
      const sea = p === YOU ? s.owl : s.you;
      for (const c of last.sunk.cells) {
        const r = rowOf(c, s.n), cc = colOf(c, s.n);
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, ccc = cc + dc;
          if (rr < 0 || rr >= s.n || ccc < 0 || ccc >= s.n) continue;
          if (sea.marks[rr * s.n + ccc] === UNKNOWN)
            return { bad: squareName(rr * s.n + ccc, s.n) + " beside a wreck was left unknown" };
        }
      }
    }
    /* A HIT MEANS YOU GO AGAIN — the turn only passes on a miss. Checked against `onBoat`,
       which came from the real fleet, not from what the engine reported. */
    if (E.isOver(s)) {
      if (s.turn !== p) return { bad: "the winner should be left to move" };
    } else if (onBoat >= 0) {
      if (s.turn !== p) return { bad: squareName(i, s.n) + " hit, so the shooter should fire again" };
    } else if (s.turn !== other(p)) return { bad: squareName(i, s.n) + " missed, so the turn should pass" };
    /* a boat's hit count is exactly how many of its squares are marked */
    const sea = p === YOU ? s.owl : s.you;
    for (const sh of sea.ships) {
      const marked = sh.cells.filter(c => sea.marks[c] === HIT).length;
      if (sh.hits !== marked) return { bad: sh.name + " counts " + sh.hits + " hits but " + marked + " are marked" };
      if (sh.sunk !== (sh.hits === sh.len)) return { bad: sh.name + " sunk flag disagrees with its hits" };
    }
    /* the other side's sea is untouched by this shot */
    const idle = p === YOU ? s.you : s.owl, was = p === YOU ? before.you : before.owl;
    if (idle.marks.join() !== was.marks.join()) return { bad: "firing changed the shooter's OWN sea" };
  }
  if (!E.isOver(s)) return { bad: "the game never ended" };
  const loser = s.winner === YOU ? s.owl : s.you;
  if (!loser.ships.every(sh => sh.sunk)) return { bad: "the game ended with boats still afloat" };
  const winner = s.winner === YOU ? s.you : s.owl;
  if (winner.ships.every(sh => sh.sunk)) return { bad: "both fleets are sunk — nobody can draw" };
  return { s };
}

const randomShot = (s, p, rng) => {
  const free = E.unknowns(E.seaView(s, p));
  return free[Math.floor(rng() * free.length)];
};
/* With a hit keeping the turn, a side can fire many times in a row — so a play-through's
   runaway guard has to allow every square of both seas, not one turn each. */
for (const key of LEVEL_KEYS) {
  let bad = null, wins = 0, games = 0;
  for (let t = 0; t < stress(400) && !bad; t++) {
    const r = playOut(key, t + 1, randomShot);
    if (r.bad) bad = "seed " + (t + 1) + ": " + r.bad; else { games++; if (r.s.winner === YOU) wins++; }
  }
  ok(!bad, key + ": every shot's verdict should be the truth about the real fleet — " + bad);
  ok(games > 0 && wins > 0 && wins < games,
     key + ": with both sides firing blind, both should win sometimes (" + wins + "/" + games + ")");
}

/* an illegal shot is refused rather than half-applied */
{
  const s = E.newGame("EASY", mulberry32(4));
  const n = s.n;
  ok(E.fire(s, -1) === null && E.fire(s, n * n) === null && E.fire(s, 1.5) === null && E.fire(s, null) === null,
     "a shot off the sea should be refused");
  /* Whoever is to move next, A1 in the sea they are firing INTO is still untouched — the two
     seas are separate — so the shot is legal either way. */
  const after = E.fire(s, 0);
  ok(after && E.fire(after, 0) !== null, "A1 in the other sea is a different square, so it stays legal");
  /* Firing twice at the same square in the SAME sea is refused. Walk to a state where it is
     your turn again (whoever hit keeps firing) and try your very first square once more. */
  let t = after, guard = 0;
  while (t.turn !== YOU && !E.isOver(t) && guard++ < 400)
    t = E.fire(t, E.unknowns(E.seaView(t, t.turn))[0]);
  ok(E.isOver(t) || E.fire(t, 0) === null,
     "firing twice at the same square in the same sea should be refused");
  ok(s.you.marks.every(m => m === UNKNOWN) && s.owl.marks.every(m => m === UNKNOWN),
     "fire() must not mutate the state it was given");
  /* the turn rule itself, stated once and plainly */
  const hitSquare = s.owl.ships[0].cells[0];
  const hit = E.fire(s, hitSquare);
  ok(hit.last.hit && hit.turn === YOU, "a hit hands the turn straight back to the shooter");
  const water = E.unknowns(E.seaView(s, YOU)).find(i => !s.owl.ships.some(sh => sh.cells.includes(i)));
  const miss = E.fire(s, water);
  ok(!miss.last.hit && miss.turn === OWL, "only a miss hands the turn over");
}

/* ---- the owl decides from what it is allowed to know ---------------------------------------- */
/* Put a DIFFERENT fleet behind exactly the same marks: the view the owl gets is unchanged, so a
   peeking owl would change its mind and an honest one cannot. */
for (const key of LEVEL_KEYS) {
  let bad = null, tested = 0;
  const runs = stress(400);
  for (let t = 0; t < runs && !bad; t++) {
    const rng = mulberry32(t + 31);
    let s = E.newGame(key, rng);
    for (let k = 0; k < 6 + Math.floor(rng() * 14) && !E.isOver(s); k++) s = E.fire(s, randomShot(s, s.turn, rng));
    if (E.isOver(s) || s.turn !== OWL) continue;
    /* swap the afloat boats for others of the same lengths; marks and sunkMask live on the sea,
       so the owl's view is byte-for-byte what it was */
    const fake = Object.assign({}, s, { you: Object.assign({}, s.you, {
      ships: s.you.ships.map(sh => sh.sunk ? sh
        : Object.assign({}, sh, { cells: sh.cells.slice().reverse() })) }) });
    const a = E.seaView(s, OWL), b = E.seaView(fake, OWL);
    if (a.marks.join() !== b.marks.join() || a.sunkMask.join() !== b.sunkMask.join() || a.remaining.join() !== b.remaining.join())
      bad = "the two views differ — the test's own setup is wrong";
    else if (E.owlShot(s, mulberry32(t)) !== E.owlShot(fake, mulberry32(t)))
      bad = "seed " + t + ": the owl changed its shot when the boats moved behind the same marks";
    else tested++;
  }
  ok(!bad, key + ": the owl must decide from the marks alone — " + bad);
  ok(tested > runs / 8, key + ": only " + tested + " of " + runs + " positions actually tested the owl's blindness");
}

/* ---- the owls do what they say they do ------------------------------------------------------ */
/* a view the owls can be asked about directly, built from a real game */
function viewAfter(key, seed, shots) {
  const rng = mulberry32(seed);
  let s = E.newGame(key, rng);
  for (let k = 0; k < shots && !E.isOver(s); k++) s = E.fire(s, randomShot(s, s.turn, rng));
  return E.isOver(s) ? null : E.seaView(s, OWL);
}
{
  let notFree = 0, offLine = 0, offTrail = 0, offSweep = 0, aceNotFree = 0, aceOffMax = 0, checked = 0;
  const runs = stress(1500);
  for (let t = 0; t < runs; t++) {
    const key = LEVEL_KEYS[t % LEVEL_KEYS.length];
    const v = viewAfter(key, t + 700, 4 + (t % 25));
    if (!v) continue;
    checked++;
    const rng = mulberry32(t);
    for (const shot of [E.gentleShot(v, mulberry32(t)), E.hunterShot(v, rng), E.aceShot(v, mulberry32(t))])
      if (v.marks[shot] !== UNKNOWN) notFree++;

    const live = E.liveHits(v), ends = oracleLineEnds(v);
    /* lineEnds is the engine's own; check it against the independent sweep */
    const mine = new Set(E.lineEnds(v));
    if (mine.size !== ends.size || [...ends].some(i => !mine.has(i))) offLine++;

    /* the hunter: finish what is wounded, along the line when the line is known */
    const h = E.hunterShot(v, mulberry32(t + 5));
    if (live.length) {
      if (ends.size) { if (!ends.has(h)) offTrail++; }
      else if (!live.some(i => E.orthUnknown(v, i).includes(h))) offTrail++;
    } else {
      const step = Math.min.apply(null, v.remaining.length ? v.remaining : [2]);
      const sweep = E.unknowns(v).filter(i => (rowOf(i, v.n) + colOf(i, v.n)) % step === 0);
      if (sweep.length && (rowOf(h, v.n) + colOf(h, v.n)) % step !== 0) offSweep++;
    }

    /* the ace: while hunting it must fire where the most boats could still be — checked against
       the placements counted independently above */
    const a = E.aceShot(v, mulberry32(t + 9));
    if (v.marks[a] !== UNKNOWN) aceNotFree++;
    if (!live.length) {
      const { best, top } = argmax(oracleDensity(v));
      if (best > 0 && !top.has(a)) aceOffMax++;
    } else if (!v.remaining.some(len => consistentPlacements(v, len).some(cells => cells.includes(a) && cells.some(i => live.includes(i)))))
      aceOffMax++;   /* while following up, its square must lie on a boat that reaches a live hit */
  }
  ok(checked > runs / 2, "not enough positions to judge the owls (" + checked + " of " + runs + ")");
  ok(notFree === 0, "an owl fired at a square already fired at, " + notFree + " times");
  ok(offLine === 0, "lineEnds disagreed with an independent sweep in " + offLine + " positions");
  ok(offTrail === 0, "the hunter failed to follow up a wounded boat " + offTrail + " times");
  ok(offSweep === 0, "the hunter fired off its checkerboard sweep " + offSweep + " times");
  ok(aceNotFree === 0, "the EXPERT owl fired at a known square " + aceNotFree + " times");
  ok(aceOffMax === 0, "the EXPERT owl fired somewhere no remaining boat could be, " + aceOffMax + " times");
}

/* the hint is the ace's reckoning run on the owl's sea, so it obeys the same promise */
{
  let bad = 0, checked = 0;
  const runs = stress(600);
  for (let t = 0; t < runs; t++) {
    const rng = mulberry32(t + 4242);
    let s = E.newGame(LEVEL_KEYS[t % LEVEL_KEYS.length], rng);
    for (let k = 0; k < 3 + (t % 20) && !E.isOver(s); k++) s = E.fire(s, randomShot(s, s.turn, rng));
    if (E.isOver(s)) continue;
    checked++;
    const i = E.hintShot(s, mulberry32(t));
    if (s.owl.marks[i] !== UNKNOWN) bad++;
  }
  ok(checked > runs / 2 && bad === 0, "the hint should always name a square you have not fired at (" + bad + " bad of " + checked + " of " + runs + ")");
}

/* ---- the three owls are three real experiences ---------------------------------------------- */
/* How many shots each owl needs to clear a sea, with nobody shooting back — a clean measure of
   skill that does not depend on the opponent. */
function shotsToClear(kind, key, seed) {
  const L = LEVELS[key], rng = mulberry32(seed);
  let s = E.newGame(key, rng);
  s = Object.assign({}, s, { turn: OWL });
  const shooter = kind === "gentle" ? E.gentleShot : kind === "hunter" ? E.hunterShot : E.aceShot;
  let shots = 0;
  while (!E.isOver(s) && shots < 4 * s.n * s.n) {
    const next = E.fire(s, shooter(E.seaView(s, OWL), rng));
    if (!next) break;
    s = Object.assign({}, next, { turn: OWL });
    shots++;
  }
  return E.isOver(s) ? shots : Infinity;
}
{
  const runs = stress(250), mean = {};
  for (const kind of ["gentle", "hunter", "ace"]) {
    let total = 0, worst = 0;
    for (let t = 0; t < runs; t++) {
      const got = shotsToClear(kind, "EASY", t + 1);
      ok(got !== Infinity, kind + " owl failed to clear a sea from seed " + (t + 1));
      total += got; worst = Math.max(worst, got);
    }
    mean[kind] = total / runs;
    console.log("  " + kind.padEnd(7) + " clears a 10×10 sea in " + mean[kind].toFixed(1) + " shots on average (worst " + worst + ")");
  }
  const cells = FLEET.reduce((a, s) => a + s.len, 0);
  ok(mean.ace >= cells, "the ace cannot beat the " + cells + " shots the boats themselves need");
  ok(mean.hunter < mean.gentle - 3, "the hunter should be clearly sharper than the sleepy owl (" + mean.hunter.toFixed(1) + " vs " + mean.gentle.toFixed(1) + ")");
  ok(mean.ace < mean.hunter - 1, "the ace should be clearly sharper than the hunter (" + mean.ace.toFixed(1) + " vs " + mean.hunter.toFixed(1) + ")");
  ok(mean.gentle < 100, "even the sleepy owl should finish a 10×10 sea in under 100 shots on average");
}

/* and the levels are wired to the owls they claim, EXPERT slipping to the hunter now and then */
{
  ok(LEVEL_KEYS.join() === "EASY,EXPERT", "battleship has exactly two levels, got " + LEVEL_KEYS.join());
  ok(LEVELS.EASY.owl === "gentle" && LEVELS.EXPERT.owl === "ace",
     "each level should use the owl its description names");
  ok(LEVELS.EASY.n === 10 && LEVELS.EXPERT.n === 10,
     "both levels are played on a full 10×10 sea — a smaller one is the boring game");
  ok(!LEVELS.EASY.touch && LEVELS.EXPERT.touch,
     "boats may only touch at EXPERT — that is what makes a wreck worth less there");
  /* The slip is what keeps EXPERT winnable. owlShot spends one rng value deciding whether to
     slip, so a fresh stream is not the one the shot comes from — hand it a first value either
     side of the threshold and the rest of the stream unchanged, and each branch is exact. */
  const rngWithFirst = (first, seed) => {
    const r = mulberry32(seed);
    let spent = false;
    return () => { if (!spent) { spent = true; return first; } return r(); };
  };
  ok(LEVELS.EXPERT.slip > 0 && LEVELS.EXPERT.slip < 0.3,
     "EXPERT's slip should be a small chance, got " + LEVELS.EXPERT.slip);
  let slipped = 0, aimed = 0, tried = 0;
  for (let t = 0; t < stress(300); t++) {
    const rng = mulberry32(t + 55);
    let s = E.newGame("EXPERT", rng);
    for (let k = 0; k < 6 + (t % 18) && !E.isOver(s); k++) s = E.fire(s, randomShot(s, s.turn, rng));
    if (E.isOver(s)) continue;
    s = Object.assign({}, s, { turn: OWL });
    const v = E.seaView(s, OWL);
    tried++;
    if (E.owlShot(s, rngWithFirst(LEVELS.EXPERT.slip / 2, t)) === E.hunterShot(v, mulberry32(t))) slipped++;
    if (E.owlShot(s, rngWithFirst(0.99, t)) === E.aceShot(v, mulberry32(t))) aimed++;
  }
  ok(tried > 20, "not enough EXPERT positions to check the slip (" + tried + ")");
  ok(slipped === tried, "below the threshold EXPERT must play the plain hunter (" + slipped + "/" + tried + ")");
  ok(aimed === tried, "above the threshold EXPERT must play the ace (" + aimed + "/" + tried + ")");
  /* EASY has no slip at all — it is the sleepy owl every single time */
  let plain = 0;
  for (let t = 0; t < 60; t++) {
    const e = E.newGame("EASY", mulberry32(t + 3));
    if (E.owlShot(Object.assign({}, e, { turn: OWL }), mulberry32(t)) === E.gentleShot(E.seaView(e, OWL), mulberry32(t))) plain++;
  }
  ok(plain === 60, "EASY should have no slip — it always plays the sleepy owl (" + plain + "/60)");
  const v = viewAfter("EXPERT", 12, 10);
  ok(v && v.n === 10, "EXPERT should be played on a 10×10 sea");
}

/* ---- the three levels are three real experiences --------------------------------------------- */
/* A whole game against each owl, with the player firing as well as the Hint knows how — the
   nearest thing to a child playing carefully. The two levels have to feel different: EASY is
   the one a child almost always wins, EXPERT is a genuine fight. A level nobody can win is as
   broken as one nobody can lose. */
{
  const runs = stress(400), rate = {};
  for (const key of LEVEL_KEYS) {
    let wins = 0, played = 0, shots = 0;
    for (let t = 0; t < runs; t++) {
      const rng = mulberry32(t + 1);
      let s = E.newGame(key, rng), guard = 0;
      while (!E.isOver(s) && guard++ < 4 * s.n * s.n)
        s = E.fire(s, s.turn === YOU ? E.hintShot(s, rng) : E.owlShot(s, rng));
      ok(E.isOver(s), key + ": a careful game from seed " + (t + 1) + " never finished");
      played++; shots += s.moves;
      if (s.winner === YOU) wins++;
    }
    rate[key] = wins / played;
    console.log("  " + key.padEnd(7) + " a careful player wins " + (100 * rate[key]).toFixed(1)
                + "% of the time (" + (shots / played).toFixed(0) + " shots a game)");
  }
  ok(rate.EASY > 0.85, "EASY should be a level a child almost always wins, got " + (100 * rate.EASY).toFixed(1) + "%");
  ok(rate.EXPERT > 0.3 && rate.EXPERT < rate.EASY,
     "EXPERT should be a real fight — hard, but never unwinnable — got " + (100 * rate.EXPERT).toFixed(1) + "%");
}

/* ---- stars ---------------------------------------------------------------------------------- */
ok(E.starsFor(0) === 3 && E.starsFor(1) === 2 && E.starsFor(2) === 1 && E.starsFor(9) === 1,
   "three stars with no hints, one off per hint, never below one");

/* square names are the A1 the player reads off the sea */
ok(squareName(0, 8) === "A1" && squareName(7, 8) === "A8" && squareName(8, 8) === "B1" && squareName(63, 8) === "H8",
   "squares should be named letter-down-the-side, number-across-the-top");

report("battleship engine");
