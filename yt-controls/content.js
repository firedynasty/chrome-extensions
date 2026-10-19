(function () {
  'use strict';

  const BAR_ID    = 'yt-controls-bar';
  const SPACER_ID = 'yt-controls-spacer';
  const VER       = 11;

  // ── helpers ──────────────────────────────────────────────────────────────

  function video() { return document.querySelector('video'); }

  function skip(sec) {
    const v = video();
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.currentTime + sec, v.duration || Infinity));
  }

  function changeVolume(delta) {
    // Dispatch ArrowUp/ArrowDown on #movie_player — same path YouTube's own
    // keyboard handler uses, so both audio and the volume UI update correctly.
    // Each arrow press = 5%, so 2 presses = 10%.
    const player = document.querySelector('#movie_player');
    if (!player) { flashStatus('No video', '#e74c3c'); return; }
    const key = delta > 0 ? 'ArrowUp' : 'ArrowDown';
    const steps = Math.round(Math.abs(delta) * 100 / 5);
    // Blur any focused input so YouTube doesn't swallow the event elsewhere
    const prev = document.activeElement;
    if (prev && ['INPUT', 'TEXTAREA', 'SELECT'].includes(prev.tagName)) prev.blur();
    player.focus();
    for (let i = 0; i < steps; i++) {
      player.dispatchEvent(new KeyboardEvent('keydown', {
        key, bubbles: true, cancelable: true,
        keyCode: delta > 0 ? 38 : 40, which: delta > 0 ? 38 : 40,
      }));
    }
    // Show new volume after YouTube processes the events
    setTimeout(() => {
      if (typeof player.getVolume === 'function') {
        flashStatus('Vol ' + player.getVolume() + '%', '#2ecc71');
      }
      if (prev && prev !== player && typeof prev.focus === 'function') prev.focus();
    }, 50);
  }

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) return '--:--';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const mm = String(m).padStart(h ? 2 : 1, '0');
    const ss = String(s).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function secsToHMS(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
  }

  function parseHMS(ts) {
    const parts = ts.split(':').map(Number);
    if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }

  let _timeInterval = null;

  // ── custom number-key spots ──────────────────────────────────────────────
  // Text like "1=1:30, 2=5:00" maps number keys to timestamps, replacing
  // YouTube's built-in 0-9 percentage jumps. Stored per video in localStorage.
  let _spots = {};
  let _keysInput = null;
  let _kbHandler = null;

  function keysStorageKey() {
    return '__ytc_keys_' + (new URLSearchParams(location.search).get('v') || '');
  }

  // A colon is required in every time: m:ss or h:mm:ss. Anything else is
  // reported in `bad` instead of being guessed at.
  function parseSpots(text) {
    const map = {};
    const bad = [];
    text.split(/[,\n]/).forEach(tok => {
      const t = tok.trim();
      if (!t) return;
      const m = t.match(/^(\S)\s*=\s*(\d+(?::\d+){1,2})$/);
      if (m) map[m[1]] = parseHMS(m[2]); else bad.push(t);
    });
    return { map, bad };
  }

  function loadSpots() {
    let raw = '';
    try { raw = localStorage.getItem(keysStorageKey()) || ''; } catch (e) {}
    if (_keysInput) _keysInput.value = raw;
    _spots = parseSpots(raw).map;
  }

  function saveSpots(text) {
    try { localStorage.setItem(keysStorageKey(), text); } catch (e) {}
    const { map, bad } = parseSpots(text);
    _spots = map;
    const n = Object.keys(map).length;
    if (bad.length) flashStatus('Not understood: ' + bad.join(', ') + ' (use key=m:ss)', '#e74c3c');
    else flashStatus(n + ' key' + (n === 1 ? '' : 's') + ' set', '#2ecc71');
  }

  function startTimeClock(spanEl) {
    stopTimeClock();
    _timeInterval = setInterval(() => {
      const v = video();
      spanEl.textContent = v ? fmtTime(v.currentTime) : '--:--';
    }, 500);
  }

  function stopTimeClock() {
    if (_timeInterval) { clearInterval(_timeInterval); _timeInterval = null; }
  }

  // ── 3m repeat timer (x8) ────────────────────────────────────────────────
  const T4_DURATION_MS = 3 * 60 * 1000; // 3 minutes
  const T4_TOTAL_LOOPS = 8;
  let t4Timeout = null;
  let t4LoopsRemaining = 0;
  let t4Generation = 0;

  function resetT4Btn(t4Btn) {
    t4Btn.textContent = '⏱️ 3m';
    t4Btn.style.background = 'linear-gradient(45deg,#ab47bc,#8e24aa)';
  }

  function cancelT4(t4Btn) {
    t4Generation++;
    if (t4Timeout) { clearTimeout(t4Timeout); t4Timeout = null; }
    resetT4Btn(t4Btn);
    flashStatus('Timer cancelled', '#e74c3c');
  }

  function runT4Loop(t4Btn, t4TsInput, gen) {
    const currentLoop = T4_TOTAL_LOOPS - t4LoopsRemaining + 1;
    t4Btn.textContent = `⏹️ ${currentLoop}/${T4_TOTAL_LOOPS}`;
    flashStatus(`3m loop ${currentLoop}/${T4_TOTAL_LOOPS}`, '#ab47bc');
    t4Timeout = setTimeout(() => {
      if (gen !== t4Generation) return;
      t4LoopsRemaining--;
      const seekTo = /^\d+(?::\d+){1,2}$/.test(t4TsInput.value.trim()) ? parseHMS(t4TsInput.value.trim()) : null;
      if (seekTo === null) { cancelT4(t4Btn); flashStatus('Loop-back time needs a colon (m:ss)', '#e74c3c'); return; }
      const v = video(); if (v) v.currentTime = seekTo;
      if (t4LoopsRemaining > 0) {
        runT4Loop(t4Btn, t4TsInput, gen);
      } else {
        t4Timeout = null;
        resetT4Btn(t4Btn);
        flashStatus(`3m complete (${T4_TOTAL_LOOPS}/${T4_TOTAL_LOOPS})`, '#2ecc71');
      }
    }, T4_DURATION_MS);
  }

  function toggleT4(t4Btn, t4TsInput) {
    if (t4Timeout) { cancelT4(t4Btn); return; }
    const v = video();
    if (!v) { flashStatus('No video', '#e74c3c'); return; }
    // Default loop-back point = where you are now; edit the input to override
    t4TsInput.value = secsToHMS(v.currentTime);
    t4LoopsRemaining = T4_TOTAL_LOOPS;
    t4Generation++;
    runT4Loop(t4Btn, t4TsInput, t4Generation);
  }

  // ── bar ──────────────────────────────────────────────────────────────────

  let _flashStatusFn = null;

  function flashStatus(msg, color) {
    if (_flashStatusFn) _flashStatusFn(msg, color);
  }

  function injectBar() {
    if (document.getElementById(BAR_ID)) return;
    if (!location.pathname.startsWith('/watch')) return;

    const player = document.querySelector('ytd-player');
    if (!player) return;

    const bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.dataset.ver = VER;
    bar.style.cssText = `
      position: sticky;
      top: 56px;
      z-index: 2200;
      background: #0d0d1a;
      border-bottom: 2px solid #3ea6ff55;
      padding: 6px 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      flex-wrap: wrap;
    `;

    function btn(label, bg, color, title) {
      const b = document.createElement('button');
      b.textContent = label;
      if (title) b.title = title;
      b.style.cssText = `
        padding: 5px 12px;
        border: none;
        border-radius: 5px;
        background: ${bg};
        color: ${color};
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
      `;
      return b;
    }

    // ── custom skip + clock ────────────────────────────────
    const customInput = document.createElement('input');
    customInput.type = 'number';
    customInput.value = '15';
    customInput.title = 'Custom skip in seconds (negative skips back)';
    customInput.style.cssText = `
      width: 52px;
      padding: 3px 5px;
      border: 1px solid #555;
      border-radius: 5px;
      background: #1a1a1a;
      color: #ddd;
      font-size: 12px;
      font-family: monospace;
    `;
    const customGo = btn('Skip', '#2980b9', '#fff', 'Skip by the custom number of seconds');
    function doCustomSkip() {
      const n = parseFloat(customInput.value);
      if (!isFinite(n)) { flashStatus('Enter seconds', '#e74c3c'); return; }
      skip(n);
      flashStatus((n >= 0 ? '+' : '') + n + 's', '#64b5f6');
    }
    customGo.addEventListener('click', doCustomSkip);
    customInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') doCustomSkip();
    });
    customInput.addEventListener('keyup', (e) => e.stopPropagation());

    const timeSpan = document.createElement('span');
    timeSpan.id = 'yt-ctrl-time';
    timeSpan.textContent = '--:--';
    timeSpan.style.cssText = `
      margin-left: 4px;
      margin-right: 8px;
      font-size: 13px;
      font-weight: 700;
      color: #e0e0e0;
      font-family: 'Courier New', monospace;
      white-space: nowrap;
    `;

    // ── volume buttons ────────────────────────────────────────────────────
    const volDownBtn = btn('🔉', '#37474f', '#fff', 'Volume down 10%');
    const volUpBtn   = btn('🔊', '#37474f', '#fff', 'Volume up 10%');
    volDownBtn.addEventListener('click', () => changeVolume(-0.1));
    volUpBtn  .addEventListener('click', () => changeVolume(+0.1));

    // ── speed toggle button ───────────────────────────────────────────────
    const speedBtn = btn('0.5x', '#37474f', '#fff', 'Toggle 0.5x / 1x speed');
    let speedSlow = false;
    speedBtn.addEventListener('click', () => {
      const v = video();
      speedSlow = !speedSlow;
      const rate = speedSlow ? 0.5 : 1;
      if (v) v.playbackRate = rate;
      speedBtn.textContent = speedSlow ? '1x' : '0.5x';
      speedBtn.title = speedSlow ? 'Switch to 1x speed' : 'Switch to 0.5x speed';
      flashStatus(speedSlow ? 'Speed 0.5x' : 'Speed 1x', '#64b5f6');
    });

    // ── 3m timer: loop-back timestamp input + button ──────────────────────
    const t4TsInput = document.createElement('input');
    t4TsInput.type = 'text';
    t4TsInput.value = '00:00:00';
    t4TsInput.placeholder = '00:00:00';
    t4TsInput.title = 'Loop back to this timestamp (HH:MM:SS). Starting the timer fills in the current time; edit it afterwards to pick a different spot.';
    t4TsInput.style.cssText = `
      width: 68px;
      padding: 3px 5px;
      border: 1px solid #555;
      border-radius: 5px;
      background: #1a1a1a;
      color: #ddd;
      font-size: 11px;
      font-family: monospace;
    `;
    t4TsInput.addEventListener('keydown', (e) => e.stopPropagation());
    t4TsInput.addEventListener('keyup',   (e) => e.stopPropagation());

    const t4Btn = document.createElement('button');
    t4Btn.textContent = '⏱️ 3m';
    t4Btn.title = 'Play 3m, rewind, repeat x8';
    t4Btn.style.cssText = `
      padding: 5px 12px;
      border: none;
      border-radius: 5px;
      background: linear-gradient(45deg,#ab47bc,#8e24aa);
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    `;
    t4Btn.addEventListener('click', () => toggleT4(t4Btn, t4TsInput));

    // ── custom number-key spots ───────────────────────────────────────────
    const keysInput = document.createElement('input');
    keysInput.type = 'text';
    keysInput.placeholder = '1=1:00';
    keysInput.title = 'Number keys to jump to timestamps, e.g. 1=1:30, 2=5:00 (Enter to save). Overrides YouTube\'s 0-9 percentage jumps while the video is focused.';
    keysInput.style.cssText = `
      width: 150px;
      padding: 3px 5px;
      border: 1px solid #555;
      border-radius: 5px;
      background: #1a1a1a;
      color: #ddd;
      font-size: 11px;
      font-family: monospace;
    `;
    keysInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { saveSpots(keysInput.value); keysInput.blur(); }
    });
    keysInput.addEventListener('keyup', (e) => e.stopPropagation());
    keysInput.addEventListener('change', () => saveSpots(keysInput.value));
    _keysInput = keysInput;

    // ── status flash ──────────────────────────────────────────────────────
    const statusSpan = document.createElement('span');
    statusSpan.style.cssText = 'font-size:11px; color:#888; white-space:nowrap; margin-left:4px;';
    let _statusTimer = null;

    _flashStatusFn = function(msg, color) {
      statusSpan.textContent = msg;
      statusSpan.style.color = color;
      if (_statusTimer) clearTimeout(_statusTimer);
      _statusTimer = setTimeout(() => {
        statusSpan.textContent = '';
        _statusTimer = null;
      }, 2500);
    };

    bar.append(customInput, customGo, timeSpan, volDownBtn, volUpBtn, speedBtn, keysInput, t4TsInput, t4Btn, statusSpan);

    player.parentElement.insertBefore(bar, player);
    injectSpacer();
    startTimeClock(timeSpan);

    loadSpots();
    _kbHandler = function (e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!Object.prototype.hasOwnProperty.call(_spots, e.key)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const v = video();
      if (!v) return;
      v.currentTime = _spots[e.key];
      flashStatus('Key ' + e.key + ' \u2192 ' + fmtTime(_spots[e.key]), '#64b5f6');
    };
    document.addEventListener('keydown', _kbHandler, true);

    chrome.storage.local.get('ytCtrlBarHidden', (data) => {
      if (data.ytCtrlBarHidden) bar.style.display = 'none';
    });
  }

  // ── spacer (below player, above title) ───────────────────────────────────

  function injectSpacer() {
    if (document.getElementById(SPACER_ID)) return;
    const meta = document.querySelector('ytd-watch-metadata');
    if (!meta) return;
    const spacer = document.createElement('div');
    spacer.id = SPACER_ID;
    spacer.style.cssText = 'height: 2.2em;';
    meta.parentElement.insertBefore(spacer, meta);
  }

  function removeBar() {
    stopTimeClock();
    _flashStatusFn = null;
    _keysInput = null;
    if (_kbHandler) { document.removeEventListener('keydown', _kbHandler, true); _kbHandler = null; }
    if (t4Timeout) { clearTimeout(t4Timeout); t4Timeout = null; t4Generation++; }
    document.getElementById(BAR_ID)?.remove();
    document.getElementById(SPACER_ID)?.remove();
  }

  // ── SPA navigation ────────────────────────────────────────────────────────

  function handleNav() {
    if (location.pathname.startsWith('/watch')) {
      if (document.getElementById(BAR_ID)) { loadSpots(); return; }
      let attempts = 0;
      const timer = setInterval(() => {
        if (document.querySelector('ytd-player')) {
          clearInterval(timer);
          injectBar();
        } else if (++attempts > 20) {
          clearInterval(timer);
        }
      }, 150);
    } else {
      removeBar();
    }
  }

  // Toggle visibility from popup
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'ping') { sendResponse({ ok: true }); return true; }
    if (msg.action !== 'toggleBar') return true;
    const bar = document.getElementById(BAR_ID);
    if (!bar) { sendResponse({ hidden: true }); return true; }
    const nowHidden = bar.style.display !== 'none';
    bar.style.display = nowHidden ? 'none' : 'flex';
    chrome.storage.local.set({ ytCtrlBarHidden: nowHidden });
    sendResponse({ hidden: nowHidden });
    return true;
  });

  document.addEventListener('yt-navigate-finish', handleNav);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleNav);
  } else {
    handleNav();
  }
})();
