"use strict";
/* Headless play-through of Circuit Builder: boots the real page with the real components.json,
   then builds every level's circuit through the UI — tray tap, bench tap, pick up and turn —
   and checks Switch on ⚡ gives way to Next ▶ in place, a broken circuit keeps the round going,
   every HARD fault can be fixed by hand, Reset restores the opening, EXPERT's bulbs can be
   pulled, and the level chip starts a fresh puzzle without leaving the game. */
const { read, bootGame, loadEngine, tally, sleep } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("circuit-builder");
const DATA = JSON.parse(read("games/circuit-builder/components.json"));

(async () => {
  const { w, d, $ } = bootGame("circuit-builder", {
    data: { "components.json": DATA },
    onError: e => ok(false, "page error: " + e.message),
  });
  for (let i = 0; i < 50 && $("start-btn").disabled; i++) await sleep(10);

  const P = () => w.eval("P"), S = () => w.eval("S");
  const vis = id => !$(id).classList.contains("hide");
  const cell = (r, c) => $("bench").children[r * P().cols + c];
  const part = id => d.querySelector('#tray .part[data-id="' + id + '"]');
  const tag = el => { const t = el.querySelector(".tag"); return t ? t.textContent : ""; };
  const stateKey = () => E.stateKey(S().placements);
  const openingKey = () => E.stateKey(P().opening);

  /* ---- start screen ---- */
  ok(!$("start-btn").disabled, "Start should enable once components.json has loaded");
  ok($("loadmsg").classList.contains("hide"), "the loading message should go once data is in");
  ok(d.querySelector(".home-top .hub-link").getAttribute("href") === "../", "start screen needs ← All games → ../");
  ok($("title").textContent.replace(/\s/g, "") === "CircuitBuilder", "bouncy title: " + $("title").textContent);
  const cards = [...d.querySelectorAll(".diff")];
  ok(cards.length === 4, "four level cards");
  ok(cards.map(c => c.querySelector(".d-range").textContent).join("|") === "close the loop|add a switch|spot the break|own paths",
     "level hints: " + cards.map(c => c.querySelector(".d-range").textContent).join("|"));
  ok(cards.every(c => c.querySelector(".d-name").children.length === 0 && !/\n/.test(c.querySelector(".d-name").textContent)),
     "emoji and name on one line");

  $("start-btn").click();
  ok(!vis("screen-home") && vis("screen-game"), "Start should enter the game");
  ok(!d.querySelector("#screen-game .hub-link"), "← All games must not appear during play");
  ok($("q-level-label").textContent === "🌱 Easy", "starts on Easy");

  /* ---- building a solution through the UI ---- */
  function turnTo(q){
    for (let g = 0; g < 4 && cell(q.r, q.c).dataset.rot !== String(q.rot); g++){ cell(q.r, q.c).click(); cell(q.r, q.c).click(); }
    ok(cell(q.r, q.c).dataset.rot === String(q.rot), P().level + ": could not turn " + q.name + " into place");
  }
  function build(){
    for (const q of P().solution){
      const el = cell(q.r, q.c);
      if (el.dataset.id === q.id) { if (el.dataset.rot !== String(q.rot)) turnTo(q); continue; }
      const b = part(q.id);
      ok(!!b, P().level + ": the tray should hold a " + q.name);
      if (!b) return;
      b.click();
      ok(b.getAttribute("aria-pressed") === "true" || part(q.id).getAttribute("aria-pressed") === "true", "tapping a tray part holds it");
      el.click();
      ok(cell(q.r, q.c).dataset.id === q.id, P().level + ": tapping a square should place the held part");
      turnTo(q);
    }
  }
  function expectWin(label){
    ok(!vis("power-btn") && vis("next-btn"), label + ": Switch on ⚡ should give way to Next ▶");
    ok($("next-btn").closest(".serve-row") && $("power-btn").closest(".serve-row"), label + ": both live in the bottom slot");
    ok($("skip-btn").classList.contains("invisible") && !$("skip-btn").classList.contains("hide"),
       label + ": Skip hides with .invisible, keeping its box");
    ok(vis("result-view"), label + ": the result shows");
    ok($("owl-game").classList.contains("win"), label + ": the owl celebrates");
  }

  /* ---- a broken circuit: the round goes on, and it costs a star ---- */
  {
    const k0 = P().key;
    $("power-btn").click();
    ok(vis("power-btn") && !vis("next-btn") && !vis("result-view"), "a dark bulb keeps the round going");
    ok($("feedback").classList.contains("bad"), "a failed Switch on says so");
    ok($("owl-game").classList.contains("worried"), "the owl is worried on a circuit that doesn't light");
    ok(w.eval("fails") === 1, "one failed try counted");
    $("power-btn").click();
    ok(w.eval("fails") === 1, "pressing again on the same circuit isn't a second miss");
    ok(P().key === k0, "the puzzle stays the same after a miss");
    const bulb = [...$("bench").children].find(c => c.dataset.id === "bulb");
    if (bulb) ok(tag(bulb) === "off", "an unlit bulb is labelled off, not just grey");
    build();
    ok(!w.eval("powered"), "editing the bench switches the power back off");
    $("power-btn").click();
    expectWin("EASY after a miss");
    ok($("stars").textContent === "★★☆", "one miss → ★★, got " + $("stars").textContent);
    const lit = [...$("bench").children].find(c => c.dataset.id === P().solution.find(q => q.kind === "load").id && c.classList.contains("lit"));
    ok(!!lit && tag(lit) === "lit" && !!lit.querySelector(".rays"), "a lit bulb has rays and a 'lit' label");
  }

  /* ---- Next: a fresh puzzle, first try, three stars ---- */
  {
    const k0 = P().key;
    $("next-btn").click();
    ok(P().key !== k0, "Next deals a different puzzle");
    ok(vis("power-btn") && !vis("next-btn") && !$("skip-btn").classList.contains("invisible"), "Next restores the play state");
    ok(!w.eval("won") && w.eval("fails") === 0 && w.eval("hints") === 0, "a new round starts clean");
    build();
    $("power-btn").click();
    expectWin("EASY first try");
    ok($("stars").textContent === "★★★", "first try, no hints → ★★★, got " + $("stars").textContent);
    $("next-btn").click();
  }

  /* ---- Reset, pick up / turn / swap, Hint, tray return ---- */
  {
    const q = P().solution.find(x => cell(x.r, x.c).dataset.id === "");
    part(q.id).click(); cell(q.r, q.c).click();
    ok(stateKey() !== openingKey(), "placing a part changes the bench");
    const rot = cell(q.r, q.c).dataset.rot;
    cell(q.r, q.c).click();
    ok(w.eval("held") && w.eval("held").src === "grid", "tapping a placed part picks it up");
    ok(cell(q.r, q.c).classList.contains("ghost"), "a picked-up part shows as a ghost in its square");
    cell(q.r, q.c).click();
    ok(cell(q.r, q.c).dataset.rot === String((+rot + 1) % E.SHAPES[q.shape].turns), "tapping its own square turns it");
    cell(q.r, q.c).click();
    const n0 = S().tray.find(t => t.id === q.id).n;
    $("tray").children[0].click();
    ok(S().tray.find(t => t.id === q.id).n === n0 + 1 && cell(q.r, q.c).dataset.id === "", "tapping the tray puts it back");

    const locked = S().placements.find(p => p.locked);
    locked && cell(locked.r, locked.c).click();
    ok(!w.eval("held"), "a fixed part can't be picked up");

    part(q.id).click(); cell(q.r, q.c).click();
    $("reset-btn").click();
    ok(stateKey() === openingKey(), "Reset restores the exact opening placements");
    ok(JSON.stringify(S().tray) === JSON.stringify(P().tray), "Reset restores the tray");

    $("hint-link").click();
    ok($("feedback").classList.contains("hint") && $("feedback").textContent.length > 10, "Hint says something");
    ok(w.eval("hints") === 1, "hints are counted");
    ok(!/row|column/i.test($("feedback").textContent), "a hint names the kind of problem, never a square");
    build(); $("power-btn").click();
    ok($("stars").textContent === "★★☆", "one hint → ★★, got " + $("stars").textContent);
    $("next-btn").click();
  }

  /* ---- Skip never repeats ---- */
  for (let i = 0; i < 20; i++){
    const k0 = P().key;
    $("skip-btn").click();
    ok(P().key !== k0, "Skip must deal a different puzzle");
  }

  /* ---- the level chip is a working switcher ---- */
  function switchTo(key, label){
    $("q-level").click();
    ok($("level-menu").classList.contains("open"), "the level chip opens its menu");
    d.querySelector('.level-opt[data-diff="' + key + '"]').click();
    ok(!$("level-menu").classList.contains("open"), "picking a level closes the menu");
    ok(vis("screen-game") && P().level === key, "switching level stays in the game with a " + key + " puzzle");
    ok($("q-level-label").textContent === label, "chip reads " + label);
    ok(stateKey() === openingKey() && !w.eval("won"), key + ": a fresh puzzle at its opening state");
  }

  /* MEDIUM: the switch comes from the tray open, still passes, and flips live after the win */
  switchTo("MEDIUM", "⭐ Medium");
  for (let round = 0; round < 3; round++){
    build();
    const sw = S().placements.find(p => p.kind === "switch");
    ok(sw && !sw.closed, "MEDIUM: a switch from the tray starts open");
    $("power-btn").click();
    expectWin("MEDIUM");
    const swCell = cell(sw.r, sw.c), bulb = S().placements.find(p => p.kind === "load");
    ok(tag(swCell) === "closed" && tag(cell(bulb.r, bulb.c)) === "lit", "MEDIUM: the win closes the switch and lights the bulb");
    swCell.click();
    ok(tag(swCell) === "open" && tag(cell(bulb.r, bulb.c)) === "off", "MEDIUM: tapping the switch after the win turns the bulb off, live");
    swCell.click();
    ok(tag(cell(bulb.r, bulb.c)) === "lit", "…and back on");
    $("next-btn").click();
  }
  {
    build();
    const sw = S().placements.find(p => p.kind === "switch");
    cell(sw.r, sw.c).click();
    ok(!w.eval("held") && S().placements.includes(sw) && sw.closed, "tapping a switch flips it rather than picking it up");
    ok(tag(cell(sw.r, sw.c)) === "closed", "the switch says closed/open in words");
    $("power-btn").click();
    expectWin("MEDIUM with the switch closed first");
    $("next-btn").click();
  }

  /* HARD: every kind of fault, fixed by hand */
  switchTo("HARD", "🔥 Hard");
  const seen = new Set();
  for (let g = 0; g < 200 && seen.size < E.FAULTS.length; g++){
    const f = P().fault;
    if (seen.has(f.type)) { $("skip-btn").click(); continue; }
    seen.add(f.type);
    $("power-btn").click();
    ok(vis("power-btn") && $("feedback").classList.contains("bad"), "HARD " + f.type + ": the circuit starts broken");
    if (f.type === "oneEnd") ok(/slow the current/.test($("feedback").textContent), "the short is explained gently");
    const q = P().solution.find(x => x.uid === f.uid), el = () => cell(q.r, q.c);
    if (f.type === "insulator"){
      const insId = P().opening.find(x => x.uid === f.uid).id;
      part(q.id).click(); el().click();
      ok(el().dataset.id === q.id && !!part(insId), "holding a part and tapping another swaps them; the " + f.name + " goes to the tray");
      turnTo(q);
    }
    else if (f.type === "gap") turnTo(q);
    else if (f.type === "switch") el().click();
    else { el().click(); el().click(); ok(el().dataset.rot === String(q.rot), "rewiring a bulb keeps it facing the same way"); }
    if (vis("power-btn")) $("power-btn").click();
    expectWin("HARD " + f.type);
    ok($("rlabel").textContent.startsWith("🔧 Fixed!"), "HARD " + f.type + ": the result explains the fault");
    $("next-btn").click();
  }
  ok(seen.size === E.FAULTS.length, "met every HARD fault: " + [...seen].join(","));

  /* EXPERT: every task, built by hand; then pull each part out, and flip each switch */
  switchTo("EXPERT", "🏆 Expert");
  const tasksSeen = new Set();
  const isOn = el => el.classList.contains("lit");
  for (let g = 0; g < 200 && tasksSeen.size < E.TASKS.length; g++){
    const t = P().task;
    if (tasksSeen.has(t.kind)) { $("skip-btn").click(); continue; }
    tasksSeen.add(t.kind);
    ok(t.loads.every(id => $("task").textContent.toLowerCase().includes(DATA.components.find(c => c.id === id).name.toLowerCase())),
       "EXPERT " + t.kind + ": the task line names its parts: " + $("task").textContent);
    const need = P().solution.filter(q => !P().opening.some(o => o.r === q.r && o.c === q.c)).length;
    ok(S().tray.reduce((n, x) => n + x.n, 0) >= need + 3, "EXPERT " + t.kind + ": the tray has spare parts");
    build();
    $("power-btn").click();
    expectWin("EXPERT " + t.kind);
    const loads = S().placements.filter(p => p.kind === "load");
    ok(loads.every(l => isOn(cell(l.r, l.c)) && tag(cell(l.r, l.c)) === l.says[0]),
       "EXPERT " + t.kind + ": every part works at full, labelled in its own words");
    for (const l of loads){
      cell(l.r, l.c).click();
      ok(tag(cell(l.r, l.c)) === "out" && loads.filter(o => o !== l).every(o => isOn(cell(o.r, o.c))),
         "EXPERT " + t.kind + ": pulling out the " + l.name + " leaves the rest working");
      ok($("feedback").classList.contains("good"), "EXPERT: the pull is celebrated");
      cell(l.r, l.c).click();
      ok(isOn(cell(l.r, l.c)), "EXPERT: tapping again puts it back");
    }
    const sws = S().placements.filter(p => p.kind === "switch");
    ok(sws.every(sw => sw.closed), "EXPERT " + t.kind + ": the win closes the switches");
    for (const sw of sws){
      cell(sw.r, sw.c).click();
      const dark = loads.filter(l => !isOn(cell(l.r, l.c))).length;
      ok(t.kind === "master" ? dark === loads.length : dark === 1,
         "EXPERT " + t.kind + ": opening a switch turns off " + (t.kind === "master" ? "everything" : "just its own part") + " (" + dark + " off)");
      cell(sw.r, sw.c).click();
    }
    $("next-btn").click();
  }
  ok(tasksSeen.size === E.TASKS.length, "met every EXPERT task: " + [...tasksSeen].join(","));

  /* ---- keyboard: arrows walk the bench and the tray; the rules sheet owns keys while open ---- */
  cell(0, 0).focus();
  const press = k => d.activeElement.dispatchEvent(new w.KeyboardEvent("keydown", { key:k, bubbles:true }));
  press("ArrowRight");
  ok(d.activeElement === cell(0, 1), "ArrowRight moves one square right");
  press("ArrowLeft"); press("ArrowLeft");
  ok(d.activeElement === cell(0, 0), "ArrowLeft stops at the edge");
  for (let i = 0; i < P().rows; i++) press("ArrowDown");
  ok(d.activeElement.closest("#tray"), "ArrowDown off the bottom row reaches the tray");
  press("ArrowUp");
  ok(d.activeElement.closest("#bench"), "ArrowUp from the tray returns to the bench");
  ok(cell(P().rows - 1, 0).tabIndex === 0 || d.activeElement.tabIndex === 0, "the focused square is the one in the tab order");
  $("rules-btn").click();
  const before = d.activeElement;
  d.dispatchEvent(new w.KeyboardEvent("keydown", { key:"ArrowRight", bubbles:true }));
  ok(d.activeElement === before, "play keys do nothing while the rules sheet is up");
  $("rules-ok").click();

  /* ---- Escape closes the menu and drops what you're holding; Home goes to the start ---- */
  const q = P().solution.find(x => cell(x.r, x.c).dataset.id === "");
  part(q.id).click();
  d.dispatchEvent(new w.KeyboardEvent("keydown", { key:"Escape", bubbles:true }));
  ok(!w.eval("held"), "Escape puts the held part down");
  $("home-btn").click();
  ok(vis("screen-home") && !vis("screen-game"), "Home returns to the start screen");

  report("circuit-builder play-through");
})();
