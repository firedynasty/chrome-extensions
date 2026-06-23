# Dark Mode Toggle — Chrome Extension

A Chrome extension that toggles dark mode on the **current page only** — not globally across all tabs. Click once to darken, click again to restore.

## How It Works

Uses CSS `filter: invert(1) hue-rotate(180deg)` on the page, then re-inverts images, videos, canvases, and iframes so media looks normal. No page content is modified — just a single style tag injected and removed.

## Features

- **Per-page toggle** — only affects the tab you click on, not all pages
- **Brightness slider** — adjust from 50% to 100%
- **Contrast slider** — adjust from 80% to 120%
- Images, videos, SVGs, and iframes are automatically preserved (re-inverted)
- Smooth 0.3s transition when toggling
- Click again to fully remove — no leftover styles

## Installation

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this `dark-mode-toggle` folder
5. Pin the extension to your toolbar

## Where It Works

Works on any regular webpage — your personal sites, YouTube, Wikipedia, docs, localhost dev servers, etc.

Does **not** work on Chrome internal pages (`chrome://` URLs) — this is a Chrome security restriction.

## Files

| File | Description |
|------|-------------|
| `manifest.json` | Manifest V3 config — `activeTab` + `scripting` permissions |
| `popup.html` | Extension popup with toggle button and sliders |
| `popup.js` | Injects/removes dark mode CSS on the active tab |
| `icon48.png` | Toolbar icon (48x48) |
| `icon128.png` | Store icon (128x128) |

## License

MIT
