"use strict";
/* The page, driven through the DOM the way a player drives it: taps on real squares, with the
   owl answering on its own timer. The board is read back out of the page's own aria-labels, so
   a passing run is also a statement that the page draws exactly the position the engine holds
   — which is what lets the same engine pick the player's moves and actually win a game here. */
const { bootGame, loadEngine, mulberry32, tally, sleep, stress } = require("../../lib/harness.js");
const E = loadEngine("checkers");
const { ok, report } = tally();

const FILES = "abcdefgh";
const squareOf = label => (8 - Number(label[1])) * 8 + FILES.indexOf(label[0]);
const pieceOf = label =>
  label.includes("empty") ? E.EMPTY :
  label.includes("your")  ? (label.includes("king") ? E.R_KING : E.R_MAN)
                          : (label.includes("king") ? E.B_KING : E.B_MAN);

const darkSquares = d => [...d.querySelectorAll("#board button.sq.dark")];
const bySquare = (d, i) => darkSquares(d).find(b => squareOf(b.getAttribute("aria-label")) === i);
const dots = d => [...d.querySelectorAll("#board .dot")].map(x => x.parentNode);
const movable = d => [...d.querySelectorAll("#board .sq.movable")];
const finished = d => !d.getElementById("result-view").classList.contains("hide");

/* the position the page is currently showing, rebuilt from its own square labels */
function boardOf(d) {
  const b = new Array(64).fill(E.EMPTY);
  for (const btn of darkSquares(d)) {
    const label = btn.getAttribute("aria-label");
    b[squareOf(label)] = pieceOf(label);
  }
  return b;
}

/* the owl answers on a 450ms timer; outside the one test that checks that pause for real, shrink
   it so a whole game costs milliseconds instead of half a minute */
function hurryOwl(w) {
  const real = w.setTimeout.bind(w);
  w.setTimeout = fn => real(fn, 0);
}

/* The celebration is animated on requestAnimationFrame, which the harness runs on a Node timer
   rather than a window one — so it outlives close() and would wake up to a torn-down document.
   Put it away first; the owl's own timer is a window timer and close() takes care of that. */
function shut(w) {
  try { w.stopConfetti(); } catch (e) { /* nothing was thrown */ }
  w.close();
}

/* tap a move out on the board: the origin, then whichever offered square lies on its path —
   the page auto-advances the forced hops by itself, so only real branches need a tap */
function tapMove(d, move) {
  bySquare(d, move.from).click();
  for (let guard = 0; dots(d).length && guard < 20; guard++) {
    const next = dots(d).find(b => move.steps.includes(squareOf(b.getAttribute("aria-label"))));
    if (!next) break;
    next.click();
  }
}

async function settle(d, ms) {
  const until = Date.now() + (ms || 250);
  while (Date.now() < until) {
    if (finished(d) || movable(d).length) return;
    await sleep(1);
  }
}

(async function () {

  /* ===== 1. the start screen ============================================================= */
  {
    const errors = [];
    const { w, d, $ } = bootGame("checkers", { onError: e => errors.push(e.message) });
    ok(errors.length === 0, "the page loads without errors: " + errors.join(" | "));
    ok($("title").textContent === "Checkers", "the bouncy title says Checkers");
    ok(!$("screen-home").classList.contains("hide"), "the start screen shows first");
    ok($("screen-game").classList.contains("hide"), "the game screen is hidden until Start");
    ok(d.querySelector(".home-top .hub-link").getAttribute("href") === "../",
       "the start screen links back to the hub");

    const cards = [...d.querySelectorAll(".diff")];
    ok(cards.length === 4, "four level cards, got " + cards.length);
    ok(cards.map(c => c.dataset.diff).join(",") === "EASY,MEDIUM,HARD,EXPERT", "in the level table's order");
    for (const c of cards) {
      ok(/^\S+ [A-Z][a-z]+$/.test(c.querySelector(".d-name").textContent),
         "level card name is one line of emoji + word: " + c.querySelector(".d-name").textContent);
      const hint = c.querySelector(".d-range").textContent;
      ok(hint.split(" ").length <= 3 && hint.length <= 14, "level card hint stays short: " + hint);
    }
    ok(cards[0].getAttribute("aria-pressed") === "true", "Easy starts selected");
    ok(!!$("rules-home"), "the start screen carries the full-rules link");
    shut(w);
  }

  /* ===== 2. starting a game ============================================================== */
  {
    const { w, d, $ } = bootGame("checkers");
    $("start-btn").click();
    ok($("screen-home").classList.contains("hide") && !$("screen-game").classList.contains("hide"),
       "Start swaps the start screen for the game");

    ok(d.getElementById("board").children.length === 64, "the board draws 64 squares");
    ok(darkSquares(d).length === 32, "half of them are the playable dark squares");
    ok(d.querySelectorAll("#board .sq.light").length === 32, "the other half are light and inert");
    ok([...d.querySelectorAll("#board .sq.light")].every(s => s.tagName === "DIV" && s.getAttribute("aria-hidden") === "true"),
       "light squares are decorative, not controls");
    ok(d.querySelectorAll("#board .piece.you").length === 12, "twelve pieces for the player");
    ok(d.querySelectorAll("#board .piece.bird").length === 12, "twelve for the owl");
    ok(d.querySelectorAll("#board .piece .crown").length === 0, "nobody starts crowned");
    ok(boardOf(d).join(",") === E.startBoard().join(","), "the page draws exactly the engine's opening position");

    /* the bottom slot is occupied from the first frame, so winning cannot reflow it */
    ok($("playagain-btn").classList.contains("invisible"), "Play again holds the bottom slot, invisible");
    ok(!$("playagain-btn").classList.contains("hide"), "…by visibility, never display:none");
    ok(!$("skip-btn").classList.contains("invisible"), "Skip is showing during play");
    ok($("result-view").classList.contains("hide"), "no result panel yet");

    /* the standard control scheme */
    ok($("home-btn") && $("skip-btn") && $("hint-link") && $("rules-btn"), "Home, Skip, Hint and Rules are all wired");
    ok(!d.getElementById("reset-btn"), "a game against the owl has nothing to reset");
    const actions = [...d.querySelectorAll(".actions .tlink")].map(b => b.id);
    ok(actions.join(",") === "hint-link,rules-btn", "the actions row is Hint then Rules, got " + actions.join(","));
    shut(w);
  }

  /* ===== 3. what the opening offers ====================================================== */
  {
    const { w, d, $ } = bootGame("checkers");
    $("start-btn").click();
    ok(movable(d).length === 4, "four men can move at the start, got " + movable(d).length);
    ok(movable(d).every(s => !s.disabled), "every ringed piece is really tappable");
    ok(darkSquares(d).filter(s => !s.disabled).length === 4, "and nothing else on the board is");

    /* the ringed pieces are exactly the engine's movable ones */
    const shown = movable(d).map(s => squareOf(s.getAttribute("aria-label"))).sort((a, b) => a - b);
    const real = E.movablePieces(E.makeState(E.startBoard(), E.RED, false, 0)).sort((a, b) => a - b);
    ok(shown.join(",") === real.join(","), "the ringed pieces are the engine's movable ones");
    shut(w);
  }

  /* ===== 4. one tap is enough when there is no choice to make ============================ */
  {
    const { w, d, $ } = bootGame("checkers");
    $("start-btn").click();
    const corner = bySquare(d, E.idx(5, 0));          /* the edge man has a single destination */
    ok(corner.classList.contains("movable"), "the edge man can move");
    corner.click();
    ok(dots(d).length === 0, "a piece with one destination needs no second tap");
    ok(boardOf(d)[E.idx(4, 1)] === E.R_MAN && boardOf(d)[E.idx(5, 0)] === E.EMPTY,
       "…it just goes, in a single tap");
    ok(darkSquares(d).every(s => s.disabled), "the board locks while the owl thinks");
    shut(w);
  }

  /* ===== 5. a real choice waits for the player =========================================== */
  {
    const { w, d, $ } = bootGame("checkers");
    $("start-btn").click();
    const man = bySquare(d, E.idx(5, 2));             /* this one has two ways to go */
    man.click();
    ok(dots(d).length === 2, "a piece with two destinations offers both, got " + dots(d).length);
    ok(d.querySelectorAll("#board .sq.sel").length === 1, "and marks the piece it is moving");
    ok(boardOf(d)[E.idx(5, 2)] === E.R_MAN, "nothing has moved yet");

    man.click();                                       /* tapping it again puts it back */
    ok(dots(d).length === 0 && d.querySelectorAll("#board .sq.sel").length === 0,
       "tapping the piece again cancels the move");
    ok(movable(d).length === 4, "…and every piece is offered again");

    man.click();
    const target = squareOf(dots(d)[0].getAttribute("aria-label"));
    dots(d)[0].click();
    ok(boardOf(d)[target] === E.R_MAN && boardOf(d)[E.idx(5, 2)] === E.EMPTY,
       "tapping a dot plays the move to that square");
    shut(w);
  }

  /* ===== 6. the owl really does answer, on its own timer ================================= */
  {
    const { w, d, $ } = bootGame("checkers");
    $("start-btn").click();
    const before = boardOf(d);
    bySquare(d, E.idx(5, 0)).click();
    ok(darkSquares(d).every(s => s.disabled), "the player cannot move twice while the owl thinks");
    await sleep(900);
    ok(movable(d).length > 0, "the owl answers and hands the board back");
    const after = boardOf(d);
    ok(E.countPieces(after, E.BLACK) === 12 && E.countPieces(before, E.BLACK) === 12, "no piece was taken yet");
    ok(after.join(",") !== before.join(","), "but the position has moved on");
    shut(w);
  }

  /* ===== 7. Hint, Skip, Home, and the level switcher ===================================== */
  {
    const { w, d, $ } = bootGame("checkers");
    $("start-btn").click();
    $("hint-link").click();
    const lit = [...d.querySelectorAll("#board .sq.hint")];
    ok(lit.length === 2, "a hint lights the piece and where it should go, got " + lit.length);
    ok(lit.some(s => s.getAttribute("aria-label").includes("your")), "one of them is a piece of the player's");
    ok($("feedback").textContent.length > 0 && $("feedback").classList.contains("hint"),
       "and it says so in the feedback line");
    const advised = lit.map(s => squareOf(s.getAttribute("aria-label"))).sort((a, b) => a - b);
    const want = E.hintMove(E.makeState(E.startBoard(), E.RED, false, 0));
    ok(advised.join(",") === [want.from, want.to].sort((a, b) => a - b).join(","),
       "the squares lit are the engine's hint move");

    bySquare(d, E.idx(5, 2)).click();                 /* mid-selection… */
    $("skip-btn").click();                            /* …Skip still starts a clean game */
    ok(boardOf(d).join(",") === E.startBoard().join(","), "Skip deals a fresh board");
    ok(dots(d).length === 0 && d.querySelectorAll("#board .sq.hint").length === 0,
       "…clearing the selection and the hint with it");
    ok($("result-view").classList.contains("hide") && $("playagain-btn").classList.contains("invisible"),
       "and the bottom slot goes back to waiting");

    $("q-level").click();
    ok($("level-menu").classList.contains("open"), "the level chip opens its menu");
    const opts = [...d.querySelectorAll(".level-opt")];
    ok(opts.length === 4, "the menu lists all four levels, got " + opts.length);
    opts.find(o => o.textContent.includes("Expert")).click();
    ok(!$("level-menu").classList.contains("open"), "picking a level closes the menu");
    ok($("q-level-label").textContent === E.LEVELS.EXPERT.label, "the chip shows the new level");
    ok(d.querySelector('.diff[data-diff="EXPERT"]').getAttribute("aria-pressed") === "true",
       "and the start screen's card agrees");
    ok(boardOf(d).join(",") === E.startBoard().join(","), "switching level starts a fresh game there");
    ok(!$("screen-game").classList.contains("hide"), "…without leaving the game");

    $("home-btn").click();
    ok(!$("screen-home").classList.contains("hide") && $("screen-game").classList.contains("hide"),
       "Home goes back to the level picker");
    shut(w);
  }

  /* ===== 8. a game played properly, all the way to a win ================================= */
  {
    const errors = [];
    const { w, d, $ } = bootGame("checkers", { seed: 5, onError: e => errors.push(e.message) });
    hurryOwl(w);
    $("start-btn").click();

    let moves = 0, crowned = false, agrees = true;
    while (!finished(d) && moves < 200) {
      if (!movable(d).length) { await settle(d, 400); if (!movable(d).length) break; }
      const here = E.makeState(boardOf(d), E.RED, false, 0);
      if (E.legalMoves(here).length === 0) break;
      const best = E.searchBest(here, { depth: 6, budget: 50000, rng: () => 0 });
      tapMove(d, best.move);
      moves++;
      await sleep(0);
      await settle(d, 400);              /* a jump chain plays out hop by hop; let it land */
      if (d.querySelectorAll("#board .piece .crown").length) crowned = true;
      /* every crown the settled board draws is a piece the engine calls a king (mid-playback
         the page is deliberately showing a frame, not the position, so only check at rest) */
      if (movable(d).length || finished(d))
        for (const btn of darkSquares(d)) {
          const isKing = E.isKing(pieceOf(btn.getAttribute("aria-label")));
          if (!!btn.querySelector(".crown") !== isKing) agrees = false;
        }
    }

    ok(errors.length === 0, "a whole game runs without a page error: " + errors.join(" | "));
    ok(finished(d), "played to a finish in " + moves + " moves");
    ok(crowned, "a man reached the far row and was crowned along the way");
    ok(agrees, "a crown is drawn on exactly the pieces the engine calls kings");
    ok($("rlabel").textContent.includes("You win"), "playing well beats the Easy owl: " + $("rlabel").textContent);
    ok($("stars").textContent === "★★★", "a win with no hints is three stars, got " + $("stars").textContent);

    /* the top bar must not shift on the win */
    ok($("skip-btn").classList.contains("invisible"), "Skip goes invisible when the game ends");
    ok(!$("skip-btn").classList.contains("hide"), "…keeping its box, so the owl stays centred");
    ok(!$("playagain-btn").classList.contains("invisible"), "Play again appears in the slot it was already holding");
    ok(!$("result-view").classList.contains("hide"), "the result panel is showing");
    ok($("rsub").textContent.length > 0, "with a line of encouragement under it");
    ok(darkSquares(d).every(s => s.disabled), "and the finished board takes no more taps");

    $("playagain-btn").click();
    ok(boardOf(d).join(",") === E.startBoard().join(","), "Play again deals a fresh board");
    ok($("result-view").classList.contains("hide"), "…and puts the result panel away");
    ok($("playagain-btn").classList.contains("invisible") && !$("skip-btn").classList.contains("invisible"),
       "…and restores the playing controls");
    shut(w);
  }

  /* ===== 8b. a jump chain is played out one hop at a time =============================== */
  {
    /* Find a real multi-jump by playing on until one is on offer, then watch the board while
       it runs: the piece has to appear on each landing square in turn, taking one piece per
       beat, rather than arriving on the last square with everything already gone. */
    let checked = false;
    for (let seed = 1; seed <= 40 && !checked; seed++) {
      const { w, d, $ } = bootGame("checkers", { seed });
      $("start-btn").click();
      for (let m = 0; m < 60 && !checked; m++) {
        if (!movable(d).length) { await settle(d, 700); if (!movable(d).length) break; }
        const here = E.makeState(boardOf(d), E.RED, false, 0);
        const all = E.legalMoves(here);
        if (!all.length) break;
        const chain = all.find(x => x.caps.length >= 2);

        if (chain) {
          const owlBefore = E.countPieces(boardOf(d), E.BLACK);
          bySquare(d, chain.from).click();
          for (const step of chain.steps) {
            /* mid-playback: the travelling piece is on this landing square, and the piece it
               just jumped is on its way out */
            ok(bySquare(d, step).querySelector(".piece"), "the piece shows on landing square " + step);
            ok(d.querySelectorAll("#board .piece.taken").length === 1,
               "exactly one piece is being taken on this hop");
            ok(E.countPieces(boardOf(d), E.BLACK) === owlBefore,
               "the position itself does not change until the chain has finished");
            await sleep(320);
          }
          ok(E.countPieces(boardOf(d), E.BLACK) === owlBefore - chain.caps.length,
             "all " + chain.caps.length + " jumped pieces are gone once it lands");
          ok(d.querySelectorAll("#board .piece.taken").length === 0, "and nothing is left fading");
          checked = true;
        } else {
          tapMove(d, E.searchBest(here, { depth: 4, budget: 20000, rng: () => 0 }).move);
          await settle(d, 700);
        }
      }
      shut(w);
    }
    ok(checked, "found a multi-jump to watch");
  }

  /* ===== 9. hints cost stars ============================================================= */
  {
    const { w, d, $ } = bootGame("checkers", { seed: 5 });
    hurryOwl(w);
    $("start-btn").click();
    $("hint-link").click();
    let moves = 0;
    while (!finished(d) && moves < 200) {
      if (!movable(d).length) { await settle(d, 400); if (!movable(d).length) break; }
      const here = E.makeState(boardOf(d), E.RED, false, 0);
      if (E.legalMoves(here).length === 0) break;
      tapMove(d, E.searchBest(here, { depth: 6, budget: 50000, rng: () => 0 }).move);
      moves++;
      await sleep(0);
    }
    ok($("rlabel").textContent.includes("You win"), "the same game, won again");
    ok($("stars").textContent === "★★☆", "one hint costs one star, got " + $("stars").textContent);
    shut(w);
  }

  /* ===== 10. losing and drawing land properly too ======================================== */
  {
    let played = 0, errors = [], outcomes = {};
    for (let g = 0; g < stress(4); g++) {
      const { w, d, $ } = bootGame("checkers", { seed: 100 + g, onError: e => errors.push(e.message) });
      hurryOwl(w);
      $("start-btn").click();
      const rnd = mulberry32(900 + g);
      const pick = a => a[Math.floor(rnd() * a.length) % a.length];
      let taps = 0;
      while (!finished(d) && taps < 400) {
        const open = dots(d).length ? dots(d) : movable(d);
        if (!open.length) { await settle(d, 400); if (!dots(d).length && !movable(d).length) break; continue; }
        pick(open).click();
        taps++;
        await sleep(0);
      }
      ok(finished(d), "random play still reaches a finish (game " + g + ")");
      const label = $("rlabel").textContent, stars = $("stars").textContent;
      outcomes[label] = (outcomes[label] || 0) + 1;
      /* whatever the outcome, the reward has to match it */
      if (label.includes("You win")) ok(stars[0] === "★", "a win keeps at least one star");
      else if (label.includes("draw")) ok(stars === "★☆☆", "a draw is one star, got " + stars);
      else ok(stars === "☆☆☆", "a loss earns none, got " + stars);
      ok($("skip-btn").classList.contains("invisible") && !$("playagain-btn").classList.contains("invisible"),
         "the bottom slot and top bar settle the same way however it ends");
      played++;
      shut(w);
    }
    ok(errors.length === 0, "no page errors across " + played + " random games: " + errors.join(" | "));
    ok(Object.keys(outcomes).length > 0, "outcomes seen: " + JSON.stringify(outcomes));
  }

  /* ===== 11. Expert really is a different game =========================================== */
  {
    const { w, d, $ } = bootGame("checkers", { seed: 7 });
    hurryOwl(w);
    d.querySelector('.diff[data-diff="EXPERT"]').click();
    $("start-btn").click();
    ok($("q-level-label").textContent === E.LEVELS.EXPERT.label, "the chip carries Expert into the game");

    let moves = 0, sawFlight = false;
    while (!finished(d) && moves < 140 && !sawFlight) {
      if (!movable(d).length) { await settle(d, 400); if (!movable(d).length) break; }
      const here = E.makeState(boardOf(d), E.RED, true, 0);
      const all = E.legalMoves(here);
      if (!all.length) break;

      /* A king stepping more than one square is the Expert-only rule. Whenever the engine says
         one is available, check the page really offers that far square before playing on. */
      const far = all.find(m => E.isKing(here.b[m.from]) &&
        Math.abs(E.rowOf(m.steps[0]) - E.rowOf(m.from)) > (m.caps.length ? 2 : 1));
      if (far) {
        bySquare(d, far.from).click();
        const offered = dots(d).map(b => squareOf(b.getAttribute("aria-label")));
        ok(offered.includes(far.steps[0]) || movable(d).length === 0,
           "the page offers the flying king's distant square");
        sawFlight = true;
        bySquare(d, far.from).click();                  /* put it back, then play on normally */
      }

      /* crowning early gets a king onto the board, which is what makes flight possible at all */
      const mv = all.find(m => m.crown) || E.searchBest(here, { depth: 9, budget: 200000, rng: () => 0 }).move;
      tapMove(d, mv);
      moves++;
      await sleep(0);
    }
    ok(moves > 0, "an Expert game plays through the page");
    ok(sawFlight, "the page offered a flying-king move that no other level would allow");
    shut(w);
  }

  report("checkers page");
})();
