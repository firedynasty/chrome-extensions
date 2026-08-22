# Loop Mix — Segment Looper (Chrome Extension)

Loops segments of any HTML5 video or audio on any page. Ported from the **Loop Mix** modal in the YouTube Viewer (`vercel_youtube`), which itself mimics the `Start, End, [Loops]` dialog that pipes into `mix_mp3.py`.

## How It Works

Click the extension icon → the Loop Mix modal is injected into the active tab immediately (no button to press; the popup closes itself and only stays visible if injection fails). Enter one segment per line:

```
start, end, [loops]
```

- `1:30, 1:44` — play 1:30→1:44 once
- `2:00, 2:10, 5` — play 2:00→2:10 five times
- `3:00, 15, 3` — end **without a colon** = duration in seconds (plays 3:00→3:15, 3×)

**Generate Table ▶** parses every line into a numbered table (bad lines show their error inline). Each row's **▶** starts looping that segment and closes the modal so playback stays visible.

A plain YouTube URL on its own row is not a segment — it makes a **YouTube ↗** link appear next to Generate Table (opens the video in a new tab) and is ignored by the table.

## Features

- **mix_mp3.py parsing semantics** — colon end = absolute timestamp, plain-number end = duration; loops default to 1
- **Paste Clipboard button** — fills the textarea from the clipboard (same as the Viewer's Paste Media modal)
- **White noise toggle** — 🌊 button in the modal plays continuous looped white noise (same pattern as bach-player) with −/+ volume buttons and a % readout; keeps playing with the modal closed, reopen via the toolbar icon to stop/adjust
- **Floating chip** while a loop runs (`🔁 1:30→1:44 · loop 2/5`) with ⏸/▶ to pause/resume and ✕ to cancel — pausing suspends the loop engine too (interval cleared), resuming restarts it; pause/play from the page's own controls suspends/resumes the looper as well. Cancel stops rewinding but leaves playback running. The chip always shows the **segment table** below the label (parsed fresh from the modal textarea) with a per-row ▶, so you can switch rows without reopening the modal — the currently looping row is highlighted
- After the final loop, the loop engine stops and **playback keeps going** — no pause
- **Escape** closes the modal, **Ctrl/Cmd+Enter** generates the table
- Works on any `<video>`/`<audio>` — prefers the currently playing element, falls back to the largest one
- No background script, no persistent permissions, no data collection

## Installation

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this `looper` folder
5. Pin the extension to your toolbar

## Where It Works

Works on any regular webpage with HTML5 media — YouTube, Vimeo, file:// videos, localhost dev servers, etc.

Does **not** work on Chrome internal pages (`chrome://` URLs) — this is a Chrome security restriction.

## Files

| File | Description |
|------|-------------|
| `manifest.json` | Manifest V3 config — `activeTab` + `scripting` permissions |
| `popup.html` | Extension popup — auto-injects on open; stays visible only to show an injection error |
| `popup.js` | Injects the self-contained Loop Mix modal + loop engine into the active tab |
| `generate_icons.py` | Pillow script that regenerates the icons |
| `icon48.png` | Toolbar icon (48x48) |
| `icon128.png` | Store icon (128x128) |

## License

MIT
