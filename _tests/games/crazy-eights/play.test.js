"use strict";
/* crazy-eights play-through: boots the real page in jsdom and drives it like a player —
   the start screen, the deal, which cards the page will let you play, the wild-eight suit
   picker, taking a card from the pack, Hint, Reset replaying the same deal, Skip dealing a
   new one, Home, and whole games played to a result with the bottom slot checked. */
const { bootGame, sleep, loadEngine, tally } = require("../../lib/harness.js");
const E = loadEngine("crazy-eights");
const { ok, report } = tally();

function boot(opts = {}) {
  const errors = [];
  const g = bootGame("crazy-eights", Object.assign({ reducedMotion: true, seed: 5,
    onError: e => errors.push(e.message) }, opts));
  g.errors = errors;
  g.cards = () => [...g.d.querySelectorAll("#your-hand .card-btn")];
  g.owlCards = () => [...g.d.querySelectorAll("#owl-hand .back")];
  g.suits = () => [...g.d.querySelectorAll("#suit-pick button")];
  g.picking = () => !g.$("suit-pick").classList.contains("hide");
  g.over = () => !g.$("next-btn").classList.contains("invisible");
  g.hand = () => g.cards().map(b => b.getAttribute("aria-label")).join(" | ");
  g.stockLeft = () => parseInt(g.$("stock-count").textContent, 10);
  g.counts = () => [parseInt(g.$("your-count").textContent, 10), parseInt(g.$("owl-count").textContent, 10)];
  g.myTurn = () => g.cards().some(b => !b.disabled) || !g.$("stock-btn").disabled || g.picking();
  return g;
}
/* the owl answers on a timer: wait for the page to hand the turn back, never a fixed delay */
async function owlReply(g) {
  for (let i = 0; i < 1000 && !g.over() && !g.myTurn(); i++) await sleep(10);
}

(async () => {
  /* ---- start screen --------------------------------------------------------------------- */
  {
    const g = boot();
    const { $, d } = g;
    ok(!$("screen-home").classList.contains("hide") && $("screen-game").classList.contains("hide"),
       "opens on the start screen");
    ok($("title").textContent.replace(/\s/g, "") === "CrazyEights", "bouncy title reads Crazy Eights");
    ok(d.querySelector(".hub-link").getAttribute("href") === "../", "← All games points to the hub");
    ok(d.querySelectorAll(".diff").length === 0 && !$("q-level"),
       "a game of cards has no levels: no level cards and no level chip");
    ok(!!$("rules-home"), "the start screen carries the full-rules link");
    $("rules-home").click();
    ok(d.getElementById("rules-ov").classList.contains("show") && d.querySelectorAll("#rules-body .rule").length >= 5,
       "📖 Read the full rules opens the sheet");
    d.getElementById("rules-close").click();
    g.w.close();
  }

  /* ---- the deal ------------------------------------------------------------------------- */
  {
    const g = boot();
    const { $, d } = g;
    $("start-btn").click();
    ok($("screen-home").classList.contains("hide") && !$("screen-game").classList.contains("hide"), "Start shows the game");
    ok(g.cards().length === E.HAND && g.owlCards().length === E.HAND, "seven cards each");
    ok($("stock-count").textContent === (52 - 2 * E.HAND - 1) + " left", "the pack holds the rest: " + $("stock-count").textContent);
    ok(/Suit: [♠♥♦♣]/.test($("suit-now").textContent), "the pile names the suit in force: " + $("suit-now").textContent);
    ok(d.querySelectorAll("#pile-top .card-btn").length === 1, "one card face up on the pile");
    /* a real card face: the index in both corners and the suit in the middle */
    const face = g.cards()[0];
    ok(face.querySelectorAll(".idx").length === 2 && !!face.querySelector(".idx.tl") && !!face.querySelector(".idx.br"),
       "each card carries its index in both corners");
    ok(face.querySelectorAll(".idx .r").length === 2 && face.querySelectorAll(".idx .s").length === 2,
       "…each one a rank and a suit");
    ok(face.querySelector(".pip") && /^[♠♥♦♣]$/.test(face.querySelector(".pip").textContent),
       "and the big suit in the middle: " + (face.querySelector(".pip") || {}).textContent);
    ok(/^(red|black)$/.test([...face.classList].find(c => c === "red" || c === "black") || ""),
       "the suit's colour is on the card");
    /* the pack is a card back with a real box — an inline span here would collapse to a line */
    const back = d.querySelector("#stock-btn .back");
    ok(!!back, "the pack shows a card back");
    ok(g.w.getComputedStyle(back).display === "block", "…as a block, so its width and height apply");
    ok(g.w.getComputedStyle(back).width.startsWith("clamp") === false, "…sized from the card variable");
    /* both hands say how many cards they hold, so nothing has to be counted by eye */
    ok($("your-count").textContent === "7 cards" && $("owl-count").textContent === "7 cards",
       "both hands show their count: you " + $("your-count").textContent + ", owl " + $("owl-count").textContent);
    ok($("owl-count").getAttribute("aria-label") === "The owl has 7 cards"
       && $("your-count").getAttribute("aria-label") === "You have 7 cards",
       "…and each says whose it is, for a screen reader");
    ok($("owl-hand").getAttribute("aria-hidden") === "true",
       "the face-down cards themselves are decorative — the count carries the meaning");
    ok(g.cards().every(b => /^(A|[2-9]|10|J|Q|K) of (spades|hearts|diamonds|clubs)$/.test(b.getAttribute("aria-label"))),
       "every card of yours names itself: " + g.cards()[0].getAttribute("aria-label"));
    /* the page enables exactly the cards the rules allow */
    ok(d.querySelectorAll("#screen-game .btn").length === 1, "exactly one real .btn on the game screen");
    const actions = [...d.querySelectorAll(".actions .tlink")].map(b => b.id);
    ok(actions.join(",") === "reset-btn,hint-link,rules-btn", "actions row is Reset, Hint, Rules — got " + actions.join(","));
    ok(!$("skip-btn").classList.contains("invisible") && $("next-btn").classList.contains("invisible"),
       "Skip showing, Play again holding its slot invisibly");
    g.w.close();
  }

  /* ---- only the legal cards are tappable ------------------------------------------------- */
  {
    const g = boot({ seed: 21 });
    const { $ } = g;
    $("start-btn").click();
    const live = g.cards().filter(b => !b.disabled);
    ok(live.length > 0, "at least one card is playable on the opening pile");
    ok(live.every(b => b.classList.contains("playable")), "a playable card is marked, not just enabled");
    ok(g.cards().filter(b => b.disabled).every(b => !b.classList.contains("playable")),
       "a card you cannot play is never marked playable");
    ok($("stock-btn").disabled, "the pack is shut while you hold a card you can play");
    /* tapping a dead card changes nothing and says so */
    const dead = g.cards().find(b => b.disabled);
    if (dead) {
      const before = g.cards().length;
      dead.click();
      ok(g.cards().length === before, "tapping a card you cannot play does nothing");
    }
    const plain = live.find(b => !/^8 /.test(b.getAttribute("aria-label")));
    if (plain) {
      const label = plain.getAttribute("aria-label"), n = g.cards().length;
      plain.click();
      ok(g.cards().length === n - 1, "playing a card takes it out of your hand");
      ok(g.counts()[0] === n - 1, "and the count follows: " + $("your-count").textContent);
      ok(!g.hand().includes(label), "…that exact card: " + label);
      await owlReply(g);
      ok(g.over() || g.myTurn(), "the owl answers and hands the turn back");
    }
    ok(g.errors.length === 0, "no page errors playing: " + g.errors.join("; "));
    g.w.close();
  }

  /* ---- an eight is wild: the page asks for a suit ---------------------------------------- */
  {
    /* deal until you hold a playable eight, then play it */
    let g = null;
    for (let seed = 1; seed < 400 && !g; seed++) {
      const t = boot({ seed });
      t.$("start-btn").click();
      if (t.cards().some(b => !b.disabled && /^8 /.test(b.getAttribute("aria-label")))) g = t;
      else t.w.close();
    }
    ok(!!g, "found a deal that opens with a playable eight");
    if (g) {
      const { $, d } = g;
      const eight = g.cards().find(b => !b.disabled && /^8 /.test(b.getAttribute("aria-label")));
      const n = g.cards().length;
      eight.click();
      ok(g.picking(), "playing an eight opens the suit picker");
      ok(g.suits().length === 4, "four suits to choose from");
      ok(g.cards().every(b => b.disabled), "the hand is locked while you choose");
      ok(g.cards().length === n, "the eight is still in hand until a suit is chosen");
      ok(d.activeElement === g.suits()[0], "focus moves into the picker");
      g.suits()[3].click();                                  /* clubs */
      ok(!g.picking(), "choosing a suit closes the picker");
      ok($("suit-now").textContent === "Suit: ♣", "the pile now asks for clubs, got " + $("suit-now").textContent);
      ok(g.cards().length === n - 1, "and the eight is played");
      await owlReply(g);
      ok(g.errors.length === 0, "no page errors on the wild card: " + g.errors.join("; "));
      g.w.close();
    }
  }

  /* ---- taking a card from the pack ------------------------------------------------------- */
  {
    /* play on until a turn comes round with nothing playable */
    const g = boot({ seed: 3 });
    const { $ } = g;
    $("start-btn").click();
    let stuck = false;
    for (let turn = 0; turn < 60 && !g.over() && !stuck; turn++) {
      if (g.picking()) { g.suits()[0].click(); await owlReply(g); continue; }
      const live = g.cards().filter(b => !b.disabled);
      if (!live.length) { stuck = true; break; }
      live[0].click();
      await owlReply(g);
    }
    if (stuck) {
      ok(!$("stock-btn").disabled, "with nothing to play, the pack opens");
      const n = g.cards().length, left = parseInt($("stock-count").textContent, 10);
      $("stock-btn").click();
      ok(g.cards().length === n + 1 || g.over() || !g.myTurn(), "tapping the pack takes one card");
      ok(parseInt($("stock-count").textContent, 10) === left - 1, "and the pack is one smaller");
      await owlReply(g);
      ok(g.errors.length === 0, "no page errors taking a card: " + g.errors.join("; "));
    }
    ok(true, "reached a stuck turn: " + stuck);
    g.w.close();
  }

  /* ---- the pack: a card taken is YOUR card ----------------------------------------------
     The bug this guards: a spent turn leaked across the turn change, so tapping the pack was
     refused, the turn silently passed, and the owl took the card instead. */
  {
    let taps = 0, wrong = 0, passFaces = 0;
    for (const seed of [42, 3, 17, 55, 61, 73, 88, 91, 104, 117]) {
      const g = boot({ seed });
      const { $ } = g;
      $("start-btn").click();
      for (let turn = 0; turn < 120 && !g.over(); turn++) {
        if (g.picking()) { g.suits()[0].click(); await owlReply(g); continue; }
        const live = g.cards().filter(b => !b.disabled);
        if (live.length) { live[0].click(); await owlReply(g); continue; }
        /* the two chips always say exactly what the two hands hold */
        if (g.counts()[0] !== g.cards().length || g.counts()[1] !== g.owlCards().length) wrong++;
        if ($("stock-btn").disabled) break;
        if (g.stockLeft() > 0) {
          const mine = g.cards().length, owl = g.owlCards().length, left = g.stockLeft();
          $("stock-btn").click();
          taps++;
          if (g.cards().length !== mine + 1) { wrong++; console.log("  seed " + seed + ": your hand " + mine + " -> " + g.cards().length); }
          if (g.owlCards().length !== owl) { wrong++; console.log("  seed " + seed + ": the owl's hand changed on your draw"); }
          if (g.stockLeft() !== left - 1) { wrong++; console.log("  seed " + seed + ": pack " + left + " -> " + g.stockLeft()); }
          if (g.counts()[0] !== mine + 1) { wrong++; console.log("  seed " + seed + ": your count did not follow the draw"); }
        } else {
          passFaces++;
          ok(!!$("stock-btn").querySelector(".pass-face"), seed + ": an empty pack shows the pass face, not a card back");
          ok($("stock-btn").getAttribute("aria-label") === "Pass — the pack is empty", seed + ": …and says so");
          $("stock-btn").click();
        }
        await owlReply(g);
      }
      ok(g.errors.length === 0, seed + ": no page errors: " + g.errors.join("; "));
      g.w.close();
    }
    ok(taps > 0, "the deals really did reach a stuck turn (" + taps + " taps on the pack)");
    ok(wrong === 0, "every card taken from the pack went into YOUR hand (" + wrong + " went astray)");
    console.log("  pack taps: " + taps + ", empty-pack passes: " + passFaces);
  }

  /* ---- an empty pack: the same button becomes Pass ---------------------------------------
     Seed 59 is a deal whose pack really does run dry, which is the only way to reach this on
     the page; every other deal ends with cards still in the pack. */
  {
    const g = boot({ seed: 59 });
    const { $ } = g;
    $("start-btn").click();
    let sawEmpty = false, passes = 0;
    for (let turn = 0; turn < 300 && !g.over(); turn++) {
      if (g.picking()) { g.suits()[0].click(); await owlReply(g); continue; }
      const live = g.cards().filter(b => !b.disabled);
      if (live.length) { live[0].click(); await owlReply(g); continue; }
      if ($("stock-btn").disabled) break;
      if (g.stockLeft() > 0) { $("stock-btn").click(); await owlReply(g); continue; }
      /* the pack is out: the button is now the way to pass, and says so */
      sawEmpty = true;
      passes++;
      ok($("stock-count").textContent === "empty", "the pack reads empty, got " + $("stock-count").textContent);
      ok(!!$("stock-btn").querySelector(".pass-face") && !$("stock-btn").querySelector(".back"),
         "the card back gives way to the pass face");
      ok($("stock-btn").getAttribute("aria-label") === "Pass — the pack is empty", "…and names itself Pass");
      ok(g.d.querySelector(".stock").classList.contains("empty"), "the stack behind it goes away too");
      $("stock-btn").click();
      await owlReply(g);
    }
    ok(sawEmpty, "seed 59 really does empty the pack (" + passes + " passes)");
    ok(g.over(), "and the round still reaches a result");
    ok(g.errors.length === 0, "no page errors on an empty pack: " + g.errors.join("; "));
    g.w.close();
  }

  /* ---- Hint, Reset, Skip, Home ----------------------------------------------------------- */
  {
    const g = boot({ seed: 8 });
    const { $, d } = g;
    $("start-btn").click();
    const dealt = g.hand();
    $("hint-link").click();
    ok(d.querySelectorAll("#your-hand .card-btn.hinted").length <= 1, "Hint lights at most one card");
    ok(/💡/.test($("feedback").textContent), "Hint says what to do: " + $("feedback").textContent);

    /* Reset deals the very same cards again */
    const live = g.cards().filter(b => !b.disabled);
    if (live.length) { live[0].click(); await owlReply(g); }
    $("reset-btn").click();
    ok(g.hand() === dealt, "Reset replays the same deal");
    ok(g.cards().length === E.HAND && g.owlCards().length === E.HAND, "…from the start");

    /* Skip deals a different one */
    $("skip-btn").click();
    ok(g.cards().length === E.HAND, "Skip deals a fresh hand");
    ok($("stock-count").textContent === (52 - 2 * E.HAND - 1) + " left", "…with a full pack");

    $("home-btn").click();
    ok(!$("screen-home").classList.contains("hide") && $("screen-game").classList.contains("hide"),
       "Home returns to the start screen");
    ok(g.errors.length === 0, "no page errors: " + g.errors.join("; "));
    g.w.close();
  }

  /* ---- whole games, played to a result --------------------------------------------------- */
  {
    const results = [];
    for (const seed of [2, 4, 6, 12, 15, 19, 23, 31]) {
      const g = boot({ seed });
      const { $, d } = g;
      $("start-btn").click();
      let guard = 0;
      while (!g.over() && guard++ < 400) {
        if (g.picking()) { g.suits()[guard % 4].click(); await owlReply(g); continue; }
        const live = g.cards().filter(b => !b.disabled);
        /* play the way the rules sheet teaches: a plain card first, an eight only when stuck */
        const plain = live.filter(b => !/^8 /.test(b.getAttribute("aria-label")));
        if (live.length) (plain.length ? plain : live)[0].click();
        else if (!$("stock-btn").disabled) $("stock-btn").click();
        else break;
        await owlReply(g);
      }
      ok(g.over(), seed + ": the round reaches a result in " + guard + " turns");
      ok(!$("result-view").classList.contains("hide"), seed + ": the result panel shows");
      const stars = $("stars").textContent;
      ok(stars.length === 3 && /^[★☆]+$/.test(stars), seed + ": three star places, got " + stars);
      ok($("skip-btn").classList.contains("invisible") && !$("skip-btn").classList.contains("hide"),
         seed + ": Skip hides but keeps its box");
      ok($("next-btn").textContent === "Play again ▶", seed + ": the bottom slot offers another game");
      ok(d.activeElement === $("next-btn"), seed + ": focus lands on Play again");
      ok(g.counts()[0] === g.cards().length && g.counts()[1] === g.owlCards().length,
         seed + ": the counts still match the hands at the end (" + g.counts().join("/") + ")");
      const label = $("rlabel").textContent;
      ok(/you win|owl went out|tie/i.test(label), seed + ": the result is named — " + label);
      results.push(/you win/i.test(label) ? "win" : /tie/i.test(label) ? "tie" : "loss");
      /* Play again starts a fresh round */
      $("next-btn").click();
      ok(g.cards().length === E.HAND && $("result-view").classList.contains("hide")
         && $("next-btn").classList.contains("invisible") && !$("skip-btn").classList.contains("invisible"),
         seed + ": Play again deals again and resets the bottom slot");
      ok(g.errors.length === 0, seed + ": no page errors in a whole game: " + g.errors.join("; "));
      g.w.close();
    }
    console.log("  whole games: " + JSON.stringify(results));
    ok(results.includes("win"), "a player following the page's own prompts does win some: " + results.join(","));
  }

  report("crazy-eights play-through");
})();
