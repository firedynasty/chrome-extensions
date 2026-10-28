// Claude Wait — injected toggle. Toolbar-icon click shows a Wait button; next click removes it.
// Click Wait to arm it: while your Claude Code session is working the button gets a border,
// and when the session finishes the border is removed and the button disarms.
// State comes from claude_hooks_server (/state), fetched by the service worker.
//
// PURE ASCII string literals: non-ASCII display chars use String.fromCharCode
// so page charset misdetection can never mangle them.
(function () {
  const VERSION = 2;
  const ROOT_ID = '__cwt_root';
  const POLL_MS = 1000;
  const X = String.fromCharCode(0x2715);   // x mark

  // Version upgrade: tear down stale instance.
  if (window.__cwt && window.__cwt.version !== VERSION) {
    try { window.__cwt.deactivate(); } catch (e) {}
    window.__cwt = null;
  }
  // Already active: toggle off.
  if (window.__cwt) {
    window.__cwt.deactivate();
    return;
  }

  let armed = false;
  let sawWorking = false;
  let timer = null;
  let pulse = null;
  let doneTimer = null;

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;display:flex;align-items:center;gap:8px;' +
    'padding:6px 8px;border-radius:10px;background:#1b1b24;color:#eee;font:13px -apple-system,system-ui,sans-serif;' +
    'box-shadow:0 2px 10px rgba(0,0,0,.5);';

  const btn = document.createElement('button');
  btn.textContent = 'Wait';
  btn.style.cssText = 'font:600 13px -apple-system,system-ui,sans-serif;padding:6px 14px;border-radius:8px;cursor:pointer;' +
    'background:#2b2b40;color:#eee;border:1px solid #44445e;';

  const note = document.createElement('span');
  note.style.cssText = 'font-size:12px;color:#9a9ab0;max-width:260px;';

  const close = document.createElement('button');
  close.textContent = X;
  close.title = 'Remove';
  close.style.cssText = 'font:12px sans-serif;padding:2px 6px;border:0;background:transparent;color:#9a9ab0;cursor:pointer;';

  root.appendChild(btn);
  root.appendChild(note);
  root.appendChild(close);
  document.documentElement.appendChild(root);

  function setNote(text, color) { note.textContent = text || ''; note.style.color = color || '#9a9ab0'; }

  function border(color) {
    if (pulse) { pulse.cancel(); pulse = null; }
    if (!color) { btn.style.boxShadow = ''; btn.style.borderColor = '#44445e'; return; }
    btn.style.borderColor = color;
    btn.style.boxShadow = '0 0 0 3px ' + color;
    const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!calm && btn.animate) {
      pulse = btn.animate(
        [{ boxShadow: '0 0 0 2px ' + color }, { boxShadow: '0 0 0 6px rgba(77,163,255,0.18)' }],
        { duration: 900, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }
      );
    }
  }

  function disarm() {
    armed = false; sawWorking = false;
    if (timer) { clearInterval(timer); timer = null; }
    border(null);
    btn.textContent = 'Wait';
  }

  function poll() {
    let answered = false;
    try {
      chrome.runtime.sendMessage({ type: 'claudeWaitState' }, function (res) {
        answered = true;
        if (chrome.runtime.lastError || !res) { return render({ ok: false }); }
        render(res);
      });
    } catch (e) { render({ ok: false }); }   // extension reloaded: this page copy is orphaned
  }

  function render(res) {
    if (!armed) return;
    if (!res.ok) {
      border(null);
      setNote('/Users/stanleytan/Documents/technical/github/claude_hooks_server', '#ff7b72');   // path only, easy to copy
      return;
    }
    if (res.state === 'working') {
      sawWorking = true;
      border('#4da3ff');
      setNote('Claude is working' + (res.project ? ' (' + res.project + ')' : ''), '#4da3ff');
    } else if (res.state === 'waiting') {
      sawWorking = true;
      border('#e8a33c');
      setNote('Claude needs you', '#e8a33c');
    } else if (sawWorking) {
      // finished: border off, button disarms
      disarm();
      setNote('Done', '#34c759');
      if (doneTimer) clearTimeout(doneTimer);
      doneTimer = setTimeout(function () { setNote(''); }, 5000);
    } else {
      border(null);
      setNote('Armed - waiting for Claude to start', '#9a9ab0');
    }
  }

  btn.addEventListener('click', function () {
    if (armed) { disarm(); setNote(''); return; }
    armed = true;
    btn.textContent = 'Waiting';
    setNote('Checking server...', '#9a9ab0');
    poll();
    timer = setInterval(poll, POLL_MS);
  });

  function deactivate() {
    disarm();
    if (doneTimer) clearTimeout(doneTimer);
    root.remove();
    window.__cwt = null;
  }
  close.addEventListener('click', deactivate);

  window.__cwt = { version: VERSION, deactivate: deactivate };
})();
