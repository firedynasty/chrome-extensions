async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  if (!contexts.length) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Persistent YouTube streaming and audio playback via IFrame API across tabs'
    });
    // Give the offscreen doc a moment to register its listener
    await new Promise(r => setTimeout(r, 200));
    const { bachPlaylists, natureMix } = await chrome.storage.local.get(['bachPlaylists', 'natureMix']);
    if (bachPlaylists) {
      chrome.runtime.sendMessage({ target: 'offscreen', type: 'loadPlaylists', playlists: bachPlaylists }).catch(() => {});
    }
    if (natureMix) {
      chrome.runtime.sendMessage({ target: 'offscreen', type: 'natureLoadState', isPlaying: natureMix.isPlaying, volumes: natureMix.volumes, activeGroup: natureMix.activeGroup }).catch(() => {});
    }
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Only handle messages from popup (no target field yet).
  // stateUpdate is a broadcast from offscreen → popup; leave it alone.
  if (msg.target === 'offscreen' || msg.type === 'stateUpdate') return;

  // Track 🔁 loop: navigate the active tab to the track's YouTube timestamp
  // and inject the segment-looper engine. Handled here (not in the popup) so
  // the flow survives the popup closing; not forwarded to offscreen.
  if (msg.type === 'loopTrack') {
    handleLoopTrack(msg);
    sendResponse({ ok: true });
    return;
  }

  ensureOffscreen().then(() => {
    const forward = { ...msg, target: 'offscreen' };
    chrome.runtime.sendMessage(forward, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse(null);
        return;
      }
      sendResponse(response);
    });
  });

  // Keep sendResponse channel open for async
  return true;
});

// ── Segment looper (ported from looper/popup.js) ────────────────────────────

const LOOP_DURATION_SECS = 180; // 3 minutes
const LOOP_TOTAL_LOOPS = 8;

async function handleLoopTrack({ ytid, secs, title }) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  const startSec = parseInt(secs) || 0;
  const url = `https://www.youtube.com/watch?v=${ytid}&t=${startSec}s`;

  let injected = false;
  const inject = () => {
    if (injected) return;
    injected = true;
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: bachLoopInject,
      args: [startSec, LOOP_DURATION_SECS, LOOP_TOTAL_LOOPS, title || '']
    }).catch(() => {});
  };
  const onUpdated = (tabId, info) => {
    if (tabId === tab.id && info.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      clearTimeout(safety);
      inject();
    }
  };
  chrome.tabs.onUpdated.addListener(onUpdated);
  // Fallback: if 'complete' never fires (slow load, or the tab was already on
  // this exact URL), inject anyway — bachLoopInject polls for the video
  // element itself, so page timing doesn't matter.
  const safety = setTimeout(() => {
    chrome.tabs.onUpdated.removeListener(onUpdated);
    inject();
  }, 8000);

  await chrome.tabs.update(tab.id, { url });
}

// Injected into the YouTube tab. Must be fully self-contained (no closure
// references) — Chrome serializes and re-runs this function in the tab's JS
// realm. String literals stay pure ASCII; symbols are built with
// String.fromCharCode / fromCodePoint so a charset misdetection can't
// produce mojibake.
function bachLoopInject(startSec, durationSec, totalLoops, label) {
  const BPL_VERSION = 1;
  const CHIP_ID = '__bpl_chip';
  const Z_MAX = 2147483647;

  // A new loop replaces any previous one — tear down stale interval,
  // listeners and chip so two engines never run at once.
  if (window.__bpl) {
    const old = window.__bpl;
    try { if (old.interval) clearInterval(old.interval); } catch (e) {}
    try { if (old.boot) clearInterval(old.boot); } catch (e) {}
    if (old.media) {
      try { if (old.onMediaPlay) old.media.removeEventListener('play', old.onMediaPlay); } catch (e) {}
      try { if (old.onMediaPause) old.media.removeEventListener('pause', old.onMediaPause); } catch (e) {}
    }
    window.__bpl = null;
  }
  const stale = document.getElementById(CHIP_ID);
  if (stale) stale.remove();

  const state = {
    version: BPL_VERSION,
    media: null,
    interval: null,
    boot: null,
    start: startSec,
    end: startSec + durationSec,
    loopsRemaining: totalLoops,
    paused: false,
    onMediaPlay: null,
    onMediaPause: null
  };
  window.__bpl = state;

  function fmt(t) {
    t = Math.max(0, Math.floor(t));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    const ss = String(s).padStart(2, '0');
    return h > 0 ? h + ':' + String(m).padStart(2, '0') + ':' + ss : m + ':' + ss;
  }

  function findMedia() {
    const vids = Array.from(document.querySelectorAll('video')).filter(function(v) { return v.readyState > 0 || v.duration; });
    const playing = vids.find(function(v) { return !v.paused && !v.ended; });
    if (playing) return playing;
    vids.sort(function(a, b) { return (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight); });
    return vids[0] || null;
  }

  function updateChip() {
    const lbl = document.getElementById(CHIP_ID + '_label');
    if (!lbl) return;
    let name = (label || '').trim() || (fmt(state.start) + String.fromCharCode(0x2192) + fmt(state.end));
    if (name.length > 40) name = name.slice(0, 37) + String.fromCharCode(0x2026);
    lbl.textContent = String.fromCodePoint(0x1F501) + ' ' + name + ' ' + String.fromCharCode(0x00B7)
      + ' loop ' + (totalLoops - state.loopsRemaining + 1) + '/' + totalLoops;
  }

  function showChip() {
    let chip = document.getElementById(CHIP_ID);
    if (!chip) {
      chip = document.createElement('div');
      chip.id = CHIP_ID;
      chip.style.cssText = 'position:fixed; bottom:18px; right:18px; z-index:' + Z_MAX + '; background:#c9a84c; color:#1a1a2e; padding:8px 12px; border-radius:8px; font:700 13px -apple-system,BlinkMacSystemFont,sans-serif; box-shadow:0 4px 16px rgba(0,0,0,0.5); display:flex; align-items:center; gap:8px; max-width:340px;';
      const lbl = document.createElement('span');
      lbl.id = CHIP_ID + '_label';
      const x = document.createElement('button');
      x.textContent = String.fromCharCode(0x2715);
      x.title = 'Cancel loop';
      x.style.cssText = 'background:rgba(0,0,0,0.15); border:none; color:#1a1a2e; border-radius:4px; cursor:pointer; font-size:12px; font-weight:700; padding:2px 7px;';
      x.addEventListener('click', cancelLoop);
      chip.appendChild(lbl);
      chip.appendChild(x);
      document.body.appendChild(chip);
    }
    chip.style.display = 'flex';
    updateChip();
  }

  function removeChip() {
    const chip = document.getElementById(CHIP_ID);
    if (chip) chip.remove();
  }

  function clearLoopInterval() {
    if (state.interval) { clearInterval(state.interval); state.interval = null; }
  }

  function cancelLoop() {
    detachMediaListeners();
    clearLoopInterval();
    state.paused = false;
    removeChip();
  }

  function flashDone() {
    const lbl = document.getElementById(CHIP_ID + '_label');
    if (lbl) lbl.textContent = String.fromCharCode(0x2713) + ' ' + totalLoops + ' loops done';
    setTimeout(removeChip, 2500);
  }

  // Pausing suspends the loop engine itself (interval cleared), and ANY play
  // of the media resumes it — symmetric with the page's own controls.
  function attachMediaListeners(m) {
    detachMediaListeners();
    state.onMediaPlay = function() {
      if (state.paused) {
        state.paused = false;
        if (!state.interval && state.loopsRemaining > 0) state.interval = setInterval(tick, 40);
      }
    };
    state.onMediaPause = function() {
      if (state.interval) {
        clearLoopInterval();
        state.paused = true;
      }
    };
    m.addEventListener('play', state.onMediaPlay);
    m.addEventListener('pause', state.onMediaPause);
  }

  function detachMediaListeners() {
    if (state.media && state.onMediaPlay) state.media.removeEventListener('play', state.onMediaPlay);
    if (state.media && state.onMediaPause) state.media.removeEventListener('pause', state.onMediaPause);
    state.onMediaPlay = null;
    state.onMediaPause = null;
  }

  function tick() {
    const m = state.media;
    if (!m || !document.contains(m)) { cancelLoop(); return; }
    if (m.currentTime >= state.end - 0.03) {
      if (state.loopsRemaining > 1) {
        state.loopsRemaining--;
        m.currentTime = state.start;
        const p = m.play();
        if (p && p.catch) p.catch(function() {});
        updateChip();
      } else {
        // All loops done — stop rewinding, leave playback running
        clearLoopInterval();
        flashDone();
      }
    }
  }

  function startLoop(m) {
    state.media = m;
    attachMediaListeners(m);
    state.paused = false;
    m.currentTime = state.start;
    const p = m.play();
    if (p && p.catch) p.catch(function() {});
    state.interval = setInterval(tick, 40);
    showChip();
  }

  // The navigation may still be in flight — poll for the video element.
  let waited = 0;
  state.boot = setInterval(function() {
    waited += 250;
    const m = findMedia();
    if (m) {
      clearInterval(state.boot);
      state.boot = null;
      startLoop(m);
    } else if (waited >= 15000) {
      clearInterval(state.boot);
      state.boot = null;
    }
  }, 250);
}
