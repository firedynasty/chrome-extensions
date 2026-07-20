(function () {
  'use strict';

  const BAR_ID = 'yt-ts-logger-bar';

  let entries = [];
  let videoUrl = '';
  let videoTitle = '';

  // ── helpers ──────────────────────────────────────────────────────────────

  function currentTs() {
    const v = document.querySelector('video');
    if (!v) return null;
    const t = v.currentTime;
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    return h > 0
      ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function currentVideoInfo() {
    return {
      url: location.href,
      title:
        document.querySelector('#title.ytd-watch-metadata h1')?.textContent?.trim() ||
        document.title.replace(' - YouTube', '').trim(),
    };
  }

  function loadState(cb) {
    chrome.storage.local.get(['tsEntries', 'tsVideoUrl', 'tsVideoTitle', 'tsNotes'], (data) => {
      entries    = data.tsEntries   || [];
      videoUrl   = data.tsVideoUrl  || '';
      videoTitle = data.tsVideoTitle || '';
      cb(data.tsNotes || '');
    });
  }

  function saveState(notes) {
    chrome.storage.local.set({
      tsEntries:    entries,
      tsVideoUrl:   videoUrl,
      tsVideoTitle: videoTitle,
      tsNotes:      notes,
    });
  }

  function buildSaveTxt(notes) {
    let out = entries.map((e) => e.ts).join(',');
    out += '\n\n';
    if (videoUrl) out += videoUrl + '\n';
    if (videoTitle) out += videoTitle + '\n';
    const noted = entries.filter((e) => e.note);
    const free  = notes.trim();
    if (noted.length) {
      out += '\n';
      noted.forEach((e) => { out += `[${e.ts}] ${e.note}\n`; });
    }
    if (free) {
      if (noted.length) out += '\n';
      out += free + '\n';
    }
    return out;
  }

  function buildFullText(notes) {
    let out = (videoUrl || location.href) + '\n';
    if (videoTitle) out += videoTitle + '\n';
    out += '\n';
    entries.forEach((e) => {
      out += `[${e.ts}]`;
      if (e.note) out += ` ${e.note}`;
      out += '\n';
    });
    const free = notes.trim();
    if (free) out += '\n' + free + '\n';
    return out;
  }

  // ── bar ──────────────────────────────────────────────────────────────────

  function injectBar() {
    if (document.getElementById(BAR_ID)) return;
    if (!location.pathname.startsWith('/watch')) return;

    // Wait for the player element to exist in the DOM
    const player = document.querySelector('ytd-player');
    if (!player) return;

    const bar = document.createElement('div');
    bar.id = BAR_ID;
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

    bar.innerHTML = `
      <button id="yt-ts-append"
        style="padding:5px 10px;border:none;border-radius:5px;background:#8e44ad;color:#fff;
               font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">+</button>
      <input id="yt-ts-note" type="text" placeholder="Note (optional) — Enter to stamp"
        style="flex:1;min-width:0;padding:5px 8px;border:1px solid #3ea6ff66;border-radius:5px;
               background:#0f0f23;color:#e0e0e0;font-size:13px;outline:none;">
      <button id="yt-ts-stamp"
        style="padding:5px 10px;border:none;border-radius:5px;background:#3ea6ff;color:#000;
               font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">Stamp</button>
      <button id="yt-ts-playpause" title="Play / Pause"
        style="padding:5px 10px;border:none;border-radius:5px;background:#e67e22;color:#fff;
               font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">▶</button>
      <button id="yt-ts-save"
        style="padding:5px 10px;border:none;border-radius:5px;background:#27ae60;color:#fff;
               font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">Save</button>
      <button id="yt-ts-clear"
        style="padding:5px 10px;border:none;border-radius:5px;background:#e74c3c;color:#fff;
               font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">Clear</button>
      <span id="yt-ts-count"
        style="font-size:11px;color:#888;white-space:nowrap;"></span>
      <span id="yt-ts-status"
        style="font-size:11px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;"></span>
    `;

    // Insert before the video player, in the natural DOM flow
    player.parentElement.insertBefore(bar, player);

    // Restore hidden state from previous toggle
    chrome.storage.local.get('tsBarHidden', (data) => {
      if (data.tsBarHidden) bar.style.display = 'none';
    });

    wireBar(bar);

    const clarifyBox = document.querySelector('#clarify-box');
    if (clarifyBox) clarifyBox.style.height = '200px';
  }

  function removeBar() {
    document.getElementById(BAR_ID)?.remove();
  }

  function setStatus(el, text, isError) {
    el.textContent = text;
    el.style.color = isError ? '#e74c3c' : '#2ecc71';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.textContent = ''; el.style.color = '#aaa'; }, 3000);
  }

  function updateCount(el) {
    el.textContent = entries.length
      ? `${entries.length} stamp${entries.length !== 1 ? 's' : ''}`
      : '';
  }

  // ── wiring ────────────────────────────────────────────────────────────────

  function wireBar(bar) {
    const noteInput    = bar.querySelector('#yt-ts-note');
    const stampBtn     = bar.querySelector('#yt-ts-stamp');
    const playPauseBtn = bar.querySelector('#yt-ts-playpause');
    const saveBtn      = bar.querySelector('#yt-ts-save');
    const appendBtn    = bar.querySelector('#yt-ts-append');
    const clearBtn     = bar.querySelector('#yt-ts-clear');
    const countEl      = bar.querySelector('#yt-ts-count');
    const statusEl     = bar.querySelector('#yt-ts-status');

    let notesValue = '';

    loadState((savedNotes) => {
      notesValue = savedNotes;
      updateCount(countEl);
      if (entries.length)
        setStatus(statusEl, `${entries.length} stamp${entries.length !== 1 ? 's' : ''} restored`);
    });

    function togglePlayPause() {
      const v = document.querySelector('video');
      if (!v) return;
      v.paused ? v.play() : v.pause();
      playPauseBtn.textContent = v.paused ? '▶' : '⏸';
    }

    noteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') stampBtn.click();
    });

    playPauseBtn.addEventListener('click', togglePlayPause);

    stampBtn.addEventListener('click', () => {
      const ts = currentTs();
      if (!ts) { setStatus(statusEl, 'No video found', true); return; }
      const info  = currentVideoInfo();
      videoUrl    = info.url;
      videoTitle  = info.title;
      const note  = noteInput.value.trim();
      entries.push({ ts, note });
      noteInput.value = '';
      noteInput.focus();
      updateCount(countEl);
      saveState(notesValue);
      setStatus(statusEl, `Stamped ${ts}`);
    });

    clearBtn.addEventListener('click', () => {
      entries    = [];
      videoUrl   = '';
      videoTitle = '';
      notesValue = '';
      updateCount(countEl);
      saveState('');
      setStatus(statusEl, 'Cleared');
    });

    saveBtn.addEventListener('click', () => {
      if (!entries.length) { setStatus(statusEl, 'Nothing to save', true); return; }
      const blob  = new Blob([buildSaveTxt(notesValue)], { type: 'text/plain' });
      const url   = URL.createObjectURL(blob);
      const fname = (videoTitle || 'yt_timestamps')
        .replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_').substring(0, 60) + '_timestamps.txt';
      const a = document.createElement('a');
      a.href = url; a.download = fname;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus(statusEl, 'Saved!');
    });

    appendBtn.addEventListener('click', () => {
      const text = noteInput.value.trim();
      if (!text) { setStatus(statusEl, 'Nothing to append', true); return; }
      notesValue = notesValue ? notesValue + '\n' + text : text;
      noteInput.value = '';
      noteInput.focus();
      saveState(notesValue);
      setStatus(statusEl, 'Appended!');
    });
  }

  // ── SPA navigation ────────────────────────────────────────────────────────

  function handleNav() {
    if (location.pathname.startsWith('/watch')) {
      // ytd-player may not exist yet right after yt-navigate-finish; poll briefly
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
    chrome.storage.local.set({ tsBarHidden: nowHidden });
    sendResponse({ hidden: nowHidden });
    return true;
  });

  document.addEventListener('yt-navigate-finish', handleNav);

  // Initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleNav);
  } else {
    handleNav();
  }
})();
