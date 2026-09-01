// Copy Text Tooltip — injected toggle. Toolbar-icon click activates; next click deactivates.
// Select any text and a tooltip appears beside it; click Copy to copy the text.
// Clicking outside the tooltip dismisses it. A floating chip shows the ON/OFF
// state — click it to pause/resume, or its x to deactivate.
// 📋 Paste in the Reveal panel now also opens a full-screen cursive writing modal.
//
// PURE ASCII string literals: non-ASCII display chars use String.fromCharCode
// so page charset misdetection can never mangle them.
(function () {
  const VERSION = 8;
  const TIP_ID    = '__ctx_tip';
  const CHIP_ID   = '__ctx_chip';
  const MODAL_ID  = '__ctx_cursive_modal';

  const CHECK = String.fromCharCode(0x2713);   // ✓
  const X     = String.fromCharCode(0x2715);   // ✕
  const CLIP  = String.fromCodePoint(0x1F4CB); // 📋
  const STAR  = String.fromCharCode(0x2726);   // ✦

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

  // ---- load cursive font once ----
  if (!document.getElementById('__ctx_cursive_font')) {
    const link = document.createElement('link');
    link.id   = '__ctx_cursive_font';
    link.rel  = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Alex+Brush&display=swap';
    document.head.appendChild(link);
  }

  let currentText   = '';
  let doneTimer     = null;
  let cursiveTimer  = null;
  let active        = true;
  let chipStateEl   = null;
  let revealPanelEl = null;

  // ---- cursive modal ----

  function animateCursiveWords(text, outputEl) {
    if (cursiveTimer) { clearTimeout(cursiveTimer); cursiveTimer = null; }
    outputEl.innerHTML = '';
    const words = text.split(/\s+/).filter(Boolean);
    const spans = words.map(function (word, i) {
      const sp = document.createElement('span');
      sp.style.cssText = 'display:inline;opacity:0;transition:opacity 320ms ease;';
      sp.textContent = i < words.length - 1 ? word + ' ' : word;
      outputEl.appendChild(sp);
      return sp;
    });
    let i = 0;
    function next() {
      if (i >= spans.length) { cursiveTimer = null; return; }
      spans[i].style.opacity = '1';
      i++;
      cursiveTimer = setTimeout(next, 160);
    }
    next();
  }

  function removeCursiveModal() {
    if (cursiveTimer) { clearTimeout(cursiveTimer); cursiveTimer = null; }
    const m = document.getElementById(MODAL_ID);
    if (m) m.remove();
  }

  function showCursiveModal(text) {
    removeCursiveModal();

    // backdrop
    const backdrop = document.createElement('div');
    backdrop.id = MODAL_ID;
    backdrop.style.cssText = [
      'position:fixed',
      'top:0', 'left:0', 'right:0', 'bottom:0',
      'z-index:2147483647',
      'background:rgba(0,0,0,0.6)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    ].join(';');
    backdrop.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) removeCursiveModal();
    });

    // card
    const card = document.createElement('div');
    card.style.cssText = [
      'width:85vw',
      'max-width:920px',
      'max-height:85vh',
      'display:flex',
      'flex-direction:column',
      'background:#f5f0e8',
      'background-image:repeating-linear-gradient(transparent,transparent 79px,#c9b99a 79px,#c9b99a 80px)',
      'border:2px solid #c9b99a',
      'border-radius:16px',
      'box-shadow:0 16px 56px rgba(0,0,0,0.45)',
      'overflow:hidden',
    ].join(';');
    card.addEventListener('click', function (e) { e.stopPropagation(); });

    // toolbar
    const toolbar = document.createElement('div');
    toolbar.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:8px',
      'padding:10px 16px',
      'background:linear-gradient(135deg,#AB47BC,#7B1FA2)',
      'flex-shrink:0',
    ].join(';');

    const title = document.createElement('span');
    title.style.cssText = 'color:#fff;font-weight:700;font-size:13px;flex:1;letter-spacing:0.03em;';
    title.textContent = STAR + ' Cursive Clipboard';
    toolbar.appendChild(title);

    // Page-down button
    const pgDnBtn = document.createElement('button');
    pgDnBtn.style.cssText = [
      'background:rgba(255,255,255,0.15)',
      'border:1px solid rgba(255,255,255,0.35)',
      'border-radius:6px',
      'color:#fff',
      'font-size:14px',
      'cursor:pointer',
      'padding:3px 12px',
      'line-height:1',
    ].join(';');
    pgDnBtn.textContent = String.fromCharCode(0x21A7); // ↧
    pgDnBtn.title = 'Page down';
    pgDnBtn.addEventListener('click', function () {
      scrollArea.scrollBy({ top: scrollArea.clientHeight * 0.85, behavior: 'smooth' });
    });
    toolbar.appendChild(pgDnBtn);

    // Nudge-up button — small step back for when page-down overshoots
    const nudgeUpBtn = document.createElement('button');
    nudgeUpBtn.style.cssText = [
      'background:rgba(255,255,255,0.15)',
      'border:1px solid rgba(255,255,255,0.35)',
      'border-radius:6px',
      'color:#fff',
      'font-size:14px',
      'cursor:pointer',
      'padding:3px 12px',
      'line-height:1',
    ].join(';');
    nudgeUpBtn.textContent = String.fromCharCode(0x2191); // ↑
    nudgeUpBtn.title = 'Nudge up';
    nudgeUpBtn.addEventListener('click', function () {
      scrollArea.scrollBy({ top: -(scrollArea.clientHeight * 0.25), behavior: 'smooth' });
    });
    toolbar.appendChild(nudgeUpBtn);

    card.appendChild(toolbar);

    // scroll area
    const scrollArea = document.createElement('div');
    scrollArea.style.cssText = 'flex:1;overflow-y:auto;padding:36px 52px;';

    const outputEl = document.createElement('div');
    outputEl.style.cssText = [
      'font-family:"Alex Brush",cursive',
      'font-size:80px',
      'line-height:1.55',
      'color:#1a1209',
      'word-break:break-word',
      'min-height:100px',
    ].join(';');

    scrollArea.appendChild(outputEl);
    card.appendChild(scrollArea);
    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    // start animation
    animateCursiveWords(text, outputEl);
  }

  // ---- tooltip ----

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

    tip.addEventListener('mousedown', function (e) { e.preventDefault(); e.stopPropagation(); });
    tip.addEventListener('mouseup',   function (e) { e.stopPropagation(); });
    tip.addEventListener('click',     function (e) { e.stopPropagation(); });

    const preview = document.createElement('div');
    preview.style.cssText = 'color:#bbb;margin-bottom:8px;padding-right:16px;word-break:break-word;';
    preview.textContent = text.length > 90 ? text.slice(0, 90) + '...' : text;
    tip.appendChild(preview);

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

    const cursiveBtn = document.createElement('button');
    cursiveBtn.style.cssText = 'background:linear-gradient(45deg,#AB47BC,#7B1FA2);color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:700;padding:4px 14px;cursor:pointer;';
    cursiveBtn.textContent = STAR + 'Cursive';
    cursiveBtn.addEventListener('click', function () {
      removeTooltip();
      showCursiveModal(currentText);
    });
    footer.appendChild(cursiveBtn);

    tip.appendChild(footer);

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

    // floating reveal panel
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

      // 📋 Paste — refresh panel text AND open cursive modal
      const pasteBtn = document.createElement('button');
      pasteBtn.style.cssText = 'background:linear-gradient(45deg,#AB47BC,#7B1FA2);color:#fff;border:none;border-radius:5px;font-size:11px;font-weight:700;padding:3px 10px;cursor:pointer;';
      pasteBtn.textContent = CLIP + ' Paste';
      pasteBtn.addEventListener('mousedown', function (ev) { ev.stopPropagation(); });
      pasteBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        readClipboardIntoPanel();
        // Also launch the cursive modal
        if (navigator.clipboard && navigator.clipboard.readText) {
          navigator.clipboard.readText().then(function (t) {
            if (t) showCursiveModal(t);
          }, function () {});
        }
      });
      footer.appendChild(pasteBtn);

      const clrBtn = document.createElement('button');
      clrBtn.style.cssText = 'background:none;border:1px solid #555;border-radius:5px;color:#aaa;font-size:11px;padding:3px 8px;cursor:pointer;';
      clrBtn.textContent = 'Clr';
      clrBtn.title = 'Clear display and clipboard';
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

    // Reveal button — toggles panel; reads clipboard on open
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
      if (e.target.closest('#' + TIP_ID))   return;
      if (e.target.closest('#' + CHIP_ID))  return;
      if (e.target.closest('#' + MODAL_ID)) return;
    }
    const sel  = window.getSelection();
    const text = sel ? sel.toString().trim() : '';
    if (!text) return;
    showTooltip(e.clientX, e.clientY, text);
  }

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
    removeCursiveModal();
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
