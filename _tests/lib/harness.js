"use strict";
/* Shared test harness. Everything here exists so a test never keeps its own copy of a
   game's code: engines are sliced out of the real games/<slug>/index.html at run time, so
   a test that passes is a statement about the file the site actually ships. */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

/* repo root, found by walking up from this file — never a hard-coded absolute path, so the
   suite runs from any checkout on any machine */
const ROOT = path.resolve(__dirname, "..", "..");

const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const gameHTML = slug => read(path.join("games", slug, "index.html"));

/* the game's own inline <script> — the one after site.js, i.e. the last one on the page */
function inlineScript(html) {
  const open = html.lastIndexOf("<script>");
  const close = html.indexOf("</script>", open);
  if (open < 0 || close < 0) throw new Error("no inline <script> found");
  return html.slice(open + "<script>".length, close);
}

/* Load a game's pure engine in plain Node — no DOM. The inline script guards its DOM half
   with `if (typeof document !== "undefined")`, and inside this Function scope `document` is
   genuinely undefined, so only the engine runs and its module.exports comes back. */
function loadEngine(slug) {
  const src = inlineScript(gameHTML(slug));
  const mod = { exports: {} };
  new Function("module", "exports", src)(mod, mod.exports);
  if (!Object.keys(mod.exports).length)
    throw new Error(slug + ": engine exported nothing — does its inline script still end with module.exports?");
  return mod.exports;
}

/* Boot a game page in jsdom the way a browser would: site.js inlined (jsdom won't fetch the
   relative <script src>) and the browser bits jsdom lacks stubbed in BEFORE parse, because the
   page reads matchMedia and paints to canvas as it loads. Nothing strips the fonts: a page no
   longer links them (site.css @imports them instead) and jsdom doesn't fetch stylesheets. */
function bootGame(slug, opts = {}) {
  const { reducedMotion = false, seed = null, url = "http://localhost/games/" + slug + "/", onError, data = null } = opts;
  const html = gameHTML(slug)
    .replace('<script src="../../assets/site.js"></script>', "<script>" + read("assets/site.js") + "</script>");

  const vc = new VirtualConsole();
  vc.on("jsdomError", e => { if (onError) onError(e); else console.log("  page error: " + e.message); });

  const dom = new JSDOM(html, {
    runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, url,
    beforeParse(w) {
      if (seed !== null) {
        let s = seed;
        w.Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      }
      w.matchMedia = q => ({ matches: !!reducedMotion && /reduce/.test(q), media: q,
        addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      /* beep() swallows this itself, so audio stays silent without the game noticing */
      w.AudioContext = function () { throw new Error("no audio in jsdom"); };
      /* jsdom has no fetch(). `data` maps a game's relative data paths to their parsed JSON
         (e.g. {"words.json": JSON.parse(read(...))}), so a data-driven game's loadGameData()
         gets the real file; anything else rejects, the way file:// would. */
      w.fetch = async p => {
        if (data && Object.prototype.hasOwnProperty.call(data, p))
          return { ok: true, json: async () => JSON.parse(JSON.stringify(data[p])) };
        throw new Error("no fetch in jsdom: " + p);
      };
      w.requestAnimationFrame = cb => setTimeout(() => cb(0), 0);
      w.cancelAnimationFrame = id => clearTimeout(id);
      /* jsdom has no canvas backend: getContext() returns null and the shared confetti code
         would throw. Stub just enough 2d context for it to run. */
      w.HTMLCanvasElement.prototype.getContext = () => ({
        clearRect() {}, fillRect() {}, save() {}, restore() {}, translate() {}, rotate() {}, beginPath() {}, arc() {}, fill() {}, set fillStyle(v) {}
      });
    }
  });
  const w = dom.window, d = w.document;
  return { dom, w, d, $: id => d.getElementById(id) };
}

/* deterministic RNG so a failure can always be reproduced from its seed */
function mulberry32(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/* tiny assertion tally — every test file ends with report(name) and exits non-zero on a fail */
function tally() {
  let fails = 0, checks = 0;
  /* Watchdog: the slowest suite takes about a minute, so one still running after five has
     stalled. Fail it by name instead of leaving run.sh waiting forever. unref() means the
     watchdog alone never keeps a finished suite alive. run.sh raises WATCHDOG_MIN when it runs
     suites in parallel — sharing the cores makes a suite slower, which is not a stall. */
  const suite = path.relative(ROOT, process.argv[1] || "suite");
  const mins = Number(process.env.WATCHDOG_MIN) || 5;
  setTimeout(() => {
    console.log("\n❌ " + suite + " — still running after " + mins + " minutes; stalled after " + checks + " checks");
    process.exit(1);
  }, mins * 60 * 1000).unref();
  const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log("  ✗ " + msg); } };
  const report = name => {
    console.log(fails ? "\n❌ " + name + " — " + fails + " FAILURES in " + checks + " checks"
                      : "\n✅ " + name + " — " + checks + " assertions, 0 failures");
    process.exit(fails ? 1 : 0);
  };
  return { ok, report, fails: () => fails, checks: () => checks };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* The STRESS dial: scales a generative test's RANDOM-SAMPLE count, never its scenarios.
     STRESS=quick  ~2% of full (at least 50)  — a fast pass
     (unset)       full                       — the default, what "tests pass" means
     STRESS=deep   5× full                    — a paranoid pre-release run
   Wrap only the number of random samples: `for (let i = 0; i < stress(2000); i++)`. Fixture
   checks, termination guards and assertions stay exactly as they are in every mode. */
const STRESS = (process.env.STRESS || "full").toLowerCase();
if (!["quick", "full", "deep"].includes(STRESS))
  throw new Error("STRESS must be quick, full or deep — got " + JSON.stringify(process.env.STRESS));
function stress(full) {
  if (STRESS === "quick") return Math.min(full, Math.max(50, Math.round(full / 50)));
  if (STRESS === "deep") return full * 5;
  return full;
}

/* the catalog, evaluated the way the hub loads it — games.js just assigns a GAMES global */
function loadCatalog() {
  const sandbox = {};
  new Function("window", read("games.js"))(sandbox);   /* games.js assigns window.GAMES */
  return sandbox.GAMES;
}

module.exports = { ROOT, read, gameHTML, inlineScript, loadEngine, bootGame,
                   mulberry32, tally, sleep, loadCatalog, stress, STRESS, JSDOM };
