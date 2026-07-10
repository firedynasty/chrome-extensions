# YouTube Links — Chrome Extension

A Chrome extension that opens a side panel overlay on any page to manage YouTube video entries. Saves to the same `pmEntries` localStorage key used by the YouTube Viewer's Toggle modal, so entries stay in sync.

## How It Works

1. Click the extension icon on any page
2. Hit **Toggle Links Panel** — a side panel slides in on the right
3. Paste YouTube URL(s) and hit **Add** or press Enter
4. Entries save to `pmEntries` in localStorage — the same key your YouTube Viewer reads
5. Go back to your YouTube Viewer, hit Toggle — your entries are there

## Features

- **Same `pmEntries` format** — `{ videoId, title, url }` entries, compatible with the YouTube Viewer Toggle modal
- **Same input parsing** — supports `URL(title)` and `URL, title` formats
- **Edit titles** — click Edit on any entry to rename it inline (Enter to save, Escape to cancel)
- **Copy individual URLs** — Copy button per entry
- **Delete individual entries** — X button per entry
- **Clipboard paste** — one-click paste from clipboard into the input
- **Copy All** — copies all entries in `URL(title)` format
- **Clear All** — wipe all pmEntries
- **Duplicate detection** — won't add the same videoId twice
- **Side panel** — doesn't cover the whole page, sits on the right

## Installation

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this `modal-to-localstorage` folder
5. Pin the extension to your toolbar

## Where It Works

Works on any regular webpage — YouTube, personal sites, localhost dev servers, etc.

Does **not** work on Chrome internal pages (`chrome://` URLs) — this is a Chrome security restriction.

## Storage

Entries are stored in the page's `localStorage` under the key `pmEntries` as a JSON array. Each entry has `{ videoId, title, url }`. This is the same format and key used by the YouTube Viewer app's Toggle modal.

## Adaptation

The adaptation is from https://vercel-youtubeviewer.vercel.app/

There is a toggle button in the navbar that allows for saving YouTube media links into pmEntries, localStorage so it persists.

## Files

| File | Description |
|------|-------------|
| `manifest.json` | Manifest V3 config — `activeTab` + `scripting` + `storage` permissions |
| `popup.html` | Extension popup UI |
| `popup.js` | Injects the YouTube links panel overlay into the active tab |
| `icon48.png` | Toolbar icon (48x48) |
| `icon128.png` | Store icon (128x128) |

## License

MIT
