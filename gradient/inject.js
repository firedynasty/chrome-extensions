(function () {
  'use strict';

  // Version-stamped singleton: a click on an up-to-date copy toggles it off;
  // a stale copy from an older version is torn down and replaced.
  const VERSION = 1;
  const LINE_ID = '__grd-line';

  const prev = window.__grd;
  if (prev) {
    prev.teardown();
    window.__grd = null;
    if (prev.version === VERSION) return; // toggled off
  }

  const line = document.createElement('div');
  line.id = LINE_ID;
  line.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 3px;
    z-index: 2147483647;
    pointer-events: none;
    background: linear-gradient(90deg, #d32f2f, #e07b2e, #f5e050, #8fe03a, #4cb85a, #6ff2ff, #3f8fe0, #5a1fc4, #d32f2f);
    background-size: 200% 100%;
  `;
  (document.body || document.documentElement).appendChild(line);

  // Web Animations API (no <style> keyframes, so page CSP can't block it);
  // static gradient if the system asks for reduced motion.
  let anim = null;
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    anim = line.animate(
      [{ backgroundPosition: '0 0' }, { backgroundPosition: '-200% 0' }],
      { duration: 5000, iterations: Infinity, easing: 'linear' }
    );
  }

  window.__grd = {
    version: VERSION,
    teardown() {
      if (anim) anim.cancel();
      line.remove();
    },
  };
})();
