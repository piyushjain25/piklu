"use strict";
/* The structural rules in CLAUDE.md, enforced across every game in the catalog. These are the
   rules that are easy to break by copy-paste and invisible until something breaks at run time:
   redeclaring a shared helper throws a SyntaxError on load, re-styling a shared class silently
   forks the design system, and a stray network call breaks the ad-free/offline promise. */
const fs = require("fs"), path = require("path");
const { ROOT, read, gameHTML, inlineScript, loadCatalog, tally } = require("../lib/harness.js");
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
                    ".sheet-ov", ".sheet", ".sheet-body", ".rule", ".rrow", ".rarrow", ".rsolo"];
const STRUCTURAL = /(^|[;{\s])(display|position|flex|flex-direction|justify-content|align-items|grid-template|z-index)\s*:/;

/* The only hosts a game may reach (CLAUDE.md rule 4). www.w3.org is the SVG xmlns namespace
   URI — an identifier, never fetched — so it is listed here rather than special-cased. */
const ALLOWED_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "cdnjs.cloudflare.com",
                       "flagcdn.com",   /* guess-the-capital's flag images */
                       "www.w3.org"];
/* guess-the-capital is purely a choice of game, so it has no level chip at all */
const NO_LEVEL_CHIP = ["guess-the-capital"];

for (const g of loadCatalog()) {
  const slug = g.slug, html = gameHTML(slug), at = slug + ": ";

  /* --- the three shared assets, linked not copied --- */
  ok(/<link[^>]+fonts\.googleapis\.com/.test(html), at + "should link the Google Fonts stylesheet");
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
  const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [, ""])[1];
  for (const rule of style.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = rule[1], body = rule[2];
    if (!STRUCTURAL.test(body)) continue;                 /* spacing/colour tweaks are allowed */
    for (const cls of SHARED_CSS)
      ok(!new RegExp("(^|[,\\s>+~])" + cls.replace(".", "\\.") + "\\s*(?=$|[,\\s>+~:])").test(sel.trim()),
         at + "must not re-lay-out " + cls + " (" + sel.trim() + ") — it belongs to site.css");
  }

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

report("game conventions");
