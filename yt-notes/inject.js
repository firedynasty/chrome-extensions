// YT Notes — injected toggle. Runs on every toolbar-icon click: first click
// turns notes mode on, next click turns it off. Injected code is CSP-safe
// (no inline handlers, no <style> tags) and PURE ASCII: every non-ASCII
// display char is built with String.fromCharCode / String.fromCodePoint
// so the page's charset can never mangle it.
(function () {
  const VERSION = 2;
  const PANEL_ID = '__ytn_panel';

  // Non-ASCII display chars, charset-proof
  const EM = String.fromCharCode(0x2014);        // —
  const MDOT = String.fromCharCode(0x00B7);      // ·
  const ARROW = String.fromCharCode(0x2192);     // →
  const X = String.fromCharCode(0x2715);         // ✕
  const CHECK = String.fromCharCode(0x2713);     // ✓
  const MEMO = String.fromCodePoint(0x1F4DD);    // 📝

  const SEG_SEL = 'transcript-segment-view-model, ytd-transcript-segment-renderer';

  // Collected lines show as short previews in the dialog; the clipboard
  // always carries the full text.
  const PREVIEW_CHARS = 10;

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

  const state = { buffer: [], active: true, pollTimer: null };

  function hasSegments() {
    return !!document.querySelector(SEG_SEL);
  }

  // ---- clipboard ----

  function bufferText() {
    return state.buffer.length ? state.buffer.join('\n') + '\n' : '';
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

  function removeLine(i) {
    state.buffer.splice(i, 1);
    renderList();
    copyBuffer(state.buffer.length + ' line(s) ' + MDOT + ' line removed');
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

  let panel, listEl, statusEl, countEl, inputEl;

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
      empty.style.cssText = 'padding:14px 10px; font-size:12px; color:#777; text-align:center;';
      empty.textContent = 'No lines yet ' + EM + ' click transcript captions or type your own note below';
      listEl.appendChild(empty);
      return;
    }
    state.buffer.forEach(function (line, i) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:flex-start; gap:6px; padding:6px 8px; border-bottom:1px solid #2c2c44; font-size:12.5px; line-height:1.4;';

      const num = document.createElement('span');
      num.style.cssText = 'color:#AB47BC; font-weight:700; flex:none; min-width:18px;';
      num.textContent = (i + 1) + '.';

      const txt = document.createElement('span');
      txt.style.cssText = 'flex:1; white-space:nowrap; overflow:hidden;';
      txt.textContent = line.length > PREVIEW_CHARS ? line.substring(0, PREVIEW_CHARS) + '...' : line;

      const del = document.createElement('button');
      del.style.cssText = 'flex:none; background:none; border:none; color:#666; cursor:pointer; font-size:11px; padding:1px 3px;';
      del.textContent = X;
      del.title = 'Remove this line';
      del.addEventListener('click', function () { removeLine(i); });

      row.appendChild(num);
      row.appendChild(txt);
      row.appendChild(del);
      listEl.appendChild(row);
    });
    // keep the newest line visible
    listEl.scrollTop = listEl.scrollHeight;
  }

  function buildPanel() {
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.style.cssText = 'position:fixed; top:64px; right:16px; width:340px; max-height:78vh; background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:10px; box-shadow:0 8px 30px rgba(0,0,0,0.6); z-index:2147483646; display:flex; flex-direction:column; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; overflow:hidden;';

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

    // collected lines
    listEl = document.createElement('div');
    listEl.style.cssText = 'flex:1; overflow-y:auto; min-height:60px; max-height:46vh;';

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
        addLine(v);
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
      addLine(v);
      inputEl.focus();
    });

    inputRow.appendChild(inputEl);
    inputRow.appendChild(addBtn);

    // status line
    statusEl = document.createElement('div');
    statusEl.style.cssText = 'font-size:11px; color:#888; padding:4px 10px 6px; background:#16162a;';
    statusEl.textContent = 'starting...';

    panel.appendChild(head);
    panel.appendChild(listEl);
    panel.appendChild(inputRow);
    panel.appendChild(statusEl);
    document.body.appendChild(panel);
  }

  // ---- transcript auto-open ----

  function ensureTranscript() {
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
    document.removeEventListener('click', onDocClick, true);
    const p = document.getElementById(PANEL_ID);
    if (p) p.remove();
    panel = null;
    if (window.__ytn && window.__ytn.state === state) window.__ytn = null;
  }

  buildPanel();
  renderList();
  document.addEventListener('click', onDocClick, true);
  window.__ytn = { version: VERSION, deactivate: deactivate, state: state };
  ensureTranscript();
})();
