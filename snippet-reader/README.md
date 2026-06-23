# Snippet Reader

Chrome extension to save text snippets and read them aloud using text-to-speech (TTS). Adapted from the Snippets and Repeat modals in [vercel_bible_current](https://github.com/stanleytan/vercel_bible_current).

## Features

- **Save snippets** — type or paste text, save to localStorage (`saved-snippets` key)
- **Paste (New) / Paste (Append)** — clipboard buttons like the Repeat modal
- **Read Aloud from input** — read the textarea text via TTS without saving
- **Click any saved snippet to read it aloud** — no clipboard copy, just TTS
- **Click again to stop** — toggles reading on/off
- **Delete individual snippets** or **Clear All**
- Duplicate detection — won't save the same text twice

## Installation

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this `snippet-reader` folder

## Usage

1. Click the extension icon on any page
2. Click **Toggle Snippet Panel** to open the side panel
3. Type or paste text into the textarea
4. Click **Save Snippet** to save it, or **Read Aloud** to hear it immediately
5. Click any saved snippet to have it read aloud
6. Click a reading snippet again to stop

## Storage

Uses `saved-snippets` localStorage key (separate from `pmEntries` used by the YouTube modal extension). Format: `[{ text, label, savedAt }]`.
