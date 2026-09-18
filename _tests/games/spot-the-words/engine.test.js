"use strict";
/* Spot the Words engine, proved across every theme in the real words.json:
   the data file is well-formed, and 2,000 generated puzzles per theme each place every target,
   contain every target EXACTLY ONCE in all eight directions (the bug most word searches ship),
   leave no cell empty, and keep the theme's other words out of the grid. Skip/Next never
   repeat the outgoing puzzle, and the selection maths (snapping, either-way reading) holds. */
const { read, loadEngine, mulberry32, tally } = require("../../lib/harness.js");
const { ok, report } = tally();
const E = loadEngine("spot-the-words");

const RAW = JSON.parse(read("games/spot-the-words/words.json"));
const PUZZLES_PER_THEME = 2000;

/* ---- words.json, checked raw (not through the game's own validator) ---- */
const EXPECT = [
  ["Number Words", "🔢", 8, "basic"], ["Colours", "🌈", 8, "basic"], ["Farm Animals", "🐄", 9, "back"],
  ["Ocean", "🐠", 9, "back"], ["Food", "🍎", 9, "back"], ["Maths Words", "➕", 9, "back"],
  ["Nature", "🌳", 9, "back"], ["Sports", "⚽", 9, "all"], ["Body", "🖐️", 10, "back"],
  ["Seasons & Weather", "☀️", 10, "all"], ["Shapes", "🔷", 10, "all"], ["Space", "🚀", 10, "all"],
  ["Days of the Week", "📅", 11, "all"], ["Months", "🗓️", 11, "all"],
];
ok(Array.isArray(RAW.themes) && RAW.themes.length === EXPECT.length, "words.json should hold " + EXPECT.length + " themes");
RAW.themes.forEach((t, i) => {
  const [name, emoji, grid, dirs] = EXPECT[i] || [];
  const at = "theme " + i + " (" + t.name + "): ";
  ok(t.name === name, at + "should be " + name + " in position " + i);
  ok(t.emoji === emoji, at + "emoji should be " + emoji);
  ok(t.grid === grid, at + "grid should be " + grid);
  ok(t.dirs === dirs, at + "dirs should be " + dirs);
  ok(["basic", "back", "all"].includes(t.dirs), at + "dirs must be basic | back | all");
  ok(Number.isInteger(t.grid) && t.grid >= 8 && t.grid <= 11, at + "grid must be 8–11");
  ok(Array.isArray(t.words), at + "needs a words array");
  for (const w of t.words) {
    ok(/^[A-Z]+$/.test(w), at + "word " + w + " must be A–Z capitals only");
    ok(w.length <= t.grid, at + "word " + w + " is longer than the grid");
  }
  ok(new Set(t.words).size === t.words.length, at + "has a duplicate word");
  const need = t.name === "Days of the Week" ? 7 : 10;
  ok(t.words.length >= need, at + "needs at least " + need + " words, has " + t.words.length);
  ok(t.words.length >= E.roundSize(t.grid), at + "has fewer words than a round needs");
});
ok(RAW.themes.find(t => t.name === "Number Words").words.join() ===
   "ZERO,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT,NINE,TEN,ELEVEN,TWELVE", "Number Words should be ZERO–TWELVE");
ok(RAW.themes.find(t => t.name === "Months").words.length === 12, "Months should hold all 12");

/* the game's validator keeps every theme and every word of the real file */
const THEMES = E.validateThemes(RAW);
ok(THEMES.length === RAW.themes.length, "validateThemes should keep all 14 themes, kept " + THEMES.length);
THEMES.forEach((t, i) => ok(t.words.length === RAW.themes[i].words.length, t.name + ": validator dropped a word"));
/* …and drops malformed ones instead of crashing */
ok(E.validateThemes(null).length === 0 && E.validateThemes({}).length === 0, "validator should survive junk");
/* no theme ever hides a word reading upward (bottom-to-top, straight or diagonal) */
for (const [k, set] of Object.entries(E.DIRSETS))
  ok(set.every(([dr]) => dr >= 0), "DIRSETS." + k + " must never read upward (↑ ↖ ↗)");
ok(E.DIRSETS.back.length === 3 && E.DIRSETS.all.length === 5, "back = → ↓ ←, all = those + ↘ ↙");
ok(E.validateThemes({ themes: [{ name: "X", emoji: "x", grid: 8, dirs: "sideways", words: RAW.themes[0].words }] }).length === 0,
   "validator should drop an unknown dirs value");
ok(E.validateThemes({ themes: [{ name: "X", emoji: "x", grid: 8, dirs: "basic", words: ["ab", "CD"] }] }).length === 0,
   "validator should drop a theme left too small after bad words are removed");

ok(E.roundSize(8) === 5 && E.roundSize(9) === 6 && E.roundSize(10) === 6 && E.roundSize(11) === 7,
   "round sizes should be 8→5, 9→6, 10→6, 11→7");

/* ---- independent oracle: every distinct straight line spelling `word`, all 8 directions ---- */
const D8 = [[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,-1],[1,-1],[-1,1]];
function countLines(grid, N, word) {
  const keys = new Set();
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of D8) {
    let s = "";
    for (let k = 0; k < word.length; k++) {
      const rr = r + dr * k, cc = c + dc * k;
      if (rr < 0 || rr >= N || cc < 0 || cc >= N) { s = null; break; }
      s += grid[rr * N + cc];
    }
    if (s !== word) continue;
    const a = r * N + c, b = (r + dr * (word.length - 1)) * N + c + dc * (word.length - 1);
    keys.add(Math.min(a, b) + "-" + Math.max(a, b));
  }
  return keys.size;
}

/* ---- 2,000 puzzles per theme ---- */
const t0 = Date.now();
let crossed = 0, total = 0;
for (const theme of THEMES) {
  const rng = mulberry32(0xC0FFEE ^ theme.grid * 7919 ^ theme.words.length);
  const N = theme.grid, allowed = E.DIRSETS[theme.dirs], n = E.roundSize(N);
  const bag = new Set(theme.words.join(""));
  const lens = new Set(theme.words.map(w => w.length)).size;
  let fails = 0, spreadMin = Infinity;
  for (let i = 0; i < PUZZLES_PER_THEME && fails < 5; i++) {
    const p = E.buildPuzzle(theme, rng);
    const at = theme.name + " #" + i + ": ";
    const bad = msg => { fails++; ok(false, at + msg); };
    total++;

    if (p.size !== N || p.grid.length !== N * N) { bad("grid should be " + N + "×" + N); continue; }
    if (p.words.length !== Math.min(n, theme.words.length)) bad("should hide " + n + " words, hid " + p.words.length);
    if (!p.grid.every(ch => /^[A-Z]$/.test(ch))) bad("a cell is empty or not a capital letter");
    if (!p.grid.every(ch => bag.has(ch))) bad("a filler letter is not from the theme's own letters");

    const cover = new Map();
    for (const w of p.words) {
      if (!theme.words.includes(w.word)) bad(w.word + " is not in the theme");
      /* placed where it says, in an allowed direction */
      if (!allowed.some(([dr, dc]) => dr === w.dr && dc === w.dc)) bad(w.word + " runs in a direction " + theme.dirs + " does not allow");
      let s = "";
      for (let k = 0; k < w.word.length; k++) {
        const idx = (w.r0 + w.dr * k) * N + w.c0 + w.dc * k;
        s += p.grid[idx];
        cover.set(idx, (cover.get(idx) || 0) + 1);
      }
      if (s !== w.word) bad(w.word + " is not spelled at its recorded coordinates (got " + s + ")");
      if (w.r1 !== w.r0 + w.dr * (w.word.length - 1) || w.c1 !== w.c0 + w.dc * (w.word.length - 1)) bad(w.word + " end cell is wrong");
      /* THE property: exactly one copy, any direction */
      const count = countLines(p.grid, N, w.word);
      if (count !== 1) bad(w.word + " appears " + count + " times — must be exactly once");
      /* and selecting it works both ways round */
      const a = { r: w.r0, c: w.c0 }, b = { r: w.r1, c: w.c1 };
      if (p.words[E.matchSelection(p, a, b)] !== w) bad(w.word + " is not accepted start→end");
      if (p.words[E.matchSelection(p, b, a)] !== w) bad(w.word + " is not accepted end→start");
    }
    /* the theme's other words don't sit in the grid as decoys */
    for (const w of theme.words)
      if (!p.words.some(x => x.word === w) && countLines(p.grid, N, w)) bad("non-target " + w + " appears in the grid");
    /* no word nested inside another */
    for (const a of p.words) for (const b of p.words)
      if (a !== b && (b.word.includes(a.word) || b.word.includes([...a.word].reverse().join(""))))
        bad(a.word + " hides inside " + b.word);
    /* a spread of lengths, not five 3-letter words */
    const spread = new Set(p.words.map(w => w.word.length)).size;
    spreadMin = Math.min(spreadMin, spread);
    if (spread < Math.min(p.words.length, lens) - 1) bad("lengths are bunched: " + p.words.map(w => w.word).join(","));
    if ([...cover.values()].some(v => v > 1)) crossed++;
  }
  ok(fails === 0, theme.name + ": " + fails + " bad puzzles");
  console.log("  " + theme.name.padEnd(18) + " " + N + "×" + N + " " + theme.dirs.padEnd(5)
    + " ok — fewest distinct lengths in a round: " + spreadMin);
}
const ms = Date.now() - t0;
console.log("  " + total + " puzzles in " + ms + " ms (" + (ms / total).toFixed(2) + " ms each), "
  + Math.round(100 * crossed / total) + "% with at least one crossing");
ok(crossed / total > 0.6, "most puzzles should have a crossing, got " + Math.round(100 * crossed / total) + "%");
ok(ms / total < 25, "a puzzle should build in well under a frame budget, took " + (ms / total).toFixed(1) + " ms");

/* ---- Skip / Next never reproduce the outgoing puzzle ---- */
for (const theme of THEMES) {
  const rng = mulberry32(0xBEEF + theme.grid);
  const spare = theme.words.length > E.roundSize(theme.grid);
  let p = E.buildPuzzle(theme, rng), repeats = 0;
  for (let i = 0; i < 300; i++) {
    const q = E.buildPuzzle(theme, rng, { key: p.key, gridKey: p.grid.join("") });
    if (spare ? q.key === p.key : q.grid.join("") === p.grid.join("")) repeats++;
    if (!spare && q.key !== p.key) repeats++;   /* Days: always all seven words */
    p = q;
  }
  ok(repeats === 0, theme.name + ": Skip/Next repeated the outgoing " + (spare ? "word set" : "grid") + " " + repeats + " times");
}

/* ---- selection maths ---- */
const S = (r, c) => ({ r, c });
const eq = (a, b) => a.r === b.r && a.c === b.c;
ok(eq(E.snapLine(S(0,0), S(1,4), "basic", 8), S(0,4)), "a wobbly rightward drag should snap to the row");
ok(eq(E.snapLine(S(0,0), S(5,1), "basic", 8), S(5,0)), "a wobbly downward drag should snap to the column");
ok(eq(E.snapLine(S(3,3), S(4,7), "basic", 8), S(3,7)), "snap keeps the anchor's row");
ok(eq(E.snapLine(S(0,0), S(3,4), "all", 10), S(4,4)), "a near-diagonal drag should snap to the diagonal on 'all'");
ok(eq(E.snapLine(S(0,0), S(3,4), "back", 10), S(0,4)), "no diagonals on 'back' — snap to the row instead");
ok(eq(E.snapLine(S(4,4), S(4,1), "basic", 8), S(4,1)), "a word can be drawn from its last letter backwards");
ok(eq(E.snapLine(S(0,0), S(0,0), "all", 9), S(0,0)), "no movement stays on the anchor");
ok(eq(E.snapLine(S(1,1), S(-3,-3), "all", 9), S(0,0)), "snapping past the edge clamps to the grid");
ok(E.onLine(S(2,2), S(5,5), "all") && !E.onLine(S(2,2), S(5,5), "back"), "onLine respects the theme's directions");
ok(!E.onLine(S(0,0), S(1,2), "all"), "a knight's move is not a line");
ok(E.readLine(["A","B","C","D"], 2, S(0,0), S(1,1)) === "AD", "readLine reads a diagonal");
ok(E.readLine(["A","B","C","D"], 2, S(0,0), S(1,0)) === "AC", "readLine reads a column");

ok(E.starsFor(0) === 3 && E.starsFor(1) === 2 && E.starsFor(2) === 2 && E.starsFor(3) === 1 && E.starsFor(9) === 1,
   "stars: 0 hints → 3, 1–2 → 2, 3+ → 1");

report("spot-the-words engine");
