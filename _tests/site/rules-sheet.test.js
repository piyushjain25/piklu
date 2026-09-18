"use strict";
/* The shared rules sheet, exercised in every game that uses it. Checks the standard markup
   is present, that both entry points open it, that the copy is real, that it closes by
   button / backdrop / Escape, and that focus goes in and comes back. */
const fs=require("fs"), path=require("path");
const { ROOT, read, gameHTML, inlineScript, bootGame, tally } = require("../lib/harness.js");
const { ok, report } = tally();

/* the games whose rules need more room than the start screen's .howto block */
const GAMES=["tic-tac-toe","mystery-word","matchstick-math","lights-out","spot-the-words","juice-jumble","dino-dig","mirror-draw","tally-chart","balance-scales"];
const siteJS=read("assets/site.js");
const siteCSS=read("assets/site.css");

/* the sheet chrome must live in site.css, never copy-pasted into a game */
for(const cls of [".sheet-ov",".sheet{",".sheet-top",".sheet-x",".sheet-body",".sheet-foot",".rule{",".rrow",".rarrow",".rsolo"])
  ok(siteCSS.includes(cls), "site.css should define "+cls);
for(const fn of ["function wireRulesSheet","function openRulesSheet","function closeRulesSheet","function rulesSheetOpen"])
  ok(siteJS.includes(fn), "site.js should define "+fn);

for(const slug of GAMES){
  const html=gameHTML(slug);

  /* no game may re-declare the shared helpers (that throws a SyntaxError at load) */
  const inline=inlineScript(html);
  for(const n of ["wireRulesSheet","openRulesSheet","closeRulesSheet","rulesSheetOpen","rulesBuilt","rulesOpener","rulesBody"])
    ok(!new RegExp("(?:^|\\n)\\s*(?:const|let|var|function)\\s+"+n+"\\b").test(inline),
       slug+" must not redeclare the shared "+n);
  ok(!/\.sheet-ov\s*\{/.test(html), slug+" must not restyle .sheet-ov inline");

  const { w, d, $ } = bootGame(slug);

  /* the standard markup */
  for(const id of ["rules-ov","rules-body","rules-close","rules-ok","rules-home","rules-btn"])
    ok(!!$(id), slug+": missing #"+id);
  ok($("rules-ov").classList.contains("sheet-ov"), slug+": overlay should use the shared .sheet-ov");
  ok($("rules-ov").getAttribute("role")==="dialog" && $("rules-ov").getAttribute("aria-modal")==="true",
     slug+": the sheet should be a modal dialog");
  ok($("rules-ov").getAttribute("aria-labelledby")==="rules-h" && !!$("rules-h"),
     slug+": the dialog needs a labelled heading");
  /* both entry points are text links, never buttons */
  ok($("rules-home").className.includes("tlink"), slug+": start-screen rules link should be a .tlink");
  ok($("rules-btn").className.includes("tlink"), slug+": in-game Rules should be a .tlink");
  ok($("rules-btn").closest(".actions"), slug+": in-game Rules belongs in the .actions row");

  /* body is built lazily, on first open */
  ok($("rules-body").innerHTML.trim()==="", slug+": rules body should be empty until first opened");
  $("rules-home").click();
  ok($("rules-ov").classList.contains("show"), slug+": start-screen link should open the sheet");
  const text=$("rules-body").textContent;
  ok(text.length>500, slug+": rules copy looks thin ("+text.length+" chars)");
  ok($("rules-body").querySelectorAll(".rule").length>=4, slug+": expected several rule sections");
  ok(/how|play|win|guess|move|board/i.test(text), slug+": rules copy should actually explain the game");
  ok(d.activeElement===$("rules-close"), slug+": focus should move into the sheet");

  /* close paths */
  $("rules-close").click();
  ok(!$("rules-ov").classList.contains("show"), slug+": ✕ should close");
  ok(d.activeElement===$("rules-home"), slug+": focus should return to the opener");

  $("rules-btn").click();
  ok($("rules-ov").classList.contains("show"), slug+": in-game Rules should open the sheet");
  d.dispatchEvent(new w.KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
  ok(!$("rules-ov").classList.contains("show"), slug+": Escape should close");

  $("rules-btn").click();
  $("rules-ov").dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
  ok(!$("rules-ov").classList.contains("show"), slug+": a backdrop click should close");

  $("rules-btn").click();
  $("rules-ok").click();
  ok(!$("rules-ov").classList.contains("show"), slug+": 'Got it!' should close");

  /* rebuilt only once */
  const before=$("rules-body").innerHTML.length;
  $("rules-btn").click(); $("rules-ok").click();
  ok($("rules-body").innerHTML.length===before, slug+": body should not be rebuilt on reopen");

  console.log("  "+slug.padEnd(16)+" sheet ok — "+text.length+" chars, "
    +$("rules-body").querySelectorAll(".rule").length+" sections");
}
report("shared rules sheet ("+GAMES.length+" games)");
