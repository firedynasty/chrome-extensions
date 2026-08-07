# YT Notes — Click Transcript to Collect (Chrome Extension)

Lazy note-taking for YouTube talks and lectures: click lines in YouTube's **own transcript panel** to append them to a running clipboard list, and type your own notes into a floating dialog. Every line lands in one newline-separated clipboard — paste once at the end and all your notes drop into your file in the order you collected them.

## How It Works

1. Open a YouTube video
2. Click the extension toolbar icon (no popup — one click toggles notes mode on)
3. A floating dialog appears (top-right) and the transcript panel opens automatically if it isn't already
4. **Click any transcript line** → it's appended to the list (the video does **not** jump — the click is intercepted while notes mode is on)
5. **Type your own note** into the dialog's input → Enter (or **Add**) appends it in place
6. Paste anywhere — the clipboard always holds the full list, one line per note

## Features

- **Click-to-collect** on the native transcript — works with both YouTube transcript renderers (`transcript-segment-view-model` and `ytd-transcript-segment-renderer`)
- **No accidental seeks** — capture-phase click interception stops YouTube's jump-to-timestamp while collecting
- **Floating display dialog** — numbered list of everything collected, each line shown as a short 10-character preview so the dialog stays compact over the transcript (the clipboard always carries the full text), auto-scrolls to the newest line
- **Typed notes** — input box appends your own text into the same list, interleaved with transcript lines
- **Per-line ✕** to remove a mistaken capture (clipboard re-syncs)
- **Copy+Clear** copies the whole list then empties it — paste, then start a fresh batch; **Clear** empties without copying, **✕** turns notes mode off
- **Auto-opens the transcript** (expands the description, clicks "Show transcript", waits for segments); falls back to a hint if the video has no transcript
- Buffer **survives YouTube's in-app navigation** — collect across multiple videos, paste once
- **No popup** — clicking the toolbar icon toggles notes mode on/off directly (`action.onClicked` + `chrome.scripting`)
- No persistent permissions, no data collection

## Installation

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this `yt-notes` folder
5. Pin the extension to your toolbar

## Where It Works

Any YouTube watch page with a transcript. Does **not** work on Chrome internal pages (`chrome://` URLs) — this is a Chrome security restriction.

## Files

| File | Description |
|------|-------------|
| `manifest.json` | Manifest V3 config — `activeTab` + `scripting` permissions, `action.onClicked` service worker |
| `background.js` | Toolbar-icon click handler — injects `inject.js` into the active tab |
| `inject.js` | Self-contained notes collector (toggle on/off, transcript interception, dialog UI) |
| `generate_icons.py` | Pillow script that regenerates the icons |
| `icon48.png` | Toolbar icon (48x48) |
| `icon128.png` | Store icon (128x128) |

## License

MIT
