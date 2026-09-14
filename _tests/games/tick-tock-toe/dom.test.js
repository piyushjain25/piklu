/* jsdom play-through of games/tick-tock-toe: drives the real page and asserts the rules,
   the control scheme, and that nothing stale lands after leaving a turn. */
"use strict";
const { bootGame, tally } = require('../../lib/harness.js');
const { ok, report } = tally();

/* the page reads matchMedia at load, so re-boot per scenario */
function fresh(reduced) {
  const { w, d, $ } = bootGame('tick-tock-toe', { reducedMotion: reduced, seed: 20260913,
    onError: e => ok(false, 'page error: ' + e.message) });
  return { w, d, $, cells: () => [...d.querySelectorAll('#board .tile')] };
}

function playTo(w, d, ms) { // jsdom timers are real; advance by awaiting
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  console.log('— boot & start screen —');
  {
    const { w, d, $ } = fresh(false);
    ok($('screen-home') && !$('screen-home').classList.contains('hide'), 'start screen visible');
    ok($('screen-game').classList.contains('hide'), 'game screen hidden at start');
    ok($('title').textContent.replace(/\s/g, '') === 'TickTockToe', 'bouncy title rendered: ' + $('title').textContent);
    ok(d.querySelectorAll('#board .tile').length === 9, 'board has 9 cells');
    ok(d.querySelectorAll('.diff').length === 4, 'four difficulty cards');
    ok(d.querySelectorAll('#level-menu .level-opt').length === 4, 'level menu built with 4 options');
    ok(d.querySelector('.home-top .hub-link').getAttribute('href') === '../', 'All games link points to the hub');
    ok(!d.getElementById('hint-link'), 'no Hint control');
    ok(!d.getElementById('reset-btn'), 'no Reset control');
    ok(d.querySelectorAll('#screen-game .btn').length === 1, 'exactly one real button on the game screen');
    ok($('next-btn').classList.contains('hide'), 'Play again hidden during play');
  }

  console.log('— a full round, driven through the DOM —');
  {
    const { w, d, $, cells } = fresh(true);   // reduced motion => near-zero delays
    $('start-btn').click();
    ok($('screen-home').classList.contains('hide'), 'start screen hidden after Start');
    ok(!$('screen-game').classList.contains('hide'), 'game screen shown after Start');
    ok(cells().every(c => c.textContent === ''), 'board starts empty');

    // play until the round ends, always taking the first legal square
    let guard = 0;
    while ($('result-view').classList.contains('hide') && guard++ < 60) {
      const free = cells().filter(c => !c.disabled);
      if (!free.length) { await playTo(w, d, 30); continue; }
      const before = cells().filter(c => c.textContent.trim()).length;
      free[0].click();
      await playTo(w, d, 60);
      // occupied squares must reject clicks
      const taken = cells().find(c => c.textContent.trim());
      if (taken) { const t = taken.textContent; taken.click(); ok(taken.textContent === t, 'clicking an occupied square does nothing'); }
    }
    ok(guard < 60, 'the round reached a result');
    ok(!$('result-view').classList.contains('hide'), 'result view shown');
    ok(!$('next-btn').classList.contains('hide'), 'Play again button shown in the bottom slot');
    ok($('skip-btn').classList.contains('invisible'), 'Skip hidden with .invisible (keeps its box)');
    ok(!$('skip-btn').classList.contains('hide'), 'Skip is NOT display:none — the top bar must not reflow');
    ok(/win|owl|tie|Whew/i.test($('rlabel').textContent), 'result label set: ' + JSON.stringify($('rlabel').textContent));

    $('next-btn').click();
    await playTo(w, d, 40);
    ok($('result-view').classList.contains('hide'), 'Play again clears the result view');
    ok(!$('skip-btn').classList.contains('invisible'), 'Skip restored for the new round');
    ok(cells().filter(c => c.textContent.trim()).length <= 1, 'board reset for the new round');
  }

  console.log('— fading: exactly the oldest mark, and never the owl\'s on hidden levels —');
  for (const [level, oppVisible] of [['EASY', true], ['MEDIUM', false], ['HARD', true], ['EXPERT', false]]) {
    const { w, d, $, cells } = fresh(true);
    d.querySelector(`.diff[data-diff="${level}"]`).click();
    $('start-btn').click();
    const K = level === 'EASY' || level === 'MEDIUM' ? 2 : 3;
    let sawMyFade = false, oppFadeSeen = false, guard = 0;
    // a short round can end before either side reaches its limit, so play several
    for (let gameNo = 0; gameNo < 10; gameNo++) {
    if (gameNo) { $('next-btn').click(); await playTo(w, d, 40); }
    guard = 0;
    while ($('result-view').classList.contains('hide') && guard++ < 60) {
      const free = cells().filter(c => !c.disabled);
      if (!free.length) { await playTo(w, d, 30); continue; }
      free[Math.floor(w.Math.random() * free.length)].click();
      await playTo(w, d, 60);
      const cs = cells();
      const xs = cs.filter(c => c.textContent.includes('✕'));
      const os = cs.filter(c => c.textContent.includes('◯'));
      const xf = xs.filter(c => c.classList.contains('fading'));
      const of_ = os.filter(c => c.classList.contains('fading'));
      // the winner legitimately keeps K+1 marks — the win check runs before eviction
      const live = $('result-view').classList.contains('hide');
      if (live) {
        ok(xs.length <= K, `${level}: never more than ${K} of my marks between turns (saw ${xs.length})`);
        ok(os.length <= K, `${level}: never more than ${K} owl marks between turns (saw ${os.length})`);
        ok(xs.length < K ? xf.length === 0 : xf.length === 1, `${level}: my fade shows exactly at the limit`);
      } else {
        ok(xs.length <= K + 1 && os.length <= K + 1, `${level}: at most ${K + 1} marks even on the winning frame`);
      }
      ok(xf.length <= 1 && of_.length <= 1, `${level}: at most one fading mark per side`);
      if (xf.length) sawMyFade = true;
      if (of_.length) oppFadeSeen = true;
      // the hidden-info guarantee: no DOM signal of the owl's age on MEDIUM/EXPERT
      if (!oppVisible) for (const c of os) {
        ok(!c.classList.contains('fading'), `${level}: owl mark must not be marked fading`);
        ok(!/fading/.test(c.getAttribute('aria-label') || ''), `${level}: owl aria-label must not say fading`);
        ok(![...c.attributes].some(a => /^data-(age|fad)/.test(a.name)), `${level}: no data-* age attribute on owl cells`);
      }
    }
    }
    ok(sawMyFade, `${level}: my own fading mark was shown at some point`);
    ok(oppVisible ? true : !oppFadeSeen, `${level}: owl fade hidden as the level promises`);
    if (oppVisible) ok(oppFadeSeen, `${level}: owl fade actually shown when the level promises it`);
    console.log(`  ${level}: ok (owl fade ${oppFadeSeen ? 'shown' : 'hidden'})`);
  }

  console.log('— the vanishing mark must wear its OWN symbol —');
  {
    // full animation delays so the vanish frame is actually on screen long enough to sample
    const { w, d, $, cells } = fresh(false);
    $('start-btn').click();
    let seenVanish = 0, guard = 0;
    let prev = cells().map(c => c.textContent.trim());
    // poll fast, and every time a .vanish span exists check it matches what was in that
    // cell a moment ago (this is what caught your ✕ fading out as an ◯)
    const poll = setInterval(() => {
      const cs = cells();
      cs.forEach((c, i) => {
        const v = c.querySelector('.vanish');
        if (v) {
          seenVanish++;
          ok(prev[i] !== '' && v.textContent === prev[i],
            `square ${i}: vanishing glyph ${JSON.stringify(v.textContent)} must match the mark that was there ${JSON.stringify(prev[i])}`);
          ok(v.classList.contains(prev[i] === '✕' ? 'x' : 'o'),
            `square ${i}: vanishing mark keeps its own colour class`);
        }
      });
      // only remember settled (non-animating) contents as "what was there"
      if (!d.querySelector('.vanish')) prev = cs.map(c => c.textContent.trim());
    }, 12);
    while ($('result-view').classList.contains('hide') && guard++ < 40) {
      const free = cells().filter(c => !c.disabled);
      if (!free.length) { await playTo(w, d, 60); continue; }
      free[Math.floor(w.Math.random() * free.length)].click();
      await playTo(w, d, 1300);   // one full place -> fade -> owl-replies cycle
    }
    clearInterval(poll);
    ok(seenVanish > 0, `the vanish animation was actually observed (${seenVanish} frames)`);
    console.log(`  sampled ${seenVanish} vanish frames`);
  }

  console.log('— level switch mid-game, Skip, Home —');
  {
    const { w, d, $, cells } = fresh(true);
    $('start-btn').click();
    cells().find(c => !c.disabled).click();
    await playTo(w, d, 60);
    d.querySelector('#level-menu .level-opt[data-diff="EXPERT"]').click();
    await playTo(w, d, 40);
    ok($('q-level-label').textContent.includes('Expert'), 'level chip label updated to Expert');
    ok(cells().filter(c => c.textContent.trim()).length === 0, 'switching level starts a fresh board');
    ok(d.querySelector('#level-menu').classList.contains('open') === false, 'level menu closed after picking');

    cells().find(c => !c.disabled).click();
    await playTo(w, d, 60);
    $('skip-btn').click();
    await playTo(w, d, 40);
    ok(cells().filter(c => c.textContent.trim()).length === 0, 'Skip starts a fresh board');

    $('home-btn').click();
    ok(!$('screen-home').classList.contains('hide'), 'Home returns to the start screen');
    ok($('screen-game').classList.contains('hide'), 'game screen hidden after Home');
  }

  console.log('— leaving mid-turn: no stale beat may land on the next round —');
  for (const [name, leave] of [
    ['Home',  ($) => $('home-btn').click()],
    ['Skip',  ($) => $('skip-btn').click()],
    ['level', (_, d) => d.querySelector('#level-menu .level-opt[data-diff="HARD"]').click()],
  ]) {
    const { w, d, $, cells } = fresh(false);   // full animation delays => real timers in flight
    $('start-btn').click();
    cells().find(c => !c.disabled).click();
    await playTo(w, d, 30);                    // interrupt WHILE the owl is thinking
    leave($, d);
    const marksRightAfter = cells().filter(c => c.textContent.trim()).length;
    await playTo(w, d, 1600);                  // let every orphaned timer fire
    const marksLater = cells().filter(c => c.textContent.trim()).length;
    if (name === 'Home') {
      ok(!$('screen-home').classList.contains('hide'), 'Home: still on the start screen');
    }
    ok(marksLater === marksRightAfter,
      `${name} mid-turn: board must not change afterwards (was ${marksRightAfter}, now ${marksLater})`);
    console.log(`  ${name} mid-turn: ok`);
  }

  console.log('— keyboard —');
  {
    const { w, d, $, cells } = fresh(true);
    $('start-btn').click();
    const ev = k => { const e = new w.KeyboardEvent('keydown', { key: k, bubbles: true }); d.dispatchEvent(e); };
    ev('5');
    await playTo(w, d, 60);
    ok(cells()[4].textContent.includes('✕'), 'pressing 5 places on the centre square');
    ev('Escape');
    ok(!d.querySelector('#level-menu').classList.contains('open'), 'Escape leaves the level menu closed');
  }

  report('tick-tock-toe play-through');
})();
