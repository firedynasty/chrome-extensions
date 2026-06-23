const toggleBtn = document.getElementById('toggleBtn');
const brightnessSlider = document.getElementById('brightness');
const contrastSlider = document.getElementById('contrast');
const status = document.getElementById('status');

toggleBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: toggleDarkMode
    });
    status.textContent = 'Toggled!';
    status.className = 'success';
  } catch (err) {
    status.textContent = 'Cannot inject on this page';
    status.className = 'error';
  }
});

brightnessSlider.addEventListener('input', updateFilters);
contrastSlider.addEventListener('input', updateFilters);

async function updateFilters() {
  const brightness = brightnessSlider.value;
  const contrast = contrastSlider.value;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: adjustFilters,
      args: [parseInt(brightness), parseInt(contrast)]
    });
  } catch (err) {
    // ignore if page can't be injected
  }
}

function toggleDarkMode() {
  const STYLE_ID = '__ext_dark_mode_style';
  const existing = document.getElementById(STYLE_ID);

  if (existing) {
    existing.remove();
    // Restore images/videos/canvas
    document.querySelectorAll('img, video, canvas, svg, [style*="background-image"]').forEach(el => {
      el.style.removeProperty('filter');
    });
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    html {
      filter: invert(1) hue-rotate(180deg) brightness(0.8) contrast(1.0);
      transition: filter 0.3s ease;
    }

    /* Re-invert media so images/videos look normal */
    img,
    video,
    canvas,
    svg,
    [style*="background-image"],
    picture,
    figure img {
      filter: invert(1) hue-rotate(180deg) !important;
    }

    /* Fix common iframe content (YouTube embeds, etc.) */
    iframe {
      filter: invert(1) hue-rotate(180deg) !important;
    }
  `;
  document.head.appendChild(style);
}

function adjustFilters(brightness, contrast) {
  const STYLE_ID = '__ext_dark_mode_style';
  const existing = document.getElementById(STYLE_ID);
  if (!existing) return; // dark mode not active

  const b = brightness / 100;
  const c = contrast / 100;

  existing.textContent = `
    html {
      filter: invert(1) hue-rotate(180deg) brightness(${b}) contrast(${c});
      transition: filter 0.3s ease;
    }

    img,
    video,
    canvas,
    svg,
    [style*="background-image"],
    picture,
    figure img {
      filter: invert(1) hue-rotate(180deg) !important;
    }

    iframe {
      filter: invert(1) hue-rotate(180deg) !important;
    }
  `;
}
