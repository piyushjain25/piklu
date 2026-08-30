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

/* ---------- speech synthesis (read a word/phrase aloud) ---------- */
let ttsVoice = null;
function pickVoice() {
  if (!("speechSynthesis" in window)) return;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return;
  // Chrome defaults to a low-quality local voice unless one is picked explicitly;
  // prefer its higher-quality network voice, else any local/generic English voice.
  ttsVoice = voices.find(v => /en-US/i.test(v.lang) && /Google US English/i.test(v.name))
    || voices.find(v => /^en/i.test(v.lang) && v.localService)
    || voices.find(v => /^en/i.test(v.lang))
    || voices[0];
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

/* ---------- confetti canvas ---------- */
let confettiRAF = null;
function stopConfetti() {
  if (confettiRAF) cancelAnimationFrame(confettiRAF);
  const cv = $("confetti");
  if (cv) { cv.getContext("2d").clearRect(0, 0, cv.width, cv.height); cv.style.display = "none"; }
}

/* ---------- bouncy animated <title> ---------- */
function initBouncyTitle(word) {
  const cls = ["c1", "c2", "c3", "c4"];
  const el = $("title");
  if (!el) return;
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
