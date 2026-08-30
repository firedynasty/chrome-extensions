// YT Notes — injected toggle. Runs on every toolbar-icon click: first click
// turns notes mode on, next click turns it off. Injected code is CSP-safe
// (no inline handlers, no <style> tags) and PURE ASCII: every non-ASCII
// display char is built with String.fromCharCode / String.fromCodePoint
// so the page's charset can never mangle it.
//
// Transcript sources (in priority order):
//   1. Downloaded transcript: transcripts/<videoId>.json inside the extension
//      folder (written by yt_notes.py / the `ytnotes` shell function) —
//      rendered in the panel; click a line to collect it with a markdown
//      timestamp link: [H:MM:SS](https://www.youtube.com/watch?v=ID&t=Ns) text
//   2. YouTube's own transcript panel (fallback) — clicks are intercepted
//      so collecting a line doesn't seek the video.
// Typed notes are stamped with the video's current playback time.
(function () {
  const VERSION = 7;
  const PANEL_ID = '__ytn_panel';

  // Non-ASCII display chars, charset-proof
  const EM = String.fromCharCode(0x2014);        // —
  const MDOT = String.fromCharCode(0x00B7);      // ·
  const ARROW = String.fromCharCode(0x2192);     // →
  const X = String.fromCharCode(0x2715);         // ✕
  const CHECK = String.fromCharCode(0x2713);     // ✓
  const MEMO = String.fromCodePoint(0x1F4DD);    // 📝

  const SEG_SEL = 'transcript-segment-view-model, ytd-transcript-segment-renderer';

  // Upgraded code? Tear down the old instance completely.
  if (window.__ytn && window.__ytn.version !== VERSION) {
    try { window.__ytn.deactivate(); } catch (e) {}
    window.__ytn = null;
  }
  // Already running — toggle off.
  if (window.__ytn) {
    window.__ytn.deactivate();
    return;
  }

  const state = {
    buffer: [],
    active: true,
    pollTimer: null,
    vid: null,          // current YouTube video ID (null if not a watch page)
    transcript: null,   // downloaded transcript [{start, text}] if available
    txRows: [],         // rendered transcript row elements
    collected: {},      // transcript indices already collected
    curSegIdx: -1,      // follow-along highlight position
    timeHandler: null   // video timeupdate listener
  };

  function hasSegments() {
    return !!document.querySelector(SEG_SEL);
  }

  // ---- video / timestamp helpers ----

  function getVideoId() {
    const m = location.href.match(/[?&]v=([\w-]{6,})/) || location.href.match(/youtu\.be\/([\w-]{6,})/);
    return m ? m[1] : null;
  }

  function hms(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  // Markdown timestamp link, the plain-link form Obsidian renders clickable.
  function tsLink(sec) {
    return '[' + hms(sec) + '](https://www.youtube.com/watch?v=' + state.vid + '&t=' + Math.floor(sec) + 's)';
  }

  // ---- clipboard ----

  function bufferText() {
    // Blank line after every entry so pastes come out as separate
    // paragraphs even where single newlines get collapsed.
    return state.buffer.length ? state.buffer.join('\n\n') + '\n\n' : '';
  }

  function copyBuffer(msg) {
    const write = navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText(bufferText())
      : Promise.reject(new Error('no clipboard api'));
    write.then(function () {
      setStatus(CHECK + ' ' + msg);
    }).catch(function () {
      setStatus('clipboard blocked ' + EM + ' click the page first, then retry', true);
    });
  }

  // ---- note collection ----

  function addLine(text) {
    text = (text || '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    state.buffer.push(text);
    renderList();
    copyBuffer(state.buffer.length + ' line(s) ' + MDOT + ' clipboard updated');
    flashPanel();
  }

  // Typed notes get stamped with the video's current playback position
  // so the note links back to the moment you wrote it.
  function addTypedNote(text) {
    text = (text || '').trim();
    if (!text) return;
    const v = document.querySelector('video');
    if (v && state.vid) text = text + ' ' + tsLink(v.currentTime);
    addLine(text);
  }

  // Intercept clicks on YouTube's own transcript segments (capture phase,
  // before YouTube's handlers) so collecting a line doesn't seek the video.
  function onDocClick(e) {
    if (!state.active) return;
    const t = e.target;
    if (!t || !t.closest) return;
    const seg = t.closest(SEG_SEL);
    if (!seg) return;
    const txEl = seg.querySelector('span[role="text"]') || seg.querySelector('.segment-text');
    const text = txEl ? txEl.textContent.trim() : '';
    if (!text) return;
    e.preventDefault();
    e.stopPropagation();
    addLine(text);
  }

  // ---- panel UI ----

  let panel, listEl, statusEl, countEl, inputEl, txView;

  function setStatus(msg, isErr) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = isErr ? '#e74c3c' : '#888';
  }

  function flashPanel() {
    if (!panel) return;
    panel.style.borderColor = '#2ecc71';
    setTimeout(function () {
      if (panel) panel.style.borderColor = '#444';
    }, 250);
  }

  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = '';
    countEl.textContent = String(state.buffer.length);
    if (!state.buffer.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:6px 4px; font-size:12px; color:#777; text-align:center; width:100%;';
      empty.textContent = 'No lines yet ' + EM + ' click transcript captions or type your own note below';
      listEl.appendChild(empty);
      return;
    }
    // Compact chips — just [1] [2] [3] ... one per collected line
    state.buffer.forEach(function (line, i) {
      const chip = document.createElement('span');
      chip.style.cssText = 'background:#2c2c44; color:#CE93D8; font-size:11px; font-weight:700; border-radius:4px; padding:2px 6px;';
      chip.textContent = '[' + (i + 1) + ']';
      listEl.appendChild(chip);
    });
    // keep the newest chip visible
    listEl.scrollTop = listEl.scrollHeight;
  }

  // ---- downloaded transcript view ----

  const SENT_END = /[.?!]["')\]]?$/;

  // Sentence boundaries around segment i: expand back/forward to the
  // nearest segments whose text ends with sentence punctuation.
  function sentenceBounds(i) {
    const T = state.transcript;
    let s = i, e = i;
    while (s > 0 && !SENT_END.test(T[s - 1].text.trim())) s--;
    while (e < T.length - 1 && !SENT_END.test(T[e].text.trim())) e++;
    return [s, e];
  }

  // Click collects the clicked sentence plus the sentence before and after,
  // so a note never starts or ends mid-thought. Each sentence keeps its own
  // timestamp link.
  function collectWithContext(idx) {
    const T = state.transcript;
    const parts = [];
    const markFrom = { lo: idx, hi: idx };
    const pushSentence = function (a, b) {
      if (a < 0 || b >= T.length || a > b) return;
      parts.push(tsLink(T[a].start) + ' ' + T.slice(a, b + 1).map(function (x) { return x.text; }).join(' '));
      if (a < markFrom.lo) markFrom.lo = a;
      if (b > markFrom.hi) markFrom.hi = b;
    };
    const sb = sentenceBounds(idx);
    if (sb[0] > 0) {
      const pb = sentenceBounds(sb[0] - 1);
      pushSentence(pb[0], pb[1]);
    }
    pushSentence(sb[0], sb[1]);
    if (sb[1] < T.length - 1) {
      const nb = sentenceBounds(sb[1] + 1);
      pushSentence(nb[0], nb[1]);
    }
    addLine(parts.join(' '));
    for (let k = markFrom.lo; k <= markFrom.hi; k++) {
      state.collected[k] = true;
      if (k !== state.curSegIdx && state.txRows[k]) state.txRows[k].style.background = '#1f2f1f';
    }
  }

  // Follow-along: highlight the row matching the video's current time.
  function onTimeUpdate() {
    if (!state.transcript || !txView) return;
    const v = document.querySelector('video');
    if (!v) return;
    const t = v.currentTime;
    let idx = -1;
    for (let i = 0; i < state.transcript.length; i++) {
      if (state.transcript[i].start <= t) idx = i;
      else break;
    }
    if (idx === state.curSegIdx) return;
    const prev = state.txRows[state.curSegIdx];
    if (prev) prev.style.background = state.collected[state.curSegIdx] ? '#1f2f1f' : '';
    state.curSegIdx = idx;
    const row = state.txRows[idx];
    if (row) {
      row.style.background = '#2a2a44';
      txView.scrollTop = Math.max(0, row.offsetTop - txView.clientHeight / 3);
    }
  }

  function renderTranscript() {
    if (!txView || !state.transcript) return;
    txView.innerHTML = '';
    state.txRows = [];
    state.transcript.forEach(function (seg, i) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; gap:6px; padding:3px 8px; cursor:pointer; font-size:12px; line-height:1.4; border-radius:4px;';
      row.title = 'Click to collect this sentence plus the one before and after, with timestamp links';

      const chip = document.createElement('span');
      chip.style.cssText = 'color:#7ec8e3; font-family:monospace; font-size:11px; flex-shrink:0; padding-top:1px;';
      chip.textContent = hms(seg.start);

      const text = document.createElement('span');
      text.style.cssText = 'color:#d4d4d4;';
      text.textContent = seg.text;

      row.appendChild(chip);
      row.appendChild(text);
      row.addEventListener('click', function () { collectWithContext(i); });
      txView.appendChild(row);
      state.txRows.push(row);
    });
    txView.style.display = '';
    const v = document.querySelector('video');
    if (v) {
      state.timeHandler = onTimeUpdate;
      v.addEventListener('timeupdate', state.timeHandler);
    }
  }

  // Fetch transcripts/<videoId>.json from inside the extension folder.
  // Unpacked extensions read from disk per fetch, so newly downloaded
  // transcripts are picked up without reloading the extension.
  function loadLocalTranscript() {
    state.vid = getVideoId();
    if (!state.vid || !chrome.runtime || !chrome.runtime.getURL) {
      ensureTranscript();
      return;
    }
    setStatus('looking for downloaded transcript...');
    fetch(chrome.runtime.getURL('transcripts/' + state.vid + '.json'))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!state.active) return;
        if (Array.isArray(data) && data.length) {
          state.transcript = data;
          renderTranscript();
          setStatus('downloaded transcript ' + MDOT + ' ' + data.length + ' lines ' + MDOT + ' click to collect');
        } else {
          setStatus('no downloaded transcript for this video ' + EM + ' run: ytnotes <url>', true);
          ensureTranscript();
        }
      })
      .catch(function () {
        if (state.active) ensureTranscript();
      });
  }

  function buildPanel() {
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.style.cssText = 'position:fixed; top:0; right:0; width:340px; max-height:78vh; background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:0 0 0 10px; box-shadow:0 8px 30px rgba(0,0,0,0.6); z-index:2147483646; display:flex; flex-direction:column; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; overflow:hidden;';

    // header
    const head = document.createElement('div');
    head.style.cssText = 'display:flex; align-items:center; gap:8px; padding:8px 10px; background:#16162a; border-bottom:1px solid #333;';

    const title = document.createElement('span');
    title.style.cssText = 'font-weight:700; font-size:13px; color:#fff;';
    title.textContent = MEMO + ' Notes';

    countEl = document.createElement('span');
    countEl.style.cssText = 'background:#AB47BC; color:#fff; font-size:11px; font-weight:700; border-radius:10px; padding:1px 8px;';
    countEl.textContent = '0';

    const spacer = document.createElement('span');
    spacer.style.cssText = 'flex:1;';

    const copyBtn = document.createElement('button');
    copyBtn.style.cssText = 'background:linear-gradient(45deg,#AB47BC,#7B1FA2); color:#fff; border:none; border-radius:5px; font-size:11px; font-weight:700; padding:4px 10px; cursor:pointer;';
    copyBtn.textContent = 'Copy+Clear';
    copyBtn.title = 'Copy the whole list to the clipboard, then clear it';
    copyBtn.addEventListener('click', function () {
      if (!state.buffer.length) { setStatus('nothing to copy yet', true); return; }
      const n = state.buffer.length;
      const write = navigator.clipboard && navigator.clipboard.writeText
        ? navigator.clipboard.writeText(bufferText())
        : Promise.reject(new Error('no clipboard api'));
      write.then(function () {
        state.buffer = [];
        renderList();
        setStatus(CHECK + ' ' + n + ' line(s) copied ' + EM + ' list cleared');
      }).catch(function () {
        setStatus('clipboard blocked ' + EM + ' click the page first, then retry', true);
      });
    });

    const clearBtn = document.createElement('button');
    clearBtn.style.cssText = 'background:#37474F; color:#fff; border:none; border-radius:5px; font-size:11px; font-weight:700; padding:4px 10px; cursor:pointer;';
    clearBtn.textContent = 'Clear';
    clearBtn.title = 'Remove all collected lines';
    clearBtn.addEventListener('click', function () {
      state.buffer = [];
      renderList();
      copyBuffer('cleared');
    });

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:none; border:none; color:#999; font-size:14px; cursor:pointer; padding:2px 4px;';
    closeBtn.textContent = X;
    closeBtn.title = 'Turn notes mode off';
    closeBtn.addEventListener('click', function () { deactivate(); });

    head.appendChild(title);
    head.appendChild(countEl);
    head.appendChild(spacer);
    head.appendChild(copyBtn);
    head.appendChild(clearBtn);
    head.appendChild(closeBtn);

    // downloaded-transcript view (hidden until a transcript JSON loads)
    txView = document.createElement('div');
    txView.style.cssText = 'flex:1; overflow-y:auto; min-height:60px; max-height:38vh; padding:4px 2px; border-bottom:1px solid #333; display:none;';

    // collected lines (compact chips)
    listEl = document.createElement('div');
    listEl.style.cssText = 'overflow-y:auto; min-height:30px; max-height:30vh; display:flex; flex-wrap:wrap; gap:4px; align-content:flex-start; padding:6px 8px;';

    // typed-note input row
    const inputRow = document.createElement('div');
    inputRow.style.cssText = 'display:flex; gap:6px; padding:8px; border-top:1px solid #333; background:#16162a;';

    inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.placeholder = 'Type your own note, Enter to add...';
    inputEl.style.cssText = 'flex:1; background:#0f0f1e; border:1px solid #444; border-radius:6px; color:#e0e0e0; font-size:12px; padding:6px 8px; outline:none;';
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = inputEl.value;
        inputEl.value = '';
        addTypedNote(v);
      } else if (e.key === 'Escape') {
        inputEl.blur();
      }
      e.stopPropagation();
    });

    const addBtn = document.createElement('button');
    addBtn.style.cssText = 'background:linear-gradient(45deg,#AB47BC,#7B1FA2); color:#fff; border:none; border-radius:6px; font-size:12px; font-weight:700; padding:6px 12px; cursor:pointer;';
    addBtn.textContent = 'Add';
    addBtn.addEventListener('click', function () {
      const v = inputEl.value;
      inputEl.value = '';
      addTypedNote(v);
      inputEl.focus();
    });

    inputRow.appendChild(inputEl);
    inputRow.appendChild(addBtn);

    // status line
    statusEl = document.createElement('div');
    statusEl.style.cssText = 'font-size:11px; color:#888; padding:4px 10px 6px; background:#16162a;';
    statusEl.textContent = 'starting...';

    panel.appendChild(head);
    panel.appendChild(txView);
    panel.appendChild(listEl);
    panel.appendChild(inputRow);
    panel.appendChild(statusEl);
    document.body.appendChild(panel);
  }

  // ---- transcript auto-open (YouTube's own panel, fallback) ----

  function ensureTranscript() {
    if (state.transcript) return; // downloaded transcript already showing
    if (hasSegments()) {
      setStatus('transcript ready ' + MDOT + ' click lines to collect');
      return;
    }
    setStatus('opening transcript panel...');
    // The "Show transcript" button lives inside the video description,
    // which may need expanding first.
    try {
      const exp = document.querySelector('#description-inline-expander #expand, #description tp-yt-paper-button#expand, tp-yt-paper-button#expand');
      if (exp) exp.click();
    } catch (e) {}
    setTimeout(function () {
      if (!state.active) return;
      let btn = null;
      const cands = document.querySelectorAll('button, tp-yt-paper-button');
      for (const b of cands) {
        const al = (b.getAttribute('aria-label') || '').toLowerCase();
        if (al.indexOf('transcript') !== -1) { btn = b; break; }
      }
      if (btn) btn.click();
      pollForSegments(0);
    }, 700);
  }

  function pollForSegments(n) {
    if (!state.active) return;
    if (state.transcript) return;
    if (hasSegments()) {
      setStatus('transcript ready ' + MDOT + ' click lines to collect');
      return;
    }
    if (n >= 20) {
      setStatus('no transcript found ' + EM + ' open it manually (... ' + ARROW + ' Show transcript)', true);
      return;
    }
    state.pollTimer = setTimeout(function () { pollForSegments(n + 1); }, 300);
  }

  // ---- lifecycle ----

  function deactivate() {
    state.active = false;
    if (state.pollTimer) { clearTimeout(state.pollTimer); state.pollTimer = null; }
    if (state.timeHandler) {
      const v = document.querySelector('video');
      if (v) v.removeEventListener('timeupdate', state.timeHandler);
      state.timeHandler = null;
    }
    document.removeEventListener('click', onDocClick, true);
    const p = document.getElementById(PANEL_ID);
    if (p) p.remove();
    panel = null;
    txView = null;
    if (window.__ytn && window.__ytn.state === state) window.__ytn = null;
  }

  buildPanel();
  renderList();
  document.addEventListener('click', onDocClick, true);
  window.__ytn = { version: VERSION, deactivate: deactivate, state: state };
  loadLocalTranscript();
})();
