// Copy Text Tooltip — injected toggle. Toolbar-icon click activates; next click deactivates.
// Select any text and a tooltip appears beside it; click Copy to copy the text.
// Clicking outside the tooltip dismisses it. A floating chip shows the ON/OFF
// state — click it to pause/resume, or its x to deactivate.
//
// PURE ASCII string literals: non-ASCII display chars use String.fromCharCode
// so page charset misdetection can never mangle them.
(function () {
  const VERSION = 7;
  const TIP_ID  = '__ctx_tip';
  const CHIP_ID = '__ctx_chip';

  const CHECK = String.fromCharCode(0x2713);   // check mark
  const X     = String.fromCharCode(0x2715);   // x (close)
  const CLIP  = String.fromCodePoint(0x1F4CB); // clipboard

  // Version upgrade: tear down stale instance.
  if (window.__ctx && window.__ctx.version !== VERSION) {
    try { window.__ctx.deactivate(); } catch (e) {}
    window.__ctx = null;
  }
  // Already active: toggle off.
  if (window.__ctx) {
    window.__ctx.deactivate();
    return;
  }

  let currentText   = '';
  let doneTimer     = null;
  let active        = true;
  let chipStateEl   = null;
  let revealPanelEl = null;

  function removeTooltip() {
    if (doneTimer) { clearTimeout(doneTimer); doneTimer = null; }
    const el = document.getElementById(TIP_ID);
    if (el) el.remove();
  }

  function placeTooltip(tip, cx, cy) {
    document.body.appendChild(tip);
    const tw = tip.offsetWidth  || 240;
    const th = tip.offsetHeight || 100;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = cx + 12;
    let top  = cy + 12;
    if (left + tw > vw - 10) left = cx - tw - 12;
    if (top  + th > vh - 10) top  = cy - th - 12;
    if (left < 8) left = 8;
    if (top  < 8) top  = 8;
    tip.style.left = left + 'px';
    tip.style.top  = top  + 'px';
  }

  function copyText(text, onDone) {
    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-100px;left:0;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove();
      onDone();
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(onDone, fallback);
      } else {
        fallback();
      }
    } catch (e) {
      fallback();
    }
  }

  function showTooltip(cx, cy, text) {
    removeTooltip();
    currentText = text;

    const tip = document.createElement('div');
    tip.id = TIP_ID;
    tip.style.cssText = [
      'position:fixed',
      'z-index:2147483647',
      'max-width:320px',
      'min-width:200px',
      'background:#1a1a2e',
      'color:#e0e0e0',
      'border:1px solid #444',
      'border-radius:10px',
      'padding:10px 12px 9px',
      'box-shadow:0 6px 24px rgba(0,0,0,0.55)',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'font-size:12px',
      'line-height:1.45'
    ].join(';');

    // Shield page handlers from presses inside the tooltip; preventDefault on
    // mousedown keeps the page selection from collapsing before Copy is clicked.
    tip.addEventListener('mousedown', function (e) { e.preventDefault(); e.stopPropagation(); });
    tip.addEventListener('mouseup',   function (e) { e.stopPropagation(); });
    tip.addEventListener('click',     function (e) { e.stopPropagation(); });

    // preview of the selected text
    const preview = document.createElement('div');
    preview.style.cssText = 'color:#bbb;margin-bottom:8px;padding-right:16px;word-break:break-word;';
    preview.textContent = text.length > 90 ? text.slice(0, 90) + '...' : text;
    tip.appendChild(preview);

    // footer: char count + copy button
    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;align-items:center;gap:8px;';

    const count = document.createElement('span');
    count.style.cssText = 'color:#666;font-size:11px;flex:1;';
    count.textContent = text.length + (text.length === 1 ? ' char' : ' chars');
    footer.appendChild(count);

    const copyBtn = document.createElement('button');
    copyBtn.style.cssText = 'background:linear-gradient(45deg,#AB47BC,#7B1FA2);color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:700;padding:4px 14px;cursor:pointer;';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', function () {
      copyText(currentText, function () {
        copyBtn.textContent = CHECK + ' Copied';
        const sel = window.getSelection();
        if (sel) sel.removeAllRanges();
        doneTimer = setTimeout(removeTooltip, 900);
      });
    });
    footer.appendChild(copyBtn);
    tip.appendChild(footer);

    // close button
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'position:absolute;top:5px;right:7px;background:none;border:none;color:#777;font-size:12px;cursor:pointer;padding:2px 4px;line-height:1;';
    closeBtn.textContent = X;
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', removeTooltip);
    tip.appendChild(closeBtn);

    placeTooltip(tip, cx, cy);
  }

  // ---- floating toggle chip ----

  function renderChip() {
    const chip = document.getElementById(CHIP_ID);
    if (!chip) return;
    chip.style.background = active ? 'linear-gradient(45deg,#AB47BC,#7B1FA2)' : '#16162a';
    chip.style.color      = active ? '#fff' : '#888';
    chip.style.border     = active ? '1px solid #7B1FA2' : '1px solid #444';
    if (chipStateEl) chipStateEl.textContent = active ? 'ON' : 'OFF';
  }

  function buildChip() {
    const chip = document.createElement('div');
    chip.id = CHIP_ID;
    chip.style.cssText = [
      'position:fixed',
      'bottom:18px',
      'right:18px',
      'z-index:2147483646',
      'display:flex',
      'align-items:center',
      'gap:6px',
      'padding:6px 10px',
      'border-radius:8px',
      'box-shadow:0 4px 16px rgba(0,0,0,0.5)',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'font-size:12px',
      'font-weight:700',
      'cursor:pointer',
      'user-select:none'
    ].join(';');

    // Pressing the chip must not collapse a selection or reach page handlers.
    chip.addEventListener('mousedown', function (e) { e.preventDefault(); e.stopPropagation(); });
    chip.addEventListener('mouseup',   function (e) { e.stopPropagation(); });
    chip.addEventListener('click',     function (e) { e.stopPropagation(); });

    const icon = document.createElement('span');
    icon.textContent = CLIP;
    chip.appendChild(icon);

    const label = document.createElement('span');
    label.textContent = 'Copy';
    chip.appendChild(label);

    chipStateEl = document.createElement('span');
    chipStateEl.style.cssText = 'font-size:10px;opacity:0.85;';
    chip.appendChild(chipStateEl);

    // floating reveal panel — sits just above the chip
    revealPanelEl = document.createElement('div');
    revealPanelEl.style.cssText = [
      'position:fixed',
      'bottom:56px',
      'right:18px',
      'z-index:2147483646',
      'max-width:300px',
      'min-width:160px',
      'background:#1a1a2e',
      'color:#ccc',
      'border:1px solid #444',
      'border-radius:8px',
      'padding:8px 10px',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'font-size:11px',
      'line-height:1.5',
      'word-break:break-word',
      'box-shadow:0 4px 16px rgba(0,0,0,0.5)',
      'display:none',
      'user-select:text'
    ].join(';');
    revealPanelEl.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    revealPanelEl.addEventListener('mouseup',   function (e) { e.stopPropagation(); });
    revealPanelEl.addEventListener('click',     function (e) { e.stopPropagation(); });
    document.body.appendChild(revealPanelEl);

    // textEl is the content area inside the panel — shared by Reveal and Paste.
    let textEl = null;

    function readClipboardIntoPanel() {
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(function (t) {
          if (textEl) textEl.textContent = t ? (t.length > 300 ? t.slice(0, 300) + '...' : t) : '(empty)';
        }, function () {
          if (textEl) textEl.textContent = '(access denied)';
        });
      } else {
        if (textEl) textEl.textContent = '(clipboard API unavailable)';
      }
    }

    function buildPanel() {
      revealPanelEl.textContent = '';

      textEl = document.createElement('div');
      textEl.style.cssText = 'margin-bottom:8px;word-break:break-word;max-height:80px;overflow-y:auto;';
      revealPanelEl.appendChild(textEl);

      const footer = document.createElement('div');
      footer.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;';

      const pasteBtn = document.createElement('button');
      pasteBtn.style.cssText = 'background:linear-gradient(45deg,#AB47BC,#7B1FA2);color:#fff;border:none;border-radius:5px;font-size:11px;font-weight:700;padding:3px 10px;cursor:pointer;';
      pasteBtn.textContent = CLIP + ' Paste';
      pasteBtn.addEventListener('mousedown', function (ev) { ev.stopPropagation(); });
      pasteBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        readClipboardIntoPanel();
      });
      footer.appendChild(pasteBtn);

      const clrBtn = document.createElement('button');
      clrBtn.style.cssText = 'background:none;border:1px solid #555;border-radius:5px;color:#aaa;font-size:11px;padding:3px 8px;cursor:pointer;';
      clrBtn.textContent = 'Clr';
      clrBtn.title = 'Clear clipboard';
      clrBtn.addEventListener('mousedown', function (ev) { ev.stopPropagation(); });
      clrBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (textEl) textEl.textContent = '';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('');
        }
      });
      footer.appendChild(clrBtn);

      revealPanelEl.appendChild(footer);
    }

    // reveal button — toggles the panel; reads clipboard on open
    const revealBtn = document.createElement('button');
    revealBtn.style.cssText = [
      'background:none',
      'border:1px solid rgba(255,255,255,0.3)',
      'border-radius:4px',
      'color:inherit',
      'font-size:10px',
      'font-weight:700',
      'cursor:pointer',
      'padding:1px 6px',
      'line-height:1.5',
      'opacity:0.85'
    ].join(';');
    revealBtn.textContent = 'Reveal';
    revealBtn.title = 'Show clipboard contents';
    revealBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (revealPanelEl.style.display !== 'none') {
        revealPanelEl.style.display = 'none';
        revealBtn.textContent = 'Reveal';
        return;
      }
      buildPanel();
      revealPanelEl.style.display = 'block';
      revealBtn.textContent = 'Reveal ' + CHECK;
      readClipboardIntoPanel();
    });
    chip.appendChild(revealBtn);

    const offBtn = document.createElement('button');
    offBtn.style.cssText = 'background:none;border:none;color:inherit;font-size:12px;cursor:pointer;padding:0 0 0 4px;line-height:1;opacity:0.7;';
    offBtn.textContent = X;
    offBtn.title = 'Deactivate';
    offBtn.addEventListener('click', function (e) { e.stopPropagation(); deactivate(); });
    chip.appendChild(offBtn);

    chip.addEventListener('click', function () {
      active = !active;
      if (!active) removeTooltip();
      renderChip();
    });

    document.body.appendChild(chip);
    renderChip();
  }

  // ---- selection handler ----

  function onMouseUp(e) {
    if (!active) return;
    if (e.target && e.target.closest) {
      if (e.target.closest('#' + TIP_ID)) return;
      if (e.target.closest('#' + CHIP_ID)) return;
    }
    const sel  = window.getSelection();
    const text = sel ? sel.toString().trim() : '';
    if (!text) return;
    showTooltip(e.clientX, e.clientY, text);
  }

  // Click outside the tooltip closes it; clicks inside it are ignored.
  // mousedown in capture phase so dismissal is immediate and page handlers
  // cannot intercept the event first.
  function onDocMouseDown(e) {
    if (!document.getElementById(TIP_ID)) return;
    if (e.target && e.target.closest && e.target.closest('#' + TIP_ID)) return;
    removeTooltip();
  }

  // ---- lifecycle ----

  function deactivate() {
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('mousedown', onDocMouseDown, true);
    removeTooltip();
    const chip = document.getElementById(CHIP_ID);
    if (chip) chip.remove();
    if (revealPanelEl) { revealPanelEl.remove(); revealPanelEl = null; }
    chipStateEl = null;
    if (window.__ctx && window.__ctx.deactivate === deactivate) window.__ctx = null;
  }

  buildChip();
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('mousedown', onDocMouseDown, true);
  window.__ctx = { version: VERSION, deactivate: deactivate };
})();
