const statusEl = document.getElementById('status');

// No button — opening the popup injects immediately and closes itself, so the
// toolbar icon lands straight on the modal. The popup stays open only when
// injection fails (e.g. chrome:// pages), to show the error.
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: loopMixInject
    });
    window.close();
  } catch (err) {
    statusEl.textContent = 'Cannot inject on this page';
    statusEl.className = 'error';
  }
})();

// Injected into the page. Must be fully self-contained (no closure references) —
// Chrome serializes and re-runs this function in the tab's JS realm.
// NOTE: no inline event handlers and no <style> tags — strict page CSP (e.g.
// YouTube) blocks both. All wiring is addEventListener, all styling inline.
// Non-ASCII characters in strings are built with String.fromCharCode /
// fromCodePoint so this file stays pure ASCII — a charset misdetection
// otherwise turns them into mojibake in the injected page.
function loopMixInject() {
  const Z_MAX = 2147483647;
  const MODAL_ID = '__lmx_modal';
  const CHIP_ID = '__lmx_chip';

  const LMX_VERSION = 7;

  // Re-inject with current version: module already lives in this tab — just
  // reopen the modal. Older injections (or their orphaned DOM) get torn down
  // and rebuilt so a stale/broken UI can never persist.
  if (window.__lmx && window.__lmx.version === LMX_VERSION) {
    window.__lmx.openModal();
    return (window.__lmx.state.interval || window.__lmx.state.paused) ? 'Loop running ' + String.fromCharCode(0x2014) + ' modal reopened' : 'Loop Mix reopened';
  }
  if (window.__lmx) {
    try { if (window.__lmx.state && window.__lmx.state.interval) clearInterval(window.__lmx.state.interval); } catch (e) {}
    try { if (window.__lmx.state && window.__lmx.state.noiseSrc) window.__lmx.state.noiseSrc.stop(); } catch (e) {}
    window.__lmx = null;
  }
  const staleModal = document.getElementById(MODAL_ID);
  if (staleModal) staleModal.remove();
  const staleChip = document.getElementById(CHIP_ID);
  if (staleChip) staleChip.remove();

  const state = {
    media: null,
    interval: null,
    start: 0,
    end: 0,
    loopsRemaining: 0,
    totalLoops: 0,
    rows: [],
    noiseCtx: null,
    noiseSrc: null,
    noiseGain: null,
    noiseOn: false,
    noiseVol: 0.01,
    paused: false,
    onMediaPlay: null,
    onMediaPause: null
  };

  // ---------- time helpers (parity with the YouTube Viewer) ----------
  function formatSecondsToTime(totalSeconds) {
    totalSeconds = Math.max(0, totalSeconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    if (hours > 0) {
      return hours + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    }
    return minutes + ':' + String(seconds).padStart(2, '0');
  }

  // Accepts m:ss / h:mm:ss (with decimals) and plain seconds
  function parseMixTime(t) {
    t = t.trim();
    const hms = t.match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
    if (hms) {
      const m = parseInt(hms[2]);
      const s = parseFloat(hms[3]);
      return (m < 60 && s < 60) ? parseInt(hms[1]) * 3600 + m * 60 + s : null;
    }
    const dec = t.match(/^(\d+):(\d+(?:\.\d+)?)$/);
    if (dec) {
      const secs = parseFloat(dec[2]);
      return secs < 60 ? parseInt(dec[1]) * 60 + secs : null;
    }
    if (/^\d+(?:\.\d+)?$/.test(t)) return parseFloat(t);
    return null;
  }

  // mix_mp3.py semantics: end containing ":" = absolute timestamp
  // (duration = end - start); plain-number end = duration in seconds.
  // Loops defaults to 1. Returns { start, duration, loops, endLabel } or { error }.
  function parseLoopMixLine(raw) {
    const parts = raw.split(',').map(p => p.trim()).filter(p => p);
    if (parts.length < 2 || parts.length > 3) {
      return { error: 'need 2 or 3 comma-separated values' };
    }

    const start = parseMixTime(parts[0]);
    if (start === null || isNaN(start)) {
      return { error: 'bad start time "' + parts[0] + '"' };
    }

    let duration, endLabel;
    if (parts[1].includes(':')) {
      const endSec = parseMixTime(parts[1]);
      if (endSec === null || isNaN(endSec)) {
        return { error: 'bad end time "' + parts[1] + '"' };
      }
      duration = endSec - start;
      if (duration <= 0) {
        return { error: 'end must be after start' };
      }
      endLabel = formatSecondsToTime(endSec);
    } else {
      duration = parseFloat(parts[1]);
      if (isNaN(duration) || duration <= 0) {
        return { error: 'duration must be positive seconds' };
      }
      endLabel = duration + 's ' + String.fromCharCode(0x2192) + ' ' + formatSecondsToTime(start + duration);
    }

    let loops = 1;
    if (parts.length === 3) {
      loops = parseInt(parts[2]);
      if (isNaN(loops) || loops < 1) loops = 1;
    }

    return { start, duration, loops, endLabel };
  }

  // Plain YouTube URL on its own row (watch?v= or youtu.be) → video id.
  function extractYouTubeId(text) {
    const m = text.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?[^\s]*v=([\w-]+)|youtu\.be\/([\w-]+))/);
    return m ? (m[1] || m[2] || '') : '';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------- media ----------
  function findMedia() {
    const vids = Array.from(document.querySelectorAll('video')).filter(v => v.readyState > 0 || v.duration);
    const playing = vids.find(v => !v.paused && !v.ended);
    if (playing) return playing;
    vids.sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight));
    if (vids[0]) return vids[0];
    const auds = Array.from(document.querySelectorAll('audio')).filter(a => a.duration);
    return auds[0] || null;
  }

  function mediaLabel(m) {
    let name = (document.title || '').replace(/ - YouTube$/, '').trim();
    if (!name && m) {
      const src = m.currentSrc || m.src || '';
      name = src.split('/').pop().split('?')[0] || (m.tagName === 'AUDIO' ? 'audio element' : 'video element');
    }
    if (name.length > 70) name = name.slice(0, 67) + '...';
    return name;
  }

  // ---------- continuous white noise (modal toggle, bach-player pattern) ----------
  // Looped 2s white-noise buffer through a GainNode. Independent of the loop
  // engine and the modal — keeps playing with the modal closed until toggled
  // off (reopen via the toolbar icon).
  function startNoise() {
    try {
      if (!state.noiseCtx) state.noiseCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = state.noiseCtx;
      if (ctx.state === 'suspended') ctx.resume();
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = state.noiseVol;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      state.noiseSrc = src;
      state.noiseGain = gain;
      state.noiseOn = true;
    } catch (e) {}
  }

  function stopNoise() {
    try { if (state.noiseSrc) state.noiseSrc.stop(); } catch (e) {}
    try { if (state.noiseSrc) state.noiseSrc.disconnect(); } catch (e) {}
    try { if (state.noiseGain) state.noiseGain.disconnect(); } catch (e) {}
    state.noiseSrc = null;
    state.noiseGain = null;
    state.noiseOn = false;
  }

  function toggleNoise() {
    if (state.noiseOn) stopNoise(); else startNoise();
    updateNoiseUI();
  }

  function setNoiseVol(v) {
    state.noiseVol = Math.max(0, Math.min(1, Math.round(v * 100) / 100));
    if (state.noiseGain) state.noiseGain.gain.value = state.noiseVol;
    updateNoiseUI();
  }

  function updateNoiseUI() {
    const btn = document.getElementById('__lmx_noise');
    const lbl = document.getElementById('__lmx_noise_vol');
    if (btn) btn.style.background = state.noiseOn ? 'linear-gradient(45deg,#26C6DA,#0097A7)' : '#2c3e50';
    if (lbl) lbl.textContent = Math.round(state.noiseVol * 100) + '%';
  }

  // ---------- loop engine ----------
  function startLoop(startSec, durationSec, loops) {
    const media = findMedia();
    if (!media) {
      setStatus('No video or audio found on this page', true);
      return false;
    }
    clearLoopInterval();
    state.media = media;
    attachMediaListeners(media);
    state.start = startSec;
    state.end = startSec + durationSec;
    state.loopsRemaining = loops;
    state.totalLoops = loops;
    state.paused = false;
    media.currentTime = startSec;
    const p = media.play();
    if (p && p.catch) p.catch(() => {});
    state.interval = setInterval(tick, 40);
    showChip();
    updateChip();
    updateStopBtn();
    return true;
  }

  function tick() {
    const m = state.media;
    if (!m || !document.contains(m)) { cancelLoop(); return; }
    updatePauseBtn();
    if (m.currentTime >= state.end - 0.03) {
      if (state.loopsRemaining > 1) {
        state.loopsRemaining--;
        m.currentTime = state.start;
        const p = m.play();
        if (p && p.catch) p.catch(() => {});
        updateChip();
      } else {
        // All loops done — stop rewinding but leave playback running
        clearLoopInterval();
        flashChipDone();
        updateStopBtn();
      }
    }
  }

  function clearLoopInterval() {
    if (state.interval) {
      clearInterval(state.interval);
      state.interval = null;
    }
  }

  // User-initiated cancel: stop rewinding, leave playback running
  function cancelLoop() {
    detachMediaListeners();
    clearLoopInterval();
    state.paused = false;
    hideChip();
    updateStopBtn();
    setStatus('Loop Mix cancelled');
  }

  // ---------- pause/resume (chip ⏸/▶ button) ----------
  // Pausing suspends the loop engine itself — interval cleared — not just the
  // media. Symmetric: ANY pause/play of the media (chip button or the page's
  // own controls) suspends/resumes the looper via these listeners.
  function attachMediaListeners(m) {
    detachMediaListeners();
    state.onMediaPlay = function() {
      if (state.paused) {
        state.paused = false;
        if (!state.interval && state.loopsRemaining > 0) state.interval = setInterval(tick, 40);
      }
      updatePauseBtn();
    };
    state.onMediaPause = function() {
      if (state.interval) {
        clearLoopInterval();
        state.paused = true;
      }
      updatePauseBtn();
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

  function togglePause() {
    const m = state.media;
    if (!m || !document.contains(m)) return;
    if (!state.interval && !state.paused) return; // no loop engaged
    if (m.paused) {
      const p = m.play();
      if (p && p.catch) p.catch(() => {});
    } else {
      m.pause();
    }
    // The play/pause event listeners above do the state/interval work.
  }

  function updatePauseBtn() {
    const btn = document.getElementById(CHIP_ID + '_pause');
    if (!btn) return;
    const paused = state.media ? state.media.paused : false;
    const icon = paused ? String.fromCharCode(0x25B6) : String.fromCharCode(0x23F8);
    if (btn.textContent !== icon) {
      btn.textContent = icon;
      btn.title = paused ? 'Resume loop' : 'Pause loop';
    }
  }

  // ---------- floating chip (visible while a loop runs, modal is closed) ----------
  function showChip() {
    let chip = document.getElementById(CHIP_ID);
    if (!chip) {
      chip = document.createElement('div');
      chip.id = CHIP_ID;
      chip.style.cssText = 'position:fixed; bottom:18px; right:18px; z-index:' + Z_MAX + '; background:linear-gradient(45deg,#26C6DA,#0097A7); color:#fff; padding:8px 12px; border-radius:8px; font:700 13px -apple-system,BlinkMacSystemFont,sans-serif; box-shadow:0 4px 16px rgba(0,0,0,0.5); display:flex; align-items:center; gap:8px;';
      const label = document.createElement('span');
      label.id = CHIP_ID + '_label';
      const pauseBtn = document.createElement('button');
      pauseBtn.id = CHIP_ID + '_pause';
      pauseBtn.textContent = String.fromCharCode(0x23F8);
      pauseBtn.title = 'Pause loop';
      pauseBtn.style.cssText = 'background:rgba(0,0,0,0.25); border:none; color:#fff; border-radius:4px; cursor:pointer; font-size:12px; font-weight:700; padding:2px 7px;';
      pauseBtn.addEventListener('click', togglePause);
      const x = document.createElement('button');
      x.textContent = String.fromCharCode(0x2715);
      x.title = 'Cancel loop';
      x.style.cssText = 'background:rgba(0,0,0,0.25); border:none; color:#fff; border-radius:4px; cursor:pointer; font-size:12px; font-weight:700; padding:2px 7px;';
      x.addEventListener('click', cancelLoop);
      chip.appendChild(label);
      chip.appendChild(pauseBtn);
      chip.appendChild(x);
      document.body.appendChild(chip);
    }
    chip.style.display = 'flex';
    updatePauseBtn();
  }

  function updateChip() {
    const label = document.getElementById(CHIP_ID + '_label');
    if (!label) return;
    label.textContent = String.fromCodePoint(0x1F501) + ' ' + formatSecondsToTime(state.start) + String.fromCharCode(0x2192) + formatSecondsToTime(state.end) +
      ' ' + String.fromCharCode(0x00B7) + ' loop ' + (state.totalLoops - state.loopsRemaining + 1) + '/' + state.totalLoops;
  }

  function flashChipDone() {
    const label = document.getElementById(CHIP_ID + '_label');
    const chip = document.getElementById(CHIP_ID);
    if (!chip || !label) return;
    label.textContent = String.fromCharCode(0x2713) + ' ' + state.totalLoops + ' loop' + (state.totalLoops > 1 ? 's' : '') + ' done';
    setTimeout(hideChip, 2500);
  }

  function hideChip() {
    const chip = document.getElementById(CHIP_ID);
    if (chip) chip.style.display = 'none';
  }

  // ---------- modal ----------
  function buildModal() {
    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.style.cssText = 'display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); z-index:' + (Z_MAX - 1) + '; justify-content:center; align-items:flex-start; padding-top:80px; overflow-y:auto;';

    const box = document.createElement('div');
    box.style.cssText = 'background:#1e1e1e; border:2px solid #26C6DA; border-radius:12px; width:92%; max-width:560px; padding:20px; margin:0 auto 40px; position:relative; box-shadow:0 12px 40px rgba(0,0,0,0.7); font-family:-apple-system,BlinkMacSystemFont,sans-serif;';

    const closeX = document.createElement('button');
    closeX.textContent = String.fromCharCode(0x2715);
    closeX.style.cssText = 'position:absolute; top:10px; right:14px; background:none; border:none; color:#aaa; font-size:22px; cursor:pointer; line-height:1; padding:0 4px;';
    closeX.addEventListener('click', closeModal);

    const title = document.createElement('div');
    title.textContent = String.fromCodePoint(0x1F501) + ' Loop Mix ' + String.fromCharCode(0x2014) + ' Segment Looper';
    title.style.cssText = 'font-weight:700; font-size:15px; color:#26C6DA; margin-bottom:6px;';

    const info = document.createElement('div');
    info.id = '__lmx_info';
    info.style.cssText = 'font-size:12px; color:#888; margin-bottom:12px;';

    const label = document.createElement('label');
    label.textContent = 'One segment per line: Start time, End time, [Times to loop ' + String.fromCharCode(0x2014) + ' optional, default 1]';
    label.style.cssText = 'font-size:12px; color:#bbb; display:block; margin-bottom:6px;';

    const textarea = document.createElement('textarea');
    textarea.id = '__lmx_textarea';
    textarea.placeholder = '1:30, 1:44\n2:00, 2:10, 5\n3:00, 15, 3   (end without a colon = duration in seconds)';
    textarea.style.cssText = 'width:100%; min-height:110px; padding:10px; font-size:13px; background:#2a2a2a; color:#fff; border:1px solid #555; border-radius:6px; resize:vertical; font-family:inherit; line-height:1.5; box-sizing:border-box; outline:none;';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex; gap:8px; margin-top:10px; justify-content:flex-end; flex-wrap:wrap;';

    const stopBtn = document.createElement('button');
    stopBtn.id = '__lmx_stop';
    stopBtn.textContent = String.fromCharCode(0x23F9) + ' Stop Loop';
    stopBtn.style.cssText = 'display:none; padding:8px 16px; background:linear-gradient(45deg,#FF5722,#E64A19); color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:700;';
    stopBtn.addEventListener('click', cancelLoop);

    const pasteBtn = document.createElement('button');
    pasteBtn.textContent = 'Paste Clipboard';
    pasteBtn.title = 'Replace the textarea with the clipboard contents';
    pasteBtn.style.cssText = 'padding:8px 16px; background:linear-gradient(45deg,#FF9800,#F57C00); color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:700;';
    pasteBtn.addEventListener('click', pasteClipboard);

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:8px 16px; background:linear-gradient(45deg,#607D8B,#455A64); color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:700;';
    cancelBtn.addEventListener('click', closeModal);

    const genBtn = document.createElement('button');
    genBtn.textContent = 'Generate Table ' + String.fromCharCode(0x25B6);
    genBtn.style.cssText = 'padding:8px 20px; background:linear-gradient(45deg,#26C6DA,#0097A7); color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:700;';
    genBtn.addEventListener('click', generateTable);

    // YouTube link — appears (styled like Generate Table) whenever the
    // textarea contains a plain video URL on its own row; opens in a new tab.
    const ytLink = document.createElement('a');
    ytLink.textContent = 'YouTube ' + String.fromCharCode(0x2197);
    ytLink.title = 'Open the YouTube video from the textarea in a new tab';
    ytLink.target = '_blank';
    ytLink.rel = 'noopener noreferrer';
    ytLink.style.cssText = 'display:none; padding:8px 20px; background:linear-gradient(45deg,#26C6DA,#0097A7); color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:700; text-decoration:none; white-space:nowrap;';

    textarea.addEventListener('input', function() {
      const id = extractYouTubeId(textarea.value);
      ytLink.href = id ? 'https://www.youtube.com/watch?v=' + id : '';
      ytLink.style.display = id ? 'inline-block' : 'none';
    });

    btnRow.appendChild(stopBtn);
    btnRow.appendChild(pasteBtn);
    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(genBtn);
    btnRow.appendChild(ytLink);

    // White noise row — 🌊 toggle (gray off, teal on like bach-player) + −/+ volume
    const noiseRow = document.createElement('div');
    noiseRow.style.cssText = 'display:flex; gap:8px; margin-top:10px; align-items:center;';

    const noiseBtn = document.createElement('button');
    noiseBtn.id = '__lmx_noise';
    noiseBtn.textContent = String.fromCodePoint(0x1F30A) + ' White Noise';
    noiseBtn.title = 'Toggle continuous white noise ' + String.fromCharCode(0x2014) + ' keeps playing with the modal closed';
    noiseBtn.style.cssText = 'padding:8px 16px; background:#2c3e50; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:700;';
    noiseBtn.addEventListener('click', toggleNoise);

    const noiseDown = document.createElement('button');
    noiseDown.textContent = String.fromCharCode(0x2212);
    noiseDown.title = 'Noise volume down 1%';
    noiseDown.style.cssText = 'padding:8px 12px; background:#37474f; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:700;';
    noiseDown.addEventListener('click', function() { setNoiseVol(state.noiseVol - 0.01); });

    const noiseUp = document.createElement('button');
    noiseUp.textContent = '+';
    noiseUp.title = 'Noise volume up 1%';
    noiseUp.style.cssText = noiseDown.style.cssText;
    noiseUp.addEventListener('click', function() { setNoiseVol(state.noiseVol + 0.01); });

    const noiseVolLbl = document.createElement('span');
    noiseVolLbl.id = '__lmx_noise_vol';
    noiseVolLbl.style.cssText = 'font-size:12px; color:#888; min-width:36px;';

    noiseRow.appendChild(noiseBtn);
    noiseRow.appendChild(noiseDown);
    noiseRow.appendChild(noiseUp);
    noiseRow.appendChild(noiseVolLbl);
    updateNoiseUI();

    const tableContainer = document.createElement('div');
    tableContainer.id = '__lmx_table';
    tableContainer.style.cssText = 'margin-top:12px;';

    const statusLine = document.createElement('div');
    statusLine.id = '__lmx_status';
    statusLine.style.cssText = 'margin-top:10px; font-size:12px; min-height:16px; color:#888;';

    box.appendChild(closeX);
    box.appendChild(title);
    box.appendChild(info);
    box.appendChild(label);
    box.appendChild(textarea);
    box.appendChild(btnRow);
    box.appendChild(noiseRow);
    box.appendChild(tableContainer);
    box.appendChild(statusLine);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Escape closes; Ctrl/Cmd+Enter generates the table. Capture phase so the
    // page's own key handlers (e.g. YouTube shortcuts) don't swallow them.
    document.addEventListener('keydown', function(e) {
      const modal = document.getElementById(MODAL_ID);
      if (!modal || modal.style.display === 'none') return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeModal();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        generateTable();
      }
    }, true);
  }

  function openModal() {
    const modal = document.getElementById(MODAL_ID);
    const info = document.getElementById('__lmx_info');
    const m = findMedia();
    if (m) {
      info.textContent = 'Loaded: ' + mediaLabel(m) +
        (m.duration ? ' ' + String.fromCharCode(0x00B7) + ' ' + formatSecondsToTime(m.duration) + ' long ' + String.fromCharCode(0x00B7) + ' now at ' + formatSecondsToTime(m.currentTime) : '');
    } else {
      info.textContent = 'No video/audio found on this page yet ' + String.fromCharCode(0x2014) + ' start playback, then reopen.';
    }
    updateStopBtn();
    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('__lmx_textarea').focus(), 50);
  }

  function closeModal() {
    document.getElementById(MODAL_ID).style.display = 'none';
  }

  function updateStopBtn() {
    const btn = document.getElementById('__lmx_stop');
    if (btn) btn.style.display = (state.interval || state.paused) ? '' : 'none';
  }

  function setStatus(msg, isError) {
    const el = document.getElementById('__lmx_status');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? '#ef5350' : '#4CAF50';
  }

  // Replace the textarea with the clipboard contents (matches the Viewer's
  // Paste Media modal Clipboard button). Needs a focused, secure-context page;
  // the button click itself is the required user gesture.
  function pasteClipboard() {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      setStatus('Clipboard not available on this page', true);
      return;
    }
    navigator.clipboard.readText().then(function(text) {
      if (!text || !text.trim()) {
        setStatus('Clipboard is empty', true);
        return;
      }
      document.getElementById('__lmx_textarea').value = text.trim();
      // Programmatic set doesn't fire 'input' — nudge so the YouTube link updates
      document.getElementById('__lmx_textarea').dispatchEvent(new Event('input'));
      setStatus('Pasted ' + text.trim().split('\n').length + ' line(s) ' + String.fromCharCode(0x2014) + ' hit Generate Table');
    }).catch(function() {
      setStatus('Clipboard read blocked ' + String.fromCharCode(0x2014) + ' click the page first, then retry', true);
    });
  }

  function generateTable() {
    const raw = document.getElementById('__lmx_textarea').value;
    const container = document.getElementById('__lmx_table');
    const hasUrl = !!extractYouTubeId(raw);
    // Skip YouTube URL rows — they feed the YouTube link, not the table
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l && !extractYouTubeId(l));
    if (!lines.length) {
      container.innerHTML = '';
      setStatus(hasUrl ? 'YouTube link only ' + String.fromCharCode(0x2014) + ' add segment lines to loop' : 'Nothing entered', true);
      return;
    }

    state.rows = [];
    let html = '<table style="width:100%; border-collapse:collapse; font-size:13px; color:#e0e0e0;">';
    html += '<tr style="color:#26C6DA; text-align:left;">'
          + '<th style="padding:4px 6px; border-bottom:1px solid #444;">#</th>'
          + '<th style="padding:4px 6px; border-bottom:1px solid #444;">Start</th>'
          + '<th style="padding:4px 6px; border-bottom:1px solid #444;">End</th>'
          + '<th style="padding:4px 6px; border-bottom:1px solid #444;">Loops</th>'
          + '<th style="padding:4px 6px; border-bottom:1px solid #444;"></th></tr>';

    lines.forEach((line, i) => {
      const parsed = parseLoopMixLine(line);
      const rowStyle = 'border-bottom:1px solid #333;';
      if (parsed.error) {
        state.rows.push(null);
        html += '<tr style="' + rowStyle + ' color:#ef5350;">'
              + '<td style="padding:4px 6px;">' + (i + 1) + '</td>'
              + '<td style="padding:4px 6px;" colspan="3">' + escapeHtml(parsed.error) + ' ' + String.fromCharCode(0x2014) + ' <span style="color:#888;">' + escapeHtml(line) + '</span></td>'
              + '<td style="padding:4px 6px;"></td></tr>';
      } else {
        state.rows.push(parsed);
        html += '<tr style="' + rowStyle + '">'
              + '<td style="padding:4px 6px;">' + (i + 1) + '</td>'
              + '<td style="padding:4px 6px;">' + formatSecondsToTime(parsed.start) + '</td>'
              + '<td style="padding:4px 6px;">' + escapeHtml(parsed.endLabel) + '</td>'
              + '<td style="padding:4px 6px;">' + parsed.loops + '</td>'
              + '<td style="padding:4px 6px;"><button data-lmx-row="' + i + '" style="padding:4px 14px; background:linear-gradient(45deg,#26C6DA,#0097A7); color:#fff; border:none; border-radius:5px; cursor:pointer; font-size:12px; font-weight:700;">' + String.fromCharCode(0x25B6) + '</button></td></tr>';
      }
    });
    html += '</table>';
    container.innerHTML = html;

    container.querySelectorAll('[data-lmx-row]').forEach(btn => {
      btn.addEventListener('click', () => runRow(parseInt(btn.getAttribute('data-lmx-row'))));
    });

    const okCount = state.rows.filter(r => r).length;
    setStatus('Table generated: ' + okCount + ' of ' + lines.length + ' segments ready', !okCount);
  }

  // Row ▶ — loop that segment, then close the modal so playback is visible
  function runRow(i) {
    const row = state.rows[i];
    if (!row) return;
    if (startLoop(row.start, row.duration, row.loops)) {
      closeModal();
    }
  }

  buildModal();
  window.__lmx = { openModal, state, version: LMX_VERSION };
  openModal();
  return findMedia() ? 'Loop Mix ready' : 'Opened ' + String.fromCharCode(0x2014) + ' no media found yet';
}
