"use strict";
/* Headless play-through: drives the real page the way a child would. It reads ONLY what the
   page shows (dug digits, flags, woken eggs), asks the engine's own solver what that proves,
   and taps accordingly — so a win here means the board is solvable through the UI with zero
   guesses. Then it checks the control scheme: Next / New dig in the bottom slot, Skip hiding
   with .invisible, Reset keeping the same eggs, mistakes at Easy vs Expert's three chances. */
const { bootGame, loadEngine, tally, sleep } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("dino-dig");

const { w, d, $ } = bootGame("dino-dig", { onError: e => ok(false, "page error: " + e.message) });
const cells = () => [...d.querySelectorAll("#grid .cell")];
const levelKey = () => ({ "🌱 Easy":"EASY", "⭐ Medium":"MEDIUM", "🔥 Hard":"HARD", "🏆 Expert":"EXPERT" })[$("q-level-label").textContent];
const cfg = () => E.LEVELS[levelKey()];
const mode = () => $("mode-btn").getAttribute("aria-pressed") === "true" ? "flag" : "dig";
const setMode = m => { if(mode() !== m) $("mode-btn").click(); };
const isOpen = c => c.classList.contains("open");
const isWoke = c => c.classList.contains("woke");
const isFlag = c => c.textContent === "🚩";
const eggsLeftText = () => $("eggs-left").textContent;

/* what the screen shows, as solver knowledge: dug digits, woken eggs */
function readState(){
  const cs = cells(), n = cs.length, st = new Int8Array(n), counts = new Int8Array(n);
  cs.forEach((c, i) => {
    if(isOpen(c)){ st[i] = 1; counts[i] = c.textContent ? +c.textContent : 0; }
    else if(isWoke(c)) st[i] = 2;
  });
  return { st, counts, n };
}
/* one proved step from the screen: returns {safe, eggs} */
function proof(){
  const { st, counts } = readState();
  /* flags are the player's opinion — never trusted, exactly like the game's own Hint */
  return E.deduce(cfg().size, cfg().eggs, st, counts);
}
/* solve to the end using only proofs; flags every proved egg via Flag mode */
function solve(opts = {}){
  for(let guard = 0; guard < 400; guard++){
    if(!$("next-btn").classList.contains("hide") || !$("newdig-btn").classList.contains("hide")) return true;
    const cs = cells(), p = proof();
    if(!p.rule) return false;
    let acted = false;
    for(const j of p.eggs) if(!isFlag(cs[j]) && !isWoke(cs[j])){ setMode("flag"); cs[j].click(); acted = true; }
    for(const j of p.safe) if(!isOpen(cs[j])){ setMode("dig"); cs[j].click(); acted = true; }
    if(!acted && !p.safe.length){
      /* eggs only, already flagged: feed them back the way provenSafe does */
      const { st, counts } = readState();
      p.eggs.forEach(j => { st[j] = 2; });
      const safe = E.provenSafe(cfg().size, cfg().eggs, st, counts).filter(j => !isOpen(cells()[j]));
      if(!safe.length) return false;
      setMode("dig"); cells()[safe[0]].click();
    }
    if(opts.onStep) opts.onStep();
  }
  return false;
}
/* keep digging proved-safe squares until at least `k` eggs are proved; returns their indices */
function proveEggs(k){
  for(let guard = 0; guard < 400; guard++){
    const { st, counts } = readState();
    const eggs = new Set();
    for(let g2 = 0; g2 < 200; g2++){
      const dd = E.deduce(cfg().size, cfg().eggs, st, counts);
      if(!dd.rule || dd.safe.length) break;
      dd.eggs.forEach(j => { st[j] = 2; eggs.add(j); });
    }
    const already = cells().map((c, i) => isWoke(c) ? -1 : i).filter(i => i >= 0 && eggs.has(i));
    if(already.length >= k) return already;
    const safe = E.provenSafe(cfg().size, cfg().eggs, readState().st, readState().counts)
      .filter(j => !isOpen(cells()[j]));
    if(!safe.length) return already;
    setMode("dig"); cells()[safe[0]].click();
  }
  return [];
}

(async () => {
/* ---------- start screen ---------- */
ok(!$("screen-home").classList.contains("hide"), "start screen should be visible");
ok(d.querySelector(".home-top .hub-link").getAttribute("href") === "../", "← All games link to ../ on the start screen");
ok(!$("screen-game").querySelector(".hub-link"), "no ← All games link during play");
ok($("title").textContent.replace(/\s/g, "") === "DinoDig", "bouncy title: " + $("title").textContent);
ok(d.querySelectorAll(".diff").length === 4, "four level cards");
ok(!/\b(mine|mines|bomb|explo)/i.test(d.body.textContent), "no mines/bombs/explosions in the page copy");
ok(!/\d+\+/.test($("screen-home").textContent), "the hub-only age label must never appear in the game");

$("start-btn").click();
ok(!$("screen-game").classList.contains("hide"), "Start shows the game");

/* ---------- fresh board: nothing buried yet, layout fixed ---------- */
ok(cells().length === 49, "Easy is 7×7");
ok($("grid").style.gridTemplateColumns === "repeat(7,1fr)", "the grid is sized from its container");
ok(eggsLeftText().includes("6") && eggsLeftText().includes("left"), "egg counter starts at 6: " + eggsLeftText());
ok($("hearts").classList.contains("invisible"), "hearts keep their box but are invisible below Expert");
ok(!$("mode-btn").classList.contains("hide") && $("next-btn").classList.contains("hide"), "mode toggle owns the bottom slot");
ok(d.querySelectorAll("#screen-game .btn:not(.hide)").length === 1, "the mode toggle is the ONLY visible .btn during play");
ok(mode() === "dig", "a round starts in Dig mode");
ok(d.getElementById("owl-game").classList.contains("think"), "owl thinks during play");

/* flag mode before the first dig does nothing */
setMode("flag"); cells()[24].click();
ok(cells().every(c => !c.textContent), "no flag before the first dig");
setMode("dig");

/* ---------- the first dig: safe, a zero, opens a patch ---------- */
cells()[24].click();
ok(isOpen(cells()[24]) && cells()[24].textContent === "", "the first dig is safe and reads 0");
ok(cells().filter(isOpen).length > 1, "the first dig opens a patch");
ok(cells().every(c => !isWoke(c)), "nothing woken by the first dig");

/* ---------- solve it with proofs only ---------- */
ok(solve(), "Easy board solved through the UI using proofs only");
ok(!$("next-btn").classList.contains("hide"), "Next ▶ appears on a win");
ok($("mode-btn").classList.contains("hide"), "Next replaces the mode toggle in place");
ok($("skip-btn").classList.contains("invisible"), "Skip hides with .invisible on a win");
ok($("stars").textContent === "★★★", "a clean solve is ★★★, got " + $("stars").textContent);
ok(d.getElementById("owl-game").classList.contains("win"), "owl wins");
ok(cells().filter(isFlag).length === 6, "every egg is flagged on a win (auto-flag)");
ok(eggsLeftText().includes("0"), "egg counter reaches 0: " + eggsLeftText());

/* ---------- Next: a fresh dig ---------- */
$("next-btn").click();
ok(cells().every(c => !isOpen(c) && !c.textContent), "Next gives a fresh, fully buried patch");
ok(!$("skip-btn").classList.contains("invisible") && !$("mode-btn").classList.contains("hide"), "Next restores Skip and the toggle");

/* ---------- a mistake at Easy: the round goes on ---------- */
cells()[0].click();                                   /* a corner first dig */
ok(isOpen(cells()[0]) && cells()[0].textContent === "", "corner first dig is safe and a 0");
const hintBefore = cells().filter(isOpen).length;
$("hint-link").click();
ok(cells().filter(isOpen).length > hintBefore, "Hint digs a proved-safe square");
ok(cells().every(c => !isWoke(c)), "a hint never wakes an egg");
const eggs1 = proveEggs(1);
ok(eggs1.length >= 1, "found a proved egg to dig on purpose");
setMode("dig"); cells()[eggs1[0]].click();
ok(isWoke(cells()[eggs1[0]]), "digging an egg wakes it (🐣)");
ok(cells()[eggs1[0]].textContent === "🐣", "a woken egg has its own glyph");
ok($("feedback").className.includes("bad"), "a soft 'oops' message");
ok(d.getElementById("owl-game").classList.contains("worried"), "owl worried on a woken egg");
ok(!$("mode-btn").classList.contains("hide") && $("newdig-btn").classList.contains("hide"), "Easy keeps playing after a mistake");
ok(eggsLeftText().includes("5"), "a woken egg counts as found: " + eggsLeftText());

/* ---------- Reset: same eggs, everything re-buried ---------- */
const seen = new Map();
cells().forEach((c, i) => { if(isOpen(c)) seen.set(i, c.textContent); });
const wokenAt = eggs1[0];
setMode("flag"); const someBuried = cells().findIndex(c => !isOpen(c) && !isWoke(c)); cells()[someBuried].click();
$("reset-btn").click();
ok(cells().every(c => !isOpen(c) && !isWoke(c) && (c.textContent === "" || c.textContent === "📍")), "Reset re-buries every square and lifts flags");
const start = cells().findIndex(c => c.textContent === "📍");
ok(start === 0, "Reset marks the original first dig with 📍 (got " + start + ")");
ok(eggsLeftText().includes("6"), "Reset clears the mistake from the counter: " + eggsLeftText());
setMode("dig"); cells()[start].click();
ok(solve(), "the reset board solves again");
let same = true;
cells().forEach((c, i) => { if(seen.has(i) && isOpen(c) && c.textContent !== seen.get(i)) same = false; });
ok(same, "after Reset every number reads the same — the eggs never moved");
ok(isFlag(cells()[wokenAt]), "the egg woken before Reset is still an egg afterwards");
ok($("stars").textContent === "★★☆", "one hint, no mistakes after Reset = ★★, got " + $("stars").textContent);

/* ---------- chording through the UI ---------- */
$("next-btn").click();
cells()[24].click();
{
  let chorded = false;
  for(let guard = 0; guard < 60 && !chorded; guard++){
    const p = proof();
    const cs = cells();
    p.eggs.forEach(j => { if(!isFlag(cs[j])){ setMode("flag"); cs[j].click(); } });
    /* a dug number whose flags now match, with buried neighbours left */
    const size = 7, nb = E.neighbours(size);
    const i = cs.findIndex((c, k) => isOpen(c) && c.textContent &&
      nb[k].filter(j => isFlag(cs[j])).length === +c.textContent &&
      nb[k].some(j => !isOpen(cs[j]) && !isFlag(cs[j])));
    if(i >= 0){
      const expect = nb[i].filter(j => !isOpen(cs[j]) && !isFlag(cs[j]));
      setMode("dig"); cs[i].click();
      ok(expect.every(j => isOpen(cells()[j])), "tapping a finished number digs all its unflagged neighbours");
      ok(cells().every(c => !isWoke(c)), "a correct chord wakes nothing");
      chorded = true;
    } else if(p.safe.length){ setMode("dig"); cs[p.safe.find(j => !isOpen(cs[j])) ?? p.safe[0]].click(); }
    else break;
  }
  ok(chorded, "found a chance to chord during play");
  /* a number without matching flags does nothing */
  const cs = cells(), nb = E.neighbours(7);
  const k = cs.findIndex((c, q) => isOpen(c) && c.textContent && nb[q].filter(j => isFlag(cs[j])).length < +c.textContent);
  if(k >= 0){ const before = cs.filter(isOpen).length; cs[k].click(); ok(cells().filter(isOpen).length === before, "an unfinished number does not chord"); }
}

/* ---------- right-click and long-press flag ---------- */
$("skip-btn").click();
ok(cells().every(c => !isOpen(c)), "Skip resets to a fresh dig");
cells()[24].click();
{
  const b = cells().findIndex(c => !isOpen(c));
  const ev = new w.MouseEvent("contextmenu", { bubbles:true, cancelable:true });
  cells()[b].dispatchEvent(ev);
  ok(ev.defaultPrevented, "right-click's menu is suppressed");
  ok(isFlag(cells()[b]), "right-click flags");
  cells()[b].dispatchEvent(new w.MouseEvent("contextmenu", { bubbles:true, cancelable:true }));
  ok(!isFlag(cells()[b]), "right-click again lifts the flag");
  /* long-press, while in Dig mode: flags, and the click that follows does NOT dig */
  setMode("dig");
  cells()[b].dispatchEvent(new w.MouseEvent("pointerdown", { bubbles:true, button:0, clientX:5, clientY:5 }));
  await sleep(520);
  cells()[b].dispatchEvent(new w.MouseEvent("pointerup", { bubbles:true }));
  cells()[b].click();
  ok(isFlag(cells()[b]) && !isOpen(cells()[b]), "long-press flags, and its trailing click does not dig");
}

/* ---------- keyboard ---------- */
{
  const cs = cells(), start = cs.findIndex(c => c.tabIndex === 0);
  cs[start].focus();
  cs[start].dispatchEvent(new w.KeyboardEvent("keydown", { key:"ArrowRight", bubbles:true }));
  const now = cells().findIndex(c => c.tabIndex === 0);
  ok(now === start + 1 || (start % 7 === 6 && now === start), "ArrowRight moves the focus ring");
  ok(d.activeElement === cells()[now], "the focused square really has focus");
  setMode("dig");
  cells()[now].dispatchEvent(new w.KeyboardEvent("keydown", { key:"f", bubbles:true }));
  ok(isFlag(cells()[now]) || isOpen(cells()[now]), "F flags the focused square");
  if(isFlag(cells()[now])){
    cells()[now].dispatchEvent(new w.KeyboardEvent("keydown", { key:" ", bubbles:true }));
    ok(!isFlag(cells()[now]), "Space toggles the flag back off");
  }
}

/* ---------- level switcher: stays in the game ---------- */
ok(d.querySelectorAll("#level-menu .level-opt").length === 4, "the chip lists all four levels");
$("q-level").click();
ok($("level-menu").classList.contains("open"), "the chip opens its menu");
d.querySelector('#level-menu .level-opt[data-diff="EXPERT"]').click();
ok(!$("level-menu").classList.contains("open"), "picking a level closes the menu");
ok(!$("screen-game").classList.contains("hide"), "switching level stays in the game");
ok(levelKey() === "EXPERT" && cells().length === 100, "Expert is 10×10");
ok(!$("hearts").classList.contains("invisible"), "Expert shows its three chances");
ok($("hearts").querySelectorAll(".pip:not(.used)").length === 3, "three whole eggs to start");

/* ---------- Expert: three woken eggs end the dig ---------- */
cells()[55].click();
ok(isOpen(cells()[55]) && cells()[55].textContent === "", "Expert's first dig is safe too");
for(let k = 1; k <= 3; k++){
  const eg = proveEggs(1);
  ok(eg.length >= 1, "Expert: found a proved egg #" + k);
  setMode("dig"); cells()[eg[0]].click();
  ok($("hearts").querySelectorAll(".pip.used").length === k, "a chance cracks with each woken egg (" + k + ")");
  if(k < 3) ok(!$("mode-btn").classList.contains("hide"), "the dig goes on after " + k + " woken");
}
ok(!$("newdig-btn").classList.contains("hide"), "New dig ▶ appears after the third");
ok($("mode-btn").classList.contains("hide") && $("next-btn").classList.contains("hide"), "New dig takes the toggle's slot");
ok($("skip-btn").classList.contains("invisible"), "Skip hides with .invisible on a lost dig");
ok(d.getElementById("owl-game").classList.contains("worried"), "owl worried on a lost dig");
ok(/could be found by thinking/.test($("rsub").textContent), "the kind message says the board was solvable");
{
  const shown = cells().filter(c => c.textContent === "🥚" || isWoke(c) || (isFlag(c))).length;
  ok(shown >= 22 && cells().filter(c => c.textContent === "🥚" || isWoke(c)).length + cells().filter(isFlag).length >= 22,
     "every egg is revealed when the dig ends");
}
const before = cells().map(c => c.className + c.textContent).join();
cells()[0].click();
ok(cells().map(c => c.className + c.textContent).join() === before, "the board is frozen after the dig ends");
$("newdig-btn").click();
ok(cells().every(c => !isOpen(c)) && !$("mode-btn").classList.contains("hide"), "New dig starts a fresh round");
ok($("hearts").querySelectorAll(".pip.used").length === 0, "chances refill on a new dig");

/* ---------- Home ---------- */
$("home-btn").click();
ok(!$("screen-home").classList.contains("hide"), "Home returns to the start screen");

report("dino-dig play-through");
})();
