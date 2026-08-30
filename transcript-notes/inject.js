// Transcript Notes — injected toggle. Paste any transcript (Coursera,
// lectures, talks), it splits into clickable sentences; click toggles a
// sentence into your notes, type your own, export via clipboard or .txt.
// Injected code is CSP-safe (no inline handlers, no <style> tags) and PURE
// ASCII: every non-ASCII display char is built with String.fromCharCode /
// String.fromCodePoint so the page's charset can never mangle it.
(function () {
  const VERSION = 2;
  const PANEL_ID = '__tnx_panel';

  // Non-ASCII display chars, charset-proof
  const X = String.fromCharCode(0x2715);         // ✕
  const CHECK = String.fromCharCode(0x2713);     // ✓
  const EM = String.fromCharCode(0x2014);        // —
  const MDOT = String.fromCharCode(0x00B7);      // ·
  const CLIP = String.fromCodePoint(0x1F4CB);    // 📋

  // Upgraded code? Tear down the old instance completely.
  if (window.__tnx && window.__tnx.version !== VERSION) {
    try { window.__tnx.deactivate(); } catch (e) {}
    window.__tnx = null;
  }
  // Already running — toggle off.
  if (window.__tnx) {
    window.__tnx.deactivate();
    return;
  }

  const state = {
    active: true,
    sentences: [],   // parsed transcript sentences
    selected: {},    // sentence index -> true (row highlighting)
    entries: []      // collected items in insertion order: {kind:'s',idx,text} or {kind:'n',text}
  };

  // ---- sentence splitting ----

  // Caption noise markers: [MUSIC], [APPLAUSE], [Laughter] etc.
  const NOISE_RE = /\[(music|applause|laughter|noise|silence|cheering|inaudible|crosstalk|foreign)\]/gi;

  function splitSentences(text) {
    const cleaned = text.replace(NOISE_RE, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) return [];
    const parts = cleaned.split(/(?<=[.?!])["')\]]?\s+/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    // No sentence punctuation found (one caption per line format)? Split by lines.
    if (parts.length <= 1 && text.indexOf('\n') !== -1) {
      return text.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    }
    return parts;
  }

  // ---- export ----

  // Entries export in the order you collected them — clicked sentences and
  // typed notes interleaved exactly as you entered them.
  function exportText() {
    return state.entries.length
      ? state.entries.map(function (e) { return e.text; }).join('\n\n') + '\n\n'
      : '';
  }

  function selectionCount() {
    return state.entries.length;
  }

  function copyExport(msg) {
    if (!selectionCount()) { setStatus('nothing selected yet', true); return; }
    const write = navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText(exportText())
      : Promise.reject(new Error('no clipboard api'));
    write.then(function () {
      setStatus(CHECK + ' ' + msg);
    }).catch(function () {
      setStatus('clipboard blocked ' + EM + ' click the page first, then retry', true);
    });
  }

  function downloadExport() {
    if (!selectionCount()) { setStatus('nothing selected yet', true); return; }
    const blob = new Blob([exportText()], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'transcript-notes.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    setStatus(CHECK + ' saved transcript-notes.txt');
  }

  // ---- panel UI ----

  let panel, sentView, statusEl, countEl, inputEl, pasteZone, pasteInput, listEl;

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

  function refreshCount() {
    if (countEl) countEl.textContent = String(selectionCount());
  }

  function renderChips() {
    if (!listEl) return;
    listEl.innerHTML = '';
    let noteSeq = 0;
    state.entries.forEach(function (e) {
      const chip = document.createElement('span');
      if (e.kind === 's') {
        chip.style.cssText = 'background:#1f3d2b; color:#A5D6A7; font-size:11px; font-weight:700; border-radius:4px; padding:2px 6px;';
        chip.textContent = 's' + (e.idx + 1);
      } else {
        noteSeq++;
        chip.style.cssText = 'background:#2c2c44; color:#CE93D8; font-size:11px; font-weight:700; border-radius:4px; padding:2px 6px;';
        chip.textContent = 'n' + noteSeq;
      }
      chip.title = e.text;
      listEl.appendChild(chip);
    });
    if (!state.entries.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:2px 4px; font-size:11px; color:#666; width:100%;';
      empty.textContent = 'nothing collected yet';
      listEl.appendChild(empty);
    }
    refreshCount();
  }

  function renderSentences() {
    sentView.innerHTML = '';
    state.sentences.forEach(function (s, i) {
      const row = document.createElement('div');
      row.style.cssText = 'padding:4px 8px; cursor:pointer; font-size:12px; line-height:1.45; border-radius:4px; color:#d4d4d4;';
      row.textContent = s;
      if (state.selected[i]) row.style.background = '#1f3d2b';
      row.addEventListener('click', function () {
        if (state.selected[i]) {
          delete state.selected[i];
          const at = state.entries.findIndex(function (e) { return e.kind === 's' && e.idx === i; });
          if (at !== -1) state.entries.splice(at, 1);
          row.style.background = '';
        } else {
          state.selected[i] = true;
          state.entries.push({ kind: 's', idx: i, text: s });
          row.style.background = '#1f3d2b';
          flashPanel();
        }
        renderChips();
        setStatus(selectionCount() + ' item(s) selected');
      });
      sentView.appendChild(row);
    });
  }

  function loadTranscript(text) {
    state.sentences = splitSentences(text);
    state.selected = {};
    if (!state.sentences.length) {
      setStatus('no text found ' + EM + ' paste a transcript first', true);
      return;
    }
    renderSentences();
    renderChips();
    pasteZone.style.display = 'none';
    sentView.style.display = '';
    setStatus(state.sentences.length + ' sentence(s) ' + MDOT + ' click to collect');
  }

  function buildPanel() {
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.style.cssText = 'position:fixed; top:0; right:0; width:360px; max-height:82vh; background:#1a1a2e; color:#e0e0e0; border:1px solid #444; border-radius:0 0 0 10px; box-shadow:0 8px 30px rgba(0,0,0,0.6); z-index:2147483646; display:flex; flex-direction:column; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; overflow:hidden;';

    // header
    const head = document.createElement('div');
    head.style.cssText = 'display:flex; align-items:center; gap:6px; padding:8px 10px; background:#16162a; border-bottom:1px solid #333;';

    const title = document.createElement('span');
    title.style.cssText = 'font-weight:700; font-size:13px; color:#fff;';
    title.textContent = CLIP + ' Transcript Notes';

    countEl = document.createElement('span');
    countEl.style.cssText = 'background:#43A047; color:#fff; font-size:11px; font-weight:700; border-radius:10px; padding:1px 8px;';
    countEl.textContent = '0';

    const spacer = document.createElement('span');
    spacer.style.cssText = 'flex:1;';

    const copyBtn = document.createElement('button');
    copyBtn.style.cssText = 'background:linear-gradient(45deg,#43A047,#1B5E20); color:#fff; border:none; border-radius:5px; font-size:11px; font-weight:700; padding:4px 10px; cursor:pointer;';
    copyBtn.textContent = 'Copy';
    copyBtn.title = 'Copy selected sentences + typed notes to the clipboard';
    copyBtn.addEventListener('click', function () { copyExport('copied to clipboard'); });

    const dlBtn = document.createElement('button');
    dlBtn.style.cssText = 'background:#37474F; color:#fff; border:none; border-radius:5px; font-size:11px; font-weight:700; padding:4px 10px; cursor:pointer;';
    dlBtn.textContent = '.txt';
    dlBtn.title = 'Download selection as transcript-notes.txt';
    dlBtn.addEventListener('click', downloadExport);

    const clearBtn = document.createElement('button');
    clearBtn.style.cssText = 'background:#37474F; color:#fff; border:none; border-radius:5px; font-size:11px; font-weight:700; padding:4px 10px; cursor:pointer;';
    clearBtn.textContent = 'Clear';
    clearBtn.title = 'Deselect all sentences and remove typed notes';
    clearBtn.addEventListener('click', function () {
      state.selected = {};
      state.entries = [];
      renderSentences();
      renderChips();
      setStatus('cleared');
    });

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:none; border:none; color:#999; font-size:14px; cursor:pointer; padding:2px 4px;';
    closeBtn.textContent = X;
    closeBtn.title = 'Close panel';
    closeBtn.addEventListener('click', function () { deactivate(); });

    head.appendChild(title);
    head.appendChild(countEl);
    head.appendChild(spacer);
    head.appendChild(copyBtn);
    head.appendChild(dlBtn);
    head.appendChild(clearBtn);
    head.appendChild(closeBtn);

    // paste zone (shown until a transcript loads)
    pasteZone = document.createElement('div');
    pasteZone.style.cssText = 'padding:8px; border-bottom:1px solid #333; background:#16162a;';

    pasteInput = document.createElement('textarea');
    pasteInput.placeholder = 'Paste transcript here (Cmd+V)...';
    pasteInput.style.cssText = 'width:100%; box-sizing:border-box; height:88px; background:#0f0f1e; border:1px solid #444; border-radius:6px; color:#e0e0e0; font-size:12px; padding:6px 8px; outline:none; resize:vertical;';
    pasteInput.addEventListener('keydown', function (e) { e.stopPropagation(); });

    const pasteBtns = document.createElement('div');
    pasteBtns.style.cssText = 'display:flex; gap:6px; margin-top:6px;';

    const loadBtn = document.createElement('button');
    loadBtn.style.cssText = 'flex:1; background:linear-gradient(45deg,#43A047,#1B5E20); color:#fff; border:none; border-radius:6px; font-size:12px; font-weight:700; padding:6px 0; cursor:pointer;';
    loadBtn.textContent = 'Split into sentences';
    loadBtn.addEventListener('click', function () { loadTranscript(pasteInput.value); });

    const readClipBtn = document.createElement('button');
    readClipBtn.style.cssText = 'flex:1; background:#37474F; color:#fff; border:none; border-radius:6px; font-size:12px; font-weight:700; padding:6px 0; cursor:pointer;';
    readClipBtn.textContent = 'Read clipboard';
    readClipBtn.title = 'Try to read the clipboard directly; if blocked, paste manually above';
    readClipBtn.addEventListener('click', function () {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        setStatus('clipboard read not available ' + EM + ' paste manually (Cmd+V)', true);
        return;
      }
      navigator.clipboard.readText().then(function (t) {
        if (t && t.trim()) {
          pasteInput.value = t;
          loadTranscript(t);
        } else {
          setStatus('clipboard is empty', true);
        }
      }).catch(function () {
        setStatus('clipboard blocked ' + EM + ' paste manually (Cmd+V)', true);
      });
    });

    pasteBtns.appendChild(loadBtn);
    pasteBtns.appendChild(readClipBtn);
    pasteZone.appendChild(pasteInput);
    pasteZone.appendChild(pasteBtns);

    // sentence list (hidden until a transcript loads)
    sentView = document.createElement('div');
    sentView.style.cssText = 'flex:1; overflow-y:auto; min-height:60px; max-height:38vh; padding:4px 2px; border-bottom:1px solid #333; display:none;';

    // collected chips
    listEl = document.createElement('div');
    listEl.style.cssText = 'overflow-y:auto; min-height:26px; max-height:20vh; display:flex; flex-wrap:wrap; gap:4px; align-content:flex-start; padding:6px 8px; border-bottom:1px solid #333;';

    // typed-note input row
    const inputRow = document.createElement('div');
    inputRow.style.cssText = 'display:flex; gap:6px; padding:8px; background:#16162a;';

    inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.placeholder = 'Type your own note, Enter to add...';
    inputEl.style.cssText = 'flex:1; background:#0f0f1e; border:1px solid #444; border-radius:6px; color:#e0e0e0; font-size:12px; padding:6px 8px; outline:none;';
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTypedNote(inputEl.value);
        inputEl.value = '';
      } else if (e.key === 'Escape') {
        inputEl.blur();
      }
      e.stopPropagation();
    });

    const addBtn = document.createElement('button');
    addBtn.style.cssText = 'background:linear-gradient(45deg,#43A047,#1B5E20); color:#fff; border:none; border-radius:6px; font-size:12px; font-weight:700; padding:6px 12px; cursor:pointer;';
    addBtn.textContent = 'Add';
    addBtn.addEventListener('click', function () {
      addTypedNote(inputEl.value);
      inputEl.value = '';
      inputEl.focus();
    });

    inputRow.appendChild(inputEl);
    inputRow.appendChild(addBtn);

    // "paste another transcript" row
    const newRow = document.createElement('div');
    newRow.style.cssText = 'padding:0 8px 6px; background:#16162a;';
    const newBtn = document.createElement('button');
    newBtn.style.cssText = 'background:none; border:none; color:#7ec8e3; font-size:11px; cursor:pointer; padding:0; text-decoration:underline;';
    newBtn.textContent = 'paste another transcript';
    newBtn.addEventListener('click', function () {
      pasteZone.style.display = '';
      pasteInput.value = '';
      pasteInput.focus();
    });
    newRow.appendChild(newBtn);

    // status line
    statusEl = document.createElement('div');
    statusEl.style.cssText = 'font-size:11px; color:#888; padding:4px 10px 6px; background:#16162a; border-top:1px solid #333;';
    statusEl.textContent = 'paste a transcript to begin';

    panel.appendChild(head);
    panel.appendChild(pasteZone);
    panel.appendChild(sentView);
    panel.appendChild(listEl);
    panel.appendChild(inputRow);
    panel.appendChild(newRow);
    panel.appendChild(statusEl);
    document.body.appendChild(panel);
  }

  function addTypedNote(text) {
    text = (text || '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    state.entries.push({ kind: 'n', text: text });
    renderChips();
    flashPanel();
    setStatus(selectionCount() + ' item(s) selected');
  }

  // ---- lifecycle ----

  function deactivate() {
    state.active = false;
    const p = document.getElementById(PANEL_ID);
    if (p) p.remove();
    panel = null;
    sentView = null;
    pasteZone = null;
    if (window.__tnx && window.__tnx.state === state) window.__tnx = null;
  }

  buildPanel();
  renderChips();
  window.__tnx = { version: VERSION, deactivate: deactivate, state: state };
})();
