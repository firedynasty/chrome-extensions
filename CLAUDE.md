# CLAUDE.md

## Project Overview

This repo is a collection of Chrome extensions (Manifest V3) that repurpose functionality from existing personal projects into standalone browser extensions usable on any webpage.

## Origin

Code is adapted from:
- **vercel_youtube** (`vercel-youtubeviewer.vercel.app`) — audio visualizer overlay, paste-media Toggle modal (`pmEntries` localStorage format), Loop Mix segment looper modal (`mix_mp3.py` parsing semantics + boundary noise)
- **js-audio-visualizer** — Nick Jones' audio visualizer (MIT, https://codepen.io/nfj525/pen/rVBaab)

## Extensions

### yt-transcript-extension
Audio visualizer overlay that captures tab audio via `getDisplayMedia` and renders frequency bars on any page. Same visualization as the one built into the YouTube Viewer.

### dark-mode-toggle
Per-page dark mode using CSS `filter: invert(1) hue-rotate(180deg)` with brightness/contrast sliders. Images/videos/iframes are re-inverted to look normal.

### modal-to-localstorage (YouTube Links)
Side panel overlay to manage YouTube video links. Reads/writes the same `pmEntries` localStorage key (`{ videoId, title, url }` format) as the YouTube Viewer's Toggle modal. Supports inline title editing, copy, delete, clipboard paste, and `URL(title)` / `URL, title` input parsing.

### looper (Loop Mix — Segment Looper)
Loops segments of any HTML5 video/audio on any page. Port of the YouTube Viewer's Loop Mix modal: `start, end, [loops]` lines (colon end = absolute, plain number = duration), generated table with per-row ▶, paste-from-clipboard button, white-noise burst at loop seams, floating cancel chip while a loop runs, playback continues after the final loop. Version-stamped singleton (`window.__lmx`) tears down stale injected DOM on upgrade.

## Conventions

- All extensions use Manifest V3 with minimal permissions (`activeTab` + `scripting`)
- No background scripts, no persistent permissions, no data collection
- Extensions inject into the active tab via `chrome.scripting.executeScript` from a popup
- Cannot inject on `chrome://` pages (Chrome security restriction)
- Icons are generated via Python/Pillow scripts

## Adding a New Extension

1. Create a folder with `manifest.json`, `popup.html`, `popup.js`, icons, and `README.md`
2. Use `activeTab` + `scripting` permissions pattern
3. Inject functionality via `chrome.scripting.executeScript` with a self-contained function
4. Add a README describing installation and usage
