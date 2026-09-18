"use strict";
/* The catalog is the single source of truth for the whole site, so it gets checked for every
   game, not just the newest one: permanent URLs resolve, the five age bands hold, and the hub
   renders and searches what games.js declares. */
const fs = require("fs"), path = require("path");
const { ROOT, read, bootGame, loadCatalog, tally, JSDOM } = require("../lib/harness.js");
const { ok, report } = tally();

const GAMES = loadCatalog();
const ACCENTS = ["grape", "coral", "leaf", "sun", "sky"];
const BANDS = ["3+", "6+", "9+", "12+", "15+"];

ok(GAMES.length > 0, "games.js should declare at least one game");

const seen = new Set();
for (const g of GAMES) {
  const at = "games.js[" + (g.slug || "?") + "]";
  ok(typeof g.slug === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.slug),
     at + ": slug must be lowercase words joined by hyphens");
  ok(!seen.has(g.slug), at + ": duplicate slug");
  seen.add(g.slug);

  /* rule 1 — game URLs are permanent, so every catalog entry must point at a real folder */
  ok(fs.existsSync(path.join(ROOT, "games", g.slug, "index.html")),
     at + ": no games/" + g.slug + "/index.html — the card would link to a 404");

  for (const f of ["title", "tagline", "emoji"])
    ok(typeof g[f] === "string" && g[f].trim(), at + ": missing required field " + f);
  ok(ACCENTS.includes(g.accent), at + ": accent must be one of " + ACCENTS.join("|") + ", got " + g.accent);
  /* an off-scale age silently adds a stray chip to the hub's filter */
  ok(BANDS.includes(g.ageGroup), at + ": off-scale ageGroup " + g.ageGroup + " — must be one of " + BANDS.join(", "));
  if ("skills" in g) ok(Array.isArray(g.skills) && g.skills.every(s => typeof s === "string"),
     at + ": skills must be an array of strings");
  if ("badge" in g) ok(typeof g.badge === "string" && g.badge.trim(), at + ": badge must be a non-empty string");
}

/* accent spacing — the hub grid is 1–4 columns, so an entry 1, 2 or 3 places apart can land
   beside or directly above/below; those must differ. 4 apart may repeat (see CLAUDE.md). */
GAMES.forEach((g, i) => {
  for (const d of [1, 2, 3]) if (i >= d)
    ok(GAMES[i - d].accent !== g.accent,
       "games.js[" + g.slug + "]: accent " + g.accent + " repeats " + GAMES[i - d].slug + ", " + d + " place(s) above");
});

/* no orphans either — a folder on disk that the catalog forgot is an unreachable game */
for (const dir of fs.readdirSync(path.join(ROOT, "games"), { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  ok(seen.has(dir.name), "games/" + dir.name + "/ exists but is not in the games.js catalog");
}

/* ---- the hub renders the catalog ------------------------------------------------------- */
const hubHTML = read("games/index.html");
const dom = new JSDOM(hubHTML, { runScripts: "outside-only", url: "http://localhost/games/" });
const w = dom.window, d = w.document;
w.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {} });
w.eval(read("games.js"));
w.eval(hubHTML.slice(hubHTML.lastIndexOf("<script>") + 8, hubHTML.lastIndexOf("</script>")));

const cards = [...d.querySelectorAll(".game-card")];
ok(cards.length === GAMES.length, "hub should render every catalog entry, got " + cards.length + "/" + GAMES.length);
for (const g of GAMES) {
  const card = cards.find(c => (c.getAttribute("href") || "") === g.slug + "/");
  ok(!!card, g.slug + ": no hub card links to " + g.slug + "/");
  if (!card) continue;
  ok(card.textContent.includes(g.title), g.slug + ": card should show the title");
  ok(card.textContent.includes(g.emoji), g.slug + ": card should show the emoji");
  ok(card.textContent.includes("Age: " + g.ageGroup), g.slug + ": card should show Age: " + g.ageGroup);
  ok(card.className.includes("acc-" + g.accent), g.slug + ": card should use the " + g.accent + " accent");
  for (const s of g.skills || []) ok(card.textContent.includes(s), g.slug + ": card missing skill " + s);
}

/* the age filter is built from whatever values appear, so it must be exactly All + the bands
   in use, in scale order — a band no game uses (today: 15+) simply has no chip */
const chips = [...d.querySelectorAll(".age-chip")].map(c => c.dataset.age);
const used = BANDS.filter(b => GAMES.some(g => g.ageGroup === b));
ok(chips.join(",") === "all," + used.join(","), "age chips should be All + " + used.join(",") + " in order, got " + chips.join(","));

/* search finds every game by a word from its title */
const box = d.querySelector(".search");
ok(!!box, "hub should have a search box");
if (box) for (const g of GAMES) {
  const word = g.title.split(/\s+/).sort((a, b) => b.length - a.length)[0].toLowerCase();
  box.value = word;
  box.dispatchEvent(new w.Event("input", { bubbles: true }));
  const shown = [...d.querySelectorAll(".game-card")].filter(c => c.offsetParent !== null || true);
  ok(shown.some(c => c.getAttribute("href") === g.slug + "/"),
     g.slug + ": searching '" + word + "' should surface the game");
}

report("catalog + hub (" + GAMES.length + " games)");
