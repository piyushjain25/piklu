"use strict";
/* Second play-through, this time with prefers-reduced-motion ON (which also makes the
   beats instant, so full games at all four levels finish quickly). Asserts every level is
   actually winnable/finishable through the UI and that the per-level assistance differs. */
const { bootGame, tally, sleep } = require("../../lib/harness.js");
const { ok, report } = tally();
/* reduced motion ON: it also makes the owl's beats instant, so full games at all four
   levels finish quickly */
const { w, d, $ } = bootGame("tic-tac-trek", { reducedMotion: true });
/* the owl moves on timers, so wait for control to come back rather than guessing a delay */
async function waitForTurn(){
  for(let i=0;i<200;i++){
    if(!$("next-btn").classList.contains("hide")) return "over";
    if(d.querySelector('.ucell[aria-disabled="false"]')) return "yours";
    await sleep(20);
  }
  return "timeout";
}

(async function(){
  ok(w.matchMedia("(prefers-reduced-motion: reduce)").matches, "test should run with reduced motion on");

  const GUIDE={EASY:"strong", MEDIUM:"medium", HARD:"light", EXPERT:"min"};
  const DOTS ={EASY:"1", MEDIUM:"1", HARD:"0", EXPERT:"0"};
  const tally={};

  for(const lv of ["EASY","MEDIUM","HARD","EXPERT"]){
    d.querySelector('.diff[data-diff="'+lv+'"]').click();
    ok($("q-level-label").textContent===({EASY:"🌱 Easy",MEDIUM:"⭐ Medium",HARD:"🔥 Hard",EXPERT:"🏆 Expert"})[lv],
       lv+": chip label wrong");
    tally[lv]={X:0,O:0,tie:0};

    for(let game=0; game<3; game++){
      $("start-btn").click();
      ok($("board").dataset.guide===GUIDE[lv], lv+": guide should be "+GUIDE[lv]+", got "+$("board").dataset.guide);
      ok($("board").dataset.dots===DOTS[lv], lv+": dots should be "+DOTS[lv]);
      ok(d.querySelectorAll(".ubrd.active").length===9, lv+": first move should be free");
      /* Easy is the only level that flags a board that decides the big board */
      if(lv!=="EASY") ok([...d.querySelectorAll(".bflag")].every(f=>!f.textContent),
         lv+" must not show the ⭐/⚠️ big-board flags");

      let moves=0, done=false;
      while(moves++ < 90){
        const who=await waitForTurn();
        ok(who!=="timeout", lv+": the owl never handed the turn back");
        if(who!=="yours"){ done=(who==="over"); break; }
        const live=[...d.querySelectorAll(".ubrd.active")];
        ok(live.length>0, lv+": no playable board mid-game");
        if(!live.length) break;
        /* also re-assert the core rule every single turn: exactly the playable boards
           expose playable cells, and no claimed board ever does */
        for(const bd of d.querySelectorAll(".ubrd")){
          const playableCells=[...bd.querySelectorAll(".ucell")].filter(c=>c.getAttribute("aria-disabled")==="false");
          const isLive=bd.classList.contains("active");
          if(!isLive) ok(playableCells.length===0, lv+": a non-highlighted board offered a playable cell");
          if(bd.classList.contains("claimed")) ok(playableCells.length===0, lv+": a claimed board offered a playable cell");
        }
        const pick=[...live[Math.floor(Math.random()*live.length)].querySelectorAll(".ucell")]
                    .filter(c=>c.getAttribute("aria-disabled")==="false");
        ok(pick.length>0, lv+": highlighted board had no playable cell");
        if(!pick.length) break;
        pick[Math.floor(Math.random()*pick.length)].click();
      }
      ok(done, lv+": game "+game+" never finished (played "+moves+" moves)");
      if(done){
        const st=$("stars").textContent;
        tally[lv][st==="★★★"?"X":st==="☆☆☆"?"O":"tie"]++;
        ok($("skip-btn").classList.contains("invisible"), lv+": Skip must hide on a finished game");
        ok(d.querySelectorAll(".serve-row .btn:not(.hide)").length===1, lv+": exactly one live bottom button");
        /* the big-board picture must agree with the small boards */
        const claims=[...d.querySelectorAll(".claim")];
        claims.forEach((c,b)=>{
          if(c.classList.contains("x")||c.classList.contains("o")||c.classList.contains("d"))
            ok(d.querySelectorAll(".ubrd")[b].classList.contains("claimed"), lv+": claim without .claimed on board "+b);
        });
        if($("stars").textContent==="★★★")
          ok(d.querySelectorAll(".ubrd.bigwin").length===3, lv+": a win should mark 3 boards, got "
             +d.querySelectorAll(".ubrd.bigwin").length);
      }
      $("home-btn").click();
      ok(!$("screen-home").classList.contains("hide"), lv+": Home should return to the start screen");
    }
    console.log("  "+lv.padEnd(7)+" 3 random games -> you "+tally[lv].X+" / owl "+tally[lv].O+" / tie "+tally[lv].tie);
  }

  report('tic-tac-trek per-level play-through');
})().catch(e=>{ console.error("CRASH:", e); process.exit(1); });
