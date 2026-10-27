(function () {
  'use strict';

  // Version-stamped singleton: a click on an up-to-date copy toggles it off;
  // a stale copy from an older version is torn down and replaced.
  const VERSION = 4;
  const LINE_ID = '__grd-line';
  const PANEL_ID = '__grd-panel';
  const BEAT_MS = 1000;          // one beat at 60 bpm
  const BEATS_PER_CYCLE = 4;     // one full gradient sweep = one bar
  const MIN_BPM = 60, MAX_BPM = 105;
  const STORE_KEY = '__grd-bpm';

  const prev = window.__grd;
  if (prev) {
    prev.teardown();
    window.__grd = null;
    if (prev.version === VERSION) return; // toggled off
  }

  const line = document.createElement('div');
  line.id = LINE_ID;
  line.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 3px;
    z-index: 2147483647;
    pointer-events: none;
    background: linear-gradient(90deg, #d62828, #ffffff, #111111, #ffd60a, #111111, #1d4ed8, #ffffff, #d62828);
    background-size: 200% 100%;
  `;
  (document.body || document.documentElement).appendChild(line);

  // Web Animations API (no <style> keyframes, so page CSP can't block it);
  // static gradient if the system asks for reduced motion.
  let anim = null;
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    anim = line.animate(
      [{ backgroundPosition: '0 0' }, { backgroundPosition: '-200% 0' }],
      { duration: BEAT_MS * BEATS_PER_CYCLE, iterations: Infinity, easing: 'linear' }
    );
  }

  // ---- Tempo modal ---------------------------------------------------
  // Tempo in bpm; playbackRate = bpm / 60 so one sweep is always 4 beats.
  // updatePlaybackRate() changes speed from the current position (no jump).
  // The blink dot runs on the same rate, so it stays in time with the line.
  let bpm = MIN_BPM;
  try {
    const saved = parseInt(localStorage.getItem(STORE_KEY), 10);
    if (saved >= MIN_BPM && saved <= MAX_BPM) bpm = saved;
  } catch (e) {}
  if (anim) anim.updatePlaybackRate(bpm / 60);

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.style.cssText = `
    position: fixed; top: 12px; right: 12px;
    z-index: 2147483647;
    width: 220px; padding: 12px 14px;
    background: #111; color: #fff;
    border: 1px solid #444; border-radius: 8px;
    font: 13px/1.4 system-ui, sans-serif;
    box-shadow: 0 4px 16px rgba(0,0,0,.4);
  `;

  const head = document.createElement('div');
  head.style.cssText = 'display:flex; justify-content:space-between; margin-bottom:8px;';
  const title = document.createElement('span');
  title.textContent = 'Tempo';
  const readout = document.createElement('span');
  const dot = document.createElement('span');
  dot.style.cssText = 'display:inline-block; width:10px; height:10px; border-radius:50%; ' +
    'background:#d62828; margin-right:8px; vertical-align:middle;';
  title.prepend(dot);
  head.append(title, readout);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(MIN_BPM); slider.max = String(MAX_BPM); slider.step = '1';
  slider.value = String(bpm);
  slider.style.cssText = 'width:100%; margin:0 0 10px;';

  const btnCss = 'flex:1; padding:4px 0; border:1px solid #555; border-radius:5px; ' +
    'background:#222; color:#fff; font:inherit; cursor:pointer;';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex; gap:8px;';
  const done = document.createElement('button');
  done.textContent = 'Done';
  done.style.cssText = btnCss;
  const off = document.createElement('button');
  off.textContent = 'Remove line';
  off.style.cssText = btnCss;
  row.append(done, off);

  // Metronome blink: bright on the beat, fading until the next one.
  let blink = null;
  if (anim) {
    blink = dot.animate(
      [{ opacity: 1 }, { opacity: 0.15 }],
      { duration: BEAT_MS, iterations: Infinity, easing: 'ease-out' }
    );
    blink.updatePlaybackRate(bpm / 60);
  }

  function show() {
    readout.textContent = anim ? bpm + ' bpm' : 'static';
  }
  show();
  if (!anim) slider.disabled = true; // reduced-motion: nothing to speed up

  slider.addEventListener('input', () => {
    bpm = parseInt(slider.value, 10);
    if (anim) {
      anim.updatePlaybackRate(bpm / 60);
      blink.updatePlaybackRate(bpm / 60);
    }
    show();
    try { localStorage.setItem(STORE_KEY, String(bpm)); } catch (e) {}
  });
  done.addEventListener('click', () => { panel.style.display = 'none'; });
  off.addEventListener('click', () => { window.__grd && window.__grd.teardown(); window.__grd = null; });

  panel.append(head, slider, row);
  (document.body || document.documentElement).appendChild(panel);

  window.__grd = {
    version: VERSION,
    teardown() {
      if (anim) { anim.cancel(); blink.cancel(); }
      line.remove();
      panel.remove();
    },
  };
})();
