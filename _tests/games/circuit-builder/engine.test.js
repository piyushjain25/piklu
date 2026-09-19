"use strict";
/* Circuit Builder stands on two claims: the simulation is right (a bulb lights exactly when
   current can get round, dims when it shares its path, and a path with no bulb is a short), and
   every puzzle it deals can actually be finished. The first is proved against hand-built
   circuits, the second in bulk — 5,000 puzzles per level, each solved with the real check(). */
const { read, loadEngine, mulberry32, tally, stress } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("circuit-builder");
const RAW = JSON.parse(read("games/circuit-builder/components.json"));
const CAT = E.validateCatalog(RAW);
const C = id => CAT.find(c => c.id === id);

/* ---------- 0. the catalogue ---------- */
ok(!!CAT, "components.json should validate");
ok(CAT.length === RAW.components.length, "every entry in components.json should survive validation");
for(const k of ["source", "conductor", "insulator", "load", "switch"])
  ok(CAT.some(c => c.kind === k), "the catalogue needs at least one " + k);
ok(CAT.filter(c => c.kind === "conductor" && c.shape === "straight" && c.id !== "wire").length >= 3,
   "at least three everyday conductors");
ok(CAT.filter(c => c.kind === "insulator").length >= 3, "at least three insulators");
ok(C("corner").shape === "corner" && C("junction").shape === "tee" && C("wire").shape === "straight", "wire shapes");
ok(E.validateCatalog({ components: [] }) === null, "an empty catalogue is refused, not half-used");
ok(E.validateCatalog(null) === null, "no data → null");
ok(E.validateCatalog({ components: RAW.components.concat([{ id:"odd", name:"Odd", emoji:"?", kind:"load", ends:3 }]) }).length
   === RAW.components.length, "a three-ended bulb is dropped");

/* ---------- 1. the simulation, against hand-built circuits ---------- */
let uid = 0;
const piece = (id, r, c, need, extra) =>
  Object.assign(E.makePiece(C(id), r, c, E.fitRot(C(id).shape, need), "t" + (uid++)), extra || {});
/* a 2-row loop `w` wide; slots name the part at each place round it (1,2 on top, 5,6 below) */
function loop(w, slots){
  return E.loopCells(0, 0, 2, w).map((cl, i) => {
    const id = slots[i] || (cl.shape === "corner" ? "corner" : "wire");
    return id === "gap" ? null : piece(id, cl.r, cl.c, cl.need, id === "switch" ? { closed: !!slots.closed } : null);
  }).filter(Boolean);
}
const lit = (s, p) => s.lit.includes(p.uid), dim = (s, p) => s.dim.includes(p.uid), off = (s, p) => s.off.includes(p.uid);
const bulbs = ps => ps.filter(p => p.kind === "load");

{
  const closed = loop(4, { 1:"bulb", 5:"battery" }), s = E.simulate(closed);
  ok(lit(s, bulbs(closed)[0]) && s.complete && !s.shorted, "closed loop → bulb lit at full brightness");

  const open = loop(4, { 1:"bulb", 2:"gap", 5:"battery" }), so = E.simulate(open);
  ok(off(so, bulbs(open)[0]) && !so.complete && !so.shorted, "open loop → bulb off");

  for(const ins of CAT.filter(c => c.kind === "insulator")){
    const ps = loop(4, { 1:"bulb", 2:ins.id, 5:"battery" }), si = E.simulate(ps);
    ok(off(si, bulbs(ps)[0]) && !si.complete, "a " + ins.name + " in the loop → bulb off");
  }
  for(const con of CAT.filter(c => c.kind === "conductor" && c.shape === "straight")){
    const ps = loop(4, { 1:"bulb", 2:con.id, 5:"battery" });
    ok(lit(E.simulate(ps), bulbs(ps)[0]), "a " + con.name + " in the loop → bulb lit");
  }

  const swOpen = loop(4, { 1:"bulb", 2:"switch", 5:"battery", closed:false });
  const swShut = loop(4, { 1:"bulb", 2:"switch", 5:"battery", closed:true });
  ok(off(E.simulate(swOpen), bulbs(swOpen)[0]), "open switch → bulb off");
  ok(lit(E.simulate(swShut), bulbs(swShut)[0]), "closed switch → bulb lit");

  const series = loop(4, { 1:"bulb", 2:"bulb", 5:"battery" }), ss = E.simulate(series);
  ok(bulbs(series).every(b => dim(ss, b)), "two bulbs in series → both dim");
  ok(bulbs(series).every(b => Math.abs(ss.current[b.uid] - .5) < 1e-9), "series bulbs each get exactly half");
  ok(ss.complete && !ss.shorted, "a series circuit is complete, not shorted");

  const three = loop(5, { 1:"bulb", 2:"bulb", 3:"bulb", 6:"battery" }), s3 = E.simulate(three);
  ok(bulbs(three).every(b => dim(s3, b) && Math.abs(s3.current[b.uid] - 1/3) < 1e-9), "three in series → a third each");

  const noLoad = loop(3, { 4:"battery" }), sn = E.simulate(noLoad);
  ok(sn.shorted && !sn.complete, "a loop with no bulb → shorted");

  /* two parts missing from the bottom row: still just an open loop */
  const shortcut = loop(4, { 1:"bulb", 5:"battery" }).filter(p => !(p.r === 1 && p.c === 2) && !(p.r === 1 && p.c === 1));
  ok(E.simulate(shortcut).off.length === 1, "sanity: a broken bottom row leaves the bulb off");

  const oneEnd = loop(4, { 1:"bulb", 5:"battery" }); bulbs(oneEnd)[0].oneEnd = true;
  const s1 = E.simulate(oneEnd);
  ok(s1.shorted && off(s1, bulbs(oneEnd)[0]), "bulb wired to one contact → it's bypassed, a short");

  const turned = loop(4, { 1:"bulb", 5:"battery" }); turned[2].rot = E.nextRot(turned[2]);
  ok(!E.simulate(turned).complete, "one part turned so an end doesn't touch → off");
  ok(E.connections(turned).get(turned[2].uid).some(j => !j.joined), "…and its loose end shows as not joined");
  ok([...E.connections(loop(4, { 1:"bulb", 5:"battery" })).values()].every(js => js.every(j => j.joined)),
     "every end of a closed loop is joined");

  ok(E.simulate(loop(4, { 1:"bulb", 2:"wire" })).off.length === 1, "no battery → nothing lights");
}

/* parallel: the ladder — battery and two bulbs, each on its own rung */
function ladder(rungs){
  const out = [
    piece("corner", 0, 0, [1,2]), piece("junction", 0, 1, [3,1,2]), piece("corner", 0, 2, [3,2]),
    piece("corner", 2, 0, [1,0]), piece("junction", 2, 1, [3,1,0]), piece("corner", 2, 2, [3,0]),
  ];
  rungs.forEach((id, c) => { if(id) out.push(piece(id, 1, c, [0,2])); });
  return out;
}
{
  const par = ladder(["battery", "bulb", "bulb"]), sp = E.simulate(par);
  ok(bulbs(par).every(b => lit(sp, b)), "two bulbs in parallel → both full brightness");
  ok(sp.complete && !sp.shorted, "the parallel circuit is complete");
  for(const b of bulbs(par)){
    const s = E.simulate(par.filter(p => p !== b));
    ok(s.lit.length === 1 && !s.shorted, "pulling one parallel bulb leaves the other lit");
  }
  const wired = ladder(["battery", "bulb", "wire"]), sw = E.simulate(wired);
  ok(sw.shorted && off(sw, bulbs(wired)[0]), "a plain wire rung beside a bulb → short, bulb dark");
}

/* a ladder of any shape: rungs list their parts top to bottom, other rung squares are wire */
function ladderOf(rungs, open){
  const len = Math.max(...rungs.map(r => r.length)), n = rungs.length, out = [];
  rungs.forEach((parts, c) => {
    const end = c === 0 || c === n - 1;
    out.push(piece(end ? "corner" : "junction", 0, c, c === 0 ? [1,2] : c === n - 1 ? [3,2] : [3,1,2]));
    out.push(piece(end ? "corner" : "junction", len + 1, c, c === 0 ? [1,0] : c === n - 1 ? [3,0] : [3,1,0]));
    for(let y = 0; y < len; y++) out.push(piece(parts[y] || "wire", y + 1, c, [0,2], parts[y] === "switch" ? { closed: !open } : null));
  });
  return out;
}
{
  /* the labels a load shows come from the catalogue */
  ok(JSON.stringify(C("bulb").says) === '["lit","dim","off"]', "a bulb says lit / dim / off");
  ok(CAT.filter(c => c.kind === "load").length >= 3, "at least three kinds of load (bulb, buzzer, motor)");
  ok(CAT.filter(c => c.kind === "load").every(c => Array.isArray(c.says) && c.says.length === 3), "every load names its three states");
  ok(E.validateCatalog({ components: RAW.components.map(c => c.id === "buzzer" ? Object.assign({}, c, { says:["x"] }) : c) })
     .every(c => c.id !== "buzzer"), "a load with a malformed says is dropped");
  /* a buzzer and a motor behave exactly like a bulb */
  const mixed = ladderOf([["battery"], ["buzzer"], ["motor"]]), sm = E.simulate(mixed);
  ok(sm.lit.length === 2 && !sm.shorted, "a buzzer and a motor on their own paths both run at full");
  const mixedSeries = loop(4, { 1:"buzzer", 2:"motor", 5:"battery" }), sms = E.simulate(mixedSeries);
  ok(sms.dim.length === 2, "a buzzer and a motor sharing a path both run weakly");
  /* where a switch sits decides what it turns off */
  const own = ladderOf([["battery", "wire"], ["bulb", "switch"], ["buzzer", "wire"]], true), so = E.simulate(own);
  ok(so.off.length === 1 && so.lit.length === 1 && bulbs(own).find(b => b.id === "bulb").uid === so.off[0],
     "an open switch on a part's own path turns off just that part");
  const main = ladderOf([["battery", "switch"], ["bulb"], ["buzzer"]], true), sa = E.simulate(main);
  ok(sa.off.length === 2 && !sa.complete, "an open switch on the battery's path turns off everything");
}

/* ---------- 2. check() per level ---------- */
{
  const P = (lv, kind, loads) => ({ level: lv, rows: 4, cols: 5, task: lv === "EXPERT" ? { kind: kind || "pair", loads: loads || ["bulb", "bulb"] } : null });
  ok(E.check(P("EASY"), loop(4, { 1:"bulb", 5:"battery" })).ok, "EASY: closed loop passes");
  ok(E.check(P("EASY"), loop(4, { 1:"bulb", 2:"gap", 5:"battery" })).reason === "open", "EASY: gap → open");
  ok(E.check(P("EASY"), loop(3, { 4:"battery" })).reason === "short", "EASY: no bulb → short");

  const med = open => loop(4, { 1:"bulb", 2:"switch", 5:"battery", closed: open === false });
  ok(E.check(P("MEDIUM"), med(true)).ok, "MEDIUM: a switch in the loop passes even while open");
  ok(E.check(P("MEDIUM"), med(false)).ok, "MEDIUM: …and while closed");
  ok(E.check(P("MEDIUM"), loop(4, { 1:"bulb", 5:"battery" })).reason === "noSwitch", "MEDIUM: no switch → noSwitch");
  const offLoop = loop(4, { 1:"bulb", 5:"battery" }).concat([piece("switch", 3, 3, [3,1], { closed:true })]);
  ok(E.check(P("MEDIUM"), offLoop).reason === "noSwitch", "MEDIUM: a switch sitting off the loop doesn't count");

  const par = ladder(["battery", "bulb", "bulb"]);
  ok(E.check(P("EXPERT"), par).ok, "EXPERT: parallel bulbs pass");
  ok(E.check(P("EXPERT", "pair", ["bulb", "buzzer"]), par).reason === "missing", "EXPERT: the task's own parts are required");
  ok(E.check(P("EXPERT", "pair", ["bulb", "buzzer"]), ladderOf([["battery"], ["bulb"], ["buzzer"]])).ok, "EXPERT pair: bulb + buzzer passes");
  ok(E.check(P("EXPERT", "trio", ["bulb", "buzzer", "motor"]), ladderOf([["battery"], ["bulb"], ["buzzer"], ["motor"]])).ok,
     "EXPERT trio: three parts on three paths passes");
  ok(E.check(P("EXPERT", "trio", ["bulb", "buzzer", "motor"]), ladderOf([["battery"], ["bulb", "buzzer"], ["motor"]])).reason === "series",
     "EXPERT trio: two of them sharing a path fails");
  const each = ["bulb", "buzzer"];
  ok(E.check(P("EXPERT", "eachSwitch", each), ladderOf([["battery"], ["bulb", "switch"], ["buzzer", "switch"]], true)).ok,
     "EXPERT eachSwitch: a switch on each path passes (whichever way the switches are set)");
  ok(E.check(P("EXPERT", "eachSwitch", each), ladderOf([["battery", "switch"], ["bulb", "switch"], ["buzzer"]])).reason === "eachSwitch",
     "EXPERT eachSwitch: a switch on the battery's path doesn't count as the buzzer's own");
  ok(E.check(P("EXPERT", "eachSwitch", each), ladderOf([["battery"], ["bulb"], ["buzzer"]])).reason === "eachSwitch",
     "EXPERT eachSwitch: no switches fails");
  ok(E.check(P("EXPERT", "master", each), ladderOf([["battery", "switch"], ["bulb"], ["buzzer"]])).ok,
     "EXPERT master: one switch on the battery's path passes");
  ok(E.check(P("EXPERT", "master", each), ladderOf([["battery"], ["bulb", "switch"], ["buzzer"]])).reason === "master",
     "EXPERT master: a switch on one part's path doesn't turn everything off");
  ok(E.check(P("EXPERT", "master", each), loop(5, { 1:"bulb", 2:"buzzer", 3:"switch", 6:"battery" })).reason === "series",
     "EXPERT master: one loop with a switch is still a shared path");
  const ser = loop(4, { 1:"bulb", 2:"bulb", 5:"battery" });
  ok(E.check(P("EXPERT"), ser).reason === "series", "EXPERT: series bulbs fail the pull-one-out test");
  ok(E.check(P("EXPERT"), loop(4, { 1:"bulb", 5:"battery" })).reason === "missing", "EXPERT: one bulb → missing");
  ok(E.check(P("EXPERT"), ladder(["battery", "bulb", "wire"]).concat([piece("bulb", 3, 0, [3,1])])).reason === "short",
     "EXPERT: a shorting rung fails");
}

/* ---------- 3. 5,000 puzzles per level: solvable, not pre-solved, well-formed ---------- */
const PER_LEVEL = stress(5000);
const sameCell = (a, b) => a.r === b.r && a.c === b.c;
const samePiece = (a, b) => a.id === b.id && sameCell(a, b) && a.rot === b.rot && !!a.closed === !!b.closed && !!a.oneEnd === !!b.oneEnd;
for(const lv of Object.keys(E.LEVELS)){
  const rng = mulberry32(0xC1C + lv.length), L = E.LEVELS[lv];
  let nul = 0, unsolvable = 0, shorted = 0, presolved = 0, outside = 0, overlap = 0, unreachable = 0, repeat = 0;
  let notOneFault = 0, fixFails = 0, trayCantFix = 0, expertBad = 0, unlocked = 0, noSpares = 0, taskBad = 0, giveaway = 0;
  const faults = {}, shapes = {}, tasks = {}, loadKinds = new Set();
  let prev = null;
  for(let t = 0; t < PER_LEVEL; t++){
    const p = E.newPuzzle(lv, CAT, rng, prev ? prev.key : null);
    if(!p){ nul++; continue; }
    if(prev && prev.key === p.key) repeat++;
    prev = p;
    const s = E.simulate(p.solution);
    if(!E.check(p, p.solution).ok) unsolvable++;
    if(s.shorted) shorted++;
    if(E.check(p, p.opening).ok) presolved++;
    const all = p.solution.concat(p.opening);
    if(all.some(q => q.r < 0 || q.c < 0 || q.r >= L.rows || q.c >= L.cols)) outside++;
    if(new Set(p.solution.map(q => q.r + "," + q.c)).size !== p.solution.length) overlap++;

    const trayTotal = p.tray.reduce((a, t) => a + t.n, 0);
    const missingN = p.solution.filter(q => !p.opening.some(o => sameCell(o, q))).length;
    /* HARD and EXPERT always carry at least three parts more than the circuit needs — fixed
       here, not read from LEVELS, so shrinking the game's spares can't quietly pass */
    if((lv === "HARD" || lv === "EXPERT") && trayTotal - missingN < 3) noSpares++;
    bulbs(p.solution).forEach(b => loadKinds.add(b.id));
    if(lv === "HARD"){
      faults[p.fault.type] = (faults[p.fault.type] || 0) + 1;
      const shape = p.solution.some(q => q.shape === "tee") ? "ladder" : "loop";
      shapes[shape] = (shapes[shape] || 0) + 1;
      if(s.off.length) fixFails++;
      /* exactly one part differs from the working circuit, and it is the named fault */
      const diff = p.solution.filter(q => !samePiece(q, p.opening.find(o => sameCell(o, q))));
      if(diff.length !== 1 || diff[0].uid !== p.fault.uid || p.opening.length !== p.solution.length) notOneFault++;
      if(p.opening.filter(q => q.locked).some(q => q.kind !== "source")) unlocked++;
      /* fixing it the way a player would lights the bulb */
      const st = E.startState(p), f = st.placements.find(q => q.uid === p.fault.uid);
      if(p.fault.type === "insulator"){
        const want = p.solution.find(q => q.uid === p.fault.uid);
        if(!st.tray.some(x => x.id === want.id)) trayCantFix++;
        Object.assign(f, { id: want.id, name: want.name, emoji: want.emoji, kind: want.kind });
      }
      else if(p.fault.type === "gap") f.rot = p.solution.find(q => q.uid === f.uid).rot;
      else if(p.fault.type === "switch") f.closed = true;
      else delete f.oneEnd;
      if(!E.check(p, st.placements).ok) fixFails++;
    } else {
      /* every opening part is exactly where the solution has it, and the tray covers the rest */
      const need = {};
      for(const q of p.solution){
        const o = p.opening.find(x => sameCell(x, q));
        if(o){ if(o.id !== q.id || o.rot !== q.rot) unreachable++; }
        else need[q.id] = (need[q.id] || 0) + 1;
      }
      for(const id in need){ const tr = p.tray.find(x => x.id === id); if(!tr || tr.n < need[id]) unreachable++; }
      if(!p.opening.every(q => q.locked)) unlocked++;
    }
    if(lv === "EXPERT"){
      const t = p.task, bs = bulbs(p.solution), sws = p.solution.filter(q => q.kind === "switch");
      tasks[t.kind] = (tasks[t.kind] || 0) + 1;
      if(bs.map(b => b.id).sort().join() !== t.loads.slice().sort().join()) taskBad++;
      if(bs.length !== (t.kind === "trio" ? 3 : 2) || !bs.every(b => s.lit.includes(b.uid))) expertBad++;
      for(const b of bs){ const s2 = E.simulate(p.solution.filter(q => q !== b)); if(s2.lit.length !== bs.length - 1 || s2.shorted) expertBad++; }
      const offBy = sw => E.simulate(p.solution.map(q => q === sw ? Object.assign({}, q, { closed:false }) : q)).off;
      if(t.kind === "eachSwitch" && (sws.length !== 2 || !bs.every(b => sws.some(sw => { const o = offBy(sw); return o.length === 1 && o[0] === b.uid; })))) taskBad++;
      if(t.kind === "master" && (sws.length !== 1 || offBy(sws[0]).length !== bs.length)) taskBad++;
      if((t.kind === "pair" || t.kind === "trio") && sws.length) taskBad++;
      /* nothing that answers the task is left on the bench: loads, switches and junctions are all in the tray */
      if(p.opening.some(q => q.kind === "load" || q.kind === "switch" || q.shape === "tee")) giveaway++;
      /* the same parts wired as one loop must fail */
      const series = loop(5, { 1:t.loads[0], 2:t.loads[1], 3:t.loads[2] || "wire", 6:"battery", 7:sws.length ? "switch" : "wire" });
      if(E.check(p, series).ok) expertBad++;
    }
  }
  ok(nul === 0, lv + ": newPuzzle gave up " + nul + " times");
  ok(unsolvable === 0, lv + ": " + unsolvable + " intended solutions fail check()");
  ok(shorted === 0, lv + ": " + shorted + " intended solutions are shorted");
  ok(presolved === 0, lv + ": " + presolved + " puzzles were already solved at the start");
  ok(outside === 0, lv + ": " + outside + " puzzles put a part off the bench");
  ok(overlap === 0, lv + ": " + overlap + " puzzles stacked two parts in one square");
  ok(repeat === 0, lv + ": Skip/Next reproduced the current puzzle " + repeat + " times");
  ok(unlocked === 0, lv + ": " + unlocked + " puzzles locked the wrong parts");
  if(lv === "HARD" || lv === "EXPERT") ok(noSpares === 0, lv + ": " + noSpares + " trays held only what the circuit needs — spares are required");
  if(lv === "HARD"){
    ok(notOneFault === 0, "HARD: " + notOneFault + " puzzles did not have exactly one fault");
    ok(fixFails === 0, "HARD: fixing the fault failed to light the bulb " + fixFails + " times");
    ok(trayCantFix === 0, "HARD: " + trayCantFix + " insulator faults had no replacement in the tray");
    ok(E.FAULTS.every(f => faults[f] > PER_LEVEL / 10), "HARD: all four faults come up: " + JSON.stringify(faults));
    ok(shapes.loop > PER_LEVEL / 4 && shapes.ladder > PER_LEVEL / 4, "HARD: both single loops and two-path circuits: " + JSON.stringify(shapes));
    ok(["bulb", "buzzer", "motor"].every(k => loadKinds.has(k)), "HARD: bulbs, buzzers and motors all appear");
  } else ok(unreachable === 0, lv + ": " + unreachable + " puzzles can't be finished from the tray");
  if(lv === "EXPERT"){
    ok(expertBad === 0, "EXPERT: " + expertBad + " solutions don't survive pulling a part, or a one-loop wiring passed");
    ok(taskBad === 0, "EXPERT: " + taskBad + " solutions don't do what their task asks");
    ok(giveaway === 0, "EXPERT: " + giveaway + " openings left a load, switch or junction on the bench");
    ok(E.TASKS.every(k => tasks[k] > PER_LEVEL / 10), "EXPERT: every task comes up: " + JSON.stringify(tasks));
    ok(["bulb", "buzzer", "motor"].every(k => loadKinds.has(k)), "EXPERT: bulbs, buzzers and motors all appear");
  }
  if(lv === "EASY" || lv === "MEDIUM") ok(loadKinds.size === 1 && loadKinds.has("bulb"), lv + ": the loop is always a bulb");
  console.log("  " + lv + ": " + PER_LEVEL + " puzzles ✓" + (lv === "HARD" ? " — faults " + JSON.stringify(faults) + " " + JSON.stringify(shapes)
    : lv === "EXPERT" ? " — tasks " + JSON.stringify(tasks) : ""));
}

/* ---------- 4. Reset, Skip and the small helpers ---------- */
for(const lv of Object.keys(E.LEVELS)){
  const rng = mulberry32(5 + lv.length);
  for(let t = 0; t < stress(200); t++){
    const p = E.newPuzzle(lv, CAT, rng), before = JSON.stringify(p.opening), tray = JSON.stringify(p.tray);
    const st = E.startState(p);
    ok(JSON.stringify(st.placements) === before && JSON.stringify(st.tray) === tray, lv + ": startState is the opening, exactly");
    st.placements.forEach(q => { q.rot = E.nextRot(q); q.r += 9; });
    st.placements.pop(); st.tray.forEach(x => x.n = 0);
    const again = E.startState(p);
    if(JSON.stringify(again.placements) !== before || JSON.stringify(again.tray) !== tray){
      ok(false, lv + ": playing mutated the puzzle, so Reset would not restore the opening"); break;
    }
  }
  /* Skip/Next never reproduce the puzzle being replaced, even straight after each other */
  let p = E.newPuzzle(lv, CAT, rng), rep = 0;
  for(let t = 0; t < stress(300); t++){ const q = E.newPuzzle(lv, CAT, rng, p.key); if(q.key === p.key) rep++; p = q; }
  ok(rep === 0, lv + ": avoidKey was ignored " + rep + " times");
}
for(const shape of Object.keys(E.SHAPES))
  for(let rot = 0; rot < E.SHAPES[shape].turns; rot++)
    ok(E.fitRot(shape, E.portsOf({ shape, rot })) === rot, shape + " rot " + rot + " round-trips through fitRot");
{
  /* autoRot turns a dropped part to join its neighbours */
  const ps = loop(4, { 1:"bulb", 5:"battery" }), gone = ps.splice(2, 1)[0];
  ok(E.autoRot(ps, gone.shape, gone.r, gone.c, 2, 4) === gone.rot, "autoRot joins a straight gap");
  const ps2 = loop(4, { 1:"bulb", 5:"battery" }), corner = ps2.splice(0, 1)[0];
  ok(E.autoRot(ps2, corner.shape, corner.r, corner.c, 2, 4) === corner.rot, "autoRot joins a corner gap");
}
ok(E.starsFor(0, 0) === 3, "no misses, no hints → 3");
ok(E.starsFor(1, 0) === 2 && E.starsFor(0, 1) === 2 && E.starsFor(0, 2) === 2, "one miss, or one or two hints → 2");
ok(E.starsFor(2, 0) === 1 && E.starsFor(0, 3) === 1 && E.starsFor(1, 1) === 1, "anything more → 1");
{
  const hp = f => ({ level:"HARD", rows:2, cols:4, fault:null });
  const ins = loop(4, { 1:"bulb", 2:"spoon", 5:"battery" });
  ok(E.diagnose(hp(), ins) === "insulator", "hint names an insulator problem");
  const sw = loop(4, { 1:"bulb", 2:"switch", 5:"battery", closed:false });
  ok(E.diagnose(hp(), sw) === "switch", "hint names an open switch");
  const t2 = loop(4, { 1:"bulb", 5:"battery" }); t2[2].rot = E.nextRot(t2[2]);
  ok(E.diagnose(hp(), t2) === "loose", "hint names a loose end");
  const o = loop(4, { 1:"bulb", 5:"battery" }); bulbs(o)[0].oneEnd = true;
  ok(E.diagnose(hp(), o) === "oneEnd", "hint names a bulb on one contact");
  ok(E.diagnose({ level:"EASY", rows:2, cols:4 }, loop(4, { 1:"bulb", 2:"gap", 5:"battery" })) === "gap", "hint names a gap");
  const ex = (kind, loads) => ({ level:"EXPERT", rows:4, cols:5, task:{ kind, loads } });
  ok(E.diagnose(ex("pair", ["bulb", "bulb"]), loop(4, { 1:"bulb", 2:"bulb", 5:"battery" })) === "series", "hint names a shared path");
  ok(E.diagnose(ex("pair", ["bulb", "motor"]), loop(4, { 1:"bulb", 5:"battery" })) === "missing", "hint names a missing part");
  ok(E.diagnose(ex("master", ["bulb", "buzzer"]), ladderOf([["battery"], ["bulb", "switch"], ["buzzer"]])) === "master", "hint names a misplaced master switch");
  ok(E.diagnose(ex("eachSwitch", ["bulb", "buzzer"]), ladderOf([["battery"], ["bulb"], ["buzzer"]])) === "eachSwitch", "hint names missing own switches");
  ok(E.diagnose(hp(), loop(4, { 1:"bulb", 5:"battery" })) === "ready", "hint says ready on a working circuit");
}

report("circuit-builder engine");
