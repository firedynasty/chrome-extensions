(function () {
  'use strict';

  const BAR_ID     = 'yt-controls-bar';
  const SPACER_ID  = 'yt-controls-spacer';
  const VER        = 1;

  // ── helpers ──────────────────────────────────────────────────────────────

  function video() { return document.querySelector('video'); }

  function skip(sec) {
    const v = video();
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.currentTime + sec, v.duration || Infinity));
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

  let _timeInterval = null;

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

  // ── bar ──────────────────────────────────────────────────────────────────

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

    const skipBack10  = btn('−10s', '#2c3e50', '#e0e0e0', 'Skip back 10 seconds');
    const skipFwd10   = btn('+10s', '#3ea6ff', '#000',    'Skip forward 10 seconds');
    const skipFwd30   = btn('+30s', '#2980b9', '#fff',    'Skip forward 30 seconds');

    skipBack10.addEventListener('click', () => skip(-10));
    skipFwd10 .addEventListener('click', () => skip(+10));
    skipFwd30 .addEventListener('click', () => skip(+30));

    const timeSpan = document.createElement('span');
    timeSpan.id = 'yt-ctrl-time';
    timeSpan.textContent = '--:--';
    timeSpan.style.cssText = `
      margin-left: 10px;
      font-size: 13px;
      font-weight: 700;
      color: #e0e0e0;
      font-family: 'Courier New', monospace;
      white-space: nowrap;
    `;

    bar.append(skipBack10, skipFwd10, skipFwd30, timeSpan);

    player.parentElement.insertBefore(bar, player);
    injectSpacer();
    startTimeClock(timeSpan);

    chrome.storage.local.get('ytCtrlBarHidden', (data) => {
      if (data.ytCtrlBarHidden) bar.style.display = 'none';
    });
  }

  // ── spacer (below player, above title) ───────────────────────────────────

  function injectSpacer() {
    if (document.getElementById(SPACER_ID)) return;
    // ytd-watch-metadata is the container holding the title; add margin above it
    const meta = document.querySelector('ytd-watch-metadata');
    if (!meta) return;
    const spacer = document.createElement('div');
    spacer.id = SPACER_ID;
    spacer.style.cssText = 'height: 2.2em;';
    meta.parentElement.insertBefore(spacer, meta);
  }

  function removeBar() {
    stopTimeClock();
    document.getElementById(BAR_ID)?.remove();
    document.getElementById(SPACER_ID)?.remove();
  }

  // ── SPA navigation ────────────────────────────────────────────────────────

  function handleNav() {
    if (location.pathname.startsWith('/watch')) {
      if (document.getElementById(BAR_ID)) return;
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
