"use strict";
/* battleship play-through: boots the real page in jsdom and drives it like a player — hiding
   the fleet (auto, reset, turning a boat, picking one back up, a refused drop), the battle
   itself, a hit keeping the turn, the two seas staying separate, the hint, Skip/Home
   cancelling the owl's pending shot, the level switcher, keyboard walking, and whole games at
   both levels with the result, the star count and the bottom slot checked.

   The fleet the page hides is read back off its own grid-area values, so the game is driven
   and checked through exactly what a player sees. */
const { bootGame, sleep, loadEngine, tally } = require("../../lib/harness.js");
const E = loadEngine("battleship");
const { ok, report } = tally();

/* Waiting a fixed 250ms for the owl is a race on a busy machine, and a hit now lets it fire
   again, so a reply can be several shots long. Wait for the page's own state instead: your
   squares go dead while the owl is shooting and come back when it finally misses. Where the
   point IS that no shot lands — after Skip and Home — the wait stays a real sleep. */
const owlReply = async g => {
  for (let i = 0; i < 4000 && !g.over() && !g.myTurn(); i++) await sleep(5);
};

function boot(opts = {}) {
  const errors = [];
  const g = bootGame("battleship", Object.assign({ reducedMotion: true, seed: 7, onError: e => errors.push(e.message) }, opts));
  g.errors = errors;
  g.n = () => +g.$("sea-you").style.getPropertyValue("--n");
  g.sq = (side, i) => g.$("sea-" + side + "-" + i);
  g.cells = side => [...g.$("sea-" + side).querySelectorAll(".sq")];
  g.ships = side => [...g.$("sea-" + side).querySelectorAll(".ship")];
  g.trayChips = () => [...g.$("tray").querySelectorAll(".tchip")];
  g.over = () => !g.$("result-view").classList.contains("hide");
  /* a square is a target when the page marks it .live — spent squares stay focusable on
     purpose (aria-disabled, not disabled) so the sea can still be read with the arrow keys */
  g.live = side => g.cells(side).filter(b => b.classList.contains("live"));
  g.openAt = side => g.cells(side).findIndex(b => b.classList.contains("live"));
  g.myTurn = () => g.live("owl").length > 0;
  g.start = level => {
    if (level) g.d.querySelector('.diff[data-diff="' + level + '"]').click();
    g.$("start-btn").click();
  };
  /* the marks a player can see on a sea, read from the aria-labels the page writes */
  g.marks = side => g.cells(side).map(b => {
    const l = b.getAttribute("aria-label") || "";
    return /a hit$/.test(l) ? "H" : /a splash$/.test(l) ? "M" : ".";
  });
  /* the first two numbers of a grid-area, which is where the browser would really put it */
  g.at = el => (el.style.gridArea || "").split("/").slice(0, 2).map(x => +x.trim());
  /* the fleet as the page has actually drawn it */
  g.fleetCells = side => g.ships(side).map(el => {
    const m = /(\d+)\s*\/\s*(\d+)\s*\/\s*span\s*(\d+)\s*\/\s*span\s*(\d+)/.exec(el.style.gridArea);
    const r = +m[1] - 2, c = +m[2] - 2, down = +m[3] > 1, len = Math.max(+m[3], +m[4]), n = g.n();
    return Array.from({ length: len }, (_, k) => down ? (r + k) * n + c : r * n + (c + k));
  });
  return g;
}

/* THE regression guard. Every child of a .sea must carry its own grid position, and every
   square must sit at the cell its index names. Labels and squares used to be auto-placed
   while the boats and markers over them were not — CSS Grid places explicit items first and
   flows the auto ones into what is left, so drawing a boat shoved every later square one cell
   along. The grid grew holes, it moved as the game went on, and a tap landed on the wrong
   row. jsdom does no layout, so nothing about the rendering can be asserted here — but this
   invariant is exactly what the browser would have got wrong, and it is plain data. */
function checkPlacement(g, side, where) {
  const el = g.$("sea-" + side), n = g.n();
  const stray = [...el.children].filter(c => !c.style.gridArea);
  ok(stray.length === 0, where + ": " + stray.length + " of " + el.children.length + " children of #sea-" + side
     + " are auto-placed (" + stray.slice(0, 3).map(c => c.className).join(", ")
     + ") — CSS Grid would shove the squares around them");
  let wrong = 0;
  for (let i = 0; i < n * n; i++) {
    const [r, c] = g.at(g.sq(side, i));
    if (r !== Math.floor(i / n) + 2 || c !== (i % n) + 2) wrong++;
  }
  ok(wrong === 0, where + ": " + wrong + " squares of #sea-" + side + " are not at the cell their index names");
}

/* Plays the page to the end the way a child who has grasped the game would: finish whatever
   is already wounded, otherwise work along a checkerboard. Deliberately NOT the game's own
   Hint — it reads only the marks the page shows, so a win here says the game is winnable
   through its own interface, not that its owl agrees with itself. */
async function playSmart(g) {
  let taps = 0;
  while (!g.over() && taps < 400) {
    if (!g.myTurn()) { await owlReply(g); continue; }
    const n = g.n(), marks = g.marks("owl"), next = [];
    for (let i = 0; i < n * n; i++) {
      if (marks[i] !== "H") continue;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const r = Math.floor(i / n) + dr, c = (i % n) + dc;
        if (r >= 0 && r < n && c >= 0 && c < n && marks[r * n + c] === ".") next.push(r * n + c);
      }
    }
    let target = next.length ? next[0] : -1;
    if (target < 0)
      for (let i = 0; i < n * n && target < 0; i++)
        if (marks[i] === "." && (Math.floor(i / n) + (i % n)) % 2 === 0) target = i;
    if (target < 0) target = marks.indexOf(".");
    if (target < 0 || !g.sq("owl", target).classList.contains("live")) target = g.openAt("owl");
    if (target < 0) break;
    g.sq("owl", target).click();
    taps++;
  }
  return taps;
}

(async () => {
  /* ---- the start screen ------------------------------------------------------------------ */
  {
    const g = boot();
    ok(g.$("screen-game").classList.contains("hide"), "the game screen starts hidden");
    ok(!!g.d.querySelector('.home-top a.hub-link[href="../"]'), "the start screen needs the ← All games link");
    const diffs = [...g.d.querySelectorAll(".diff")];
    ok(diffs.length === 2, "battleship has two levels, got " + diffs.length);
    ok(g.d.querySelector(".diff-grid").classList.contains("two"),
       "a two-card row needs .diff-grid.two, or site.css spreads them over four columns");
    ok([...g.d.querySelectorAll("#level-menu .level-opt")].length === 2, "the level menu lists both levels");
    ok(diffs[0].getAttribute("aria-pressed") === "true", "Easy starts selected");
    diffs[1].click();
    ok(diffs[1].getAttribute("aria-pressed") === "true" && diffs[0].getAttribute("aria-pressed") === "false",
       "picking a level moves the pressed state");
    ok(g.$("q-level-label").textContent === E.LEVELS.EXPERT.label, "the chip follows the level cards");
    g.w.close();
  }

  /* ---- hiding your fleet ------------------------------------------------------------------ */
  {
    const g = boot();
    g.start("EASY");
    ok(!g.$("screen-game").classList.contains("hide"), "Start opens the game screen");
    ok(g.$("owl-side").classList.contains("hide"), "the owl's sea stays hidden while you hide your fleet");
    ok(g.$("tally").classList.contains("hide") && g.$("rosters").classList.contains("hide"),
       "the score line and the rosters only mean something once the battle starts");
    ok(g.$("hint-link").classList.contains("invisible"), "there is nothing to hint at before the battle");
    ok(!g.$("auto-btn").classList.contains("invisible") && !g.$("reset-btn").classList.contains("invisible"),
       "Auto and Reset are live while you are placing");
    ok(!g.$("ready-btn").classList.contains("hide"), "the bottom slot holds Ready while you place");
    ok(g.n() === 10 && g.cells("you").length === 100, "the sea is always a full 10×10");
    ok(g.$("sea-you").style.gridTemplateColumns.includes("repeat(10,"),
       "the sea needs its column tracks, or every square stacks in one column");
    ok(g.ships("you").length === 5, "your five boats start in the water, got " + g.ships("you").length);
    ok(g.trayChips().length === 0, "nothing is left on the bench once the fleet is shuffled in");
    ok(g.$("tray").textContent.trim() === "", "an empty bench shows nothing at all, not a status line");
    checkPlacement(g, "you", "placing");

    /* Reset puts the whole fleet back on the bench */
    g.$("reset-btn").click();
    ok(g.ships("you").length === 0 && g.trayChips().length === 5, "Reset takes every boat out of the water");
    ok(g.trayChips()[0].getAttribute("aria-pressed") === "true", "the first boat is the one in your hand");

    /* Ready is refused while a boat is still on the bench */
    g.$("ready-btn").click();
    ok(g.$("owl-side").classList.contains("hide") && /🚫/.test(g.$("feedback").textContent),
       "Ready is refused until every boat is in the water");

    /* tapping the held boat turns it */
    ok(g.trayChips()[0].querySelector(".turn").textContent === "↔", "a boat starts lying across");
    g.trayChips()[0].click();
    ok(g.trayChips()[0].querySelector(".turn").textContent === "↕", "tapping the held boat turns it");
    g.trayChips()[0].click();
    ok(g.trayChips()[0].querySelector(".turn").textContent === "↔", "and turns it back");

    /* place the fleet by hand, one boat at a time */
    for (let guard = 0; g.trayChips().length && guard < 200; guard++) {
      const before = g.trayChips().length;
      for (let i = 0; i < 100 && g.trayChips().length === before; i++) g.sq("you", i).click();
    }
    ok(g.trayChips().length === 0 && g.ships("you").length === 5, "every boat can be placed by tapping a square");

    /* a boat may be picked back up and put down again */
    g.ships("you")[0].click();
    ok(g.ships("you").length === 4 && g.trayChips().length === 1, "tapping a boat picks it back up");
    ok(/back in the sea/.test(g.$("feedback").textContent), "and the game says so");

    /* dropping it on top of another boat is refused, with a reason. The square comes from the
       fleet the page has drawn, so it is always one a boat is really on. */
    const taken = g.fleetCells("you").flat();
    g.sq("you", taken[0]).click();
    ok(g.trayChips().length === 1 && /🚫/.test(g.$("feedback").textContent),
       "dropping a boat on top of another is refused, with a reason");
    for (let i = 0; i < 100 && g.trayChips().length; i++) g.sq("you", i).click();
    ok(g.trayChips().length === 0 && g.ships("you").length === 5, "and a legal square still takes the boat");

    /* the fleet the page drew really is a legal one: at EASY no two boats may touch */
    const fleet = g.fleetCells("you"), n0 = g.n();
    let clash = 0;
    for (let a = 0; a < fleet.length; a++) for (let b = a + 1; b < fleet.length; b++)
      for (const i of fleet[a]) for (const j of fleet[b])
        if (Math.max(Math.abs(Math.floor(i / n0) - Math.floor(j / n0)), Math.abs(i % n0 - j % n0)) <= 1) clash++;
    ok(clash === 0, "no two boats the page drew may touch at EASY (" + clash + " clashes)");
    ok(fleet.map(f => f.length).sort().join() === E.FLEET.map(s => s.len).sort().join(),
       "the page draws the whole catalogued fleet");

    /* Auto reshuffles the whole fleet */
    const before = g.ships("you").map(s => s.style.gridArea).join("|");
    let moved = false;
    for (let t = 0; t < 20 && !moved; t++) {
      g.$("auto-btn").click();
      moved = g.ships("you").map(s => s.style.gridArea).join("|") !== before;
    }
    ok(moved && g.ships("you").length === 5, "Auto shuffles the fleet into a new legal layout");
    checkPlacement(g, "you", "after shuffling");
    ok(g.errors.length === 0, "no page errors while placing: " + g.errors.join("; "));
    g.w.close();
  }

  /* ---- the touching rule really is what the level changes ---------------------------------- */
  /* At EASY the Battleship may not be dropped alongside the Carrier; at EXPERT it may. Same
     taps, same squares, opposite outcome — so the level is doing something real. */
  for (const [level, allowed] of [["EASY", false], ["EXPERT", true]]) {
    const g = boot();
    g.start(level);
    g.$("reset-btn").click();
    g.sq("you", 0).click();            /* the Carrier lies across A1–A5 */
    ok(g.ships("you").length === 1, level + ": the first boat goes down at A1");
    g.sq("you", 10).click();           /* the Battleship would lie along B1–B4, touching it */
    ok((g.ships("you").length === 2) === allowed,
       level + ": a boat alongside another should " + (allowed ? "be allowed" : "be refused"));
    if (!allowed) ok(/touch/.test(g.$("feedback").textContent), level + ": and the game should say why");
    ok(g.errors.length === 0, level + ": no page errors: " + g.errors.join("; "));
    g.w.close();
  }

  /* ---- the battle ------------------------------------------------------------------------- */
  {
    const g = boot();
    g.start("EASY");
    g.$("ready-btn").click();
    ok(!g.$("owl-side").classList.contains("hide"), "Ready opens the owl's sea");
    ok(!g.$("tally").classList.contains("hide") && !g.$("rosters").classList.contains("hide"),
       "and brings up the score line and both fleet rosters");
    ok(g.$("ready-btn").classList.contains("hide") && !g.$("next-btn").classList.contains("hide"),
       "the bottom slot swaps Ready for the (still invisible) Play again");
    ok(g.$("next-btn").classList.contains("invisible"), "Play again stays invisible until the game ends");
    ok(g.$("auto-btn").classList.contains("invisible") && g.$("reset-btn").classList.contains("invisible"),
       "Auto and Reset go .invisible once the battle starts (site.css collapses them, so the rest centre)");
    ok(!g.$("hint-link").classList.contains("invisible"), "Hint is live in the battle");
    ok(g.ships("owl").length === 0, "the owl's boats are hidden");
    ok(g.ships("you").length === 5, "your own boats stay visible");
    ok(g.myTurn(), "you fire first");
    ok(g.live("you").length === 0 && g.cells("you").every(b => b.getAttribute("aria-disabled") === "true"),
       "your own sea is a chart to read, never a target");
    ok(g.cells("owl").length === 100, "the owl's sea is 10×10 too");
    checkPlacement(g, "owl", "the battle");
    checkPlacement(g, "you", "the battle");
    /* both rosters start with all five boats afloat */
    ok(g.d.querySelectorAll("#roster-you .rline").length === 5
       && g.d.querySelectorAll("#roster-owl .rline").length === 5, "both rosters list five boats");
    ok(g.d.querySelectorAll("#roster-owl .rline.sunk").length === 0, "none of the owl's boats has sunk yet");
    ok(/5/.test(g.$("tally-you").textContent) && /5/.test(g.$("tally-owl").textContent),
       "the score line starts at five ships each");

    /* one shot */
    const first = g.openAt("owl");
    g.sq("owl", first).click();
    ok(g.marks("owl")[first] !== ".", "your shot leaves a mark on the owl's sea");
    ok(!g.sq("owl", first).classList.contains("live"), "a square you have fired at stops being a target");
    ok(!g.sq("owl", first).disabled,
       "but it must stay focusable, or the arrow keys cannot walk past it to read the sea");
    /* a hit is a burst, a miss a ripple — they differ by shape, not colour alone */
    const mk = g.$("sea-owl").querySelector(".mk");
    ok(!!mk && (mk.classList.contains("hit") || mk.classList.contains("miss")), "the shot is marked hit or miss");
    ok(mk.classList.contains("hit") === !!mk.querySelector(".burst"), "a hit draws a burst, a miss does not");
    checkPlacement(g, "owl", "after a shot");

    await owlReply(g);
    ok(g.marks("you").filter(m => m !== ".").length >= 1, "the owl fires back");
    ok(g.myTurn() || g.over(), "and the turn comes back to you");

    /* firing again at the same square is refused and costs nothing */
    const marksBefore = g.marks("you").join("");
    g.sq("owl", first).click();
    await sleep(320);
    ok(g.marks("you").join("") === marksBefore, "a tap on a spent square must not give the owl a free shot");

    /* the hint names a square, and firing at it is a legal shot */
    g.$("hint-link").click();
    const hinted = g.$("sea-owl").querySelector(".sq.hinted");
    ok(!!hinted && /💡/.test(g.$("feedback").textContent), "Hint marks a square and says which");
    ok(hinted.classList.contains("live"), "the hinted square is one you can actually fire at");
    ok(g.errors.length === 0, "no page errors in the battle: " + g.errors.join("; "));
    g.w.close();
  }

  /* ---- a hit means you go again ------------------------------------------------------------ */
  /* Fire straight at a boat and the turn must NOT pass: your sea stays untouched and the owl's
     squares stay live. The boat is found through the page's own marks, by firing until a hit
     lands, so nothing here reaches past what a player can see. */
  {
    const g = boot({ seed: 3 });
    g.start("EASY");
    g.$("ready-btn").click();
    let hits = 0, taps = 0, chained = 0;
    while (!g.over() && taps < 100) {
      const open = g.openAt("owl");
      if (open < 0) break;
      const mineBefore = g.marks("you").join("");
      g.sq("owl", open).click();
      taps++;
      if (g.marks("owl")[open] === "H") {
        hits++;
        /* a hit: it is still your turn, right now, with no wait and no owl shot */
        if (g.myTurn() && g.marks("you").join("") === mineBefore) chained++;
        ok(/again/i.test(g.$("feedback").textContent) || g.over(),
           "a hit should tell the player to fire again, got " + JSON.stringify(g.$("feedback").textContent));
      } else {
        await owlReply(g);
      }
      if (hits >= 6) break;
    }
    ok(hits >= 3, "the sweep should have landed some hits to test the rule (" + hits + ")");
    ok(chained === hits, "every hit should hand the turn straight back (" + chained + " of " + hits + ")");
    ok(g.errors.length === 0, "no page errors: " + g.errors.join("; "));
    g.w.close();
  }

  /* ---- Skip and Home cancel the owl's pending shot ----------------------------------------- */
  for (const [what, press] of [["Skip", g => g.$("skip-btn").click()], ["Home", g => g.$("home-btn").click()]]) {
    const g = boot();
    g.start("EASY");
    g.$("ready-btn").click();
    /* fire until a shot MISSES, so the owl really is taking aim when we interrupt it */
    let taps = 0;
    while (taps < 100) {
      const open = g.openAt("owl");
      if (open < 0) break;
      g.sq("owl", open).click();
      taps++;
      if (g.marks("owl")[open] === "M") break;
    }
    const mine = g.marks("you").join("");
    press(g);
    await sleep(500);                        /* the point is that nothing lands in this window */
    ok(g.$("owl-side").classList.contains("hide") || g.marks("you").join("") === mine,
       what + " must cancel the owl's pending shot");
    ok(g.errors.length === 0, "no page errors after " + what + ": " + g.errors.join("; "));
    if (what === "Skip") {
      ok(g.$("owl-side").classList.contains("hide") && !g.$("ready-btn").classList.contains("hide"),
         "Skip deals a fresh sea and goes back to hiding your fleet");
      ok(g.ships("you").length === 5, "with a fresh fleet already in the water");
    } else {
      ok(!g.$("screen-home").classList.contains("hide"), "Home goes back to the start screen");
    }
    g.w.close();
  }

  /* ---- the level switcher ------------------------------------------------------------------ */
  {
    const g = boot();
    g.start("EASY");
    const opt = [...g.d.querySelectorAll("#level-menu .level-opt")].find(b => /Expert/i.test(b.textContent));
    opt.click();
    ok(g.n() === 10 && g.cells("you").length === 100, "EXPERT is a 10×10 sea too");
    ok(g.ships("you").length === 5, "and hides the same five boats");
    ok(g.$("q-level-label").textContent === E.LEVELS.EXPERT.label, "the chip shows the new level");
    ok(g.$("owl-side").classList.contains("hide"), "and you are back to hiding your fleet");
    checkPlacement(g, "you", "after switching level");
    g.$("ready-btn").click();
    ok(g.cells("owl").length === 100, "the owl's sea is 10×10");
    ok(g.errors.length === 0, "no page errors switching level: " + g.errors.join("; "));
    g.w.close();
  }

  /* ---- the keyboard walks a sea ------------------------------------------------------------ */
  {
    const g = boot();
    g.start("EASY");
    g.$("ready-btn").click();
    /* a sea is ONE tab stop, not n×n of them — checked before this test moves the focus itself */
    ok(g.d.querySelectorAll('.sq[tabindex="0"]').length === 2,
       "each sea should be a single tab stop, got " + g.d.querySelectorAll('.sq[tabindex="0"]').length);
    const focus = (g, i) => { [...g.d.querySelectorAll(".sq")].forEach(b => b.tabIndex = -1); g.sq("owl", i).tabIndex = 0; g.sq("owl", i).focus(); };
    focus(g, 0);
    const press = key => g.d.dispatchEvent(new g.w.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    press("ArrowRight");
    ok(g.d.activeElement === g.sq("owl", 1), "→ walks across the sea");
    press("ArrowDown");
    ok(g.d.activeElement === g.sq("owl", 11), "↓ walks down it");
    press("ArrowLeft"); press("ArrowUp");
    ok(g.d.activeElement === g.sq("owl", 0), "and back again");
    press("ArrowUp");
    ok(g.d.activeElement === g.sq("owl", 0), "the edge of the sea holds the focus");
    /* a square already fired at must not trap the focus — that is the whole reason a spent
       square is aria-disabled rather than disabled */
    g.sq("owl", 1).click();
    focus(g, 0);
    press("ArrowRight");
    ok(g.d.activeElement === g.sq("owl", 1), "the arrow keys walk over a square you have fired at");
    press("ArrowRight");
    ok(g.d.activeElement === g.sq("owl", 2), "and carry on past it");
    /* the rules sheet owns the keyboard while it is up */
    g.$("rules-btn").click();
    press("ArrowLeft");
    ok(g.d.activeElement !== g.sq("owl", 1), "arrow keys do nothing while the rules sheet is open");
    ok(g.errors.length === 0, "no page errors on the keyboard: " + g.errors.join("; "));
    g.w.close();
  }

  /* ---- whole games, both levels ------------------------------------------------------------ */
  const outcomes = {};
  for (const level of Object.keys(E.LEVELS)) {
    const g = boot({ seed: 21 });
    g.start(level);
    g.$("ready-btn").click();
    const taps = await playSmart(g);
    ok(g.over(), level + ": a whole game should reach a result (" + taps + " shots)");
    const stars = g.$("stars").textContent;
    const won = /you win/i.test(g.$("rlabel").textContent);
    outcomes[level] = (won ? "won" : "lost") + " " + stars + " in " + taps;
    if (level === "EASY")
      ok(won, "EASY should be winnable by playing sensibly through the page — it was not");
    ok(/^[★☆]{3}$/.test(stars), level + ": the result shows three star boxes, got " + JSON.stringify(stars));
    ok(won ? stars.startsWith("★") : stars === "☆☆☆",
       level + ": a win earns at least one star and a loss none, got " + stars);
    ok(g.$("skip-btn").classList.contains("invisible") && g.$("skip-btn").style.display !== "none",
       level + ": Skip hides but keeps its box, so the owl stays centred");
    ok(g.$("hint-link").classList.contains("invisible"), level + ": Hint goes away once the game is over");
    ok(!g.$("next-btn").classList.contains("invisible"), level + ": Play again appears in the bottom slot");
    ok(g.ships("owl").length === E.FLEET.length, level + ": every one of the owl's boats is shown at the end");
    ok(g.live("owl").length === 0, level + ": the owl's sea stops taking taps once the game is over");
    checkPlacement(g, "owl", level + " at the end");
    /* the losing side's roster is struck through, and the score line agrees with it */
    const loser = won ? "owl" : "you";
    ok(g.d.querySelectorAll("#roster-" + loser + " .rline.sunk").length === E.FLEET.length,
       level + ": every boat of the beaten fleet should be struck off its roster");
    ok(/\b0\b/.test(g.$("tally-" + loser).textContent),
       level + ": the score line should show the beaten fleet at zero, got " + g.$("tally-" + loser).textContent);
    /* Play again deals a fresh round back at the placing phase */
    g.$("next-btn").click();
    ok(!g.over() && g.$("owl-side").classList.contains("hide") && !g.$("ready-btn").classList.contains("hide"),
       level + ": Play again starts a fresh round at the placing phase");
    ok(g.errors.length === 0, level + ": no page errors in a whole game: " + g.errors.join("; "));
    g.w.close();
  }
  console.log("  whole games: " + JSON.stringify(outcomes));

  /* ---- hints cost stars --------------------------------------------------------------------- */
  {
    for (const [hints, want] of [[0, "★★★"], [1, "★★☆"], [2, "★☆☆"]]) {
      let checked = false;
      for (let seed = 1; seed <= 12 && !checked; seed++) {
        const g = boot({ seed: seed });
        g.start("EASY");
        g.$("ready-btn").click();
        for (let k = 0; k < hints; k++) g.$("hint-link").click();
        await playSmart(g);
        if (/you win/i.test(g.$("rlabel").textContent)) {
          ok(g.$("stars").textContent === want,
             hints + " hint(s) should leave " + want + ", got " + g.$("stars").textContent);
          checked = true;
        }
        g.w.close();
      }
      ok(checked, hints + " hint(s): never won a game in 12 tries, so the star count went unchecked");
    }
  }

  /* ---- with motion on, the page still behaves --------------------------------------------- */
  {
    const g = boot({ reducedMotion: false });
    g.start("EASY");
    g.$("ready-btn").click();
    const first = g.openAt("owl");
    g.sq("owl", first).click();
    ok(!!g.$("sea-owl").querySelector(".mk.fresh"), "the newest mark pops in with motion on");
    if (!g.myTurn()) {
      await owlReply(g);
      ok(g.marks("you").filter(m => m !== ".").length >= 1, "the owl replies with motion on too");
    }
    ok(g.errors.length === 0, "no page errors with motion on: " + g.errors.join("; "));
    g.w.close();
  }

  report("battleship play-through");
})();
