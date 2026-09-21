"use strict";
/* Shared JS for every /games/<slug>/index.html — link this before the game's own
   inline <script> (it defines globals the game script calls directly, unqualified).
   Keep this file limited to pieces that are identical, or safely parameterized,
   across every game. Game-specific logic stays inline in the game's own script. */

const $ = id => document.getElementById(id);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- game data loader ----------
   Every data-driven game (word-guess/words.json, guess-the-capital/capitals.json,
   spell-a-bee/words.json) keeps its data in a plain JSON file in its own folder —
   no other format is supported (see CLAUDE.md) — and loads it with this at the
   top of its own script:
     let WORDS = [];
     loadGameData("words.json").then(d => { if (d) WORDS = d; });
   Returns the parsed JSON, or null on any failure (offline, or opened via file://,
   which blocks fetch() — that's expected, not a bug; the game just stays unplayable
   until it's served). Callers validate the shape themselves before using it. */
async function loadGameData(path) {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (res.ok) return await res.json();
  } catch (e) { /* file:// or offline */ }
  return null;
}

function flash(msg, kind) {
  const f = $("feedback");
  if (!f) return;
  f.textContent = msg;
  f.className = "feedback " + (kind || "");
}

/* ---------- the page's own catalog entry ----------
   A game's name, card emoji and start-screen subtitle are written ONCE, in /games.js, and the
   page reads them back from there — so the hub card and the game itself can never drift apart.
   A game page links ../../games.js just before this file (the hub already did); the slug is the
   game's own folder name, which works when hosted AND under file://.
   GAME is null on the hub, and on any page that is not in the catalog — everything below is a
   no-op there rather than an error. */
const GAME = (() => {
  const parts = location.pathname.split("/").filter(Boolean);
  if (/\.x?html?$/i.test(parts[parts.length - 1] || "")) parts.pop();
  const slug = decodeURIComponent(parts[parts.length - 1] || "");
  const list = typeof GAMES !== "undefined" ? GAMES : (window.GAMES || []);
  return list.find(g => g.slug === slug) || null;
})();

/* Fills the catalog's own words into the page: every <i class="gemoji"> gets the card emoji,
   and <p class="subtitle"> gets the emoji followed by the game's subtitle (its `subtitle`
   field, or its card `tagline` when it has none). A game writes neither string itself.
   The <title> in <head> stays a literal — it is parsed long before any script runs, so it is
   the one copy that cannot come from here; _tests/site/conventions.test.js keeps it honest. */
function applyGameText() {
  if (!GAME) return;
  document.querySelectorAll("i.gemoji").forEach(el => { el.textContent = GAME.emoji; });
  const sub = GAME.subtitle || GAME.tagline;
  document.querySelectorAll("p.subtitle").forEach(el => {
    if (el.textContent.trim()) return;         /* a game that wrote its own is left alone */
    el.textContent = GAME.emoji + " " + sub;
  });
}
applyGameText();   // like drawMascots(): site.js loads after the markup, so this lands before first paint
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyGameText);

/* ---------- mascot drawing ----------
   The mascot is drawn ONCE, here — swap the site's mascot by changing MASCOT_SVG.
   A page holds only an empty placeholder, e.g.
     <svg class="owl" id="owl-home"></svg>
   and drawMascots() fills in every svg.owl (and the hub's svg.hub-owl). It is plain
   inline SVG markup, so it works under file:// (no external .svg, no <use href>).
   The mood CSS in site.css targets the .pupil / .brow-l / .brow-r / .beak classes
   below, so a replacement mascot must keep them for setOwl() moods to keep working.
   Anything already inside a placeholder is a game's own extra (sentence-doctor's
   stethoscope) and is drawn on top; an extra marked data-under (a shadow) stays
   underneath. The mascot is decorative, so it is always aria-hidden. It has no motion
   of its own; the mood transitions are switched off under prefers-reduced-motion by
   site.css's global reduced-motion rule. */
const MASCOT_SVG =
  '<path d="M14 10 L22 20 L10 20 Z" fill="#6C4AB6"/><path d="M50 10 L54 20 L42 20 Z" fill="#6C4AB6"/>' +
  '<circle cx="32" cy="34" r="22" fill="#6C4AB6"/><circle cx="32" cy="38" r="15" fill="#F4EEFF"/>' +
  '<g><circle cx="24" cy="28" r="9" fill="#fff"/><circle class="pupil" cx="24" cy="28" r="4" fill="#33236B"/></g>' +
  '<g><circle cx="40" cy="28" r="9" fill="#fff"/><circle class="pupil" cx="40" cy="28" r="4" fill="#33236B"/></g>' +
  '<path class="brow brow-l" d="M17 19 Q24 15 31 19" stroke="#4b2f8f" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
  '<path class="brow brow-r" d="M33 19 Q40 15 47 19" stroke="#4b2f8f" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
  '<path class="beak" d="M32 32 L28 38 L36 38 Z" fill="#FFCF43"/>';
function drawMascots() {
  document.querySelectorAll("svg.owl, svg.hub-owl").forEach(svg => {
    if (svg.dataset.drawn) return;
    svg.dataset.drawn = "1";
    svg.setAttribute("viewBox", "0 0 64 64");
    svg.setAttribute("aria-hidden", "true");
    const above = [...svg.children].find(el => !el.hasAttribute("data-under"));
    if (above) above.insertAdjacentHTML("beforebegin", MASCOT_SVG);
    else svg.insertAdjacentHTML("beforeend", MASCOT_SVG);
  });
}
drawMascots();   // site.js loads after the page's markup, so the owls draw before first paint
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", drawMascots);

/* ---------- owl mascot mood (idle / happy / worried / win / think) ---------- */
function setOwl(mood) {
  ["owl-game", "owl-quiz", "owl-home"].forEach(id => {
    const o = $(id);
    if (!o) return;
    o.classList.remove("happy", "worried", "win", "think");
    if (mood !== "idle") o.classList.add(mood);
  });
}

/* ---------- level-switch dropdown in the topbar chip ---------- */
function closeLevelMenu() {
  const m = $("level-menu"), q = $("q-level");
  if (!m || !q) return;
  m.classList.remove("open");
  q.setAttribute("aria-expanded", "false");
}
function toggleLevelMenu() {
  const m = $("level-menu"), q = $("q-level");
  if (!m || !q) return;
  const open = m.classList.toggle("open");
  q.setAttribute("aria-expanded", open);
}
// closes the menu on an outside click; call on its own if a game wires q-level's
// onclick itself (e.g. to guard opening it in certain modes)
function wireLevelMenuOutsideClick() {
  document.addEventListener("click", e => { if (!e.target.closest(".level-switch")) closeLevelMenu(); });
}
function wireLevelMenu() {
  const q = $("q-level");
  if (!q) return;
  q.onclick = (e) => { e.stopPropagation(); toggleLevelMenu(); };
  wireLevelMenuOutsideClick();
}
/* Fills #level-menu with one entry per level. `levels` is the game's LEVELS table
   ({ EASY: { label: "🌱 Easy", … }, … }, or { EASY: "🌱 Easy", … }) or a list of
   [key, label] pairs; tapping an entry calls onPick(key). Call it again whenever the
   list changes (e.g. an optional "My Words" level appearing once its data loads). */
function buildLevelMenu(levels, onPick) {
  const menu = $("level-menu");
  if (!menu) return;
  const items = Array.isArray(levels) ? levels
    : Object.entries(levels).map(([k, v]) => [k, typeof v === "string" ? v : v.label]);
  menu.innerHTML = items.map(([k, label]) =>
    `<button class="level-opt" role="menuitemradio" data-diff="${k}" aria-current="false"><span>${label}</span><span class="tick">✓</span></button>`).join("");
  menu.querySelectorAll(".level-opt").forEach(b => b.onclick = () => onPick(b.dataset.diff));
}
/* Shows `key` as the current level everywhere it appears: the start screen's .diff
   cards (aria-pressed), the level-menu entries (aria-current) and, when `label` is
   given, the top-bar chip's #q-level-label. */
function markLevel(key, label) {
  key = String(key);
  document.querySelectorAll(".diff").forEach(b => b.setAttribute("aria-pressed", b.dataset.diff === key));
  document.querySelectorAll(".level-opt").forEach(b => b.setAttribute("aria-current", b.dataset.diff === key));
  const lbl = $("q-level-label");
  if (lbl && label != null) lbl.textContent = label;
}

/* ---------- WebAudio beep ---------- */
let audioCtx = null;
let beepBus = null; // shared compressor + makeup gain, tames clipping when tones overlap
function beep(freq, dur, type = "sine", when = 0, gain = 0.12) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    if (!beepBus) {
      const comp = audioCtx.createDynamicsCompressor();
      const makeup = audioCtx.createGain();
      makeup.gain.value = 1.4;
      comp.connect(makeup); makeup.connect(audioCtx.destination);
      beepBus = comp;
    }
    const t = audioCtx.currentTime + when, o = audioCtx.createOscillator(), g = audioCtx.createGain(), f = audioCtx.createBiquadFilter();
    o.type = type; o.frequency.value = freq;
    f.type = "lowpass"; f.frequency.value = Math.min(freq * 4, 6000); f.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006); // short attack avoids a click on start
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f); f.connect(g); g.connect(beepBus);
    o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
}

/* The site's two stock outcome sounds. Every game's own sound(kind) dispatcher was spelling
   these out: the rising four-note win arpeggio (22 games) and the wrong-answer buzz (12). The
   game still decides WHEN they play and what else it makes — only the notes are shared, so
   "getting it right" sounds the same across the site. The defaults are the spelling 14 (and
   12) games used; the handful that wanted a slower one pass their own. */
function beepWin(dur, gap, delay) {
  [523, 659, 784, 1047].forEach((f, i) => beep(f, dur || 0.16, "triangle", (delay || 0) + i * (gap || 0.08)));
}
function beepBad(dur, gain) {
  beep(190, dur || 0.16, "sawtooth", 0, gain || 0.10);
}

/* ---------- speech synthesis (read a word/phrase aloud) ---------- */
let ttsVoice = null;
function pickVoice() {
  if (!("speechSynthesis" in window)) return;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return;
  // Chrome defaults to a low-quality local voice unless one is picked explicitly;
  // pick its higher-quality network voice. Every other browser (Safari included)
  // already uses its own best default voice when none is set explicitly — and
  // Safari's `voice.default` flag isn't reliable enough to pick a substitute — so
  // leave ttsVoice unset there and let the browser's own default choice stand.
  ttsVoice = voices.find(v => /en-US/i.test(v.lang) && /Google US English/i.test(v.name)) || null;
}
if ("speechSynthesis" in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice; // voice list loads asynchronously in Chrome
}
function speak(text, rate = 1) {
  if (!("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    if (!ttsVoice) pickVoice();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate; u.lang = "en-US"; u.volume = 1; u.pitch = 1;
    if (ttsVoice) u.voice = ttsVoice;
    speechSynthesis.speak(u);
  } catch (e) { /* speech unsupported — caller should keep the game playable without it */ }
}
function stopSpeech() {
  try { speechSynthesis.cancel(); } catch (e) {}
}

/* ---------- rules sheet ----------
   The "how to play" panel some games open from the start screen and from their
   .actions row during play. A game supplies the standard markup (see site.css's
   RULES SHEET section) plus a function that builds its own rules copy, then calls:

     wireRulesSheet(() => { $("rules-body").innerHTML = "...this game's rules..."; });

   The body is built lazily on first open, so a long rules panel costs nothing at
   load. Openers are whichever of #rules-home (start screen) and #rules-btn (in
   game) exist. Escape, the backdrop and both close buttons all close it; focus
   moves into the sheet on open, is kept inside it while open, and returns to
   whichever control opened it. A game's own keydown handler should start with
   `if (rulesSheetOpen()) return;` so play keys do nothing while it is up. */
let rulesBody = null, rulesBuilt = false, rulesOpener = null;
function rulesSheetOpen() {
  const o = $("rules-ov");
  return !!o && o.classList.contains("show");
}
function openRulesSheet(opener) {
  const o = $("rules-ov");
  if (!o) return;
  if (!rulesBuilt && rulesBody) { rulesBody(); rulesBuilt = true; }
  rulesOpener = opener || null;
  o.classList.add("show");
  const body = $("rules-body");
  if (body) body.scrollTop = 0;
  const x = $("rules-close");
  if (x) x.focus();
}
function closeRulesSheet() {
  const o = $("rules-ov");
  if (!o) return;
  o.classList.remove("show");
  // don't strand focus on a now-hidden button
  if (rulesOpener && document.contains(rulesOpener)) rulesOpener.focus();
  rulesOpener = null;
}
/* the sheet's overlay, built here so no game carries a copy of its markup. It goes just
   before the confetti canvas (i.e. after .app), headed "📖 How to play <game name>". */
function buildRulesSheet(gameName) {
  if ($("rules-ov")) return;
  const o = document.createElement("div");
  o.className = "sheet-ov"; o.id = "rules-ov";
  o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-labelledby", "rules-h");
  o.innerHTML =
    '<div class="sheet"><div class="sheet-top"><h2 id="rules-h"></h2>' +
    '<button class="sheet-x" id="rules-close" aria-label="Close rules">✕</button></div>' +
    '<div class="sheet-body" id="rules-body"></div>' +
    '<div class="sheet-foot"><button id="rules-ok" class="btn btn-go">Got it!</button></div></div>';
  o.querySelector("#rules-h").textContent = "📖 How to play " + gameName;
  const cv = $("confetti");
  if (cv) cv.before(o); else document.body.appendChild(o);
}
/* gameName defaults to the page's <title> */
function wireRulesSheet(buildBody, gameName) {
  buildRulesSheet(gameName || document.title);
  const o = $("rules-ov");
  if (!o) return;
  rulesBody = buildBody || null;
  ["rules-home", "rules-btn"].forEach(id => {
    const b = $(id);
    if (b) b.onclick = () => openRulesSheet(b);
  });
  ["rules-close", "rules-ok"].forEach(id => {
    const b = $(id);
    if (b) b.onclick = closeRulesSheet;
  });
  o.addEventListener("click", e => { if (e.target === o) closeRulesSheet(); });
  o.addEventListener("keydown", e => {
    if (e.key !== "Tab") return;
    const f = o.querySelectorAll("button");
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && rulesSheetOpen()) { e.preventDefault(); closeRulesSheet(); }
  });
}

/* ---------- game board ----------
   The board the board games share: a lavender frame with a hole for every square, a piece
   standing in some of them, and a line drawn through a winning row. The chrome is built here
   and styled in site.css's GAME BOARD section, so a game carries no copy of it — it calls
   buildBoard() and then adds its own layer on top (column buttons, square buttons, the piece
   you are holding):

     const b = buildBoard("stage", { cols: 7, rows: 6, cell: boardCell(7) });
     b.board.appendChild(myButtons);              // my own layer, painted over the board
     $("s" + i).innerHTML = pieceHTML("you");     // a piece in square i

   buildBoard fills the element with <div class="gb-slot" id="s{i}">, one per square, already
   positioned, and hands back the layers a game needs. Square (row, col) is slot row*cols+col,
   row 0 at the TOP; a game that counts its own squares the other way round (Connect Four
   counts rows up from the bottom) passes its own index(row, col). */

/* A cell size that keeps the whole board inside the card at any width: a share of THE CARD
   (100cqw is the card's content box, so page and card padding are already taken off), never
   below min or above max. gutter is extra room the board's own chrome needs beside it, and is
   normally 0 — it used to be a per-game guess at the page padding, which is what made a board
   sized in vw overflow its card on a phone. */
function boardCell(cols, o = {}) {
  const { min = 19, max = 40, gutter = 0 } = o;
  const w = gutter ? "(100cqw - " + gutter + "px)" : "100cqw";
  return "clamp(" + min + "px, calc(" + w + " / " + (cols + 0.3) + "), " + max + "px)";
}

/* Builds (or rebuilds — a game whose board changes size just calls it again) the board inside
   `mount`, leaving anything else in there alone. Options: cols, rows (defaults to cols), cell
   (a CSS length, usually boardCell(...)), head (room above the board for a held piece), hole
   (hole radius), inset (how much smaller a piece is than its square), edge (the piece's bottom
   edge), label (what a screen reader calls the board) and index(row, col). Returns { stage, rig, board, pieces, fx, line }. */
function buildBoard(mount, o) {
  const stage = typeof mount === "string" ? $(mount) : mount;
  if (!stage) return null;
  const cols = o.cols, rows = o.rows || o.cols, index = o.index || ((r, c) => r * cols + c);
  stage.classList.add("gb-stage");
  const vars = { "--cols": cols, "--rows": rows, "--cell": o.cell, "--head": o.head,
                 "--hole": o.hole, "--piece-inset": o.inset, "--piece-edge": o.edge };
  for (const k in vars) if (vars[k] != null) stage.style.setProperty(k, vars[k]);
  const old = stage.querySelector(".gb-rig");
  if (old) old.remove();
  const rig = document.createElement("div");
  rig.className = "gb-rig";
  rig.innerHTML = '<div class="gb-board">'
    + '<div class="gb-layer gb-back"></div><div class="gb-layer" id="gb-pieces"></div>'
    + '<div class="gb-frame"></div><div class="gb-layer gb-lips"></div>'
    + '<div class="gb-layer gb-fx" id="gb-fx"></div><div class="gb-rim"></div>'
    + '<svg class="gb-line" id="gb-line" viewBox="0 0 ' + cols + " " + rows + '" preserveAspectRatio="none"></svg>'
    + "</div>";
  if (o.label) {
    rig.firstChild.setAttribute("role", "group");
    rig.firstChild.setAttribute("aria-label", o.label);
  }
  stage.prepend(rig);                       /* before whatever else the stage holds */
  const pieces = rig.querySelector("#gb-pieces");
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) pieces.appendChild(boardSlot(index(r, c), r, c));
  return { stage, rig, board: rig.firstChild, pieces, fx: rig.querySelector("#gb-fx"),
           line: rig.querySelector("#gb-line") };
}
/* one square, parked at its place on the board. `id` is the game's own index for it; pass no
   id for a loose slot (a piece on its way off the board, which the game drops into .gb-fx). */
function boardSlot(id, row, col) {
  const s = document.createElement("div");
  s.className = "gb-slot";
  if (id != null) { s.id = "s" + id; s.dataset.v = 0; }
  s.style.left = "calc(var(--cell) * " + col + ")";
  s.style.top = "calc(var(--cell) * " + row + ")";
  return s;
}
/* one piece: pieceHTML("you") or pieceHTML("bird"), plus anything else it wears (a crown) */
function pieceHTML(side, inner) {
  return '<div class="piece ' + side + '">' + (inner || "") + "</div>";
}

/* Draws the line through a win. `runs` is a list of runs, each a list of square indexes in
   order; xy(i) gives a square's centre in cell units. Already-drawn lines are left alone, so a
   redraw never restarts the animation — clearWinLine() when the next round starts. */
function drawWinLine(runs, xy) {
  const svg = $("gb-line");
  if (!svg || svg.childNodes.length) return;
  let back = "", front = "", dots = "";
  for (const run of runs) {
    const [x1, y1] = xy(run[0]), [x2, y2] = xy(run[run.length - 1]);
    const a = 'x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" pathLength="1"';
    back += '<line class="wl-back" ' + a + "/>";
    front += '<line class="wl-front" ' + a + "/>";
    for (const i of run) { const [x, y] = xy(i); dots += '<circle cx="' + x + '" cy="' + y + '" r=".12"/>'; }
  }
  svg.innerHTML = back + front + dots;
}
function clearWinLine() {
  const svg = $("gb-line");
  if (svg) svg.innerHTML = "";
}

/* ---------- confetti canvas ----------
   throwConfetti(options) is every game's celebration — one particle loop, drawn on
   #confetti. With no options it is the small burst most games throw on a solve; a game
   tunes its own look with:
     colors  palette to pick from (CONFETTI_COLORS by default; add to it with
             [...CONFETTI_COLORS, "#FF8C42"])     count  pieces     frames  how long it runs
     rain    fall from above the screen instead of bursting from the middle
             (then defaults to count 120, frames 220, and no gravity)
     y       burst height, as a fraction of the screen     wide  burst across the full width
     rMin, size  a piece is rMin + up to `size` px    lift  upward kick   spread  sideways kick (±)
     gravity pull per frame   spin  random start angle   vr  spin per frame
     w, h    piece width / height, as multiples of its size
     round   round pieces (coins)   mirror  pieces fly out in mirrored pairs
   Callers still guard it themselves: if (!reduceMotion) throwConfetti(...). */
let confettiRAF = null;
const CONFETTI_COLORS = ["#6C4AB6", "#2FB37D", "#FFCF43", "#3FA7E0", "#FF6B7A"];
function throwConfetti(o = {}) {
  const rain = !!o.rain;
  const { colors = CONFETTI_COLORS, count = rain ? 120 : 75, frames = rain ? 220 : 75,
          y = .35, wide = false, rMin = 5, size = 7, lift = 5, spread = 6, gravity = .16,
          spin = false, vr = .25, w = 1, h = .6, round = false, mirror = false } = o;
  const cv = $("confetti");
  if (!cv) return;
  cv.style.display = "block";
  const ctx = cv.getContext("2d");
  cv.width = innerWidth; cv.height = innerHeight;
  const pick = () => colors[Math.floor(Math.random() * colors.length)];
  let parts;
  if (rain) {
    parts = Array.from({ length: count }, () => ({
      x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * .5,
      r: 5 + Math.random() * size, c: pick(), vy: 2 + Math.random() * 3,
      vx: -1.5 + Math.random() * 3, rot: Math.random() * 6, vr: -.2 + Math.random() * .4 }));
  } else {
    const piece = () => ({
      x: wide ? Math.random() * cv.width : cv.width / 2, y: cv.height * y,
      r: rMin + Math.random() * size, c: pick(), vy: -lift + Math.random() * 2,
      vx: mirror ? 1 + Math.random() * (spread - 1) : -spread + Math.random() * spread * 2,
      rot: spin ? Math.random() * 6 : 0, vr });
    parts = mirror
      ? Array.from({ length: count / 2 }, piece).flatMap(p => [p, { ...p, vx: -p.vx, vr: -p.vr, rot: -p.rot }])
      : Array.from({ length: count }, piece);
  }
  const g = rain ? 0 : gravity;
  let f = 0;
  (function draw() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    parts.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += g; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
      if (round) { ctx.beginPath(); ctx.arc(0, 0, p.r * .6, 0, 7); ctx.fill(); }
      else ctx.fillRect(-p.r / 2, -p.r / 2, p.r * w, p.r * h);
      ctx.restore();
    });
    f++;
    if (f < frames) confettiRAF = requestAnimationFrame(draw); else stopConfetti();
  })();
}
function stopConfetti() {
  if (confettiRAF) cancelAnimationFrame(confettiRAF);
  const cv = $("confetti");
  if (cv) { cv.getContext("2d").clearRect(0, 0, cv.width, cv.height); cv.style.display = "none"; }
}

/* ---------- the two screens every game has ----------
   Every game is one #screen-home (title, level picker, how-to) and one #screen-game, swapped
   by toggling .hide. All 37 games wrote that pair of classList lines out by hand, twice each.
   showScreen() is the swap on its own; showHome() is the three things 31 of the 36 goHome()
   functions open with — stop the celebration, show the start screen, rest the owl — after
   which a game does its OWN cleanup (its timers, the piece it was holding). */
function showScreen(which) {
  const home = $("screen-home");
  /* guess-the-capital calls its play screen #screen-quiz, the same exception setOwl makes
     for that game's #owl-quiz mascot placeholder */
  const play = $("screen-game") || $("screen-quiz");
  if (home) home.classList.toggle("hide", which !== "home");
  if (play) play.classList.toggle("hide", which === "home");
}
function showHome() {
  stopConfetti();
  showScreen("home");
  setOwl("idle");
}

/* ---------- bouncy animated <title> ---------- */
/* Builds the animated per-letter <h1 id="title">. Called with no argument, it uses the game's
   name from the catalog (GAME.title) — that is the normal form, so the name lives only in
   /games.js. A word may still be passed for a page that is not a catalogued game. */
function initBouncyTitle(word) {
  const cls = ["c1", "c2", "c3", "c4"];
  const el = $("title");
  if (word === undefined) word = GAME ? GAME.title : "";
  if (!el || !word) return;
  let ci = 0;
  for (const ch of word) {
    if (ch === " ") { el.appendChild(document.createTextNode(" ")); continue; }
    const s = document.createElement("span");
    s.textContent = ch; s.className = cls[ci++ % cls.length];
    if (!reduceMotion) s.style.animation = `siteTitleBob 2.4s ease-in-out ${(ci * 0.05).toFixed(2)}s infinite`;
    el.appendChild(s);
  }
  if (!reduceMotion) {
    const st = document.createElement("style");
    st.textContent = "@keyframes siteTitleBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}";
    document.head.appendChild(st);
  }
}
