"use strict";
/* The structural rules in CLAUDE.md, enforced across every game in the catalog. These are the
   rules that are easy to break by copy-paste and invisible until something breaks at run time:
   redeclaring a shared helper throws a SyntaxError on load, re-styling a shared class silently
   forks the design system, and a stray network call breaks the ad-free/offline promise. */
const fs = require("fs"), path = require("path");
const { ROOT, read, gameHTML, inlineScript, loadCatalog, bootGame, tally } = require("../lib/harness.js");
const { ok, report } = tally();

const siteJS = read("assets/site.js");
const siteCSS = read("assets/site.css");

/* every top-level name site.js defines — a game that redeclares one throws at load */
const SHARED = [...siteJS.matchAll(/^(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
ok(SHARED.length > 10, "should have found site.js's shared globals, got " + SHARED.length);

/* Shared chrome a game must not rebuild in its own <style>. A game may retune spacing on these
   (CLAUDE.md allows one-off overrides like .app{max-width}), but re-declaring the LAYOUT is how
   the control scheme silently forks — so only structural properties are flagged. */
const SHARED_CSS = [".topbar", ".tlink", ".actions", ".serve-row", ".invisible", ".level-switch",
                    ".sheet-ov", ".sheet", ".sheet-body", ".rule", ".rrow", ".rarrow", ".rsolo",
                    /* the shared board: buildBoard() writes this markup, site.css lays it out.
                       .piece is NOT here — a game decides how big its piece is, but never how
                       it looks (checked separately below). */
                    ".gb-stage", ".gb-rig", ".gb-board", ".gb-layer", ".gb-slot", ".gb-back",
                    ".gb-frame", ".gb-lips", ".gb-rim", ".gb-fx", ".gb-line"];
const STRUCTURAL = /(^|[;{\s])(display|position|flex|flex-direction|justify-content|align-items|grid-template|z-index)\s*:/;

/* The only hosts a game may reach (CLAUDE.md rule 4). www.w3.org is the SVG xmlns namespace
   URI — an identifier, never fetched — so it is listed here rather than special-cased. The
   Google Fonts hosts are NOT here: the fonts are @imported once by site.css, so a page that
   names them is a copy of something shared (checked below). */
const ALLOWED_HOSTS = ["cdnjs.cloudflare.com",
                       "flagcdn.com",   /* guess-the-capital's flag images */
                       "www.w3.org"];
/* guess-the-capital is purely a choice of game, so it has no level chip at all */
const NO_LEVEL_CHIP = ["guess-the-capital"];

for (const g of loadCatalog()) {
  const slug = g.slug, html = gameHTML(slug), at = slug + ": ";

  /* --- the two shared assets, linked not copied (the fonts come with site.css) --- */
  ok(html.includes('href="../../assets/site.css"'), at + "should link ../../assets/site.css");
  ok(html.includes('<script src="../../assets/site.js"></script>'), at + "should link ../../assets/site.js");
  ok(/<body[^>]*class="[^"]*\bgame\b/.test(html), at + 'body needs class="game" to pull in the design system');
  ok(html.indexOf('src="../../assets/site.js"') < html.lastIndexOf("<script>"),
     at + "site.js must load before the game's own inline script");
  ok(/<canvas[^>]+id="confetti"/.test(html), at + "should have the <canvas id=\"confetti\">");

  /* --- one file: no extra game-specific CSS/JS files, data may only be JSON --- */
  for (const f of fs.readdirSync(path.join(ROOT, "games", slug))) {
    ok(f === "index.html" || f.endsWith(".json"),
       at + "unexpected file " + f + " — a game is one index.html plus optional JSON data");
  }

  const inline = inlineScript(html);

  /* --- never redeclare a shared helper (this throws a SyntaxError at load) --- */
  for (const n of SHARED)
    ok(!new RegExp("^\\s*(?:function|const|let|var)\\s+" + n + "\\b", "m").test(inline),
       at + "must not redeclare the shared " + n + " from site.js");

  /* --- never restyle the shared control scheme --- */
  /* comments out first: the rule split below is crude, and a comment naming a shared class
     right above a rule would otherwise read as part of that rule's selector */
  const style = ((html.match(/<style>([\s\S]*?)<\/style>/) || [, ""])[1]).replace(/\/\*[\s\S]*?\*\//g, "");
  for (const rule of style.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = rule[1], body = rule[2];
    if (!STRUCTURAL.test(body)) continue;                 /* spacing/colour tweaks are allowed */
    for (const cls of SHARED_CSS)
      ok(!new RegExp("(^|[,\\s>+~])" + cls.replace(".", "\\.") + "\\s*(?=$|[,\\s>+~:])").test(sel.trim()),
         at + "must not re-lay-out " + cls + " (" + sel.trim() + ") — it belongs to site.css");
  }

  /* --- the mascot is drawn once by site.js's drawMascots(); a game holds only empty
     placeholders (plus, at most, its own extras such as sentence-doctor's stethoscope) --- */
  const owls = [...html.matchAll(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/g)].filter(m => /\bclass="owl"/.test(m[1]));
  ok(owls.some(m => /\bid="owl-home"/.test(m[1])), at + 'start screen needs the <svg class="owl" id="owl-home"> mascot placeholder');
  ok(owls.some(m => /\bid="owl-(game|quiz)"/.test(m[1])), at + 'top bar needs the <svg class="owl" id="owl-game"> mascot placeholder');
  for (const m of owls)
    ok(!/class="(pupil|beak|brow)/.test(m[2]), at + "mascot placeholder " + (m[1].match(/id="([^"]*)"/) || [, "?"])[1]
       + " holds inline owl drawing — leave it empty, site.js draws it");
  ok(!html.includes('M14 10 L22 20 L10 20 Z'), at + "has an inline copy of the owl drawing — use an empty <svg class=\"owl\"> placeholder");

  /* --- the other shared pieces stay shared: each of these was once copy-pasted per game --- */
  ok(!/class=["']level-opt/.test(inline), at + "builds its own level-menu entries — use buildLevelMenu() from site.js");
  ok(!/getContext\(/.test(inline), at + "draws its own confetti — use throwConfetti() from site.js");
  ok(!/id="rules-ov"/.test(html), at + "carries the rules-sheet markup — wireRulesSheet() builds it");
  ok(!/@keyframes\s+\w+\{0%,100%\{transform:translateX\(0\)\}25%\{transform:translateX\(-7px\)\}75%\{transform:translateX\(7px\)\}\}/.test(style),
     at + "re-declares the ±7px wrong-answer shake — use site.css's wrongShake");
  /* the board games' shared board: its chrome is buildBoard() + site.css's GAME BOARD section.
     A game sizes its piece in its own square, but never re-colours it. */
  ok(!/\.piece\.(you|bird)\s*[,{:]/.test(style),
     at + "re-colours the shared .piece — site.css owns how a piece looks");
  ok(!/mask:\s*radial-gradient/.test(style),
     at + "looks like a copy of the board frame — call buildBoard() instead of rebuilding it");

  /* --- kid-safe: no trackers, no storage, no stray hosts --- */
  for (const m of html.matchAll(/https?:\/\/([^/"'\s)]+)/g))
    ok(ALLOWED_HOSTS.includes(m[1]), at + "external host " + m[1] + " is not allowed");
  /* strip comments first: several games mention fetch()/storage in prose explaining the rules */
  const code = inline.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  ok(!/\b(localStorage|sessionStorage)\b/.test(code), at + "should not use localStorage/sessionStorage");
  ok(!/gtag|googletagmanager|analytics|doubleclick/i.test(html), at + "no analytics or ad code");

  /* --- the standard control scheme --- */
  ok(/class="[^"]*\btopbar\b/.test(html), at + "needs the standard .topbar row");
  ok(/id="q-level"/.test(html) === !NO_LEVEL_CHIP.includes(slug),
     at + (NO_LEVEL_CHIP.includes(slug) ? "should have no level chip" : "needs the #q-level level chip"));
  ok(/\.\.\/["']/.test(html) || html.includes('href="../"'), at + "start screen needs the ← All games link to ../");
  /* no per-game streak — a single combined one arrives at site level later. (🔥 is the Hard
     difficulty emoji, so look for the concept, not the glyph.) */
  ok(!/\bstreak\b/i.test(code), at + "no per-game streak — a combined one comes later at site level");

  /* --- data-driven games load JSON through the shared helper, with no inline fallback --- */
  const dataFiles = fs.readdirSync(path.join(ROOT, "games", slug)).filter(f => f.endsWith(".json"));
  if (dataFiles.length) {
    ok(code.includes("loadGameData("), at + "has JSON data but never calls loadGameData()");
    ok(!/\bfetch\s*\(/.test(code), at + "should use loadGameData(), not its own fetch()");
    for (const f of dataFiles) {
      ok(code.includes('"' + f + '"') || code.includes("'" + f + "'"),
         at + "never loads its own data file " + f);
      /* the file must be parseable JSON — the game is unplayable otherwise */
      let parsed = null;
      try { parsed = JSON.parse(read(path.join("games", slug, f))); } catch (e) { /* reported below */ }
      ok(parsed !== null, at + f + " is not valid JSON");
    }
  }
}

/* the fonts live in exactly one place: site.css @imports them, no page links them itself */
ok(/@import url\("https:\/\/fonts\.googleapis\.com\/css2\?[^"]*family=Fredoka[^"]*family=Nunito[^"]*"\);/.test(siteCSS),
   "site.css must @import the Fredoka + Nunito stylesheet — that is how every page gets the fonts");
ok(siteCSS.indexOf("@import") < siteCSS.indexOf("{"),
   "site.css's @import must come before any rule, or the browser ignores it");

/* the hub's mascot comes from the same place */
const hubHTML = read("games/index.html");
ok(/<svg class="hub-owl"><\/svg>/.test(hubHTML), 'hub needs the empty <svg class="hub-owl"> mascot placeholder');
ok(!hubHTML.includes('M14 10 L22 20 L10 20 Z'), "hub has an inline copy of the owl drawing");
ok(hubHTML.includes('<script src="../assets/site.js"></script>'), "hub must link ../assets/site.js to draw its mascot");
ok(!hubHTML.includes("fonts.googleapis.com"), "hub should get the fonts from site.css, not link them itself");

/* and site.js really draws it: boot each game and look at the live placeholders */
for (const g of loadCatalog()) {
  const { w, d } = bootGame(g.slug, { onError: () => {} });   /* page errors are the play-throughs' job */
  const owls = [...d.querySelectorAll("svg.owl")];
  ok(owls.length >= 2, g.slug + ": expected the start-screen and top-bar mascots, got " + owls.length);
  for (const o of owls) {
    const beak = o.querySelector(".beak");
    ok(!!beak && beak.namespaceURI === "http://www.w3.org/2000/svg", g.slug + ": #" + o.id + " was not drawn by site.js");
    ok(o.querySelectorAll(".pupil").length === 2 && !!o.querySelector(".brow-l") && !!o.querySelector(".brow-r"),
       g.slug + ": #" + o.id + " is missing the mood parts setOwl() animates");
    ok(o.getAttribute("aria-hidden") === "true" && o.getAttribute("viewBox") === "0 0 64 64",
       g.slug + ": #" + o.id + " should be decorative (aria-hidden) with the 64×64 viewBox");
  }
  w.close();
}
report("game conventions");
