(function () {
  'use strict';

  const BAR_ID    = 'yt-controls-bar';
  const SPACER_ID = 'yt-controls-spacer';
  const VER       = 18;

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

  // ── birds (ambient loop with own volume slider) ─────────────────────────
  // Forest Birdsong (mp3), streamed from Dropbox.
  const BIRDS_URL = 'https://www.dropbox.com/scl/fi/x09bfk82awmzt89r1oxtp/Forest-Birdsong-Nature-Sounds-trimmed-30min-loudnorm-2G8LAiHSCAs.mp3?rlkey=7pydzw8pia681zyfijrjszqwi&st=mowf7s9e&raw=1';
  const BIRDS_VOL_KEY = '__ytc_birds_vol';
  let _birds = null;

  function birdsVolume() {
    let v = 30;
    try { const n = parseInt(localStorage.getItem(BIRDS_VOL_KEY), 10); if (n >= 0 && n <= 100) v = n; } catch (e) {}
    return v;
  }

  function stopBirds() {
    if (_birds) { _birds.pause(); _birds.removeAttribute('src'); _birds.load(); _birds = null; }
  }

  // ── timestamp pills ──────────────────────────────────────────────────────
  // Type m:ss or h:mm:ss (colon required) + Enter to add a pill; click a pill
  // to jump there. Stored per video in localStorage as a JSON array of seconds.
  let _pills = [];
  let _pillBox = null;
  let _pillClear = null;

  function pillsStorageKey() {
    return '__ytc_pills_' + (new URLSearchParams(location.search).get('v') || '');
  }

  function loadPills() {
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem(pillsStorageKey()) || '[]'); } catch (e) {}
    _pills = Array.isArray(arr) ? arr.filter(n => typeof n === 'number' && isFinite(n)) : [];
    renderPills();
  }

  function savePills() {
    try { localStorage.setItem(pillsStorageKey(), JSON.stringify(_pills)); } catch (e) {}
  }

  function renderPills() {
    if (!_pillBox) return;
    _pillBox.textContent = '';
    if (_pillClear) _pillClear.style.display = _pills.length ? '' : 'none';
    _pills.forEach((sec) => {
      const pill = document.createElement('span');
      pill.style.cssText = `
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        background: #1e3a5f;
        color: #90caf9;
        font-size: 12px;
        font-weight: 700;
        font-family: 'Courier New', monospace;
        overflow: hidden;
      `;
      const go = document.createElement('button');
      go.textContent = fmtTime(sec);
      go.title = 'Jump to ' + fmtTime(sec);
      go.style.cssText = 'padding:3px 10px; border:none; background:none; color:inherit; font:inherit; cursor:pointer;';
      go.addEventListener('click', () => {
        const v = video();
        if (v) v.currentTime = sec;
      });
      pill.appendChild(go);
      _pillBox.appendChild(pill);
    });
  }

  function addPillFromText(text) {
    const t = text.trim();
    if (!/^\d+(?::\d+){1,2}$/.test(t)) {
      flashStatus('Use m:ss or h:mm:ss (colon required)', '#e74c3c');
      return false;
    }
    _pills.push(parseHMS(t));
    savePills();
    renderPills();
    return true;
  }

  // ── activity line: spectrum strip under the bar while birds or the loop timer run
  let _activeLine = null;
  let _activeLineAnim = null;

  function updateActiveLine() {
    if (!_activeLine) return;
    const on = !!(_birds || t4Timeout);
    _activeLine.style.display = on ? 'block' : 'none';
    if (on && !_activeLineAnim && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Web Animations API (no <style> keyframes, so page CSP can't block it)
      _activeLineAnim = _activeLine.animate(
        [{ backgroundPosition: '0 0' }, { backgroundPosition: '-200% 0' }],
        { duration: 5000, iterations: Infinity, easing: 'linear' }
      );
    } else if (!on && _activeLineAnim) {
      _activeLineAnim.cancel();
      _activeLineAnim = null;
    }
  }

  function startTimeClock(spanEl) {
    stopTimeClock();
    _timeInterval = setInterval(() => {
      const v = video();
      spanEl.textContent = v ? fmtTime(v.currentTime) : '--:--';
      updateActiveLine();
    }, 500);
  }

  function stopTimeClock() {
    if (_timeInterval) { clearInterval(_timeInterval); _timeInterval = null; }
  }

  // ── 3m repeat timer (x8) ────────────────────────────────────────────────
  const T4_DEFAULT_SECS = 180; // 3 minutes
  const T4_LEN_KEY = '__ytc_loop_secs';
  const T4_DEFAULT_LOOPS = 8;
  const T4_LOOPS_KEY = '__ytc_loop_count';
  let _t4LenInput = null;
  let _t4CountInput = null;
  let t4Timeout = null;
  let t4Done = 0;
  let t4Generation = 0;

  // Loop length in seconds, read from the number box (falls back to 3m)
  function t4Secs() {
    const n = _t4LenInput ? parseFloat(_t4LenInput.value) : NaN;
    return isFinite(n) && n >= 1 ? n : T4_DEFAULT_SECS;
  }

  // Number of repeats, read from the x-box (whole number 1-99, falls back to 8)
  function t4Loops() {
    const n = _t4CountInput ? parseInt(_t4CountInput.value, 10) : NaN;
    return n >= 1 && n <= 99 ? n : T4_DEFAULT_LOOPS;
  }

  function t4Name(secs) {
    return secs >= 60 && secs % 60 === 0 ? (secs / 60) + 'm' : secs + 's';
  }

  function updateT4Idle(t4Btn) {
    const name = t4Name(t4Secs());
    t4Btn.textContent = '⏱️ ' + name;
    t4Btn.title = 'Play ' + name + ', rewind, repeat x' + t4Loops();
  }

  function resetT4Btn(t4Btn) {
    updateT4Idle(t4Btn);
    t4Btn.style.background = 'linear-gradient(45deg,#ab47bc,#8e24aa)';
  }

  function cancelT4(t4Btn) {
    t4Generation++;
    if (t4Timeout) { clearTimeout(t4Timeout); t4Timeout = null; }
    resetT4Btn(t4Btn);
    flashStatus('Timer cancelled', '#e74c3c');
  }

  function runT4Loop(t4Btn, t4TsInput, gen) {
    const currentLoop = t4Done + 1;
    t4Btn.textContent = `⏹️ ${currentLoop}/${t4Loops()}`;
    const loopSecs = t4Secs();
    flashStatus(`${t4Name(loopSecs)} loop ${currentLoop}/${t4Loops()}`, '#ab47bc');
    t4Timeout = setTimeout(() => {
      if (gen !== t4Generation) return;
      t4Done++;
      const seekTo = /^\d+(?::\d+){1,2}$/.test(t4TsInput.value.trim()) ? parseHMS(t4TsInput.value.trim()) : null;
      if (seekTo === null) { cancelT4(t4Btn); flashStatus('Loop-back time needs a colon (m:ss)', '#e74c3c'); return; }
      const v = video(); if (v) v.currentTime = seekTo;
      if (t4Done < t4Loops()) {
        runT4Loop(t4Btn, t4TsInput, gen);
      } else {
        t4Timeout = null;
        resetT4Btn(t4Btn);
        flashStatus(`${t4Name(loopSecs)} complete (${t4Done}/${t4Done})`, '#2ecc71');
      }
    }, loopSecs * 1000);
  }

  function toggleT4(t4Btn, t4TsInput) {
    if (t4Timeout) { cancelT4(t4Btn); return; }
    const v = video();
    if (!v) { flashStatus('No video', '#e74c3c'); return; }
    // Default loop-back point = where you are now; edit the input to override
    t4TsInput.value = secsToHMS(v.currentTime);
    t4Done = 0;
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

    const t4LenInput = document.createElement('input');
    t4LenInput.type = 'number';
    t4LenInput.min = '1';
    t4LenInput.title = 'Loop length in seconds (180 = 3m). Applies from the next loop if the timer is running.';
    t4LenInput.style.cssText = `
      width: 52px;
      padding: 3px 5px;
      border: 1px solid #555;
      border-radius: 5px;
      background: #1a1a1a;
      color: #ddd;
      font-size: 12px;
      font-family: monospace;
    `;
    let savedLen = T4_DEFAULT_SECS;
    try { const n = parseFloat(localStorage.getItem(T4_LEN_KEY)); if (isFinite(n) && n >= 1) savedLen = n; } catch (e) {}
    t4LenInput.value = String(savedLen);
    t4LenInput.addEventListener('keydown', (e) => e.stopPropagation());
    t4LenInput.addEventListener('keyup',   (e) => e.stopPropagation());
    _t4LenInput = t4LenInput;

    const t4CountInput = document.createElement('input');
    t4CountInput.type = 'number';
    t4CountInput.min = '1';
    t4CountInput.max = '99';
    t4CountInput.title = 'Number of repeats (1-99). Applies from the next loop if the timer is running.';
    t4CountInput.style.cssText = `
      width: 38px;
      padding: 3px 4px;
      border: 1px solid #555;
      border-radius: 5px;
      background: #1a1a1a;
      color: #ddd;
      font-size: 12px;
      font-family: monospace;
    `;
    let savedCount = T4_DEFAULT_LOOPS;
    try { const n = parseInt(localStorage.getItem(T4_LOOPS_KEY), 10); if (n >= 1 && n <= 99) savedCount = n; } catch (e) {}
    t4CountInput.value = String(savedCount);
    t4CountInput.addEventListener('keydown', (e) => e.stopPropagation());
    t4CountInput.addEventListener('keyup',   (e) => e.stopPropagation());
    _t4CountInput = t4CountInput;

    const t4CountX = document.createElement('span');
    t4CountX.textContent = '\u00D7';
    t4CountX.style.cssText = 'color:#888; font-size:12px; margin-right:-3px;';

    const t4Btn = document.createElement('button');
    updateT4Idle(t4Btn);
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
    t4CountInput.addEventListener('input', () => {
      try { localStorage.setItem(T4_LOOPS_KEY, t4CountInput.value); } catch (e) {}
      if (!t4Timeout) updateT4Idle(t4Btn);
    });
    t4LenInput.addEventListener('input', () => {
      try { localStorage.setItem(T4_LEN_KEY, t4LenInput.value); } catch (e) {}
      if (!t4Timeout) updateT4Idle(t4Btn);
    });

    // ── birds button + volume slider ──────────────────────────────────────
    const birdsBtn = btn('🐦', '#37474f', '#fff', 'Toggle forest birdsong');
    const birdsSlider = document.createElement('input');
    birdsSlider.type = 'range';
    birdsSlider.min = '0';
    birdsSlider.max = '100';
    birdsSlider.value = String(birdsVolume());
    birdsSlider.title = 'Birds volume';
    birdsSlider.style.cssText = 'width: 80px; cursor: pointer;';
    function setBirdsOn(on) {
      birdsBtn.style.background = on ? '#2e7d32' : '#37474f';
    }
    birdsBtn.addEventListener('click', () => {
      if (_birds) { stopBirds(); setBirdsOn(false); flashStatus('Birds off', '#888'); return; }
      const a = new Audio(BIRDS_URL);
      a.loop = true;
      a.volume = birdsSlider.value / 100;
      a.addEventListener('error', () => {
        if (_birds !== a) return;
        stopBirds(); setBirdsOn(false);
        flashStatus('Birds unavailable', '#e74c3c');
      });
      _birds = a;
      setBirdsOn(true);
      a.play().then(() => flashStatus('Birds on', '#2ecc71')).catch(() => {
        if (_birds !== a) return;
        stopBirds(); setBirdsOn(false);
        flashStatus('Birds blocked', '#e74c3c');
      });
    });
    birdsSlider.addEventListener('input', () => {
      if (_birds) _birds.volume = birdsSlider.value / 100;
      try { localStorage.setItem(BIRDS_VOL_KEY, birdsSlider.value); } catch (e) {}
    });
    birdsSlider.addEventListener('keydown', (e) => e.stopPropagation());
    birdsSlider.addEventListener('keyup',   (e) => e.stopPropagation());

    // ── timestamp pills ───────────────────────────────────────────────────
    const pillInput = document.createElement('input');
    pillInput.type = 'text';
    pillInput.placeholder = '1:00';
    pillInput.title = 'Type a time (m:ss or h:mm:ss) and press Enter to add a pill you can click to jump there';
    pillInput.style.cssText = `
      width: 62px;
      padding: 3px 5px;
      border: 1px solid #555;
      border-radius: 5px;
      background: #1a1a1a;
      color: #ddd;
      font-size: 11px;
      font-family: monospace;
    `;
    pillInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && addPillFromText(pillInput.value)) pillInput.value = '';
    });
    pillInput.addEventListener('keyup', (e) => e.stopPropagation());

    const pillBox = document.createElement('span');
    pillBox.style.cssText = 'display:inline-flex; flex-wrap:wrap; gap:5px; align-items:center;';
    _pillBox = pillBox;

    const pillClear = btn('Clear', '#6b1a1a', '#fff', 'Remove all pills for this video');
    pillClear.style.display = 'none';
    pillClear.addEventListener('click', () => {
      _pills = [];
      savePills();
      renderPills();
    });
    _pillClear = pillClear;

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

    // ── activity line (spectrum strip along the bottom edge of the bar) ───
    const activeLine = document.createElement('div');
    activeLine.style.cssText = `
      position: absolute;
      left: 0; right: 0; bottom: 0;
      height: 3px;
      display: none;
      pointer-events: none;
      background: linear-gradient(90deg, #d32f2f, #e07b2e, #f5e050, #8fe03a, #4cb85a, #6ff2ff, #3f8fe0, #5a1fc4, #d32f2f);
      background-size: 200% 100%;
    `;
    _activeLine = activeLine;

    bar.append(customInput, customGo, timeSpan, volDownBtn, volUpBtn, speedBtn, birdsBtn, birdsSlider, pillInput, pillBox, pillClear, t4TsInput, t4LenInput, t4CountX, t4CountInput, t4Btn, statusSpan, activeLine);

    player.parentElement.insertBefore(bar, player);
    injectSpacer();
    startTimeClock(timeSpan);

    loadPills();

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
    _pillBox = null;
    _pillClear = null;
    if (_activeLineAnim) { _activeLineAnim.cancel(); _activeLineAnim = null; }
    _activeLine = null;
    stopBirds();
    _t4LenInput = null;
    _t4CountInput = null;
    if (t4Timeout) { clearTimeout(t4Timeout); t4Timeout = null; t4Generation++; }
    document.getElementById(BAR_ID)?.remove();
    document.getElementById(SPACER_ID)?.remove();
  }

  // ── SPA navigation ────────────────────────────────────────────────────────

  function handleNav() {
    if (location.pathname.startsWith('/watch')) {
      if (document.getElementById(BAR_ID)) { loadPills(); return; }
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
