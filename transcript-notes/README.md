# Transcript Notes — Paste, Click, Collect (Chrome Extension)

Source-agnostic sibling of **yt-notes**: paste any transcript — Coursera courses, lecture captions, talk transcripts — and it splits into clickable sentences. Click the ones worth keeping, type your own notes, export to clipboard or a `.txt` file.

## How It Works

1. Copy a transcript anywhere (e.g., Coursera's transcript panel)
2. On any page, click the extension toolbar icon (no popup — one click toggles the panel)
3. **Read clipboard** pulls it in directly (or paste into the box with Cmd+V and hit **Split into sentences**)
4. The transcript renders as sentence rows — `[MUSIC]`/`[APPLAUSE]`-style caption noise is stripped automatically
5. **Click a sentence** → it's collected (turns green); click again to deselect
6. **Type your own note** → Enter (or **Add**) appends it to the same list
7. **Copy** puts the selection on the clipboard; **.txt** downloads `transcript-notes.txt`

## Features

- **Sentence splitting** — splits on `.?!` boundaries; falls back to line-by-line if the paste has no sentence punctuation (one-caption-per-line formats)
- **Noise stripping** — `[MUSIC]`, `[APPLAUSE]`, `[Laughter]`, `[inaudible]` etc. removed on load
- **Toggle collect** — click selects (green), click again deselects; chips show `s1 s2 ...` (transcript picks) and `n1 n2 ...` (typed notes)
- **Insertion-order export** — entries export exactly as you collected them: clicked sentences and typed notes interleaved in entry order, blank line between each
- **Two export paths** — clipboard copy or `.txt` download (Blob URL, no server)
- **Paste another** — swap in a new transcript without closing the panel
- **No popup** — toolbar icon toggles via `action.onClicked` + `chrome.scripting`
- No persistent permissions, no data collection

## Installation

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this `transcript-notes` folder
5. Pin the extension to your toolbar

## Where It Works

Any regular webpage. Does **not** work on Chrome internal pages (`chrome://` URLs) — this is a Chrome security restriction.

## Files

| File | Description |
|------|-------------|
| `manifest.json` | Manifest V3 config — `activeTab` + `scripting` permissions, `action.onClicked` service worker |
| `background.js` | Toolbar-icon click handler — injects `inject.js` into the active tab |
| `inject.js` | Self-contained panel (paste zone, sentence splitter, toggle-collect rows, typed-note input, export) |
| `generate_icons.py` | Pillow script that regenerates the icons |
| `icon48.png` | Toolbar icon (48x48) |
| `icon128.png` | Store icon (128x128) |

## License

MIT
