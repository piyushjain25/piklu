"use strict";
/* crazy-eights engine: the rules checked against an independent oracle, the card count held
   to exactly one deck across thousands of random games, every round proved to finish, and the
   owl proved to play legally and to keep its eights back. */
const { loadEngine, mulberry32, tally, stress } = require("../../lib/harness.js");
const E = loadEngine("crazy-eights");
const { ok, report } = tally();
const { SUITS, RANKS, EIGHT, HAND, YOU, OWL, suitOf, rankOf, isEight } = E;

/* ---- independent oracles (written from the rules, not copied from the engine) ----------- */
/* Wikipedia's rule: match the suit in force, or the rank of the top card; an 8 plays on
   anything. Written out the long way so it cannot share a bug with the engine's one-liner. */
function oraclePlayable(c, top, suit) {
  if (RANKS[rankOf(c)] === "8") return true;
  if (SUITS[suitOf(c)] === SUITS[suit]) return true;
  return RANKS[rankOf(c)] === RANKS[rankOf(top)];
}
/* every card in play, counted: two hands + the pile + the pack must always be one whole deck */
function census(s) {
  const all = s.hands[YOU].concat(s.hands[OWL], s.pile, s.stock);
  return { n: all.length, unique: new Set(all).size, min: Math.min(...all), max: Math.max(...all) };
}
const wholeDeck = s => { const c = census(s); return c.n === 52 && c.unique === 52 && c.min === 0 && c.max === 51; };

/* ---- 1. the deck and the deal ------------------------------------------------------------ */
ok(SUITS.length === 4 && RANKS.length === 13, "four suits of thirteen");
ok(RANKS[EIGHT] === "8", "EIGHT points at the 8, got " + RANKS[EIGHT]);
ok(HAND === 7, "a two-player deal is seven cards each");
{
  let bad = 0;
  for (let t = 0; t < stress(500); t++) {
    const rng = mulberry32(t + 1);
    const d = E.shuffled(rng);
    if (d.length !== 52 || new Set(d).size !== 52) bad++;
    const s = E.dealFrom(d);
    if (s.hands[YOU].length !== HAND || s.hands[OWL].length !== HAND) bad++;
    if (s.stock.length !== 52 - 2 * HAND - 1) bad++;
    if (isEight(s.top)) bad++;                       /* a round never opens on a wild card */
    if (s.suit !== suitOf(s.top) || s.turn !== YOU || E.isOver(s)) bad++;
    if (s.pile.length !== 1 || s.pile[0] !== s.top) bad++;
    if (!wholeDeck(s)) bad++;
  }
  ok(bad === 0, "every deal is one whole deck, seven each, never starting on an eight (" + bad + " bad)");
}
/* the same deck always deals the same game — that is what Reset replays */
{
  const d = E.shuffled(mulberry32(7));
  const a = E.dealFrom(d), b = E.dealFrom(d);
  ok(JSON.stringify(a.hands) === JSON.stringify(b.hands) && a.top === b.top,
     "dealing the same deck twice gives the same game");
  ok(JSON.stringify(a.deck) === JSON.stringify(d), "the state keeps the deck it was dealt from");
}

/* ---- 2. what may be played, against the oracle -------------------------------------------- */
{
  let bad = 0, yes = 0;
  for (let c = 0; c < 52; c++) for (let top = 0; top < 52; top++) for (let suit = 0; suit < 4; suit++) {
    const want = oraclePlayable(c, top, suit);
    if (E.playable(c, top, suit) !== want) bad++;
    if (want) yes++;
  }
  ok(bad === 0, "playable() matches the oracle on all 52×52×4 combinations (" + bad + " wrong)");
  ok(yes > 0, "and some of them really are playable (" + yes + ")");
  ok([0, 1, 2, 3].every(t => E.playable(t * 13 + EIGHT, 0, 3)), "every eight plays on anything");
}

/* ---- 3. laying a card --------------------------------------------------------------------- */
{
  const s = E.dealFrom(E.shuffled(mulberry32(3)));
  const notMine = [...Array(52).keys()].find(c => !s.hands[YOU].includes(c));
  ok(E.playCard(s, notMine) === null || s.hands[YOU].includes(notMine), "a card you don't hold can't be played");
  const bad = s.hands[YOU].find(c => !E.playable(c, s.top, s.suit));
  if (bad !== undefined) ok(E.playCard(s, bad) === null, "a card that doesn't match is refused");
  const good = E.myPlayable(s)[0];
  if (good !== undefined) {
    const n = E.playCard(s, good);
    ok(n && n.hands[YOU].length === HAND - 1, "playing sheds exactly one card");
    ok(n.top === good && n.pile[n.pile.length - 1] === good && wholeDeck(n),
       "the card is now the top of the pile, and the deck is still whole");
    ok(n.turn === OWL, "the turn passes");
    if (!isEight(good)) ok(n.suit === suitOf(good), "a plain card sets the suit to its own");
  }
}
/* an eight takes the suit its player asks for */
{
  const s = E.dealFrom(E.shuffled(mulberry32(11)));
  const eight = s.hands[YOU].find(isEight) !== undefined ? s.hands[YOU].find(isEight) : null;
  const t = eight === null ? Object.assign({}, s, { hands: [[1 * 13 + EIGHT, 5], s.hands[OWL]] }) : s;
  const card = eight === null ? 1 * 13 + EIGHT : eight;
  for (let ask = 0; ask < 4; ask++) {
    const n = E.playCard(t, card, ask);
    ok(n && n.suit === ask, "an eight sets the suit the player asked for (" + SUITS[ask] + ")");
  }
  const d = E.playCard(t, card);
  ok(d && d.suit === suitOf(card), "an eight with no suit named keeps its own");
}
/* the last card ends it */
{
  const base = E.dealFrom(E.shuffled(mulberry32(5)));
  const one = Object.assign({}, base, { hands: [[suitOf(base.top) * 13 + rankOf(base.top)], base.hands[OWL]] });
  const n = E.playCard(one, one.hands[YOU][0]);
  ok(n && n.winner === YOU && E.isOver(n), "playing your last card wins");
  ok(E.playCard(n, n.hands[OWL][0]) === null, "no move once the round is over");
}

/* ---- 4. taking a card and passing --------------------------------------------------------- */
{
  const s = E.dealFrom(E.shuffled(mulberry32(9)));
  if (E.myPlayable(s).length) ok(E.drawCard(s) === null, "you can't take a card while you hold one you can play");
  /* a hand with nothing playable: build one from cards that match neither suit nor rank */
  const top = 0 * 13 + 4;                            /* 5♠ */
  const dead = [1 * 13 + 2, 2 * 13 + 9, 3 * 13 + 11].filter(c => !E.playable(c, top, 0));
  const stuck = Object.assign({}, s, { hands: [dead, s.hands[OWL]], top, suit: 0, drew: false });
  ok(E.myPlayable(stuck).length === 0, "the fixture really is stuck");
  const drawn = E.drawCard(stuck);
  ok(drawn && drawn.hands[YOU].length === dead.length + 1 && drawn.stock.length === stuck.stock.length - 1,
     "taking a card moves exactly one card from the pack to your hand");
  const kept = E.playable(drawn.last.card, stuck.top, stuck.suit);
  ok(drawn.turn === (kept ? YOU : OWL), "you keep the turn only if the card you took can be played");
  ok(drawn.drew === kept, "the spent turn is remembered only while it is still that player's turn");
  if (kept) ok(E.drawCard(drawn) === null, "you can only take one card per turn");
  /* an empty pack: nothing to take, so the only move is to pass */
  const empty = Object.assign({}, stuck, { stock: [] });
  ok(E.drawCard(empty) === null && E.stuckMove(empty) === "pass", "with an empty pack the move is a pass");
  const p1 = E.passTurn(empty);
  ok(p1 && p1.passes === 1 && !E.isOver(p1), "one pass does not end the round");
}
/* The bug this guards: `drew` used to survive the turn change, so the player who came next
   inherited a spent turn — their tap on the pack was refused, they silently passed, and the
   card they were owed went to the other side on its turn instead. */
{
  const s = E.dealFrom(E.shuffled(mulberry32(17)));
  const top = 0 * 13 + 4;                              /* 5♠ */
  const dead = p => Object.assign({}, s, { top, suit: 0, drew: false, turn: p,
    hands: p === YOU ? [[1 * 13 + 2], [2 * 13 + 9]] : [[2 * 13 + 9], [1 * 13 + 2]] });
  for (const who of [YOU, OWL]) {
    let st = dead(who);
    ok(E.myPlayable(st).length === 0, "the stuck fixture has no play for " + who);
    /* keep taking until one of them is handed on, then the NEXT player must be able to take one */
    let guard = 0;
    while (st.turn === who && guard++ < 40) {
      const n = E.drawCard(st);
      if (!n) break;
      st = n;
      if (E.myPlayable(st).length) break;              /* they drew something playable */
    }
    if (st.turn !== who) {
      ok(st.drew === false, "the player who inherits the turn has not spent it");
      const theirs = st.hands[st.turn].length;
      const n = E.myPlayable(st).length ? null : E.drawCard(st);
      if (n) {
        ok(n.hands[st.turn].length === theirs + 1, "and the card they take is added to THEIR hand");
        ok(n.stock.length === st.stock.length - 1, "…straight off the pack");
      } else ok(E.myPlayable(st).length > 0, "…or they had something to play all along");
    } else ok(true, "that side drew a playable card and kept the turn");
  }
}
/* two passes in a row end it, and the smaller hand wins */
{
  const s = E.dealFrom(E.shuffled(mulberry32(13)));
  const top = 0 * 13 + 4;
  const mk = (mine, theirs) => Object.assign({}, s, { stock: [], top, suit: 0, drew: false, passes: 1,
    hands: [mine, theirs], turn: YOU });
  const few = [1 * 13 + 2], many = [1 * 13 + 3, 2 * 13 + 9];
  ok(E.myPlayable(mk(few, many)).length === 0, "the stuck fixture has no play");
  const a = E.passTurn(mk(few, many));
  ok(a && a.winner === YOU && !a.tie, "the second pass ends it — fewer cards wins");
  const b = E.passTurn(mk(many, few));
  ok(b && b.winner === OWL, "…for whoever holds fewer, not whoever passed");
  const c = E.passTurn(mk(few, [2 * 13 + 9]));
  ok(c && c.tie && c.winner === -1, "equal hands are a tie");
  ok(E.passTurn(Object.assign({}, s, { drew: false })) === null, "you can't pass while the pack still has cards");
  ok(E.passTurn(Object.assign({}, s, { drew: true })) === null, "…not even on a turn that already took one");
}

/* ---- 5. whole random games: legal, one deck throughout, and always finished --------------- */
{
  const rng = mulberry32(404);
  let bad = 0, wins = [0, 0], ties = 0, longest = 0, draws = 0, passes = 0;
  for (let g = 0; g < stress(1500); g++) {
    let s = E.newGame(rng), guard = 0;
    while (!E.isOver(s) && guard++ < 600) {
      const before = s.turn;
      const can = E.myPlayable(s);
      /* a random legal move: a card if there is one, else take/pass — exactly the rules */
      let n;
      if (can.length) {
        const c = can[Math.floor(rng() * can.length)];
        n = E.playCard(s, c, Math.floor(rng() * 4));
      } else if (E.stuckMove(s) === "draw") { n = E.drawCard(s); draws++; }
      else { n = E.passTurn(s); passes++; }
      if (!n) { bad++; console.log("  no move from", { turn: before, can: can.length, stock: s.stock.length }); break; }
      if (!wholeDeck(n)) { bad++; console.log("  card count broke"); break; }
      /* a card taken from the pack joins the hand of whoever took it, and nobody else's */
      if (n.last.kind === "draw") {
        const mover = n.last.by, other = 1 - mover;
        if (n.hands[mover].length !== s.hands[mover].length + 1) { bad++; console.log("  draw missed its own hand"); break; }
        if (n.hands[other].length !== s.hands[other].length) { bad++; console.log("  draw touched the other hand"); break; }
        if (!n.hands[mover].includes(n.last.card)) { bad++; break; }
        if (n.turn === mover ? !n.drew : n.drew) { bad++; console.log("  drew flag outlived the turn"); break; }
      }
      if (n.moves !== s.moves + 1) { bad++; break; }
      /* the pile's suit is always a real suit, and only an eight can change it off-card */
      if (n.suit < 0 || n.suit > 3) { bad++; break; }
      if (n.last.kind === "play" && !isEight(n.last.card) && n.suit !== suitOf(n.top)) { bad++; break; }
      s = n;
    }
    if (!E.isOver(s)) { bad++; console.log("  game " + g + " never finished"); }
    longest = Math.max(longest, s.moves);
    if (s.tie) ties++; else if (s.winner >= 0) wins[s.winner]++;
    /* the winner really is out of cards (or the round ended on two passes) */
    if (s.winner >= 0 && s.hands[s.winner].length > 0 && s.passes < 2) bad++;
  }
  ok(bad === 0, bad + " random games broke a rule");
  ok(ties + wins[0] + wins[1] === stress(1500), "every game reached a result");
  ok(draws > 0 && passes > 0, "the random games really do take cards and pass (" + draws + " / " + passes + ")");
  console.log("  " + stress(1500) + " random games — you " + wins[0] + ", owl " + wins[1] + ", ties " + ties
              + "; longest " + longest + " moves");
  ok(longest < 600, "no game runs away (longest " + longest + " moves)");
}

/* ---- 6. the owl -------------------------------------------------------------------------- */
{
  const rng = mulberry32(606);
  let illegal = 0, wasted = 0, badSuit = 0, eights = 0, plays = 0;
  for (let g = 0; g < stress(400); g++) {
    let s = E.newGame(rng), guard = 0;
    while (!E.isOver(s) && guard++ < 600) {
      const ch = E.owlChoice(s, rng);
      const hand = s.hands[s.turn], can = E.myPlayable(s);
      if (ch.kind === "play") {
        plays++;
        if (!hand.includes(ch.card) || !E.playable(ch.card, s.top, s.suit)) illegal++;
        /* an eight is the card to keep back: never spend one while a plain card would do */
        if (isEight(ch.card)) {
          eights++;
          if (can.some(c => !isEight(c))) wasted++;
          /* and it asks for the suit it holds most of, counting the rest of its hand */
          const rest = hand.filter(c => c !== ch.card);
          const most = Math.max(...[0, 1, 2, 3].map(t => rest.filter(c => suitOf(c) === t).length));
          if (rest.filter(c => suitOf(c) === ch.suit).length !== most) badSuit++;
        }
      } else if (ch.kind === "draw") {
        if (can.length || !s.stock.length) illegal++;
      } else if (can.length || (s.stock.length && !s.drew)) illegal++;
      const n = E.applyChoice(s, ch);
      if (!n) { illegal++; break; }
      s = n;
    }
    if (!E.isOver(s)) illegal++;
  }
  ok(illegal === 0, "the owl always makes a legal move and every game ends (" + illegal + " off)");
  ok(wasted === 0, "the owl never spends an eight while a plain card would do (" + wasted + " wasted)");
  ok(badSuit === 0, "when it does play an eight it asks for its own best suit (" + badSuit + " off)");
  ok(eights > 0 && plays > 0, "the owl really does reach eights (" + eights + " of " + plays + " plays)");
}
/* the Hint is a legal move for whoever is to move */
{
  const rng = mulberry32(707);
  let bad = 0, kinds = { play: 0, draw: 0, pass: 0 };
  for (let g = 0; g < stress(300); g++) {
    let s = E.newGame(rng), guard = 0;
    while (!E.isOver(s) && guard++ < 600) {
      if (s.turn === YOU) {
        const ch = E.hintChoice(s, rng);
        kinds[ch.kind]++;
        if (ch.kind === "play" && !E.playable(ch.card, s.top, s.suit)) bad++;
        if (ch.kind !== "play" && E.myPlayable(s).length) bad++;
        const n = E.applyChoice(s, ch);
        if (!n) { bad++; break; }
        s = n;
      } else {
        const n = E.applyChoice(s, E.owlChoice(s, rng));
        if (!n) { bad++; break; }
        s = n;
      }
    }
  }
  ok(bad === 0, "the Hint always names a move the rules allow (" + bad + " off)");
  ok(kinds.play > 0 && kinds.draw > 0, "the Hint covers both playing and taking a card: " + JSON.stringify(kinds));
}

/* ---- 7. stars ----------------------------------------------------------------------------- */
ok(E.starsFor(YOU, 0) === 3 && E.starsFor(YOU, 1) === 2 && E.starsFor(YOU, 2) === 1 && E.starsFor(YOU, 9) === 1,
   "a win is three stars minus a star per hint, never below one");
ok(E.starsFor(OWL, 0) === 0, "a loss earns nothing");
ok(E.starsFor(-1, 0) === 1, "a tie earns one star");

report("crazy-eights engine");
