(function () {
  'use strict';

  const BAR_ID    = 'yt-controls-bar';
  const SPACER_ID = 'yt-controls-spacer';
  const MODAL_ID  = 'yt-ctrl-import-modal';
  const VER       = 2;
  const VIEWER_BASE = 'https://vercel-youtubeviewer.vercel.app/';

  // ── helpers ──────────────────────────────────────────────────────────────

  function video() { return document.querySelector('video'); }

  function skip(sec) {
    const v = video();
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.currentTime + sec, v.duration || Infinity));
  }

  function changeVolume(delta) {
    const v = video();
    if (!v) { flashStatus('No video', '#e74c3c'); return; }
    v.muted = false;
    v.volume = Math.max(0, Math.min(1, Math.round((v.volume + delta) * 100) / 100));
    flashStatus('Vol ' + Math.round(v.volume * 100) + '%', '#2ecc71');
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
    const idx = raw.indexOf('#?');
    const inner = idx >= 0 ? raw.slice(idx + 2) : raw;
    const tokens = inner.split(',');
    // first token is the YouTube video URL
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

  function currentVideoId() {
    return new URLSearchParams(location.search).get('v') || '';
  }

  function storageKey() {
    return 'ytCtrl_stamps_' + currentVideoId();
  }

  let _timeInterval = null;
  let _stamps = [];
  let _kbHandler = null;

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
    const key = storageKey();
    chrome.storage.local.get(key, (data) => {
      _stamps = data[key] || [];
      cb(_stamps);
    });
  }

  function saveStamps() {
    chrome.storage.local.set({ [storageKey()]: _stamps });
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
        const v = video();
        if (v) v.currentTime = parseTs(stamp.ts);
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
    textarea.placeholder = 'Paste a #? Vercel viewer URL here…';
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

    const loadBtn   = mkBtn('Load', '#3ea6ff', '#000');
    const cancelBtn = mkBtn('Cancel', '#2c3e50', '#e0e0e0');
    const statusEl  = document.createElement('span');
    statusEl.style.cssText = 'font-size:11px; color:#888; margin-left:4px;';

    // YouTube link — shown after a successful load
    const ytLink = document.createElement('a');
    ytLink.target = '_blank';
    ytLink.rel = 'noopener noreferrer';
    ytLink.style.cssText = `
      display: none;
      font-size: 12px;
      font-weight: 700;
      color: #ff4e45;
      text-decoration: none;
      padding: 6px 12px;
      border: 1px solid #ff4e4555;
      border-radius: 5px;
      white-space: nowrap;
    `;
    ytLink.textContent = '▶ Open on YouTube';

    loadBtn.addEventListener('click', () => {
      const raw = textarea.value.trim();
      if (!raw) { statusEl.textContent = 'Nothing pasted'; statusEl.style.color = '#e74c3c'; return; }
      const { stamps, videoId } = parseHashUrl(raw);
      if (!stamps.length) { statusEl.textContent = 'No timestamps found'; statusEl.style.color = '#e74c3c'; return; }
      _stamps = stamps;
      saveStamps();
      renderStampButtons();
      flashStatus(`Loaded ${stamps.length} timestamp${stamps.length > 1 ? 's' : ''}`, '#2ecc71');
      if (videoId) {
        ytLink.href = 'https://www.youtube.com/watch?v=' + videoId;
        ytLink.style.display = 'inline-block';
      }
    });

    cancelBtn.addEventListener('click', closeImportModal);

    btnRow.append(loadBtn, cancelBtn, ytLink, statusEl);
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

    // ── note input ────────────────────────────────────────────────────────
    const noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.placeholder = 'note (optional)';
    noteInput.style.cssText = `
      padding: 4px 8px;
      border: 1px solid #3ea6ff44;
      border-radius: 5px;
      background: #1a1a2e;
      color: #e0e0e0;
      font-size: 12px;
      width: 160px;
      outline: none;
    `;
    noteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') stampBtn.click();
      e.stopPropagation();
    });
    noteInput.addEventListener('keyup',   (e) => e.stopPropagation());
    noteInput.addEventListener('keypress',(e) => e.stopPropagation());

    // ── stamp button ──────────────────────────────────────────────────────
    const stampBtn = btn('Stamp', '#3ea6ff', '#000', 'Stamp current timestamp');
    stampBtn.addEventListener('click', () => {
      const v = video();
      if (!v) { flashStatus('No video', '#e74c3c'); return; }
      const ts = fmtTime(v.currentTime);
      const note = noteInput.value.trim();
      _stamps.push({ ts, note });
      saveStamps();
      noteInput.value = '';
      noteInput.focus();
      updateCount();
      renderStampButtons();
      flashStatus('Stamped ' + ts, '#2ecc71');
    });

    // ── count label ───────────────────────────────────────────────────────
    const countSpan = document.createElement('span');
    countSpan.style.cssText = 'font-size:11px; color:#888; white-space:nowrap; min-width:24px;';

    function updateCount() {
      countSpan.textContent = _stamps.length ? _stamps.length + '×' : '';
    }

    // ── retrieve link button ──────────────────────────────────────────────
    const linkBtn = btn('📋 Link', '#7B1FA2', '#fff', 'Copy share link to vercel viewer');
    linkBtn.addEventListener('click', () => {
      if (!_stamps.length) { flashStatus('No stamps yet', '#e74c3c'); return; }
      const vid = currentVideoId();
      if (!vid) { flashStatus('No video ID', '#e74c3c'); return; }
      const videoUrl = 'https://www.youtube.com/watch?v=' + vid;
      const timeParts = _stamps.map(e =>
        e.note ? `${e.ts}(${sanitizeNote(e.note)})` : e.ts
      );
      const shareUrl = VIEWER_BASE + '#?' + videoUrl + ',' + timeParts.join(',');
      navigator.clipboard.writeText(shareUrl).then(() => {
        flashStatus('Link copied!', '#2ecc71');
      }).catch(() => {
        flashStatus('Copy failed', '#e74c3c');
      });
    });

    // ── import button ─────────────────────────────────────────────────────
    const importBtn = btn('📥 Import', '#1a6b3a', '#fff', 'Import timestamps from a #? Vercel URL');
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

    bar.append(skipBack10, skipFwd10, skipFwd30, timeSpan, divider, noteInput, stampBtn, countSpan, linkBtn, importBtn, clearBtn, volDownBtn, volUpBtn, statusSpan, stampsRow);

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
      const v = video();
      if (v) v.currentTime = parseTs(_stamps[idx].ts);
    };
    document.addEventListener('keydown', _kbHandler);

    // Load existing stamps for this video
    loadStamps((stamps) => {
      _stamps = stamps;
      updateCount();
      renderStampButtons();
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
