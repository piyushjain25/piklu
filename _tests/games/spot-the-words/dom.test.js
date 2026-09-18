"use strict";
/* Headless play-through of Spot the Words: boots the real page with the real words.json,
   then finds every word through all three input paths — drag, tap-tap and keyboard — and
   checks the win lands in the right places, a wrong line is rejected, Reset/Hint/Skip/Next
   behave, and the theme chip switches theme without leaving the game. */
const { read, bootGame, loadEngine, tally, sleep } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("spot-the-words");
const DATA = JSON.parse(read("games/spot-the-words/words.json"));

(async () => {
  const { w, d, $ } = bootGame("spot-the-words", {
    data: { "words.json": DATA },
    onError: e => ok(false, "page error: " + e.message),
  });
  for (let i = 0; i < 50 && $("start-btn").disabled; i++) await sleep(10);

  /* ---- start screen = theme picker ---- */
  ok(!$("start-btn").disabled, "Start should enable once words.json has loaded");
  ok(!$("screen-home").classList.contains("hide"), "start screen should be visible");
  ok(d.querySelector(".home-top .hub-link").getAttribute("href") === "../", "start screen needs ← All games → ../");
  ok($("title").textContent.replace(/\s/g, "") === "SpottheWords", "bouncy title: " + $("title").textContent);
  const cards = [...d.querySelectorAll(".tcard")];
  ok(cards.length === 14, "fourteen theme cards, got " + cards.length);
  ok(cards.map(c => c.querySelector(".t-name").textContent).join("|") === DATA.themes.map(t => t.name).join("|"),
     "theme cards should follow words.json order");
  ok(d.querySelectorAll(".diff").length === 0, "no difficulty cards — the theme is the difficulty");
  ok($("loadmsg").classList.contains("hide"), "the loading message should go once data is in");

  const ocean = cards.findIndex(c => c.textContent.includes("Ocean"));
  cards[ocean].click();
  ok(cards[ocean].getAttribute("aria-pressed") === "true", "picking a theme card should press it");
  ok(cards.filter(c => c.getAttribute("aria-pressed") === "true").length === 1, "only one theme pressed");
  $("start-btn").click();
  ok($("screen-home").classList.contains("hide") && !$("screen-game").classList.contains("hide"), "Start should enter the game");
  ok(!d.querySelector("#screen-game .hub-link"), "← All games must not appear during play");
  ok($("q-level-label").textContent === "🐠 Ocean", "theme chip should read 🐠 Ocean, got " + $("q-level-label").textContent);

  /* ---- reading the board straight off the DOM ---- */
  const cellsEl = () => [...$("wgrid").children];
  const size = () => Math.round(Math.sqrt(cellsEl().length));
  const letters = () => cellsEl().map(c => c.textContent);
  const chips = () => [...d.querySelectorAll(".wchip")];
  const targets = () => chips().map(c => c.textContent);
  const cell = (r, c) => $("wgrid").children[r * size() + c];
  /* every target located on the RENDERED grid, and it must be there exactly once */
  function locate(word) {
    const N = size(), g = letters(), hits = E.occurrences(g, N, word);
    ok(hits.length === 1, word + " should appear exactly once on the rendered board, found " + hits.length);
    return hits[0];
  }
  const foundCount = () => chips().filter(c => c.classList.contains("found")).length;
  const lineCount = () => $("lines").querySelectorAll("line:not(.sel)").length;

  const ptr = (type, el) => el.dispatchEvent(new w.MouseEvent(type, { bubbles: true, cancelable: true, button: 0 }));
  function drag(a, b) {
    ptr("pointerdown", cell(a.r, a.c));
    /* a wobbly path: step through a neighbour that is NOT on the line first */
    const wob = { r: Math.min(size() - 1, a.r + 1), c: Math.min(size() - 1, a.c + 2) };
    ptr("pointermove", cell(wob.r, wob.c));
    ptr("pointermove", cell(b.r, b.c));
    ptr("pointerup", cell(b.r, b.c));
  }
  function tap(p) { ptr("pointerdown", cell(p.r, p.c)); ptr("pointerup", cell(p.r, p.c)); }
  const key = (k, el) => (el || d.activeElement || d.body).dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  function keyboardSelect(a, b) {
    let cur = cellsEl().findIndex(c => c.tabIndex === 0);
    ok(cur >= 0, "one cell should hold the roving tabindex");
    cellsEl()[cur].focus();
    const N = size();
    const walk = to => {
      let r = (cur / N) | 0, c = cur % N;
      while (r < to.r) { key("ArrowDown"); r++; }  while (r > to.r) { key("ArrowUp"); r--; }
      while (c < to.c) { key("ArrowRight"); c++; } while (c > to.c) { key("ArrowLeft"); c--; }
      cur = r * N + c;
    };
    walk(a);
    ok(d.activeElement === cell(a.r, a.c), "arrows should move focus to the anchor cell");
    key("Enter");
    ok(cell(a.r, a.c).classList.contains("anchor"), "Enter should anchor the focused cell");
    walk(b);
    key("Enter");
  }

  ok(targets().length === 6, "Ocean (9×9) hides 6 words, got " + targets().length);
  ok(size() === 9, "Ocean grid should be 9×9");
  ok($("board-wrap").style.getPropertyValue("--n") === "9", "grid columns come from --n");
  ok(/\.board-wrap\{[^}]*touch-action:none/.test(read("games/spot-the-words/index.html")),
     "the board needs touch-action:none so a drag doesn't scroll the page");
  ok($("next-btn").classList.contains("invisible") && !$("next-btn").classList.contains("hide"),
     "the bottom slot holds an invisible Next (keeps its box) during play");
  ok(!$("skip-btn").classList.contains("invisible"), "Skip visible during play");
  ok([...d.querySelectorAll("#screen-game .btn")].every(b => b.classList.contains("invisible")),
     "no visible real .btn during play — there is no submit action");
  for (const id of ["reset-btn", "hint-link"]) {
    ok($(id).classList.contains("tlink") && $(id).closest(".actions"), id + " should be a .tlink in the .actions row");
  }
  ok(!$("undo-btn"), "no Undo in this game");
  ok($("reset-btn").nextElementSibling === $("hint-link"), "Reset and Hint sit side by side");

  /* ---- a wrong line is rejected ---- */
  {
    const N = size(), g = letters(), ws = targets();
    let bad = null;
    for (let r = 0; r < N && !bad; r++) for (let c = 0; c + 2 < N && !bad; c++) {
      const s = g[r * N + c] + g[r * N + c + 1] + g[r * N + c + 2];
      if (!ws.some(x => x === s || x === [...s].reverse().join(""))) bad = { a: { r, c }, b: { r, c: c + 2 } };
    }
    ok(!!bad, "should find a 3-letter line that is not a target");
    drag(bad.a, bad.b);
    ok(foundCount() === 0, "a wrong line must not find anything");
    ok($("feedback").className.includes("bad"), "a wrong line should say so");
    ok(lineCount() === 0, "a wrong line leaves no highlight behind");
  }

  /* ---- find every word, one input path each, then the rest by drag ---- */
  const words = targets();
  const at = words.map(locate);
  ok($("result-view").classList.contains("hide"), "no result before the win");

  drag({ r: at[0].r0, c: at[0].c0 }, { r: at[0].r1, c: at[0].c1 });
  ok(chips()[0].classList.contains("found"), "drag should find " + words[0]);
  ok(foundCount() === 1 && lineCount() === 1, "one word found, one line drawn");
  ok(chips()[0].getAttribute("aria-label").includes("found"), "found chip announces it");
  ok($("feedback").className.includes("good"), "a find should celebrate");
  ok($("found-count").textContent.startsWith("1 of 6"), "counter: " + $("found-count").textContent);

  /* the same word again is not a second find */
  drag({ r: at[0].r1, c: at[0].c1 }, { r: at[0].r0, c: at[0].c0 });
  ok(foundCount() === 1 && lineCount() === 1, "re-selecting a found word changes nothing");
  ok($("feedback").textContent.includes("already"), "re-selecting says it's already found");

  /* tap-tap, drawn from the LAST letter back to the first */
  tap({ r: at[1].r1, c: at[1].c1 });
  ok(cell(at[1].r1, at[1].c1).classList.contains("anchor"), "first tap should ring the letter");
  tap({ r: at[1].r0, c: at[1].c0 });
  ok(chips()[1].classList.contains("found"), "tap-tap (end → start) should find " + words[1]);
  ok(!d.querySelector(".wcell.anchor"), "the anchor ring clears after the second tap");
  /* tapping the same letter twice cancels */
  tap({ r: 0, c: 0 }); tap({ r: 0, c: 0 });
  ok(!d.querySelector(".wcell.anchor"), "tapping the ringed letter again cancels");

  /* keyboard */
  keyboardSelect({ r: at[2].r0, c: at[2].c0 }, { r: at[2].r1, c: at[2].c1 });
  ok(chips()[2].classList.contains("found"), "keyboard (arrows + Enter) should find " + words[2]);
  /* Escape lets go of a keyboard anchor */
  key("Enter"); ok(!!d.querySelector(".wcell.anchor"), "Enter anchors");
  key("Escape"); ok(!d.querySelector(".wcell.anchor"), "Escape cancels the anchor");

  /* ---- Reset un-finds everything on the SAME grid ---- */
  const gridBefore = letters().join("");
  $("reset-btn").click();
  ok(foundCount() === 0 && lineCount() === 0, "Reset should un-find every word");
  ok(letters().join("") === gridBefore && targets().join() === words.join(), "Reset keeps the same grid and words");

  /* ---- Hint pulses the first letter of an unfound word ---- */
  $("hint-link").click();
  const hinted = [...d.querySelectorAll(".wcell.hint")];
  ok(hinted.length === 1, "one hinted cell, got " + hinted.length);
  if (hinted.length) {
    const r = +hinted[0].dataset.r, c = +hinted[0].dataset.c;
    ok(at.some(p => p.r0 === r && p.c0 === c), "the hint marks the first letter of a target word");
  }
  ok(!$("feedback").textContent.match(new RegExp(words.join("|"))), "the hint does not name the word");

  /* ---- win ---- */
  at.forEach((p, i) => {
    ok(!$("skip-btn").classList.contains("invisible"), "Skip stays visible until the win");
    drag({ r: p.r0, c: p.c0 }, { r: p.r1, c: p.c1 });
    ok(chips()[i].classList.contains("found"), "drag should find " + words[i]);
  });
  ok(foundCount() === 6 && lineCount() === 6, "all six found, six lines");
  ok(!$("result-view").classList.contains("hide"), "the result shows on the win");
  ok($("result-view").nextElementSibling.classList.contains("serve-row"), "the result sits just above the bottom slot");
  ok(!$("next-btn").classList.contains("invisible"), "Next ▶ appears in the bottom slot");
  ok($("next-btn").classList.contains("btn") && $("next-btn").closest(".serve-row"), "Next is a real .btn in the bottom slot");
  ok($("skip-btn").classList.contains("invisible") && !$("skip-btn").classList.contains("hide"),
     "Skip hides with .invisible (keeps its box), never display:none");
  ok($("stars").textContent === "★★☆", "one hint → ★★, got " + $("stars").textContent);
  ok(d.getElementById("owl-game").classList.contains("win"), "owl celebrates the win");

  /* ---- Next: fresh puzzle, different word set, back to play ---- */
  $("next-btn").click();
  ok(targets().join() !== words.join(), "Next should bring a different word set");
  ok(foundCount() === 0 && $("result-view").classList.contains("hide"), "Next restores the play state");
  ok($("next-btn").classList.contains("invisible") && !$("skip-btn").classList.contains("invisible"), "Next hides, Skip returns");

  /* no-hint win earns three stars */
  targets().map(locate).forEach(p => drag({ r: p.r0, c: p.c0 }, { r: p.r1, c: p.c1 }));
  ok($("stars").textContent === "★★★", "no hints → ★★★, got " + $("stars").textContent);
  $("next-btn").click();

  /* ---- Skip: different word set, same theme ---- */
  for (let i = 0; i < 20; i++) {
    const before = targets().join();
    $("skip-btn").click();
    ok(targets().join() !== before, "Skip should change the word set");
    ok($("q-level-label").textContent === "🐠 Ocean", "Skip stays in the theme");
  }

  /* ---- the theme chip switches theme while staying in the game ---- */
  $("q-level").click();
  ok($("level-menu").classList.contains("open"), "tapping the chip opens the theme menu");
  const opts = [...d.querySelectorAll("#level-menu .level-opt")];
  ok(opts.length === 14, "the menu lists all fourteen themes, got " + opts.length);
  ok(opts.filter(o => o.getAttribute("aria-current") === "true").length === 1
     && opts[ocean].getAttribute("aria-current") === "true", "the current theme is marked");
  const style = read("games/spot-the-words/index.html");
  ok(/#level-menu\{[^}]*max-height[^}]*overflow-y:auto/.test(style), "the menu needs max-height + overflow-y:auto");
  const space = opts.findIndex(o => o.textContent.includes("Space"));
  opts[space].click();
  ok(!$("level-menu").classList.contains("open"), "picking a theme closes the menu");
  ok(!$("screen-game").classList.contains("hide"), "switching theme stays in the game");
  ok($("q-level-label").textContent === "🚀 Space", "chip reads 🚀 Space");
  ok(size() === 10 && targets().length === 6, "Space is a 10×10 grid with 6 words");
  targets().forEach(t => ok(DATA.themes[space].words.includes(t), t + " should be a Space word"));
  /* Escape and an outside click both close it */
  $("q-level").click(); key("Escape", d.body);
  ok(!$("level-menu").classList.contains("open"), "Escape closes the theme menu");
  $("q-level").click(); d.body.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  ok(!$("level-menu").classList.contains("open"), "an outside click closes the theme menu");

  /* the diagonal themes play through too, and the 11×11 ones render */
  const months = opts.findIndex(o => o.textContent.includes("Months"));
  $("q-level").click(); opts[months].click();
  ok(size() === 11 && targets().length === 7, "Months is 11×11 with 7 words");
  targets().map(locate).forEach(p => drag({ r: p.r1, c: p.c1 }, { r: p.r0, c: p.c0 }));
  ok(foundCount() === 7 && !$("next-btn").classList.contains("invisible"), "Months is winnable, drawn end → start");

  const days = opts.findIndex(o => o.textContent.includes("Days"));
  $("q-level").click(); opts[days].click();
  ok(targets().length === 7, "Days of the Week uses all seven days");
  const g1 = letters().join("");
  $("skip-btn").click();
  ok(letters().join("") !== g1, "Skip on Days (no spare words) still brings a different grid");

  /* basic themes ignore diagonal taps: a diagonal second tap just moves the anchor */
  const nums = opts.findIndex(o => o.textContent.includes("Number Words"));
  $("q-level").click(); opts[nums].click();
  tap({ r: 0, c: 0 }); tap({ r: 2, c: 2 });
  ok(cell(2, 2).classList.contains("anchor") && !cell(0, 0).classList.contains("anchor"),
     "on an across-and-down theme a diagonal second tap re-anchors instead of checking");
  key("Escape", d.body);

  /* ---- Home returns to the picker ---- */
  $("home-btn").click();
  ok(!$("screen-home").classList.contains("hide") && $("screen-game").classList.contains("hide"), "Home returns to the theme picker");
  ok(cards[nums].getAttribute("aria-pressed") === "true", "the picker remembers the theme last played");

  report("spot-the-words dom");
})();
