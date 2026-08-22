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
Loops segments of any HTML5 video/audio on any page. Port of the YouTube Viewer's Loop Mix modal: `start, end, [loops]` lines (colon end = absolute, plain number = duration), generated table with per-row ▶, paste-from-clipboard button, white-noise burst at loop seams, floating chip (pause/resume + cancel + always-visible segment table with per-row ▶) while a loop runs, playback continues after the final loop. Version-stamped singleton (`window.__lmx`) tears down stale injected DOM on upgrade.

### yt-notes (Click Transcript to Collect)
Lazy note-taking on YouTube watch pages. No popup — the toolbar icon toggles capture mode directly via an `action.onClicked` service worker (event-driven exception to the no-background-scripts convention). Clicks on the native transcript segments are intercepted (capture phase, so the video doesn't seek) and the text is appended to a running buffer; a floating dialog shows compact `[n]` chips per collected line with a typed-note input and Copy+Clear/Clear/close buttons. Every append rewrites the clipboard with the full blank-line-joined list. Auto-opens the transcript panel if needed. Version-stamped singleton (`window.__ytn`).

## Conventions

- All extensions use Manifest V3 with minimal permissions (`activeTab` + `scripting`)
- No background scripts, no persistent permissions, no data collection
- Extensions inject into the active tab via `chrome.scripting.executeScript` from a popup
- Cannot inject on `chrome://` pages (Chrome security restriction)
- Icons are generated via Python/Pillow scripts

## Editing Injected Scripts (gotchas)

Injected files (`looper/popup.js`, `yt-notes/inject.js`) keep **string literals pure ASCII**:
non-ASCII chars appear either as literal `\uXXXX` escape sequences (8 ASCII bytes in the file,
e.g. `'  \u00B7  '`) or are built with `String.fromCharCode(0xXXXX)` / `String.fromCodePoint(...)`.

**Why:** the injected function is serialized and re-run in the tab's JS realm. A literal
multibyte char in a string turns into mojibake if the charset is misdetected; escapes and
`fromCharCode` can't be misdetected. (Comments are exempt — em-dashes etc. there are fine.)

**Edit-tool trap:** putting `\u00B7` in an Edit `old_string`/`new_string` gets unicode-decoded
to the actual `·` character before the match runs, so it never matches the literal backslash-
escape bytes in the file. `\\u00B7` doesn't help either (passes through as two backslashes).

**Workarounds (fastest path):**

1. Check what's actually in the file first: `sed -n 'NNNp' file | od -c` shows literal bytes.
2. Never anchor `old_string` on a string containing `\uXXXX` — anchor on escape-free text
   instead (e.g. replace only the *prefix* of a line, leaving the escaped tail untouched).
3. In `new_string`, write non-ASCII as `String.fromCharCode(0xXXXX)` — not the literal glyph,
   not a `\uXXXX` escape.
4. After a prefix edit, re-read the merged line — partial replacements can eat a space
   (e.g. produced `firstLine ?'` instead of `firstLine ? '`).
5. Verify after editing: `node --check file` for syntax, and
   `LC_ALL=C grep -n '[^ -~]' file` (BSD grep on macOS — `-P` doesn't exist) to confirm no
   non-ASCII leaked into string literals; comment lines will match and can be eyeballed past.

**Version-stamp rule:** any change to injected code must bump the singleton version
(`LMX_VERSION` in looper, the `window.__ytn` version in yt-notes) so the next toolbar-icon
click tears down stale DOM/closures. Then reload at `chrome://extensions` and click the icon.

## Adding a New Extension

1. Create a folder with `manifest.json`, `popup.html`, `popup.js`, icons, and `README.md`
2. Use `activeTab` + `scripting` permissions pattern
3. Inject functionality via `chrome.scripting.executeScript` with a self-contained function
4. Add a README describing installation and usage
