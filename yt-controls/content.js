(function () {
  'use strict';

  const BAR_ID    = 'yt-controls-bar';
  const SPACER_ID = 'yt-controls-spacer';
  const MODAL_ID  = 'yt-ctrl-import-modal';
  const VER       = 3;
  const VIEWER_BASE = 'https://vercel-youtubeviewer.vercel.app/';

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

  function parseTs(ts) {
    const parts = ts.split(':').map(Number);
    return parts.length === 3
      ? parts[0] * 3600 + parts[1] * 60 + parts[2]
      : parts[0] * 60 + (parts[1] || 0);
  }

  function parseHashUrl(raw) {
    // Case 1: #? Vercel URL format
    const idx = raw.indexOf('#?');
    if (idx >= 0) {
      const inner = raw.slice(idx + 2);
      const tokens = inner.split(',');
      const videoUrl = tokens[0] || '';
      const videoId = (() => {
        try { return new URL(videoUrl).searchParams.get('v') || ''; } catch { return ''; }
      })();
      const stamps = [];
      for (let i = 1; i < tokens.length; i++) {
        const m = tokens[i].match(/^(\d+:\d+(?::\d+)?)(?:\(([^)]+)\))?/);
        if (m) stamps.push({ ts: m[1], note: (m[2] || '').replace(/_/g, ' ') });
      }
      return { stamps, videoId };
    }
    // Case 2: plain comma-separated timestamps, e.g. 1:00,2:00,3:00
    const tokens = raw.split(',');
    const stamps = [];
    for (const token of tokens) {
      const m = token.trim().match(/^(\d+:\d+(?::\d+)?)(?:\(([^)]+)\))?/);
      if (m) stamps.push({ ts: m[1], note: (m[2] || '').replace(/_/g, ' ') });
    }
    return { stamps, videoId: '' };
  }

  function currentVideoId() {
    return new URLSearchParams(location.search).get('v') || '';
  }

  function storageKey() {
    return '__lmx_' + currentVideoId();
  }

  let _timeInterval = null;
  let _stamps = [];
  let _kbHandler = null;

  // ── stamp loop engine (30s × 5) ──────────────────────────────────────────
  let _loopInterval = null;
  let _loopStart = 0;
  let _loopEnd = 0;
  let _loopRemaining = 0;

  function startStampLoop(startSec) {
    cancelStampLoop();
    const v = video();
    if (!v) return;
    _loopStart = startSec;
    _loopEnd = startSec + 30;
    _loopRemaining = 5;
    v.currentTime = startSec;
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
    _loopInterval = setInterval(() => {
      const vv = video();
      if (!vv) { cancelStampLoop(); return; }
      if (vv.currentTime >= _loopEnd - 0.03) {
        if (_loopRemaining > 1) {
          _loopRemaining--;
          vv.currentTime = _loopStart;
          const pp = vv.play();
          if (pp && pp.catch) pp.catch(() => {});
          setStatus('Loop ' + (5 - _loopRemaining + 1) + '/5', '#3ea6ff');
        } else {
          cancelStampLoop();
          flashStatus('Done \u2713', '#2ecc71');
        }
      }
    }, 40);
    setStatus('Loop 1/5', '#3ea6ff');
  }

  function cancelStampLoop() {
    if (_loopInterval) { clearInterval(_loopInterval); _loopInterval = null; }
  }

  // ── white noise ───────────────────────────────────────────────────────────
  let noiseCtx = null;
  let noiseGain = null;
  let noiseSource = null;
  let whiteNoiseActive = false;
  const NOISE_VOLUME = 0.01; // 1%

  function initWhiteNoise() {
    if (noiseCtx) return;
    noiseCtx = new AudioContext();
    const buf = noiseCtx.createBuffer(1, noiseCtx.sampleRate * 2, noiseCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseSource = noiseCtx.createBufferSource();
    noiseSource.buffer = buf;
    noiseSource.loop = true;
    noiseGain = noiseCtx.createGain();
    noiseGain.gain.value = 0;
    noiseSource.connect(noiseGain);
    noiseGain.connect(noiseCtx.destination);
    noiseSource.start();
  }

  function toggleWhiteNoise(noiseBtn) {
    initWhiteNoise();
    if (noiseCtx.state === 'suspended') noiseCtx.resume();
    whiteNoiseActive = !whiteNoiseActive;
    noiseGain.gain.value = whiteNoiseActive ? NOISE_VOLUME : 0;
    noiseBtn.style.background = whiteNoiseActive ? '#c9a84c' : '#37474f';
    noiseBtn.style.color = whiteNoiseActive ? '#1a1a2e' : '#fff';
    flashStatus(whiteNoiseActive ? 'Noise on (1%)' : 'Noise off', '#888');
  }

  // ── 30-second repeat timer ────────────────────────────────────────────────
  const T3_DURATION_MS = 30000;
  const T3_TOTAL_LOOPS = 10;
  const T3_FADE_MS = 2000;
  let t3Timeout = null;
  let t3LoopsRemaining = 0;
  let t3StartTime = 0;
  let t3SavedVolume = 1;
  let t3Generation = 0;

  function fadeVolTo(target, durationMs, gen) {
    return new Promise(resolve => {
      const v = video();
      if (!v) { resolve(); return; }
      const startVol = v.volume;
      const steps = 20;
      let i = 0;
      const iv = setInterval(() => {
        if (gen !== t3Generation) { clearInterval(iv); resolve(); return; }
        i++;
        const v2 = video();
        if (v2) v2.volume = Math.max(0, Math.min(1, startVol + (target - startVol) * (i / steps)));
        if (i >= steps) { clearInterval(iv); resolve(); }
      }, durationMs / steps);
    });
  }

  function cancelT3(timerBtn) {
    t3Generation++;
    if (t3Timeout) { clearTimeout(t3Timeout); t3Timeout = null; }
    const v = video();
    if (v) v.volume = t3SavedVolume;
    const player = document.querySelector('#movie_player');
    if (player && typeof player.setVolume === 'function') player.setVolume(Math.round(t3SavedVolume * 100));
    timerBtn.textContent = '⏱️ 30s';
    timerBtn.style.background = 'linear-gradient(45deg,#ff9800,#f57c00)';
    flashStatus('Timer cancelled', '#e74c3c');
  }

  function runT3Loop(timerBtn, gen) {
    const currentLoop = T3_TOTAL_LOOPS - t3LoopsRemaining + 1;
    timerBtn.textContent = `⏹️ ${currentLoop}/${T3_TOTAL_LOOPS}`;
    flashStatus(`30s loop ${currentLoop}/${T3_TOTAL_LOOPS}`, '#ff9800');
    t3Timeout = setTimeout(async () => {
      if (gen !== t3Generation) return;
      await fadeVolTo(0, T3_FADE_MS, gen);
      if (gen !== t3Generation) return;
      t3LoopsRemaining--;
      const v = video(); if (v) v.currentTime = t3StartTime;
      if (t3LoopsRemaining > 0) {
        await fadeVolTo(t3SavedVolume, 1000, gen);
        if (gen !== t3Generation) return;
        runT3Loop(timerBtn, gen);
      } else {
        t3Timeout = null;
        const v2 = video();
        if (v2) v2.volume = t3SavedVolume;
        const player = document.querySelector('#movie_player');
        if (player && typeof player.setVolume === 'function') player.setVolume(Math.round(t3SavedVolume * 100));
        timerBtn.textContent = '⏱️ 30s';
        timerBtn.style.background = 'linear-gradient(45deg,#ff9800,#f57c00)';
        flashStatus(`30s complete (${T3_TOTAL_LOOPS}/${T3_TOTAL_LOOPS})`, '#2ecc71');
      }
    }, T3_DURATION_MS - T3_FADE_MS);
  }

  function toggleT3(timerBtn) {
    if (t3Timeout) { cancelT3(timerBtn); return; }
    const v = video();
    if (!v) { flashStatus('No video', '#e74c3c'); return; }
    t3StartTime = v.currentTime;
    t3SavedVolume = v.volume || 1;
    t3LoopsRemaining = T3_TOTAL_LOOPS;
    t3Generation++;
    runT3Loop(timerBtn, t3Generation);
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

  // ── stamp storage ─────────────────────────────────────────────────────────

  function loadStamps(cb) {
    // localStorage is origin-scoped (youtube.com) — shared across extensions
    const raw = localStorage.getItem(storageKey()) || '';
    const parts = raw.split(/[\n,]/).map(p => p.trim()).filter(p => /^\d+:\d+/.test(p));
    _stamps = parts.map(ts => ({ ts, note: '' }));
    cb(_stamps);
  }

  function saveStamps() {
    const raw = _stamps.map(s => s.ts).join('\n');
    localStorage.setItem(storageKey(), raw);
    // Notify looper (same DOM, different isolated world) that stamps changed
    document.dispatchEvent(new CustomEvent('__lmx_updated', { detail: currentVideoId() }));
  }

  // ── sanitize note for time(note) format ───────────────────────────────────

  function sanitizeNote(note) {
    return note.replace(/\(/g, '[').replace(/\)/g, ']').replace(/,/g, '_').replace(/\s+/g, '_');
  }

  // ── stamp buttons ─────────────────────────────────────────────────────────

  function renderStampButtons() {
    const row = document.getElementById('yt-ctrl-stamps-row');
    if (!row) return;
    row.innerHTML = '';
    if (!_stamps.length) { row.style.display = 'none'; return; }
    row.style.display = 'flex';
    _stamps.forEach((stamp, i) => {
      const keyHint = i === 9 ? '[0]' : i < 9 ? `[${i + 1}]` : '';
      const label = stamp.note
        ? `${stamp.ts} ${stamp.note.slice(0, 18)}${stamp.note.length > 18 ? '…' : ''}`
        : stamp.ts;
      const b = document.createElement('button');
      b.textContent = label;
      b.title = `${keyHint} ${stamp.note || stamp.ts}`.trim();
      b.style.cssText = `
        padding: 3px 9px;
        border: none;
        border-radius: 4px;
        background: #1e3a5f;
        color: #90caf9;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        font-family: 'Courier New', monospace;
      `;
      b.addEventListener('click', () => {
        startStampLoop(parseTs(stamp.ts));
      });
      row.appendChild(b);
    });
  }

  // ── import modal ──────────────────────────────────────────────────────────

  function openImportModal() {
    if (document.getElementById(MODAL_ID)) return;

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.6);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const box = document.createElement('div');
    box.style.cssText = `
      background: #0d0d1a;
      border: 1px solid #3ea6ff55;
      border-radius: 8px;
      padding: 20px;
      width: 480px;
      max-width: 90vw;
      box-shadow: 0 8px 32px rgba(0,0,0,0.7);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;

    const title = document.createElement('div');
    title.textContent = 'Import Timestamps';
    title.style.cssText = 'color:#e0e0e0; font-size:14px; font-weight:700; margin-bottom:12px;';

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Paste a #? Vercel viewer URL, or plain timestamps: 1:00,2:00,3:00';
    textarea.rows = 4;
    textarea.style.cssText = `
      width: 100%;
      box-sizing: border-box;
      background: #1a1a2e;
      border: 1px solid #3ea6ff44;
      border-radius: 5px;
      color: #e0e0e0;
      font-size: 12px;
      padding: 8px;
      outline: none;
      resize: vertical;
      font-family: 'Courier New', monospace;
    `;
    textarea.addEventListener('keydown', (e) => e.stopPropagation());
    textarea.addEventListener('keyup',   (e) => e.stopPropagation());

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex; gap:8px; align-items:center; margin-top:12px;';

    function mkBtn(label, bg, color) {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = `
        padding: 7px 18px; border: none; border-radius: 5px;
        background: ${bg}; color: ${color};
        font-size: 13px; font-weight: 700; cursor: pointer;
      `;
      return b;
    }

    const pasteBtn  = mkBtn('📋 Paste', '#37474f', '#e0e0e0');
    const loadBtn   = mkBtn('Load', '#3ea6ff', '#000');
    const cancelBtn = mkBtn('Cancel', '#2c3e50', '#e0e0e0');
    const statusEl  = document.createElement('span');
    statusEl.style.cssText = 'font-size:11px; color:#888; margin-left:4px;';

    pasteBtn.addEventListener('click', () => {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        statusEl.textContent = 'Clipboard unavailable'; statusEl.style.color = '#e74c3c'; return;
      }
      navigator.clipboard.readText().then(text => {
        if (!text.trim()) { statusEl.textContent = 'Clipboard empty'; statusEl.style.color = '#e74c3c'; return; }
        textarea.value = text.trim();
        statusEl.textContent = 'Pasted'; statusEl.style.color = '#2ecc71';
      }).catch(() => {
        statusEl.textContent = 'Clipboard blocked — paste manually'; statusEl.style.color = '#e74c3c';
      });
    });

    loadBtn.addEventListener('click', () => {
      const raw = textarea.value.trim();
      if (!raw) { statusEl.textContent = 'Nothing pasted'; statusEl.style.color = '#e74c3c'; return; }
      const { stamps } = parseHashUrl(raw);
      if (!stamps.length) { statusEl.textContent = 'No timestamps found'; statusEl.style.color = '#e74c3c'; return; }
      _stamps = stamps;
      saveStamps();
      updateCount();
      renderStampButtons();
      flashStatus(`Loaded ${stamps.length} timestamp${stamps.length > 1 ? 's' : ''}`, '#2ecc71');
      closeImportModal();
    });

    cancelBtn.addEventListener('click', closeImportModal);

    btnRow.append(pasteBtn, loadBtn, cancelBtn, statusEl);
    box.append(title, textarea, btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeImportModal(); });

    setTimeout(() => textarea.focus(), 50);
  }

  function closeImportModal() {
    document.getElementById(MODAL_ID)?.remove();
  }

  // ── bar ──────────────────────────────────────────────────────────────────

  let _flashStatusFn = null;
  let _setStatusFn = null;

  function flashStatus(msg, color) {
    if (_flashStatusFn) _flashStatusFn(msg, color);
  }

  // Like flashStatus but stays until something else clears/replaces it
  function setStatus(msg, color) {
    if (_setStatusFn) _setStatusFn(msg, color);
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

    // ── skip buttons + clock ──────────────────────────────────────────────
    const skipBack10 = btn('−10s', '#2c3e50', '#e0e0e0', 'Skip back 10 seconds');
    const skipFwd10  = btn('+10s', '#3ea6ff', '#000',    'Skip forward 10 seconds');
    const skipFwd30  = btn('+30s', '#2980b9', '#fff',    'Skip forward 30 seconds');

    skipBack10.addEventListener('click', () => skip(-10));
    skipFwd10 .addEventListener('click', () => skip(+10));
    skipFwd30 .addEventListener('click', () => skip(+30));

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

    // ── divider ───────────────────────────────────────────────────────────
    const divider = document.createElement('span');
    divider.style.cssText = 'width:1px; height:20px; background:#3ea6ff44; flex-shrink:0;';

    // ── count label ───────────────────────────────────────────────────────
    const countSpan = document.createElement('span');
    countSpan.style.cssText = 'font-size:11px; color:#888; white-space:nowrap; min-width:24px;';

    function updateCount() {
      countSpan.textContent = _stamps.length ? _stamps.length + '×' : '';
    }

    // ── import button ─────────────────────────────────────────────────────
    const importBtn = btn('📥 Import', '#1a6b3a', '#fff', 'Import from a #? Vercel URL or plain timestamps (1:00,2:00,3:00)');
    importBtn.addEventListener('click', () => openImportModal());


    // ── clear button ──────────────────────────────────────────────────────
    const clearBtn = btn('✕ Clear', '#6b1a1a', '#fff', 'Clear all stamps for this video');
    clearBtn.addEventListener('click', () => {
      if (!_stamps.length) { flashStatus('No stamps to clear', '#e74c3c'); return; }
      _stamps = [];
      saveStamps();
      updateCount();
      renderStampButtons();
      flashStatus('Stamps cleared', '#e74c3c');
    });

    // ── volume buttons ────────────────────────────────────────────────────
    const volDownBtn = btn('🔉', '#37474f', '#fff', 'Volume down 10%');
    const volUpBtn   = btn('🔊', '#37474f', '#fff', 'Volume up 10%');
    volDownBtn.addEventListener('click', () => changeVolume(-0.1));
    volUpBtn  .addEventListener('click', () => changeVolume(+0.1));

    // ── white noise button ────────────────────────────────────────────────
    const noiseBtnEl = btn('🌊(1%)', '#37474f', '#fff', 'Toggle white noise at 1%');
    noiseBtnEl.addEventListener('click', () => toggleWhiteNoise(noiseBtnEl));

    // ── 30s timer button ──────────────────────────────────────────────────
    const timerBtn = document.createElement('button');
    timerBtn.textContent = '⏱️ 30s';
    timerBtn.title = 'Play 30s, rewind, repeat x10';
    timerBtn.style.cssText = `
      padding: 5px 12px;
      border: none;
      border-radius: 5px;
      background: linear-gradient(45deg,#ff9800,#f57c00);
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    `;
    timerBtn.addEventListener('click', () => toggleT3(timerBtn));

    // ── status flash ──────────────────────────────────────────────────────
    const statusSpan = document.createElement('span');
    statusSpan.style.cssText = 'font-size:11px; color:#888; white-space:nowrap; margin-left:4px;';
    let _statusTimer = null;

    _setStatusFn = function(msg, color) {
      if (_statusTimer) { clearTimeout(_statusTimer); _statusTimer = null; }
      statusSpan.textContent = msg;
      statusSpan.style.color = color;
    };

    _flashStatusFn = function(msg, color) {
      statusSpan.textContent = msg;
      statusSpan.style.color = color;
      if (_statusTimer) clearTimeout(_statusTimer);
      _statusTimer = setTimeout(() => {
        statusSpan.textContent = '';
        _statusTimer = null;
      }, 2500);
    };

    // ── stamps row ────────────────────────────────────────────────────────
    const stampsRow = document.createElement('div');
    stampsRow.id = 'yt-ctrl-stamps-row';
    stampsRow.style.cssText = `
      width: 100%;
      display: none;
      flex-wrap: wrap;
      gap: 5px;
      padding-top: 5px;
      border-top: 1px solid #3ea6ff22;
    `;

    bar.append(skipBack10, skipFwd10, skipFwd30, timeSpan, divider, countSpan, importBtn, clearBtn, volDownBtn, volUpBtn, noiseBtnEl, timerBtn, statusSpan, stampsRow);

    player.parentElement.insertBefore(bar, player);
    injectSpacer();
    startTimeClock(timeSpan);

    // keyboard shortcuts: 1-9 = stamp index 0-8, 0 = stamp index 9
    _kbHandler = function(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const n = parseInt(e.key);
      const idx = e.key === '0' ? 9 : (n >= 1 && n <= 9 ? n - 1 : -1);
      if (idx < 0 || !_stamps[idx]) return;
      e.preventDefault();
      startStampLoop(parseTs(_stamps[idx].ts));
    };
    document.addEventListener('keydown', _kbHandler);

    // Load existing stamps for this video
    loadStamps((stamps) => {
      _stamps = stamps;
      updateCount();
      renderStampButtons();
    });

    // Live-sync: refresh stamps whenever looper dispatches __lmx_updated on the DOM
    document.addEventListener('__lmx_updated', (e) => {
      if (e.detail && e.detail !== currentVideoId()) return;
      loadStamps((stamps) => {
        _stamps = stamps;
        updateCount();
        renderStampButtons();
      });
    });

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
    if (_kbHandler) { document.removeEventListener('keydown', _kbHandler); _kbHandler = null; }
    if (t3Timeout) { clearTimeout(t3Timeout); t3Timeout = null; t3Generation++; }
    document.getElementById(MODAL_ID)?.remove();
    document.getElementById(BAR_ID)?.remove();
    document.getElementById(SPACER_ID)?.remove();
  }

  // ── SPA navigation ────────────────────────────────────────────────────────

  function handleNav() {
    if (location.pathname.startsWith('/watch')) {
      if (document.getElementById(BAR_ID)) {
        // Video changed — reload stamps for new video
        loadStamps((stamps) => {
          _stamps = stamps;
          const countSpan = document.querySelector('#' + BAR_ID + ' span[data-role="count"]');
          if (countSpan) countSpan.textContent = _stamps.length ? _stamps.length + '×' : '';
          renderStampButtons();
        });
        return;
      }
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
