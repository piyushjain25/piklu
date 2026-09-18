"use strict";
/* Headless play-through of Mirror Draw: reads the picture off the page, works out the
   reflection with the engine's own mapping, and draws it through the UI. Checks the win path
   (Check ✓ -> Next ▶ in place, Skip hidden with .invisible), a wrong drawing (counted, never
   located), the given side ignoring taps, Hint, Reset, the fold, and the level switcher. */
const { bootGame, loadEngine, tally, sleep } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("mirror-draw");

async function run(reducedMotion){
  const { w, d, $ } = bootGame("mirror-draw", { reducedMotion, onError: e => ok(false, "page error: " + e.message) });
  const cells = () => [...d.querySelectorAll("#grid .mc")];
  const size = () => Math.round(Math.sqrt(cells().length));
  const levelKey = () => ({ "🌱 Easy":"EASY", "⭐ Medium":"MEDIUM", "🔥 Hard":"HARD", "🏆 Expert":"EXPERT" })[$("q-level-label").textContent];
  /* which mirror is this? the one whose given side matches the tinted squares */
  function puzzle(){
    const cs = cells(), N = size(), given = cs.map(c => c.classList.contains("given"));
    for(const ax of E.LEVELS[levelKey()].axes) for(const side of E.LEVELS[levelKey()].sides)
      if(given.every((g, i) => g === E.inGiven(ax, side, N, i))){
        const pattern = cs.map((c, i) => given[i] && c.classList.contains("on") ? i : -1).filter(i => i >= 0);
        return { ax, side, N, pattern, answer:E.answerOf(ax, side, N, pattern) };
      }
    return null;
  }
  const filledNow = () => cells().map((c, i) => !c.classList.contains("given") && c.classList.contains("on") ? i : -1).filter(i => i >= 0);
  const tap = i => {
    const c = cells()[i];
    c.dispatchEvent(new w.MouseEvent("pointerdown", { bubbles:true, cancelable:true, button:0 }));
    w.dispatchEvent(new w.MouseEvent("pointerup", { bubbles:true }));
    c.click();                                      /* the trailing click must not double-toggle */
  };
  const draw = set => { for(const i of filledNow()) if(!set.includes(i)) tap(i); for(const i of set) if(!filledNow().includes(i)) tap(i); };
  const waitWin = async () => { for(let k = 0; k < 80 && $("next-btn").classList.contains("hide"); k++) await sleep(60); };
  const tag = reducedMotion ? " [reduced motion]" : " [with fold]";

  ok(d.querySelector(".home-top .hub-link").getAttribute("href") === "../", "← All games on the start screen");
  $("start-btn").click();
  ok(!$("screen-game").classList.contains("hide"), "Start shows the game");
  ok(!$("screen-game").querySelector(".hub-link"), "no ← All games during play");

  for(const L of ["EASY", "MEDIUM", "HARD", "EXPERT"]){
    if(levelKey() !== L){
      $("q-level").click();
      d.querySelector('#level-menu .level-opt[data-diff="' + L + '"]').click();
      ok(!$("screen-game").classList.contains("hide"), L + ": switching level stays in the game" + tag);
      ok(filledNow().length === 0 && $("result-view").classList.contains("hide"), L + ": the chip starts a fresh puzzle" + tag);
    }
    const p = puzzle();
    ok(!!p, L + ": the tinted side matches a known mirror" + tag);
    if(!p) continue;
    ok(cells().length === E.LEVELS[L].size ** 2, L + ": grid is " + E.LEVELS[L].size + "²");
    ok($("mline").querySelectorAll("line").length === (p.ax === "B" ? 2 : 1), L + ": the dashed mirror line(s) are drawn");
    ok($("check-btn").disabled, L + ": Check waits until something is drawn");

    /* the given side ignores taps */
    const gi = cells().findIndex(c => c.classList.contains("given"));
    const before = cells()[gi].className;
    tap(gi); cells()[gi].click();
    ok(cells()[gi].className === before && filledNow().length === 0, L + ": a given square ignores taps");

    /* a wrong drawing: the answer minus two, plus one stray */
    const stray = cells().findIndex((c, i) => !c.classList.contains("given") && !p.answer.includes(i));
    const wrong = p.answer.slice(2).concat(stray >= 0 ? [stray] : []);
    draw(wrong);
    ok(filledNow().length === wrong.length, L + ": tapping fills squares");
    $("check-btn").click();
    const want = 2 + (stray >= 0 ? 1 : 0);
    const fb = $("feedback").textContent;
    ok(fb.includes(String(want)) && /mirrored yet/.test(fb), L + ": a wrong check reports " + want + " squares: " + fb);
    ok(!/row|column|\(|\bat\b/i.test(fb), L + ": the message never says which squares");
    ok(!$("check-btn").classList.contains("hide") && $("next-btn").classList.contains("hide"), L + ": a wrong check keeps Check");
    ok(d.getElementById("owl-game").classList.contains("worried"), L + ": owl worried on a failed check");

    /* Reset clears the drawing, keeps the picture */
    const pat = JSON.stringify(puzzle().pattern);
    $("reset-btn").click();
    ok(filledNow().length === 0 && JSON.stringify(puzzle().pattern) === pat, L + ": Reset clears the drawing and keeps the picture");

    /* Hint fills one right square */
    $("hint-link").click();
    ok(filledNow().length === 1 && p.answer.includes(filledNow()[0]), L + ": Hint fills one correct square");

    /* the right drawing wins */
    draw(p.answer);
    $("check-btn").click();
    await waitWin();
    ok(!$("next-btn").classList.contains("hide"), L + ": the right drawing wins" + tag);
    ok($("check-btn").classList.contains("hide"), L + ": Next replaces Check in place");
    ok($("skip-btn").classList.contains("invisible"), L + ": Skip hides with .invisible");
    ok(!$("result-view").classList.contains("hide"), L + ": the result shows above Next");
    ok($("stars").textContent === "★☆☆", L + ": one failed check AND a hint = ★, got " + $("stars").textContent);
    ok(!d.querySelector(".fold"), L + ": the fold layer is cleaned up");
    ok(d.getElementById("owl-game").classList.contains("win"), L + ": owl wins");
    const locked = filledNow().join();
    tap(cells().findIndex(c => !c.classList.contains("given")));
    ok(filledNow().join() === locked, L + ": the drawing is frozen after the win");

    /* Next: a fresh, different picture; a clean solve is ★★★ */
    $("next-btn").click();
    ok(JSON.stringify(puzzle().pattern) !== pat || puzzle().ax + puzzle().side !== p.ax + p.side, L + ": Next gives a different picture");
    ok(!$("skip-btn").classList.contains("invisible"), L + ": Next restores Skip");
    if(reducedMotion){
      const q = puzzle();
      draw(q.answer);
      $("check-btn").click();
      await waitWin();
      ok($("stars").textContent === "★★★", L + ": right first time, no hints = ★★★");
      $("next-btn").click();
    }
    /* Skip gives a different picture too */
    const s0 = JSON.stringify(puzzle());
    $("skip-btn").click();
    ok(JSON.stringify(puzzle()) !== s0, L + ": Skip gives a different picture");
  }

  /* keyboard: arrows move the ring, Enter toggles */
  {
    const start = cells().findIndex(c => c.tabIndex === 0);
    cells()[start].focus();
    cells()[start].dispatchEvent(new w.KeyboardEvent("keydown", { key:"ArrowDown", bubbles:true }));
    const now = cells().findIndex(c => c.tabIndex === 0);
    ok(now === start + size() || now === start, "ArrowDown moves the focus ring");
    const f = cells().findIndex(c => !c.classList.contains("given"));
    cells()[f].click(); cells()[f].click();               /* focus it via a toggle pair */
    cells()[f].dispatchEvent(new w.KeyboardEvent("keydown", { key:"Enter", bubbles:true }));
    ok(filledNow().includes(f), "Enter fills the focused square");
  }
  $("home-btn").click();
  ok(!$("screen-home").classList.contains("hide"), "Home returns to the start screen");
}

(async () => {
  await run(true);
  await run(false);
  report("mirror-draw play-through");
})();
