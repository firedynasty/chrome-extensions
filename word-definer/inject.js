// Word Definer — injected toggle. Toolbar-icon click activates; next click deactivates.
// Double-click a word to look it up. Sticky navbar lets you type any word manually.
// Clicking outside the tooltip dismisses it. If a word isn't found,
// it's pre-filled in the navbar input for manual editing.
//
// PURE ASCII string literals: non-ASCII display chars use String.fromCharCode /
// String.fromCodePoint so page charset misdetection can never mangle them.
(function () {
  const VERSION  = 10;
  const TIP_ID   = '__wdf_tip';
  const BAR_ID   = '__wdf_bar';

  // Non-ASCII display chars, charset-proof
  const X    = String.fromCharCode(0x2715);   // x (close)
  const EM   = String.fromCharCode(0x2014);   // em dash
  const BOOK = String.fromCodePoint(0x1F4D6); // open book

  // Version upgrade: tear down stale instance.
  if (window.__wdf && window.__wdf.version !== VERSION) {
    try { window.__wdf.deactivate(); } catch (e) {}
    window.__wdf = null;
  }
  // Already active: toggle off.
  if (window.__wdf) {
    window.__wdf.deactivate();
    return;
  }

  // ---- tooltip ----

  let statusTimer = null;
  let tipInputEl = null;
  let wantTipFocus = false;

  function removeTooltip() {
    if (statusTimer) { clearTimeout(statusTimer); statusTimer = null; }
    const el = document.getElementById(TIP_ID);
    if (el) el.remove();
    tipInputEl = null;
  }

  function placeTooltip(tip, cx, cy) {
    document.body.appendChild(tip);
    const tw = tip.offsetWidth  || 300;
    const th = tip.offsetHeight || 180;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = cx + 14;
    let top  = cy + 14;
    if (left + tw > vw - 10) left = cx - tw - 14;
    if (top  + th > vh - 10) top  = cy - th - 14;
    if (left < 8) left = 8;
    if (top  < 8) top  = 8;
    tip.style.left = left + 'px';
    tip.style.top  = top  + 'px';
  }

  function makeBaseTooltip() {
    if (statusTimer) { clearTimeout(statusTimer); statusTimer = null; }
    removeTooltip();
    const tip = document.createElement('div');
    tip.id = TIP_ID;
    tip.style.cssText = [
      'position:fixed',
      'z-index:2147483647',
      'max-width:320px',
      'min-width:180px',
      'background:#1a1a2e',
      'color:#e0e0e0',
      'border:1px solid #444',
      'border-radius:10px',
      'padding:12px 14px 10px',
      'box-shadow:0 6px 24px rgba(0,0,0,0.55)',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'font-size:13px',
      'line-height:1.5'
    ].join(';');
    return tip;
  }

  function addCloseBtn(tip) {
    const btn = document.createElement('button');
    btn.style.cssText = 'position:absolute;top:6px;right:8px;background:none;border:none;color:#777;font-size:13px;cursor:pointer;padding:2px 4px;line-height:1;';
    btn.textContent = X;
    btn.title = 'Close';
    btn.addEventListener('click', removeTooltip);
    tip.appendChild(btn);
  }

  function showStatus(cx, cy, msg) {
    wantTipFocus = false;
    const tip = makeBaseTooltip();
    tip.style.color = '#888';
    tip.style.fontSize = '12px';
    tip.style.padding = '8px 12px';
    tip.textContent = msg;
    placeTooltip(tip, cx, cy);
    statusTimer = setTimeout(removeTooltip, 2200);
  }

  // ---- archaic tags ----

  const ARCHAIC_TAGS = ['archaic', 'obsolete', 'dated', 'historical', 'rare', 'poetic'];

  function isArchaicTag(tag) {
    return ARCHAIC_TAGS.indexOf((tag || '').toLowerCase()) !== -1;
  }

  // ---- render definition ----

  function showDefinition(cx, cy, data) {
    const tip  = makeBaseTooltip();
    const entry = Array.isArray(data) ? data[0] : data;
    if (!entry || !entry.meanings) { showStatus(cx, cy, 'no definition found'); return; }

    // heading: word + phonetic
    const heading = document.createElement('div');
    heading.style.cssText = 'font-size:15px;font-weight:700;color:#fff;margin-bottom:2px;padding-right:22px;';
    const phonetics = entry.phonetics || [];
    const phonetic  = entry.phonetic
      || (phonetics.find(function (p) { return p && p.text; }) || {}).text
      || '';
    heading.textContent = entry.word + (phonetic ? '  ' + phonetic : '');
    tip.appendChild(heading);

    // meanings (max 3 parts of speech, max 2 defs each)
    const meanings = entry.meanings || [];
    meanings.slice(0, 3).forEach(function (meaning) {
      const pos = document.createElement('div');
      pos.style.cssText = 'font-style:italic;color:#AB47BC;font-size:11px;margin-top:8px;margin-bottom:3px;';
      pos.textContent = meaning.partOfSpeech || '';
      tip.appendChild(pos);

      (meaning.definitions || []).slice(0, 2).forEach(function (def, idx) {
        const defEl = document.createElement('div');
        defEl.style.cssText = 'margin-bottom:4px;padding-left:10px;border-left:2px solid #2a2a44;font-size:12px;';

        const archaicTag = (def.tags || []).find(isArchaicTag);

        const numEl = document.createElement('span');
        numEl.style.cssText = 'color:#666;margin-right:4px;';
        numEl.textContent = (idx + 1) + '.';
        defEl.appendChild(numEl);

        if (archaicTag) {
          const badge = document.createElement('span');
          badge.style.cssText = 'background:#3a2800;color:#FFA726;font-size:10px;font-weight:700;border-radius:3px;padding:1px 5px;margin-right:5px;';
          badge.textContent = archaicTag;
          defEl.appendChild(badge);
        }

        defEl.appendChild(document.createTextNode(def.definition || ''));

        if (def.example) {
          const ex = document.createElement('div');
          ex.style.cssText = 'font-style:italic;color:#777;font-size:11px;margin-top:2px;';
          ex.textContent = '"' + def.example + '"';
          defEl.appendChild(ex);
        }
        tip.appendChild(defEl);
      });
    });

    // synonyms (first 4)
    const allSyns = [];
    meanings.slice(0, 2).forEach(function (m) {
      (m.synonyms || []).forEach(function (s) { if (allSyns.length < 4) allSyns.push(s); });
      (m.definitions || []).forEach(function (d) {
        (d.synonyms || []).forEach(function (s) { if (allSyns.length < 4) allSyns.push(s); });
      });
    });
    if (allSyns.length) {
      const synRow = document.createElement('div');
      synRow.style.cssText = 'margin-top:8px;font-size:11px;color:#666;border-top:1px solid #2a2a44;padding-top:6px;';
      const label = document.createElement('span');
      label.style.cssText = 'color:#555;margin-right:4px;';
      label.textContent = 'also:';
      synRow.appendChild(label);
      synRow.appendChild(document.createTextNode(allSyns.join(', ')));
      tip.appendChild(synRow);
    }

    // manual lookup input: type a word, Enter redefines in place
    const tipInput = document.createElement('input');
    tipInput.type = 'text';
    tipInput.placeholder = 'Look up another word...';
    tipInput.style.cssText = [
      'display:block',
      'width:100%',
      'box-sizing:border-box',
      'margin-top:10px',
      'background:#0f0f1e',
      'border:1px solid #444',
      'border-radius:6px',
      'color:#e0e0e0',
      'font-size:12px',
      'padding:5px 8px',
      'outline:none'
    ].join(';');
    tipInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const word = tipInput.value.trim().replace(/^[^a-zA-Z]+|[^a-zA-Z']+$/g, '').toLowerCase();
        if (!word || word.length < 2) return;
        // Re-anchor the next tooltip where this one currently sits
        const rect = tip.getBoundingClientRect();
        wantTipFocus = true;
        doLookup(word, rect.left - 14, rect.top - 14);
      }
      e.stopPropagation();
    });
    tipInputEl = tipInput;
    tip.appendChild(tipInput);

    addCloseBtn(tip);
    placeTooltip(tip, cx, cy);
    if (wantTipFocus) tipInput.focus();
    wantTipFocus = false;
  }

  // ---- lookup ----

  let pendingLookup = false;
  let barInputEl    = null;

  function doLookup(word, cx, cy) {
    if (pendingLookup) return;
    // If the extension was reloaded, chrome.runtime.id is undefined — bail out cleanly.
    if (!chrome.runtime || !chrome.runtime.id) { deactivate(); return; }
    pendingLookup = true;
    showStatus(cx, cy, 'looking up ' + EM + ' ' + word + '...');

    try {
      chrome.runtime.sendMessage({ type: 'DEFINE', word: word }, function (resp) {
        pendingLookup = false;
        if (chrome.runtime.lastError) { showStatus(cx, cy, 'lookup error'); return; }
        if (!resp || !resp.ok) {
          // Pre-fill the navbar so the user can edit and retry manually
          if (barInputEl) {
            barInputEl.value = word;
            barInputEl.focus();
            barInputEl.select();
          }
          showStatus(cx, cy, '"' + word + '" ' + EM + ' not found, edit above and try again');
          return;
        }
        showDefinition(cx, cy, resp.data);
      });
    } catch (e) {
      pendingLookup = false;
      deactivate();
    }
  }

  // ---- navbar ----

  function buildNavbar() {
    const bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'right:0',
      'z-index:2147483646',
      'height:44px',
      'background:#16162a',
      'border-bottom:1px solid #2a2a44',
      'display:flex',
      'align-items:center',
      'gap:8px',
      'padding:0 14px',
      'box-shadow:0 2px 12px rgba(0,0,0,0.5)',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
    ].join(';');

    const icon = document.createElement('span');
    icon.style.cssText = 'font-size:16px;flex-shrink:0;';
    icon.textContent = BOOK;
    bar.appendChild(icon);

    barInputEl = document.createElement('input');
    barInputEl.type = 'text';
    barInputEl.placeholder = 'Type a word and press Enter...';
    barInputEl.style.cssText = [
      'flex:1',
      'max-width:340px',
      'background:#0f0f1e',
      'border:1px solid #444',
      'border-radius:6px',
      'color:#e0e0e0',
      'font-size:13px',
      'padding:5px 10px',
      'outline:none'
    ].join(';');

    const goBtn = document.createElement('button');
    goBtn.style.cssText = 'background:linear-gradient(45deg,#AB47BC,#7B1FA2);color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:700;padding:5px 14px;cursor:pointer;flex-shrink:0;';
    goBtn.textContent = 'Define';

    const spacer = document.createElement('span');
    spacer.style.cssText = 'flex:1;';

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:none;border:none;color:#666;font-size:14px;cursor:pointer;padding:2px 4px;line-height:1;flex-shrink:0;';
    closeBtn.textContent = X;
    closeBtn.title = 'Hide bar (lookup mode still active)';

    function runBarLookup() {
      const word = barInputEl.value.trim().replace(/^[^a-zA-Z]+|[^a-zA-Z']+$/g, '').toLowerCase();
      if (!word || word.length < 2) return;
      const rect = barInputEl.getBoundingClientRect();
      doLookup(word, rect.left, rect.bottom + 4);
    }

    barInputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); runBarLookup(); }
      e.stopPropagation();
    });
    goBtn.addEventListener('click', runBarLookup);
    closeBtn.addEventListener('click', function () {
      const el = document.getElementById(BAR_ID);
      if (el) el.remove();
      barInputEl = null;
    });

    bar.appendChild(barInputEl);
    bar.appendChild(goBtn);
    bar.appendChild(spacer);
    bar.appendChild(closeBtn);
    document.body.appendChild(bar);
  }

  // ---- selection handler ----

  function onMouseUp(e) {
    if (e.target && e.target.closest) {
      if (e.target.closest('#' + TIP_ID)) return;
      if (e.target.closest('#' + BAR_ID)) return;
    }

    const sel  = window.getSelection();
    const text = sel ? sel.toString().trim() : '';
    if (!text) return;

    const raw = text.split(/\s+/)[0].replace(/^[^a-zA-Z]+|[^a-zA-Z']+$/g, '');
    if (!raw || raw.length < 2) return;

    if (text.split(/\s+/).length > 1) {
      showStatus(e.clientX, e.clientY, 'select a single word to look it up');
      return;
    }

    doLookup(raw.toLowerCase(), e.clientX, e.clientY);
  }

  // Click outside the tooltip closes it; clicks inside it (or on the navbar)
  // are ignored. mousedown in capture phase so dismissal is immediate and
  // page handlers cannot intercept the event first.
  function onDocMouseDown(e) {
    if (!document.getElementById(TIP_ID)) return;
    if (e.target && e.target.closest) {
      if (e.target.closest('#' + TIP_ID)) return;
      if (e.target.closest('#' + BAR_ID)) return;
    }
    removeTooltip();
  }

  // ---- lifecycle ----

  function deactivate() {
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('mousedown', onDocMouseDown, true);
    removeTooltip();
    const bar = document.getElementById(BAR_ID);
    if (bar) bar.remove();
    barInputEl = null;
    if (window.__wdf && window.__wdf.deactivate === deactivate) window.__wdf = null;
  }

  buildNavbar();
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('mousedown', onDocMouseDown, true);
  window.__wdf = { version: VERSION, deactivate: deactivate };
})();
