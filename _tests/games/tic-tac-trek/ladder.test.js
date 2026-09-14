"use strict";
const { loadEngine, mulberry32, tally } = require("../../lib/harness.js");
const { ok: OK, report } = tally();
/* the engine is sliced out of the real games/tic-tac-trek/index.html at run time — this suite
   never holds its own copy, so a pass is a statement about the file the site ships */
const E = loadEngine("tic-tac-trek");

function mulberry(a){ return function(){ a|=0; a=a+0x6D2B79F5|0;
  let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t;
  return ((t^t>>>14)>>>0)/4294967296; }; }
function kidMove(s, rand){
  const ms=E.legalMoves(s), me=s.turn, opp=me==='X'?'O':'X';
  const claims=[], blocks=[];
  for(const m of ms){ const b=Math.floor(m/9);
    const t=s.cells.slice(); t[m]=me;  if(E.lineInBoard(t,b,me)) claims.push(m);
    const u=s.cells.slice(); u[m]=opp; if(E.lineInBoard(u,b,opp)) blocks.push(m); }
  const pool = claims.length?claims : blocks.length?blocks : ms;
  return pool[Math.floor(rand()*pool.length)];
}
let fails=0;
const ok=(c,m)=>{ OK(c,m); if(!c) fails++; };
const kidWin={};
console.log("kid (X) vs owl — difficulty must fall monotonically");
for(const lv of ["EASY","MEDIUM","HARD","EXPERT"]){
  const n = lv==="EXPERT" ? 150 : 400;
  let w=0,l=0,t=0,worst=0;
  for(let g=0;g<n;g++){
    const rand=mulberry(g*7919+13);
    let s=E.newGame(lv), guard=0;
    while(!s.over && guard++<200){
      if(s.turn==='X') s=E.applyMove(s, kidMove(s,rand));
      else { const t0=Date.now(); const m=E.aiMove(s,rand); worst=Math.max(worst,Date.now()-t0); s=E.applyMove(s,m); }
    }
    if(s.result==='X') w++; else if(s.result==='O') l++; else t++;
  }
  kidWin[lv]=100*w/n;
  console.log(`  ${lv.padEnd(7)} kid ${(100*w/n).toFixed(1)}%  owl ${(100*l/n).toFixed(1)}%  tie ${(100*t/n).toFixed(1)}%   worst owl move ${worst} ms`);
}
ok(kidWin.EASY>kidWin.MEDIUM && kidWin.MEDIUM>kidWin.HARD && kidWin.HARD>=kidWin.EXPERT,
   "difficulty must fall monotonically, got "+JSON.stringify(kidWin));

console.log("\nowl vs owl — the stronger level must win the head-to-head (sides swapped)");
function aiVsAi(a,b,seed){
  const rand=mulberry(seed); let s=E.newGame("EASY"), guard=0;
  while(!s.over && guard++<200) s=E.applyMove(s, E.aiMove(s, rand, s.turn==='X'?E.LEVELS[a]:E.LEVELS[b]));
  return s.result;
}
for(const [a,b,n] of [["MEDIUM","EASY",100],["HARD","MEDIUM",100],["EXPERT","HARD",40]]){
  let strong=0, weak=0, tie=0;
  for(let g=0;g<n;g++){
    let r=aiVsAi(a,b,g*104729+5); if(r==='X') strong++; else if(r==='O') weak++; else tie++;
    r=aiVsAi(b,a,g*104729+6);     if(r==='O') strong++; else if(r==='X') weak++; else tie++;
  }
  const tot=2*n;
  console.log(`  ${a} vs ${b}: ${a} ${(100*strong/tot).toFixed(0)}%  ${b} ${(100*weak/tot).toFixed(0)}%  tie ${(100*tie/tot).toFixed(0)}%`);
  ok(strong>weak, `${a} should beat ${b} head-to-head (${strong} vs ${weak})`);
}

/* the teaching helper the Easy level draws its ⭐/⚠ flags from */
console.log("\nbigChances: a flagged board must actually be a winning claim");
{
  let checked=0;
  for(let g=0; g<400; g++){
    const rand=mulberry(g+500);
    let s=E.newGame("EASY"), guard=0;
    while(!s.over && guard++<200){
      for(const p of ['X','O']) for(const b of E.bigChances(s,p)){
        checked++;
        if(!E.boardOpen(s,b)){ ok(false, "flagged a closed board"); }
        // claiming b really would complete a big line for p
        const w=s.won.slice(); w[b]=p;
        if(!E.bigLine(w,p)){ ok(false, "flagged board does not win"); }
      }
      const ms=E.legalMoves(s); s=E.applyMove(s, ms[Math.floor(rand()*ms.length)]);
    }
  }
  console.log(`  checked ${checked} flagged boards`);
  ok(checked>0, "bigChances never fired");
}
report("tic-tac-trek difficulty ladder");
