# Audio Visualizer Overlay — Chrome Extension

A Chrome extension that overlays a real-time audio frequency visualizer on any webpage. Captures tab audio via `getDisplayMedia` and renders animated frequency bars on a transparent canvas overlay.

Based on the audio visualizer by [Nick Jones](https://codepen.io/nfj525/pen/rVBaab).

## How It Works

1. Click the extension icon on any page
2. Hit **Toggle Visualizer**
3. Chrome will prompt you to share a tab — make sure to check **"Share tab audio"**
4. Frequency bars appear along the bottom of the page, overlaying whatever content is on screen
5. Click again to toggle off, or stop sharing to auto-cleanup

## Features

- Works on **any webpage** (YouTube, Spotify web, any page playing audio)
- Transparent overlay — doesn't block interaction with the page underneath (`pointer-events: none`)
- Real-time frequency analysis using the Web Audio API (`AnalyserNode`, FFT size 256)
- Red-green gradient bars at 70% opacity
- Auto-resizes on window resize
- Cleans up when you stop sharing or toggle off

## Installation

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this `yt-transcript-extension` folder
5. Pin the extension to your toolbar for easy access

## Files

| File | Description |
|------|-------------|
| `manifest.json` | Manifest V3 config — `activeTab` + `scripting` permissions |
| `popup.html` | Extension popup UI |
| `popup.js` | Injects visualizer overlay + audio capture logic into the active tab |
| `icon48.png` | Toolbar icon (48x48) |
| `icon128.png` | Store icon (128x128) |

## Permissions

- **activeTab** — access to the current tab only when you click the extension
- **scripting** — inject the visualizer script into the page

No background scripts, no persistent permissions, no data collection.

## Where It Works

The extension injects into **any regular webpage** — your personal sites, YouTube, Spotify web, localhost dev servers, etc.

It does **not** work on Chrome internal pages like `chrome://extensions` or `chrome://settings` — this is a Chrome security restriction that applies to all extensions.

## Notes

- The audio capture uses `getDisplayMedia` which requires user consent each time
- Audio continues playing normally — the visualizer taps into the stream without interrupting it

## License

The MIT License (MIT)

Copyright (c) 2026 Nick Jones (https://codepen.io/nfj525/pen/rVBaab)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
