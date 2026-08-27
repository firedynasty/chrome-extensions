# Copy Text Tooltip

Select any text on a webpage and a small tooltip appears beside it with a one-click **Copy** button — snippet preview, character count, and a `Copied` confirmation.

## Install

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and choose this `copy-text-tooltip` folder

## Usage

- Click the toolbar icon to activate on the current tab — a floating **Copy** chip appears at the bottom-right showing the ON state
- Highlight any text — the tooltip pops up next to it
- Click **Copy** to copy the selected text to the clipboard (the selection is cleared and the tooltip auto-closes)
- Click anywhere outside the tooltip (or the `x` button) to dismiss it without copying
- Click the chip to toggle ON/OFF (OFF pauses tooltips without leaving the page); click the chip's `x` or the toolbar icon again to deactivate fully

Cannot run on `chrome://` pages (Chrome security restriction).

## Icons

Regenerate with:

```bash
python generate_icons.py
```
