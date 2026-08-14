const toggleBtn = document.getElementById('toggleBtn');
const brightnessSlider = document.getElementById('brightness');
const contrastSlider = document.getElementById('contrast');
const status = document.getElementById('status');

// --- Init: sync UI from the page's current dark mode state ---
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const STATE_KEY = '__ext_dark_mode';
        const STYLE_ID = '__ext_dark_mode_style';
        let state = null;
        try { state = JSON.parse(localStorage.getItem(STATE_KEY)); } catch (e) {}
        return {
          active: !!document.getElementById(STYLE_ID),
          brightness: state?.brightness ?? 80,
          contrast: state?.contrast ?? 100
        };
      }
    });
    const { active, brightness, contrast } = results[0].result;
    brightnessSlider.value = brightness;
    contrastSlider.value = contrast;
    if (active) {
      status.textContent = 'Dark mode is ON';
      status.className = 'success';
    }
  } catch (e) {
    // non-injectable page — leave defaults
  }
})();

// --- Toggle ---
toggleBtn.addEventListener('click', async () => {
  const brightness = parseInt(brightnessSlider.value);
  const contrast = parseInt(contrastSlider.value);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: toggleDarkMode,
      args: [brightness, contrast]
    });
    const nowOn = results[0].result;
    status.textContent = nowOn ? 'Dark mode is ON' : 'Dark mode is OFF';
    status.className = nowOn ? 'success' : '';
  } catch (err) {
    status.textContent = 'Cannot inject on this page';
    status.className = 'error';
  }
});

// --- Sliders ---
brightnessSlider.addEventListener('input', updateFilters);
contrastSlider.addEventListener('input', updateFilters);

async function updateFilters() {
  const brightness = parseInt(brightnessSlider.value);
  const contrast = parseInt(contrastSlider.value);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: adjustFilters,
      args: [brightness, contrast]
    });
  } catch (err) {
    // ignore if page can't be injected
  }
}

// --- Injected functions (run in page context) ---

function toggleDarkMode(brightness, contrast) {
  const STYLE_ID = '__ext_dark_mode_style';
  const STATE_KEY = '__ext_dark_mode';
  const existing = document.getElementById(STYLE_ID);

  if (existing) {
    existing.remove();
    document.querySelectorAll('img, video, canvas, svg, [style*="background-image"]').forEach(el => {
      el.style.removeProperty('filter');
    });
    localStorage.removeItem(STATE_KEY);
    return false; // now OFF
  }

  const b = (brightness / 100).toFixed(2);
  const c = (contrast / 100).toFixed(2);

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
  document.head.appendChild(style);
  localStorage.setItem(STATE_KEY, JSON.stringify({ enabled: true, brightness, contrast }));
  return true; // now ON
}

function adjustFilters(brightness, contrast) {
  const STYLE_ID = '__ext_dark_mode_style';
  const STATE_KEY = '__ext_dark_mode';
  const existing = document.getElementById(STYLE_ID);
  if (!existing) return;

  const b = (brightness / 100).toFixed(2);
  const c = (contrast / 100).toFixed(2);

  existing.textContent = `
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

  // Persist updated values
  let state = {};
  try { state = JSON.parse(localStorage.getItem(STATE_KEY)) || {}; } catch (e) {}
  state.brightness = brightness;
  state.contrast = contrast;
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}
