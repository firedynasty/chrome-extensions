(function () {
  const STATE_KEY = '__ext_dark_mode';
  const STYLE_ID = '__ext_dark_mode_style';

  if (document.getElementById(STYLE_ID)) return; // already applied (e.g. SPA re-run)

  let state;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return;
    state = JSON.parse(raw);
  } catch (e) {
    return;
  }
  if (!state || !state.enabled) return;

  const b = ((state.brightness ?? 80) / 100).toFixed(2);
  const c = ((state.contrast ?? 100) / 100).toFixed(2);

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    html {
      filter: invert(1) hue-rotate(180deg) brightness(${b}) contrast(${c});
      transition: filter 0.3s ease;
    }
    img, video, canvas, svg, [style*="background-image"], picture, figure img {
      filter: invert(1) hue-rotate(180deg) !important;
    }
    iframe {
      filter: invert(1) hue-rotate(180deg) !important;
    }
  `;
  // Append to <html> since <head> may not exist yet at document_start
  document.documentElement.appendChild(style);
})();
