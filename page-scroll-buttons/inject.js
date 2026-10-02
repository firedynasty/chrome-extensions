// Page Scroll Buttons — injected script. Running it again toggles the buttons off.
(function () {
  var VERSION = 3;
  var old = window.__psb;
  if (old) {
    old.destroy();
    window.__psb = null;
    if (old.version === VERSION) return; // same version => was a toggle-off
  }

  var wrap = document.createElement('div');
  wrap.id = '__psb_wrap';
  wrap.style.cssText = 'position:fixed;right:8px;bottom:52px;z-index:2147483647;' +
    'display:flex;flex-direction:column;gap:8px;';

  // Largest vertically scrollable element, falling back to the window.
  // X/Twitter scrolls the document, but other sites use inner containers.
  function scrollTarget() {
    var se = document.scrollingElement || document.documentElement;
    if (se.scrollHeight > se.clientHeight + 1) return null; // window scrolls
    var best = null, bestArea = 0;
    var els = document.querySelectorAll('*');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.scrollHeight <= el.clientHeight + 1) continue;
      var oy = getComputedStyle(el).overflowY;
      if (oy !== 'auto' && oy !== 'scroll') continue;
      var area = el.clientWidth * el.clientHeight;
      if (area > bestArea) { best = el; bestArea = area; }
    }
    return best;
  }

  function scrollPage(dir) {
    var el = scrollTarget();
    var h = (el ? el.clientHeight : window.innerHeight) * (dir < 0 ? 1 / 3 : 0.9);
    var opts = { top: dir * h, behavior: 'smooth' };
    if (el) el.scrollBy(opts); else window.scrollBy(opts);
  }

  function makeBtn(title, dir, pathD) {
    var b = document.createElement('button');
    b.title = title;
    b.style.cssText = 'width:40px;height:40px;padding:0;background:rgba(0,0,0,0.08);' +
      'border-radius:50%;border:1.5px solid rgb(0,0,0);opacity:0.15;cursor:pointer;' +
      'display:flex;align-items:center;justify-content:center;transition:0.2s;';
    b.innerHTML = '<svg width="36" height="36" viewBox="0 0 64 64"><path d="' + pathD +
      '" stroke="rgba(0,0,0,0.7)" stroke-width="8" fill="none" stroke-linecap="round" ' +
      'stroke-linejoin="round"></path></svg>';
    b.addEventListener('mouseenter', function () { b.style.opacity = '0.8'; });
    b.addEventListener('mouseleave', function () { b.style.opacity = '0.15'; });
    // Keep focus/selection on the page and don't let the page see the press.
    b.addEventListener('mousedown', function (e) { e.preventDefault(); e.stopPropagation(); });
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      scrollPage(dir);
    });
    return b;
  }

  wrap.appendChild(makeBtn('Page up', -1, 'M8 44 L32 20 L56 44'));
  wrap.appendChild(makeBtn('Page down', 1, 'M8 20 L32 44 L56 20'));
  document.documentElement.appendChild(wrap);

  window.__psb = {
    version: VERSION,
    destroy: function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); },
  };
})();
