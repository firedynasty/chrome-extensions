# Translate Rows

Paste text, get one row per line, click a row to open that line in Google Translate in a new tab.

Port of `sendToGoogleDrive/translate/python_script_break_url.py` (split a Google Translate URL's `text` into lines, open one line at a time).

## Install
`chrome://extensions` -> Developer mode -> Load unpacked -> select this folder.

## Use
1. Click the toolbar icon, paste text (or hit **Paste**). Pasting a `translate.google.com/?...&text=...` URL also works: its lines and `sl`/`tl` languages are used.
2. Pick source and target languages from the dropdowns (Cantonese `yue`, Mandarin `zh-CN`/`zh-TW`, or Detect).
3. Click a row to open its translation in a new tab (Cmd/Ctrl-click keeps it in the background). Opened rows dim.

Text and languages persist between popup opens. No permissions required.
