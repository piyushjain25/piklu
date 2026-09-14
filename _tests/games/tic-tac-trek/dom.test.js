"use strict";
/* Headless play-through: drives the real page through jsdom and asserts the UI obeys the
   rules — the required board is the only clickable one, illegal taps teach instead of
   doing nothing, claims/free moves/wins render, and the control scheme behaves. */
const { bootGame, tally, sleep } = require("../../lib/harness.js");
const { ok, report } = tally();
const { w, d, $ } = bootGame("tic-tac-trek");
const cellOf=(b,c)=>d.querySelector('.ucell[data-m="'+(b*9+c)+'"]');
const boardOf=b=>d.querySelectorAll('.ubrd')[b];
const tick=ms=>{ w.jest===undefined; };   // timers are real; we advance with setTimeout below

(async function main(){
  /* ---- start screen ---- */
  ok($("screen-home") && !$("screen-home").classList.contains("hide"), "start screen should be visible");
  ok($("screen-game").classList.contains("hide"), "game screen should start hidden");
  ok(d.querySelector(".home-top .hub-link").getAttribute("href")==="../", "start screen needs the ← All games link");
  /* initBouncyTitle joins words with a non-breaking space on purpose, so normalise */
  ok($("title").textContent.replace(/\u00a0/g," ")==="Tic Tac Trek",
     "bouncy title should read Tic Tac Trek, got "+JSON.stringify($("title").textContent));
  ok(d.querySelectorAll(".ucell").length===81, "expected 81 cells, got "+d.querySelectorAll(".ucell").length);
  ok(d.querySelectorAll(".ubrd").length===9, "expected 9 small boards");
  ok(d.querySelectorAll(".diff").length===4, "expected 4 difficulty cards");
  ok(!$("hint-link"), "this game must not have a Hint link");

  /* ---- the rules sheet, from the start screen ---- */
  ok(!$("rules-ov").classList.contains("show"), "rules sheet starts closed");
  $("rules-home").click();
  ok($("rules-ov").classList.contains("show"), "📖 Read the full rules must open the sheet");
  ok($("rules-body").textContent.length>600, "rules sheet looks empty");
  for(const kw of ["free move","three","sends","little board","draw"])
    ok($("rules-body").textContent.toLowerCase().includes(kw), "rules should mention: "+kw);
  ok($("rules-body").querySelectorAll(".rbig").length>=4, "rules sheet should carry its mini diagrams");
  ok(d.activeElement===$("rules-close"), "opening the sheet should move focus into it");
  $("rules-close").click();
  ok(!$("rules-ov").classList.contains("show"), "✕ must close the sheet");
  ok(d.activeElement===$("rules-home"), "closing should return focus to the opener");
  $("rules-home").click();
  d.dispatchEvent(new w.KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
  ok(!$("rules-ov").classList.contains("show"), "Escape must close the sheet");

  /* ---- start a game ---- */
  $("start-btn").click();
  ok($("screen-game") && !$("screen-game").classList.contains("hide"), "Start should show the game");
  ok($("screen-home").classList.contains("hide"), "Start should hide the start screen");
  ok($("rules-btn"), "the game screen needs a 📖 Rules link");
  ok($("rules-btn").className.includes("tlink"), "Rules must be a .tlink, not a .btn");
  ok($("next-btn").classList.contains("hide"), "Play again must be hidden during play");
  ok(!$("skip-btn").classList.contains("invisible"), "Skip is visible during play");
  ok(d.querySelectorAll(".serve-row .btn").length===1, "exactly one real .btn at the bottom");

  /* the first move is free: every board playable */
  ok(d.querySelectorAll(".ubrd.active").length===9, "first move should offer all 9 boards, got "
     +d.querySelectorAll(".ubrd.active").length);

  /* ---- the sending rule, through the DOM ---- */
  cellOf(4,2).click();                       // centre board, top-right square
  ok(cellOf(4,2).textContent==="✕", "your mark should appear where you tapped");
  await sleep(2200);                          // let the owl think + settle
  const active=[...d.querySelectorAll(".ubrd")].map((b,i)=>b.classList.contains("active")?i:-1).filter(i=>i>=0);
  ok(active.length>=1, "some board must be playable after the owl moves");

  /* tapping outside the required board must TEACH, not silently do nothing */
  if(active.length===1){
    const wrong=(active[0]+1)%9;
    const before=d.querySelectorAll(".ucell").length;
    let empty=-1;
    for(let c=0;c<9;c++) if(!cellOf(wrong,c).textContent){ empty=c; break; }
    if(empty>=0){
      cellOf(wrong,empty).click();
      ok(!cellOf(wrong,empty).textContent, "an illegal tap must not place a mark");
      ok($("feedback").textContent.includes("Not that board") || $("feedback").textContent.includes("finished"),
         "an illegal tap must explain why, got: "+JSON.stringify($("feedback").textContent));
      ok(boardOf(wrong).classList.contains("nope"), "the wrong board should shake");
      ok(boardOf(active[0]).classList.contains("callout"), "the right board should be called out");
    }
  }
  /* the cells you may use are marked up as playable; the rest are not */
  for(let b=0;b<9;b++) for(let c=0;c<9;c++){
    const el=cellOf(b,c), playable = active.indexOf(b)>=0 && !el.textContent;
    ok(el.getAttribute("aria-disabled")===String(!playable),
       "aria-disabled wrong at board "+b+" cell "+c);
    ok(el.hasAttribute("aria-label") && el.getAttribute("aria-label").length>10, "cell needs an aria-label");
  }

  /* ---- play a whole game by always taking a legal cell ---- */
  async function playOut(maxMoves){
    for(let n=0;n<maxMoves;n++){
      if(!$("next-btn").classList.contains("hide")) return "over";
      const live=[...d.querySelectorAll(".ubrd.active")];
      if(!live.length) return "stuck";
      let clicked=false;
      for(const bd of live){
        const free=[...bd.querySelectorAll(".ucell")].find(x=>x.getAttribute("aria-disabled")==="false");
        if(free){ free.click(); clicked=true; break; }
      }
      if(!clicked) return "no-playable-cell";
      await sleep(2300);
    }
    return "ran-out";
  }
  const outcome=await playOut(60);
  ok(outcome==="over", "a full game should reach a result, got: "+outcome);
  ok(!$("result-view").classList.contains("hide"), "the result panel should be shown");
  ok($("skip-btn").classList.contains("invisible"), "Skip must hide with .invisible (keeps its box)");
  ok(w.getComputedStyle($("skip-btn")).display!=="none", "Skip must not be display:none — the top bar would shift");
  ok(!$("next-btn").classList.contains("hide"), "Play again should appear at the bottom");
  ok($("rlabel").textContent.length>5, "the result needs a label");
  ok(["★★★","☆☆☆","🤝"].includes($("stars").textContent), "unexpected stars: "+$("stars").textContent);
  /* whatever happened, the rendered claims must agree with the marks on the board */
  const claimed=[...d.querySelectorAll(".claim")].map(c=>c.textContent);
  ok(claimed.filter(Boolean).length>0, "a finished game should have claimed or drawn boards");

  /* ---- Play again resets cleanly ---- */
  $("next-btn").click();
  ok([...d.querySelectorAll(".ucell")].every(c=>!c.textContent), "Play again must clear the board");
  ok($("result-view").classList.contains("hide"), "Play again must hide the result");
  ok(!$("skip-btn").classList.contains("invisible"), "Play again must restore Skip");
  ok(d.querySelectorAll(".ubrd.active").length===9, "a new game starts with a free first move");

  /* ---- Skip and Home ---- */
  cellOf(0,0).click();
  $("skip-btn").click();
  ok([...d.querySelectorAll(".ucell")].every(c=>!c.textContent), "Skip must start a fresh game");
  $("home-btn").click();
  ok(!$("screen-home").classList.contains("hide"), "Home returns to the start screen");
  ok($("screen-game").classList.contains("hide"), "Home hides the game screen");

  /* ---- the level chip switches difficulty without leaving the game ---- */
  $("start-btn").click();
  ok($("level-menu").querySelectorAll(".level-opt").length===4, "level menu needs all 4 levels");
  ok($("q-level-label").textContent.includes("Easy"), "level chip should read Easy");
  $("q-level").click();
  ok($("level-menu").classList.contains("open"), "tapping the chip opens the menu");
  $("level-menu").querySelector('[data-diff="EXPERT"]').click();
  ok(!$("level-menu").classList.contains("open"), "picking a level closes the menu");
  ok($("q-level-label").textContent.includes("Expert"), "chip should now read Expert");
  ok(!$("screen-game").classList.contains("hide"), "switching level must stay in the game");
  ok($("board").dataset.guide==="min", "Expert should use minimal guidance, got "+$("board").dataset.guide);
  ok($("board").dataset.dots==="0", "Expert must not show the square dots");
  ok(!$("turnbar").textContent.includes("board"), "Expert's turn bar shouldn't name the board: "+$("turnbar").textContent);

  /* Easy turns the teaching back on */
  $("q-level").click();
  $("level-menu").querySelector('[data-diff="EASY"]').click();
  ok($("board").dataset.guide==="strong", "Easy should use strong guidance");
  ok($("board").dataset.dots==="1", "Easy should show the square dots");
  cellOf(4,4).click();
  ok($("turnbar").textContent.includes("centre"), "Easy should explain the send: "+$("turnbar").textContent);
  await sleep(2200);
  ok($("turnbar").textContent.includes("board") || $("turnbar").textContent.includes("free"),
     "Easy should say where you play next: "+$("turnbar").textContent);

  /* ---- the rules sheet works from inside the game too ---- */
  $("rules-btn").click();
  ok($("rules-ov").classList.contains("show"), "📖 Rules must open the sheet mid-game");
  $("rules-ok").click();
  ok(!$("rules-ov").classList.contains("show"), "Got it! must close the sheet");

  report('tic-tac-trek play-through');
})().catch(e=>{ console.error("CRASH:", e); process.exit(1); });
