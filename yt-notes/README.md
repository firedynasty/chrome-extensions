# YT Notes — Click Transcript to Collect (Chrome Extension)

Lazy note-taking for YouTube talks and lectures: click transcript lines to append them to a running clipboard list **with clickable markdown timestamp links**, and type your own notes into a floating dialog. Every line lands in one newline-separated clipboard — paste once at the end and all your notes drop into your file (Obsidian-ready) in the order you collected them.

## How It Works

1. *(Optional but recommended)* Download the transcript first:
   ```bash
   ytnotes https://www.youtube.com/watch?v=VIDEO_ID
   ```
   This saves `transcripts/VIDEO_ID.json` inside the extension folder (see `yt_notes.py` / the `ytnotes` shell function).
2. Open the YouTube video
3. Click the extension toolbar icon (no popup — one click toggles notes mode on)
4. **If a downloaded transcript exists**, it renders right in the floating dialog — no YouTube transcript panel needed. If not, the extension falls back to YouTube's own transcript panel (auto-opened).
5. **Click any transcript line** → it's appended as `[H:MM:SS](https://www.youtube.com/watch?v=ID&t=Ns) spoken text` — a markdown link that jumps to that exact moment when clicked in Obsidian (the video does **not** seek — the click is intercepted while notes mode is on)
6. **Type your own note** → Enter (or **Add**) appends it with a timestamp link to the video's *current playback position*: `your note [H:MM:SS](...&t=Ns)`
7. Paste anywhere — the clipboard always holds the full list, each note separated by a blank line so entries never paste as one inline blob

## Features

- **Downloaded-transcript auto-load** — `transcripts/<videoId>.json` is matched to the video you're watching and rendered in the panel; unpacked extensions read from disk per fetch, so new downloads appear with no extension reload
- **Clickable timestamp links** — every collected line carries `[H:MM:SS](...&t=Ns)`, the plain-link markdown form Obsidian renders as a jump-to-moment link
- **Follow-along highlight** — the row matching the video's current time stays highlighted and scrolled into view; collected rows turn green so you know what you've already grabbed
- **Timestamped typed notes** — your own notes get stamped with the video's current playback time
- **Click-to-collect** on the native transcript as fallback — works with both YouTube transcript renderers (`transcript-segment-view-model` and `ytd-transcript-segment-renderer`)
- **No accidental seeks** — capture-phase click interception stops YouTube's jump-to-timestamp while collecting
- **Floating display dialog** — collected lines shown as compact `[1] [2] [3]` chips so the dialog stays tiny (the clipboard always carries the full text)
- **Copy+Clear** copies the whole list then empties it — paste, then start a fresh batch; **Clear** empties without copying, **✕** turns notes mode off
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

Any YouTube watch page. Downloaded transcripts require the video to have captions (auto-generated is fine). Does **not** work on Chrome internal pages (`chrome://` URLs) — this is a Chrome security restriction.

## Files

| File | Description |
|------|-------------|
| `manifest.json` | Manifest V3 config — `activeTab` + `scripting` permissions, `web_accessible_resources` exposing `transcripts/`, `action.onClicked` service worker |
| `background.js` | Toolbar-icon click handler — injects `inject.js` into the active tab |
| `inject.js` | Self-contained notes collector (toggle on/off, transcript JSON auto-load + render, YouTube transcript interception, dialog UI) |
| `transcripts/` | Downloaded transcripts as `<videoId>.json` (`[{"start": secs, "text": ...}]`), written by `yt_notes.py` / `ytnotes` |
| `generate_icons.py` | Pillow script that regenerates the icons |
| `icon48.png` | Toolbar icon (48x48) |
| `icon128.png` | Store icon (128x128) |

## License

MIT
